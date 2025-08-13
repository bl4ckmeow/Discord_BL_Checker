import { 
  ChatInputCommandInteraction, 
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder
} from 'discord.js';
import { BlacklistService } from '../services/BlacklistService';
import { PermissionMiddleware } from '../services/PermissionMiddleware';
import { CreateBlacklistEntryInput } from '../models/BlacklistEntry';
import { logger } from '../utils/Logger';
import { errorHandler } from '../utils/ErrorHandler';

/**
 * Add blacklist command handler
 * Requirements: 1.1, 1.2, 1.4
 */
export class AddBlacklistCommand {
  private blacklistService: BlacklistService;
  private permissionMiddleware: PermissionMiddleware;
  private logger = logger.child('AddBlacklistCommand');

  constructor(blacklistService?: BlacklistService, permissionMiddleware?: PermissionMiddleware) {
    this.blacklistService = blacklistService || new BlacklistService();
    this.permissionMiddleware = permissionMiddleware || new PermissionMiddleware();
  }

  /**
   * Creates the slash command definition
   * Requirement 1.1: /addbl command with parameter validation
   */
  static createSlashCommand(): SlashCommandOptionsOnlyBuilder {
    return new SlashCommandBuilder()
      .setName('addbl')
      .setDescription('Add a user to the blacklist (Admin only)')
      .addStringOption(option =>
        option
          .setName('identifier')
          .setDescription('Account name, account number, or phone number')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('firstname')
          .setDescription('First name (optional)')
          .setRequired(false)
      )
      .addStringOption(option =>
        option
          .setName('lastname')
          .setDescription('Last name (optional)')
          .setRequired(false)
      );
  }

  /**
   * Handles the /addbl command execution
   * Requirements: 1.1, 1.2, 1.4
   */
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      // Check admin permissions (Requirement 1.4)
      const permissionResult = await this.permissionMiddleware.requireAdmin(interaction);
      if (!permissionResult.allowed) {
        await interaction.reply({
          content: permissionResult.errorMessage || 'Permission denied.',
          ephemeral: true
        });
        return;
      }

      // Extract command parameters (Requirement 1.1)
      const identifier = interaction.options.get('identifier')?.value as string;
      const firstName = interaction.options.get('firstname')?.value as string | undefined;
      const lastName = interaction.options.get('lastname')?.value as string | undefined;

      // Validate that at least identifier is provided (Requirement 1.2)
      if (!identifier) {
        await interaction.reply({
          content: 'Error: Identifier is required (account name, account number, or phone number).',
          ephemeral: true
        });
        return;
      }

      // Create blacklist entry input
      const entryInput: CreateBlacklistEntryInput = {
        identifier: identifier.trim(),
        createdBy: interaction.user.id
      };

      // Add optional names if provided (Requirement 1.2)
      if (firstName && firstName.trim()) {
        entryInput.firstName = firstName.trim();
      }
      if (lastName && lastName.trim()) {
        entryInput.lastName = lastName.trim();
      }

      // Defer reply for potentially long database operation
      await interaction.deferReply({ ephemeral: true });

      // Add entry to blacklist (Requirement 1.1)
      const entryId = await this.blacklistService.addEntry(entryInput);

      // Format success response
      let responseMessage = `✅ Successfully added blacklist entry (ID: ${entryId})\n`;
      responseMessage += `**Identifier:** ${identifier}`;
      
      if (firstName || lastName) {
        responseMessage += `\n**Name:** ${firstName || ''} ${lastName || ''}`.trim();
      }

      await interaction.editReply({
        content: responseMessage
      });

    } catch (error) {
      const errorResult = errorHandler.handleDiscordError(error, 'addbl', interaction.user.id);
      
      this.logger.error('Error in addbl command', error instanceof Error ? error : undefined, {
        userId: interaction.user.id,
        guildId: interaction.guildId
      });

      let errorMessage = '❌ Failed to add blacklist entry.';
      
      if (error instanceof Error) {
        if (error.message.includes('Duplicate entry')) {
          errorMessage = '❌ This identifier is already blacklisted.';
        } else if (error.message.includes('Validation failed')) {
          errorMessage = `❌ Invalid input: ${error.message.replace('Validation failed: ', '')}`;
        } else if (error.message.includes('database') || error.message.includes('Database')) {
          errorMessage = '❌ Database error occurred. Please try again later.';
        } else if (error.message.includes('Permission denied')) {
          errorMessage = '❌ You do not have permission to use this command.';
        } else {
          // Use the error handler's user-friendly message
          errorMessage = errorResult.userMessage;
        }
      }

      try {
        // Handle both deferred and non-deferred replies
        if (interaction.deferred) {
          await interaction.editReply({ content: errorMessage });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      } catch (replyError) {
        this.logger.error('Failed to send error message to user', replyError instanceof Error ? replyError : undefined, {
          userId: interaction.user.id,
          originalError: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Gets the command name
   */
  static getCommandName(): string {
    return 'addbl';
  }
}