import { DatabaseConnection } from './connection';
import { BlacklistEntry, CreateBlacklistEntryInput, validateBlacklistEntry, sanitizeBlacklistEntryInput } from '../models/BlacklistEntry';
import { SearchCriteria, validateSearchCriteria, sanitizeSearchCriteria } from '../models/SearchCriteria';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { logger } from '../utils/Logger';
import { errorHandler } from '../utils/ErrorHandler';

/**
 * Repository interface for blacklist operations
 * Requirements: 1.1, 2.1, 3.1, 4.4
 */
export interface IBlacklistRepository {
  create(entry: CreateBlacklistEntryInput): Promise<number>;
  findByIdentifier(identifier: string): Promise<BlacklistEntry[]>;
  findByName(firstName?: string, lastName?: string): Promise<BlacklistEntry[]>;
  search(criteria: SearchCriteria): Promise<BlacklistEntry[]>;
  findById(id: number): Promise<BlacklistEntry | null>;
  deleteById(id: number): Promise<boolean>;
  exists(identifier: string): Promise<boolean>;
}

/**
 * Database row interface for blacklist entries
 */
interface BlacklistEntryRow extends RowDataPacket {
  id: number;
  identifier: string;
  first_name: string | null;
  last_name: string | null;
  created_at: Date;
  created_by: string;
}

/**
 * BlacklistRepository implementation with CRUD operations
 * Uses parameterized queries to prevent SQL injection
 * Requirements: 1.1, 2.1, 3.1, 4.4
 */
export class BlacklistRepository implements IBlacklistRepository {
  private db: DatabaseConnection;
  private logger = logger.child('BlacklistRepository');

  constructor() {
    this.db = DatabaseConnection.getInstance();
  }

  /**
   * Creates a new blacklist entry
   * Requirement 1.1: Store blacklist entry in MySQL database
   * @param entry The blacklist entry data to create
   * @returns The ID of the created entry
   */
  async create(entry: CreateBlacklistEntryInput): Promise<number> {
    // Validate and sanitize input
    const sanitizedEntry = sanitizeBlacklistEntryInput(entry);
    const validation = validateBlacklistEntry(sanitizedEntry);
    
    if (!validation.isValid) {
      const validationError = new Error(`Invalid blacklist entry: ${validation.errors.join(', ')}`);
      this.logger.warn('Blacklist entry validation failed', {
        errors: validation.errors,
        identifier: sanitizedEntry.identifier
      });
      throw validationError;
    }

    const sql = `
      INSERT INTO blacklist_entries (identifier, first_name, last_name, created_by)
      VALUES (?, ?, ?, ?)
    `;

    const params = [
      sanitizedEntry.identifier,
      sanitizedEntry.firstName || null,
      sanitizedEntry.lastName || null,
      sanitizedEntry.createdBy
    ];

    try {
      this.logger.debug('Creating blacklist entry', {
        identifier: sanitizedEntry.identifier,
        hasFirstName: !!sanitizedEntry.firstName,
        hasLastName: !!sanitizedEntry.lastName,
        createdBy: sanitizedEntry.createdBy
      });

      const result = await this.db.query<ResultSetHeader>(sql, params);
      
      this.logger.info('Blacklist entry created successfully', {
        entryId: result.insertId,
        identifier: sanitizedEntry.identifier
      });

      return result.insertId;
    } catch (error) {
      errorHandler.handleDatabaseError(error, 'create', 'BlacklistRepository');
      this.logger.error('Failed to create blacklist entry', error instanceof Error ? error : undefined, {
        identifier: sanitizedEntry.identifier,
        operation: 'create'
      });
      throw new Error('Failed to create blacklist entry');
    }
  }

