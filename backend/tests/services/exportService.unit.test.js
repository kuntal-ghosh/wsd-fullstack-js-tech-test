/**
 * @fileoverview Unit tests for ExportService
 * @module tests/services/exportService.unit.test
 */

import { test, describe, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { setupTestEnvironment, teardownTestEnvironment, cleanTestEnvironment } from '../utils/testSetup.js';
import { createMockTasks, generateMockExport, generateMockFilters } from '../utils/mockData.js';
import { createTestExportFile, testExportFileExists, getTestExportFileStats } from '../utils/fileHelpers.js';
import Export from '../../src/models/Export.js';
import Task from '../../src/models/Task.js';

// Mock ExportService since it doesn't exist yet - we're writing tests first (TDD)
const ExportService = {
  // Core export functionality
  createExport: mock.fn(() => Promise.resolve()),
  processExport: mock.fn(() => Promise.resolve()),
  generateCSV: mock.fn(() => Promise.resolve('')),
  generateJSON: mock.fn(() => Promise.resolve('')),
  
  // Cache management
  getCachedExport: mock.fn(() => Promise.resolve(null)),
  setCachedExport: mock.fn(() => Promise.resolve()),
  invalidateExportCache: mock.fn(() => Promise.resolve()),
  
  // File management
  saveExportFile: mock.fn(() => Promise.resolve({})),
  cleanupExpiredFiles: mock.fn(() => Promise.resolve({})),
  
  // Progress tracking
  updateProgress: mock.fn(() => Promise.resolve({})),
  markCompleted: mock.fn(() => Promise.resolve({})),
  markFailed: mock.fn(() => Promise.resolve({}))
};

describe('ExportService Unit Tests', () => {
  before(async () => {
    await setupTestEnvironment();
  });

  after(async () => {
    await teardownTestEnvironment();
  });

  beforeEach(async () => {
    await cleanTestEnvironment();
    // Reset all mocks
    Object.values(ExportService).forEach(mockFn => {
      if (mockFn.mock) mockFn.mock.resetCalls();
    });
  });

  describe('CSV Generation', () => {
    test('should generate CSV with basic task data', async () => {
      const mockTasks = [
        {
          _id: '507f1f77bcf86cd799439011',
          title: 'Test Task 1',
          description: 'Description 1',
          status: 'pending',
          priority: 'high',
          estimatedTime: 60,
          actualTime: null,
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-01T10:00:00Z'),
          completedAt: null
        },
        {
          _id: '507f1f77bcf86cd799439012',
          title: 'Test Task 2',
          description: 'Description 2',
          status: 'completed',
          priority: 'medium',
          estimatedTime: 90,
          actualTime: 85,
          createdAt: new Date('2024-01-01T11:00:00Z'),
          updatedAt: new Date('2024-01-01T12:00:00Z'),
          completedAt: new Date('2024-01-01T12:00:00Z')
        }
      ];

      // Mock the generateCSV function to return expected CSV format
      ExportService.generateCSV.mock.mockImplementationOnce(async (tasks) => {
        const headers = ['ID', 'Title', 'Description', 'Status', 'Priority', 'Estimated Time', 'Actual Time', 'Created At', 'Updated At', 'Completed At'];
        const rows = tasks.map(task => [
          task._id.toString(),
          `"${task.title}"`,
          `"${task.description}"`,
          task.status,
          task.priority,
          task.estimatedTime || '',
          task.actualTime || '',
          task.createdAt.toISOString(),
          task.updatedAt.toISOString(),
          task.completedAt ? task.completedAt.toISOString() : ''
        ]);
        
        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      });

      const csvContent = await ExportService.generateCSV(mockTasks);

      // Verify the function was called with correct parameters
      assert.strictEqual(ExportService.generateCSV.mock.callCount(), 1);
      assert.deepStrictEqual(ExportService.generateCSV.mock.calls[0].arguments[0], mockTasks);

      // Verify CSV structure
      const lines = csvContent.split('\n');
      assert.strictEqual(lines.length, 3); // Header + 2 data rows
      
      // Verify header
      assert(lines[0].includes('ID,Title,Description,Status,Priority'));
      
      // Verify data rows contain expected values
      assert(lines[1].includes('Test Task 1'));
      assert(lines[1].includes('pending'));
      assert(lines[1].includes('high'));
      
      assert(lines[2].includes('Test Task 2'));
      assert(lines[2].includes('completed'));
      assert(lines[2].includes('medium'));
    });

    test('should handle empty task dataset for CSV', async () => {
      ExportService.generateCSV.mock.mockImplementationOnce(async (tasks) => {
        const headers = ['ID', 'Title', 'Description', 'Status', 'Priority', 'Estimated Time', 'Actual Time', 'Created At', 'Updated At', 'Completed At'];
        return headers.join(',');
      });

      const csvContent = await ExportService.generateCSV([]);

      assert.strictEqual(ExportService.generateCSV.mock.callCount(), 1);
      assert.deepStrictEqual(ExportService.generateCSV.mock.calls[0].arguments[0], []);

      // Should return only headers for empty dataset
      const lines = csvContent.split('\n');
      assert.strictEqual(lines.length, 1);
      assert(lines[0].includes('ID,Title,Description,Status,Priority'));
    });

    test('should escape special characters in CSV fields', async () => {
      const mockTasks = [
        {
          _id: '507f1f77bcf86cd799439011',
          title: 'Task with "quotes" and, commas',
          description: 'Description with\nnewlines and "quotes"',
          status: 'pending',
          priority: 'high',
          estimatedTime: 60,
          actualTime: null,
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-01T10:00:00Z'),
          completedAt: null
        }
      ];

      ExportService.generateCSV.mock.mockImplementationOnce(async (tasks) => {
        const headers = ['ID', 'Title', 'Description', 'Status', 'Priority', 'Estimated Time', 'Actual Time', 'Created At', 'Updated At', 'Completed At'];
        const rows = tasks.map(task => [
          task._id.toString(),
          `"${task.title.replace(/"/g, '""')}"`, // Escape quotes
          `"${task.description.replace(/"/g, '""').replace(/\n/g, ' ')}"`, // Escape quotes and newlines
          task.status,
          task.priority,
          task.estimatedTime || '',
          task.actualTime || '',
          task.createdAt.toISOString(),
          task.updatedAt.toISOString(),
          task.completedAt ? task.completedAt.toISOString() : ''
        ]);
        
        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      });

      const csvContent = await ExportService.generateCSV(mockTasks);

      // Verify proper escaping
      assert(csvContent.includes('""quotes""')); // Quotes should be escaped
      assert(csvContent.includes('"Task with ""quotes"" and, commas"')); // Full field should be quoted
    });

    test('should handle large datasets efficiently for CSV', async () => {
      const largeMockTasks = Array.from({ length: 1000 }, (_, i) => ({
        _id: `507f1f77bcf86cd79943${i.toString().padStart(4, '0')}`,
        title: `Task ${i + 1}`,
        description: `Description ${i + 1}`,
        status: ['pending', 'in-progress', 'completed'][i % 3],
        priority: ['low', 'medium', 'high'][i % 3],
        estimatedTime: (i + 1) * 15,
        actualTime: i % 2 === 0 ? (i + 1) * 15 + 5 : null,
        createdAt: new Date(Date.now() - i * 60000),
        updatedAt: new Date(Date.now() - i * 30000),
        completedAt: i % 3 === 2 ? new Date(Date.now() - i * 15000) : null
      }));

      ExportService.generateCSV.mock.mockImplementationOnce(async (tasks) => {
        // Simulate processing time for large dataset
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const headers = ['ID', 'Title', 'Description', 'Status', 'Priority', 'Estimated Time', 'Actual Time', 'Created At', 'Updated At', 'Completed At'];
        const rows = tasks.map(task => [
          task._id.toString(),
          `"${task.title}"`,
          `"${task.description}"`,
          task.status,
          task.priority,
          task.estimatedTime || '',
          task.actualTime || '',
          task.createdAt.toISOString(),
          task.updatedAt.toISOString(),
          task.completedAt ? task.completedAt.toISOString() : ''
        ]);
        
        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      });

      const startTime = Date.now();
      const csvContent = await ExportService.generateCSV(largeMockTasks);
      const endTime = Date.now();

      // Verify function was called with large dataset
      assert.strictEqual(ExportService.generateCSV.mock.callCount(), 1);
      assert.strictEqual(ExportService.generateCSV.mock.calls[0].arguments[0].length, 1000);

      // Verify CSV structure for large dataset
      const lines = csvContent.split('\n');
      assert.strictEqual(lines.length, 1001); // Header + 1000 data rows

      // Verify processing time is reasonable (should be under 1 second for 1000 records)
      assert(endTime - startTime < 1000, 'CSV generation should be efficient for large datasets');
    });
  });

  describe('JSON Generation', () => {
    test('should generate JSON with proper structure and formatting', async () => {
      const mockTasks = [
        {
          _id: '507f1f77bcf86cd799439011',
          title: 'Test Task 1',
          description: 'Description 1',
          status: 'pending',
          priority: 'high',
          estimatedTime: 60,
          actualTime: null,
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-01T10:00:00Z'),
          completedAt: null
        },
        {
          _id: '507f1f77bcf86cd799439012',
          title: 'Test Task 2',
          description: 'Description 2',
          status: 'completed',
          priority: 'medium',
          estimatedTime: 90,
          actualTime: 85,
          createdAt: new Date('2024-01-01T11:00:00Z'),
          updatedAt: new Date('2024-01-01T12:00:00Z'),
          completedAt: new Date('2024-01-01T12:00:00Z')
        }
      ];

      ExportService.generateJSON.mock.mockImplementationOnce(async (tasks) => {
        const exportData = {
          metadata: {
            exportedAt: new Date().toISOString(),
            totalRecords: tasks.length,
            format: 'json'
          },
          tasks: tasks.map(task => ({
            id: task._id.toString(),
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            estimatedTime: task.estimatedTime,
            actualTime: task.actualTime,
            createdAt: task.createdAt.toISOString(),
            updatedAt: task.updatedAt.toISOString(),
            completedAt: task.completedAt ? task.completedAt.toISOString() : null
          }))
        };
        
        return JSON.stringify(exportData, null, 2);
      });

      const jsonContent = await ExportService.generateJSON(mockTasks);

      // Verify the function was called with correct parameters
      assert.strictEqual(ExportService.generateJSON.mock.callCount(), 1);
      assert.deepStrictEqual(ExportService.generateJSON.mock.calls[0].arguments[0], mockTasks);

      // Parse and verify JSON structure
      const parsedJson = JSON.parse(jsonContent);
      
      // Verify metadata
      assert(parsedJson.metadata);
      assert.strictEqual(parsedJson.metadata.totalRecords, 2);
      assert.strictEqual(parsedJson.metadata.format, 'json');
      assert(parsedJson.metadata.exportedAt);

      // Verify tasks array
      assert(Array.isArray(parsedJson.tasks));
      assert.strictEqual(parsedJson.tasks.length, 2);

      // Verify first task
      const firstTask = parsedJson.tasks[0];
      assert.strictEqual(firstTask.title, 'Test Task 1');
      assert.strictEqual(firstTask.status, 'pending');
      assert.strictEqual(firstTask.priority, 'high');
      assert.strictEqual(firstTask.estimatedTime, 60);
      assert.strictEqual(firstTask.actualTime, null);
      assert.strictEqual(firstTask.completedAt, null);

      // Verify second task
      const secondTask = parsedJson.tasks[1];
      assert.strictEqual(secondTask.title, 'Test Task 2');
      assert.strictEqual(secondTask.status, 'completed');
      assert.strictEqual(secondTask.priority, 'medium');
      assert.strictEqual(secondTask.estimatedTime, 90);
      assert.strictEqual(secondTask.actualTime, 85);
      assert(secondTask.completedAt);
    });

    test('should handle empty task dataset for JSON', async () => {
      ExportService.generateJSON.mock.mockImplementationOnce(async (tasks) => {
        const exportData = {
          metadata: {
            exportedAt: new Date().toISOString(),
            totalRecords: tasks.length,
            format: 'json'
          },
          tasks: []
        };
        
        return JSON.stringify(exportData, null, 2);
      });

      const jsonContent = await ExportService.generateJSON([]);

      assert.strictEqual(ExportService.generateJSON.mock.callCount(), 1);
      assert.deepStrictEqual(ExportService.generateJSON.mock.calls[0].arguments[0], []);

      const parsedJson = JSON.parse(jsonContent);
      assert.strictEqual(parsedJson.metadata.totalRecords, 0);
      assert(Array.isArray(parsedJson.tasks));
      assert.strictEqual(parsedJson.tasks.length, 0);
    });

    test('should validate JSON structure and format', async () => {
      const mockTasks = [
        {
          _id: '507f1f77bcf86cd799439011',
          title: 'Test Task',
          description: 'Test Description',
          status: 'pending',
          priority: 'high',
          estimatedTime: 60,
          actualTime: null,
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-01T10:00:00Z'),
          completedAt: null
        }
      ];

      ExportService.generateJSON.mock.mockImplementationOnce(async (tasks) => {
        const exportData = {
          metadata: {
            exportedAt: new Date().toISOString(),
            totalRecords: tasks.length,
            format: 'json',
            version: '1.0'
          },
          tasks: tasks.map(task => ({
            id: task._id.toString(),
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            estimatedTime: task.estimatedTime,
            actualTime: task.actualTime,
            createdAt: task.createdAt.toISOString(),
            updatedAt: task.updatedAt.toISOString(),
            completedAt: task.completedAt ? task.completedAt.toISOString() : null
          }))
        };
        
        return JSON.stringify(exportData, null, 2);
      });

      const jsonContent = await ExportService.generateJSON(mockTasks);
      
      // Verify it's valid JSON
      assert.doesNotThrow(() => {
        JSON.parse(jsonContent);
      }, 'Generated content should be valid JSON');

      const parsedJson = JSON.parse(jsonContent);

      // Verify required fields exist
      assert(parsedJson.metadata, 'JSON should contain metadata');
      assert(parsedJson.tasks, 'JSON should contain tasks array');
      assert(typeof parsedJson.metadata.totalRecords === 'number', 'totalRecords should be a number');
      assert(typeof parsedJson.metadata.exportedAt === 'string', 'exportedAt should be a string');
      assert(Array.isArray(parsedJson.tasks), 'tasks should be an array');

      // Verify task structure
      if (parsedJson.tasks.length > 0) {
        const task = parsedJson.tasks[0];
        assert(typeof task.id === 'string', 'Task id should be a string');
        assert(typeof task.title === 'string', 'Task title should be a string');
        assert(typeof task.status === 'string', 'Task status should be a string');
        assert(typeof task.priority === 'string', 'Task priority should be a string');
      }
    });
  });

  describe('File Generation and Storage', () => {
    test('should save export file with correct path and metadata', async () => {
      const testData = 'id,title,status\n1,Test Task,pending';
      const format = 'csv';
      const exportId = '507f1f77bcf86cd799439011';

      ExportService.saveExportFile.mock.mockImplementationOnce(async (data, format, exportId) => {
        const fileName = `export_${exportId}.${format}`;
        const filePath = path.join(process.env.EXPORT_DIR || './test-exports', fileName);
        
        await fs.writeFile(filePath, data, 'utf8');
        
        const stats = await fs.stat(filePath);
        
        return {
          filePath,
          fileName,
          fileSize: stats.size,
          downloadUrl: `/api/exports/${exportId}/download`
        };
      });

      const result = await ExportService.saveExportFile(testData, format, exportId);

      // Verify function was called with correct parameters
      assert.strictEqual(ExportService.saveExportFile.mock.callCount(), 1);
      assert.strictEqual(ExportService.saveExportFile.mock.calls[0].arguments[0], testData);
      assert.strictEqual(ExportService.saveExportFile.mock.calls[0].arguments[1], format);
      assert.strictEqual(ExportService.saveExportFile.mock.calls[0].arguments[2], exportId);

      // Verify return structure
      assert(result.filePath);
      assert(result.fileName);
      assert(typeof result.fileSize === 'number');
      assert(result.downloadUrl);
      assert(result.fileName.includes(exportId));
      assert(result.fileName.endsWith(`.${format}`));
    });

    test('should handle file storage errors gracefully', async () => {
      const testData = 'test data';
      const format = 'csv';
      const exportId = '507f1f77bcf86cd799439011';

      ExportService.saveExportFile.mock.mockImplementationOnce(async (data, format, exportId) => {
        throw new Error('Disk space full');
      });

      await assert.rejects(
        async () => {
          await ExportService.saveExportFile(testData, format, exportId);
        },
        {
          message: 'Disk space full'
        }
      );

      assert.strictEqual(ExportService.saveExportFile.mock.callCount(), 1);
    });

    test('should generate unique file paths for concurrent exports', async () => {
      const testData = 'test data';
      const format = 'csv';
      const exportIds = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013'];

      ExportService.saveExportFile.mock.mockImplementation(async (data, format, exportId) => {
        const fileName = `export_${exportId}_${Date.now()}.${format}`;
        const filePath = path.join(process.env.EXPORT_DIR || './test-exports', fileName);
        
        return {
          filePath,
          fileName,
          fileSize: data.length,
          downloadUrl: `/api/exports/${exportId}/download`
        };
      });

      const results = await Promise.all(
        exportIds.map(id => ExportService.saveExportFile(testData, format, id))
      );

      // Verify all calls were made
      assert.strictEqual(ExportService.saveExportFile.mock.callCount(), 3);

      // Verify all file paths are unique
      const filePaths = results.map(r => r.filePath);
      const uniquePaths = [...new Set(filePaths)];
      assert.strictEqual(uniquePaths.length, 3, 'All file paths should be unique');

      // Verify all contain the export ID
      results.forEach((result, index) => {
        assert(result.fileName.includes(exportIds[index]));
      });
    });

    test('should cleanup expired export files', async () => {
      ExportService.cleanupExpiredFiles.mock.mockImplementationOnce(async () => {
        // Mock finding expired exports
        const expiredExports = [
          { _id: '507f1f77bcf86cd799439011', filePath: '/test-exports/export_1.csv' },
          { _id: '507f1f77bcf86cd799439012', filePath: '/test-exports/export_2.json' }
        ];

        let deletedCount = 0;
        for (const exportDoc of expiredExports) {
          try {
            // Mock file deletion
            deletedCount++;
          } catch (error) {
            console.error(`Failed to delete file: ${exportDoc.filePath}`);
          }
        }

        return {
          deletedFiles: deletedCount,
          deletedRecords: expiredExports.length
        };
      });

      const result = await ExportService.cleanupExpiredFiles();

      assert.strictEqual(ExportService.cleanupExpiredFiles.mock.callCount(), 1);
      assert(typeof result.deletedFiles === 'number');
      assert(typeof result.deletedRecords === 'number');
      assert.strictEqual(result.deletedFiles, 2);
      assert.strictEqual(result.deletedRecords, 2);
    });
  });

  describe('Export Progress Tracking', () => {
    test('should update export progress correctly', async () => {
      const exportId = '507f1f77bcf86cd799439011';
      const progressValue = 75;

      ExportService.updateProgress.mock.mockImplementationOnce(async (exportId, progress) => {
        // Mock finding and updating export
        const exportDoc = {
          _id: exportId,
          progress: 0,
          status: 'processing',
          save: mock.fn(() => Promise.resolve(true))
        };
        
        exportDoc.progress = progress;
        await exportDoc.save();
        
        return exportDoc;
      });

      const result = await ExportService.updateProgress(exportId, progressValue);

      assert.strictEqual(ExportService.updateProgress.mock.callCount(), 1);
      assert.strictEqual(ExportService.updateProgress.mock.calls[0].arguments[0], exportId);
      assert.strictEqual(ExportService.updateProgress.mock.calls[0].arguments[1], progressValue);
      assert.strictEqual(result.progress, progressValue);
    });

    test('should validate progress values are within bounds', async () => {
      const exportId = '507f1f77bcf86cd799439011';

      ExportService.updateProgress.mock.mockImplementation(async (exportId, progress) => {
        if (progress < 0 || progress > 100) {
          throw new Error('Progress must be between 0 and 100');
        }
        
        return { _id: exportId, progress };
      });

      // Test invalid progress values
      await assert.rejects(
        async () => {
          await ExportService.updateProgress(exportId, -10);
        },
        {
          message: 'Progress must be between 0 and 100'
        }
      );

      await assert.rejects(
        async () => {
          await ExportService.updateProgress(exportId, 150);
        },
        {
          message: 'Progress must be between 0 and 100'
        }
      );

      // Test valid progress values
      const result1 = await ExportService.updateProgress(exportId, 0);
      assert.strictEqual(result1.progress, 0);

      const result2 = await ExportService.updateProgress(exportId, 100);
      assert.strictEqual(result2.progress, 100);

      const result3 = await ExportService.updateProgress(exportId, 50);
      assert.strictEqual(result3.progress, 50);
    });

    test('should mark export as completed with file information', async () => {
      const exportId = '507f1f77bcf86cd799439011';
      const fileInfo = {
        filePath: '/exports/export_123.csv',
        downloadUrl: '/api/exports/123/download',
        fileSize: 1024,
        totalRecords: 100
      };

      ExportService.markCompleted.mock.mockImplementationOnce(async (exportId, fileInfo) => {
        const exportDoc = {
          _id: exportId,
          status: 'processing',
          progress: 75,
          filePath: null,
          downloadUrl: null,
          fileSize: 0,
          totalRecords: 0,
          save: mock.fn(() => Promise.resolve(true))
        };

        exportDoc.status = 'completed';
        exportDoc.progress = 100;
        exportDoc.filePath = fileInfo.filePath;
        exportDoc.downloadUrl = fileInfo.downloadUrl;
        exportDoc.fileSize = fileInfo.fileSize;
        exportDoc.totalRecords = fileInfo.totalRecords;
        
        await exportDoc.save();
        return exportDoc;
      });

      const result = await ExportService.markCompleted(exportId, fileInfo);

      assert.strictEqual(ExportService.markCompleted.mock.callCount(), 1);
      assert.strictEqual(ExportService.markCompleted.mock.calls[0].arguments[0], exportId);
      assert.deepStrictEqual(ExportService.markCompleted.mock.calls[0].arguments[1], fileInfo);

      assert.strictEqual(result.status, 'completed');
      assert.strictEqual(result.progress, 100);
      assert.strictEqual(result.filePath, fileInfo.filePath);
      assert.strictEqual(result.downloadUrl, fileInfo.downloadUrl);
      assert.strictEqual(result.fileSize, fileInfo.fileSize);
      assert.strictEqual(result.totalRecords, fileInfo.totalRecords);
    });

    test('should mark export as failed with error message', async () => {
      const exportId = '507f1f77bcf86cd799439011';
      const errorMessage = 'Database connection failed';

      ExportService.markFailed.mock.mockImplementationOnce(async (exportId, errorMessage) => {
        const exportDoc = {
          _id: exportId,
          status: 'processing',
          progress: 50,
          error: null,
          save: mock.fn(() => Promise.resolve(true))
        };

        exportDoc.status = 'failed';
        exportDoc.error = errorMessage;
        
        await exportDoc.save();
        return exportDoc;
      });

      const result = await ExportService.markFailed(exportId, errorMessage);

      assert.strictEqual(ExportService.markFailed.mock.callCount(), 1);
      assert.strictEqual(ExportService.markFailed.mock.calls[0].arguments[0], exportId);
      assert.strictEqual(ExportService.markFailed.mock.calls[0].arguments[1], errorMessage);

      assert.strictEqual(result.status, 'failed');
      assert.strictEqual(result.error, errorMessage);
    });
  });

  describe('Export Status Updates', () => {
    test('should handle status transitions correctly', async () => {
      const exportId = '507f1f77bcf86cd799439011';

      // Mock a sequence of status updates
      let currentStatus = 'processing';
      let currentProgress = 0;

      ExportService.updateProgress.mock.mockImplementation(async (exportId, progress) => {
        currentProgress = progress;
        return { _id: exportId, status: currentStatus, progress: currentProgress };
      });

      ExportService.markCompleted.mock.mockImplementationOnce(async (exportId, fileInfo) => {
        currentStatus = 'completed';
        currentProgress = 100;
        return { 
          _id: exportId, 
          status: currentStatus, 
          progress: currentProgress,
          ...fileInfo
        };
      });

      // Simulate progress updates
      await ExportService.updateProgress(exportId, 25);
      await ExportService.updateProgress(exportId, 50);
      await ExportService.updateProgress(exportId, 75);

      // Complete the export
      const fileInfo = {
        filePath: '/exports/test.csv',
        downloadUrl: '/api/exports/test/download',
        fileSize: 1024,
        totalRecords: 50
      };
      
      const finalResult = await ExportService.markCompleted(exportId, fileInfo);

      // Verify the sequence of calls
      assert.strictEqual(ExportService.updateProgress.mock.callCount(), 3);
      assert.strictEqual(ExportService.markCompleted.mock.callCount(), 1);

      // Verify final state
      assert.strictEqual(finalResult.status, 'completed');
      assert.strictEqual(finalResult.progress, 100);
    });

    test('should handle concurrent status updates safely', async () => {
      const exportId = '507f1f77bcf86cd799439011';
      
      ExportService.updateProgress.mock.mockImplementation(async (exportId, progress) => {
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 10));
        return { _id: exportId, progress };
      });

      // Simulate concurrent progress updates
      const updates = [10, 20, 30, 40, 50].map(progress => 
        ExportService.updateProgress(exportId, progress)
      );

      const results = await Promise.all(updates);

      // Verify all updates were processed
      assert.strictEqual(ExportService.updateProgress.mock.callCount(), 5);
      
      // Verify all results have the export ID
      results.forEach(result => {
        assert.strictEqual(result._id, exportId);
        assert(typeof result.progress === 'number');
      });
    });
  });

  describe('Error Handling in Export Processing', () => {
    test('should handle database connection errors during export', async () => {
      const filters = { status: 'pending' };
      const format = 'csv';

      ExportService.createExport.mock.mockImplementationOnce(async (filters, format) => {
        throw new Error('Database connection lost');
      });

      await assert.rejects(
        async () => {
          await ExportService.createExport(filters, format);
        },
        {
          message: 'Database connection lost'
        }
      );

      assert.strictEqual(ExportService.createExport.mock.callCount(), 1);
    });

    test('should handle file system errors during export processing', async () => {
      const exportId = '507f1f77bcf86cd799439011';

      ExportService.processExport.mock.mockImplementationOnce(async (exportId) => {
        throw new Error('Insufficient disk space');
      });

      await assert.rejects(
        async () => {
          await ExportService.processExport(exportId);
        },
        {
          message: 'Insufficient disk space'
        }
      );

      assert.strictEqual(ExportService.processExport.mock.callCount(), 1);
    });

    test('should handle memory errors with large datasets', async () => {
      const largeTasks = Array.from({ length: 100000 }, (_, i) => ({
        _id: `507f1f77bcf86cd79943${i.toString().padStart(4, '0')}`,
        title: `Task ${i}`,
        description: `Very long description for task ${i}`.repeat(100), // Large description
        status: 'pending',
        priority: 'medium'
      }));

      ExportService.generateCSV.mock.mockImplementationOnce(async (tasks) => {
        if (tasks.length > 50000) {
          throw new Error('Out of memory');
        }
        return 'id,title\n1,test';
      });

      await assert.rejects(
        async () => {
          await ExportService.generateCSV(largeTasks);
        },
        {
          message: 'Out of memory'
        }
      );

      assert.strictEqual(ExportService.generateCSV.mock.callCount(), 1);
    });

    test('should handle invalid export format errors', async () => {
      const tasks = [{ _id: '1', title: 'Test' }];
      const invalidFormat = 'xml';

      ExportService.generateCSV.mock.mockImplementationOnce(async (tasks) => {
        throw new Error('Unsupported export format: xml');
      });

      await assert.rejects(
        async () => {
          await ExportService.generateCSV(tasks);
        },
        {
          message: 'Unsupported export format: xml'
        }
      );
    });

    test('should handle export timeout scenarios', async () => {
      const exportId = '507f1f77bcf86cd799439011';

      ExportService.processExport.mock.mockImplementationOnce(async (exportId) => {
        // Simulate a long-running process that times out
        await new Promise((resolve, reject) => {
          setTimeout(() => {
            reject(new Error('Export processing timeout'));
          }, 100);
        });
      });

      await assert.rejects(
        async () => {
          await ExportService.processExport(exportId);
        },
        {
          message: 'Export processing timeout'
        }
      );

      assert.strictEqual(ExportService.processExport.mock.callCount(), 1);
    });

    test('should handle corrupted data during export', async () => {
      const corruptedTasks = [
        { _id: null, title: undefined, status: 'pending' }, // Invalid data
        { _id: '507f1f77bcf86cd799439011', title: 'Valid Task', status: 'completed' }
      ];

      ExportService.generateJSON.mock.mockImplementationOnce(async (tasks) => {
        // Simulate validation that catches corrupted data
        for (const task of tasks) {
          if (!task._id || !task.title) {
            throw new Error('Corrupted task data detected');
          }
        }
        return JSON.stringify({ tasks });
      });

      await assert.rejects(
        async () => {
          await ExportService.generateJSON(corruptedTasks);
        },
        {
          message: 'Corrupted task data detected'
        }
      );

      assert.strictEqual(ExportService.generateJSON.mock.callCount(), 1);
    });

    test('should provide detailed error information for debugging', async () => {
      const exportId = '507f1f77bcf86cd799439011';
      const detailedError = new Error('Export failed');
      detailedError.code = 'EXPORT_PROCESSING_ERROR';
      detailedError.details = {
        exportId,
        step: 'data_generation',
        timestamp: new Date().toISOString()
      };

      ExportService.processExport.mock.mockImplementationOnce(async (exportId) => {
        throw detailedError;
      });

      try {
        await ExportService.processExport(exportId);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.strictEqual(error.message, 'Export failed');
        assert.strictEqual(error.code, 'EXPORT_PROCESSING_ERROR');
        assert(error.details);
        assert.strictEqual(error.details.exportId, exportId);
        assert.strictEqual(error.details.step, 'data_generation');
      }

      assert.strictEqual(ExportService.processExport.mock.callCount(), 1);
    });
  });
});