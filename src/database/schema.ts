import { DatabaseConnection } from './connection';

export class DatabaseSchema {
    private db: DatabaseConnection;

    constructor() {
        this.db = DatabaseConnection.getInstance();
    }

    public async initializeSchema(): Promise<void> {
        try {
            console.log('Initializing database schema...');

            await this.createBlacklistTable();
            await this.createIndexes();

            console.log('Database schema initialized successfully');
        } catch (error) {
            console.error('Failed to initialize database schema:', error);
            throw error;
        }
    }

    private async createBlacklistTable(): Promise<void> {
        const createTableSQL = `
      CREATE TABLE IF NOT EXISTS blacklist_entries (
        id INT PRIMARY KEY AUTO_INCREMENT,
        identifier VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(20) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

        await this.db.query(createTableSQL);
        console.log('Blacklist entries table created/verified');
    }

    private async createIndexes(): Promise<void> {
        const indexes = [
            {
                name: 'idx_identifier',
                sql: 'CREATE INDEX IF NOT EXISTS idx_identifier ON blacklist_entries (identifier);'
            },
            {
                name: 'idx_names',
                sql: 'CREATE INDEX IF NOT EXISTS idx_names ON blacklist_entries (first_name, last_name);'
            },
            {
                name: 'idx_created_by',
                sql: 'CREATE INDEX IF NOT EXISTS idx_created_by ON blacklist_entries (created_by);'
            },
            {
                name: 'idx_created_at',
                sql: 'CREATE INDEX IF NOT EXISTS idx_created_at ON blacklist_entries (created_at);'
            }
        ];

        for (const index of indexes) {
            try {
                await this.db.query(index.sql);
                console.log(`Index ${index.name} created/verified`);
            } catch (error) {
                console.error(`Failed to create index ${index.name}:`, error);
                // Continue with other indexes even if one fails
            }
        }
    }

    public async verifySchema(): Promise<boolean> {
        try {
            // Check if the main table exists and has the expected structure
            const tableInfo = await this.db.query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'blacklist_entries'
        ORDER BY ORDINAL_POSITION;
      `);

            if (!Array.isArray(tableInfo) || tableInfo.length === 0) {
                console.error('Blacklist entries table not found');
                return false;
            }

            // Verify expected columns exist
            const expectedColumns = ['id', 'identifier', 'first_name', 'last_name', 'created_at', 'created_by', 'updated_at'];
            const actualColumns = (tableInfo as any[]).map(col => col.COLUMN_NAME.toLowerCase());

            for (const expectedCol of expectedColumns) {
                if (!actualColumns.includes(expectedCol)) {
                    console.error(`Missing expected column: ${expectedCol}`);
                    return false;
                }
            }

            // Check indexes
            const indexInfo = await this.db.query(`
        SELECT INDEX_NAME, COLUMN_NAME
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'blacklist_entries'
        AND INDEX_NAME != 'PRIMARY'
        ORDER BY INDEX_NAME, SEQ_IN_INDEX;
      `);

            console.log('Schema verification completed successfully');
            console.log(`Found ${actualColumns.length} columns and ${Array.isArray(indexInfo) ? indexInfo.length : 0} index entries`);

            return true;
        } catch (error) {
            console.error('Schema verification failed:', error);
            return false;
        }
    }

    public async dropSchema(): Promise<void> {
        try {
            console.log('Dropping database schema...');

            await this.db.query('DROP TABLE IF EXISTS blacklist_entries;');

            console.log('Database schema dropped successfully');
        } catch (error) {
            console.error('Failed to drop database schema:', error);
            throw error;
        }
    }

    public async resetSchema(): Promise<void> {
        await this.dropSchema();
        await this.initializeSchema();
    }

    public async getTableStats(): Promise<{
        totalEntries: number;
        oldestEntry: Date | null;
        newestEntry: Date | null;
    }> {
        try {
            const [countResult] = await this.db.query(`
        SELECT COUNT(*) as total_entries,
               MIN(created_at) as oldest_entry,
               MAX(created_at) as newest_entry
        FROM blacklist_entries;
      `) as any[];

            return {
                totalEntries: countResult.total_entries || 0,
                oldestEntry: countResult.oldest_entry || null,
                newestEntry: countResult.newest_entry || null
            };
        } catch (error) {
            console.error('Failed to get table stats:', error);
            return {
                totalEntries: 0,
                oldestEntry: null,
                newestEntry: null
            };
        }
    }
}