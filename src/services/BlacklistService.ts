import { BlacklistRepository, IBlacklistRepository } from '../database/BlacklistRepository';
import { BlacklistEntry, CreateBlacklistEntryInput, validateBlacklistEntry, sanitizeBlacklistEntryInput } from '../models/BlacklistEntry';
import { SearchCriteria, validateSearchCriteria, sanitizeSearchCriteria } from '../models/SearchCriteria';
import { logger } from '../utils/Logger';
import { errorHandler } from '../utils/ErrorHandler';

/**
 * Service interface for blacklist operations
 * Requirements: 1.2, 2.5, 3.3
 */
export interface IBlacklistService {
  addEntry(entry: CreateBlacklistEntryInput): Promise<number>;
  searchEntries(criteria: SearchCriteria): Promise<BlacklistEntry[]>;
  removeEntry(id: number): Promise<boolean>;
  checkDuplicate(identifier: string): Promise<boolean>;
  findByIdentifier(identifier: string): Promise<BlacklistEntry[]>;
  findByName(firstName?: string, lastName?: string): Promise<BlacklistEntry[]>;
  getById(id: number): Promise<BlacklistEntry | null>;
}

/**
 * Service result interface for operations
 */
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * BlacklistService implementation with business logic
 * Handles entry validation, duplicate checking, and search operations
 * Requirements: 1.2, 2.5, 3.3
 */
export class BlacklistService implements IBlacklistService {
  private repository: IBlacklistRepository;
  private logger = logger.child('BlacklistService');

  constructor(repository?: IBlacklistRepository) {
    this.repository = repository || new BlacklistRepository();
  }

  /**
   * Adds a new blacklist entry with validation and duplicate checking
   * Requirement 1.2: Entry validation and duplicate checking
   * @param entry The blacklist entry data to add
   * @returns The ID of the created entry
   * @throws Error if validation fails or duplicate exists
   */
  async addEntry(entry: CreateBlacklistEntryInput): Promise<number> {
    // Sanitize input data
    const sanitizedEntry = sanitizeBlacklistEntryInput(entry);
    
    // Validate entry data
    const validation = validateBlacklistEntry(sanitizedEntry);
    if (!validation.isValid) {
      const validationError = new Error(`Validation failed: ${validation.errors.join(', ')}`);
      this.logger.warn('Blacklist entry validation failed', {
        errors: validation.errors,
        identifier: sanitizedEntry.identifier
      });
      throw validationError;
    }

    // Check for duplicate entries
    try {
      const isDuplicate = await this.checkDuplicate(sanitizedEntry.identifier);
      if (isDuplicate) {
        const duplicateError = new Error(`Duplicate entry: An entry with identifier "${sanitizedEntry.identifier}" already exists`);
        this.logger.warn('Duplicate blacklist entry detected', {
          identifier: sanitizedEntry.identifier
        });
        throw duplicateError;
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Duplicate entry')) {
        throw error; // Re-throw duplicate errors
      }
      // Log and handle other errors during duplicate check
      errorHandler.handleError(error, 'BlacklistService.checkDuplicate');
      this.logger.error('Error checking for duplicate entry', error instanceof Error ? error : undefined, {
        identifier: sanitizedEntry.identifier
      });
      throw new Error('Failed to verify entry uniqueness');
    }

    try {
      this.logger.info('Adding new blacklist entry', {
        identifier: sanitizedEntry.identifier,
        hasFirstName: !!sanitizedEntry.firstName,
        hasLastName: !!sanitizedEntry.lastName,
        createdBy: sanitizedEntry.createdBy
      });

      const entryId = await this.repository.create(sanitizedEntry);
      
      this.logger.info('Blacklist entry added successfully', {
        entryId,
        identifier: sanitizedEntry.identifier
      });

      return entryId;
    } catch (error) {
      errorHandler.handleError(error, 'BlacklistService.addEntry');
      this.logger.error('Failed to add blacklist entry', error instanceof Error ? error : undefined, {
        identifier: sanitizedEntry.identifier
      });
      throw new Error('Failed to add blacklist entry to database');
    }
  }

