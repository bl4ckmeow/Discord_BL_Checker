import { RemoveBlacklistCommand } from '../removebl';
import { IBlacklistService } from '../../services/BlacklistService';
import { PermissionMiddleware } from '../../services/PermissionMiddleware';
import { BlacklistEntry } from '../../models/BlacklistEntry';

// Mock Discord.js
jest.mock('discord.js', () => ({
  SlashCommandBuilder: jest.fn().mockImplementation(() => ({
    setName: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    addIntegerOption: jest.fn().mockReturnThis()
  }))
}));

// Mock services
jest.mock('../../services/BlacklistService');
jest.mock('../../services/PermissionMiddleware');

// Mock interaction interface
interface MockCommandInteraction {
  user: { id: string };
  options: { getInteger: jest.Mock };
  reply: jest.Mock;
  deferReply: jest.Mock;
  editReply: jest.Mock;
  deferred: boolean;
}

describe('RemoveBlacklistCommand', () => {
  let command: RemoveBlacklistCommand;
  let mockBlacklistService: jest.Mocked<IBlacklistService>;
  let mockPermissionMiddleware: jest.Mocked<PermissionMiddleware>;
  let mockInteraction: MockCommandInteraction;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock services
    mockBlacklistService = {
      addEntry: jest.fn(),
      searchEntries: jest.fn(),
      removeEntry: jest.fn(),
      checkDuplicate: jest.fn(),
      findByIdentifier: jest.fn(),
      findByName: jest.fn(),
      getById: jest.fn()
    };

    mockPermissionMiddleware = {
      requireAdmin: jest.fn(),
      requireGuildMember: jest.fn(),
      getPermissionService: jest.fn()
    } as any;

    // Create mock interaction
    mockInteraction = {
      user: { id: 'user123' },
      options: {
        getInteger: jest.fn()
      },
      reply: jest.fn(),
      deferReply: jest.fn(),
      editReply: jest.fn(),
      deferred: false
    };

    // Create command instance with mocked dependencies
    command = new RemoveBlacklistCommand(mockBlacklistService as any, mockPermissionMiddleware);
  });

  describe('createSlashCommand', () => {
    it('should create a slash command with correct configuration', () => {
      const slashCommand = RemoveBlacklistCommand.createSlashCommand();
      expect(slashCommand).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should successfully remove a blacklist entry with identifier only', async () => {
      // Arrange
      mockPermissionMiddleware.requireAdmin.mockResolvedValue({ allowed: true });
      mockInteraction.options.getInteger.mockReturnValue(1);
      
      const mockEntry: BlacklistEntry = {
        id: 1,
        identifier: 'test123',
        createdAt: new Date('2024-01-01'),
        createdBy: 'admin123'
      };
      
      mockBlacklistService.getById.mockResolvedValue(mockEntry);
      mockBlacklistService.removeEntry.mockResolvedValue(true);

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockPermissionMiddleware.requireAdmin).toHaveBeenCalledWith(mockInteraction);
      expect(mockBlacklistService.getById).toHaveBeenCalledWith(1);
      expect(mockBlacklistService.removeEntry).toHaveBeenCalledWith(1);
      expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('✅ Successfully removed blacklist entry (ID: 1)')
      });
    });

    it('should successfully remove a blacklist entry with names', async () => {
      // Arrange
      mockPermissionMiddleware.requireAdmin.mockResolvedValue({ allowed: true });
      mockInteraction.options.getInteger.mockReturnValue(2);
      
      const mockEntry: BlacklistEntry = {
        id: 2,
        identifier: 'test456',
        firstName: 'John',
        lastName: 'Doe',
        createdAt: new Date('2024-01-01'),
        createdBy: 'admin123'
      };
      
      mockBlacklistService.getById.mockResolvedValue(mockEntry);
      mockBlacklistService.removeEntry.mockResolvedValue(true);

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('John Doe')
      });
    });

    it('should deny access for non-admin users', async () => {
      // Arrange
      mockPermissionMiddleware.requireAdmin.mockResolvedValue({
        allowed: false,
        errorMessage: 'Admin role required'
      });

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'Admin role required',
        ephemeral: true
      });
      expect(mockBlacklistService.getById).not.toHaveBeenCalled();
      expect(mockBlacklistService.removeEntry).not.toHaveBeenCalled();
    });

    it('should handle invalid ID parameter (null)', async () => {
      // Arrange
      mockPermissionMiddleware.requireAdmin.mockResolvedValue({ allowed: true });
      mockInteraction.options.getInteger.mockReturnValue(null);

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'Error: Please provide a valid blacklist entry ID (positive number).',
        ephemeral: true
      });
      expect(mockBlacklistService.getById).not.toHaveBeenCalled();
    });

    it('should handle invalid ID parameter (zero)', async () => {
      // Arrange
      mockPermissionMiddleware.requireAdmin.mockResolvedValue({ allowed: true });
      mockInteraction.options.getInteger.mockReturnValue(0);

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'Error: Please provide a valid blacklist entry ID (positive number).',
        ephemeral: true
      });
      expect(mockBlacklistService.getById).not.toHaveBeenCalled();
    });

    it('should handle invalid ID parameter (negative)', async () => {
      // Arrange
      mockPermissionMiddleware.requireAdmin.mockResolvedValue({ allowed: true });
      mockInteraction.options.getInteger.mockReturnValue(-1);

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'Error: Please provide a valid blacklist entry ID (positive number).',
        ephemeral: true
      });
      expect(mockBlacklistService.getById).not.toHaveBeenCalled();
    });

    it('should handle entry not found', async () => {
      // Arrange
      mockPermissionMiddleware.requireAdmin.mockResolvedValue({ allowed: true });
      mockInteraction.options.getInteger.mockReturnValue(999);
      mockBlacklistService.getById.mockResolvedValue(null);

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockBlacklistService.getById).toHaveBeenCalledWith(999);
      expect(mockBlacklistService.removeEntry).not.toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ No blacklist entry found with ID: 999'
      });
    });

    it('should handle removal failure', async () => {
      // Arrange
      mockPermissionMiddleware.requireAdmin.mockResolvedValue({ allowed: true });
      mockInteraction.options.getInteger.mockReturnValue(1);
      
      const mockEntry: BlacklistEntry = {
        id: 1,
        identifier: 'test123',
        createdAt: new Date('2024-01-01'),
        createdBy: 'admin123'
      };
      
      mockBlacklistService.getById.mockResolvedValue(mockEntry);
      mockBlacklistService.removeEntry.mockResolvedValue(false);

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Failed to remove blacklist entry with ID: 1. The entry may have been already deleted.'
      });
    });

    it('should handle invalid ID service error', async () => {
      // Arrange
      mockPermissionMiddleware.requireAdmin.mockResolvedValue({ allowed: true });
      mockInteraction.options.getInteger.mockReturnValue(1);
      mockBlacklistService.getById.mockRejectedValue(new Error('Invalid ID: ID must be a positive number'));
      mockInteraction.deferred = true;

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Invalid entry ID: ID must be a positive number'
      });
    });

    it('should handle removal service error', async () => {
      // Arrange
      mockPermissionMiddleware.requireAdmin.mockResolvedValue({ allowed: true });
      mockInteraction.options.getInteger.mockReturnValue(1);
      
      const mockEntry: BlacklistEntry = {
        id: 1,
        identifier: 'test123',
        createdAt: new Date('2024-01-01'),
        createdBy: 'admin123'
      };
      
      mockBlacklistService.getById.mockResolvedValue(mockEntry);
      mockBlacklistService.removeEntry.mockRejectedValue(new Error('Failed to remove blacklist entry'));
      mockInteraction.deferred = true;

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Database error occurred while removing entry. Please try again later.'
      });
    });

    it('should handle get entry service error', async () => {
      // Arrange
      mockPermissionMiddleware.requireAdmin.mockResolvedValue({ allowed: true });
      mockInteraction.options.getInteger.mockReturnValue(1);
      mockBlacklistService.getById.mockRejectedValue(new Error('Failed to get entry by ID'));
      mockInteraction.deferred = true;

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Unable to verify entry existence. Please check the ID and try again.'
      });
    });

    it('should handle generic errors', async () => {
      // Arrange
      mockPermissionMiddleware.requireAdmin.mockResolvedValue({ allowed: true });
      mockInteraction.options.getInteger.mockReturnValue(1);
      mockBlacklistService.getById.mockRejectedValue(new Error('Some unexpected error'));
      mockInteraction.deferred = false;

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '❌ Failed to remove blacklist entry.',
        ephemeral: true
      });
    });
  });

  describe('getCommandName', () => {
    it('should return correct command name', () => {
      expect(RemoveBlacklistCommand.getCommandName()).toBe('removebl');
    });
  });
});