import { PermissionMiddleware, PermissionMiddlewareResult } from '../PermissionMiddleware';
import { PermissionService } from '../PermissionService';
import { Guild } from 'discord.js';

// Mock PermissionService
jest.mock('../PermissionService');

const createMockCommandInteraction = (
  inGuild: boolean = true,
  member: any = null
): any => ({
  guild: inGuild ? ({ id: 'test-guild-id' } as Guild) : null,
  member: member
});

describe('PermissionMiddleware', () => {
  let permissionMiddleware: PermissionMiddleware;
  let mockPermissionService: jest.Mocked<PermissionService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock PermissionService
    mockPermissionService = {
      checkAdminRole: jest.fn(),
      hasAdminRole: jest.fn(),
      isAdmin: jest.fn(),
      getAdminRoleId: jest.fn(),
      validateAdminRoleExists: jest.fn()
    } as any;

    (PermissionService as jest.Mock).mockImplementation(() => mockPermissionService);

    permissionMiddleware = new PermissionMiddleware();
  });

  describe('requireAdmin', () => {
    it('should allow access when user has admin role', async () => {
      // Requirement 1.4, 3.2: Admin role validation and permission checking
      mockPermissionService.checkAdminRole.mockResolvedValue(true);
      const mockInteraction = createMockCommandInteraction(true, {});

      const result: PermissionMiddlewareResult = await permissionMiddleware.requireAdmin(mockInteraction);

      expect(result.allowed).toBe(true);
      expect(result.errorMessage).toBeUndefined();
      expect(mockPermissionService.checkAdminRole).toHaveBeenCalledWith(mockInteraction);
    });

    it('should deny access when user does not have admin role', async () => {
      mockPermissionService.checkAdminRole.mockResolvedValue(false);
      const mockInteraction = createMockCommandInteraction(true, {});

      const result: PermissionMiddlewareResult = await permissionMiddleware.requireAdmin(mockInteraction);

      expect(result.allowed).toBe(false);
      expect(result.errorMessage).toBe('You do not have permission to use this command. Administrator role required.');
      expect(mockPermissionService.checkAdminRole).toHaveBeenCalledWith(mockInteraction);
    });

    it('should deny access when interaction is not in a guild', async () => {
      const mockInteraction = createMockCommandInteraction(false);

      const result: PermissionMiddlewareResult = await permissionMiddleware.requireAdmin(mockInteraction);

      expect(result.allowed).toBe(false);
      expect(result.errorMessage).toBe('This command can only be used in a server, not in direct messages.');
      expect(mockPermissionService.checkAdminRole).not.toHaveBeenCalled();
    });

    it('should handle permission service errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockPermissionService.checkAdminRole.mockRejectedValue(new Error('Permission service error'));
      const mockInteraction = createMockCommandInteraction(true, {});

      const result: PermissionMiddlewareResult = await permissionMiddleware.requireAdmin(mockInteraction);

      expect(result.allowed).toBe(false);
      expect(result.errorMessage).toBe('An error occurred while checking permissions. Please try again.');
      expect(consoleSpy).toHaveBeenCalledWith('Error in admin permission middleware:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should handle unexpected errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      // Simulate an unexpected error by making the interaction throw
      const mockInteraction = {
        get guild() {
          throw new Error('Unexpected error');
        }
      } as any;

      const result: PermissionMiddlewareResult = await permissionMiddleware.requireAdmin(mockInteraction);

      expect(result.allowed).toBe(false);
      expect(result.errorMessage).toBe('An error occurred while checking permissions. Please try again.');
      expect(consoleSpy).toHaveBeenCalledWith('Error in admin permission middleware:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('requireGuildMember', () => {
    it('should allow access when user is a guild member', async () => {
      // Requirement 5.1: Permission checking for general commands
      const mockInteraction = createMockCommandInteraction(true, {});

      const result: PermissionMiddlewareResult = await permissionMiddleware.requireGuildMember(mockInteraction);

      expect(result.allowed).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });

    it('should deny access when interaction is not in a guild', async () => {
      const mockInteraction = createMockCommandInteraction(false);

      const result: PermissionMiddlewareResult = await permissionMiddleware.requireGuildMember(mockInteraction);

      expect(result.allowed).toBe(false);
      expect(result.errorMessage).toBe('This command can only be used in a server, not in direct messages.');
    });

    it('should deny access when interaction has no member', async () => {
      const mockInteraction = createMockCommandInteraction(true, null);

      const result: PermissionMiddlewareResult = await permissionMiddleware.requireGuildMember(mockInteraction);

      expect(result.allowed).toBe(false);
      expect(result.errorMessage).toBe('Unable to verify your membership in this server.');
    });

    it('should handle unexpected errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      // Simulate an unexpected error
      const mockInteraction = {
        get guild() {
          throw new Error('Unexpected error');
        }
      } as any;

      const result: PermissionMiddlewareResult = await permissionMiddleware.requireGuildMember(mockInteraction);

      expect(result.allowed).toBe(false);
      expect(result.errorMessage).toBe('An error occurred while checking permissions. Please try again.');
      expect(consoleSpy).toHaveBeenCalledWith('Error in guild member permission middleware:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('getPermissionService', () => {
    it('should return the permission service instance', () => {
      const service = permissionMiddleware.getPermissionService();

      expect(service).toBe(mockPermissionService);
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle null interaction gracefully in requireAdmin', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result: PermissionMiddlewareResult = await permissionMiddleware.requireAdmin(null as any);

      expect(result.allowed).toBe(false);
      expect(result.errorMessage).toBe('An error occurred while checking permissions. Please try again.');
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle null interaction gracefully in requireGuildMember', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result: PermissionMiddlewareResult = await permissionMiddleware.requireGuildMember(null as any);

      expect(result.allowed).toBe(false);
      expect(result.errorMessage).toBe('An error occurred while checking permissions. Please try again.');
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle undefined interaction gracefully in requireAdmin', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result: PermissionMiddlewareResult = await permissionMiddleware.requireAdmin(undefined as any);

      expect(result.allowed).toBe(false);
      expect(result.errorMessage).toBe('An error occurred while checking permissions. Please try again.');
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle undefined interaction gracefully in requireGuildMember', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result: PermissionMiddlewareResult = await permissionMiddleware.requireGuildMember(undefined as any);

      expect(result.allowed).toBe(false);
      expect(result.errorMessage).toBe('An error occurred while checking permissions. Please try again.');
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Integration with PermissionService', () => {
    it('should create PermissionService instance on construction', () => {
      expect(PermissionService).toHaveBeenCalledTimes(1);
    });

    it('should use PermissionService for admin role checking', async () => {
      mockPermissionService.checkAdminRole.mockResolvedValue(true);
      const mockInteraction = createMockCommandInteraction(true, {});

      await permissionMiddleware.requireAdmin(mockInteraction);

      expect(mockPermissionService.checkAdminRole).toHaveBeenCalledWith(mockInteraction);
    });

    it('should not call PermissionService for guild member checking', async () => {
      const mockInteraction = createMockCommandInteraction(true, {});

      await permissionMiddleware.requireGuildMember(mockInteraction);

      expect(mockPermissionService.checkAdminRole).not.toHaveBeenCalled();
      expect(mockPermissionService.hasAdminRole).not.toHaveBeenCalled();
      expect(mockPermissionService.isAdmin).not.toHaveBeenCalled();
    });
  });

  describe('Message Consistency', () => {
    it('should provide consistent error messages for DM usage', async () => {
      const mockInteraction = createMockCommandInteraction(false);

      const adminResult = await permissionMiddleware.requireAdmin(mockInteraction);
      const memberResult = await permissionMiddleware.requireGuildMember(mockInteraction);

      expect(adminResult.errorMessage).toBe(memberResult.errorMessage);
      expect(adminResult.errorMessage).toBe('This command can only be used in a server, not in direct messages.');
    });

    it('should provide consistent error messages for system errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockPermissionService.checkAdminRole.mockRejectedValue(new Error('Service error'));
      
      const mockInteraction1 = createMockCommandInteraction(true, {});
      const mockInteraction2 = {
        get guild() {
          throw new Error('Unexpected error');
        }
      } as any;

      const adminResult = await permissionMiddleware.requireAdmin(mockInteraction1);
      const memberResult = await permissionMiddleware.requireGuildMember(mockInteraction2);

      expect(adminResult.errorMessage).toBe(memberResult.errorMessage);
      expect(adminResult.errorMessage).toBe('An error occurred while checking permissions. Please try again.');
      
      consoleSpy.mockRestore();
    });
  });
});