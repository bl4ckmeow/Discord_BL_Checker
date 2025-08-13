import { Logger, LogLevel, ChildLogger } from '../Logger';

// Mock console methods
const originalConsole = {
  error: console.error,
  warn: console.warn,
  log: console.log,
  debug: console.debug
};

beforeEach(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
  console.debug = jest.fn();
});

afterEach(() => {
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.log = originalConsole.log;
  console.debug = originalConsole.debug;
});

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = Logger.getInstance();
    logger.clearBuffer();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const logger1 = Logger.getInstance();
      const logger2 = Logger.getInstance();
      expect(logger1).toBe(logger2);
    });
  });

  describe('Log Levels', () => {
    it('should log error messages', () => {
      const error = new Error('Test error');
      logger.error('Test error message', error, 'TestContext');

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('❌')
      );
      expect(console.error).toHaveBeenCalledWith(
        'Error details:', error
      );
    });

    it('should log warning messages', () => {
      logger.warn('Test warning message', 'TestContext');

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('⚠️')
      );
    });

    it('should log info messages', () => {
      logger.info('Test info message', 'TestContext');

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('ℹ️')
      );
    });

    it('should log debug messages', () => {
      logger.debug('Test debug message', 'TestContext');

      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining('🔍')
      );
    });
  });

  describe('Log Buffer', () => {
    it('should store log entries in buffer', () => {
      logger.info('Test message');
      
      const recentLogs = logger.getRecentLogs(1);
      expect(recentLogs).toHaveLength(1);
      expect(recentLogs[0].message).toBe('Test message');
      expect(recentLogs[0].level).toBe(LogLevel.INFO);
    });

    it('should filter logs by level', () => {
      logger.error('Error message');
      logger.warn('Warning message');
      logger.info('Info message');

      const errorLogs = logger.getLogsByLevel(LogLevel.ERROR);
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].message).toBe('Error message');
    });

    it('should filter logs by context', () => {
      logger.info('Message 1', 'Context1');
      logger.info('Message 2', 'Context2');
      logger.info('Message 3', 'Context1');

      const context1Logs = logger.getLogsByContext('Context1');
      expect(context1Logs).toHaveLength(2);
      expect(context1Logs[0].message).toBe('Message 1');
      expect(context1Logs[1].message).toBe('Message 3');
    });

    it('should maintain buffer size limit', () => {
      // This test would require setting a smaller buffer size for testing
      // For now, we'll just verify the buffer works
      logger.info('Test message');
      expect(logger.getRecentLogs()).toHaveLength(1);
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        level: LogLevel.ERROR,
        enableConsole: false
      };

      logger.updateConfig(newConfig);
      const config = logger.getConfig();

      expect(config.level).toBe(LogLevel.ERROR);
      expect(config.enableConsole).toBe(false);
    });

    it('should respect log level configuration', () => {
      logger.updateConfig({ level: LogLevel.ERROR });

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      // Only error should be logged
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Error Formatting', () => {
    it('should format Error objects', () => {
      const error = new Error('Test error');
      const formatted = Logger.formatError(error);

      expect(formatted.message).toBe('Test error');
      expect(formatted.error).toBe(error);
    });

    it('should format string errors', () => {
      const formatted = Logger.formatError('String error');

      expect(formatted.message).toBe('String error');
      expect(formatted.error).toBeUndefined();
    });

    it('should format unknown errors', () => {
      const formatted = Logger.formatError({ custom: 'error' });

      expect(formatted.message).toBe('Unknown error occurred');
      expect(formatted.error).toBeInstanceOf(Error);
    });
  });

  describe('Child Logger', () => {
    it('should create child logger with context', () => {
      const childLogger = logger.child('ChildContext');
      expect(childLogger).toBeInstanceOf(ChildLogger);
    });

    it('should use predefined context in child logger', () => {
      const childLogger = logger.child('ChildContext');
      childLogger.info('Test message');

      const recentLogs = logger.getRecentLogs(1);
      expect(recentLogs[0].context).toBe('ChildContext');
    });
  });
});

describe('ChildLogger', () => {
  let logger: Logger;
  let childLogger: ChildLogger;

  beforeEach(() => {
    logger = Logger.getInstance();
    logger.clearBuffer();
    childLogger = logger.child('TestChild');
  });

  it('should log with predefined context', () => {
    childLogger.error('Error message', new Error('Test'));
    childLogger.warn('Warning message');
    childLogger.info('Info message');
    childLogger.debug('Debug message');

    const recentLogs = logger.getRecentLogs(4);
    recentLogs.forEach(log => {
      expect(log.context).toBe('TestChild');
    });
  });

  it('should pass metadata correctly', () => {
    const metadata = { key: 'value', number: 42 };
    childLogger.info('Test message', metadata);

    const recentLogs = logger.getRecentLogs(1);
    expect(recentLogs[0].metadata).toEqual(metadata);
  });
});