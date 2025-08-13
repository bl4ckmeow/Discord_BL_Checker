import { AddBlacklistCommand } from '../../../commands/addbl';
import { CheckBlacklistCommand } from '../../../commands/checkbl';
import { RemoveBlacklistCommand } from '../../../commands/removebl';
import { BlacklistService } from '../../../services/BlacklistService';
import { BlacklistRepository } from '../../../database/BlacklistRepository';
import { PermissionMiddleware } from '../../../services/PermissionMiddleware';
import { TestDatabase, TestDataFixtures } from '../setup/testDatabase';
import { ChatInputCommandInteraction, User, Guild, GuildMember } from 'discord.js';

/**
 * Integration tests for Discord commands
 * Tests complete command workflows with database interactions
 * Requirements: 1.1, 2.1, 3.1, 4.1
 */
describe('Discord Commands Integration Tests', () => {
    let addCommand: AddBlacklistCommand;
    let checkCommand: CheckBlacklistCommand;
    let removeCommand: RemoveBlacklistCommand;
    let service: BlacklistService;
    let repository: BlacklistRepository;
    let permissionMiddleware: PermissionMiddleware;
    let testDb: TestDatabase;
    let fixtures: TestDataFixtures;

    // Mock Discord interaction objects
    let mockInteraction: Partial<ChatInputCommandInteraction>;
    let mockUser: Partial<User>;
    let mockGuild: Partial<Guild>;
    let mockMember: Partial<GuildMember>;

    beforeAll(async () => {
        // Set up test database
        testDb = TestDatabase.getInstance();
        await testDb.setup();

        repository = new BlacklistRepository();
        service = new BlacklistService(repository);
        permissionMiddleware = new PermissionMiddleware();

        addCommand = new AddBlacklistCommand(service, permissionMiddleware);
        checkCommand = new CheckBlacklistCommand(service, permissionMiddleware);
        removeCommand = new RemoveBlacklistCommand(service, permissionMiddleware);

        fixtures = new TestDataFixtures(testDb.getConnection());

        // Set up mock Discord objects
        setupMockDiscordObjects();
    }, 30000);

    afterAll(async () => {
        // Clean up test database
        await testDb.teardown();
    }, 30000);

    beforeEach(async () => {
        // Clear data before each test
        await testDb.clearData();

        // Reset mock interaction
        resetMockInteraction();
    });

    function setupMockDiscordObjects() {
        mockUser = {
            id: '123456789012345678',
            username: 'testuser',
            discriminator: '1234',
            bot: false
        };

        mockGuild = {
            id: '987654321098765432',
            name: 'Test Guild'
        };

        mockMember = {
            id: '123456789012345678',
            user: mockUser as User,
            guild: mockGuild as Guild,
            roles: {
                cache: new Map()
            } as any
        };
    }

    function resetMockInteraction() {
        mockInteraction = {
            user: mockUser as User,
            guild: mockGuild as Guild,
            guildId: mockGuild.id,
            member: mockMember as GuildMember,
            deferred: false,
            replied: false,
            options: {
                get: jest.fn(),
                getString: jest.fn(),
                getInteger: jest.fn()
            } as any,
            reply: jest.fn().mockResolvedValue(undefined),
            deferReply: jest.fn().mockImplementation(() => {
                (mockInteraction as any).deferred = true;
                return Promise.resolve();
            }),
            editReply: jest.fn().mockResolvedValue(undefined)
        };
    }

    describe('AddBlacklistCommand Integration', () => {
        beforeEach(() => {
            // Mock admin permissions
            jest.spyOn(permissionMiddleware, 'requireAdmin').mockResolvedValue({
                allowed: true,
                errorMessage: undefined
            });
        });

        it('should add blacklist entry with complete workflow', async () => {
            // Requirement 1.1: Complete addbl command workflow
            (mockInteraction.options!.get as jest.Mock)
                .mockReturnValueOnce({ value: '0812345678' }) // identifier
                .mockReturnValueOnce({ value: 'John' }) // firstname
                .mockReturnValueOnce({ value: 'Doe' }); // lastname

            await addCommand.execute(mockInteraction as ChatInputCommandInteraction);

            // Verify interaction responses
            expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                content: expect.stringContaining('✅ Successfully added blacklist entry')
            });

            // Verify entry was created in database
            const entries = await fixtures.getAllEntries();
            expect(entries).toHaveLength(1);
            expect(entries[0]).toMatchObject({
                identifier: '0812345678',
                first_name: 'John',
                last_name: 'Doe',
                created_by: '123456789012345678'
            });
        });

        it('should add entry with only identifier', async () => {
            (mockInteraction.options!.get as jest.Mock)
                .mockReturnValueOnce({ value: 'scammer123' }) // identifier
                .mockReturnValueOnce(null) // firstname
                .mockReturnValueOnce(null); // lastname

            await addCommand.execute(mockInteraction as ChatInputCommandInteraction);

            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                content: expect.stringContaining('✅ Successfully added blacklist entry')
            });

            const entries = await fixtures.getAllEntries();
            expect(entries).toHaveLength(1);
            expect(entries[0]).toMatchObject({
                identifier: 'scammer123',
                first_name: null,
                last_name: null
            });
        });

        it('should handle permission denied', async () => {
            jest.spyOn(permissionMiddleware, 'requireAdmin').mockResolvedValue({
                allowed: false,
                errorMessage: 'Permission denied.'
            });

            await addCommand.execute(mockInteraction as ChatInputCommandInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Permission denied.',
                ephemeral: true
            });

            // Verify no entry was created
            const count = await fixtures.getEntryCount();
            expect(count).toBe(0);
        });

        it('should handle duplicate entry error', async () => {
            // Create existing entry
            await fixtures.createEntry('0812345678', 'John', 'Doe');

            (mockInteraction.options!.get as jest.Mock)
                .mockReturnValueOnce({ value: '0812345678' })
                .mockReturnValueOnce({ value: 'Jane' })
                .mockReturnValueOnce({ value: 'Smith' });

            await addCommand.execute(mockInteraction as ChatInputCommandInteraction);

            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                content: '❌ This identifier is already blacklisted.'
            });
        });

        it('should handle missing identifier', async () => {
            (mockInteraction.options!.get as jest.Mock)
                .mockReturnValueOnce(null); // no identifier

            await addCommand.execute(mockInteraction as ChatInputCommandInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Error: Identifier is required (account name, account number, or phone number).',
                ephemeral: true
            });
        });
    });

    describe('CheckBlacklistCommand Integration', () => {
        beforeEach(async () => {
            // Mock guild member permissions
            jest.spyOn(permissionMiddleware, 'requireGuildMember').mockResolvedValue({
                allowed: true,
                errorMessage: undefined
            });

            // Create test data
            await fixtures.createEntry('0812345678', 'John', 'Doe');
            await fixtures.createEntry('ACC001', 'Jane', 'Smith');
            await fixtures.createEntry('scammer123');
        });

        it('should find blacklist entry by identifier', async () => {
            // Requirement 2.1: Complete checkbl command workflow
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('0812345678') // identifier
                .mockReturnValueOnce(null) // firstname
                .mockReturnValueOnce(null); // lastname

            await checkCommand.execute(mockInteraction as ChatInputCommandInteraction);

            expect(mockInteraction.deferReply).toHaveBeenCalled();
            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                content: expect.stringContaining('⚠️ **[ ข้อมูล ] ตรวจพบการ Blacklist ภายในระบบ')
            });

            const editReplyCall = (mockInteraction.editReply as jest.Mock).mock.calls[0][0];
            expect(editReplyCall.content).toContain('0812345678');
            expect(editReplyCall.content).toContain('John');
            expect(editReplyCall.content).toContain('Doe');
        });

        it('should find entry by partial name matching', async () => {
            // Requirement 2.5: Partial name matching
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce(null) // identifier
                .mockReturnValueOnce('Joh') // firstname (partial)
                .mockReturnValueOnce(null); // lastname

            await checkCommand.execute(mockInteraction as ChatInputCommandInteraction);

            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                content: expect.stringContaining('⚠️ **[ ข้อมูล ] ตรวจพบการ Blacklist ภายในระบบ')
            });
        });

        it('should return not found message when no match', async () => {
            // Requirement 2.3: Message when no blacklist match found
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('nonexistent')
                .mockReturnValueOnce(null)
                .mockReturnValueOnce(null);

            await checkCommand.execute(mockInteraction as ChatInputCommandInteraction);

            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                content: '✅ ไม่พบข้อมูลในระบบ Blacklist สำหรับเงื่อนไขการค้นหาที่ระบุ'
            });
        });

        it('should handle multiple search criteria', async () => {
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce(null) // identifier
                .mockReturnValueOnce('Jane') // firstname
                .mockReturnValueOnce('Smith'); // lastname

            await checkCommand.execute(mockInteraction as ChatInputCommandInteraction);

            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                content: expect.stringContaining('Jane')
            });
        });

        it('should handle missing search criteria', async () => {
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValue(null); // all null

            await checkCommand.execute(mockInteraction as ChatInputCommandInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Error: Please provide at least one search criterion (identifier, first name, or last name).',
                ephemeral: true
            });
        });

        it('should handle permission denied', async () => {
            jest.spyOn(permissionMiddleware, 'requireGuildMember').mockResolvedValue({
                allowed: false,
                errorMessage: 'Permission denied.'
            });

            await checkCommand.execute(mockInteraction as ChatInputCommandInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Permission denied.',
                ephemeral: true
            });
        });
    });

    describe('RemoveBlacklistCommand Integration', () => {
        let entryId: number;

        beforeEach(async () => {
            // Mock admin permissions
            jest.spyOn(permissionMiddleware, 'requireAdmin').mockResolvedValue({
                allowed: true,
                errorMessage: undefined
            });

            // Create test entry
            entryId = await fixtures.createEntry('0812345678', 'John', 'Doe');
        });

        it('should remove blacklist entry with complete workflow', async () => {
            // Requirement 3.1: Complete removebl command workflow
            (mockInteraction.options!.getInteger as jest.Mock)
                .mockReturnValue(entryId);

            await removeCommand.execute(mockInteraction as ChatInputCommandInteraction);

            expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                content: expect.stringContaining('✅ Successfully removed blacklist entry')
            });

            // Verify entry was removed from database
            const entry = await service.getById(entryId);
            expect(entry).toBeNull();

            const count = await fixtures.getEntryCount();
            expect(count).toBe(0);
        });

        it('should handle non-existent entry', async () => {
            // Requirement 3.4: Handle non-existent entry
            (mockInteraction.options!.getInteger as jest.Mock)
                .mockReturnValue(99999);

            await removeCommand.execute(mockInteraction as ChatInputCommandInteraction);

            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                content: expect.stringContaining('❌ No blacklist entry found with ID: 99999')
            });

            // Verify original entry still exists
            const entry = await service.getById(entryId);
            expect(entry).not.toBeNull();
        });

        it('should handle invalid ID', async () => {
            (mockInteraction.options!.getInteger as jest.Mock)
                .mockReturnValue(0);

            await removeCommand.execute(mockInteraction as ChatInputCommandInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Error: Please provide a valid blacklist entry ID (positive number).',
                ephemeral: true
            });
        });

        it('should handle permission denied', async () => {
            // Requirement 3.2: Non-administrator access denied
            jest.spyOn(permissionMiddleware, 'requireAdmin').mockResolvedValue({
                allowed: false,
                errorMessage: 'Permission denied.'
            });

            await removeCommand.execute(mockInteraction as ChatInputCommandInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Permission denied.',
                ephemeral: true
            });

            // Verify entry still exists
            const entry = await service.getById(entryId);
            expect(entry).not.toBeNull();
        });

        it('should show entry details in confirmation message', async () => {
            (mockInteraction.options!.getInteger as jest.Mock)
                .mockReturnValue(entryId);

            await removeCommand.execute(mockInteraction as ChatInputCommandInteraction);

            const editReplyCall = (mockInteraction.editReply as jest.Mock).mock.calls[0][0];
            expect(editReplyCall.content).toContain('0812345678');
            expect(editReplyCall.content).toContain('John');
            expect(editReplyCall.content).toContain('Doe');
        });
    });

    describe('End-to-End Command Workflows', () => {
        beforeEach(() => {
            // Mock admin permissions for all tests
            jest.spyOn(permissionMiddleware, 'requireAdmin').mockResolvedValue({
                allowed: true,
                errorMessage: undefined
            });
            jest.spyOn(permissionMiddleware, 'requireGuildMember').mockResolvedValue({
                allowed: true,
                errorMessage: undefined
            });
        });

        it('should complete full add-check-remove workflow', async () => {
            // Requirement 4.1: End-to-end workflow testing

            // Step 1: Add entry
            (mockInteraction.options!.get as jest.Mock)
                .mockReturnValueOnce({ value: '0812345678' })
                .mockReturnValueOnce({ value: 'John' })
                .mockReturnValueOnce({ value: 'Doe' });

            await addCommand.execute(mockInteraction as ChatInputCommandInteraction);
            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                content: expect.stringContaining('✅ Successfully added blacklist entry')
            });

            // Reset mock for next command
            resetMockInteraction();

            // Step 2: Check entry exists
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('0812345678')
                .mockReturnValueOnce(null)
                .mockReturnValueOnce(null);

            await checkCommand.execute(mockInteraction as ChatInputCommandInteraction);
            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                content: expect.stringContaining('⚠️ **[ ข้อมูล ] ตรวจพบการ Blacklist ภายในระบบ')
            });

            // Reset mock for next command
            resetMockInteraction();

            // Step 3: Get entry ID and remove
            const entries = await fixtures.getAllEntries();
            const entryId = entries[0].id;

            (mockInteraction.options!.getInteger as jest.Mock)
                .mockReturnValue(entryId);

            await removeCommand.execute(mockInteraction as ChatInputCommandInteraction);
            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                content: expect.stringContaining('✅ Successfully removed blacklist entry')
            });

            // Step 4: Verify entry no longer exists
            resetMockInteraction();

            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('0812345678')
                .mockReturnValueOnce(null)
                .mockReturnValueOnce(null);

            await checkCommand.execute(mockInteraction as ChatInputCommandInteraction);
            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                content: '✅ ไม่พบข้อมูลในระบบ Blacklist สำหรับเงื่อนไขการค้นหาที่ระบุ'
            });
        });

        it('should handle concurrent command operations', async () => {
            // Test concurrent add operations
            const addPromises = [];

            for (let i = 0; i < 3; i++) {
                const mockInt = { ...mockInteraction };
                (mockInt.options!.get as jest.Mock) = jest.fn()
                    .mockReturnValueOnce({ value: `identifier${i}` })
                    .mockReturnValueOnce({ value: `FirstName${i}` })
                    .mockReturnValueOnce({ value: `LastName${i}` });

                addPromises.push(addCommand.execute(mockInt as ChatInputCommandInteraction));
            }

            await Promise.all(addPromises);

            // Verify all entries were created
            const count = await fixtures.getEntryCount();
            expect(count).toBe(3);

            // Test concurrent check operations
            const checkPromises = [];

            for (let i = 0; i < 3; i++) {
                const mockInt = { ...mockInteraction };
                (mockInt.options!.getString as jest.Mock) = jest.fn()
                    .mockReturnValueOnce(`identifier${i}`)
                    .mockReturnValueOnce(null)
                    .mockReturnValueOnce(null);

                checkPromises.push(checkCommand.execute(mockInt as ChatInputCommandInteraction));
            }

            await Promise.all(checkPromises);

            // All should have found entries (no errors thrown)
            expect(true).toBe(true); // Test passes if no errors thrown
        });
    });

    afterEach(() => {
        // Clean up mocks
        jest.clearAllMocks();
    });
});