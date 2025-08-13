import { BlacklistService, IBlacklistService } from '../BlacklistService';
import { IBlacklistRepository } from '../../database/BlacklistRepository';
import { BlacklistEntry, CreateBlacklistEntryInput } from '../../models/BlacklistEntry';
import { SearchCriteria } from '../../models/SearchCriteria';

// Mock repository implementation for testing
class MockBlacklistRepository implements IBlacklistRepository {
    private entries: BlacklistEntry[] = [];
    private nextId = 1;

    async create(entry: CreateBlacklistEntryInput): Promise<number> {
        const newEntry: BlacklistEntry = {
            id: this.nextId++,
            identifier: entry.identifier,
            createdAt: new Date(),
            createdBy: entry.createdBy
        };

        if (entry.firstName) {
            newEntry.firstName = entry.firstName;
        }

        if (entry.lastName) {
            newEntry.lastName = entry.lastName;
        }

        this.entries.push(newEntry);
        return newEntry.id!;
    }

    async findByIdentifier(identifier: string): Promise<BlacklistEntry[]> {
        return this.entries.filter(entry => entry.identifier === identifier);
    }

    async findByName(firstName?: string, lastName?: string): Promise<BlacklistEntry[]> {
        return this.entries.filter(entry => {
            const firstNameMatch = !firstName || (entry.firstName && entry.firstName.includes(firstName));
            const lastNameMatch = !lastName || (entry.lastName && entry.lastName.includes(lastName));
            return firstNameMatch && lastNameMatch;
        });
    }

    async search(criteria: SearchCriteria): Promise<BlacklistEntry[]> {
        return this.entries.filter(entry => {
            const identifierMatch = !criteria.identifier || entry.identifier === criteria.identifier;
            const firstNameMatch = !criteria.firstName || (entry.firstName && entry.firstName.includes(criteria.firstName));
            const lastNameMatch = !criteria.lastName || (entry.lastName && entry.lastName.includes(criteria.lastName));
            return identifierMatch && firstNameMatch && lastNameMatch;
        });
    }

    async findById(id: number): Promise<BlacklistEntry | null> {
        const entry = this.entries.find(e => e.id === id);
        return entry || null;
    }

    async deleteById(id: number): Promise<boolean> {
        const index = this.entries.findIndex(e => e.id === id);
        if (index >= 0) {
            this.entries.splice(index, 1);
            return true;
        }
        return false;
    }

    async exists(identifier: string): Promise<boolean> {
        return this.entries.some(entry => entry.identifier === identifier);
    }

    // Helper methods for testing
    clear(): void {
        this.entries = [];
        this.nextId = 1;
    }

    getAll(): BlacklistEntry[] {
        return [...this.entries];
    }
}

