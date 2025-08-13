import { DatabaseConnection } from '../connection';
import { EnvironmentConfig } from '../../config/environment';
import mysql from 'mysql2/promise';

// Mock mysql2/promise
jest.mock('mysql2/promise');
const mockMysql = mysql as jest.Mocked<typeof mysql>;

// Mock EnvironmentConfig
jest.mock('../../config/environment');

describe('DatabaseConnection', () => {
  let mockPool: jest.Mocked<mysql.Pool>;
  let mockConnection: jest.Mocked<mysql.PoolConnection>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset singleton instance
    (DatabaseConnection as any).instance = undefined;

    // Mock pool and connection
    mockConnection = {
      ping: jest.fn(),
      release: jest.fn(),
      execute: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
    } as any;

    mockPool = {
      getConnection: jest.fn().mockResolvedValue(mockConnection),
      end: jest.fn(),
    } as any;

    mockMysql.createPool.mockReturnValue(mockPool);

    // Mock environment config
    const mockGetInstance = jest.fn().mockReturnValue({
      mysqlUrl: 'mysql://testuser:testpass@localhost:3306/testdb',
    });
    (EnvironmentConfig.getInstance as jest.Mock) = mockGetInstance;

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = DatabaseConnection.getInstance();
      const instance2 = DatabaseConnection.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('parseConnectionString', () => {
    it('should parse valid MySQL connection string', async () => {
      const db = DatabaseConnection.getInstance();
      await db.connect();

      expect(mockMysql.createPool).toHaveBeenCalledWith({
        host: 'localhost',
        port: 3306,
        user: 'testuser',
        password: 'testpass',
        database: 'testdb',
        connectionLimit: 10,
        queueLimit: 0,
        multipleStatements: false
      });
    });

    it('should handle custom port in connection string', async () => {
      // Reset singleton and create new instance with different URL
      (DatabaseConnection as any).instance = undefined;
      const mockGetInstance = jest.fn().mockReturnValue({
        mysqlUrl: 'mysql://user:pass@localhost:3307/mydb',
      });
      (EnvironmentConfig.getInstance as jest.Mock) = mockGetInstance;
      
      const db = DatabaseConnection.getInstance();
      await db.connect();

      expect(mockMysql.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 3307,
          user: 'user',
          password: 'pass',
          database: 'mydb'
        })
      );
    });

    it('should throw error for invalid connection string', () => {
      // Reset singleton and create new instance with invalid URL
      (DatabaseConnection as any).instance = undefined;
      const mockGetInstance = jest.fn().mockReturnValue({
        mysqlUrl: 'invalid-connection-string',
      });
      (EnvironmentConfig.getInstance as jest.Mock) = mockGetInstance;
      
      expect(() => {
        DatabaseConnection.getInstance();
      }).toThrow('Invalid MySQL connection string');
    });
  });

  describe('connect', () => {
    it('should create connection pool and test connection', async () => {
      const db = DatabaseConnection.getInstance();
      
      await db.connect();

      expect(mockMysql.createPool).toHaveBeenCalled();
      expect(mockPool.getConnection).toHaveBeenCalled();
      expect(mockConnection.ping).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('Database connection pool created successfully');
    });

    it('should not create new pool if already connected', async () => {
      const db = DatabaseConnection.getInstance();
      
      await db.connect();
      await db.connect(); // Second call

      expect(mockMysql.createPool).toHaveBeenCalledTimes(1);
    });

    it('should handle connection errors with retry logic', async () => {
      const db = DatabaseConnection.getInstance();
      
      // Mock connection failure then success
      mockPool.getConnection
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce(mockConnection);

      // Mock setTimeout to resolve immediately for testing
      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        callback();
        return {} as any;
      });

      await db.connect();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Database connection failed. Retrying in')
      );
    });

    it('should throw error after max reconnect attempts', async () => {
      const db = DatabaseConnection.getInstance();
      
      // Mock createPool to throw error
      mockMysql.createPool.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      // Mock setTimeout to resolve immediately for testing
      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        callback();
        return {} as any;
      });

      await expect(db.connect()).rejects.toThrow('Failed to connect to database after 5 attempts');
    });
  });

  describe('getConnection', () => {
    it('should return connection from pool', async () => {
      const db = DatabaseConnection.getInstance();
      await db.connect();

      const connection = await db.getConnection();

      expect(connection).toBe(mockConnection);
      expect(mockPool.getConnection).toHaveBeenCalled();
    });

    it('should connect if not already connected', async () => {
      const db = DatabaseConnection.getInstance();

      const connection = await db.getConnection();

      expect(connection).toBe(mockConnection);
      expect(mockMysql.createPool).toHaveBeenCalled();
    });

    it('should handle connection errors and retry', async () => {
      const db = DatabaseConnection.getInstance();
      await db.connect();

      // Mock getConnection to fail once then succeed
      mockPool.getConnection
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce(mockConnection);

      const connection = await db.getConnection();

      expect(connection).toBe(mockConnection);
      expect(console.error).toHaveBeenCalledWith('Failed to get database connection:', expect.any(Error));
    });
  });

  describe('query', () => {
    it('should execute query and return results', async () => {
      const db = DatabaseConnection.getInstance();
      const mockResults = [{ id: 1, name: 'test' }];
      
      mockConnection.execute.mockResolvedValue([mockResults, []] as any);

      const results = await db.query('SELECT * FROM test', ['param']);

      expect(mockConnection.execute).toHaveBeenCalledWith('SELECT * FROM test', ['param']);
      expect(mockConnection.release).toHaveBeenCalled();
      expect(results).toBe(mockResults);
    });

    it('should handle query errors and release connection', async () => {
      const db = DatabaseConnection.getInstance();
      const error = new Error('Query failed');
      
      mockConnection.execute.mockRejectedValue(error);

      await expect(db.query('SELECT * FROM test')).rejects.toThrow('Query failed');
      expect(mockConnection.release).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('Database query error:', error);
    });
  });

  describe('transaction', () => {
    it('should execute transaction and commit on success', async () => {
      const db = DatabaseConnection.getInstance();
      const callback = jest.fn().mockResolvedValue('result');

      const result = await db.transaction(callback);

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(mockConnection);
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
      expect(result).toBe('result');
    });

    it('should rollback transaction on error', async () => {
      const db = DatabaseConnection.getInstance();
      const error = new Error('Transaction failed');
      const callback = jest.fn().mockRejectedValue(error);

      await expect(db.transaction(callback)).rejects.toThrow('Transaction failed');

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should close connection pool', async () => {
      const db = DatabaseConnection.getInstance();
      await db.connect();

      await db.disconnect();

      expect(mockPool.end).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('Database connection pool closed');
    });

    it('should handle disconnect when not connected', async () => {
      const db = DatabaseConnection.getInstance();

      await db.disconnect();

      expect(mockPool.end).not.toHaveBeenCalled();
    });
  });

  describe('isConnected', () => {
    it('should return true when connected', async () => {
      const db = DatabaseConnection.getInstance();
      await db.connect();

      expect(db.isConnected()).toBe(true);
    });

    it('should return false when not connected', () => {
      const db = DatabaseConnection.getInstance();

      expect(db.isConnected()).toBe(false);
    });
  });

  describe('getPoolStatus', () => {
    it('should return pool status when connected', async () => {
      const db = DatabaseConnection.getInstance();
      await db.connect();

      // Mock pool properties
      (mockPool as any)._allConnections = [1, 2, 3];
      (mockPool as any)._freeConnections = [1, 2];
      (mockPool as any)._connectionQueue = [1];

      const status = db.getPoolStatus();

      expect(status).toEqual({
        totalConnections: 3,
        freeConnections: 2,
        queuedRequests: 1
      });
    });

    it('should return null when not connected', () => {
      const db = DatabaseConnection.getInstance();

      const status = db.getPoolStatus();

      expect(status).toBeNull();
    });
  });
});