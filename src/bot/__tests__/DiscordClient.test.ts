import { DiscordClient } from '../DiscordClient';
import { EnvironmentConfig } from '../../config/environment';
import { Client } from 'discord.js';

// Mock Discord.js
jest.mock('discord.js', () => {
  const mockClient = {
    login: jest.fn(),
    destroy: jest.fn(),
    once: jest.fn(),
    on: jest.fn(),
    user: {
      id: 'mock-bot-id',
      tag: 'MockBot#1234',
      setStatus: jest.fn()
    },
    guilds: {
      cache: {
        size: 5
      }
    },
    readyAt: new Date(),
    uptime: 123456
  };

  return {
    Client: jest.fn(() => mockClient),
    GatewayIntentBits: {
      Guilds: 1,
      GuildMessages: 2
    },
    Events: {
      ClientReady: 'ready',
      InteractionCreate: 'interactionCreate',
      Error: 'error',
      Warn: 'warn',
      ShardDisconnect: 'shardDisconnect',
      ShardReconnecting: 'shardReconnecting'
    },
    REST: jest.fn(() => ({
      setToken: jest.fn().mockReturnThis(),
      put: jest.fn()
    })),
    Routes: {
      applicationCommands: jest.fn()
    },
    Collection: jest.fn(() => new Map())
  };
});

// Mock environment config
jest.mock('../../config/environment');

// Mock command classes
jest.mock('../../commands/addbl');
jest.mock('../../commands/checkbl');
jest.mock('../../commands/removebl');

describe('DiscordClient', () => {
  let mockConfig: jest.Mocked<EnvironmentConfig>;
  let discordClient: DiscordClient;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = {
      discordToken: 'mock-discord-token',
      mysqlUrl: 'mysql://mock-url',
      adminRoleId: '123456789012345678',
      nodeEnv: 'test',
      isDevelopment: false,
      isProduction: false,
      isTest: true,
      getAllConfig: jest.fn()
    } as any;

    (EnvironmentConfig.getInstance as jest.Mock).mockReturnValue(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize Discord client with correct intents', () => {
      discordClient = new DiscordClient(mockConfig);
      
      expect(Client).toHaveBeenCalledWith({
        intents: [1, 2] // Guilds and GuildMessages
      });
    });

    it('should use EnvironmentConfig.getInstance() when no config provided', () => {
      discordClient = new DiscordClient();
      
      expect(EnvironmentConfig.getInstance).toHaveBeenCalled();
    });
  });

  describe('start', () => {
    beforeEach(() => {
      discordClient = new DiscordClient(mockConfig);
    });

    it('should login with Discord token', async () => {
      const mockClient = (discordClient as any).client;
      mockClient.login.mockResolvedValue('mock-token');

      await discordClient.start();

      expect(mockClient.login).toHaveBeenCalledWith('mock-discord-token');
    });

    it('should throw error if login fails', async () => {
      const mockClient = (discordClient as any).client;
      const loginError = new Error('Login failed');
      mockClient.login.mockRejectedValue(loginError);

      await expect(discordClient.start()).rejects.toThrow('Login failed');
    });
  });

  describe('stop', () => {
    beforeEach(() => {
      discordClient = new DiscordClient(mockConfig);
    });

    it('should set status to invisible and destroy client', async () => {
      const mockClient = (discordClient as any).client;

      await discordClient.stop();

      expect(mockClient.user.setStatus).toHaveBeenCalledWith('invisible');
      expect(mockClient.destroy).toHaveBeenCalled();
    });

    it('should not stop twice', async () => {
      const mockClient = (discordClient as any).client;

      await discordClient.stop();
      await discordClient.stop(); // Second call should be ignored

      expect(mockClient.destroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('utility methods', () => {
    beforeEach(() => {
      discordClient = new DiscordClient(mockConfig);
    });

    it('should return Discord client instance', () => {
      const client = discordClient.getClient();
      expect(client).toBeDefined();
    });

    it('should return ready status', () => {
      const isReady = discordClient.isReady();
      expect(typeof isReady).toBe('boolean');
    });

    it('should return uptime', () => {
      const uptime = discordClient.getUptime();
      expect(typeof uptime).toBe('number');
    });

    it('should return guild count', () => {
      const guildCount = discordClient.getGuildCount();
      expect(guildCount).toBe(5);
    });
  });

  describe('event handlers', () => {
    beforeEach(() => {
      discordClient = new DiscordClient(mockConfig);
    });

    it('should setup event handlers on construction', () => {
      const mockClient = (discordClient as any).client;

      expect(mockClient.once).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('interactionCreate', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('warn', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('shardDisconnect', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('shardReconnecting', expect.any(Function));
    });
  });

  describe('graceful shutdown', () => {
    let originalProcessOn: typeof process.on;
    let mockProcessOn: jest.Mock;

    beforeEach(() => {
      originalProcessOn = process.on;
      mockProcessOn = jest.fn();
      process.on = mockProcessOn;
    });

    afterEach(() => {
      process.on = originalProcessOn;
    });

    it('should setup graceful shutdown handlers', () => {
      discordClient = new DiscordClient(mockConfig);

      expect(mockProcessOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(mockProcessOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(mockProcessOn).toHaveBeenCalledWith('SIGQUIT', expect.any(Function));
      expect(mockProcessOn).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(mockProcessOn).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });
  });
});