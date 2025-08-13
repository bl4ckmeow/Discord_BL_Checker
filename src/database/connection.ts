import mysql from 'mysql2/promise';
import { EnvironmentConfig } from '../config/environment';
import { logger } from '../utils/Logger';
import { errorHandler } from '../utils/ErrorHandler';

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
  acquireTimeout: number;
  timeout: number;
  reconnect: boolean;
  reconnectDelay: number;
}

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool: mysql.Pool | null = null;
  private config: DatabaseConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second

  private constructor() {
    const envConfig = EnvironmentConfig.getInstance();
    this.config = this.parseConnectionString(envConfig.mysqlUrl);
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  private parseConnectionString(connectionString: string): DatabaseConfig {
    try {
      const url = new URL(connectionString);
      
      return {
        host: url.hostname,
        port: parseInt(url.port) || 3306,
        user: url.username,
        password: url.password,
        database: url.pathname.slice(1), // Remove leading slash
        connectionLimit: 10,
        acquireTimeout: 60000,
        timeout: 60000,
        reconnect: true,
        reconnectDelay: 2000
      };
    } catch (error) {
      throw new Error(`Invalid MySQL connection string: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async connect(): Promise<void> {
    const dbLogger = logger.child('DatabaseConnection');
    
    try {
      if (this.pool) {
        dbLogger.debug('Database pool already exists, skipping connection');
        return; // Already connected
      }

      dbLogger.info('Creating database connection pool', {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        connectionLimit: this.config.connectionLimit
      });

      this.pool = mysql.createPool({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        connectionLimit: this.config.connectionLimit,
        queueLimit: 0,
        multipleStatements: false, // Security: prevent multiple statements
      });

      // Test the connection
      await this.testConnection();
      
      dbLogger.info('Database connection pool created successfully');
      this.reconnectAttempts = 0; // Reset on successful connection
      
    } catch (error) {
      const errorResult = errorHandler.handleDatabaseError(error, 'connect', 'DatabaseConnection');
      
      if (errorResult.shouldRetry) {
        await this.handleConnectionError(error);
      } else {
        throw error;
      }
    }
  }

  private async testConnection(): Promise<void> {
    const dbLogger = logger.child('DatabaseConnection');
    
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const connection = await this.pool.getConnection();
    try {
      dbLogger.debug('Testing database connection');
      await connection.ping();
      dbLogger.info('Database connection test successful');
    } catch (error) {
      dbLogger.error('Database connection test failed', error instanceof Error ? error : undefined);
      throw error;
    } finally {
      connection.release();
    }
  }

  private async handleConnectionError(error: unknown): Promise<void> {
    const dbLogger = logger.child('DatabaseConnection');
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      const finalError = new Error(`Failed to connect to database after ${this.maxReconnectAttempts} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      dbLogger.error('Maximum reconnection attempts reached', finalError, {
        attempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts
      });
      throw finalError;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    dbLogger.warn(`Database connection failed. Retrying in ${delay}ms`, {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delay,
      error: error instanceof Error ? error.message : String(error)
    });
    
    await new Promise(resolve => setTimeout(resolve, delay));
    await this.connect();
  }

  public async getConnection(): Promise<mysql.PoolConnection> {
    const dbLogger = logger.child('DatabaseConnection');
    
    if (!this.pool) {
      dbLogger.debug('Pool not initialized, connecting...');
      await this.connect();
    }

    if (!this.pool) {
      throw new Error('Database connection pool not available');
    }

    try {
      dbLogger.debug('Acquiring database connection from pool');
      const connection = await this.pool.getConnection();
      dbLogger.debug('Database connection acquired successfully');
      return connection;
    } catch (error) {
      const errorResult = errorHandler.handleDatabaseError(error, 'getConnection', 'DatabaseConnection');
      
      if (errorResult.shouldRetry) {
        dbLogger.info('Attempting to reconnect and retry connection acquisition');
        // Try to reconnect and get connection again
        await this.reconnect();
        if (!this.pool) {
          throw new Error('Failed to reconnect to database');
        }
        return await this.pool.getConnection();
      } else {
        throw error;
      }
    }
  }

  public async query<T = any>(sql: string, params?: any[]): Promise<T> {
    const dbLogger = logger.child('DatabaseConnection');
    const connection = await this.getConnection();
    
    try {
      dbLogger.debug('Executing database query', {
        sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
        paramCount: params?.length || 0
      });
      
      const startTime = Date.now();
      const [rows] = await connection.execute(sql, params);
      const duration = Date.now() - startTime;
      
      dbLogger.debug('Database query completed successfully', {
        duration,
        rowCount: Array.isArray(rows) ? rows.length : 'N/A'
      });
      
      return rows as T;
    } catch (error) {
      errorHandler.handleDatabaseError(error, 'query', 'DatabaseConnection');
      dbLogger.error('Database query failed', error instanceof Error ? error : undefined, {
        sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
        paramCount: params?.length || 0
      });
      throw error;
    } finally {
      connection.release();
      dbLogger.debug('Database connection released');
    }
  }

  public async transaction<T>(callback: (connection: mysql.PoolConnection) => Promise<T>): Promise<T> {
    const dbLogger = logger.child('DatabaseConnection');
    const connection = await this.getConnection();
    
    try {
      dbLogger.debug('Starting database transaction');
      await connection.beginTransaction();
      
      const startTime = Date.now();
      const result = await callback(connection);
      const duration = Date.now() - startTime;
      
      await connection.commit();
      dbLogger.debug('Database transaction committed successfully', { duration });
      
      return result;
    } catch (error) {
      dbLogger.warn('Database transaction failed, rolling back', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      try {
        await connection.rollback();
        dbLogger.debug('Database transaction rolled back successfully');
      } catch (rollbackError) {
        dbLogger.error('Failed to rollback transaction', rollbackError instanceof Error ? rollbackError : undefined);
      }
      
      errorHandler.handleDatabaseError(error, 'transaction', 'DatabaseConnection');
      throw error;
    } finally {
      connection.release();
      dbLogger.debug('Database connection released after transaction');
    }
  }

  private async reconnect(): Promise<void> {
    const dbLogger = logger.child('DatabaseConnection');
    dbLogger.info('Attempting to reconnect to database...');
    
    try {
      await this.disconnect();
      await this.connect();
      dbLogger.info('Database reconnection successful');
    } catch (error) {
      dbLogger.error('Database reconnection failed', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    const dbLogger = logger.child('DatabaseConnection');
    
    if (this.pool) {
      try {
        dbLogger.info('Closing database connection pool');
        await this.pool.end();
        this.pool = null;
        dbLogger.info('Database connection pool closed successfully');
      } catch (error) {
        dbLogger.error('Error closing database connection pool', error instanceof Error ? error : undefined);
        throw error;
      }
    } else {
      dbLogger.debug('Database pool already closed or not initialized');
    }
  }

  public isConnected(): boolean {
    return this.pool !== null;
  }

  public getPoolStatus(): { totalConnections: number; freeConnections: number; queuedRequests: number } | null {
    if (!this.pool) {
      return null;
    }

    // Note: These properties might not be available in all versions of mysql2
    // This is a basic implementation that can be enhanced based on the specific mysql2 version
    return {
      totalConnections: (this.pool as any)._allConnections?.length || 0,
      freeConnections: (this.pool as any)._freeConnections?.length || 0,
      queuedRequests: (this.pool as any)._connectionQueue?.length || 0
    };
  }
}