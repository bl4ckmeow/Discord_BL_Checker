import { BlacklistRepository } from '../../../database/BlacklistRepository';
import { CreateBlacklistEntryInput } from '../../../models/BlacklistEntry';
import { SearchCriteria } from '../../../models/SearchCriteria';
import { TestDatabase, TestDataFixtures } from '../setup/testDatabase';

/**
 * Integration tests for BlacklistRepository
 * Tests real database operations with MySQL
 * Requirements: 1.1, 2.1, 3.1, 4.1
 */
describe('BlacklistRepository Integration Tests', () => {
  let repository: BlacklistRepository;
  let testDb: TestDatabase;
  let fixtures: TestDataFixtures;

  beforeAll(async () => {
    // Set up test database
    testDb = TestDatabase.getInstance();
    await testDb.setup();
    
    repository = new BlacklistRepository();
    fixtures = new TestDataFixtures(testDb.getConnection());
  }, 30000);

  afterAll(async () => {
    // Clean up test database
    await testDb.teardown();
  }, 30000);

  beforeEach(async () => {
    // Clear data before each test
    await testDb.clearData();
  });

  describe('create', () => {
    it('should create a new blacklist entry with all fields', async () => {
      // Requirement 1.1: Store blacklist entry in MySQL database
      const entryInput: CreateBlacklistEntryInput = {
        identifier: '0812345678',
        firstName: 'John',
        lastName: 'Doe',
        createdBy: '123456789012345678'
      };

      const entryId = await repository.create(entryInput);

      expect(entryId).toBeGreaterThan(0);

      // Verify entry was created in database
      const entries = await fixtures.getAllEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        id: entryId,
        identifier: '0812345678',
        first_name: 'John',
        last_name: 'Doe',
        created_by: '123456789012345678'
      });
      expect(entries[0].created_at).toBeInstanceOf(Date);
    });

    it('should create a blacklist entry with only identifier', async () => {
      const entryInput: CreateBlacklistEntryInput = {
        identifier: 'scammer123',
        createdBy: '123456789012345678'
      };

      const entryId = await repository.create(entryInput);

      expect(entryId).toBeGreaterThan(0);

      const entries = await fixtures.getAllEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        id: entryId,
        identifier: 'scammer123',
        first_name: null,
        last_name: null,
        created_by: '123456789012345678'
      });
    });

    it('should throw error for invalid input', async () => {
      const invalidInput: CreateBlacklistEntryInput = {
        identifier: '', // Empty identifier
        createdBy: '123456789012345678'
      };

      await expect(repository.create(invalidInput)).rejects.toThrow('Invalid blacklist entry');
    });

    it('should handle database connection errors gracefully', async () => {
      // Disconnect database to simulate connection error
      await testDb.getConnection().disconnect();

      const entryInput: CreateBlacklistEntryInput = {
        identifier: '0812345678',
        createdBy: '123456789012345678'
      };

      await expect(repository.create(entryInput)).rejects.toThrow();

      // Reconnect for cleanup
      await testDb.getConnection().connect();
    });
  });

  describe('findByIdentifier', () => {
    beforeEach(async () => {
      // Create test data
      await fixtures.createSampleEntries();
    });

    it('should find entries by exact identifier match', async () => {
      // Requirement 2.1: Search database for matching blacklist entries
      const results = await repository.findByIdentifier('0812345678');

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        identifier: '0812345678',
        firstName: 'John',
        lastName: 'Doe',
        createdBy: '123456789012345678'
      });
      expect(results[0].id).toBeGreaterThan(0);
      expect(results[0].createdAt).toBeInstanceOf(Date);
    });

    it('should return empty array for non-existent identifier', async () => {
      const results = await repository.findByIdentifier('nonexistent');

      expect(results).toHaveLength(0);
    });

    it('should throw error for invalid identifier', async () => {
      await expect(repository.findByIdentifier('')).rejects.toThrow('Identifier is required');
    });

    it('should handle multiple entries with same identifier', async () => {
      // Create duplicate identifier (different names)
      await fixtures.createEntry('0812345678', 'Jane', 'Smith');

      const results = await repository.findByIdentifier('0812345678');

      expect(results).toHaveLength(2);
      expect(results[0].identifier).toBe('0812345678');
      expect(results[1].identifier).toBe('0812345678');
    });
  });

  describe('findByName', () => {
    beforeEach(async () => {
      await fixtures.createSampleEntries();
    });

    it('should find entries by first name partial match', async () => {
      // Requirement 2.5: Support partial matching for first name and last name
      const results = await repository.findByName('Joh');

      expect(results).toHaveLength(1);
      expect(results[0].firstName).toBe('John');
    });

    it('should find entries by last name partial match', async () => {
      const results = await repository.findByName(undefined, 'Smi');

      expect(results).toHaveLength(1);
      expect(results[0].lastName).toBe('Smith');
    });

    it('should find entries by both names', async () => {
      const results = await repository.findByName('Jane', 'Smith');

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        firstName: 'Jane',
        lastName: 'Smith'
      });
    });

    it('should return empty array for non-matching names', async () => {
      const results = await repository.findByName('NonExistent');

      expect(results).toHaveLength(0);
    });

    it('should throw error when no name parameters provided', async () => {
      await expect(repository.findByName()).rejects.toThrow('At least one name parameter');
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await fixtures.createSampleEntries();
    });

    it('should search by identifier', async () => {
      const criteria: SearchCriteria = { identifier: '0812345678' };
      const results = await repository.search(criteria);

      expect(results).toHaveLength(1);
      expect(results[0].identifier).toBe('0812345678');
    });

    it('should search by first name with partial matching', async () => {
      const criteria: SearchCriteria = { firstName: 'Joh' };
      const results = await repository.search(criteria);

      expect(results).toHaveLength(1);
      expect(results[0].firstName).toBe('John');
    });

    it('should search by multiple criteria', async () => {
      const criteria: SearchCriteria = { 
        firstName: 'Jane',
        lastName: 'Smith'
      };
      const results = await repository.search(criteria);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        firstName: 'Jane',
        lastName: 'Smith'
      });
    });

    it('should return empty array for non-matching criteria', async () => {
      const criteria: SearchCriteria = { identifier: 'nonexistent' };
      const results = await repository.search(criteria);

      expect(results).toHaveLength(0);
    });

    it('should throw error for invalid search criteria', async () => {
      const invalidCriteria: SearchCriteria = {};
      
      await expect(repository.search(invalidCriteria)).rejects.toThrow('Invalid search criteria');
    });
  });

  describe('findById', () => {
    let entryId: number;

    beforeEach(async () => {
      const entries = await fixtures.createSampleEntries();
      entryId = entries.entryId1;
    });

    it('should find entry by valid ID', async () => {
      const result = await repository.findById(entryId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(entryId);
      expect(result!.identifier).toBe('0812345678');
    });

    it('should return null for non-existent ID', async () => {
      const result = await repository.findById(99999);

      expect(result).toBeNull();
    });

    it('should throw error for invalid ID', async () => {
      await expect(repository.findById(0)).rejects.toThrow('ID must be a positive number');
      await expect(repository.findById(-1)).rejects.toThrow('ID must be a positive number');
    });
  });

  describe('deleteById', () => {
    let entryId: number;

    beforeEach(async () => {
      const entries = await fixtures.createSampleEntries();
      entryId = entries.entryId1;
    });

    it('should delete existing entry', async () => {
      // Requirement 3.1: Remove specified entry from database
      const deleted = await repository.deleteById(entryId);

      expect(deleted).toBe(true);

      // Verify entry was deleted
      const result = await repository.findById(entryId);
      expect(result).toBeNull();

      // Verify total count decreased
      const count = await fixtures.getEntryCount();
      expect(count).toBe(2); // Started with 3, deleted 1
    });

    it('should return false for non-existent entry', async () => {
      const deleted = await repository.deleteById(99999);

      expect(deleted).toBe(false);
    });

    it('should throw error for invalid ID', async () => {
      await expect(repository.deleteById(0)).rejects.toThrow('ID must be a positive number');
    });
  });

  describe('exists', () => {
    beforeEach(async () => {
      await fixtures.createSampleEntries();
    });

    it('should return true for existing identifier', async () => {
      const exists = await repository.exists('0812345678');

      expect(exists).toBe(true);
    });

    it('should return false for non-existent identifier', async () => {
      const exists = await repository.exists('nonexistent');

      expect(exists).toBe(false);
    });

    it('should throw error for invalid identifier', async () => {
      await expect(repository.exists('')).rejects.toThrow('Identifier is required');
    });
  });

  describe('database transaction handling', () => {
    it('should handle concurrent operations correctly', async () => {
      const entryInput1: CreateBlacklistEntryInput = {
        identifier: 'concurrent1',
        createdBy: '123456789012345678'
      };

      const entryInput2: CreateBlacklistEntryInput = {
        identifier: 'concurrent2',
        createdBy: '123456789012345678'
      };

      // Execute concurrent operations
      const [id1, id2] = await Promise.all([
        repository.create(entryInput1),
        repository.create(entryInput2)
      ]);

      expect(id1).toBeGreaterThan(0);
      expect(id2).toBeGreaterThan(0);
      expect(id1).not.toBe(id2);

      // Verify both entries exist
      const count = await fixtures.getEntryCount();
      expect(count).toBe(2);
    });
  });
});