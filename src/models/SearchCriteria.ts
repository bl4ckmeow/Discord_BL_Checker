/**
 * SearchCriteria interface for searching blacklist entries
 * Requirements: 2.4, 2.5
 */
export interface SearchCriteria {
  identifier?: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Validation result interface for search criteria
 */
export interface SearchValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates search criteria input
 * @param criteria The search criteria to validate
 * @returns SearchValidationResult indicating if the criteria is valid and any errors
 */
export function validateSearchCriteria(criteria: SearchCriteria): SearchValidationResult {
  const errors: string[] = [];

  // At least one search criterion must be provided
  if (!criteria.identifier && !criteria.firstName && !criteria.lastName) {
    errors.push('At least one search criterion must be provided (identifier, firstName, or lastName)');
  }

  // Validate identifier if provided
  if (criteria.identifier !== undefined) {
    if (typeof criteria.identifier !== 'string') {
      errors.push('Identifier must be a string');
    } else if (criteria.identifier.trim().length === 0) {
      errors.push('Identifier cannot be empty when provided');
    } else if (criteria.identifier.length > 255) {
      errors.push('Identifier cannot exceed 255 characters');
    }
  }

  // Validate firstName if provided
  if (criteria.firstName !== undefined) {
    if (typeof criteria.firstName !== 'string') {
      errors.push('FirstName must be a string');
    } else if (criteria.firstName.trim().length === 0) {
      errors.push('FirstName cannot be empty when provided');
    } else if (criteria.firstName.length > 100) {
      errors.push('FirstName cannot exceed 100 characters');
    }
  }

  // Validate lastName if provided
  if (criteria.lastName !== undefined) {
    if (typeof criteria.lastName !== 'string') {
      errors.push('LastName must be a string');
    } else if (criteria.lastName.trim().length === 0) {
      errors.push('LastName cannot be empty when provided');
    } else if (criteria.lastName.length > 100) {
      errors.push('LastName cannot exceed 100 characters');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Sanitizes search criteria by trimming whitespace and removing empty values
 * @param criteria The search criteria to sanitize
 * @returns Sanitized search criteria
 */
export function sanitizeSearchCriteria(criteria: SearchCriteria): SearchCriteria {
  const sanitized: SearchCriteria = {};

  if (criteria.identifier && criteria.identifier.trim()) {
    sanitized.identifier = criteria.identifier.trim();
  }

  if (criteria.firstName && criteria.firstName.trim()) {
    sanitized.firstName = criteria.firstName.trim();
  }

  if (criteria.lastName && criteria.lastName.trim()) {
    sanitized.lastName = criteria.lastName.trim();
  }

  return sanitized;
}