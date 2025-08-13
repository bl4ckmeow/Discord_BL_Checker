import { ErrorHandler, ErrorType, ErrorSeverity } from '../ErrorHandler';

// Mock the logger
jest.mock('../Logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = ErrorHandler.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const handler1 = ErrorHandler.getInstance();
      const handler2 = ErrorHandler.getInstance();
      expect(handler1).toBe(handler2);
    });
  });

  describe('Error Categorization', () => {
    it('should categorize database connection errors', () => {
      const error = new Error('ECONNREFUSED: Connection refused');
      const result = errorHandler.handleError(error);

      expect(result.userMessage).toContain('ระบบฐานข้อมูลไม่สามารถเชื่อมต่อได้');
      expect(result.shouldRetry).toBe(true);
      expect(result.logLevel).toBe('error');
    });

    it('should categorize timeout errors', () => {
      const error = new Error('Query timeout exceeded');
      const result = errorHandler.handleError(error);

      expect(result.userMessage).toContain('การดำเนินการใช้เวลานานเกินไป');
      expect(result.shouldRetry).toBe(true);
      expect(result.logLevel).toBe('warn');
    });

    it('should categorize duplicate entry errors', () => {
      const error = new Error('Duplicate entry detected');
      const result = errorHandler.handleError(error);

      expect(result.userMessage).toContain('ข้อมูลนี้มีอยู่ในระบบแล้ว');
      expect(result.shouldRetry).toBe(false);
      expect(result.logLevel).toBe('info');
    });

    it('should categorize validation errors', () => {
      const error = new Error('Validation failed: required field missing');
      const result = errorHandler.handleError(error);

      expect(result.userMessage).toContain('ข้อมูลที่ป้อนไม่ถูกต้อง');
      expect(result.shouldRetry).toBe(false);
      expect(result.logLevel).toBe('info');
    });

    it('should categorize permission errors', () => {
      const error = new Error('Permission denied for user');
      const result = errorHandler.handleError(error);

      expect(result.userMessage).toContain('คุณไม่มีสิทธิ์ในการดำเนินการนี้');
      expect(result.shouldRetry).toBe(false);
      expect(result.logLevel).toBe('warn');
    });

    it('should categorize Discord API errors', () => {
      const error = new Error('Discord API rate limit exceeded');
      const result = errorHandler.handleError(error);

      expect(result.userMessage).toContain('เกิดข้อผิดพลาดกับ Discord');
      expect(result.shouldRetry).toBe(true);
      expect(result.logLevel).toBe('warn');
    });

    it('should categorize network errors', () => {
      const error = new Error('Network error: connection lost');
      const result = errorHandler.handleError(error);

      expect(result.userMessage).toContain('เกิดข้อผิดพลาดเครือข่าย');
      expect(result.shouldRetry).toBe(true);
      expect(result.logLevel).toBe('warn');
    });

    it('should categorize configuration errors', () => {
      const error = new Error('Missing environment variable: DATABASE_URL');
      const result = errorHandler.handleError(error);

      expect(result.userMessage).toContain('เกิดข้อผิดพลาดในการตั้งค่าระบบ');
      expect(result.shouldRetry).toBe(false);
      expect(result.logLevel).toBe('error');
    });

    it('should handle unknown errors', () => {
      const error = new Error('Some unknown error occurred');
      const result = errorHandler.handleError(error);

      expect(result.userMessage).toContain('เกิดข้อผิดพลาดที่ไม่คาดคิด');
      expect(result.shouldRetry).toBe(true);
      expect(result.logLevel).toBe('warn');
    });
  });

  describe('Error Types', () => {
    it('should handle string errors', () => {
      const result = errorHandler.handleError('Simple string error');
      
      expect(result.userMessage).toBeDefined();
      expect(result.shouldRetry).toBeDefined();
      expect(result.logLevel).toBeDefined();
    });

    it('should handle non-Error objects', () => {
      const result = errorHandler.handleError({ message: 'Custom error object' });
      
      expect(result.userMessage).toBeDefined();
      expect(result.shouldRetry).toBeDefined();
      expect(result.logLevel).toBeDefined();
    });

    it('should handle null/undefined errors', () => {
      const result1 = errorHandler.handleError(null);
      const result2 = errorHandler.handleError(undefined);
      
      expect(result1.userMessage).toBeDefined();
      expect(result2.userMessage).toBeDefined();
    });
  });

  describe('Context and Metadata', () => {
    it('should include context in error handling', () => {
      const error = new Error('Test error');
      const result = errorHandler.handleError(error, 'TestContext');

      expect(result.context).toBe('TestContext');
    });

    it('should include metadata in error handling', () => {
      const error = new Error('Test error');
      const metadata = { userId: '123', operation: 'test' };
      const result = errorHandler.handleError(error, 'TestContext', metadata);

      expect(result.context).toBe('TestContext');
    });
  });

  describe('Specialized Error Handlers', () => {
    it('should handle database errors with operation context', () => {
      const error = new Error('Database connection failed');
      const result = errorHandler.handleDatabaseError(error, 'createUser', 'UserService');

      expect(result.shouldRetry).toBe(true);
      expect(result.context).toBe('UserService');
    });

    it('should handle Discord errors with command context', () => {
      const error = new Error('Discord interaction failed');
      const result = errorHandler.handleDiscordError(error, 'addbl', 'user123');

      expect(result.userMessage).toContain('เกิดข้อผิดพลาดในการดำเนินการคำสั่ง');
    });

    it('should customize unknown error messages for Discord', () => {
      const error = new Error('Some random error');
      const result = errorHandler.handleDiscordError(error, 'checkbl', 'user456');

      expect(result.userMessage).toContain('เกิดข้อผิดพลาดในการดำเนินการคำสั่ง');
    });
  });

  describe('Custom Error Info', () => {
    it('should create custom error info', () => {
      const errorInfo = errorHandler.createErrorInfo(
        ErrorType.VALIDATION,
        ErrorSeverity.LOW,
        'Custom user message',
        'Custom technical message',
        false,
        'CUSTOM_001'
      );

      expect(errorInfo.type).toBe(ErrorType.VALIDATION);
      expect(errorInfo.severity).toBe(ErrorSeverity.LOW);
      expect(errorInfo.userMessage).toBe('Custom user message');
      expect(errorInfo.technicalMessage).toBe('Custom technical message');
      expect(errorInfo.retryable).toBe(false);
      expect(errorInfo.code).toBe('CUSTOM_001');
    });

    it('should add custom error patterns', () => {
      const customPattern = /custom.*pattern/i;
      const customErrorInfo = errorHandler.createErrorInfo(
        ErrorType.UNKNOWN,
        ErrorSeverity.HIGH,
        'Custom pattern matched',
        'Custom pattern error',
        true
      );

      errorHandler.addErrorPattern(customPattern, customErrorInfo);

      const error = new Error('This is a custom pattern error');
      const result = errorHandler.handleError(error);

      expect(result.userMessage).toBe('Custom pattern matched');
      expect(result.shouldRetry).toBe(true);
    });
  });

  describe('Error Statistics', () => {
    it('should return error statistics', () => {
      const stats = errorHandler.getErrorStats();
      expect(Array.isArray(stats)).toBe(true);
      // Note: This is a placeholder implementation, so it returns empty array
      expect(stats).toHaveLength(0);
    });
  });
});