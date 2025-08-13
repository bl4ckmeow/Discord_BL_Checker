import { CheckBlacklistCommand } from '../checkbl';
import { IBlacklistService } from '../../services/BlacklistService';
import { PermissionMiddleware } from '../../services/PermissionMiddleware';
import { BlacklistEntry } from '../../models/BlacklistEntry';

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
  options: { getString: jest.Mock };
  reply: jest.Mock;
  deferReply: jest.Mock;
  editReply: jest.Mock;
  deferred: boolean;
}

describe('CheckBlacklistCommand', () => {
  let command: CheckBlacklistCommand;
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
        getString: jest.fn()
      },
      reply: jest.fn(),
      deferReply: jest.fn(),
      editReply: jest.fn(),
      deferred: false
    };

    // Create command instance with mocked dependencies
    command = new CheckBlacklistCommand(mockBlacklistService as any, mockPermissionMiddleware);
  });

  describe('createSlashCommand', () => {
    it('should create a slash command with correct configuration', () => {
      const slashCommand = CheckBlacklistCommand.createSlashCommand();
      expect(slashCommand).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should successfully find blacklist entries by identifier', async () => {
      // Arrange
      mockPermissionMiddleware.requireGuildMember.mockResolvedValue({ allowed: true });
      mockInteraction.options.getString.mockImplementation((name: string) => {
        if (name === 'identifier') return 'test123';
        return null;
      });
      
      const mockEntry: BlacklistEntry = {
        id: 1,
        identifier: 'test123',
        firstName: 'John',
        lastName: 'Doe',
        createdAt: new Date('2024-01-01'),
        createdBy: 'admin123'
      };
      
      mockBlacklistService.searchEntries.mockResolvedValue([mockEntry]);

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockPermissionMiddleware.requireGuildMember).toHaveBeenCalledWith(mockInteraction);
      expect(mockBlacklistService.searchEntries).toHaveBeenCalledWith({
        identifier: 'test123'
      });
      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('[ ข้อมูล ] ตรวจพบการ Blacklist ภายในระบบ')
      });
    });

    it('should successfully find blacklist entries by name', async () => {
      // Arrange
      mockPermissionMiddleware.requireGuildMember.mockResolvedValue({ allowed: true });
      mockInteraction.options.getString.mockImplementation((name: string) => {
        if (name === 'firstname') return 'John';
        if (name === 'lastname') return 'Doe';
        return null;
      });
      
      const mockEntry: BlacklistEntry = {
        id: 1,
        identifier: 'test123',
        firstName: 'John',
        lastName: 'Doe',
        createdAt: new Date('2024-01-01'),
        createdBy: 'admin123'
      };
      
      mockBlacklistService.searchEntries.mockResolvedValue([mockEntry]);

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockBlacklistService.searchEntries).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe'
      });
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('John Doe')
      });
    });

    it('should handle multiple blacklist entries found', async () => {
      // Arrange
      mockPermissionMiddleware.requireGuildMember.mockResolvedValue({ allowed: true });
      mockInteraction.options.getString.mockImplementation((name: string) => {
        if (name === 'firstname') return 'John';
        return null;
      });
      
      const mockEntries: BlacklistEntry[] = [
        {
          id: 1,
          identifier: 'test123',
          firstName: 'John',
          lastName: 'Doe',
          createdAt: new Date('2024-01-01'),
          createdBy: 'admin123'
        },
        {
          id: 2,
          identifier: 'test456',
          firstName: 'John',
          lastName: 'Smith',
          createdAt: new Date('2024-01-02'),
          createdBy: 'admin123'
        }
      ];
      
      mockBlacklistService.searchEntries.mockResolvedValue(mockEntries);

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: expect.stringMatching(/รายการที่ 1:.*รายการที่ 2:/s)
      });
    });

    it('should return no results message when no blacklist entries found', async () => {
      // Arrange
      mockPermissionMiddleware.requireGuildMember.mockResolvedValue({ allowed: true });
      mockInteraction.options.getString.mockImplementation((name: string) => {
        if (name === 'identifier') return 'notfound';
        return null;
      });
      
      mockBlacklistService.searchEntries.mockResolvedValue([]);

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '✅ ไม่พบข้อมูลในระบบ Blacklist สำหรับเงื่อนไขการค้นหาที่ระบุ'
      });
    });

    it('should deny access for non-guild members', async () => {
      // Arrange
      mockPermissionMiddleware.requireGuildMember.mockResolvedValue({
        allowed: false,
        errorMessage: 'Guild membership required'
      });

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'Guild membership required',
        ephemeral: true
      });
      expect(mockBlacklistService.searchEntries).not.toHaveBeenCalled();
    });

    it('should handle missing search criteria', async () => {
      // Arrange
      mockPermissionMiddleware.requireGuildMember.mockResolvedValue({ allowed: true });
      mockInteraction.options.getString.mockReturnValue(null);

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'Error: Please provide at least one search criterion (identifier, first name, or last name).',
        ephemeral: true
      });
      expect(mockBlacklistService.searchEntries).not.toHaveBeenCalled();
    });

    it('should handle search validation errors', async () => {
      // Arrange
      mockPermissionMiddleware.requireGuildMember.mockResolvedValue({ allowed: true });
      mockInteraction.options.getString.mockImplementation((name: string) => {
        if (name === 'identifier') return 'test123';
        return null;
      });
      mockBlacklistService.searchEntries.mockRejectedValue(new Error('Search validation failed: Invalid criteria'));
      mockInteraction.deferred = true;

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ ข้อมูลการค้นหาไม่ถูกต้อง: Invalid criteria'
      });
    });

    it('should handle database errors', async () => {
      // Arrange
      mockPermissionMiddleware.requireGuildMember.mockResolvedValue({ allowed: true });
      mockInteraction.options.getString.mockImplementation((name: string) => {
        if (name === 'identifier') return 'test123';
        return null;
      });
      mockBlacklistService.searchEntries.mockRejectedValue(new Error('Failed to search blacklist entries'));
      mockInteraction.deferred = true;

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ เกิดข้อผิดพลาดกับฐานข้อมูล กรุณาลองใหม่อีกครั้ง'
      });
    });

    it('should handle generic errors', async () => {
      // Arrange
      mockPermissionMiddleware.requireGuildMember.mockResolvedValue({ allowed: true });
      mockInteraction.options.getString.mockImplementation((name: string) => {
        if (name === 'identifier') return 'test123';
        return null;
      });
      mockBlacklistService.searchEntries.mockRejectedValue(new Error('Some unexpected error'));
      mockInteraction.deferred = false;

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '❌ เกิดข้อผิดพลาดในการค้นหาข้อมูล Blacklist',
        ephemeral: true
      });
    });

    it('should trim whitespace from input parameters', async () => {
      // Arrange
      mockPermissionMiddleware.requireGuildMember.mockResolvedValue({ allowed: true });
      mockInteraction.options.getString.mockImplementation((name: string) => {
        if (name === 'identifier') return '  test123  ';
        if (name === 'firstname') return '  John  ';
        if (name === 'lastname') return '  Doe  ';
        return null;
      });
      mockBlacklistService.searchEntries.mockResolvedValue([]);

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockBlacklistService.searchEntries).toHaveBeenCalledWith({
        identifier: 'test123',
        firstName: 'John',
        lastName: 'Doe'
      });
    });

    it('should ignore empty string parameters', async () => {
      // Arrange
      mockPermissionMiddleware.requireGuildMember.mockResolvedValue({ allowed: true });
      mockInteraction.options.getString.mockImplementation((name: string) => {
        if (name === 'identifier') return 'test123';
        if (name === 'firstname') return '   ';
        if (name === 'lastname') return '';
        return null;
      });
      mockBlacklistService.searchEntries.mockResolvedValue([]);

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockBlacklistService.searchEntries).toHaveBeenCalledWith({
        identifier: 'test123'
      });
    });

    it('should handle entries without names', async () => {
      // Arrange
      mockPermissionMiddleware.requireGuildMember.mockResolvedValue({ allowed: true });
      mockInteraction.options.getString.mockImplementation((name: string) => {
        if (name === 'identifier') return 'test123';
        return null;
      });
      
      const mockEntry: BlacklistEntry = {
        id: 1,
        identifier: 'test123',
        createdAt: new Date('2024-01-01'),
        createdBy: 'admin123'
      };
      
      mockBlacklistService.searchEntries.mockResolvedValue([mockEntry]);

      // Act
      await command.execute(mockInteraction as any);

      // Assert
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('test123')
      });
      // Should not contain name section
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: expect.not.stringContaining('ชื่อ:')
      });
    });
  });

  describe('getCommandName', () => {
    it('should return correct command name', () => {
      expect(CheckBlacklistCommand.getCommandName()).toBe('checkbl');
    });
  });
});