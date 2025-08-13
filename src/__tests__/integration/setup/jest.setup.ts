import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment
process.env['NODE_ENV'] = 'test';

// Ensure required test environment variables are set
const requiredEnvVars = ['MYSQL_URL', 'DISCORD_TOKEN', 'ADMIN_ROLE_ID'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`Missing required test environment variables: ${missingVars.join(', ')}`);
  console.error('Please create a .env.test file with the required variables for integration testing.');
  process.exit(1);
}

// Increase Jest timeout for database operations
jest.setTimeout(60000);

// Global test setup
beforeAll(async () => {
  console.log('Setting up integration test environment...');
});

// Global test teardown
afterAll(async () => {
  console.log('Cleaning up integration test environment...');
  
  // Give time for async operations to complete
  await new Promise(resolve => setTimeout(resolve, 1000));
});