# Test Infrastructure for Export Functionality

This directory contains comprehensive test infrastructure for the Task Export and Advanced Filtering System.

## Overview

The test infrastructure provides utilities for:
- In-memory database testing with MongoDB Memory Server
- File system operations for export file testing
- Mock data generation for consistent test scenarios
- Environment configuration for test isolation
- Comprehensive setup and teardown utilities

## Test Utilities

### Database Testing (`utils/testDatabase.js`)
- **connectTestDB()**: Connects to in-memory MongoDB instance
- **disconnectTestDB()**: Disconnects and cleans up test database
- **clearTestDB()**: Clears all collections in test database
- **dropTestDB()**: Drops all collections in test database

### File System Helpers (`utils/fileHelpers.js`)
- **ensureTestExportDir()**: Creates test export directory
- **cleanupTestExportDir()**: Removes test export directory and files
- **createTestExportFile()**: Creates test export files with content
- **testExportFileExists()**: Checks if test export file exists
- **getTestExportFileStats()**: Gets file statistics
- **generateSampleCSV()**: Generates CSV content from data
- **generateSampleJSON()**: Generates JSON content from data

### Mock Data Generation (`utils/mockData.js`)
- **generateMockTask()**: Creates single mock task with overrides
- **generateMockTasks()**: Creates multiple mock tasks with variations
- **createMockTasks()**: Creates mock tasks in database
- **generateMockExport()**: Creates mock export data
- **generateMockExports()**: Creates multiple mock exports
- **generateMockFilters()**: Creates various filter combinations
- **cleanupMockData()**: Removes all mock data from database

### Test Configuration (`utils/testConfig.js`)
- **loadTestConfig()**: Loads test environment variables
- **getTestExportConfig()**: Gets export-specific configuration
- **getTestDBConfig()**: Gets database configuration for tests
- **getTestServerConfig()**: Gets server configuration for tests
- **resetTestEnvironment()**: Resets test environment
- **isTestEnvironment()**: Checks if running in test mode

### Test Setup (`utils/testSetup.js`)
- **setupTestEnvironment()**: Complete test environment setup
- **teardownTestEnvironment()**: Complete test environment cleanup
- **cleanTestEnvironment()**: Clean between individual tests
- **setupTestSuite()**: Setup with before/after hooks
- **withTestEnvironment()**: Run function in isolated test environment

## Usage Examples

### Basic Test Setup

```javascript
import { test, describe, before, after, beforeEach } from 'node:test';
import { setupTestEnvironment, teardownTestEnvironment, cleanTestEnvironment } from './utils/testSetup.js';

describe('Export Tests', () => {
  before(async () => {
    await setupTestEnvironment();
  });

  after(async () => {
    await teardownTestEnvironment();
  });

  beforeEach(async () => {
    await cleanTestEnvironment();
  });

  test('should export tasks', async () => {
    // Your test code here
  });
});
```

### Using Mock Data

```javascript
import { createMockTasks, generateMockExport } from './utils/mockData.js';

test('should process export with mock data', async () => {
  // Create 10 mock tasks in database
  const tasks = await createMockTasks(10);
  
  // Generate mock export configuration
  const exportConfig = generateMockExport({
    format: 'csv',
    filters: { status: 'pending' }
  });
  
  // Your test logic here
});
```

### File System Testing

```javascript
import { createTestExportFile, testExportFileExists } from './utils/fileHelpers.js';

test('should create export file', async () => {
  const content = 'id,title,status\n1,Test,pending';
  await createTestExportFile('test.csv', content);
  
  const exists = await testExportFileExists('test.csv');
  assert(exists === true);
});
```

## Environment Configuration

### Test Environment Variables (`.env.test`)
- `NODE_ENV=test`: Ensures test environment
- `EXPORT_DIR=./test-exports`: Test export directory
- `EXPORT_FILE_TTL=86400`: File time-to-live in seconds
- `EXPORT_MAX_FILE_SIZE=10485760`: Maximum file size (10MB)
- `EXPORT_CACHE_TTL=3600`: Cache time-to-live in seconds
- `EXPORT_RATE_LIMIT=10`: Rate limit for exports
- `EXPORT_RATE_WINDOW=60000`: Rate limit window in milliseconds

### Test Scripts

```bash
# Run all tests including infrastructure
npm test

# Run only export-related tests
npm run test:export

# Run with coverage
npm run test:coverage
```

## Dependencies

- **mongodb-memory-server**: In-memory MongoDB for testing
- **node:test**: Node.js built-in test runner
- **node:assert**: Node.js built-in assertions

## Best Practices

1. **Always use test environment**: Tests automatically load `.env.test`
2. **Clean between tests**: Use `cleanTestEnvironment()` in `beforeEach`
3. **Isolate file operations**: Use test-specific directories
4. **Mock external dependencies**: Use provided mock utilities
5. **Verify cleanup**: Ensure tests clean up after themselves

## File Structure

```
tests/
├── utils/
│   ├── testDatabase.js      # Database testing utilities
│   ├── fileHelpers.js       # File system helpers
│   ├── mockData.js          # Mock data generation
│   ├── testConfig.js        # Test configuration
│   ├── testSetup.js         # Comprehensive setup
│   └── testInfrastructure.test.js  # Infrastructure verification
├── models/                  # Model tests
├── services/                # Service tests
├── routes/                  # Route tests
└── README.md               # This file
```

## Troubleshooting

### Common Issues

1. **MongoDB Memory Server fails to start**
   - Ensure sufficient memory available
   - Check Node.js version compatibility

2. **File system permission errors**
   - Verify write permissions in test directory
   - Check if test cleanup is running properly

3. **Test environment not loading**
   - Verify `.env.test` file exists
   - Check `NODE_ENV` is set to 'test'

### Debug Tips

- Use `console.log()` statements in test utilities
- Check test output for setup/teardown messages
- Verify mock data is being created correctly
- Ensure database connections are properly closed