describe('BlacklistService', () => {
    let service: IBlacklistService;
    let mockRepository: MockBlacklistRepository;

    beforeEach(() => {
        mockRepository = new MockBlacklistRepository();
        service = new BlacklistService(mockRepository);
    });

    afterEach(() => {
        mockRepository.clear();
    });

    describe('addEntry', () => {
        it('should successfully add a valid entry', async () => {
            // Requirement 1.2: Entry validation and duplicate checking
            const entry: CreateBlacklistEntryInput = {
                identifier: 'test123',
                firstName: 'John',
                lastName: 'Doe',
                createdBy: 'user123'
            };

            const entryId = await service.addEntry(entry);

            expect(entryId).toBe(1);
            const allEntries = mockRepository.getAll();
            expect(allEntries).toHaveLength(1);
            expect(allEntries[0]?.identifier).toBe('test123');
            expect(allEntries[0]?.firstName).toBe('John');
            expect(allEntries[0]?.lastName).toBe('Doe');
        });

        it('should add entry with only required fields', async () => {
            const entry: CreateBlacklistEntryInput = {
                identifier: 'phone123',
                createdBy: 'user456'
            };

            const entryId = await service.addEntry(entry);

            expect(entryId).toBe(1);
            const allEntries = mockRepository.getAll();
            expect(allEntries).toHaveLength(1);
            expect(allEntries[0]?.identifier).toBe('phone123');
            expect(allEntries[0]?.firstName).toBeUndefined();
            expect(allEntries[0]?.lastName).toBeUndefined();
        });

        it('should trim whitespace from input fields', async () => {
            const entry: CreateBlacklistEntryInput = {
                identifier: '  test123  ',
                firstName: '  John  ',
                lastName: '  Doe  ',
                createdBy: '  user123  '
            };

            await service.addEntry(entry);

            const allEntries = mockRepository.getAll();
            expect(allEntries[0]?.identifier).toBe('test123');
            expect(allEntries[0]?.firstName).toBe('John');
            expect(allEntries[0]?.lastName).toBe('Doe');
        });

        it('should throw error for invalid entry - missing identifier', async () => {
            const entry: CreateBlacklistEntryInput = {
                identifier: '',
                createdBy: 'user123'
            };

            await expect(service.addEntry(entry)).rejects.toThrow('Validation failed');
        });

        it('should throw error for invalid entry - missing createdBy', async () => {
            const entry: CreateBlacklistEntryInput = {
                identifier: 'test123',
                createdBy: ''
            };

            await expect(service.addEntry(entry)).rejects.toThrow('Validation failed');
        });

        it('should throw error for duplicate identifier', async () => {
            // Add first entry
            const entry1: CreateBlacklistEntryInput = {
                identifier: 'duplicate123',
                createdBy: 'user123'
            };
            await service.addEntry(entry1);

            // Try to add duplicate
            const entry2: CreateBlacklistEntryInput = {
                identifier: 'duplicate123',
                createdBy: 'user456'
            };

            await expect(service.addEntry(entry2)).rejects.toThrow('Duplicate entry');
        });

        it('should throw error for identifier too long', async () => {
            const entry: CreateBlacklistEntryInput = {
                identifier: 'a'.repeat(256), // Exceeds 255 character limit
                createdBy: 'user123'
            };

            await expect(service.addEntry(entry)).rejects.toThrow('Validation failed');
        });
    });

    describe('searchEntries', () => {
        beforeEach(async () => {
            // Add test data
            await service.addEntry({
                identifier: 'phone123',
                firstName: 'John',
                lastName: 'Doe',
                createdBy: 'user1'
            });
            await service.addEntry({
                identifier: 'account456',
                firstName: 'Jane',
                lastName: 'Smith',
                createdBy: 'user2'
            });
            await service.addEntry({
                identifier: 'phone789',
                firstName: 'John',
                lastName: 'Johnson',
                createdBy: 'user3'
            });
        });

        it('should search by identifier (exact match)', async () => {
            // Requirement 2.5: Search logic with partial name matching
            const criteria: SearchCriteria = {
                identifier: 'phone123'
            };

            const results = await service.searchEntries(criteria);

            expect(results).toHaveLength(1);
            expect(results[0]?.identifier).toBe('phone123');
            expect(results[0]?.firstName).toBe('John');
        });

        it('should search by first name (partial match)', async () => {
            const criteria: SearchCriteria = {
                firstName: 'Joh'
            };

            const results = await service.searchEntries(criteria);

            expect(results).toHaveLength(2);
            expect(results.every(r => r.firstName?.includes('Joh'))).toBe(true);
        });

        it('should search by last name (partial match)', async () => {
            const criteria: SearchCriteria = {
                lastName: 'Doe'
            };

            const results = await service.searchEntries(criteria);

            expect(results).toHaveLength(1);
            expect(results[0]?.lastName).toBe('Doe');
        });

        it('should search by multiple criteria', async () => {
            const criteria: SearchCriteria = {
                firstName: 'John',
                lastName: 'Johnson'
            };

            const results = await service.searchEntries(criteria);

            expect(results).toHaveLength(1);
            expect(results[0]?.firstName).toBe('John');
            expect(results[0]?.lastName).toBe('Johnson');
        });

        it('should return empty array when no matches found', async () => {
            const criteria: SearchCriteria = {
                identifier: 'nonexistent'
            };

            const results = await service.searchEntries(criteria);

            expect(results).toHaveLength(0);
        });

        it('should throw error for empty search criteria', async () => {
            const criteria: SearchCriteria = {};

            await expect(service.searchEntries(criteria)).rejects.toThrow('Search validation failed');
        });

        it('should throw error for invalid search criteria', async () => {
            const criteria: SearchCriteria = {
                identifier: ''
            };

            await expect(service.searchEntries(criteria)).rejects.toThrow('Search validation failed');
        });

        it('should trim whitespace from search criteria', async () => {
            const criteria: SearchCriteria = {
                firstName: '  John  '
            };

            const results = await service.searchEntries(criteria);

            expect(results).toHaveLength(2);
        });
    });

    describe('removeEntry', () => {
        let entryId: number;

        beforeEach(async () => {
            // Add test entry
            entryId = await service.addEntry({
                identifier: 'toDelete123',
                firstName: 'Delete',
                lastName: 'Me',
                createdBy: 'user123'
            });
        });

        it('should successfully remove existing entry', async () => {
            // Requirement 3.3: Remove entry with validation
            const removed = await service.removeEntry(entryId);

            expect(removed).toBe(true);
            expect(mockRepository.getAll()).toHaveLength(0);
        });

        it('should return false when entry does not exist', async () => {
            const removed = await service.removeEntry(999);

            expect(removed).toBe(false);
            expect(mockRepository.getAll()).toHaveLength(1); // Original entry still exists
        });

        it('should throw error for invalid ID - zero', async () => {
            await expect(service.removeEntry(0)).rejects.toThrow('Invalid ID');
        });

        it('should throw error for invalid ID - negative', async () => {
            await expect(service.removeEntry(-1)).rejects.toThrow('Invalid ID');
        });

        it('should throw error for invalid ID - non-number', async () => {
            await expect(service.removeEntry('invalid' as any)).rejects.toThrow('Invalid ID');
        });
    });

    describe('checkDuplicate', () => {
        beforeEach(async () => {
            // Add test entry
            await service.addEntry({
                identifier: 'existing123',
                createdBy: 'user123'
            });
        });

        it('should return true for existing identifier', async () => {
            // Requirement 1.2: Duplicate checking functionality
            const isDuplicate = await service.checkDuplicate('existing123');

            expect(isDuplicate).toBe(true);
        });

        it('should return false for non-existing identifier', async () => {
            const isDuplicate = await service.checkDuplicate('nonexistent123');

            expect(isDuplicate).toBe(false);
        });

        it('should trim whitespace from identifier', async () => {
            const isDuplicate = await service.checkDuplicate('  existing123  ');

            expect(isDuplicate).toBe(true);
        });

        it('should throw error for empty identifier', async () => {
            await expect(service.checkDuplicate('')).rejects.toThrow('Invalid identifier');
        });

        it('should throw error for null identifier', async () => {
            await expect(service.checkDuplicate(null as any)).rejects.toThrow('Invalid identifier');
        });
    });

    describe('findByIdentifier', () => {
        beforeEach(async () => {
            await service.addEntry({
                identifier: 'find123',
                firstName: 'Find',
                lastName: 'Me',
                createdBy: 'user123'
            });
        });

        it('should find entry by exact identifier match', async () => {
            const results = await service.findByIdentifier('find123');

            expect(results).toHaveLength(1);
            expect(results[0]?.identifier).toBe('find123');
        });

        it('should return empty array for non-existing identifier', async () => {
            const results = await service.findByIdentifier('nonexistent');

            expect(results).toHaveLength(0);
        });

        it('should throw error for empty identifier', async () => {
            await expect(service.findByIdentifier('')).rejects.toThrow('Invalid identifier');
        });
    });

    describe('findByName', () => {
        beforeEach(async () => {
            await service.addEntry({
                identifier: 'name1',
                firstName: 'John',
                lastName: 'Doe',
                createdBy: 'user1'
            });
            await service.addEntry({
                identifier: 'name2',
                firstName: 'Jane',
                lastName: 'Doe',
                createdBy: 'user2'
            });
        });

        it('should find entries by first name', async () => {
            const results = await service.findByName('John');

            expect(results).toHaveLength(1);
            expect(results[0]?.firstName).toBe('John');
        });

        it('should find entries by last name', async () => {
            const results = await service.findByName(undefined, 'Doe');

            expect(results).toHaveLength(2);
        });

        it('should find entries by both names', async () => {
            const results = await service.findByName('John', 'Doe');

            expect(results).toHaveLength(1);
            expect(results[0]?.firstName).toBe('John');
            expect(results[0]?.lastName).toBe('Doe');
        });

        it('should throw error when no name parameters provided', async () => {
            await expect(service.findByName()).rejects.toThrow('At least one name parameter must be provided');
        });
    });

    describe('getById', () => {
        let entryId: number;

        beforeEach(async () => {
            entryId = await service.addEntry({
                identifier: 'getById123',
                firstName: 'Get',
                lastName: 'ById',
                createdBy: 'user123'
            });
        });

        it('should get entry by valid ID', async () => {
            const entry = await service.getById(entryId);

            expect(entry).not.toBeNull();
            expect(entry!.id).toBe(entryId);
            expect(entry!.identifier).toBe('getById123');
        });

        it('should return null for non-existing ID', async () => {
            const entry = await service.getById(999);

            expect(entry).toBeNull();
        });

        it('should throw error for invalid ID', async () => {
            await expect(service.getById(0)).rejects.toThrow('Invalid ID');
        });
    });
});