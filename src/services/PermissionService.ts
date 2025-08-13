import { GuildMember, CommandInteraction, Guild } from 'discord.js';
import { EnvironmentConfig } from '../config/environment';

export interface PermissionChecker {
  isAdmin(userId: string, guildId: string): Promise<boolean>;
  checkAdminRole(interaction: CommandInteraction): Promise<boolean>;
  hasAdminRole(member: GuildMember): boolean;
}

export class PermissionService implements PermissionChecker {
  private environmentConfig: EnvironmentConfig;

  constructor() {
    this.environmentConfig = EnvironmentConfig.getInstance();
  }

  /**
   * Check if a user has admin permissions in a specific guild
   * @param _userId Discord user ID (unused - kept for interface compatibility)
   * @param _guildId Discord guild ID (unused - kept for interface compatibility)
   * @returns Promise<boolean> true if user is admin, false otherwise
   */
  async isAdmin(_userId: string, _guildId: string): Promise<boolean> {
    try {
      // This method would typically be used when we have access to the Discord client
      // For now, we'll throw an error indicating this needs a guild member object
      throw new Error('Use checkAdminRole with CommandInteraction or hasAdminRole with GuildMember instead');
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }

  /**
   * Check if the user who triggered the interaction has admin permissions
   * @param interaction Discord command interaction
   * @returns Promise<boolean> true if user is admin, false otherwise
   */
  async checkAdminRole(interaction: CommandInteraction): Promise<boolean> {
    try {
      // Ensure we're in a guild (not DM)
      if (!interaction.guild || !interaction.member) {
        return false;
      }

      // Get the guild member
      const member = interaction.member as GuildMember;
      
      return this.hasAdminRole(member);
    } catch (error) {
      console.error('Error checking admin role from interaction:', error);
      return false;
    }
  }

  /**
   * Check if a guild member has the admin role
   * @param member Discord guild member
   * @returns boolean true if member has admin role, false otherwise
   */
  hasAdminRole(member: GuildMember): boolean {
    try {
      const adminRoleId = this.environmentConfig.adminRoleId;
      
      // Check if the member has the admin role
      return member.roles.cache.has(adminRoleId);
    } catch (error) {
      console.error('Error checking admin role:', error);
      return false;
    }
  }

  /**
   * Get the configured admin role ID
   * @returns string The admin role ID from environment configuration
   */
  getAdminRoleId(): string {
    return this.environmentConfig.adminRoleId;
  }

  /**
   * Validate that the admin role exists in a guild
   * @param guild Discord guild
   * @returns Promise<boolean> true if admin role exists, false otherwise
   */
  async validateAdminRoleExists(guild: Guild): Promise<boolean> {
    try {
      const adminRoleId = this.environmentConfig.adminRoleId;
      const role = await guild.roles.fetch(adminRoleId);
      return role !== null;
    } catch (error) {
      console.error('Error validating admin role exists:', error);
      return false;
    }
  }
}