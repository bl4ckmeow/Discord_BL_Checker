import { EnvironmentConfig } from '../environment';

describe('EnvironmentConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('loadAndValidateConfig', () => {
    it('should throw error when DISCORD_TOKEN is missing', () => {
      delete process.env.DISCORD_TOKEN;
      process.env.MYSQL_URL = 'mysql://user:pass@localhost:3306/db';
      process.env.ADMIN_ROLE_ID = '123456789012345678';

      expect(() => {
        // Reset singleton instance
        (EnvironmentConfig as any).instance = undefined;
        EnvironmentConfig.getInstance();
      }).toThrow('Missing required environment variables: DISCORD_TOKEN');
    });

    it('should throw error when MYSQL_URL is missing', () => {
      process.env.DISCORD_TOKEN = 'valid_discord_token_that_is_long_enough_to_pass_validation';
      delete process.env.MYSQL_URL;
      process.env.ADMIN_ROLE_ID = '123456789012345678';

      expect(() => {
        (EnvironmentConfig as any).instance = undefined;
        EnvironmentConfig.getInstance();
      }).toThrow('Missing required environment variables: MYSQL_URL');
    });

    it('should throw error when ADMIN_ROLE_ID is missing', () => {
      process.env.DISCORD_TOKEN = 'valid_discord_token_that_is_long_enough_to_pass_validation';
      process.env.MYSQL_URL = 'mysql://user:pass@localhost:3306/db';
      delete process.env.ADMIN_ROLE_ID;

      expect(() => {
        (EnvironmentConfig as any).instance = undefined;
        EnvironmentConfig.getInstance();
      }).toThrow('Missing required environment variables: ADMIN_ROLE_ID');
    });

    it('should throw error when multiple variables are missing', () => {
      delete process.env.DISCORD_TOKEN;
      delete process.env.MYSQL_URL;
      process.env.ADMIN_ROLE_ID = '123456789012345678';

      expect(() => {
        (EnvironmentConfig as any).instance = undefined;
        EnvironmentConfig.getInstance();
      }).toThrow('Missing required environment variables: DISCORD_TOKEN, MYSQL_URL');
    });

    it('should throw error for invalid NODE_ENV', () => {
      process.env.DISCORD_TOKEN = 'valid_discord_token_that_is_long_enough_to_pass_validation';
      process.env.MYSQL_URL = 'mysql://user:pass@localhost:3306/db';
      process.env.ADMIN_ROLE_ID = '123456789012345678';
      process.env.NODE_ENV = 'invalid';

      expect(() => {
        (EnvironmentConfig as any).instance = undefined;
        EnvironmentConfig.getInstance();
      }).toThrow('Invalid NODE_ENV value: invalid');
    });

    it('should throw error for invalid DISCORD_TOKEN format', () => {
      process.env.DISCORD_TOKEN = 'short';
      process.env.MYSQL_URL = 'mysql://user:pass@localhost:3306/db';
      process.env.ADMIN_ROLE_ID = '123456789012345678';

      expect(() => {
        (EnvironmentConfig as any).instance = undefined;
        EnvironmentConfig.getInstance();
      }).toThrow('DISCORD_TOKEN appears to be invalid (too short)');
    });

    it('should throw error for invalid MYSQL_URL format', () => {
      process.env.DISCORD_TOKEN = 'valid_discord_token_that_is_long_enough_to_pass_validation';
      process.env.MYSQL_URL = 'invalid://user:pass@localhost:3306/db';
      process.env.ADMIN_ROLE_ID = '123456789012345678';

      expect(() => {
        (EnvironmentConfig as any).instance = undefined;
        EnvironmentConfig.getInstance();
      }).toThrow('MYSQL_URL must start with mysql://');
    });

    it('should throw error for invalid ADMIN_ROLE_ID format', () => {
      process.env.DISCORD_TOKEN = 'valid_discord_token_that_is_long_enough_to_pass_validation';
      process.env.MYSQL_URL = 'mysql://user:pass@localhost:3306/db';
      process.env.ADMIN_ROLE_ID = 'invalid';

      expect(() => {
        (EnvironmentConfig as any).instance = undefined;
        EnvironmentConfig.getInstance();
      }).toThrow('ADMIN_ROLE_ID must be a valid Discord role ID');
    });

    it('should successfully load valid configuration', () => {
      process.env.DISCORD_TOKEN = 'valid_discord_token_that_is_long_enough_to_pass_validation';
      process.env.MYSQL_URL = 'mysql://user:pass@localhost:3306/db';
      process.env.ADMIN_ROLE_ID = '123456789012345678';
      process.env.NODE_ENV = 'development';

      (EnvironmentConfig as any).instance = undefined;
      const config = EnvironmentConfig.getInstance();

      expect(config.discordToken).toBe('valid_discord_token_that_is_long_enough_to_pass_validation');
      expect(config.mysqlUrl).toBe('mysql://user:pass@localhost:3306/db');
      expect(config.adminRoleId).toBe('123456789012345678');
      expect(config.nodeEnv).toBe('development');
      expect(config.isDevelopment).toBe(true);
      expect(config.isProduction).toBe(false);
      expect(config.isTest).toBe(false);
    });

    it('should default NODE_ENV to development when not set', () => {
      process.env.DISCORD_TOKEN = 'valid_discord_token_that_is_long_enough_to_pass_validation';
      process.env.MYSQL_URL = 'mysql://user:pass@localhost:3306/db';
      process.env.ADMIN_ROLE_ID = '123456789012345678';
      delete process.env.NODE_ENV;

      (EnvironmentConfig as any).instance = undefined;
      const config = EnvironmentConfig.getInstance();

      expect(config.nodeEnv).toBe('development');
      expect(config.isDevelopment).toBe(true);
    });
  });

  describe('singleton behavior', () => {
    it('should return the same instance on multiple calls', () => {
      process.env.DISCORD_TOKEN = 'valid_discord_token_that_is_long_enough_to_pass_validation';
      process.env.MYSQL_URL = 'mysql://user:pass@localhost:3306/db';
      process.env.ADMIN_ROLE_ID = '123456789012345678';

      (EnvironmentConfig as any).instance = undefined;
      const config1 = EnvironmentConfig.getInstance();
      const config2 = EnvironmentConfig.getInstance();

      expect(config1).toBe(config2);
    });
  });
});