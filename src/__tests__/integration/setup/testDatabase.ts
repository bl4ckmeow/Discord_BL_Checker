import { DatabaseConnection } from '../../../database/connection';
import { DatabaseSchema } from '../../../database/schema';
import mysql from 'mysql2/promise';

/**
 * Test database configuration and utilities
 * Provides isolated test database setup and teardown
 */
export class TestDatabase {
  private static instance: TestDatabase;
  private connection: DatabaseConnection;
  private schema: DatabaseSchema;
  private testDbName: string;
  private originalMysqlUrl: string;

  private constructor() {
    this.testDbName = `blacklist_bot_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.originalMysqlUrl = process.env['MYSQL_URL'] || '';
    this.connection = DatabaseConnection.getInstance();
    this.schema = new DatabaseSchema();
  }

  public static getInstance(): TestDatabase {
    if (!TestDatabase.instance) {
      TestDatabase.instance = new TestDatabase();
    }
    return TestDatabase.instance;
  }

  /**
   * Sets up test database with unique name and schema
   */
  async setup(): Promise<void> {
    // Create test database
    await this.createTestDatabase();
    
    // Update environment to use test database
    this.updateEnvironmentForTesting();
    
    // Initialize schema
    await this.schema.initializeSchema();
  }

  /**
   * Tears down test database and restores original configuration
   */
  async teardown(): Promise<void> {
    try {
      // Disconnect from test database
      await this.connection.disconnect();
      
      // Drop test database
      await this.dropTestDatabase();
      
      // Restore original environment
      this.restoreOriginalEnvironment();
    } catch (error) {
      console.error('Error during test database teardown:', error);
      throw error;
    }
  }

  /**
   * Clears all data from test database tables
   */
  async clearData(): Promise<void> {
    await this.connection.query('DELETE FROM blacklist_entries');
  }

  /**
   * Gets the test database connection
   */
  getConnection(): DatabaseConnection {
    return this.connection;
  }

  /**
   * Gets the test database name
   */
  getTestDbName(): string {
    return this.testDbName;
  }

  private async createTestDatabase(): Promise<void> {
    // Parse original MySQL URL to get connection details
    const originalUrl = new URL(this.originalMysqlUrl);
    
    // Create connection to MySQL server (without specific database)
    const serverConnection = await mysql.createConnection({
      host: originalUrl.hostname,
      port: parseInt(originalUrl.port) || 3306,
      user: originalUrl.username,
      password: originalUrl.password
    });

    try {
      // Create test database
      await serverConnection.execute(`CREATE DATABASE IF NOT EXISTS \`${this.testDbName}\``);
    } finally {
      await serverConnection.end();
    }
  }

  private async dropTestDatabase(): Promise<void> {
    // Parse original MySQL URL to get connection details
    const originalUrl = new URL(this.originalMysqlUrl);
    
    // Create connection to MySQL server (without specific database)
    const serverConnection = await mysql.createConnection({
      host: originalUrl.hostname,
      port: parseInt(originalUrl.port) || 3306,
      user: originalUrl.username,
      password: originalUrl.password
    });

    try {
      // Drop test database
      await serverConnection.execute(`DROP DATABASE IF EXISTS \`${this.testDbName}\``);
    } finally {
      await serverConnection.end();
    }
  }

  private updateEnvironmentForTesting(): void {
    // Update MySQL URL to use test database
    const testUrl = new URL(this.originalMysqlUrl);
    testUrl.pathname = `/${this.testDbName}`;
    
    process.env['MYSQL_URL'] = testUrl.toString();
    process.env['NODE_ENV'] = 'test';
  }

  private restoreOriginalEnvironment(): void {
    process.env['MYSQL_URL'] = this.originalMysqlUrl;
  }
}

/**
 * Test data fixtures for integration tests
 */
export class TestDataFixtures {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  /**
   * Creates sample blacklist entries for testing
   */
  async createSampleEntries(): Promise<{ entryId1: number; entryId2: number; entryId3: number }> {
    const entry1 = await this.db.query(
      'INSERT INTO blacklist_entries (identifier, first_name, last_name, created_by) VALUES (?, ?, ?, ?)',
      ['0812345678', 'John', 'Doe', '123456789012345678']
    );

    const entry2 = await this.db.query(
      'INSERT INTO blacklist_entries (identifier, first_name, last_name, created_by) VALUES (?, ?, ?, ?)',
      ['ACC001', 'Jane', 'Smith', '123456789012345678']
    );

    const entry3 = await this.db.query(
      'INSERT INTO blacklist_entries (identifier, created_by) VALUES (?, ?)',
      ['scammer123', '123456789012345678']
    );

    return {
      entryId1: (entry1 as any).insertId,
      entryId2: (entry2 as any).insertId,
      entryId3: (entry3 as any).insertId
    };
  }

  /**
   * Creates a specific blacklist entry for testing
   */
  async createEntry(identifier: string, firstName?: string, lastName?: string, createdBy: string = '123456789012345678'): Promise<number> {
    const result = await this.db.query(
      'INSERT INTO blacklist_entries (identifier, first_name, last_name, created_by) VALUES (?, ?, ?, ?)',
      [identifier, firstName || null, lastName || null, createdBy]
    );

    return (result as any).insertId;
  }

  /**
   * Gets all blacklist entries from database
   */
  async getAllEntries(): Promise<any[]> {
    return await this.db.query('SELECT * FROM blacklist_entries ORDER BY id');
  }

  /**
   * Gets entry count from database
   */
  async getEntryCount(): Promise<number> {
    const result = await this.db.query('SELECT COUNT(*) as count FROM blacklist_entries');
    return (result as any)[0].count;
  }
}