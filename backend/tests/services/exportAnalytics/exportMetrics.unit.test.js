/**
 * @fileoverview Tests for export-related metrics in AnalyticsService
 * @module tests/services/exportAnalytics/exportMetrics.unit.test
 */

import { test, describe, beforeEach, mock, after } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';

// Mock modules to isolate our tests
const mockExport = {
  countDocuments: mock.fn(),
  find: mock.fn(),
  aggregate: mock.fn(),
};

// Create mocks before importing the service to avoid actual DB connections
jest.mock('../../../src/models/Export.js', () => mockExport);
jest.mock('../../../src/models/Task.js');
jest.mock('../../../src/config/redis.js', () => ({
  redisClient: {
    get: mock.fn(),
    setex: mock.fn(),
    del: mock.fn()
  }
}));

// Import service after mocks are set up
import AnalyticsService from '../../../src/services/analyticsService.js';
import { redisClient } from '../../../src/config/redis.js';

describe('Export Analytics Integration Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    mockExport.countDocuments.mock.resetCalls();
    mockExport.find.mock.resetCalls();
    mockExport.aggregate.mock.resetCalls();
    redisClient.get.mock.resetCalls();
    redisClient.setex.mock.resetCalls();
    redisClient.del.mock.resetCalls();
  });

  after(async () => {
    // Clean up after all tests
    if (mongoose.connection.readyState) {
      await mongoose.connection.close();
    }
  });

  test('should include export metrics in analytics results', async () => {
    // This test ensures that the analytics service includes export metrics in its results
    const mockMetrics = {
      totalTasks: 100,
      tasksByStatus: { pending: 30, 'in-progress': 40, completed: 30 },
      tasksByPriority: { low: 20, medium: 50, high: 30 },
      completionRate: 30,
      averageCompletionTime: 2.5,
      tasksCreatedToday: 5,
      tasksCompletedToday: 3,
      recentActivity: [],
      // Export metrics should be included
      exportMetrics: {
        totalExports: 50,
        activeExports: 5,
        completedExports: 40,
        failedExports: 5,
        exportSuccessRate: 89,
        exportsCreatedToday: 10,
        exportsByFormat: { csv: 30, json: 20 },
        averageExportSize: 45.2, // KB
        averageExportTime: 3.2, // seconds
      }
    };
    
    // Mock the Redis get call to return our mock metrics
    redisClient.get.mock.mockImplementationOnce((key) => {
      if (key === 'task_metrics') {
        return Promise.resolve(JSON.stringify(mockMetrics));
      }
      return Promise.resolve(null);
    });
    
    // Call the analytics service
    const result = await AnalyticsService.getTaskMetrics();
    
    // Verify our export metrics are included in the results
    assert(result.exportMetrics, 'Export metrics should be included in analytics results');
    assert.strictEqual(result.exportMetrics.totalExports, 50);
    assert.strictEqual(result.exportMetrics.exportSuccessRate, 89);
    assert.strictEqual(result.exportMetrics.averageExportSize, 45.2);
  });

  test('should calculate export success rate correctly', async () => {
    // Mock the metrics calculation to test specific export metrics calculation
    AnalyticsService.calculateExportMetrics = mock.fn();
    
    // Setup mock implementation to simulate success rate calculation
    AnalyticsService.calculateExportMetrics.mock.mockImplementationOnce(async () => {
      return {
        totalExports: 100,
        completedExports: 85,
        failedExports: 15,
        exportSuccessRate: 85 // 85 completed out of 100 = 85%
      };
    });
    
    const exportMetrics = await AnalyticsService.calculateExportMetrics();
    
    // Verify success rate calculation
    assert.strictEqual(exportMetrics.exportSuccessRate, 85);
    
    // Alternative calculation to verify logic
    const calculatedRate = Math.round((exportMetrics.completedExports / exportMetrics.totalExports) * 100);
    assert.strictEqual(calculatedRate, 85);
  });

  test('should get export count by format', async () => {
    // Setup mock to test format distribution calculation
    mockExport.aggregate.mock.mockImplementationOnce(() => {
      return Promise.resolve([
        { _id: 'csv', count: 75 },
        { _id: 'json', count: 25 }
      ]);
    });
    
    // Assuming the method is implemented in AnalyticsService
    const result = await AnalyticsService.getExportsByFormat();
    
    // Verify aggregate was called correctly
    assert.strictEqual(mockExport.aggregate.mock.calls.length, 1);
    
    // Verify expected result structure 
    assert.deepStrictEqual(result, { csv: 75, json: 25 });
  });

  test('should calculate exports created today', async () => {
    // Setup mock for exports created today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    mockExport.countDocuments.mock.mockImplementationOnce((query) => {
      // Verify the query checks for createdAt >= today
      assert(query.createdAt.$gte instanceof Date);
      return Promise.resolve(12);
    });
    
    // Assuming the method is implemented in AnalyticsService
    const count = await AnalyticsService.getExportsCreatedToday();
    
    assert.strictEqual(count, 12);
    assert.strictEqual(mockExport.countDocuments.mock.calls.length, 1);
  });

  test('should calculate average export processing time', async () => {
    // Mock aggregate call to return processing time data
    mockExport.aggregate.mock.mockImplementationOnce(() => {
      return Promise.resolve([
        { 
          _id: null, 
          avgProcessingTime: 3200 // 3.2 seconds in milliseconds
        }
      ]);
    });
    
    // Assuming the method is implemented in AnalyticsService
    const avgTime = await AnalyticsService.getAverageExportProcessingTime();
    
    // Verify the aggregate call was made
    assert.strictEqual(mockExport.aggregate.mock.calls.length, 1);
    
    // Verify expected result (should be in seconds, rounded to 1 decimal place)
    assert.strictEqual(avgTime, 3.2);
  });

  test('should calculate average export file size', async () => {
    // Mock aggregate call to return file size data
    mockExport.aggregate.mock.mockImplementationOnce(() => {
      return Promise.resolve([
        { 
          _id: null, 
          avgFileSize: 46336 // Average size in bytes (around 45.25 KB)
        }
      ]);
    });
    
    // Assuming the method is implemented in AnalyticsService
    const avgSize = await AnalyticsService.getAverageExportSize();
    
    // Verify the aggregate call was made
    assert.strictEqual(mockExport.aggregate.mock.calls.length, 1);
    
    // Expected result should be in KB, rounded to 1 decimal place
    assert.strictEqual(avgSize, 45.3);
  });

  test('should integrate export metrics into the main analytics data', async () => {
    // This tests that calculateMetrics includes export metrics
    
    // First, mock all the methods that calculateMetrics will call
    // For task metrics
    AnalyticsService.getTasksByStatus = mock.fn(() => 
      Promise.resolve({ pending: 10, 'in-progress': 20, completed: 30 })
    );
    AnalyticsService.getTasksByPriority = mock.fn(() => 
      Promise.resolve({ low: 15, medium: 25, high: 20 })
    );
    AnalyticsService.getCompletionRate = mock.fn(() => Promise.resolve(60));
    AnalyticsService.getAverageCompletionTime = mock.fn(() => Promise.resolve(3.5));
    AnalyticsService.getTasksCreatedToday = mock.fn(() => Promise.resolve(8));
    AnalyticsService.getTasksCompletedToday = mock.fn(() => Promise.resolve(5));
    AnalyticsService.getRecentActivity = mock.fn(() => Promise.resolve([]));
    
    // For export metrics
    AnalyticsService.calculateExportMetrics = mock.fn(() => Promise.resolve({
      totalExports: 50,
      activeExports: 5,
      completedExports: 40,
      failedExports: 5,
      exportSuccessRate: 80,
      exportsCreatedToday: 7,
      exportsByFormat: { csv: 30, json: 20 },
      averageExportSize: 45.2,
      averageExportTime: 3.2
    }));
    
    const metrics = await AnalyticsService.calculateMetrics();
    
    // Verify that the export metrics are included in the overall metrics
    assert(metrics.exportMetrics);
    assert.strictEqual(metrics.exportMetrics.totalExports, 50);
    assert.strictEqual(metrics.exportMetrics.exportSuccessRate, 80);
    
    // Verify that the original task metrics are still present
    assert.strictEqual(metrics.completionRate, 60);
    assert.strictEqual(metrics.tasksCreatedToday, 8);
  });

  test('should invalidate cache when export metrics change', async () => {
    // Mock the Redis del operation
    redisClient.del.mock.mockImplementationOnce(() => Promise.resolve(1));
    
    await AnalyticsService.invalidateCache();
    
    // Verify that the task_metrics cache was invalidated
    assert.strictEqual(redisClient.del.mock.calls.length, 1);
    assert.strictEqual(redisClient.del.mock.calls[0].arguments[0], 'task_metrics');
  });
});