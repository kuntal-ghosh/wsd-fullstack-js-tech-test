/**
 * @fileoverview Comprehensive test setup utilities for export functionality
 * @module tests/utils/testSetup
 */

import { connectTestDB, disconnectTestDB, clearTestDB } from './testDatabase.js';
import { cleanupTestExportDir, ensureTestExportDir } from './fileHelpers.js';
import { loadTestConfig, resetTestEnvironment } from './testConfig.js';
import { cleanupMockData } from './mockData.js';

/**
 * Setup test environment for export functionality tests
 * @async
 * @function setupTestEnvironment
 * @returns {Promise<void>}
 */
export const setupTestEnvironment = async () => {
  try {
    console.log('🔧 Setting up test environment...');
    
    // Load test configuration
    loadTestConfig();
    
    // Connect to test database
    await connectTestDB();
    
    // Ensure test export directory exists
    await ensureTestExportDir();
    
    console.log('✅ Test environment setup complete');
  } catch (error) {
    console.error('❌ Test environment setup failed:', error.message);
    throw error;
  }
};

/**
 * Teardown test environment after tests
 * @async
 * @function teardownTestEnvironment
 * @returns {Promise<void>}
 */
export const teardownTestEnvironment = async () => {
  try {
    console.log('🧹 Tearing down test environment...');
    
    // Clean up database
    await clearTestDB();
    await disconnectTestDB();
    
    // Clean up test files
    await cleanupTestExportDir();
    
    console.log('✅ Test environment teardown complete');
  } catch (error) {
    console.error('❌ Test environment teardown failed:', error.message);
    throw error;
  }
};

/**
 * Clean test environment between tests
 * @async
 * @function cleanTestEnvironment
 * @returns {Promise<void>}
 */
export const cleanTestEnvironment = async () => {
  try {
    console.log('🧽 Cleaning test environment...');
    
    // Clear database collections
    await clearTestDB();
    
    // Clean up any test files
    await cleanupTestExportDir();
    await ensureTestExportDir();
    
    console.log('✅ Test environment cleaned');
  } catch (error) {
    console.error('❌ Test environment cleaning failed:', error.message);
    throw error;
  }
};

/**
 * Setup test suite with proper before/after hooks
 * @function setupTestSuite
 * @param {Object} testContext - Test context object (usually from node:test)
 * @returns {Object} Test utilities and cleanup functions
 */
export const setupTestSuite = (testContext) => {
  const { before, after, beforeEach, afterEach } = testContext;
  
  // Setup before all tests
  before(async () => {
    await setupTestEnvironment();
  });
  
  // Cleanup after all tests
  after(async () => {
    await teardownTestEnvironment();
  });
  
  // Clean between each test
  beforeEach(async () => {
    await cleanTestEnvironment();
  });
  
  // Optional cleanup after each test
  afterEach(async () => {
    // Additional cleanup if needed
  });
  
  return {
    setupTestEnvironment,
    teardownTestEnvironment,
    cleanTestEnvironment
  };
};

/**
 * Create isolated test environment for a single test
 * @async
 * @function withTestEnvironment
 * @param {Function} testFunction - Test function to run in isolated environment
 * @returns {Promise<any>} Result of the test function
 */
export const withTestEnvironment = async (testFunction) => {
  await setupTestEnvironment();
  
  try {
    const result = await testFunction();
    return result;
  } finally {
    await teardownTestEnvironment();
  }
};