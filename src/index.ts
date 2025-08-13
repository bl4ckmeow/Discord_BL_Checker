import { initializeConfig } from './config';
import { DiscordClient } from './bot/DiscordClient';
import { logger } from './utils/Logger';
import { errorHandler } from './utils/ErrorHandler';

/**
 * Main application entry point
 * Requirements: 4.1, 5.1, 5.5
 */
async function main(): Promise<void> {
  const mainLogger = logger.child('Main');
  
  try {
    mainLogger.info('Discord Blacklist Bot starting...');

    // Initialize and validate configuration (Requirement 5.1, 5.5)
    mainLogger.info('Loading configuration...');
    const config = initializeConfig();
    mainLogger.info('Configuration loaded successfully');

    // Initialize Discord client (Requirement 4.1)
    mainLogger.info('Initializing Discord client...');
    const discordClient = new DiscordClient(config);

    // Start the bot (Requirement 4.1)
    await discordClient.start();

    mainLogger.info('Discord Blacklist Bot started successfully!');
    mainLogger.info('Bot is now online and ready to handle commands');

  } catch (error) {
    errorHandler.handleError(error, 'Main.startup');
    mainLogger.error('Failed to start Discord Blacklist Bot', error instanceof Error ? error : undefined);
    
    if (error instanceof Error) {
      // Provide helpful error messages for common issues
      if (error.message.includes('Missing required environment variables')) {
        mainLogger.error('Configuration error: Missing required environment variables');
        console.error('💡 Tip: Make sure you have a .env file with all required variables');
        console.error('💡 See .env.example for reference');
      } else if (error.message.includes('DISCORD_TOKEN')) {
        mainLogger.error('Configuration error: Invalid Discord token');
        console.error('💡 Tip: Check that your Discord bot token is valid');
      } else if (error.message.includes('MYSQL_URL')) {
        mainLogger.error('Configuration error: Invalid MySQL connection string');
        console.error('💡 Tip: Check that your MySQL connection string is correct');
      }
    }

    process.exit(1);
  }
}

// Handle startup errors
main().catch((error) => {
  errorHandler.handleError(error, 'Main.unhandled');
  logger.error('Unhandled error during startup', error instanceof Error ? error : undefined);
  process.exit(1);
});