import {
  CreateBlacklistEntryInput,
  validateBlacklistEntry,
  sanitizeBlacklistEntryInput,
  ValidationResult
} from '../BlacklistEntry';

describe('BlacklistEntry', () => {
  describe('validateBlacklistEntry', () => {
    it('should validate a valid blacklist entry input', () => {
      const input: CreateBlacklistEntryInput = {
        identifier: 'test-account-123',
        firstName: 'John',
        lastName: 'Doe',
        createdBy: '123456789012345678'
      };

      const result: ValidationResult = validateBlacklistEntry(input);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a minimal valid input with only required fields', () => {
      const input: CreateBlacklistEntryInput = {
        identifier: 'test-account',
        createdBy: '123456789012345678'
      };

      const result: ValidationResult = validateBlacklistEntry(input);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject input with empty identifier', () => {
      const input: CreateBlacklistEntryInput = {
        identifier: '',
        createdBy: '123456789012345678'
      };

      const result: ValidationResult = validateBlacklistEntry(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Identifier cannot be empty');
    });

    it('should reject input with undefined identifier', () => {
      const input = {
        createdBy: '123456789012345678'
      } as CreateBlacklistEntryInput;

      const result: ValidationResult = validateBlacklistEntry(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Identifier is required and must be a string');
    });

    it('should reject input with non-string identifier', () => {
      const input = {
        identifier: 123,
        createdBy: '123456789012345678'
      } as any;

      const result: ValidationResult = validateBlacklistEntry(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Identifier is required and must be a string');
    });

    it('should reject input with identifier exceeding 255 characters', () => {
      const input: CreateBlacklistEntryInput = {
        identifier: 'a'.repeat(256),
        createdBy: '123456789012345678'
      };

      const result: ValidationResult = validateBlacklistEntry(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Identifier cannot exceed 255 characters');
    });

    it('should reject input with empty createdBy', () => {
      const input: CreateBlacklistEntryInput = {
        identifier: 'test-account',
        createdBy: ''
      };

      const result: ValidationResult = validateBlacklistEntry(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('CreatedBy cannot be empty');
    });

    it('should reject input with undefined createdBy', () => {
      const input = {
        identifier: 'test-account'
      } as CreateBlacklistEntryInput;

      const result: ValidationResult = validateBlacklistEntry(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('CreatedBy is required and must be a string');
    });

    it('should reject input with createdBy exceeding 20 characters', () => {
      const input: CreateBlacklistEntryInput = {
        identifier: 'test-account',
        createdBy: '123456789012345678901'
      };

      const result: ValidationResult = validateBlacklistEntry(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('CreatedBy cannot exceed 20 characters');
    });

    it('should reject input with non-string firstName', () => {
      const input = {
        identifier: 'test-account',
        firstName: 123,
        createdBy: '123456789012345678'
      } as any;

      const result: ValidationResult = validateBlacklistEntry(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('FirstName must be a string');
    });

    it('should reject input with firstName exceeding 100 characters', () => {
      const input: CreateBlacklistEntryInput = {
        identifier: 'test-account',
        firstName: 'a'.repeat(101),
        createdBy: '123456789012345678'
      };

      const result: ValidationResult = validateBlacklistEntry(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('FirstName cannot exceed 100 characters');
    });

    it('should reject input with non-string lastName', () => {
      const input = {
        identifier: 'test-account',
        lastName: 123,
        createdBy: '123456789012345678'
      } as any;

      const result: ValidationResult = validateBlacklistEntry(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('LastName must be a string');
    });

    it('should reject input with lastName exceeding 100 characters', () => {
      const input: CreateBlacklistEntryInput = {
        identifier: 'test-account',
        lastName: 'a'.repeat(101),
        createdBy: '123456789012345678'
      };

      const result: ValidationResult = validateBlacklistEntry(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('LastName cannot exceed 100 characters');
    });

    it('should collect multiple validation errors', () => {
      const input = {
        identifier: '',
        firstName: 123,
        lastName: 'a'.repeat(101),
        createdBy: ''
      } as any;

      const result: ValidationResult = validateBlacklistEntry(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(4);
      expect(result.errors).toContain('Identifier cannot be empty');
      expect(result.errors).toContain('FirstName must be a string');
      expect(result.errors).toContain('LastName cannot exceed 100 characters');
      expect(result.errors).toContain('CreatedBy cannot be empty');
    });
  });

  describe('sanitizeBlacklistEntryInput', () => {
    it('should trim whitespace from all string fields', () => {
      const input: CreateBlacklistEntryInput = {
        identifier: '  test-account  ',
        firstName: '  John  ',
        lastName: '  Doe  ',
        createdBy: '  123456789012345678  '
      };

      const result = sanitizeBlacklistEntryInput(input);

      expect(result.identifier).toBe('test-account');
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
      expect(result.createdBy).toBe('123456789012345678');
    });

    it('should handle undefined optional fields', () => {
      const input: CreateBlacklistEntryInput = {
        identifier: '  test-account  ',
        createdBy: '  123456789012345678  '
      };

      const result = sanitizeBlacklistEntryInput(input);

      expect(result.identifier).toBe('test-account');
      expect(result.firstName).toBeUndefined();
      expect(result.lastName).toBeUndefined();
      expect(result.createdBy).toBe('123456789012345678');
    });

    it('should convert empty strings to undefined for optional fields', () => {
      const input: CreateBlacklistEntryInput = {
        identifier: 'test-account',
        firstName: '   ',
        lastName: '',
        createdBy: '123456789012345678'
      };

      const result = sanitizeBlacklistEntryInput(input);

      expect(result.identifier).toBe('test-account');
      expect(result.firstName).toBeUndefined();
      expect(result.lastName).toBeUndefined();
      expect(result.createdBy).toBe('123456789012345678');
    });

    it('should handle missing properties gracefully', () => {
      const input = {
        createdBy: '123456789012345678'
      } as CreateBlacklistEntryInput;

      const result = sanitizeBlacklistEntryInput(input);

      expect(result.identifier).toBe('');
      expect(result.firstName).toBeUndefined();
      expect(result.lastName).toBeUndefined();
      expect(result.createdBy).toBe('123456789012345678');
    });
  });
});