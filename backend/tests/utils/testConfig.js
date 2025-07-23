/**
 * @fileoverview Test configuration utilities for export functionality
 * @module tests/utils/testConfig
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load test environment configuration
 * @function loadTestConfig
 * @returns {void}
 */
export const loadTestConfig = () => {
  // Load test environment variables
  const testEnvPath = path.join(__dirname, '..', '..', '.env.test');
  dotenv.config({ path: testEnvPath });
  
  // Override NODE_ENV to ensure test environment
  process.env.NODE_ENV = 'test';
  
  console.log('✅ Test configuration loaded');
};

/**
 * Get test export configuration
 * @function getTestExportConfig
 * @returns {Object} Export configuration for tests
 */
export const getTestExportConfig = () => {
  return {
    exportDir: process.env.EXPORT_DIR || './data',
    fileTTL: parseInt(process.env.EXPORT_FILE_TTL) || 86400, // 24 hours
    maxFileSize: parseInt(process.env.EXPORT_MAX_FILE_SIZE) || 10485760, // 10MB
    cacheTTL: parseInt(process.env.EXPORT_CACHE_TTL) || 3600, // 1 hour
    rateLimit: parseInt(process.env.EXPORT_RATE_LIMIT) || 10,
    rateWindow: parseInt(process.env.EXPORT_RATE_WINDOW) || 60000, // 1 minute
    cleanupInterval: parseInt(process.env.EXPORT_CLEANUP_INTERVAL) || 3600000 // 1 hour
  };
};

/**
 * Get test database configuration
 * @function getTestDBConfig
 * @returns {Object} Database configuration for tests
 */
export const getTestDBConfig = () => {
  return {
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27018/task_analytics_test',
    redisHost: process.env.REDIS_HOST || 'localhost',
    redisPort: parseInt(process.env.REDIS_PORT) || 6380
  };
};

/**
 * Get test server configuration
 * @function getTestServerConfig
 * @returns {Object} Server configuration for tests
 */
export const getTestServerConfig = () => {
  return {
    port: parseInt(process.env.PORT) || 3001,
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    socketCorsOrigin: process.env.SOCKET_IO_CORS_ORIGIN || 'http://localhost:5173',
    jwtSecret: process.env.JWT_SECRET || 'test-jwt-secret-key'
  };
};

/**
 * Reset test environment
 * @function resetTestEnvironment
 * @returns {void}
 */
export const resetTestEnvironment = () => {
  // Clear any test-specific environment variables that might interfere
  delete process.env.MONGODB_URI;
  delete process.env.REDIS_HOST;
  delete process.env.REDIS_PORT;
  
  // Reload test configuration
  loadTestConfig();
  
  console.log('✅ Test environment reset');
};

/**
 * Check if running in test environment
 * @function isTestEnvironment
 * @returns {boolean} True if in test environment
 */
export const isTestEnvironment = () => {
  return process.env.NODE_ENV === 'test';
};