// Configuration management
export * from './environment';

import { EnvironmentConfig } from './environment';

/**
 * Initialize and validate environment configuration
 * This should be called at application startup
 * @throws Error if configuration is invalid or missing required variables
 */
export function initializeConfig(): EnvironmentConfig {
  try {
    return EnvironmentConfig.getInstance();
  } catch (error) {
    console.error('❌ Configuration Error:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Please check your .env file and ensure all required environment variables are set.');
    console.error('See .env.example for reference.');
    process.exit(1);
  }
}

/**
 * Get the current environment configuration instance
 * Note: This assumes initializeConfig() has been called first
 */
export function getConfig(): EnvironmentConfig {
  return EnvironmentConfig.getInstance();
}