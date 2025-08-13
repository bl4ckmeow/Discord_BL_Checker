import { config } from 'dotenv';

// Load environment variables from .env file
config();

export interface EnvironmentVariables {
  DISCORD_TOKEN: string;
  MYSQL_URL: string;
  ADMIN_ROLE_ID: string;
  NODE_ENV: 'development' | 'production' | 'test';
}

export class EnvironmentConfig {
  private static instance: EnvironmentConfig;
  private config: EnvironmentVariables;

  private constructor() {
    this.config = this.loadAndValidateConfig();
  }

  public static getInstance(): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = new EnvironmentConfig();
    }
    return EnvironmentConfig.instance;
  }

  private loadAndValidateConfig(): EnvironmentVariables {
    const requiredVars = ['DISCORD_TOKEN', 'MYSQL_URL', 'ADMIN_ROLE_ID'];
    const missingVars: string[] = [];

    // Check for missing required variables
    for (const varName of requiredVars) {
      if (!process.env[varName] || process.env[varName]?.trim() === '') {
        missingVars.push(varName);
      }
    }

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(', ')}. ` +
        'Please check your .env file and ensure all required variables are set.'
      );
    }

    // Validate NODE_ENV
    const nodeEnv = process.env['NODE_ENV'] || 'development';
    if (!['development', 'production', 'test'].includes(nodeEnv)) {
      throw new Error(
        `Invalid NODE_ENV value: ${nodeEnv}. Must be one of: development, production, test`
      );
    }

    // Validate DISCORD_TOKEN format (basic check)
    const discordToken = process.env['DISCORD_TOKEN']!;
    if (discordToken.length < 50) {
      throw new Error('DISCORD_TOKEN appears to be invalid (too short)');
    }

    // Validate MYSQL_URL format
    const mysqlUrl = process.env['MYSQL_URL']!;
    if (!mysqlUrl.startsWith('mysql://')) {
      throw new Error('MYSQL_URL must start with mysql://');
    }

    // Validate ADMIN_ROLE_ID format (Discord snowflake)
    const adminRoleId = process.env['ADMIN_ROLE_ID']!;
    if (!/^\d{17,19}$/.test(adminRoleId)) {
      throw new Error('ADMIN_ROLE_ID must be a valid Discord role ID (17-19 digits)');
    }

    return {
      DISCORD_TOKEN: discordToken,
      MYSQL_URL: mysqlUrl,
      ADMIN_ROLE_ID: adminRoleId,
      NODE_ENV: nodeEnv as 'development' | 'production' | 'test'
    };
  }

  public get discordToken(): string {
    return this.config.DISCORD_TOKEN;
  }

  public get mysqlUrl(): string {
    return this.config.MYSQL_URL;
  }

  public get adminRoleId(): string {
    return this.config.ADMIN_ROLE_ID;
  }

  public get nodeEnv(): string {
    return this.config.NODE_ENV;
  }

  public get isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }

  public get isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  public get isTest(): boolean {
    return this.config.NODE_ENV === 'test';
  }

  public getAllConfig(): Readonly<EnvironmentVariables> {
    return { ...this.config };
  }
}