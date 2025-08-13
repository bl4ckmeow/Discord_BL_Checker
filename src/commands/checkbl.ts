import { 
  ChatInputCommandInteraction, 
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder
} from 'discord.js';
import { BlacklistService } from '../services/BlacklistService';
import { PermissionMiddleware } from '../services/PermissionMiddleware';
import { SearchCriteria } from '../models/SearchCriteria';
import { BlacklistEntry } from '../models/BlacklistEntry';
import { logger } from '../utils/Logger';
import { errorHandler } from '../utils/ErrorHandler';

/**
 * Check blacklist command handler
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */
export class CheckBlacklistCommand {
  private blacklistService: BlacklistService;
  private permissionMiddleware: PermissionMiddleware;
  private logger = logger.child('CheckBlacklistCommand');

  constructor(blacklistService?: BlacklistService, permissionMiddleware?: PermissionMiddleware) {
    this.blacklistService = blacklistService || new BlacklistService();
    this.permissionMiddleware = permissionMiddleware || new PermissionMiddleware();
  }

  /**
   * Creates the slash command definition
   * Requirement 2.1: /checkbl command with flexible search parameters
   */
  static createSlashCommand(): SlashCommandOptionsOnlyBuilder {
    return new SlashCommandBuilder()
      .setName('checkbl')
      .setDescription('Check if someone is blacklisted')
      .addStringOption(option =>
        option
          .setName('identifier')
          .setDescription('Phone number, account number, or account name to search')
          .setRequired(false)
      )
      .addStringOption(option =>
        option
          .setName('firstname')
          .setDescription('First name to search')
          .setRequired(false)
      )
      .addStringOption(option =>
        option
          .setName('lastname')
          .setDescription('Last name to search')
          .setRequired(false)
      );
  }

  /**
   * Handles the /checkbl command execution
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
   */
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      // Check guild member permissions (Requirement 2.1: any user can use this command)
      const permissionResult = await this.permissionMiddleware.requireGuildMember(interaction);
      if (!permissionResult.allowed) {
        await interaction.reply({
          content: permissionResult.errorMessage || 'Permission denied.',
          ephemeral: true
        });
        return;
      }

      // Extract command parameters (Requirement 2.4: accept phone numbers, account numbers, or names)
      const identifier = interaction.options.getString('identifier');
      const firstName = interaction.options.getString('firstname');
      const lastName = interaction.options.getString('lastname');

      // Validate that at least one search criterion is provided
      if (!identifier && !firstName && !lastName) {
        await interaction.reply({
          content: 'Error: Please provide at least one search criterion (identifier, first name, or last name).',
          ephemeral: true
        });
        return;
      }

      // Create search criteria
      const searchCriteria: SearchCriteria = {};
      if (identifier && identifier.trim()) {
        searchCriteria.identifier = identifier.trim();
      }
      if (firstName && firstName.trim()) {
        searchCriteria.firstName = firstName.trim();
      }
      if (lastName && lastName.trim()) {
        searchCriteria.lastName = lastName.trim();
      }

      // Defer reply for potentially long database operation
      await interaction.deferReply();

      // Search for blacklist entries (Requirement 2.5: partial name matching)
      const results = await this.blacklistService.searchEntries(searchCriteria);

      // Format response based on results (Requirements 2.2, 2.3)
      if (results.length > 0) {
        // Requirement 2.2: Thai message when blacklist match is found
        let responseMessage = '⚠️ **[ ข้อมูล ] ตรวจพบการ Blacklist ภายในระบบ โปรดระวังการทำธุรกรรมหรือการซื้อขายกับบุคคลนี้**\n\n';
        
        // Add details of found entries
        results.forEach((entry: BlacklistEntry, index: number) => {
          responseMessage += `**รายการที่ ${index + 1}:**\n`;
          responseMessage += `• **Identifier:** ${entry.identifier}\n`;
          
          if (entry.firstName || entry.lastName) {
            const fullName = `${entry.firstName || ''} ${entry.lastName || ''}`.trim();
            responseMessage += `• **ชื่อ:** ${fullName}\n`;
          }
          
          responseMessage += `• **วันที่เพิ่ม:** ${entry.createdAt.toLocaleDateString('th-TH')}\n`;
          
          if (index < results.length - 1) {
            responseMessage += '\n';
          }
        });

        await interaction.editReply({
          content: responseMessage
        });
      } else {
        // Requirement 2.3: Message when no blacklist match is found
        await interaction.editReply({
          content: '✅ ไม่พบข้อมูลในระบบ Blacklist สำหรับเงื่อนไขการค้นหาที่ระบุ'
        });
      }

    } catch (error) {
      errorHandler.handleDiscordError(error, 'checkbl', interaction.user.id);
      
      this.logger.error('Error in checkbl command', error instanceof Error ? error : undefined, {
        userId: interaction.user.id,
        guildId: interaction.guildId
      });

      let errorMessage = '❌ เกิดข้อผิดพลาดในการค้นหาข้อมูล Blacklist';
      
      if (error instanceof Error) {
        if (error.message.includes('Search validation failed')) {
          errorMessage = `❌ ข้อมูลการค้นหาไม่ถูกต้อง: ${error.message.replace('Search validation failed: ', '')}`;
        } else if (error.message.includes('Failed to search blacklist entries')) {
          errorMessage = '❌ เกิดข้อผิดพลาดกับฐานข้อมูล กรุณาลองใหม่อีกครั้ง';
        } else if (error.message.includes('Permission denied')) {
          errorMessage = '❌ คุณไม่มีสิทธิ์ในการใช้คำสั่งนี้';
        } else {
          // Use the error handler's user-friendly message (but keep it in Thai)
          errorMessage = '❌ เกิดข้อผิดพลาดในการค้นหาข้อมูล กรุณาลองใหม่อีกครั้ง';
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
    return 'checkbl';
  }
}