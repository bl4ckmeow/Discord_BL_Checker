import { BlacklistService } from '../../../services/BlacklistService';
import { BlacklistRepository } from '../../../database/BlacklistRepository';
import { CreateBlacklistEntryInput } from '../../../models/BlacklistEntry';
import { SearchCriteria } from '../../../models/SearchCriteria';
import { TestDatabase, TestDataFixtures } from '../setup/testDatabase';

/**
 * Integration tests for BlacklistService
 * Tests business logic with real database operations
 * Requirements: 1.2, 2.5, 3.3
 */
describe('BlacklistService Integration Tests', () => {
  let service: BlacklistService;
  let repository: BlacklistRepository;
  let testDb: TestDatabase;
  let fixtures: TestDataFixtures;

  beforeAll(async () => {
    // Set up test database
    testDb = TestDatabase.getInstance();
    await testDb.setup();
    
    repository = new BlacklistRepository();
    service = new BlacklistService(repository);
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

  describe('addEntry', () => {
    it('should add valid entry with all fields', async () => {
      // Requirement 1.2: Entry validation and duplicate checking
      const entryInput: CreateBlacklistEntryInput = {
        identifier: '0812345678',
        firstName: 'John',
        lastName: 'Doe',
        createdBy: '123456789012345678'
      };

      const entryId = await service.addEntry(entryInput);

      expect(entryId).toBeGreaterThan(0);

      // Verify entry exists in database
      const entries = await fixtures.getAllEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        identifier: '0812345678',
        first_name: 'John',
        last_name: 'Doe',
        created_by: '123456789012345678'
      });
    });

    it('should add entry with only required fields', async () => {
      const entryInput: CreateBlacklistEntryInput = {
        identifier: 'scammer123',
        createdBy: '123456789012345678'
      };

      const entryId = await service.addEntry(entryInput);

      expect(entryId).toBeGreaterThan(0);

      const entries = await fixtures.getAllEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        identifier: 'scammer123',
        first_name: null,
        last_name: null
      });
    });

    it('should prevent duplicate entries', async () => {
      // Requirement 1.2: Duplicate checking
      const entryInput: CreateBlacklistEntryInput = {
        identifier: '0812345678',
        createdBy: '123456789012345678'
      };

      // Add first entry
      await service.addEntry(entryInput);

      // Try to add duplicate
      await expect(service.addEntry(entryInput)).rejects.toThrow('Duplicate entry');

      // Verify only one entry exists
      const count = await fixtures.getEntryCount();
      expect(count).toBe(1);
    });

    it('should validate input data', async () => {
      const invalidInput: CreateBlacklistEntryInput = {
        identifier: '', // Empty identifier
        createdBy: '123456789012345678'
      };

      await expect(service.addEntry(invalidInput)).rejects.toThrow('Validation failed');
    });

    it('should sanitize input data', async () => {
      const entryInput: CreateBlacklistEntryInput = {
        identifier: '  0812345678  ', // With whitespace
        firstName: '  John  ',
        lastName: '  Doe  ',
        createdBy: '123456789012345678'
      };

      const entryId = await service.addEntry(entryInput);

      const entries = await fixtures.getAllEntries();
      expect(entries[0]).toMatchObject({
        identifier: '0812345678', // Trimmed
        first_name: 'John', // Trimmed
        last_name: 'Doe' // Trimmed
      });
    });
  });

  describe('searchEntries', () => {
    beforeEach(async () => {
      // Create test data
      await fixtures.createEntry('0812345678', 'John', 'Doe');
      await fixtures.createEntry('ACC001', 'Jane', 'Smith');
      await fixtures.createEntry('scammer123');
      await fixtures.createEntry('0898765432', 'Bob', 'Johnson');
    });

    it('should search by identifier', async () => {
      // Requirement 2.5: Search logic with partial name matching
      const criteria: SearchCriteria = { identifier: '0812345678' };
      const results = await service.searchEntries(criteria);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        identifier: '0812345678',
        firstName: 'John',
        lastName: 'Doe'
      });
    });

    it('should search by first name with partial matching', async () => {
      const criteria: SearchCriteria = { firstName: 'Joh' };
      const results = await service.searchEntries(criteria);

      expect(results).toHaveLength(2); // John and Johnson
      expect(results.some(r => r.firstName === 'John')).toBe(true);
      expect(results.some(r => r.firstName === 'Bob')).toBe(true); // Bob Johnson
    });

    it('should search by last name with partial matching', async () => {
      const criteria: SearchCriteria = { lastName: 'Smi' };
      const results = await service.searchEntries(criteria);

      expect(results).toHaveLength(1);
      expect(results[0].lastName).toBe('Smith');
    });

    it('should search by multiple criteria', async () => {
      const criteria: SearchCriteria = { 
        firstName: 'Jane',
        lastName: 'Smith'
      };
      const results = await service.searchEntries(criteria);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        firstName: 'Jane',
        lastName: 'Smith'
      });
    });

    it('should return empty array for non-matching criteria', async () => {
      const criteria: SearchCriteria = { identifier: 'nonexistent' };
      const results = await service.searchEntries(criteria);

      expect(results).toHaveLength(0);
    });

    it('should validate search criteria', async () => {
      const invalidCriteria: SearchCriteria = {}; // No criteria provided

      await expect(service.searchEntries(invalidCriteria)).rejects.toThrow('Search validation failed');
    });

    it('should sanitize search criteria', async () => {
      const criteria: SearchCriteria = { 
        identifier: '  0812345678  ', // With whitespace
        firstName: '  John  '
      };

      const results = await service.searchEntries(criteria);

      expect(results).toHaveLength(1);
      expect(results[0].identifier).toBe('0812345678');
    });
  });

  describe('removeEntry', () => {
    let entryId: number;

    beforeEach(async () => {
      entryId = await fixtures.createEntry('0812345678', 'John', 'Doe');
    });

    it('should remove existing entry', async () => {
      // Requirement 3.3: Remove entry with validation
      const removed = await service.removeEntry(entryId);

      expect(removed).toBe(true);

      // Verify entry was removed
      const entry = await service.getById(entryId);
      expect(entry).toBeNull();

      const count = await fixtures.getEntryCount();
      expect(count).toBe(0);
    });

    it('should return false for non-existent entry', async () => {
      const removed = await service.removeEntry(99999);

      expect(removed).toBe(false);
    });

    it('should validate entry ID', async () => {
      await expect(service.removeEntry(0)).rejects.toThrow('Invalid ID');
      await expect(service.removeEntry(-1)).rejects.toThrow('Invalid ID');
    });

    it('should handle removal of already deleted entry', async () => {
      // Remove entry first time
      await service.removeEntry(entryId);

      // Try to remove again
      const removed = await service.removeEntry(entryId);
      expect(removed).toBe(false);
    });
  });

  describe('checkDuplicate', () => {
    beforeEach(async () => {
      await fixtures.createEntry('0812345678', 'John', 'Doe');
    });

    it('should return true for existing identifier', async () => {
      // Requirement 1.2: Duplicate checking functionality
      const isDuplicate = await service.checkDuplicate('0812345678');

      expect(isDuplicate).toBe(true);
    });

    it('should return false for non-existent identifier', async () => {
      const isDuplicate = await service.checkDuplicate('nonexistent');

      expect(isDuplicate).toBe(false);
    });

    it('should validate identifier', async () => {
      await expect(service.checkDuplicate('')).rejects.toThrow('Invalid identifier');
    });

    it('should handle whitespace in identifier', async () => {
      const isDuplicate = await service.checkDuplicate('  0812345678  ');

      expect(isDuplicate).toBe(true);
    });
  });

  describe('findByIdentifier', () => {
    beforeEach(async () => {
      await fixtures.createEntry('0812345678', 'John', 'Doe');
      await fixtures.createEntry('ACC001', 'Jane', 'Smith');
    });

    it('should find entries by exact identifier match', async () => {
      const results = await service.findByIdentifier('0812345678');

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        identifier: '0812345678',
        firstName: 'John',
        lastName: 'Doe'
      });
    });

    it('should return empty array for non-existent identifier', async () => {
      const results = await service.findByIdentifier('nonexistent');

      expect(results).toHaveLength(0);
    });

    it('should validate identifier', async () => {
      await expect(service.findByIdentifier('')).rejects.toThrow('Invalid identifier');
    });
  });

  describe('findByName', () => {
    beforeEach(async () => {
      await fixtures.createEntry('0812345678', 'John', 'Doe');
      await fixtures.createEntry('ACC001', 'Jane', 'Smith');
      await fixtures.createEntry('0898765432', 'John', 'Johnson');
    });

    it('should find entries by first name', async () => {
      const results = await service.findByName('John');

      expect(results).toHaveLength(2);
      expect(results.every(r => r.firstName === 'John')).toBe(true);
    });

    it('should find entries by last name', async () => {
      const results = await service.findByName(undefined, 'Smith');

      expect(results).toHaveLength(1);
      expect(results[0].lastName).toBe('Smith');
    });

    it('should find entries by both names', async () => {
      const results = await service.findByName('John', 'Doe');

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        firstName: 'John',
        lastName: 'Doe'
      });
    });

    it('should validate name parameters', async () => {
      await expect(service.findByName()).rejects.toThrow('At least one name parameter');
    });
  });

  describe('getById', () => {
    let entryId: number;

    beforeEach(async () => {
      entryId = await fixtures.createEntry('0812345678', 'John', 'Doe');
    });

    it('should get entry by valid ID', async () => {
      const entry = await service.getById(entryId);

      expect(entry).not.toBeNull();
      expect(entry!).toMatchObject({
        id: entryId,
        identifier: '0812345678',
        firstName: 'John',
        lastName: 'Doe'
      });
    });

    it('should return null for non-existent ID', async () => {
      const entry = await service.getById(99999);

      expect(entry).toBeNull();
    });

    it('should validate ID', async () => {
      await expect(service.getById(0)).rejects.toThrow('Invalid ID');
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle database connection errors gracefully', async () => {
      // Disconnect database to simulate connection error
      await testDb.getConnection().disconnect();

      const entryInput: CreateBlacklistEntryInput = {
        identifier: '0812345678',
        createdBy: '123456789012345678'
      };

      await expect(service.addEntry(entryInput)).rejects.toThrow();

      // Reconnect for cleanup
      await testDb.getConnection().connect();
    });

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
        service.addEntry(entryInput1),
        service.addEntry(entryInput2)
      ]);

      expect(id1).toBeGreaterThan(0);
      expect(id2).toBeGreaterThan(0);
      expect(id1).not.toBe(id2);

      const count = await fixtures.getEntryCount();
      expect(count).toBe(2);
    });

    it('should handle large datasets efficiently', async () => {
      // Create multiple entries
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(fixtures.createEntry(`identifier${i}`, `FirstName${i}`, `LastName${i}`));
      }
      await Promise.all(promises);

      // Search should still be efficient
      const startTime = Date.now();
      const results = await service.searchEntries({ firstName: 'FirstName1' });
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(11); // FirstName1, FirstName10-19
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});