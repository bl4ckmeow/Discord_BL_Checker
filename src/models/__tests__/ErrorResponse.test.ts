import {
  ErrorResponse,
  SuccessResponse,
  ApiResponse,
  ErrorCode,
  createErrorResponse,
  createSuccessResponse,
  isErrorResponse,
  isSuccessResponse
} from '../ErrorResponse';

describe('ErrorResponse', () => {
  describe('createErrorResponse', () => {
    it('should create error response without code', () => {
      const error = 'Something went wrong';
      const response = createErrorResponse(error);

      expect(response).toEqual({
        success: false,
        error: 'Something went wrong',
        code: undefined
      });
    });

    it('should create error response with code', () => {
      const error = 'Validation failed';
      const code = ErrorCode.VALIDATION_ERROR;
      const response = createErrorResponse(error, code);

      expect(response).toEqual({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR'
      });
    });

    it('should create error response with all error codes', () => {
      const errorCodes = [
        ErrorCode.VALIDATION_ERROR,
        ErrorCode.DATABASE_ERROR,
        ErrorCode.PERMISSION_DENIED,
        ErrorCode.NOT_FOUND,
        ErrorCode.DUPLICATE_ENTRY,
        ErrorCode.INTERNAL_ERROR,
        ErrorCode.DISCORD_API_ERROR
      ];

      errorCodes.forEach(code => {
        const response = createErrorResponse('Test error', code);
        expect(response.success).toBe(false);
        expect(response.error).toBe('Test error');
        expect(response.code).toBe(code);
      });
    });
  });

  describe('createSuccessResponse', () => {
    it('should create success response without data or message', () => {
      const response = createSuccessResponse();

      expect(response).toEqual({
        success: true,
        data: undefined,
        message: undefined
      });
    });

    it('should create success response with data only', () => {
      const data = { id: 1, name: 'Test' };
      const response = createSuccessResponse(data);

      expect(response).toEqual({
        success: true,
        data: { id: 1, name: 'Test' },
        message: undefined
      });
    });

    it('should create success response with message only', () => {
      const message = 'Operation completed successfully';
      const response = createSuccessResponse(undefined, message);

      expect(response).toEqual({
        success: true,
        data: undefined,
        message: 'Operation completed successfully'
      });
    });

    it('should create success response with both data and message', () => {
      const data = { id: 1, name: 'Test' };
      const message = 'User created successfully';
      const response = createSuccessResponse(data, message);

      expect(response).toEqual({
        success: true,
        data: { id: 1, name: 'Test' },
        message: 'User created successfully'
      });
    });

    it('should handle different data types', () => {
      // String data
      const stringResponse = createSuccessResponse('test string');
      expect(stringResponse.data).toBe('test string');

      // Number data
      const numberResponse = createSuccessResponse(42);
      expect(numberResponse.data).toBe(42);

      // Array data
      const arrayResponse = createSuccessResponse([1, 2, 3]);
      expect(arrayResponse.data).toEqual([1, 2, 3]);

      // Boolean data
      const booleanResponse = createSuccessResponse(true);
      expect(booleanResponse.data).toBe(true);
    });
  });

  describe('isErrorResponse', () => {
    it('should return true for error responses', () => {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Test error'
      };

      expect(isErrorResponse(errorResponse)).toBe(true);
    });

    it('should return false for success responses', () => {
      const successResponse: SuccessResponse = {
        success: true,
        data: 'test data'
      };

      expect(isErrorResponse(successResponse)).toBe(false);
    });

    it('should work with ApiResponse union type', () => {
      const responses: ApiResponse[] = [
        createErrorResponse('Error'),
        createSuccessResponse('Success')
      ];

      expect(isErrorResponse(responses[0]!)).toBe(true);
      expect(isErrorResponse(responses[1]!)).toBe(false);
    });
  });

  describe('isSuccessResponse', () => {
    it('should return true for success responses', () => {
      const successResponse: SuccessResponse = {
        success: true,
        data: 'test data'
      };

      expect(isSuccessResponse(successResponse)).toBe(true);
    });

    it('should return false for error responses', () => {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Test error'
      };

      expect(isSuccessResponse(errorResponse)).toBe(false);
    });

    it('should work with ApiResponse union type', () => {
      const responses: ApiResponse[] = [
        createErrorResponse('Error'),
        createSuccessResponse('Success')
      ];

      expect(isSuccessResponse(responses[0]!)).toBe(false);
      expect(isSuccessResponse(responses[1]!)).toBe(true);
    });

    it('should provide proper type narrowing', () => {
      const response: ApiResponse<string> = createSuccessResponse('test data');

      if (isSuccessResponse(response)) {
        // TypeScript should know this is a SuccessResponse<string>
        expect(response.success).toBe(true);
        expect(response.data).toBe('test data');
        // This should not cause TypeScript errors
        const data: string | undefined = response.data;
        expect(typeof data).toBe('string');
      }
    });
  });

  describe('ErrorCode enum', () => {
    it('should have all expected error codes', () => {
      expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ErrorCode.DATABASE_ERROR).toBe('DATABASE_ERROR');
      expect(ErrorCode.PERMISSION_DENIED).toBe('PERMISSION_DENIED');
      expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND');
      expect(ErrorCode.DUPLICATE_ENTRY).toBe('DUPLICATE_ENTRY');
      expect(ErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
      expect(ErrorCode.DISCORD_API_ERROR).toBe('DISCORD_API_ERROR');
    });

    it('should be usable in error responses', () => {
      Object.values(ErrorCode).forEach(code => {
        const response = createErrorResponse('Test error', code);
        expect(response.code).toBe(code);
      });
    });
  });

  describe('Type definitions', () => {
    it('should properly type ErrorResponse', () => {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Test error',
        code: ErrorCode.VALIDATION_ERROR
      };

      expect(errorResponse.success).toBe(false);
      expect(typeof errorResponse.error).toBe('string');
      expect(errorResponse.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should properly type SuccessResponse', () => {
      const successResponse: SuccessResponse<{ id: number }> = {
        success: true,
        data: { id: 1 },
        message: 'Success'
      };

      expect(successResponse.success).toBe(true);
      expect(successResponse.data?.id).toBe(1);
      expect(typeof successResponse.message).toBe('string');
    });

    it('should properly type ApiResponse union', () => {
      const responses: ApiResponse<string>[] = [
        { success: false, error: 'Error' },
        { success: true, data: 'Success' }
      ];

      responses.forEach(response => {
        if (response.success) {
          expect(typeof response.data).toBe('string');
        } else {
          expect(typeof response.error).toBe('string');
        }
      });
    });
  });
});