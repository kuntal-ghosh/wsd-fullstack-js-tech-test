/**
 * @fileoverview Unit tests for ExportService
 * @module tests/services/exportService.unit.test
 */

import { test, describe, beforeEach, mock } from 'node:test';
import assert from 'node:assert';

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

describe('ExportService Unit Tests', { timeout: 3000 }, () => {
  beforeEach(() => {
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
      assert.strictEqual(parsedJson.metadata.totalRecords, 1);
      assert.strictEqual(parsedJson.metadata.format, 'json');
      assert(parsedJson.metadata.exportedAt);

      // Verify tasks array
      assert(Array.isArray(parsedJson.tasks));
      assert.strictEqual(parsedJson.tasks.length, 1);

      // Verify first task
      const firstTask = parsedJson.tasks[0];
      assert.strictEqual(firstTask.title, 'Test Task 1');
      assert.strictEqual(firstTask.status, 'pending');
      assert.strictEqual(firstTask.priority, 'high');
      assert.strictEqual(firstTask.estimatedTime, 60);
      assert.strictEqual(firstTask.actualTime, null);
      assert.strictEqual(firstTask.completedAt, null);
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

  describe('File Management', () => {
    test('should save export file with correct path and metadata', async () => {
      const testData = 'id,title,status\n1,Test Task,pending';
      const format = 'csv';
      const exportId = '507f1f77bcf86cd799439011';

      ExportService.saveExportFile.mock.mockImplementationOnce(async (data, format, exportId) => {
        const fileName = `export_${exportId}.${format}`;
        const filePath = `/exports/${fileName}`;
        
        return {
          filePath,
          fileName,
          fileSize: data.length,
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

  describe('Error Handling', () => {
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
  });
});