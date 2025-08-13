import { TestDatabase } from './testDatabase';

/**
 * Basic setup integration test
 * Verifies that the test database setup works correctly
 */
describe('Integration Test Setup', () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = TestDatabase.getInstance();
  }, 30000);

  afterAll(async () => {
    if (testDb) {
      await testDb.teardown();
    }
  }, 30000);

  it('should create and connect to test database', async () => {
    await testDb.setup();
    
    const connection = testDb.getConnection();
    expect(connection.isConnected()).toBe(true);
    
    const testDbName = testDb.getTestDbName();
    expect(testDbName).toMatch(/^blacklist_bot_test_\d+_[a-z0-9]+$/);
  });

  it('should be able to execute basic queries', async () => {
    const connection = testDb.getConnection();
    
    // Test basic query
    const result = await connection.query('SELECT 1 as test');
    expect(result).toEqual([{ test: 1 }]);
  });

  it('should clear data between tests', async () => {
    await testDb.clearData();
    
    // Verify tables exist but are empty
    const connection = testDb.getConnection();
    const result = await connection.query('SELECT COUNT(*) as count FROM blacklist_entries');
    expect((result as any)[0].count).toBe(0);
  });
});