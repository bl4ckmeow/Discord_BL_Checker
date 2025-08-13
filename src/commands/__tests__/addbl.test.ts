import { AddBlacklistCommand } from '../addbl';
import { IBlacklistService } from '../../services/BlacklistService';
import { PermissionMiddleware } from '../../services/PermissionMiddleware';

// Mock Discord.js
jest.mock('discord.js', () => ({
  SlashCommandBuilder: jest.fn().mockImplementation(() => ({
    setName: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    addStringOption: jest.fn().mockReturnThis()
  }))
}));

// Mock services
jest.mock('../../services/BlacklistService');
jest.mock('../../services/PermissionMiddleware');

// Mock interaction interface
interface MockCommandInteraction {
  user: { id: string };
  options: { get: jest.Mock };
  reply: jest.Mock;
  deferReply: jest.Mock;
  editReply: jest.Mock;
  deferred: boolean;
}

describe('AddBlacklistCommand', () => {
  let command: AddBlacklistCommand;
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
        get: jest.fn()
      },
      reply: jest.fn(),
      deferReply: jest.fn(),
      editReply: jest.fn(),
      deferred: false
    };

    // Create command instance with mocked dependencies
    command = new AddBlacklistCommand(mockBlacklistService as any, mockPermissionMiddleware);
  });

  describe('createSlashCommand', () => {
    it('should create a slash command with correct configuration', () => {
      const slashCommand = AddBlacklistCommand.createSlashCommand();
      expect(slashCommand).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should successfully add a blacklist entry with identifier only', async () => {
      // Arrange
      mockPermissionMiddleware.requireAdmin.mockResolvedValue({ allowed: true });
      mockInteraction.options.get.mockImplementation((name: string) => {
        if (name === 'identifier') return { value: 'test123' };
        return undefined;
      });
      mockBlacklistService.addEntry.mockResolvedValue(1);

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockPermissionMiddleware.requireAdmin).toHaveBeenCalledWith(mockInteraction);
      expect(mockBlacklistService.addEntry).toHaveBeenCalledWith({
        identifier: 'test123',
        createdBy: 'user123'
      });
      expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('✅ Successfully added blacklist entry (ID: 1)')
      });
    });

    it('should successfully add a blacklist entry with identifier and names', async () => {
      // Arrange
      mockPermissionMiddleware.requireAdmin.mockResolvedValue({ allowed: true });
      mockInteraction.options.get.mockImplementation((name: string) => {
        if (name === 'identifier') return { value: 'test123' };
        if (name === 'firstname') return { value: 'John' };
        if (name === 'lastname') return { value: 'Doe' };
        return undefined;
      });
      mockBlacklistService.addEntry.mockResolvedValue(2);

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockBlacklistService.addEntry).toHaveBeenCalledWith({
        identifier: 'test123',
        firstName: 'John',
        lastName: 'Doe',
        createdBy: 'user123'
      });
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
      expect(mockBlacklistService.addEntry).not.toHaveBeenCalled();
    });

    it('should handle missing identifier parameter', async () => {
      // Arrange
      mockPermissionMiddleware.requireAdmin.mockResolvedValue({ allowed: true });
      mockInteraction.options.get.mockReturnValue(undefined);

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'Error: Identifier is required (account name, account number, or phone number).',
        ephemeral: true
      });
      expect(mockBlacklistService.addEntry).not.toHaveBeenCalled();
    });

    it('should handle duplicate entry error', async () => {
      // Arrange
      mockPermissionMiddleware.requireAdmin.mockResolvedValue({ allowed: true });
      mockInteraction.options.get.mockImplementation((name: string) => {
        if (name === 'identifier') return { value: 'test123' };
        return undefined;
      });
      mockBlacklistService.addEntry.mockRejectedValue(new Error('Duplicate entry: An entry with identifier "test123" already exists'));
      mockInteraction.deferred = true;

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ This identifier is already blacklisted.'
      });
    });

    it('should handle validation errors', async () => {
      // Arrange
      mockPermissionMiddleware.requireAdmin.mockResolvedValue({ allowed: true });
      mockInteraction.options.get.mockImplementation((name: string) => {
        if (name === 'identifier') return { value: 'test123' };
        return undefined;
      });
      mockBlacklistService.addEntry.mockRejectedValue(new Error('Validation failed: Identifier cannot be empty'));
      mockInteraction.deferred = true;

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Invalid input: Identifier cannot be empty'
      });
    });

    it('should handle database errors', async () => {
      // Arrange
      mockPermissionMiddleware.requireAdmin.mockResolvedValue({ allowed: true });
      mockInteraction.options.get.mockImplementation((name: string) => {
        if (name === 'identifier') return { value: 'test123' };
        return undefined;
      });
      mockBlacklistService.addEntry.mockRejectedValue(new Error('Failed to add blacklist entry to database'));
      mockInteraction.deferred = true;

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Database error occurred. Please try again later.'
      });
    });

    it('should handle generic errors', async () => {
      // Arrange
      mockPermissionMiddleware.requireAdmin.mockResolvedValue({ allowed: true });
      mockInteraction.options.get.mockImplementation((name: string) => {
        if (name === 'identifier') return { value: 'test123' };
        return undefined;
      });
      mockBlacklistService.addEntry.mockRejectedValue(new Error('Some unexpected error'));
      mockInteraction.deferred = false;

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '❌ Failed to add blacklist entry.',
        ephemeral: true
      });
    });

    it('should trim whitespace from input parameters', async () => {
      // Arrange
      mockPermissionMiddleware.requireAdmin.mockResolvedValue({ allowed: true });
      mockInteraction.options.get.mockImplementation((name: string) => {
        if (name === 'identifier') return { value: '  test123  ' };
        if (name === 'firstname') return { value: '  John  ' };
        if (name === 'lastname') return { value: '  Doe  ' };
        return undefined;
      });
      mockBlacklistService.addEntry.mockResolvedValue(3);

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockBlacklistService.addEntry).toHaveBeenCalledWith({
        identifier: 'test123',
        firstName: 'John',
        lastName: 'Doe',
        createdBy: 'user123'
      });
    });

    it('should ignore empty string names', async () => {
      // Arrange
      mockPermissionMiddleware.requireAdmin.mockResolvedValue({ allowed: true });
      mockInteraction.options.get.mockImplementation((name: string) => {
        if (name === 'identifier') return { value: 'test123' };
        if (name === 'firstname') return { value: '   ' };
        if (name === 'lastname') return { value: '' };
        return undefined;
      });
      mockBlacklistService.addEntry.mockResolvedValue(4);

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockBlacklistService.addEntry).toHaveBeenCalledWith({
        identifier: 'test123',
        createdBy: 'user123'
      });
    });
  });

  describe('getCommandName', () => {
    it('should return correct command name', () => {
      expect(AddBlacklistCommand.getCommandName()).toBe('addbl');
    });
  });
});