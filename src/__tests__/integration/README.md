# Integration Tests

This directory contains integration tests for the Discord Blacklist Bot that test complete workflows with real database connections.

## Overview

The integration tests verify:
- Database operations with real MySQL connections
- Complete command workflows (addbl, checkbl, removebl)
- Service layer business logic with database persistence
- End-to-end functionality from Discord commands to database
- Error handling and recovery scenarios
- Performance and scalability under load
- Data consistency and integrity

## Requirements Coverage

These tests fulfill the following requirements:
- **1.1**: Store blacklist entry in MySQL database
- **2.1**: Search database for matching blacklist entries  
- **3.1**: Remove specified entry from database
- **4.1**: Test database operations with real MySQL connections

## Test Structure

```
src/__tests__/integration/
├── setup/
│   ├── testDatabase.ts          # Test database utilities and fixtures
│   └── jest.setup.ts            # Jest configuration for integration tests
├── database/
│   └── BlacklistRepository.integration.test.ts  # Repository layer tests
├── services/
│   └── BlacklistService.integration.test.ts     # Service layer tests
├── commands/
│   └── commands.integration.test.ts              # Discord command tests
├── e2e/
│   └── fullWorkflow.integration.test.ts          # End-to-end workflow tests
└── jest.integration.config.js   # Jest configuration
```

## Setup

### 1. Environment Configuration

Copy the example test environment file:
```bash
cp .env.test.example .env.test
```

Update `.env.test` with your test database credentials:
```env
DISCORD_TOKEN=your_test_discord_bot_token_here
MYSQL_URL=mysql://username:password@localhost:3306/blacklist_bot_test
ADMIN_ROLE_ID=123456789012345678
NODE_ENV=test
```

### 2. Test Database

The integration tests use a separate test database to avoid affecting development data. The test utilities automatically:
- Create a unique test database for each test run
- Initialize the database schema
- Clean up test data between tests
- Drop the test database after tests complete

**Important**: Make sure your MySQL user has permissions to create and drop databases.

### 3. Dependencies

All required dependencies are already included in the main `package.json`. The integration tests use:
- Jest for test framework
- ts-jest for TypeScript support
- Real MySQL connections via mysql2
- Discord.js mocks for command testing

## Running Tests

### Run All Integration Tests
```bash
npm run test:integration
```

### Run Integration Tests in Watch Mode
```bash
npm run test:integration:watch
```

### Run All Tests (Unit + Integration)
```bash
npm run test:all
```

### Run Specific Test Files
```bash
# Run only repository tests
npx jest --config src/__tests__/integration/jest.integration.config.js BlacklistRepository

# Run only service tests
npx jest --config src/__tests__/integration/jest.integration.config.js BlacklistService

# Run only command tests
npx jest --config src/__tests__/integration/jest.integration.config.js commands

# Run only end-to-end tests
npx jest --config src/__tests__/integration/jest.integration.config.js fullWorkflow
```

## Test Features

### Database Testing
- **Real MySQL Connections**: Tests use actual database connections, not mocks
- **Isolated Test Databases**: Each test run uses a unique database name
- **Automatic Cleanup**: Test data is cleared between tests and database is dropped after completion
- **Schema Validation**: Tests verify database schema initialization
- **Connection Recovery**: Tests database reconnection scenarios

### Service Layer Testing
- **Business Logic Validation**: Tests entry validation and duplicate checking
- **Search Functionality**: Tests partial name matching and multiple search criteria
- **Error Handling**: Tests validation errors and edge cases
- **Data Sanitization**: Tests input sanitization and trimming

### Command Testing
- **Discord Integration**: Tests Discord command handlers with mocked interactions
- **Permission Checking**: Tests admin and guild member permission validation
- **Complete Workflows**: Tests full command execution from input to database
- **Error Responses**: Tests user-friendly error messages in Thai and English
- **Concurrent Operations**: Tests multiple simultaneous command executions

### End-to-End Testing
- **Full Workflows**: Tests complete add-check-remove workflows
- **Multi-User Scenarios**: Tests concurrent operations by multiple users
- **Performance Testing**: Tests with large datasets and measures response times
- **Data Integrity**: Tests referential integrity and consistency
- **Error Recovery**: Tests recovery from database connection failures

## Test Data Management

### TestDatabase Class
- Creates unique test databases for isolation
- Manages database lifecycle (create, initialize, cleanup)
- Provides connection management utilities
- Handles environment variable switching

### TestDataFixtures Class
- Provides utilities for creating test data
- Offers pre-defined sample entries
- Includes data verification methods
- Supports custom entry creation

### Example Usage
```typescript
// Set up test database
const testDb = TestDatabase.getInstance();
await testDb.setup();

// Create test fixtures
const fixtures = new TestDataFixtures(testDb.getConnection());
const entryId = await fixtures.createEntry('0812345678', 'John', 'Doe');

// Clean up
await testDb.teardown();
```

## Performance Considerations

The integration tests are designed to:
- Run sequentially to avoid database conflicts (`maxWorkers: 1`)
- Use connection pooling for efficiency
- Clean up resources properly to prevent memory leaks
- Complete within reasonable timeouts (60 seconds max)
- Test performance with large datasets

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify MySQL server is running
   - Check credentials in `.env.test`
   - Ensure user has CREATE/DROP database permissions

2. **Test Timeouts**
   - Database operations may be slow on first run
   - Increase timeout in jest.integration.config.js if needed
   - Check for hanging database connections

3. **Permission Errors**
   - Ensure MySQL user can create/drop databases
   - Check that test database doesn't already exist
   - Verify network connectivity to MySQL server

4. **Environment Variables**
   - Ensure `.env.test` file exists and is properly formatted
   - Check that all required variables are set
   - Verify Discord token format (even if dummy for tests)

### Debug Mode

Run tests with verbose output:
```bash
npm run test:integration -- --verbose
```

Run with debug information:
```bash
DEBUG=* npm run test:integration
```

## CI/CD Integration

For continuous integration, ensure:
1. Test database is available in CI environment
2. Environment variables are properly configured
3. MySQL service is running before tests
4. Sufficient timeout for database operations
5. Proper cleanup to avoid resource leaks

Example GitHub Actions configuration:
```yaml
services:
  mysql:
    image: mysql:8.0
    env:
      MYSQL_ROOT_PASSWORD: testpassword
      MYSQL_DATABASE: blacklist_bot_test
    options: >-
      --health-cmd="mysqladmin ping"
      --health-interval=10s
      --health-timeout=5s
      --health-retries=3

steps:
  - name: Run Integration Tests
    run: npm run test:integration
    env:
      MYSQL_URL: mysql://root:testpassword@localhost:3306/blacklist_bot_test
      DISCORD_TOKEN: dummy_token_for_testing
      ADMIN_ROLE_ID: 123456789012345678
```