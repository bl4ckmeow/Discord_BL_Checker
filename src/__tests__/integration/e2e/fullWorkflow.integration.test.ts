import { DatabaseConnection } from '../../../database/connection';
import { DatabaseSchema } from '../../../database/schema';
import { BlacklistRepository } from '../../../database/BlacklistRepository';
import { BlacklistService } from '../../../services/BlacklistService';
import { AddBlacklistCommand } from '../../../commands/addbl';
import { CheckBlacklistCommand } from '../../../commands/checkbl';
import { RemoveBlacklistCommand } from '../../../commands/removebl';
import { PermissionMiddleware } from '../../../services/PermissionMiddleware';
import { TestDatabase, TestDataFixtures } from '../setup/testDatabase';
import { CreateBlacklistEntryInput } from '../../../models/BlacklistEntry';
import { SearchCriteria } from '../../../models/SearchCriteria';

/**
 * End-to-End Integration Tests
 * Tests complete workflows from Discord commands through database operations
 * Requirements: 1.1, 2.1, 3.1, 4.1
 */
describe('Full Workflow Integration Tests', () => {
  let testDb: TestDatabase;
  let connection: DatabaseConnection;
  let schema: DatabaseSchema;
  let repository: BlacklistRepository;
  let service: BlacklistService;
  let fixtures: TestDataFixtures;

  beforeAll(async () => {
    // Set up complete test environment
    testDb = TestDatabase.getInstance();
    await testDb.setup();
    
    connection = testDb.getConnection();
    schema = new DatabaseSchema();
    repository = new BlacklistRepository();
    service = new BlacklistService(repository);
    fixtures = new TestDataFixtures(connection);
  }, 30000);

  afterAll(async () => {
    // Clean up test environment
    await testDb.teardown();
  }, 30000);

  beforeEach(async () => {
    // Clear data before each test
    await testDb.clearData();
  });

  describe('Database Layer Integration', () => {
    it('should handle complete database lifecycle', async () => {
      // Requirement 4.1: Test database operations with real MySQL connections
      
      // Test connection
      expect(connection.isConnected()).toBe(true);
      
      // Test schema initialization
      await schema.initializeSchema();
      
      // Test data operations
      const entryInput: CreateBlacklistEntryInput = {
        identifier: '0812345678',
        firstName: 'John',
        lastName: 'Doe',
        createdBy: '123456789012345678'
      };

      // Create entry
      const entryId = await repository.create(entryInput);
      expect(entryId).toBeGreaterThan(0);

      // Find entry
      const foundEntries = await repository.findByIdentifier('0812345678');
      expect(foundEntries).toHaveLength(1);
      expect(foundEntries[0]).toMatchObject({
        id: entryId,
        identifier: '0812345678',
        firstName: 'John',
        lastName: 'Doe'
      });

      // Update through service layer
      const searchResults = await service.searchEntries({ identifier: '0812345678' });
      expect(searchResults).toHaveLength(1);

      // Delete entry
      const deleted = await repository.deleteById(entryId);
      expect(deleted).toBe(true);

      // Verify deletion
      const afterDelete = await repository.findById(entryId);
      expect(afterDelete).toBeNull();
    });

    it('should handle database connection recovery', async () => {
      // Test connection resilience
      await connection.disconnect();
      expect(connection.isConnected()).toBe(false);

      // Reconnect and test operations
      await connection.connect();
      expect(connection.isConnected()).toBe(true);

      // Test operation after reconnection
      const entryId = await fixtures.createEntry('test123', 'Test', 'User');
      expect(entryId).toBeGreaterThan(0);

      const entry = await repository.findById(entryId);
      expect(entry).not.toBeNull();
    });
  });

  describe('Service Layer Integration', () => {
    it('should handle complete business logic workflows', async () => {
      // Requirement 1.2, 2.5, 3.3: Test service layer operations
      
      // Test add with validation and duplicate checking
      const entryInput: CreateBlacklistEntryInput = {
        identifier: '0812345678',
        firstName: 'John',
        lastName: 'Doe',
        createdBy: '123456789012345678'
      };

      const entryId = await service.addEntry(entryInput);
      expect(entryId).toBeGreaterThan(0);

      // Test duplicate prevention
      await expect(service.addEntry(entryInput)).rejects.toThrow('Duplicate entry');

      // Test search with partial matching
      const searchResults = await service.searchEntries({ firstName: 'Joh' });
      expect(searchResults).toHaveLength(1);

      // Test multiple search criteria
      const multiCriteriaResults = await service.searchEntries({
        firstName: 'John',
        lastName: 'Doe'
      });
      expect(multiCriteriaResults).toHaveLength(1);

      // Test removal
      const removed = await service.removeEntry(entryId);
      expect(removed).toBe(true);

      // Verify removal
      const afterRemoval = await service.getById(entryId);
      expect(afterRemoval).toBeNull();
    });

    it('should handle edge cases and error conditions', async () => {
      // Test validation errors
      const invalidInput: CreateBlacklistEntryInput = {
        identifier: '',
        createdBy: '123456789012345678'
      };
      await expect(service.addEntry(invalidInput)).rejects.toThrow('Validation failed');

      // Test search validation
      const invalidSearch: SearchCriteria = {};
      await expect(service.searchEntries(invalidSearch)).rejects.toThrow('Search validation failed');

      // Test removal of non-existent entry
      const removed = await service.removeEntry(99999);
      expect(removed).toBe(false);
    });
  });

  describe('Multi-User Scenarios', () => {
    it('should handle multiple users adding entries concurrently', async () => {
      // Requirement 4.1: Test concurrent operations
      const users = ['user1', 'user2', 'user3'];
      const promises = users.map((userId, index) => 
        service.addEntry({
          identifier: `identifier${index}`,
          firstName: `FirstName${index}`,
          lastName: `LastName${index}`,
          createdBy: userId
        })
      );

      const entryIds = await Promise.all(promises);
      expect(entryIds).toHaveLength(3);
      expect(entryIds.every(id => id > 0)).toBe(true);

      // Verify all entries exist
      const count = await fixtures.getEntryCount();
      expect(count).toBe(3);

      // Test concurrent searches
      const searchPromises = users.map((_, index) =>
        service.searchEntries({ identifier: `identifier${index}` })
      );

      const searchResults = await Promise.all(searchPromises);
      expect(searchResults.every(results => results.length === 1)).toBe(true);
    });

    it('should maintain data integrity under concurrent operations', async () => {
      // Test race conditions
      const identifier = 'race-condition-test';
      const promises = Array(5).fill(null).map((_, index) =>
        service.addEntry({
          identifier: `${identifier}-${index}`,
          createdBy: `user${index}`
        }).catch(error => error) // Catch errors to prevent Promise.all from failing
      );

      const results = await Promise.all(promises);
      
      // All should succeed since identifiers are unique
      expect(results.every(result => typeof result === 'number')).toBe(true);

      // Test duplicate prevention under concurrency
      const duplicatePromises = Array(3).fill(null).map(() =>
        service.addEntry({
          identifier: 'duplicate-test',
          createdBy: 'user1'
        }).catch(error => error)
      );

      const duplicateResults = await Promise.all(duplicatePromises);
      
      // Only one should succeed, others should fail with duplicate error
      const successes = duplicateResults.filter(result => typeof result === 'number');
      const failures = duplicateResults.filter(result => result instanceof Error);
      
      expect(successes).toHaveLength(1);
      expect(failures.length).toBeGreaterThan(0);
      expect(failures.every(error => error.message.includes('Duplicate entry'))).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large datasets efficiently', async () => {
      // Create a large dataset
      const batchSize = 100;
      const batches = 5;
      
      for (let batch = 0; batch < batches; batch++) {
        const promises = [];
        for (let i = 0; i < batchSize; i++) {
          const index = batch * batchSize + i;
          promises.push(fixtures.createEntry(
            `identifier${index}`,
            `FirstName${index}`,
            `LastName${index}`
          ));
        }
        await Promise.all(promises);
      }

      const totalEntries = batchSize * batches;
      const count = await fixtures.getEntryCount();
      expect(count).toBe(totalEntries);

      // Test search performance
      const startTime = Date.now();
      const searchResults = await service.searchEntries({ firstName: 'FirstName1' });
      const searchDuration = Date.now() - startTime;

      // Should find entries with FirstName1, FirstName10-19, FirstName100-199, etc.
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchDuration).toBeLessThan(2000); // Should complete within 2 seconds

      // Test pagination-like behavior
      const identifierSearchStart = Date.now();
      const identifierResults = await service.findByIdentifier('identifier50');
      const identifierSearchDuration = Date.now() - identifierSearchStart;

      expect(identifierResults).toHaveLength(1);
      expect(identifierSearchDuration).toBeLessThan(500); // Should be very fast for exact match
    });

    it('should handle database connection pooling correctly', async () => {
      // Test multiple concurrent database operations
      const operations = Array(20).fill(null).map(async (_, index) => {
        const entryId = await fixtures.createEntry(`concurrent${index}`, `Name${index}`);
        const entry = await repository.findById(entryId);
        await repository.deleteById(entryId);
        return entry;
      });

      const results = await Promise.all(operations);
      
      expect(results).toHaveLength(20);
      expect(results.every(result => result !== null)).toBe(true);

      // Verify all entries were cleaned up
      const remainingCount = await fixtures.getEntryCount();
      expect(remainingCount).toBe(0);
    });
  });

  describe('Data Consistency and Integrity', () => {
    it('should maintain referential integrity', async () => {
      // Test that all created entries have valid timestamps and user IDs
      const entryIds = [];
      for (let i = 0; i < 5; i++) {
        const id = await service.addEntry({
          identifier: `integrity${i}`,
          firstName: `Name${i}`,
          createdBy: `user${i}`
        });
        entryIds.push(id);
      }

      // Verify all entries have proper data
      for (const entryId of entryIds) {
        const entry = await service.getById(entryId);
        expect(entry).not.toBeNull();
        expect(entry!.id).toBe(entryId);
        expect(entry!.createdAt).toBeInstanceOf(Date);
        expect(entry!.createdBy).toMatch(/^user\d+$/);
        expect(entry!.identifier).toMatch(/^integrity\d+$/);
      }
    });

    it('should handle transaction rollback scenarios', async () => {
      // This test would be more comprehensive with actual transaction failures
      // For now, test that partial failures don't leave inconsistent state
      
      const validEntry: CreateBlacklistEntryInput = {
        identifier: 'valid-entry',
        createdBy: '123456789012345678'
      };

      const invalidEntry: CreateBlacklistEntryInput = {
        identifier: '', // Invalid
        createdBy: '123456789012345678'
      };

      // Add valid entry
      const validId = await service.addEntry(validEntry);
      expect(validId).toBeGreaterThan(0);

      // Try to add invalid entry
      await expect(service.addEntry(invalidEntry)).rejects.toThrow();

      // Verify valid entry still exists and database is consistent
      const entry = await service.getById(validId);
      expect(entry).not.toBeNull();

      const count = await fixtures.getEntryCount();
      expect(count).toBe(1);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from temporary database issues', async () => {
      // Create an entry first
      const entryId = await service.addEntry({
        identifier: 'resilience-test',
        createdBy: '123456789012345678'
      });

      // Simulate database disconnection
      await connection.disconnect();

      // Operations should fail gracefully
      await expect(service.addEntry({
        identifier: 'should-fail',
        createdBy: '123456789012345678'
      })).rejects.toThrow();

      // Reconnect
      await connection.connect();

      // Operations should work again
      const newEntryId = await service.addEntry({
        identifier: 'after-reconnect',
        createdBy: '123456789012345678'
      });

      expect(newEntryId).toBeGreaterThan(0);

      // Original entry should still exist
      const originalEntry = await service.getById(entryId);
      expect(originalEntry).not.toBeNull();
    });
  });
});