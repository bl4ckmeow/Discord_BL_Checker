import { logger } from './Logger';

/**
 * Error types for categorizing different kinds of errors
 */
export enum ErrorType {
  VALIDATION = 'VALIDATION',
  DATABASE = 'DATABASE',
  PERMISSION = 'PERMISSION',
  DISCORD_API = 'DISCORD_API',
  NETWORK = 'NETWORK',
  CONFIGURATION = 'CONFIGURATION',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Structured error information
 */
export interface ErrorInfo {
  type: ErrorType;
  severity: ErrorSeverity;
  userMessage: string;
  technicalMessage: string;
  code?: string;
  retryable: boolean;
  context?: string;
  metadata?: Record<string, any>;
}

/**
 * Error handling result
 */
export interface ErrorHandlingResult {
  userMessage: string;
  shouldRetry: boolean;
  logLevel: 'error' | 'warn' | 'info';
  context?: string;
}

/**
 * Comprehensive error handler for user-friendly error messages
 * Requirements: 4.2, 4.3, 5.2
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorPatterns: Map<RegExp, ErrorInfo> = new Map();

  private constructor() {
    this.initializeErrorPatterns();
  }

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Initialize common error patterns and their user-friendly messages
   * Requirement 4.2: User-friendly error messages for Discord responses
   */
  private initializeErrorPatterns(): void {
    // Database connection errors
    this.errorPatterns.set(
      /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|connection.*refused/i,
      {
        type: ErrorType.DATABASE,
        severity: ErrorSeverity.HIGH,
        userMessage: 'ระบบฐานข้อมูลไม่สามารถเชื่อมต่อได้ในขณะนี้ กรุณาลองใหม่อีกครั้งในภายหลัง',
        technicalMessage: 'Database connection failed',
        retryable: true
      }
    );

    // Database timeout errors
    this.errorPatterns.set(
      /timeout|query.*timeout/i,
      {
        type: ErrorType.DATABASE,
        severity: ErrorSeverity.MEDIUM,
        userMessage: 'การดำเนินการใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง',
        technicalMessage: 'Database operation timeout',
        retryable: true
      }
    );

    // Duplicate entry errors
    this.errorPatterns.set(
      /duplicate.*entry|already.*exists/i,
      {
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.LOW,
        userMessage: 'ข้อมูลนี้มีอยู่ในระบบแล้ว',
        technicalMessage: 'Duplicate entry detected',
        retryable: false
      }
    );

    // Validation errors
    this.errorPatterns.set(
      /validation.*failed|invalid.*input|required.*field/i,
      {
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.LOW,
        userMessage: 'ข้อมูลที่ป้อนไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่',
        technicalMessage: 'Input validation failed',
        retryable: false
      }
    );

    // Permission errors
    this.errorPatterns.set(
      /permission.*denied|access.*denied|unauthorized/i,
      {
        type: ErrorType.PERMISSION,
        severity: ErrorSeverity.MEDIUM,
        userMessage: 'คุณไม่มีสิทธิ์ในการดำเนินการนี้',
        technicalMessage: 'Permission denied',
        retryable: false
      }
    );

    // Discord API errors
    this.errorPatterns.set(
      /discord.*api|rate.*limit|interaction.*failed/i,
      {
        type: ErrorType.DISCORD_API,
        severity: ErrorSeverity.MEDIUM,
        userMessage: 'เกิดข้อผิดพลาดกับ Discord กรุณาลองใหม่อีกครั้ง',
        technicalMessage: 'Discord API error',
        retryable: true
      }
    );

    // Network errors
    this.errorPatterns.set(
      /network.*error|connection.*lost|socket.*hang/i,
      {
        type: ErrorType.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        userMessage: 'เกิดข้อผิดพลาดเครือข่าย กรุณาลองใหม่อีกครั้ง',
        technicalMessage: 'Network error',
        retryable: true
      }
    );

    // Configuration errors
    this.errorPatterns.set(
      /missing.*environment|configuration.*error|invalid.*config/i,
      {
        type: ErrorType.CONFIGURATION,
        severity: ErrorSeverity.CRITICAL,
        userMessage: 'เกิดข้อผิดพลาดในการตั้งค่าระบบ กรุณาติดต่อผู้ดูแลระบบ',
        technicalMessage: 'Configuration error',
        retryable: false
      }
    );
  }

