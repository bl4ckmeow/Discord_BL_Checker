/**
 * BlacklistEntry interface representing a blacklisted user/account
 * Requirements: 1.2, 2.4, 4.4
 */
export interface BlacklistEntry {
  id?: number;
  identifier: string;  // account name, account number, or phone number
  firstName?: string;
  lastName?: string;
  createdAt: Date;
  createdBy: string;  // Discord user ID
}

/**
 * Input data for creating a new blacklist entry
 */
export interface CreateBlacklistEntryInput {
  identifier: string;
  firstName?: string;
  lastName?: string;
  createdBy: string;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates a blacklist entry input
 * @param input The blacklist entry input to validate
 * @returns ValidationResult indicating if the input is valid and any errors
 */
export function validateBlacklistEntry(input: CreateBlacklistEntryInput): ValidationResult {
  const errors: string[] = [];

  // Validate identifier (required)
  if (input.identifier === undefined || input.identifier === null || typeof input.identifier !== 'string') {
    errors.push('Identifier is required and must be a string');
  } else if (input.identifier.trim().length === 0) {
    errors.push('Identifier cannot be empty');
  } else if (input.identifier.length > 255) {
    errors.push('Identifier cannot exceed 255 characters');
  }

  // Validate createdBy (required)
  if (input.createdBy === undefined || input.createdBy === null || typeof input.createdBy !== 'string') {
    errors.push('CreatedBy is required and must be a string');
  } else if (input.createdBy.trim().length === 0) {
    errors.push('CreatedBy cannot be empty');
  } else if (input.createdBy.length > 20) {
    errors.push('CreatedBy cannot exceed 20 characters');
  }

  // Validate firstName (optional)
  if (input.firstName !== undefined) {
    if (typeof input.firstName !== 'string') {
      errors.push('FirstName must be a string');
    } else if (input.firstName.length > 100) {
      errors.push('FirstName cannot exceed 100 characters');
    }
  }

  // Validate lastName (optional)
  if (input.lastName !== undefined) {
    if (typeof input.lastName !== 'string') {
      errors.push('LastName must be a string');
    } else if (input.lastName.length > 100) {
      errors.push('LastName cannot exceed 100 characters');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Sanitizes input data by trimming whitespace
 * @param input The input to sanitize
 * @returns Sanitized input
 */
export function sanitizeBlacklistEntryInput(input: CreateBlacklistEntryInput): CreateBlacklistEntryInput {
  const result: CreateBlacklistEntryInput = {
    identifier: input.identifier?.trim() || '',
    createdBy: input.createdBy?.trim() || ''
  };

  if (input.firstName && input.firstName.trim()) {
    result.firstName = input.firstName.trim();
  }

  if (input.lastName && input.lastName.trim()) {
    result.lastName = input.lastName.trim();
  }

  return result;
}