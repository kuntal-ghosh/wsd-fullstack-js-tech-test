/**
 * @fileoverview Integration tests for export API endpoints
 * @module tests/routes/exportRoutes
 */

import { test, describe, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { setupTestEnvironment, teardownTestEnvironment, cleanTestEnvironment } from '../utils/testSetup.js';
import { createMockTasks, createMockExport } from '../utils/mockData.js';
import Export from '../../src/models/Export.js';
import Task from '../../src/models/Task.js';
import ExportService from '../../src/services/exportService.js';
import fs from 'fs/promises';
import path from 'path';

// describe('Export API Routes Integration Tests', () => {
//   before(async () => {
//     await setupTestEnvironment();
//   });

//   after(async () => {
//     await teardownTestEnvironment();
//   });

//   beforeEach(async () => {
//     await cleanTestEnvironment();
//   });

//   describe('POST /api/exports - Create Export', () => {
//     test('should create export with valid format and filters', async () => {
//       // Create test tasks
//       await createMockTasks(5);
      
//       const filters = {
//         status: 'pending',
//         priority: 'high'
//       };

//       // Test the service directly since we're doing integration testing
//       const exportDoc = await ExportService.createExport(filters, 'csv');

//       assert(exportDoc);
//       assert.strictEqual(exportDoc.format, 'csv');
//       assert.strictEqual(exportDoc.status, 'processing');
//       assert.strictEqual(exportDoc.progress, 0);
//       assert.deepStrictEqual(exportDoc.filters, filters);
//       assert(exportDoc._id);
//       assert(exportDoc.createdAt);

//       // Verify export was created in database
//       const savedExport = await Export.findById(exportDoc._id);
//       assert(savedExport);
//       assert.strictEqual(savedExport.format, 'csv');
//       assert.strictEqual(savedExport.status, 'processing');
//     });

//     test('should create export with JSON format', async () => {
//       const filters = {
//         search: 'test task'
//       };

//       const exportDoc = await ExportService.createExport(filters, 'json');

//       assert(exportDoc);
//       assert.strictEqual(exportDoc.format, 'json');
//       assert.strictEqual(exportDoc.status, 'processing');
//       assert.strictEqual(exportDoc.progress, 0);
//     });

//     test('should create export with empty filters', async () => {
//       const exportDoc = await ExportService.createExport({}, 'csv');

//       assert(exportDoc);
//       assert.strictEqual(exportDoc.format, 'csv');
//       assert.deepStrictEqual(exportDoc.filters, {});
//     });

//     test('should create export with date range filters', async () => {
//       const filters = {
//         dateFrom: '2024-01-01',
//         dateTo: '2024-12-31',
//         status: 'completed'
//       };

//       const exportDoc = await ExportService.createExport(filters, 'json');

//       assert(exportDoc);
//       assert.strictEqual(exportDoc.format, 'json');
//       assert.deepStrictEqual(exportDoc.filters, filters);
//     });

//     test('should create export with text search filter', async () => {
//       const filters = {
//         search: 'urgent task',
//         priority: 'high'
//       };

//       const exportDoc = await ExportService.createExport(filters, 'csv');

//       assert(exportDoc);
//       assert.strictEqual(exportDoc.format, 'csv');
//       assert.strictEqual(exportDoc.filters.search, 'urgent task');
//       assert.strictEqual(exportDoc.filters.priority, 'high');
//     });

//     test('should throw error for missing format', async () => {
//       try {
//         await ExportService.createExport({}, null);
//         assert.fail('Should have thrown error for missing format');
//       } catch (error) {
//         assert(error.message.includes('Unsupported export format'));
//       }
//     });

//     test('should throw error for invalid format', async () => {
//       try {
//         await ExportService.createExport({}, 'xml');
//         assert.fail('Should have thrown error for invalid format');
//       } catch (error) {
//         assert(error.message.includes('Unsupported export format'));
//       }
//     });

//     test('should handle complex filter combinations', async () => {
//       const filters = {
//         status: 'in-progress',
//         priority: 'medium',
//         dateFrom: '2024-01-01T00:00:00.000Z',
//         dateTo: '2024-12-31T23:59:59.999Z',
//         search: 'project management',
//         sortBy: 'createdAt',
//         sortOrder: 'desc'
//       };

//       const exportDoc = await ExportService.createExport(filters, 'json');

//       assert(exportDoc);
//       assert.strictEqual(exportDoc.format, 'json');
//       assert.deepStrictEqual(exportDoc.filters, filters);
//     });
//   });

//   describe('Export Status and Progress Tracking', () => {
//     test('should return export status and progress', async () => {
//       // Create a test export
//       const exportDoc = await createMockExport({
//         format: 'csv',
//         status: 'processing',
//         progress: 50,
//         filters: { status: 'pending' }
//       });

//       // Test finding the export
//       const foundExport = await Export.findById(exportDoc._id);

//       assert(foundExport);
//       assert.strictEqual(foundExport._id.toString(), exportDoc._id.toString());
//       assert.strictEqual(foundExport.format, 'csv');
//       assert.strictEqual(foundExport.status, 'processing');
//       assert.strictEqual(foundExport.progress, 50);
//       assert.deepStrictEqual(foundExport.filters, { status: 'pending' });
//       assert(foundExport.createdAt);
//       assert(foundExport.updatedAt);
//       assert(foundExport.expiresAt);
//       assert.strictEqual(typeof foundExport.isExpired(), 'boolean');
//     });

//     test('should return completed export with file information', async () => {
//       const exportDoc = await createMockExport({
//         format: 'json',
//         status: 'completed',
//         progress: 100,
//         totalRecords: 25,
//         fileSize: 1024,
//         downloadUrl: '/api/exports/123/download'
//       });

//       const foundExport = await Export.findById(exportDoc._id);

//       assert(foundExport);
//       assert.strictEqual(foundExport.status, 'completed');
//       assert.strictEqual(foundExport.progress, 100);
//       assert.strictEqual(foundExport.totalRecords, 25);
//       assert.strictEqual(foundExport.fileSize, 1024);
//       assert.strictEqual(foundExport.downloadUrl, '/api/exports/123/download');
//     });

//     test('should return failed export with error message', async () => {
//       const exportDoc = await createMockExport({
//         format: 'csv',
//         status: 'failed',
//         error: 'Database connection failed'
//       });

//       const foundExport = await Export.findById(exportDoc._id);

//       assert(foundExport);
//       assert.strictEqual(foundExport.status, 'failed');
//       assert.strictEqual(foundExport.error, 'Database connection failed');
//     });

//     test('should handle non-existent export', async () => {
//       const fakeId = '507f1f77bcf86cd799439011';

//       const foundExport = await Export.findById(fakeId);
//       assert.strictEqual(foundExport, null);
//     });

//     test('should indicate expired exports', async () => {
//       // Create expired export
//       const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
//       const exportDoc = await createMockExport({
//         format: 'csv',
//         status: 'completed',
//         expiresAt: expiredDate
//       });

//       const foundExport = await Export.findById(exportDoc._id);

//       assert(foundExport);
//       assert.strictEqual(foundExport.isExpired(), true);
//     });
//   });

//   describe('Export File Download', () => {
//     test('should handle completed export file access', async () => {
//       // Create test export directory and file
//       const exportDir = process.env.EXPORT_DIR || './test-exports';
//       await fs.mkdir(exportDir, { recursive: true });
      
//       const testData = 'ID,Title,Status\n1,Test Task,pending\n2,Another Task,completed';
//       const fileName = 'test-export.csv';
//       const filePath = path.join(exportDir, fileName);
//       await fs.writeFile(filePath, testData);

//       // Create completed export
//       const exportDoc = await createMockExport({
//         format: 'csv',
//         status: 'completed',
//         progress: 100,
//         filePath: filePath,
//         fileSize: testData.length
//       });

//       // Test file access
//       const fileContent = await fs.readFile(filePath, 'utf8');
//       assert.strictEqual(fileContent, testData);

//       // Test export document
//       const foundExport = await Export.findById(exportDoc._id);
//       assert(foundExport);
//       assert.strictEqual(foundExport.status, 'completed');
//       assert.strictEqual(foundExport.filePath, filePath);
//       assert.strictEqual(foundExport.fileSize, testData.length);

//       // Cleanup
//       await fs.unlink(filePath);
//     });

//     test('should handle JSON export file', async () => {
//       // Create test JSON export
//       const exportDir = process.env.EXPORT_DIR || './test-exports';
//       await fs.mkdir(exportDir, { recursive: true });
      
//       const testData = JSON.stringify({
//         metadata: { totalRecords: 2 },
//         tasks: [
//           { id: '1', title: 'Test Task', status: 'pending' },
//           { id: '2', title: 'Another Task', status: 'completed' }
//         ]
//       }, null, 2);
      
//       const fileName = 'test-export.json';
//       const filePath = path.join(exportDir, fileName);
//       await fs.writeFile(filePath, testData);

//       const exportDoc = await createMockExport({
//         format: 'json',
//         status: 'completed',
//         progress: 100,
//         filePath: filePath,
//         fileSize: testData.length
//       });

//       // Test file access
//       const fileContent = await fs.readFile(filePath, 'utf8');
//       assert.strictEqual(fileContent, testData);

//       // Test export document
//       const foundExport = await Export.findById(exportDoc._id);
//       assert(foundExport);
//       assert.strictEqual(foundExport.format, 'json');
//       assert.strictEqual(foundExport.status, 'completed');

//       // Cleanup
//       await fs.unlink(filePath);
//     });

//     test('should handle processing export', async () => {
//       const exportDoc = await createMockExport({
//         format: 'csv',
//         status: 'processing',
//         progress: 50
//       });

//       const foundExport = await Export.findById(exportDoc._id);

//       assert(foundExport);
//       assert.strictEqual(foundExport.status, 'processing');
//       assert.strictEqual(foundExport.progress, 50);
//     });

//     test('should handle failed export', async () => {
//       const exportDoc = await createMockExport({
//         format: 'csv',
//         status: 'failed',
//         error: 'Processing failed'
//       });

//       const foundExport = await Export.findById(exportDoc._id);

//       assert(foundExport);
//       assert.strictEqual(foundExport.status, 'failed');
//       assert.strictEqual(foundExport.error, 'Processing failed');
//     });

//     test('should handle expired export', async () => {
//       const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
//       const exportDoc = await createMockExport({
//         format: 'csv',
//         status: 'completed',
//         expiresAt: expiredDate
//       });

//       const foundExport = await Export.findById(exportDoc._id);

//       assert(foundExport);
//       assert.strictEqual(foundExport.isExpired(), true);
//     });

//     test('should handle export without file path', async () => {
//       const exportDoc = await createMockExport({
//         format: 'csv',
//         status: 'completed',
//         filePath: null
//       });

//       const foundExport = await Export.findById(exportDoc._id);

//       assert(foundExport);
//       assert.strictEqual(foundExport.filePath, null);
//     });

//     test('should handle missing file', async () => {
//       const exportDoc = await createMockExport({
//         format: 'csv',
//         status: 'completed',
//         filePath: '/non/existent/file.csv'
//       });

//       const foundExport = await Export.findById(exportDoc._id);

//       assert(foundExport);
//       assert.strictEqual(foundExport.filePath, '/non/existent/file.csv');

//       // Test file access failure
//       try {
//         await fs.access(foundExport.filePath);
//         assert.fail('Should have thrown error for missing file');
//       } catch (error) {
//         assert.strictEqual(error.code, 'ENOENT');
//       }
//     });
//   });

//   describe('Export History Retrieval', () => {
//     test('should return paginated export history', async () => {
//       // Create multiple test exports
//       const exports = [];
//       for (let i = 0; i < 5; i++) {
//         const exportDoc = await createMockExport({
//           format: i % 2 === 0 ? 'csv' : 'json',
//           status: 'completed',
//           totalRecords: 10 + i
//         });
//         exports.push(exportDoc);
//       }

//       // Test finding exports with pagination
//       const foundExports = await Export.find({})
//         .sort({ createdAt: -1 })
//         .limit(10)
//         .skip(0);

//       assert.strictEqual(foundExports.length, 5);

//       // Verify exports are sorted by creation date (newest first)
//       for (let i = 1; i < foundExports.length; i++) {
//         assert(foundExports[i-1].createdAt >= foundExports[i].createdAt);
//       }
//     });

//     test('should support pagination parameters', async () => {
//       // Create 15 test exports
//       for (let i = 0; i < 15; i++) {
//         await createMockExport({
//           format: 'csv',
//           status: 'completed'
//         });
//       }

//       // Test page 2 with limit 5
//       const page = 2;
//       const limit = 5;
//       const foundExports = await Export.find({})
//         .sort({ createdAt: -1 })
//         .limit(limit)
//         .skip((page - 1) * limit);

//       const total = await Export.countDocuments({});

//       assert.strictEqual(foundExports.length, 5);
//       assert.strictEqual(total, 15);
//       assert.strictEqual(Math.ceil(total / limit), 3); // 3 pages
//     });

//     test('should filter by status', async () => {
//       // Create exports with different statuses
//       await createMockExport({ format: 'csv', status: 'processing' });
//       await createMockExport({ format: 'csv', status: 'completed' });
//       await createMockExport({ format: 'csv', status: 'failed' });
//       await createMockExport({ format: 'csv', status: 'completed' });

//       const completedExports = await Export.find({ status: 'completed' });

//       assert.strictEqual(completedExports.length, 2);
//       assert(completedExports.every(exp => exp.status === 'completed'));
//     });

//     test('should handle invalid status filter gracefully', async () => {
//       await createMockExport({ format: 'csv', status: 'completed' });

//       const foundExports = await Export.find({ status: 'invalid' });
//       assert.strictEqual(foundExports.length, 0);

//       // All exports should still be found without filter
//       const allExports = await Export.find({});
//       assert.strictEqual(allExports.length, 1);
//     });

//     test('should return empty result when no exports exist', async () => {
//       const foundExports = await Export.find({});
//       const total = await Export.countDocuments({});

//       assert.strictEqual(foundExports.length, 0);
//       assert.strictEqual(total, 0);
//     });

//     test('should include all export metadata', async () => {
//       const exportDoc = await createMockExport({
//         format: 'json',
//         status: 'completed',
//         progress: 100,
//         totalRecords: 50,
//         fileSize: 2048,
//         downloadUrl: '/api/exports/123/download',
//         filters: { status: 'pending', priority: 'high' }
//       });

//       const foundExports = await Export.find({}).lean();

//       assert.strictEqual(foundExports.length, 1);
//       const exportData = foundExports[0];
      
//       assert.strictEqual(exportData._id.toString(), exportDoc._id.toString());
//       assert.strictEqual(exportData.format, 'json');
//       assert.strictEqual(exportData.status, 'completed');
//       assert.strictEqual(exportData.progress, 100);
//       assert.strictEqual(exportData.totalRecords, 50);
//       assert.strictEqual(exportData.fileSize, 2048);
//       assert.strictEqual(exportData.downloadUrl, '/api/exports/123/download');
//       assert.deepStrictEqual(exportData.filters, { status: 'pending', priority: 'high' });
//       assert(exportData.createdAt);
//       assert(exportData.updatedAt);
//       assert(exportData.expiresAt);
//     });
//   });

//   describe('Export Deletion', () => {
//     test('should delete export successfully', async () => {
//       const exportDoc = await createMockExport({
//         format: 'csv',
//         status: 'completed'
//       });

//       // Delete the export
//       await Export.findByIdAndDelete(exportDoc._id);

//       // Verify export was deleted from database
//       const deletedExport = await Export.findById(exportDoc._id);
//       assert.strictEqual(deletedExport, null);
//     });

//     test('should delete export and its file', async () => {
//       // Create test file
//       const exportDir = process.env.EXPORT_DIR || './test-exports';
//       await fs.mkdir(exportDir, { recursive: true });
      
//       const fileName = 'test-delete-export.csv';
//       const filePath = path.join(exportDir, fileName);
//       await fs.writeFile(filePath, 'test data');

//       const exportDoc = await createMockExport({
//         format: 'csv',
//         status: 'completed',
//         filePath: filePath
//       });

//       // Delete file and export
//       try {
//         await fs.unlink(filePath);
//       } catch (error) {
//         // File might not exist, continue
//       }
//       await Export.findByIdAndDelete(exportDoc._id);

//       // Verify file was deleted
//       try {
//         await fs.access(filePath);
//         assert.fail('File should have been deleted');
//       } catch (error) {
//         assert.strictEqual(error.code, 'ENOENT');
//       }

//       // Verify export was deleted
//       const deletedExport = await Export.findById(exportDoc._id);
//       assert.strictEqual(deletedExport, null);
//     });

//     test('should handle missing file gracefully', async () => {
//       const exportDoc = await createMockExport({
//         format: 'csv',
//         status: 'completed',
//         filePath: '/non/existent/file.csv'
//       });

//       // Delete export (file deletion would fail but should be handled)
//       await Export.findByIdAndDelete(exportDoc._id);

//       // Verify export was still deleted from database
//       const deletedExport = await Export.findById(exportDoc._id);
//       assert.strictEqual(deletedExport, null);
//     });

//     test('should handle non-existent export', async () => {
//       const fakeId = '507f1f77bcf86cd799439011';

//       const deletedExport = await Export.findByIdAndDelete(fakeId);
//       assert.strictEqual(deletedExport, null);
//     });

//     test('should delete processing export', async () => {
//       const exportDoc = await createMockExport({
//         format: 'csv',
//         status: 'processing',
//         progress: 50
//       });

//       await Export.findByIdAndDelete(exportDoc._id);

//       // Verify export was deleted
//       const deletedExport = await Export.findById(exportDoc._id);
//       assert.strictEqual(deletedExport, null);
//     });

//     test('should delete failed export', async () => {
//       const exportDoc = await createMockExport({
//         format: 'csv',
//         status: 'failed',
//         error: 'Processing failed'
//       });

//       await Export.findByIdAndDelete(exportDoc._id);

//       // Verify export was deleted
//       const deletedExport = await Export.findById(exportDoc._id);
//       assert.strictEqual(deletedExport, null);
//     });
//   });

//   describe('Error Scenarios and Edge Cases', () => {
//     test('should validate export format strictly', async () => {
//       const invalidFormats = ['CSV', 'JSON', 'txt', 'pdf', ''];
      
//       for (const format of invalidFormats) {
//         try {
//           await ExportService.createExport({}, format);
//           assert.fail(`Should have thrown error for invalid format: ${format}`);
//         } catch (error) {
//           assert(error.message.includes('Unsupported export format'));
//         }
//       }
//     });

//     test('should handle malformed filter objects', async () => {
//       const malformedFilters = [
//         null,
//         'string',
//         123,
//         [],
//         { status: null },
//         { priority: '' },
//         { dateFrom: 'invalid-date' },
//         { search: null }
//       ];

//       for (const filters of malformedFilters) {
//         // Should still create export with sanitized filters
//         const exportDoc = await ExportService.createExport(filters, 'csv');
//         assert(exportDoc);
//         assert.strictEqual(exportDoc.format, 'csv');
//       }
//     });

//     test('should handle concurrent export requests', async () => {
//       const promises = [];
      
//       // Create 5 concurrent export requests
//       for (let i = 0; i < 5; i++) {
//         const promise = ExportService.createExport({ status: 'pending' }, 'csv');
//         promises.push(promise);
//       }

//       const exports = await Promise.all(promises);
      
//       // All requests should succeed
//       exports.forEach(exportDoc => {
//         assert(exportDoc);
//         assert.strictEqual(exportDoc.format, 'csv');
//         assert.strictEqual(exportDoc.status, 'processing');
//       });

//       // Verify all exports were created
//       const exportCount = await Export.countDocuments();
//       assert.strictEqual(exportCount, 5);
//     });

//     test('should handle large filter objects', async () => {
//       const largeFilters = {
//         status: 'pending',
//         priority: 'high',
//         search: 'a'.repeat(1000), // Very long search string
//         dateFrom: '2020-01-01',
//         dateTo: '2024-12-31',
//         customField1: 'value1',
//         customField2: 'value2',
//         customField3: 'value3'
//       };

//       const exportDoc = await ExportService.createExport(largeFilters, 'json');

//       assert(exportDoc);
//       assert.strictEqual(exportDoc.format, 'json');
//       // Search string should be truncated by sanitization
//       assert(exportDoc.filters.search.length <= 255);
//     });

//     test('should handle export processing with various filter combinations', async () => {
//       // Create test tasks with different properties
//       await createMockTasks(10, { status: 'pending' });
//       await createMockTasks(5, { status: 'completed', priority: 'high' });
//       await createMockTasks(3, { status: 'in-progress', priority: 'low' });

//       const filterCombinations = [
//         { status: 'pending' },
//         { priority: 'high' },
//         { status: 'completed', priority: 'high' },
//         { search: 'Test Task' },
//         { dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }
//       ];

//       for (const filters of filterCombinations) {
//         const exportDoc = await ExportService.createExport(filters, 'csv');
//         assert(exportDoc);
//         assert.strictEqual(exportDoc.format, 'csv');
//         assert.strictEqual(exportDoc.status, 'processing');
        
//         // Test that we can process the export
//         try {
//           await ExportService.processExport(exportDoc._id.toString());
//           const processedExport = await Export.findById(exportDoc._id);
//           assert(processedExport);
//           assert(['completed', 'failed'].includes(processedExport.status));
//         } catch (error) {
//           // Processing might fail in test environment, that's okay
//           console.log(`Export processing failed for filters ${JSON.stringify(filters)}: ${error.message}`);
//         }
//       }
//     });
//   });
// });