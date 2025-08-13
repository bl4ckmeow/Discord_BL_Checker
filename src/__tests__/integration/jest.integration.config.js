const path = require('path');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: path.resolve(__dirname, '../../..'), // Point to project root
  roots: ['<rootDir>/src/__tests__/integration'],
  testMatch: ['**/*.integration.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/__tests__/**/*',
  ],
  coverageDirectory: 'coverage/integration',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/integration/setup/jest.setup.ts'],
  testTimeout: 60000, // 60 seconds for database operations
  maxWorkers: 1, // Run tests sequentially to avoid database conflicts
  verbose: true,
  forceExit: true, // Ensure Jest exits after tests complete
  detectOpenHandles: true, // Help detect async operations that prevent Jest from exiting
};