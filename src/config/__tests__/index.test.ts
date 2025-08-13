import { initializeConfig, getConfig } from '../index';

describe('Config Index', () => {
  const originalEnv = process.env;
  const originalExit = process.exit;
  const originalConsoleError = console.error;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.exit = jest.fn() as any;
    console.error = jest.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
    process.exit = originalExit;
    console.error = originalConsoleError;
  });

  describe('initializeConfig', () => {
    it('should return config instance when environment is valid', () => {
      process.env.DISCORD_TOKEN = 'valid_discord_token_that_is_long_enough_to_pass_validation';
      process.env.MYSQL_URL = 'mysql://user:pass@localhost:3306/db';
      process.env.ADMIN_ROLE_ID = '123456789012345678';
      process.env.NODE_ENV = 'development';

      const config = initializeConfig();

      expect(config).toBeDefined();
      expect(config.discordToken).toBe('valid_discord_token_that_is_long_enough_to_pass_validation');
    });

    it('should exit process when configuration is invalid', () => {
      delete process.env.DISCORD_TOKEN;
      process.env.MYSQL_URL = 'mysql://user:pass@localhost:3306/db';
      process.env.ADMIN_ROLE_ID = '123456789012345678';

      initializeConfig();

      expect(console.error).toHaveBeenCalledWith(
        '❌ Configuration Error:',
        'Missing required environment variables: DISCORD_TOKEN. Please check your .env file and ensure all required variables are set.'
      );
      expect(console.error).toHaveBeenCalledWith(
        'Please check your .env file and ensure all required variables are set.'
      );
      expect(console.error).toHaveBeenCalledWith('See .env.example for reference.');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('getConfig', () => {
    it('should return the same instance as initializeConfig', () => {
      process.env.DISCORD_TOKEN = 'valid_discord_token_that_is_long_enough_to_pass_validation';
      process.env.MYSQL_URL = 'mysql://user:pass@localhost:3306/db';
      process.env.ADMIN_ROLE_ID = '123456789012345678';
      process.env.NODE_ENV = 'development';

      const config1 = initializeConfig();
      const config2 = getConfig();

      expect(config1).toBe(config2);
    });
  });
});