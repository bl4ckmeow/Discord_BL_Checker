import { EnvironmentConfig } from '../config/environment';

/**
 * Log levels for different types of messages
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

/**
 * Log entry interface
 */
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: string;
  error?: Error;
  metadata?: Record<string, any>;
}

/**
 * Logger configuration interface
 */
export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
  maxFileSize?: number;
  maxFiles?: number;
}

/**
 * Comprehensive logging system for debugging and monitoring
 * Requirements: 4.2, 4.3, 5.2
 */
export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private readonly maxBufferSize = 1000;

  private constructor() {
    const env = EnvironmentConfig.getInstance();
    
    this.config = {
      level: this.getLogLevelFromEnv(env.nodeEnv),
      enableConsole: true,
      enableFile: false, // Can be enabled later if needed
      filePath: 'logs/app.log',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    };
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Get log level based on environment
   */
  private getLogLevelFromEnv(nodeEnv: string): LogLevel {
    switch (nodeEnv.toLowerCase()) {
      case 'production':
        return LogLevel.WARN;
      case 'test':
        return LogLevel.ERROR;
      case 'development':
      default:
        return LogLevel.DEBUG;
    }
  }

  /**
   * Log an error message
   * Requirement 4.2: Comprehensive error handling for database operations
   */
  error(message: string, error?: Error, context?: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context, error, metadata);
  }

  /**
   * Log a warning message
   * Requirement 4.3: Graceful error recovery for connection failures
   */
  warn(message: string, context?: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context, undefined, metadata);
  }

  /**
   * Log an info message
   * Requirement 5.2: Logging system for debugging and monitoring
   */
  info(message: string, context?: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context, undefined, metadata);
  }

  /**
   * Log a debug message
   * Requirement 5.2: Logging system for debugging and monitoring
   */
  debug(message: string, context?: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context, undefined, metadata);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: string, error?: Error, metadata?: Record<string, any>): void {
    if (level > this.config.level) {
      return; // Skip logging if level is below configured threshold
    }

    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      ...(context !== undefined && { context }),
      ...(error !== undefined && { error }),
      ...(metadata !== undefined && { metadata })
    };

    // Add to buffer
    this.addToBuffer(logEntry);

    // Console logging
    if (this.config.enableConsole) {
      this.logToConsole(logEntry);
    }

    // File logging (if enabled)
    if (this.config.enableFile) {
      this.logToFile(logEntry);
    }
  }

  /**
   * Add log entry to buffer
   */
  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);
    
    // Maintain buffer size
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }
  }

  /**
   * Log to console with appropriate formatting
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const levelStr = LogLevel[entry.level].padEnd(5);
    const contextStr = entry.context ? `[${entry.context}]` : '';
    
    let logMessage = `${timestamp} ${levelStr} ${contextStr} ${entry.message}`;
    
    if (entry.metadata) {
      logMessage += ` | Metadata: ${JSON.stringify(entry.metadata)}`;
    }

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(`❌ ${logMessage}`);
        if (entry.error) {
          console.error('Error details:', entry.error);
          if (entry.error.stack) {
            console.error('Stack trace:', entry.error.stack);
          }
        }
        break;
      case LogLevel.WARN:
        console.warn(`⚠️ ${logMessage}`);
        break;
      case LogLevel.INFO:
        console.log(`ℹ️ ${logMessage}`);
        break;
      case LogLevel.DEBUG:
        console.debug(`🔍 ${logMessage}`);
        break;
    }
  }

  /**
   * Log to file (placeholder for future implementation)
   */
  private logToFile(_entry: LogEntry): void {
    // File logging implementation can be added here if needed
    // For now, we'll focus on console logging as it's more practical for Discord bots
  }

  /**
   * Get recent log entries
   */
  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel, count: number = 100): LogEntry[] {
    return this.logBuffer
      .filter(entry => entry.level === level)
      .slice(-count);
  }

  /**
   * Get logs by context
   */
  getLogsByContext(context: string, count: number = 100): LogEntry[] {
    return this.logBuffer
      .filter(entry => entry.context === context)
      .slice(-count);
  }

  /**
   * Clear log buffer
   */
  clearBuffer(): void {
    this.logBuffer = [];
  }

  /**
   * Update logger configuration
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Format error for logging
   */
  static formatError(error: unknown): { message: string; error?: Error } {
    if (error instanceof Error) {
      return {
        message: error.message,
        error
      };
    } else if (typeof error === 'string') {
      return {
        message: error
      };
    } else {
      return {
        message: 'Unknown error occurred',
        error: new Error(String(error))
      };
    }
  }

  /**
   * Create a child logger with context
   */
  child(context: string): ChildLogger {
    return new ChildLogger(this, context);
  }
}

/**
 * Child logger with predefined context
 */
export class ChildLogger {
  constructor(private parent: Logger, private context: string) {}

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.parent.error(message, error, this.context, metadata);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.parent.warn(message, this.context, metadata);
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.parent.info(message, this.context, metadata);
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.parent.debug(message, this.context, metadata);
  }
}

// Export singleton instance
export const logger = Logger.getInstance();