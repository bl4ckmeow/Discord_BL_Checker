import { CommandInteraction } from 'discord.js';
import { PermissionService } from './PermissionService';

export interface PermissionMiddlewareResult {
  allowed: boolean;
  errorMessage?: string;
}

export class PermissionMiddleware {
  private permissionService: PermissionService;

  constructor() {
    this.permissionService = new PermissionService();
  }

  /**
   * Middleware to check if user has admin permissions for a command
   * @param interaction Discord command interaction
   * @returns Promise<PermissionMiddlewareResult> Result indicating if access is allowed
   */
  async requireAdmin(interaction: CommandInteraction): Promise<PermissionMiddlewareResult> {
    try {
      // Check if we're in a guild
      if (!interaction.guild) {
        return {
          allowed: false,
          errorMessage: 'This command can only be used in a server, not in direct messages.'
        };
      }

      // Check if user has admin role
      const hasAdminRole = await this.permissionService.checkAdminRole(interaction);
      
      if (!hasAdminRole) {
        return {
          allowed: false,
          errorMessage: 'You do not have permission to use this command. Administrator role required.'
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error in admin permission middleware:', error);
      return {
        allowed: false,
        errorMessage: 'An error occurred while checking permissions. Please try again.'
      };
    }
  }

  /**
   * Middleware to check if user can use general commands (no special permissions required)
   * @param interaction Discord command interaction
   * @returns Promise<PermissionMiddlewareResult> Result indicating if access is allowed
   */
  async requireGuildMember(interaction: CommandInteraction): Promise<PermissionMiddlewareResult> {
    try {
      // Check if we're in a guild
      if (!interaction.guild) {
        return {
          allowed: false,
          errorMessage: 'This command can only be used in a server, not in direct messages.'
        };
      }

      // Check if user is a member of the guild
      if (!interaction.member) {
        return {
          allowed: false,
          errorMessage: 'Unable to verify your membership in this server.'
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error in guild member permission middleware:', error);
      return {
        allowed: false,
        errorMessage: 'An error occurred while checking permissions. Please try again.'
      };
    }
  }

  /**
   * Get the permission service instance
   * @returns PermissionService The permission service instance
   */
  getPermissionService(): PermissionService {
    return this.permissionService;
  }
}