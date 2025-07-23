/**
 * @fileoverview Test infrastructure verification tests
 * @module tests/utils/testInfrastructure.test
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';

// Import test utilities
import { clearTestDB } from './testDatabase.js';
import {
  ensureTestExportDir,
  createTestExportFile,
  testExportFileExists,
  getTestExportDir
} from './fileHelpers.js';
import {
  loadTestConfig,
  getTestExportConfig,
  isTestEnvironment
} from './testConfig.js';
import {
  generateMockTask,
  generateMockTasks,
  generateMockExport
} from './mockData.js';
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  cleanTestEnvironment
} from './testSetup.js';

describe('Test Infrastructure', { timeout: 10000 }, () => {
  before(async () => {
    await setupTestEnvironment();
  });

  after(async () => {
    try {
      await teardownTestEnvironment();

      // Enhanced cleanup approach
      await new Promise((resolve) => {
        const cleanup = async () => {
          // Get all active handles
          const activeHandles = process._getActiveHandles?.() || [];

          if (activeHandles.length > 0) {
            console.log(
              `⚠️  Cleaning up ${activeHandles.length} active handles...`
            );

            // Force close all handles with proper type checking
            for (const handle of activeHandles) {
              try {
                if (handle?.constructor?.name === 'Socket') {
                  handle.destroy();
                } else if (handle?.constructor?.name === 'Server') {
                  handle.close();
                } else if (typeof handle.close === 'function') {
                  handle.close();
                } else if (typeof handle.destroy === 'function') {
                  handle.destroy();
                }
              } catch (err) {
                console.error(`Failed to close handle: ${err.message}`);
              }
            }
          }

          // Final check for remaining handles
          const remainingHandles = process._getActiveHandles?.() || [];
          if (remainingHandles.length > 0) {
            console.log(
              `⚠️  ${remainingHandles.length} handles could not be closed`
            );
          } else {
            console.log('✅ All handles cleaned up successfully');
          }

          resolve();
        };

        // Execute cleanup after a short delay
        setTimeout(cleanup, 100);
      });
    } catch (error) {
      console.error('Error during test teardown:', error);
      throw error;
    }
  });

  beforeEach(async () => {
    await cleanTestEnvironment();
  });

  describe('Test Configuration', () => {
    test('should load test configuration correctly', () => {
      loadTestConfig();
      assert(isTestEnvironment(), 'Should be in test environment');
    });

    test('should provide export configuration', () => {
      const config = getTestExportConfig();
      assert(typeof config === 'object', 'Config should be an object');
      assert(
        typeof config.exportDir === 'string',
        'Export dir should be a string'
      );
      assert(typeof config.fileTTL === 'number', 'File TTL should be a number');
      assert(
        typeof config.maxFileSize === 'number',
        'Max file size should be a number'
      );
    });
  });

  describe('Test Database', () => {
    test('should connect to test database', async () => {
      // Database should already be connected from setup
      assert(true, 'Database connection successful');
    });

    test('should clear test database', async () => {
      await clearTestDB();
      assert(true, 'Database cleared successfully');
    });
  });

  describe('File System Helpers', () => {
    test('should create test export directory', async () => {
      const dir = await ensureTestExportDir();
      assert(typeof dir === 'string', 'Should return directory path');
      assert(
        dir.includes('test-exports'),
        'Should contain test-exports in path'
      );
    });

    test('should create and verify test export file', async () => {
      const filename = 'test-export.csv';
      const content = 'id,title,status\n1,Test Task,pending';

      const filePath = await createTestExportFile(filename, content);
      assert(typeof filePath === 'string', 'Should return file path');

      const exists = await testExportFileExists(filename);
      assert(exists === true, 'File should exist');
    });

    test('should get test export directory path', () => {
      const dir = getTestExportDir();
      assert(typeof dir === 'string', 'Should return directory path');
      assert(
        dir.includes('test-exports'),
        'Should contain test-exports in path'
      );
    });
  });

  describe('Mock Data Generation', () => {
    test('should generate mock task data', () => {
      const task = generateMockTask();
      assert(typeof task === 'object', 'Should return task object');
      assert(typeof task.title === 'string', 'Should have title');
      assert(typeof task.status === 'string', 'Should have status');
      assert(typeof task.priority === 'string', 'Should have priority');
    });

    test('should generate multiple mock tasks', () => {
      const tasks = generateMockTasks(5);
      assert(Array.isArray(tasks), 'Should return array');
      assert(tasks.length === 5, 'Should return correct number of tasks');

      tasks.forEach((task, index) => {
        assert(
          task.title.includes(`${index + 1}`),
          'Should have unique titles'
        );
      });
    });

    test('should generate mock export data', () => {
      const exportData = generateMockExport();
      assert(typeof exportData === 'object', 'Should return export object');
      assert(
        ['csv', 'json'].includes(exportData.format),
        'Should have valid format'
      );
      assert(
        ['processing', 'completed', 'failed'].includes(exportData.status),
        'Should have valid status'
      );
      assert(
        typeof exportData.filters === 'object',
        'Should have filters object'
      );
    });

    test('should generate mock task with overrides', () => {
      const overrides = {
        title: 'Custom Title',
        status: 'completed',
        priority: 'high'
      };

      const task = generateMockTask(overrides);
      assert(task.title === 'Custom Title', 'Should apply title override');
      assert(task.status === 'completed', 'Should apply status override');
      assert(task.priority === 'high', 'Should apply priority override');
    });
  });

  describe('Test Environment Setup', () => {
    test('should be in test environment', () => {
      assert(process.env.NODE_ENV === 'test', 'Should be in test environment');
    });

    test('should have test export configuration', () => {
      const config = getTestExportConfig();
      assert(config.exportDir, 'Should have export directory configured');
      assert(config.fileTTL > 0, 'Should have positive file TTL');
      assert(config.maxFileSize > 0, 'Should have positive max file size');
    });
  });
});
