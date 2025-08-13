import { 
  Client, 
  GatewayIntentBits, 
  Events, 
  REST, 
  Routes, 
  CommandInteraction,
  Collection
} from 'discord.js';
import { EnvironmentConfig } from '../config/environment';
import { AddBlacklistCommand } from '../commands/addbl';
import { CheckBlacklistCommand } from '../commands/checkbl';
import { RemoveBlacklistCommand } from '../commands/removebl';
import { logger } from '../utils/Logger';
import { errorHandler } from '../utils/ErrorHandler';

/**
 * Discord bot client with command registration and lifecycle management
 * Requirements: 4.1, 5.3
 */
export class DiscordClient {
  private client: Client;
  private config: EnvironmentConfig;
  private commands: Collection<string, any>;
  private isShuttingDown: boolean = false;
  private logger = logger.child('DiscordClient');

  constructor(config?: EnvironmentConfig) {
    this.config = config || EnvironmentConfig.getInstance();
    
    // Initialize Discord client with required intents
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
      ]
    });

    // Initialize commands collection
    this.commands = new Collection();
    
    this.setupEventHandlers();
    this.setupGracefulShutdown();
  }

  /**
   * Setup Discord client event handlers
   * Requirement 4.1: Event handlers for bot lifecycle
   */
  private setupEventHandlers(): void {
    // Bot ready event
    this.client.once(Events.ClientReady, async (readyClient) => {
      this.logger.info(`Discord bot logged in as ${readyClient.user.tag}`, {
        botId: readyClient.user.id,
        guildCount: readyClient.guilds.cache.size
      });
      
      try {
        await this.registerSlashCommands();
        this.logger.info('Slash commands registered successfully');
      } catch (error) {
        errorHandler.handleError(error, 'DiscordClient.registerSlashCommands');
        this.logger.error('Failed to register slash commands', error instanceof Error ? error : undefined);
      }
    });

    // Interaction handling
    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      await this.handleCommand(interaction);
    });

    // Error handling
    this.client.on(Events.Error, (error) => {
      errorHandler.handleError(error, 'DiscordClient.Error');
      this.logger.error('Discord client error', error);
    });

    // Warning handling
    this.client.on(Events.Warn, (warning) => {
      this.logger.warn('Discord client warning', { warning });
    });

    // Shard disconnect handling
    this.client.on(Events.ShardDisconnect, (event, shardId) => {
      if (!this.isShuttingDown) {
        this.logger.warn('Discord client shard disconnected unexpectedly', {
          shardId,
          event: event?.code || 'unknown'
        });
      }
    });

    // Shard reconnecting handling
    this.client.on(Events.ShardReconnecting, (shardId) => {
      this.logger.info('Discord client shard reconnecting', { shardId });
    });

    // Shard ready handling
    this.client.on(Events.ShardReady, (shardId) => {
      this.logger.info('Discord client shard ready', { shardId });
    });

    // Rate limit handling would be handled by Discord.js internally
  }

  /**
   * Register slash commands with Discord API
   * Requirement 5.3: Automatic slash command registration on startup
   */
  private async registerSlashCommands(): Promise<void> {
    const commands = [
      AddBlacklistCommand.createSlashCommand().toJSON(),
      CheckBlacklistCommand.createSlashCommand().toJSON(),
      RemoveBlacklistCommand.createSlashCommand().toJSON()
    ];

    // Store command instances for handling interactions
    this.commands.set(AddBlacklistCommand.getCommandName(), new AddBlacklistCommand());
    this.commands.set(CheckBlacklistCommand.getCommandName(), new CheckBlacklistCommand());
    this.commands.set(RemoveBlacklistCommand.getCommandName(), new RemoveBlacklistCommand());

    const rest = new REST().setToken(this.config.discordToken);

    try {
      this.logger.info('Started refreshing application (/) commands', {
        commandCount: commands.length
      });

      // Register commands globally (can take up to 1 hour to propagate)
      // For faster testing, you could register guild-specific commands instead
      await rest.put(
        Routes.applicationCommands(this.client.user!.id),
        { body: commands }
      );

      this.logger.info(`Successfully reloaded ${commands.length} application (/) commands`);
    } catch (error) {
      errorHandler.handleError(error, 'DiscordClient.registerSlashCommands');
      this.logger.error('Failed to register slash commands', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Handle slash command interactions
   * Requirement 4.1: Integrate command handlers with Discord interactions
   */
  private async handleCommand(interaction: CommandInteraction): Promise<void> {
    const command = this.commands.get(interaction.commandName);

    if (!command) {
      this.logger.error(`No command matching ${interaction.commandName} was found`, undefined, {
        commandName: interaction.commandName,
        userId: interaction.user.id,
        guildId: interaction.guildId
      });
      
      try {
        await interaction.reply({
          content: 'Unknown command. Please try again.',
          ephemeral: true
        });
      } catch (replyError) {
        this.logger.error('Failed to send unknown command message', replyError instanceof Error ? replyError : undefined);
      }
      return;
    }

    const startTime = Date.now();
    
    try {
      this.logger.info(`Executing command: ${interaction.commandName}`, {
        commandName: interaction.commandName,
        userId: interaction.user.id,
        username: interaction.user.tag,
        guildId: interaction.guildId
      });

      await command.execute(interaction);
      
      const duration = Date.now() - startTime;
      this.logger.info(`Command executed successfully: ${interaction.commandName}`, {
        commandName: interaction.commandName,
        userId: interaction.user.id,
        duration
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorResult = errorHandler.handleDiscordError(error, interaction.commandName, interaction.user.id);
      
      this.logger.error(`Error executing command ${interaction.commandName}`, error instanceof Error ? error : undefined, {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        duration
      });

      const errorMessage = errorResult.userMessage || 'There was an error while executing this command!';
      
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: errorMessage,
            ephemeral: true
          });
        } else {
          await interaction.reply({
            content: errorMessage,
            ephemeral: true
          });
        }
      } catch (followUpError) {
        this.logger.error('Failed to send error message to user', followUpError instanceof Error ? followUpError : undefined, {
          userId: interaction.user.id,
          commandName: interaction.commandName
        });
      }
    }
  }

  /**
   * Setup graceful shutdown handlers
   * Requirement 4.1: Bot lifecycle management and graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        console.log('⚠️ Shutdown already in progress...');
        return;
      }

      this.isShuttingDown = true;
      console.log(`🔄 Received ${signal}, shutting down gracefully...`);

      try {
        // Set bot status to indicate shutdown
        if (this.client.user) {
          await this.client.user.setStatus('invisible');
        }

        // Destroy the Discord client connection
        this.client.destroy();
        console.log('✅ Discord client disconnected successfully');

        // Exit the process
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Handle various shutdown signals
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGQUIT', () => shutdown('SIGQUIT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      shutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
  }

  /**
   * Start the Discord bot
   * Requirement 4.1: Bot initialization and connection
   */
  async start(): Promise<void> {
    try {
      console.log('🔄 Starting Discord bot...');
      await this.client.login(this.config.discordToken);
    } catch (error) {
      console.error('❌ Failed to start Discord bot:', error);
      throw error;
    }
  }

  /**
   * Stop the Discord bot
   * Requirement 4.1: Graceful shutdown
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    console.log('🔄 Stopping Discord bot...');

    try {
      if (this.client.user) {
        await this.client.user.setStatus('invisible');
      }
      this.client.destroy();
      console.log('✅ Discord bot stopped successfully');
    } catch (error) {
      console.error('❌ Error stopping Discord bot:', error);
      throw error;
    }
  }

  /**
   * Get the Discord client instance
   */
  getClient(): Client {
    return this.client;
  }

  /**
   * Check if the bot is ready
   */
  isReady(): boolean {
    return this.client.readyAt !== null;
  }

  /**
   * Get bot uptime in milliseconds
   */
  getUptime(): number | null {
    return this.client.uptime;
  }

  /**
   * Get the number of guilds the bot is in
   */
  getGuildCount(): number {
    return this.client.guilds.cache.size;
  }
}