  /**
   * Handle and categorize errors with user-friendly messages
   * Requirements: 4.2, 4.3, 5.2
   */
  handleError(error: unknown, context?: string, metadata?: Record<string, any>): ErrorHandlingResult {
    const errorInfo = this.categorizeError(error);
    
    // Add context and metadata
    if (context) {
      errorInfo.context = context;
    }
    if (metadata) {
      errorInfo.metadata = { ...errorInfo.metadata, ...metadata };
    }

    // Log the error appropriately
    this.logError(errorInfo, error);

    return {
      userMessage: errorInfo.userMessage,
      shouldRetry: errorInfo.retryable,
      logLevel: this.getLogLevel(errorInfo.severity),
      ...(errorInfo.context !== undefined && { context: errorInfo.context })
    };
  }

  /**
   * Categorize error based on patterns and content
   */
  private categorizeError(error: unknown): ErrorInfo {
    const errorMessage = this.extractErrorMessage(error);
    
    // Check against known patterns
    for (const [pattern, errorInfo] of this.errorPatterns) {
      if (pattern.test(errorMessage)) {
        return { ...errorInfo };
      }
    }

    // Default unknown error
    return {
      type: ErrorType.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      userMessage: 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง',
      technicalMessage: errorMessage,
      retryable: true
    };
  }

  /**
   * Extract error message from various error types
   */
  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    } else if (typeof error === 'string') {
      return error;
    } else if (error && typeof error === 'object') {
      return JSON.stringify(error);
    } else {
      return 'Unknown error';
    }
  }

  /**
   * Log error with appropriate level and context
   */
  private logError(errorInfo: ErrorInfo, originalError: unknown): void {
    const logLevel = this.getLogLevel(errorInfo.severity);
    const context = errorInfo.context || 'ErrorHandler';
    
    const metadata = {
      type: errorInfo.type,
      severity: errorInfo.severity,
      retryable: errorInfo.retryable,
      code: errorInfo.code,
      ...errorInfo.metadata
    };

    switch (logLevel) {
      case 'error':
        logger.error(
          errorInfo.technicalMessage,
          originalError instanceof Error ? originalError : undefined,
          context,
          metadata
        );
        break;
      case 'warn':
        logger.warn(errorInfo.technicalMessage, context, metadata);
        break;
      case 'info':
        logger.info(errorInfo.technicalMessage, context, metadata);
        break;
    }
  }

  /**
   * Get appropriate log level based on error severity
   */
  private getLogLevel(severity: ErrorSeverity): 'error' | 'warn' | 'info' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.LOW:
        return 'info';
      default:
        return 'error';
    }
  }

  /**
   * Handle database-specific errors with retry logic
   * Requirement 4.3: Graceful error recovery for connection failures
   */
  handleDatabaseError(error: unknown, operation: string, context?: string): ErrorHandlingResult {
    const result = this.handleError(error, context || 'Database', { operation });
    
    // Add specific database error handling
    if (result.shouldRetry) {
      logger.info(`Database operation '${operation}' will be retried`, context, { 
        operation,
        retryable: true 
      });
    }

    return result;
  }

  /**
   * Handle Discord interaction errors
   * Requirement 4.2: User-friendly error messages for Discord responses
   */
  handleDiscordError(error: unknown, commandName: string, userId: string): ErrorHandlingResult {
    const result = this.handleError(error, 'Discord', { 
      command: commandName,
      userId 
    });

    // Ensure Discord-specific user messages are appropriate
    if (result.userMessage.includes('เกิดข้อผิดพลาดที่ไม่คาดคิด')) {
      result.userMessage = 'เกิดข้อผิดพลาดในการดำเนินการคำสั่ง กรุณาลองใหม่อีกครั้ง';
    }

    return result;
  }

  /**
   * Create a custom error info
   */
  createErrorInfo(
    type: ErrorType,
    severity: ErrorSeverity,
    userMessage: string,
    technicalMessage: string,
    retryable: boolean = false,
    code?: string
  ): ErrorInfo {
    return {
      type,
      severity,
      userMessage,
      technicalMessage,
      retryable,
      ...(code !== undefined && { code })
    };
  }

  /**
   * Add custom error pattern
   */
  addErrorPattern(pattern: RegExp, errorInfo: ErrorInfo): void {
    this.errorPatterns.set(pattern, errorInfo);
  }

  /**
   * Get error statistics
   */
  getErrorStats(): { type: ErrorType; count: number }[] {
    // This would require tracking errors over time
    // For now, return empty array as placeholder
    return [];
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();