/**
 * @fileoverview Tests for analytics caching with export statistics
 * @module tests/services/exportAnalytics/exportCaching.test
 */

import { test, describe, beforeEach, mock, after } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';

// Create mocks before importing the modules
const mockRedisClient = {
  get: mock.fn(),
  setex: mock.fn(),
  del: mock.fn()
};

jest.mock('../../../src/config/redis.js', () => ({
  redisClient: mockRedisClient
}));

jest.mock('../../../src/models/Task.js');
jest.mock('../../../src/models/Export.js');

// Import service after mocks are set up
import AnalyticsService from '../../../src/services/analyticsService.js';

describe('Export Analytics Caching Tests', () => {
  beforeEach(() => {
    // Reset all mock implementations
    mockRedisClient.get.mock.resetCalls();
    mockRedisClient.setex.mock.resetCalls();
    mockRedisClient.del.mock.resetCalls();
  });

  after(async () => {
    // Clean up after all tests
    if (mongoose.connection.readyState) {
      await mongoose.connection.close();
    }
  });

  test('should cache export metrics with task metrics', async () => {
    // Mock calculateMetrics to return a result that includes export metrics
    const mockMetrics = {
      totalTasks: 50,
      tasksByStatus: { pending: 15, 'in-progress': 20, completed: 15 },
      tasksByPriority: { low: 10, medium: 25, high: 15 },
      completionRate: 30,
      averageCompletionTime: 2.5,
      tasksCreatedToday: 5,
      tasksCompletedToday: 3,
      recentActivity: [],
      lastUpdated: new Date().toISOString(),
      // Export metrics
      exportMetrics: {
        totalExports: 25,
        activeExports: 3,
        completedExports: 18,
        failedExports: 4,
        exportSuccessRate: 82,
        exportsCreatedToday: 5,
        exportsByFormat: { csv: 15, json: 10 },
        averageExportSize: 37.5,
        averageExportTime: 2.8
      }
    };

    // Mock the calculateMetrics method to return our test data
    AnalyticsService.calculateMetrics = mock.fn(() => Promise.resolve(mockMetrics));
    
    // Mock Redis get to return null (cache miss) so it will calculate metrics
    mockRedisClient.get.mock.mockImplementationOnce(() => Promise.resolve(null));
    
    // Call getTaskMetrics which should calculate and then cache the result
    const result = await AnalyticsService.getTaskMetrics();
    
    // Verify the metrics were calculated
    assert.strictEqual(AnalyticsService.calculateMetrics.mock.calls.length, 1);
    
    // Verify the result was cached in Redis
    assert.strictEqual(mockRedisClient.setex.mock.calls.length, 1);
    
    // Verify the first argument to setex was the cache key
    assert.strictEqual(mockRedisClient.setex.mock.calls[0].arguments[0], 'task_metrics');
    
    // Verify the TTL (second argument) is a number
    assert.strictEqual(typeof mockRedisClient.setex.mock.calls[0].arguments[1], 'number');
    
    // Verify the cached data (third argument) includes export metrics
    const cachedData = JSON.parse(mockRedisClient.setex.mock.calls[0].arguments[2]);
    assert(cachedData.exportMetrics);
    assert.strictEqual(cachedData.exportMetrics.totalExports, 25);
    assert.strictEqual(cachedData.exportMetrics.exportSuccessRate, 82);
    
    // Verify the result returned to the caller includes export metrics
    assert(result.exportMetrics);
    assert.strictEqual(result.exportMetrics.totalExports, 25);
    assert.strictEqual(result.exportMetrics.exportSuccessRate, 82);
  });

  test('should retrieve cached export metrics', async () => {
    // Create mock metrics with export data
    const mockCachedMetrics = {
      totalTasks: 65,
      tasksByStatus: { pending: 20, 'in-progress': 25, completed: 20 },
      tasksByPriority: { low: 15, medium: 30, high: 20 },
      completionRate: 31,
      averageCompletionTime: 2.7,
      tasksCreatedToday: 7,
      tasksCompletedToday: 4,
      recentActivity: [],
      lastUpdated: new Date().toISOString(),
      // Export metrics
      exportMetrics: {
        totalExports: 30,
        activeExports: 4,
        completedExports: 22,
        failedExports: 4,
        exportSuccessRate: 85,
        exportsCreatedToday: 6,
        exportsByFormat: { csv: 18, json: 12 },
        averageExportSize: 42.5,
        averageExportTime: 3.1
      }
    };

    // Mock Redis get to return our cached metrics (cache hit)
    mockRedisClient.get.mock.mockImplementationOnce(() => 
      Promise.resolve(JSON.stringify(mockCachedMetrics))
    );
    
    // Mock calculateMetrics to verify it's not called
    AnalyticsService.calculateMetrics = mock.fn(() => {
      throw new Error('Should not be called when cache hits');
    });
    
    // Call getTaskMetrics which should use the cached value
    const result = await AnalyticsService.getTaskMetrics();
    
    // Verify Redis get was called with the correct key
    assert.strictEqual(mockRedisClient.get.mock.calls.length, 1);
    assert.strictEqual(mockRedisClient.get.mock.calls[0].arguments[0], 'task_metrics');
    
    // Verify calculateMetrics was not called due to cache hit
    assert.strictEqual(AnalyticsService.calculateMetrics.mock.calls.length, 0);
    
    // Verify the result includes the cached export metrics
    assert(result.exportMetrics);
    assert.strictEqual(result.exportMetrics.totalExports, 30);
    assert.strictEqual(result.exportMetrics.exportSuccessRate, 85);
    assert.strictEqual(result.exportMetrics.averageExportSize, 42.5);
    assert.strictEqual(result.exportMetrics.averageExportTime, 3.1);
  });

  test('should invalidate cache when export status changes', async () => {
    // Mock the Redis del operation
    mockRedisClient.del.mock.mockImplementationOnce(() => Promise.resolve(1));
    
    // Assuming exportStatusChanged is a method that triggers cache invalidation
    await AnalyticsService.exportStatusChanged('export-123', 'completed');
    
    // Verify the cache was invalidated
    assert.strictEqual(mockRedisClient.del.mock.calls.length, 1);
    assert.strictEqual(mockRedisClient.del.mock.calls[0].arguments[0], 'task_metrics');
  });

  test('should handle cache miss and calculation error gracefully', async () => {
    // Mock Redis get to return null (cache miss)
    mockRedisClient.get.mock.mockImplementationOnce(() => Promise.resolve(null));
    
    // Mock calculateMetrics to throw an error
    AnalyticsService.calculateMetrics = mock.fn(() => 
      Promise.reject(new Error('Calculation failed'))
    );
    
    // Mock console.error to prevent error output in test
    const originalConsoleError = console.error;
    console.error = mock.fn();
    
    try {
      // Call getTaskMetrics which should fail gracefully
      const result = await AnalyticsService.getTaskMetrics();
      
      // Verify error was logged
      assert.strictEqual(console.error.mock.calls.length, 1);
      
      // Verify we got a result with default/empty export metrics
      assert(result);
      assert.strictEqual(result.error, 'Error getting task metrics');
      
      if (result.exportMetrics) {
        // If exportMetrics exists, it should have default values
        assert.strictEqual(result.exportMetrics.totalExports, 0);
        assert.strictEqual(result.exportMetrics.exportSuccessRate, 0);
      }
    } finally {
      // Restore original console.error
      console.error = originalConsoleError;
    }
  });

  test('should update cache after new export is created', async () => {
    // Mock the necessary methods
    AnalyticsService.invalidateCache = mock.fn(() => Promise.resolve());
    
    // Simulate an export creation event
    await AnalyticsService.onExportCreated({
      _id: 'new-export-123',
      format: 'csv',
      status: 'processing'
    });
    
    // Verify cache was invalidated
    assert.strictEqual(AnalyticsService.invalidateCache.mock.calls.length, 1);
  });

  test('should update cache after export completion', async () => {
    // Mock the necessary methods
    AnalyticsService.invalidateCache = mock.fn(() => Promise.resolve());
    
    // Simulate an export completion event
    await AnalyticsService.onExportCompleted({
      _id: 'export-123',
      format: 'json',
      status: 'completed',
      fileSize: 51200, // 50KB
      totalRecords: 100
    });
    
    // Verify cache was invalidated
    assert.strictEqual(AnalyticsService.invalidateCache.mock.calls.length, 1);
  });
});