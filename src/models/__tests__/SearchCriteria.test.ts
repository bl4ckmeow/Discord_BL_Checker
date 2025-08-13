import {
  SearchCriteria,
  validateSearchCriteria,
  sanitizeSearchCriteria,
  SearchValidationResult
} from '../SearchCriteria';

describe('SearchCriteria', () => {
  describe('validateSearchCriteria', () => {
    it('should validate search criteria with identifier only', () => {
      const criteria: SearchCriteria = {
        identifier: 'test-account-123'
      };

      const result: SearchValidationResult = validateSearchCriteria(criteria);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate search criteria with firstName only', () => {
      const criteria: SearchCriteria = {
        firstName: 'John'
      };

      const result: SearchValidationResult = validateSearchCriteria(criteria);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate search criteria with lastName only', () => {
      const criteria: SearchCriteria = {
        lastName: 'Doe'
      };

      const result: SearchValidationResult = validateSearchCriteria(criteria);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate search criteria with multiple fields', () => {
      const criteria: SearchCriteria = {
        identifier: 'test-account',
        firstName: 'John',
        lastName: 'Doe'
      };

      const result: SearchValidationResult = validateSearchCriteria(criteria);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty search criteria', () => {
      const criteria: SearchCriteria = {};

      const result: SearchValidationResult = validateSearchCriteria(criteria);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one search criterion must be provided (identifier, firstName, or lastName)');
    });

    it('should reject search criteria with all undefined fields', () => {
      const criteria: SearchCriteria = {};

      const result: SearchValidationResult = validateSearchCriteria(criteria);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one search criterion must be provided (identifier, firstName, or lastName)');
    });

    it('should reject non-string identifier', () => {
      const criteria = {
        identifier: 123
      } as any;

      const result: SearchValidationResult = validateSearchCriteria(criteria);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Identifier must be a string');
    });

    it('should reject empty identifier', () => {
      const criteria: SearchCriteria = {
        identifier: ''
      };

      const result: SearchValidationResult = validateSearchCriteria(criteria);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Identifier cannot be empty when provided');
    });

    it('should reject identifier exceeding 255 characters', () => {
      const criteria: SearchCriteria = {
        identifier: 'a'.repeat(256)
      };

      const result: SearchValidationResult = validateSearchCriteria(criteria);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Identifier cannot exceed 255 characters');
    });

    it('should reject non-string firstName', () => {
      const criteria = {
        firstName: 123
      } as any;

      const result: SearchValidationResult = validateSearchCriteria(criteria);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('FirstName must be a string');
    });

    it('should reject empty firstName', () => {
      const criteria: SearchCriteria = {
        firstName: ''
      };

      const result: SearchValidationResult = validateSearchCriteria(criteria);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('FirstName cannot be empty when provided');
    });

    it('should reject firstName exceeding 100 characters', () => {
      const criteria: SearchCriteria = {
        firstName: 'a'.repeat(101)
      };

      const result: SearchValidationResult = validateSearchCriteria(criteria);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('FirstName cannot exceed 100 characters');
    });

    it('should reject non-string lastName', () => {
      const criteria = {
        lastName: 123
      } as any;

      const result: SearchValidationResult = validateSearchCriteria(criteria);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('LastName must be a string');
    });

    it('should reject empty lastName', () => {
      const criteria: SearchCriteria = {
        lastName: ''
      };

      const result: SearchValidationResult = validateSearchCriteria(criteria);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('LastName cannot be empty when provided');
    });

    it('should reject lastName exceeding 100 characters', () => {
      const criteria: SearchCriteria = {
        lastName: 'a'.repeat(101)
      };

      const result: SearchValidationResult = validateSearchCriteria(criteria);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('LastName cannot exceed 100 characters');
    });

    it('should collect multiple validation errors', () => {
      const criteria = {
        identifier: '',
        firstName: 123,
        lastName: 'a'.repeat(101)
      } as any;

      const result: SearchValidationResult = validateSearchCriteria(criteria);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors).toContain('Identifier cannot be empty when provided');
      expect(result.errors).toContain('FirstName must be a string');
      expect(result.errors).toContain('LastName cannot exceed 100 characters');
    });

    it('should handle whitespace-only fields as empty', () => {
      const criteria: SearchCriteria = {
        identifier: '   ',
        firstName: '\t\n',
        lastName: '  '
      };

      const result: SearchValidationResult = validateSearchCriteria(criteria);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Identifier cannot be empty when provided');
      expect(result.errors).toContain('FirstName cannot be empty when provided');
      expect(result.errors).toContain('LastName cannot be empty when provided');
    });
  });

  describe('sanitizeSearchCriteria', () => {
    it('should trim whitespace from all fields', () => {
      const criteria: SearchCriteria = {
        identifier: '  test-account  ',
        firstName: '  John  ',
        lastName: '  Doe  '
      };

      const result = sanitizeSearchCriteria(criteria);

      expect(result.identifier).toBe('test-account');
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
    });

    it('should remove empty string fields after trimming', () => {
      const criteria: SearchCriteria = {
        identifier: 'test-account',
        firstName: '   ',
        lastName: ''
      };

      const result = sanitizeSearchCriteria(criteria);

      expect(result.identifier).toBe('test-account');
      expect(result.firstName).toBeUndefined();
      expect(result.lastName).toBeUndefined();
    });

    it('should handle undefined fields', () => {
      const criteria: SearchCriteria = {
        identifier: 'test-account'
      };

      const result = sanitizeSearchCriteria(criteria);

      expect(result.identifier).toBe('test-account');
      expect(result.firstName).toBeUndefined();
      expect(result.lastName).toBeUndefined();
    });

    it('should return empty object when all fields are empty or whitespace', () => {
      const criteria: SearchCriteria = {
        identifier: '   ',
        firstName: '',
        lastName: '\t\n'
      };

      const result = sanitizeSearchCriteria(criteria);

      expect(result).toEqual({});
    });

    it('should handle empty input object', () => {
      const criteria: SearchCriteria = {};

      const result = sanitizeSearchCriteria(criteria);

      expect(result).toEqual({});
    });

    it('should preserve valid fields while removing invalid ones', () => {
      const criteria: SearchCriteria = {
        identifier: '  valid-id  ',
        firstName: '',
        lastName: '  Valid Name  '
      };

      const result = sanitizeSearchCriteria(criteria);

      expect(result.identifier).toBe('valid-id');
      expect(result.firstName).toBeUndefined();
      expect(result.lastName).toBe('Valid Name');
    });
  });
});