  /**
   * Finds blacklist entries by identifier (exact match)
   * Requirement 2.1: Search database for matching blacklist entries
   * @param identifier The identifier to search for
   * @returns Array of matching blacklist entries
   */
  async findByIdentifier(identifier: string): Promise<BlacklistEntry[]> {
    if (!identifier || typeof identifier !== 'string' || identifier.trim().length === 0) {
      const validationError = new Error('Identifier is required and must be a non-empty string');
      this.logger.warn('Invalid identifier provided for search', { identifier });
      throw validationError;
    }

    const sql = `
      SELECT id, identifier, first_name, last_name, created_at, created_by
      FROM blacklist_entries
      WHERE identifier = ?
      ORDER BY created_at DESC
    `;

    try {
      this.logger.debug('Searching blacklist entries by identifier', {
        identifier: identifier.trim()
      });

      const rows = await this.db.query<BlacklistEntryRow[]>(sql, [identifier.trim()]);
      const results = rows.map(this.mapRowToEntry);

      this.logger.debug('Blacklist search by identifier completed', {
        identifier: identifier.trim(),
        resultCount: results.length
      });

      return results;
    } catch (error) {
      errorHandler.handleDatabaseError(error, 'findByIdentifier', 'BlacklistRepository');
      this.logger.error('Failed to search blacklist entries by identifier', error instanceof Error ? error : undefined, {
        identifier: identifier.trim(),
        operation: 'findByIdentifier'
      });
      throw new Error('Failed to search blacklist entries');
    }
  }

  /**
   * Finds blacklist entries by name (partial matching)
   * Requirement 2.5: Support partial matching for first name and last name
   * @param firstName Optional first name to search for
   * @param lastName Optional last name to search for
   * @returns Array of matching blacklist entries
   */
  async findByName(firstName?: string, lastName?: string): Promise<BlacklistEntry[]> {
    if (!firstName && !lastName) {
      throw new Error('At least one name parameter (firstName or lastName) must be provided');
    }

    let sql = `
      SELECT id, identifier, first_name, last_name, created_at, created_by
      FROM blacklist_entries
      WHERE 1=1
    `;
    const params: string[] = [];

    if (firstName && firstName.trim()) {
      sql += ` AND first_name LIKE ?`;
      params.push(`%${firstName.trim()}%`);
    }

    if (lastName && lastName.trim()) {
      sql += ` AND last_name LIKE ?`;
      params.push(`%${lastName.trim()}%`);
    }

    sql += ` ORDER BY created_at DESC`;

    try {
      const rows = await this.db.query<BlacklistEntryRow[]>(sql, params);
      return rows.map(this.mapRowToEntry);
    } catch (error) {
      console.error('Error finding blacklist entries by name:', error);
      throw new Error('Failed to search blacklist entries by name');
    }
  }

  /**
   * Searches blacklist entries using flexible criteria
   * Requirement 2.1, 2.5: Search by phone numbers, account numbers, or names with partial matching
   * @param criteria The search criteria
   * @returns Array of matching blacklist entries
   */
  async search(criteria: SearchCriteria): Promise<BlacklistEntry[]> {
    // Validate and sanitize search criteria
    const sanitizedCriteria = sanitizeSearchCriteria(criteria);
    const validation = validateSearchCriteria(sanitizedCriteria);
    
    if (!validation.isValid) {
      const validationError = new Error(`Invalid search criteria: ${validation.errors.join(', ')}`);
      this.logger.warn('Search criteria validation failed', {
        errors: validation.errors,
        criteria: sanitizedCriteria
      });
      throw validationError;
    }

    let sql = `
      SELECT id, identifier, first_name, last_name, created_at, created_by
      FROM blacklist_entries
      WHERE 1=1
    `;
    const params: string[] = [];

    // Search by identifier (exact match)
    if (sanitizedCriteria.identifier) {
      sql += ` AND identifier = ?`;
      params.push(sanitizedCriteria.identifier);
    }

    // Search by first name (partial match)
    if (sanitizedCriteria.firstName) {
      sql += ` AND first_name LIKE ?`;
      params.push(`%${sanitizedCriteria.firstName}%`);
    }

    // Search by last name (partial match)
    if (sanitizedCriteria.lastName) {
      sql += ` AND last_name LIKE ?`;
      params.push(`%${sanitizedCriteria.lastName}%`);
    }

    sql += ` ORDER BY created_at DESC`;

    try {
      this.logger.debug('Searching blacklist entries with criteria', {
        criteria: sanitizedCriteria,
        paramCount: params.length
      });

      const rows = await this.db.query<BlacklistEntryRow[]>(sql, params);
      const results = rows.map(this.mapRowToEntry);

      this.logger.debug('Blacklist search completed', {
        criteria: sanitizedCriteria,
        resultCount: results.length
      });

      return results;
    } catch (error) {
      errorHandler.handleDatabaseError(error, 'search', 'BlacklistRepository');
      this.logger.error('Failed to search blacklist entries', error instanceof Error ? error : undefined, {
        criteria: sanitizedCriteria,
        operation: 'search'
      });
      throw new Error('Failed to search blacklist entries');
    }
  }

