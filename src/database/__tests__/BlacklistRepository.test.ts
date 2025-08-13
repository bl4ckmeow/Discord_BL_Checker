import { BlacklistRepository } from '../BlacklistRepository';
import { DatabaseConnection } from '../connection';
import { CreateBlacklistEntryInput } from '../../models/BlacklistEntry';
import { SearchCriteria } from '../../models/SearchCriteria';

// Mock the DatabaseConnection
jest.mock('../connection');

describe('BlacklistRepository', () => {
  let repository: BlacklistRepository;
  let mockDb: jest.Mocked<DatabaseConnection>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock database instance
    mockDb = {
      query: jest.fn(),
      getInstance: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      getConnection: jest.fn(),
      transaction: jest.fn(),
      isConnected: jest.fn(),
      getPoolStatus: jest.fn()
    } as any;

    // Mock the singleton getInstance method
    (DatabaseConnection.getInstance as jest.Mock).mockReturnValue(mockDb);
    
    repository = new BlacklistRepository();
  });

  describe('create', () => {
    const validEntry: CreateBlacklistEntryInput = {
      identifier: 'test123',
      firstName: 'John',
      lastName: 'Doe',
      createdBy: '123456789'
    };

    it('should create a blacklist entry successfully', async () => {
      const mockResult = {
        insertId: 1,
        affectedRows: 1,
        fieldCount: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0
      };

      mockDb.query.mockResolvedValue(mockResult);

      const result = await repository.create(validEntry);

      expect(result).toBe(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO blacklist_entries'),
        ['test123', 'John', 'Doe', '123456789']
      );
    });

    it('should handle entry without optional fields', async () => {
      const entryWithoutNames: CreateBlacklistEntryInput = {
        identifier: 'test123',
        createdBy: '123456789'
      };

      const mockResult = {
        insertId: 2,
        affectedRows: 1,
        fieldCount: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0
      };

      mockDb.query.mockResolvedValue(mockResult);

      const result = await repository.create(entryWithoutNames);

      expect(result).toBe(2);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO blacklist_entries'),
        ['test123', null, null, '123456789']
      );
    });

    it('should throw error for invalid entry', async () => {
      const invalidEntry: CreateBlacklistEntryInput = {
        identifier: '', // Empty identifier
        createdBy: '123456789'
      };

      await expect(repository.create(invalidEntry)).rejects.toThrow('Invalid blacklist entry');
    });

    it('should handle database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'));

      await expect(repository.create(validEntry)).rejects.toThrow('Failed to create blacklist entry');
    });

    it('should sanitize input data', async () => {
      const entryWithWhitespace: CreateBlacklistEntryInput = {
        identifier: '  test123  ',
        firstName: '  John  ',
        lastName: '  Doe  ',
        createdBy: '  123456789  '
      };

      const mockResult = {
        insertId: 3,
        affectedRows: 1,
        fieldCount: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0
      };

      mockDb.query.mockResolvedValue(mockResult);

      await repository.create(entryWithWhitespace);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO blacklist_entries'),
        ['test123', 'John', 'Doe', '123456789']
      );
    });
  });

  describe('findByIdentifier', () => {
    const mockRows = [
      {
        id: 1,
        identifier: 'test123',
        first_name: 'John',
        last_name: 'Doe',
        created_at: new Date('2023-01-01'),
        created_by: '123456789'
      },
      {
        id: 2,
        identifier: 'test123',
        first_name: 'Jane',
        last_name: 'Smith',
        created_at: new Date('2023-01-02'),
        created_by: '987654321'
      }
    ];

    it('should find entries by identifier', async () => {
      mockDb.query.mockResolvedValue(mockRows);

      const result = await repository.findByIdentifier('test123');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        identifier: 'test123',
        firstName: 'John',
        lastName: 'Doe',
        createdAt: new Date('2023-01-01'),
        createdBy: '123456789'
      });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE identifier = ?'),
        ['test123']
      );
    });

    it('should return empty array when no matches found', async () => {
      mockDb.query.mockResolvedValue([]);

      const result = await repository.findByIdentifier('nonexistent');

      expect(result).toHaveLength(0);
    });

    it('should throw error for empty identifier', async () => {
      await expect(repository.findByIdentifier('')).rejects.toThrow('Identifier is required');
    });

    it('should handle database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'));

      await expect(repository.findByIdentifier('test123')).rejects.toThrow('Failed to search blacklist entries');
    });

    it('should trim whitespace from identifier', async () => {
      mockDb.query.mockResolvedValue([]);

      await repository.findByIdentifier('  test123  ');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE identifier = ?'),
        ['test123']
      );
    });
  });

  describe('findByName', () => {
    const mockRows = [
      {
        id: 1,
        identifier: 'test123',
        first_name: 'John',
        last_name: 'Doe',
        created_at: new Date('2023-01-01'),
        created_by: '123456789'
      }
    ];

    it('should find entries by first name only', async () => {
      mockDb.query.mockResolvedValue(mockRows);

      const result = await repository.findByName('John');

      expect(result).toHaveLength(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('first_name LIKE ?'),
        ['%John%']
      );
    });

    it('should find entries by last name only', async () => {
      mockDb.query.mockResolvedValue(mockRows);

      const result = await repository.findByName(undefined, 'Doe');

      expect(result).toHaveLength(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('last_name LIKE ?'),
        ['%Doe%']
      );
    });

    it('should find entries by both first and last name', async () => {
      mockDb.query.mockResolvedValue(mockRows);

      const result = await repository.findByName('John', 'Doe');

      expect(result).toHaveLength(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('first_name LIKE ?'),
        ['%John%', '%Doe%']
      );
    });

    it('should throw error when no name parameters provided', async () => {
      await expect(repository.findByName()).rejects.toThrow('At least one name parameter');
    });

    it('should handle database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'));

      await expect(repository.findByName('John')).rejects.toThrow('Failed to search blacklist entries by name');
    });
  });

  describe('search', () => {
    const mockRows = [
      {
        id: 1,
        identifier: 'test123',
        first_name: 'John',
        last_name: 'Doe',
        created_at: new Date('2023-01-01'),
        created_by: '123456789'
      }
    ];

    it('should search by identifier only', async () => {
      mockDb.query.mockResolvedValue(mockRows);

      const criteria: SearchCriteria = { identifier: 'test123' };
      const result = await repository.search(criteria);

      expect(result).toHaveLength(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('identifier = ?'),
        ['test123']
      );
    });

    it('should search by first name only', async () => {
      mockDb.query.mockResolvedValue(mockRows);

      const criteria: SearchCriteria = { firstName: 'John' };
      const result = await repository.search(criteria);

      expect(result).toHaveLength(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('first_name LIKE ?'),
        ['%John%']
      );
    });

    it('should search by multiple criteria', async () => {
      mockDb.query.mockResolvedValue(mockRows);

      const criteria: SearchCriteria = {
        identifier: 'test123',
        firstName: 'John',
        lastName: 'Doe'
      };
      const result = await repository.search(criteria);

      expect(result).toHaveLength(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('identifier = ?'),
        ['test123', '%John%', '%Doe%']
      );
    });

    it('should throw error for invalid search criteria', async () => {
      const invalidCriteria: SearchCriteria = {}; // No criteria provided

      await expect(repository.search(invalidCriteria)).rejects.toThrow('Invalid search criteria');
    });

    it('should handle database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'));

      const criteria: SearchCriteria = { identifier: 'test123' };
      await expect(repository.search(criteria)).rejects.toThrow('Failed to search blacklist entries');
    });
  });

  describe('findById', () => {
    const mockRow = {
      id: 1,
      identifier: 'test123',
      first_name: 'John',
      last_name: 'Doe',
      created_at: new Date('2023-01-01'),
      created_by: '123456789'
    };

    it('should find entry by ID', async () => {
      mockDb.query.mockResolvedValue([mockRow]);

      const result = await repository.findById(1);

      expect(result).toEqual({
        id: 1,
        identifier: 'test123',
        firstName: 'John',
        lastName: 'Doe',
        createdAt: new Date('2023-01-01'),
        createdBy: '123456789'
      });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = ?'),
        [1]
      );
    });

    it('should return null when entry not found', async () => {
      mockDb.query.mockResolvedValue([]);

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });

    it('should throw error for invalid ID', async () => {
      await expect(repository.findById(0)).rejects.toThrow('ID must be a positive number');
      await expect(repository.findById(-1)).rejects.toThrow('ID must be a positive number');
    });

    it('should handle database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'));

      await expect(repository.findById(1)).rejects.toThrow('Failed to find blacklist entry');
    });
  });

  describe('deleteById', () => {
    it('should delete entry successfully', async () => {
      const mockResult = {
        insertId: 0,
        affectedRows: 1,
        fieldCount: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0
      };

      mockDb.query.mockResolvedValue(mockResult);

      const result = await repository.deleteById(1);

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM blacklist_entries WHERE id = ?',
        [1]
      );
    });

    it('should return false when entry not found', async () => {
      const mockResult = {
        insertId: 0,
        affectedRows: 0,
        fieldCount: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0
      };

      mockDb.query.mockResolvedValue(mockResult);

      const result = await repository.deleteById(999);

      expect(result).toBe(false);
    });

    it('should throw error for invalid ID', async () => {
      await expect(repository.deleteById(0)).rejects.toThrow('ID must be a positive number');
    });

    it('should handle database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'));

      await expect(repository.deleteById(1)).rejects.toThrow('Failed to delete blacklist entry');
    });
  });

  describe('exists', () => {
    it('should return true when entry exists', async () => {
      mockDb.query.mockResolvedValue([{ count: 1 }]);

      const result = await repository.exists('test123');

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM blacklist_entries WHERE identifier = ?',
        ['test123']
      );
    });

    it('should return false when entry does not exist', async () => {
      mockDb.query.mockResolvedValue([{ count: 0 }]);

      const result = await repository.exists('nonexistent');

      expect(result).toBe(false);
    });

    it('should throw error for empty identifier', async () => {
      await expect(repository.exists('')).rejects.toThrow('Identifier is required');
    });

    it('should handle database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'));

      await expect(repository.exists('test123')).rejects.toThrow('Failed to check blacklist entry existence');
    });
  });

  describe('mapRowToEntry', () => {
    it('should map database row with all fields', () => {
      const row = {
        id: 1,
        identifier: 'test123',
        first_name: 'John',
        last_name: 'Doe',
        created_at: new Date('2023-01-01'),
        created_by: '123456789'
      };

      // Access private method through any cast for testing
      const result = (repository as any).mapRowToEntry(row);

      expect(result).toEqual({
        id: 1,
        identifier: 'test123',
        firstName: 'John',
        lastName: 'Doe',
        createdAt: new Date('2023-01-01'),
        createdBy: '123456789'
      });
    });

    it('should map database row with null names', () => {
      const row = {
        id: 1,
        identifier: 'test123',
        first_name: null,
        last_name: null,
        created_at: new Date('2023-01-01'),
        created_by: '123456789'
      };

      const result = (repository as any).mapRowToEntry(row);

      expect(result).toEqual({
        id: 1,
        identifier: 'test123',
        firstName: undefined,
        lastName: undefined,
        createdAt: new Date('2023-01-01'),
        createdBy: '123456789'
      });
    });
  });
});