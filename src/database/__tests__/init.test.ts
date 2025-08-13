import { initializeDatabase } from '../init';
import { DatabaseConnection, DatabaseSchema } from '../index';

// Mock the database modules
jest.mock('../connection');
jest.mock('../schema');

describe('initializeDatabase', () => {
  let mockDbInstance: jest.Mocked<DatabaseConnection>;
  let mockSchemaInstance: jest.Mocked<DatabaseSchema>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDbInstance = {
      connect: jest.fn(),
      disconnect: jest.fn(),
    } as any;

    mockSchemaInstance = {
      initializeSchema: jest.fn(),
      verifySchema: jest.fn(),
      getTableStats: jest.fn(),
    } as any;

    const mockGetDbInstance = jest.fn().mockReturnValue(mockDbInstance);
    (DatabaseConnection.getInstance as jest.Mock) = mockGetDbInstance;

    // Mock DatabaseSchema constructor
    (DatabaseSchema as jest.MockedClass<typeof DatabaseSchema>).mockImplementation(() => mockSchemaInstance);

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize database successfully', async () => {
    mockSchemaInstance.verifySchema.mockResolvedValue(true);
    mockSchemaInstance.getTableStats.mockResolvedValue({
      totalEntries: 0,
      oldestEntry: null,
      newestEntry: null
    });

    await initializeDatabase();

    expect(mockDbInstance.connect).toHaveBeenCalled();
    expect(mockSchemaInstance.initializeSchema).toHaveBeenCalled();
    expect(mockSchemaInstance.verifySchema).toHaveBeenCalled();
    expect(mockSchemaInstance.getTableStats).toHaveBeenCalled();
    expect(mockDbInstance.disconnect).toHaveBeenCalled();

    expect(console.log).toHaveBeenCalledWith('Starting database initialization...');
    expect(console.log).toHaveBeenCalledWith('Connected to database successfully');
    expect(console.log).toHaveBeenCalledWith('Database initialization completed successfully');
    expect(console.log).toHaveBeenCalledWith('Current entries: 0');
  });

  it('should handle connection errors', async () => {
    const error = new Error('Connection failed');
    mockDbInstance.connect.mockRejectedValue(error);

    await expect(initializeDatabase()).rejects.toThrow('Connection failed');

    expect(mockDbInstance.connect).toHaveBeenCalled();
    expect(mockDbInstance.disconnect).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('Database initialization failed:', error);
  });

  it('should handle schema initialization errors', async () => {
    const error = new Error('Schema initialization failed');
    mockSchemaInstance.initializeSchema.mockRejectedValue(error);

    await expect(initializeDatabase()).rejects.toThrow('Schema initialization failed');

    expect(mockDbInstance.connect).toHaveBeenCalled();
    expect(mockSchemaInstance.initializeSchema).toHaveBeenCalled();
    expect(mockDbInstance.disconnect).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('Database initialization failed:', error);
  });

  it('should handle schema verification failure', async () => {
    mockSchemaInstance.verifySchema.mockResolvedValue(false);

    await expect(initializeDatabase()).rejects.toThrow('Schema verification failed');

    expect(mockDbInstance.connect).toHaveBeenCalled();
    expect(mockSchemaInstance.initializeSchema).toHaveBeenCalled();
    expect(mockSchemaInstance.verifySchema).toHaveBeenCalled();
    expect(mockDbInstance.disconnect).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('Database initialization failed:', expect.any(Error));
  });

  it('should handle stats retrieval errors gracefully', async () => {
    mockSchemaInstance.verifySchema.mockResolvedValue(true);
    mockSchemaInstance.getTableStats.mockResolvedValue({
      totalEntries: 5,
      oldestEntry: new Date('2023-01-01'),
      newestEntry: new Date('2023-12-31')
    });

    await initializeDatabase();

    expect(mockSchemaInstance.getTableStats).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith('Current entries: 5');
  });

  it('should always disconnect even on error', async () => {
    const error = new Error('Some error');
    mockSchemaInstance.initializeSchema.mockRejectedValue(error);

    await expect(initializeDatabase()).rejects.toThrow('Some error');

    expect(mockDbInstance.disconnect).toHaveBeenCalled();
  });
});