  /**
   * Finds a blacklist entry by ID
   * @param id The entry ID to search for
   * @returns The blacklist entry or null if not found
   */
  async findById(id: number): Promise<BlacklistEntry | null> {
    if (!id || typeof id !== 'number' || id <= 0) {
      throw new Error('ID must be a positive number');
    }

    const sql = `
      SELECT id, identifier, first_name, last_name, created_at, created_by
      FROM blacklist_entries
      WHERE id = ?
    `;

    try {
      const rows = await this.db.query<BlacklistEntryRow[]>(sql, [id]);
      if (rows.length > 0 && rows[0]) {
        return this.mapRowToEntry(rows[0]);
      }
      return null;
    } catch (error) {
      console.error('Error finding blacklist entry by ID:', error);
      throw new Error('Failed to find blacklist entry');
    }
  }

  /**
   * Deletes a blacklist entry by ID
   * Requirement 3.1: Remove specified entry from database
   * @param id The ID of the entry to delete
   * @returns True if the entry was deleted, false if not found
   */
  async deleteById(id: number): Promise<boolean> {
    if (!id || typeof id !== 'number' || id <= 0) {
      const validationError = new Error('ID must be a positive number');
      this.logger.warn('Invalid ID provided for deletion', { id });
      throw validationError;
    }

    const sql = `DELETE FROM blacklist_entries WHERE id = ?`;

    try {
      this.logger.debug('Deleting blacklist entry by ID', { id });

      const result = await this.db.query<ResultSetHeader>(sql, [id]);
      const deleted = result.affectedRows > 0;

      if (deleted) {
        this.logger.info('Blacklist entry deleted successfully', { id });
      } else {
        this.logger.warn('No blacklist entry found to delete', { id });
      }

      return deleted;
    } catch (error) {
      errorHandler.handleDatabaseError(error, 'deleteById', 'BlacklistRepository');
      this.logger.error('Failed to delete blacklist entry', error instanceof Error ? error : undefined, {
        id,
        operation: 'deleteById'
      });
      throw new Error('Failed to delete blacklist entry');
    }
  }

  /**
   * Checks if a blacklist entry exists with the given identifier
   * @param identifier The identifier to check
   * @returns True if an entry exists, false otherwise
   */
  async exists(identifier: string): Promise<boolean> {
    if (!identifier || typeof identifier !== 'string' || identifier.trim().length === 0) {
      throw new Error('Identifier is required and must be a non-empty string');
    }

    const sql = `SELECT COUNT(*) as count FROM blacklist_entries WHERE identifier = ?`;

    try {
      const rows = await this.db.query<RowDataPacket[]>(sql, [identifier.trim()]);
      return (rows[0] as any).count > 0;
    } catch (error) {
      console.error('Error checking blacklist entry existence:', error);
      throw new Error('Failed to check blacklist entry existence');
    }
  }

  /**
   * Maps a database row to a BlacklistEntry object
   * @param row The database row
   * @returns BlacklistEntry object
   */
  private mapRowToEntry(row: BlacklistEntryRow): BlacklistEntry {
    const entry: BlacklistEntry = {
      id: row.id,
      identifier: row.identifier,
      createdAt: row.created_at,
      createdBy: row.created_by
    };

    if (row.first_name) {
      entry.firstName = row.first_name;
    }

    if (row.last_name) {
      entry.lastName = row.last_name;
    }

    return entry;
  }
}