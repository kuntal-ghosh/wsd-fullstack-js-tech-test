/**
 * @fileoverview File system test helpers for export functionality
 * @module tests/utils/fileHelpers
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test export directory
const TEST_EXPORT_DIR = path.join(__dirname, '..', '..', 'data');

/**
 * Ensure test export directory exists
 * @async
 * @function ensureTestExportDir
 * @returns {Promise<string>} Path to the test export directory
 */
export const ensureTestExportDir = async () => {
  try {
    await fs.mkdir(TEST_EXPORT_DIR, { recursive: true });
    return TEST_EXPORT_DIR;
  } catch (error) {
    console.error('❌ Failed to create test export directory:', error.message);
    throw error;
  }
};

/**
 * Clean up test export directory
 * @async
 * @function cleanupTestExportDir
 * @returns {Promise<void>}
 */
export const cleanupTestExportDir = async () => {
  try {
    const exists = await fs.access(TEST_EXPORT_DIR).then(() => true).catch(() => false);
    
    if (exists) {
      const files = await fs.readdir(TEST_EXPORT_DIR);
      
      for (const file of files) {
        const filePath = path.join(TEST_EXPORT_DIR, file);
        await fs.unlink(filePath);
      }
      
      await fs.rmdir(TEST_EXPORT_DIR);
      console.log('✅ Test export directory cleaned up successfully');
    }
  } catch (error) {
    console.error('❌ Test export directory cleanup failed:', error.message);
    throw error;
  }
};

/**
 * Create a test export file with sample data
 * @async
 * @function createTestExportFile
 * @param {string} filename - Name of the file to create
 * @param {string} content - Content to write to the file
 * @returns {Promise<string>} Full path to the created file
 */
export const createTestExportFile = async (filename, content) => {
  try {
    await ensureTestExportDir();
    const filePath = path.join(TEST_EXPORT_DIR, filename);
    await fs.writeFile(filePath, content, 'utf8');
    return filePath;
  } catch (error) {
    console.error('❌ Failed to create test export file:', error.message);
    throw error;
  }
};

/**
 * Read test export file content
 * @async
 * @function readTestExportFile
 * @param {string} filename - Name of the file to read
 * @returns {Promise<string>} File content
 */
export const readTestExportFile = async (filename) => {
  try {
    const filePath = path.join(TEST_EXPORT_DIR, filename);
    const content = await fs.readFile(filePath, 'utf8');
    return content;
  } catch (error) {
    console.error('❌ Failed to read test export file:', error.message);
    throw error;
  }
};

/**
 * Check if test export file exists
 * @async
 * @function testExportFileExists
 * @param {string} filename - Name of the file to check
 * @returns {Promise<boolean>} True if file exists, false otherwise
 */
export const testExportFileExists = async (filename) => {
  try {
    const filePath = path.join(TEST_EXPORT_DIR, filename);
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Get test export file stats
 * @async
 * @function getTestExportFileStats
 * @param {string} filename - Name of the file to check
 * @returns {Promise<Object>} File stats object
 */
export const getTestExportFileStats = async (filename) => {
  try {
    const filePath = path.join(TEST_EXPORT_DIR, filename);
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory()
    };
  } catch (error) {
    console.error('❌ Failed to get test export file stats:', error.message);
    throw error;
  }
};

/**
 * Delete a specific test export file
 * @async
 * @function deleteTestExportFile
 * @param {string} filename - Name of the file to delete
 * @returns {Promise<void>}
 */
export const deleteTestExportFile = async (filename) => {
  try {
    const filePath = path.join(TEST_EXPORT_DIR, filename);
    await fs.unlink(filePath);
    console.log(`✅ Test export file ${filename} deleted successfully`);
  } catch (error) {
    console.error(`❌ Failed to delete test export file ${filename}:`, error.message);
    throw error;
  }
};

/**
 * List all files in test export directory
 * @async
 * @function listTestExportFiles
 * @returns {Promise<Array<string>>} Array of filenames
 */
export const listTestExportFiles = async () => {
  try {
    const exists = await fs.access(TEST_EXPORT_DIR).then(() => true).catch(() => false);
    
    if (!exists) {
      return [];
    }
    
    const files = await fs.readdir(TEST_EXPORT_DIR);
    return files;
  } catch (error) {
    console.error('❌ Failed to list test export files:', error.message);
    throw error;
  }
};

/**
 * Generate sample CSV content for testing
 * @function generateSampleCSV
 * @param {Array<Object>} data - Array of objects to convert to CSV
 * @returns {string} CSV content
 */
export const generateSampleCSV = (data) => {
  if (!data || data.length === 0) {
    return '';
  }
  
  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');
  
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header];
      // Escape commas and quotes in CSV
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
  });
  
  return [csvHeaders, ...csvRows].join('\n');
};

/**
 * Generate sample JSON content for testing
 * @function generateSampleJSON
 * @param {Array<Object>} data - Array of objects to convert to JSON
 * @returns {string} JSON content
 */
export const generateSampleJSON = (data) => {
  return JSON.stringify(data, null, 2);
};

/**
 * Get test export directory path
 * @function getTestExportDir
 * @returns {string} Path to test export directory
 */
export const getTestExportDir = () => {
  return TEST_EXPORT_DIR;
};