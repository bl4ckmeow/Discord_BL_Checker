import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder
} from 'discord.js';
import { BlacklistService } from '../services/BlacklistService';
import { PermissionMiddleware } from '../services/PermissionMiddleware';
import { logger } from '../utils/Logger';
import { errorHandler } from '../utils/ErrorHandler';

/**
 * Remove blacklist command handler
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
export class RemoveBlacklistCommand {
  private blacklistService: BlacklistService;
  private permissionMiddleware: PermissionMiddleware;
  private logger = logger.child('RemoveBlacklistCommand');

  constructor(blacklistService?: BlacklistService, permissionMiddleware?: PermissionMiddleware) {
    this.blacklistService = blacklistService || new BlacklistService();
    this.permissionMiddleware = permissionMiddleware || new PermissionMiddleware();
  }

  /**
   * Creates the slash command definition
   * Requirement 3.1: Delete blacklist command
   */
  static createSlashCommand(): SlashCommandOptionsOnlyBuilder {
    return new SlashCommandBuilder()
      .setName('removebl')
      .setDescription('Remove a user from the blacklist (Admin only)')
      .addIntegerOption(option =>
        option
          .setName('id')
          .setDescription('Blacklist entry ID to remove')
          .setRequired(true)
          .setMinValue(1)
      );
  }

  /**
   * Handles the /removebl command execution
   * Requirements: 3.1, 3.2, 3.3, 3.4
   */
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // Extract command parameters outside try block for error logging
    const entryId = interaction.options.getInteger('id', true);

    try {
      // Check admin permissions (Requirement 3.2)
      const permissionResult = await this.permissionMiddleware.requireAdmin(interaction);
      if (!permissionResult.allowed) {
        await interaction.reply({
          content: permissionResult.errorMessage || 'Permission denied.',
          ephemeral: true
        });
        return;
      }

      // Validate ID parameter
      if (!entryId || entryId <= 0) {
        await interaction.reply({
          content: 'Error: Please provide a valid blacklist entry ID (positive number).',
          ephemeral: true
        });
        return;
      }

      // Defer reply for potentially long database operation
      await interaction.deferReply({ ephemeral: true });

      // Get entry details before deletion for confirmation message
      const existingEntry = await this.blacklistService.getById(entryId);

      // Requirement 3.4: Check if entry exists before deletion
      if (!existingEntry) {
        await interaction.editReply({
          content: `❌ No blacklist entry found with ID: ${entryId}`
        });
        return;
      }

      // Remove entry from blacklist (Requirement 3.1)
      const removed = await this.blacklistService.removeEntry(entryId);

      if (removed) {
        // Requirement 3.3: Confirm successful deletion
        let responseMessage = `✅ Successfully removed blacklist entry (ID: ${entryId})\n`;
        responseMessage += `**Identifier:** ${existingEntry.identifier}`;

        if (existingEntry.firstName || existingEntry.lastName) {
          const fullName = `${existingEntry.firstName || ''} ${existingEntry.lastName || ''}`.trim();
          responseMessage += `\n**Name:** ${fullName}`;
        }

        await interaction.editReply({
          content: responseMessage
        });
      } else {
        // This shouldn't happen since we checked existence, but handle it anyway
        await interaction.editReply({
          content: `❌ Failed to remove blacklist entry with ID: ${entryId}. The entry may have been already deleted.`
        });
      }

    } catch (error) {
      const errorResult = errorHandler.handleDiscordError(error, 'removebl', interaction.user.id);
      
      this.logger.error('Error in removebl command', error instanceof Error ? error : undefined, {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        entryId: entryId
      });

      let errorMessage = '❌ Failed to remove blacklist entry.';

      if (error instanceof Error) {
        if (error.message.includes('Invalid ID')) {
          errorMessage = `❌ Invalid entry ID: ${error.message.replace('Invalid ID: ', '')}`;
        } else if (error.message.includes('Failed to remove blacklist entry')) {
          errorMessage = '❌ Database error occurred while removing entry. Please try again later.';
        } else if (error.message.includes('Failed to get entry by ID')) {
          errorMessage = '❌ Unable to verify entry existence. Please check the ID and try again.';
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
    return 'removebl';
  }
}