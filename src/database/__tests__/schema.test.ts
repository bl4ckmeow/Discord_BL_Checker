import { DatabaseSchema } from '../schema';
import { DatabaseConnection } from '../connection';

// Mock DatabaseConnection
jest.mock('../connection');

describe('DatabaseSchema', () => {
  let mockDbInstance: jest.Mocked<DatabaseConnection>;
  let schema: DatabaseSchema;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDbInstance = {
      query: jest.fn(),
    } as any;

    const mockGetInstance = jest.fn().mockReturnValue(mockDbInstance);
    (DatabaseConnection.getInstance as jest.Mock) = mockGetInstance;

    schema = new DatabaseSchema();

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initializeSchema', () => {
    it('should create table and indexes successfully', async () => {
      mockDbInstance.query.mockResolvedValue(undefined);

      await schema.initializeSchema();

      // Verify table creation
      expect(mockDbInstance.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS blacklist_entries')
      );

      // Verify index creation
      expect(mockDbInstance.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS idx_identifier')
      );
      expect(mockDbInstance.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS idx_names')
      );
      expect(mockDbInstance.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS idx_created_by')
      );
      expect(mockDbInstance.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS idx_created_at')
      );

      expect(console.log).toHaveBeenCalledWith('Initializing database schema...');
      expect(console.log).toHaveBeenCalledWith('Database schema initialized successfully');
    });

    it('should handle table creation errors', async () => {
      const error = new Error('Table creation failed');
      mockDbInstance.query.mockRejectedValue(error);

      await expect(schema.initializeSchema()).rejects.toThrow('Table creation failed');
      expect(console.error).toHaveBeenCalledWith('Failed to initialize database schema:', error);
    });

    it('should continue with other indexes if one fails', async () => {
      mockDbInstance.query
        .mockResolvedValueOnce(undefined) // Table creation succeeds
        .mockRejectedValueOnce(new Error('Index creation failed')) // First index fails
        .mockResolvedValueOnce(undefined) // Second index succeeds
        .mockResolvedValueOnce(undefined) // Third index succeeds
        .mockResolvedValueOnce(undefined); // Fourth index succeeds

      await schema.initializeSchema();

      expect(mockDbInstance.query).toHaveBeenCalledTimes(5); // 1 table + 4 indexes
      expect(console.error).toHaveBeenCalledWith(
        'Failed to create index idx_identifier:',
        expect.any(Error)
      );
      expect(console.log).toHaveBeenCalledWith('Database schema initialized successfully');
    });
  });

  describe('verifySchema', () => {
    it('should return true for valid schema', async () => {
      const mockTableInfo = [
        { COLUMN_NAME: 'id' },
        { COLUMN_NAME: 'identifier' },
        { COLUMN_NAME: 'first_name' },
        { COLUMN_NAME: 'last_name' },
        { COLUMN_NAME: 'created_at' },
        { COLUMN_NAME: 'created_by' },
        { COLUMN_NAME: 'updated_at' }
      ];

      const mockIndexInfo = [
        { INDEX_NAME: 'idx_identifier', COLUMN_NAME: 'identifier' },
        { INDEX_NAME: 'idx_names', COLUMN_NAME: 'first_name' }
      ];

      mockDbInstance.query
        .mockResolvedValueOnce(mockTableInfo)
        .mockResolvedValueOnce(mockIndexInfo);

      const result = await schema.verifySchema();

      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith('Schema verification completed successfully');
    });

    it('should return false when table does not exist', async () => {
      mockDbInstance.query.mockResolvedValueOnce([]);

      const result = await schema.verifySchema();

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith('Blacklist entries table not found');
    });

    it('should return false when required columns are missing', async () => {
      const mockTableInfo = [
        { COLUMN_NAME: 'id' },
        { COLUMN_NAME: 'identifier' }
        // Missing other required columns
      ];

      mockDbInstance.query.mockResolvedValueOnce(mockTableInfo);

      const result = await schema.verifySchema();

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith('Missing expected column: first_name');
    });

    it('should handle verification errors', async () => {
      const error = new Error('Verification failed');
      mockDbInstance.query.mockRejectedValue(error);

      const result = await schema.verifySchema();

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith('Schema verification failed:', error);
    });
  });

  describe('dropSchema', () => {
    it('should drop table successfully', async () => {
      mockDbInstance.query.mockResolvedValue(undefined);

      await schema.dropSchema();

      expect(mockDbInstance.query).toHaveBeenCalledWith('DROP TABLE IF EXISTS blacklist_entries;');
      expect(console.log).toHaveBeenCalledWith('Dropping database schema...');
      expect(console.log).toHaveBeenCalledWith('Database schema dropped successfully');
    });

    it('should handle drop errors', async () => {
      const error = new Error('Drop failed');
      mockDbInstance.query.mockRejectedValue(error);

      await expect(schema.dropSchema()).rejects.toThrow('Drop failed');
      expect(console.error).toHaveBeenCalledWith('Failed to drop database schema:', error);
    });
  });

  describe('resetSchema', () => {
    it('should drop and recreate schema', async () => {
      mockDbInstance.query.mockResolvedValue(undefined);

      const dropSpy = jest.spyOn(schema, 'dropSchema');
      const initSpy = jest.spyOn(schema, 'initializeSchema');

      await schema.resetSchema();

      expect(dropSpy).toHaveBeenCalled();
      expect(initSpy).toHaveBeenCalled();
    });
  });

  describe('getTableStats', () => {
    it('should return table statistics', async () => {
      const mockStats = [{
        total_entries: 5,
        oldest_entry: new Date('2023-01-01'),
        newest_entry: new Date('2023-12-31')
      }];

      mockDbInstance.query.mockResolvedValue(mockStats);

      const stats = await schema.getTableStats();

      expect(stats).toEqual({
        totalEntries: 5,
        oldestEntry: new Date('2023-01-01'),
        newestEntry: new Date('2023-12-31')
      });

      expect(mockDbInstance.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as total_entries')
      );
    });

    it('should handle empty table', async () => {
      const mockStats = [{
        total_entries: 0,
        oldest_entry: null,
        newest_entry: null
      }];

      mockDbInstance.query.mockResolvedValue(mockStats);

      const stats = await schema.getTableStats();

      expect(stats).toEqual({
        totalEntries: 0,
        oldestEntry: null,
        newestEntry: null
      });
    });

    it('should handle query errors', async () => {
      const error = new Error('Stats query failed');
      mockDbInstance.query.mockRejectedValue(error);

      const stats = await schema.getTableStats();

      expect(stats).toEqual({
        totalEntries: 0,
        oldestEntry: null,
        newestEntry: null
      });

      expect(console.error).toHaveBeenCalledWith('Failed to get table stats:', error);
    });

    it('should handle undefined result', async () => {
      mockDbInstance.query.mockResolvedValue([{}]);

      const stats = await schema.getTableStats();

      expect(stats).toEqual({
        totalEntries: 0,
        oldestEntry: null,
        newestEntry: null
      });
    });
  });
});