#!/usr/bin/env node

/**
 * Database initialization script
 * This script can be run to initialize the database schema
 */

import { DatabaseConnection, DatabaseSchema } from './index';

async function initializeDatabase(): Promise<void> {
  const db = DatabaseConnection.getInstance();
  const schema = new DatabaseSchema();

  try {
    console.log('Starting database initialization...');
    
    // Connect to database
    await db.connect();
    console.log('Connected to database successfully');

    // Initialize schema
    await schema.initializeSchema();
    
    // Verify schema
    const isValid = await schema.verifySchema();
    if (!isValid) {
      throw new Error('Schema verification failed');
    }

    // Get table stats
    const stats = await schema.getTableStats();
    console.log('Database initialization completed successfully');
    console.log(`Current entries: ${stats.totalEntries}`);
    
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error; // Re-throw for caller to handle
  } finally {
    await db.disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase().catch((error) => {
    console.error('Unhandled error during database initialization:', error);
    process.exit(1);
  });
}

export { initializeDatabase };