  /**
   * Searches for blacklist entries using flexible criteria with partial name matching
   * Requirement 2.5: Search logic with partial name matching
   * @param criteria The search criteria
   * @returns Array of matching blacklist entries
   * @throws Error if validation fails
   */
  async searchEntries(criteria: SearchCriteria): Promise<BlacklistEntry[]> {
    // Sanitize search criteria
    const sanitizedCriteria = sanitizeSearchCriteria(criteria);
    
    // Validate search criteria
    const validation = validateSearchCriteria(sanitizedCriteria);
    if (!validation.isValid) {
      const validationError = new Error(`Search validation failed: ${validation.errors.join(', ')}`);
      this.logger.warn('Search criteria validation failed', {
        errors: validation.errors,
        criteria: sanitizedCriteria
      });
      throw validationError;
    }

    try {
      this.logger.debug('Searching blacklist entries', {
        criteria: sanitizedCriteria
      });

      // Use repository search method which handles partial matching for names
      const results = await this.repository.search(sanitizedCriteria);
      
      this.logger.debug('Blacklist search completed', {
        criteria: sanitizedCriteria,
        resultCount: results.length
      });

      return results;
    } catch (error) {
      errorHandler.handleError(error, 'BlacklistService.searchEntries');
      this.logger.error('Failed to search blacklist entries', error instanceof Error ? error : undefined, {
        criteria: sanitizedCriteria
      });
      throw new Error('Failed to search blacklist entries');
    }
  }

  /**
   * Removes a blacklist entry by ID
   * Requirement 3.3: Remove entry with validation
   * @param id The ID of the entry to remove
   * @returns True if the entry was removed, false if not found
   * @throws Error if ID is invalid or operation fails
   */
  async removeEntry(id: number): Promise<boolean> {
    // Validate ID
    if (!id || typeof id !== 'number' || id <= 0) {
      const validationError = new Error('Invalid ID: ID must be a positive number');
      this.logger.warn('Invalid ID provided for removal', { id });
      throw validationError;
    }

    try {
      this.logger.debug('Removing blacklist entry', { id });

      // Check if entry exists before attempting deletion
      const existingEntry = await this.repository.findById(id);
      if (!existingEntry) {
        this.logger.warn('Blacklist entry not found for removal', { id });
        return false; // Entry not found
      }

      this.logger.debug('Found existing entry for removal', {
        id,
        identifier: existingEntry.identifier
      });

      const deleted = await this.repository.deleteById(id);
      
      if (deleted) {
        this.logger.info('Blacklist entry removed successfully', {
          id,
          identifier: existingEntry.identifier
        });
      } else {
        this.logger.warn('Failed to delete blacklist entry (no rows affected)', { id });
      }

      return deleted;
    } catch (error) {
      errorHandler.handleError(error, 'BlacklistService.removeEntry');
      this.logger.error('Failed to remove blacklist entry', error instanceof Error ? error : undefined, {
        id
      });
      throw new Error('Failed to remove blacklist entry');
    }
  }

  /**
   * Checks if a duplicate entry exists with the given identifier
   * Requirement 1.2: Duplicate checking functionality
   * @param identifier The identifier to check for duplicates
   * @returns True if a duplicate exists, false otherwise
   * @throws Error if identifier is invalid
   */
  async checkDuplicate(identifier: string): Promise<boolean> {
    if (!identifier || typeof identifier !== 'string' || identifier.trim().length === 0) {
      throw new Error('Invalid identifier: Identifier must be a non-empty string');
    }

    try {
      const exists = await this.repository.exists(identifier.trim());
      return exists;
    } catch (error) {
      console.error('Error checking for duplicate entry:', error);
      throw new Error('Failed to check for duplicate entry');
    }
  }

  /**
   * Searches for entries by identifier only (exact match)
   * @param identifier The identifier to search for
   * @returns Array of matching entries
   */
  async findByIdentifier(identifier: string): Promise<BlacklistEntry[]> {
    if (!identifier || typeof identifier !== 'string' || identifier.trim().length === 0) {
      throw new Error('Invalid identifier: Identifier must be a non-empty string');
    }

    try {
      const results = await this.repository.findByIdentifier(identifier.trim());
      return results;
    } catch (error) {
      console.error('Error finding entries by identifier:', error);
      throw new Error('Failed to find entries by identifier');
    }
  }

  /**
   * Searches for entries by name with partial matching
   * @param firstName Optional first name to search for
   * @param lastName Optional last name to search for
   * @returns Array of matching entries
   */
  async findByName(firstName?: string, lastName?: string): Promise<BlacklistEntry[]> {
    if (!firstName && !lastName) {
      throw new Error('At least one name parameter must be provided');
    }

    try {
      const results = await this.repository.findByName(firstName, lastName);
      return results;
    } catch (error) {
      console.error('Error finding entries by name:', error);
      throw new Error('Failed to find entries by name');
    }
  }

  /**
   * Gets a blacklist entry by ID
   * @param id The entry ID
   * @returns The blacklist entry or null if not found
   */
  async getById(id: number): Promise<BlacklistEntry | null> {
    if (!id || typeof id !== 'number' || id <= 0) {
      throw new Error('Invalid ID: ID must be a positive number');
    }

    try {
      const entry = await this.repository.findById(id);
      return entry;
    } catch (error) {
      console.error('Error getting entry by ID:', error);
      throw new Error('Failed to get entry by ID');
    }
  }
}