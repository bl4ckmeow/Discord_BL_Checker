# Database Module

This module provides database connection and schema management for the Discord Blacklist Bot.

## Components

### DatabaseConnection
- Singleton pattern for managing MySQL connection pool
- Connection pooling with automatic retry logic
- Error handling and reconnection capabilities
- Transaction support

### DatabaseSchema
- Database schema initialization and management
- Table creation with proper indexes
- Schema verification utilities
- Statistics and maintenance functions

### Database Initialization
- Automated schema setup script
- Environment-based configuration
- Validation and error handling

## Usage

### Basic Connection
```typescript
import { DatabaseConnection } from './database';

const db = DatabaseConnection.getInstance();
await db.connect();

// Execute queries
const results = await db.query('SELECT * FROM blacklist_entries WHERE identifier = ?', ['12345']);

// Use transactions
await db.transaction(async (connection) => {
  await connection.execute('INSERT INTO blacklist_entries (identifier, created_by) VALUES (?, ?)', ['12345', 'user123']);
  await connection.execute('UPDATE some_other_table SET count = count + 1');
});

await db.disconnect();
```

### Schema Management
```typescript
import { DatabaseSchema } from './database';

const schema = new DatabaseSchema();

// Initialize database schema
await schema.initializeSchema();

// Verify schema is correct
const isValid = await schema.verifySchema();

// Get table statistics
const stats = await schema.getTableStats();
```

### Database Initialization Script
```bash
# Initialize database schema
npm run db:init
```

Or programmatically:
```typescript
import { initializeDatabase } from './database';

await initializeDatabase();
```

## Configuration

Database connection is configured via environment variables:

```env
MYSQL_URL=mysql://username:password@localhost:3306/database_name
```

## Schema

The database uses the following table structure:

```sql
CREATE TABLE blacklist_entries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  identifier VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(20) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

With indexes on:
- `identifier` (for fast lookups)
- `first_name, last_name` (for name searches)
- `created_by` (for admin queries)
- `created_at` (for time-based queries)

## Error Handling

The module includes comprehensive error handling:
- Connection failures with exponential backoff retry
- Query timeouts and connection pool management
- Schema validation and initialization errors
- Graceful degradation and logging

## Testing

Run database tests:
```bash
npm test -- src/database/__tests__
```

The test suite includes:
- Unit tests for all database operations
- Mock-based testing for isolation
- Error scenario testing
- Connection and schema validation tests