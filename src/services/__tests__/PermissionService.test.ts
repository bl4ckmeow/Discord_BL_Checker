import { PermissionService, PermissionChecker } from '../PermissionService';
import { EnvironmentConfig } from '../../config/environment';
import { GuildMember, Guild, Role } from 'discord.js';

// Mock EnvironmentConfig
jest.mock('../../config/environment');

// Mock Discord.js types
const createMockGuildMember = (hasRole: boolean): any => ({
    roles: {
        cache: {
            has: jest.fn().mockReturnValue(hasRole)
        }
    }
});

const createMockCommandInteraction = (
    inGuild: boolean = true,
    member: any = null
): any => ({
    guild: inGuild ? ({ id: 'test-guild-id' } as Guild) : null,
    member: member
});

const createMockGuild = (roleExists: boolean = true): any => ({
    roles: {
        fetch: jest.fn().mockResolvedValue(roleExists ? ({ id: 'admin-role-id' } as Role) : null)
    }
});

describe('PermissionService', () => {
    let permissionService: PermissionChecker;
    let mockEnvironmentConfig: jest.Mocked<EnvironmentConfig>;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Mock EnvironmentConfig
        mockEnvironmentConfig = {
            adminRoleId: 'admin-role-id',
            getInstance: jest.fn()
        } as any;

        (EnvironmentConfig.getInstance as jest.Mock).mockReturnValue(mockEnvironmentConfig);

        permissionService = new PermissionService();
    });

    describe('hasAdminRole', () => {
        it('should return true when member has admin role', () => {
            // Requirement 1.4, 3.2: Admin role validation using environment configuration
            const mockMember = createMockGuildMember(true) as GuildMember;

            const result = permissionService.hasAdminRole(mockMember);

            expect(result).toBe(true);
            expect(mockMember.roles.cache.has).toHaveBeenCalledWith('admin-role-id');
        });

        it('should return false when member does not have admin role', () => {
            const mockMember = createMockGuildMember(false) as GuildMember;

            const result = permissionService.hasAdminRole(mockMember);

            expect(result).toBe(false);
            expect(mockMember.roles.cache.has).toHaveBeenCalledWith('admin-role-id');
        });

        it('should return false and log error when exception occurs', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const mockMember = {
                roles: {
                    cache: {
                        has: jest.fn().mockImplementation(() => {
                            throw new Error('Discord API error');
                        })
                    }
                }
            } as any;

            const result = permissionService.hasAdminRole(mockMember);

            expect(result).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith('Error checking admin role:', expect.any(Error));

            consoleSpy.mockRestore();
        });
    });

    describe('checkAdminRole', () => {
        it('should return true when interaction member has admin role', async () => {
            // Requirement 5.1: Permission checking middleware
            const mockMember = createMockGuildMember(true);
            const mockInteraction = createMockCommandInteraction(true, mockMember);

            const result = await permissionService.checkAdminRole(mockInteraction);

            expect(result).toBe(true);
        });

        it('should return false when interaction member does not have admin role', async () => {
            const mockMember = createMockGuildMember(false);
            const mockInteraction = createMockCommandInteraction(true, mockMember);

            const result = await permissionService.checkAdminRole(mockInteraction);

            expect(result).toBe(false);
        });

        it('should return false when interaction is not in a guild', async () => {
            const mockInteraction = createMockCommandInteraction(false);

            const result = await permissionService.checkAdminRole(mockInteraction);

            expect(result).toBe(false);
        });

        it('should return false when interaction has no member', async () => {
            const mockInteraction = createMockCommandInteraction(true, null);

            const result = await permissionService.checkAdminRole(mockInteraction);

            expect(result).toBe(false);
        });

        it('should return false and log error when exception occurs', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const mockMember = {
                roles: {
                    cache: {
                        has: jest.fn().mockImplementation(() => {
                            throw new Error('Discord API error');
                        })
                    }
                }
            };
            const mockInteraction = createMockCommandInteraction(true, mockMember);

            const result = await permissionService.checkAdminRole(mockInteraction);

            expect(result).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith('Error checking admin role:', expect.any(Error));

            consoleSpy.mockRestore();
        });
    });

    describe('isAdmin', () => {
        it('should return false and log error when called', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const result = await permissionService.isAdmin('user-id', 'guild-id');

            expect(result).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith('Error checking admin status:', expect.any(Error));

            consoleSpy.mockRestore();
        });

        it('should return false and log error when exception occurs', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const result = await permissionService.isAdmin('user-id', 'guild-id');

            expect(result).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith('Error checking admin status:', expect.any(Error));

            consoleSpy.mockRestore();
        });
    });

    describe('getAdminRoleId', () => {
        it('should return the admin role ID from environment config', () => {
            const result = (permissionService as PermissionService).getAdminRoleId();

            expect(result).toBe('admin-role-id');
        });
    });

    describe('validateAdminRoleExists', () => {
        it('should return true when admin role exists in guild', async () => {
            const mockGuild = createMockGuild(true);

            const result = await (permissionService as PermissionService).validateAdminRoleExists(mockGuild as unknown as Guild);

            expect(result).toBe(true);
            expect(mockGuild.roles.fetch).toHaveBeenCalledWith('admin-role-id');
        });

        it('should return false when admin role does not exist in guild', async () => {
            const mockGuild = createMockGuild(false);

            const result = await (permissionService as PermissionService).validateAdminRoleExists(mockGuild as unknown as Guild);

            expect(result).toBe(false);
            expect(mockGuild.roles.fetch).toHaveBeenCalledWith('admin-role-id');
        });

        it('should return false and log error when exception occurs', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const mockGuild = {
                roles: {
                    fetch: jest.fn().mockRejectedValue(new Error('Discord API error'))
                }
            };

            const result = await (permissionService as PermissionService).validateAdminRoleExists(mockGuild as unknown as Guild);

            expect(result).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith('Error validating admin role exists:', expect.any(Error));

            consoleSpy.mockRestore();
        });
    });

    describe('Environment Configuration Integration', () => {
        it('should use environment config for admin role ID', () => {
            // Requirement 5.1: Environment variable configuration
            expect(EnvironmentConfig.getInstance).toHaveBeenCalled();

            const mockMember = createMockGuildMember(true);
            permissionService.hasAdminRole(mockMember);

            expect(mockMember.roles.cache.has).toHaveBeenCalledWith('admin-role-id');
        });

        it('should handle environment config errors gracefully', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            // Mock environment config to throw error
            Object.defineProperty(mockEnvironmentConfig, 'adminRoleId', {
                get: () => {
                    throw new Error('Environment config error');
                },
                configurable: true
            });

            const mockMember = createMockGuildMember(true);
            const result = permissionService.hasAdminRole(mockMember);

            expect(result).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith('Error checking admin role:', expect.any(Error));

            consoleSpy.mockRestore();
        });
    });

    describe('Error Handling', () => {
        it('should handle null member gracefully', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const result = permissionService.hasAdminRole(null as any);

            expect(result).toBe(false);
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should handle undefined member gracefully', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const result = permissionService.hasAdminRole(undefined as any);

            expect(result).toBe(false);
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should handle member with no roles gracefully', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const mockMember = {
                roles: null
            } as any;

            const result = permissionService.hasAdminRole(mockMember);

            expect(result).toBe(false);
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });
});