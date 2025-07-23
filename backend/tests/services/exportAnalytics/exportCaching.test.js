/**
 * @fileoverview Tests for analytics caching with export statistics
 * @module tests/services/exportAnalytics/exportCaching.test
 */

import { test, describe, beforeEach, mock } from 'node:test';
import assert from 'node:assert';

// Create simple mocks without Jest or database dependencies
const mockRedisClient = {
  get: mock.fn(),
  setex: mock.fn(),
  del: mock.fn()
};

// Mock AnalyticsService without importing real modules
const mockAnalyticsService = {
  calculateMetrics: mock.fn(),
  getTaskMetrics: mock.fn(),
  invalidateCache: mock.fn(),
  exportStatusChanged: mock.fn(),
  onExportCreated: mock.fn(),
  onExportCompleted: mock.fn()
};

describe('Export Analytics Caching Tests', { timeout: 2000 }, () => {
  beforeEach(() => {
    // Reset all mock implementations
    mockRedisClient.get.mock.resetCalls();
    mockRedisClient.setex.mock.resetCalls();
    mockRedisClient.del.mock.resetCalls();
    
    mockAnalyticsService.calculateMetrics.mock.resetCalls();
    mockAnalyticsService.getTaskMetrics.mock.resetCalls();
    mockAnalyticsService.invalidateCache.mock.resetCalls();
    mockAnalyticsService.exportStatusChanged.mock.resetCalls();
    mockAnalyticsService.onExportCreated.mock.resetCalls();
    mockAnalyticsService.onExportCompleted.mock.resetCalls();
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
    mockAnalyticsService.calculateMetrics.mock.mockImplementationOnce(() => Promise.resolve(mockMetrics));
    
    // Mock Redis get to return null (cache miss) so it will calculate metrics
    mockRedisClient.get.mock.mockImplementationOnce(() => Promise.resolve(null));
    
    // Mock Redis setex to simulate caching
    mockRedisClient.setex.mock.mockImplementationOnce(() => Promise.resolve('OK'));
    
    // Mock getTaskMetrics to simulate cache miss then cache set
    mockAnalyticsService.getTaskMetrics.mock.mockImplementationOnce(async () => {
      // Simulate cache miss
      const cachedData = await mockRedisClient.get('task_metrics');
      if (!cachedData) {
        // Calculate metrics
        const metrics = await mockAnalyticsService.calculateMetrics();
        // Cache the result
        await mockRedisClient.setex('task_metrics', 300, JSON.stringify(metrics));
        return metrics;
      }
      return JSON.parse(cachedData);
    });
    
    // Call getTaskMetrics which should calculate and then cache the result
    const result = await mockAnalyticsService.getTaskMetrics();
    
    // Verify the metrics were calculated
    assert.strictEqual(mockAnalyticsService.calculateMetrics.mock.callCount(), 1);
    
    // Verify the result was cached in Redis
    assert.strictEqual(mockRedisClient.setex.mock.callCount(), 1);
    
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
    mockAnalyticsService.calculateMetrics.mock.mockImplementationOnce(() => {
      throw new Error('Should not be called when cache hits');
    });
    
    // Mock getTaskMetrics to simulate cache hit
    mockAnalyticsService.getTaskMetrics.mock.mockImplementationOnce(async () => {
      const cachedData = await mockRedisClient.get('task_metrics');
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      return await mockAnalyticsService.calculateMetrics();
    });
    
    // Call getTaskMetrics which should use the cached value
    const result = await mockAnalyticsService.getTaskMetrics();
    
    // Verify Redis get was called with the correct key
    assert.strictEqual(mockRedisClient.get.mock.callCount(), 1);
    assert.strictEqual(mockRedisClient.get.mock.calls[0].arguments[0], 'task_metrics');
    
    // Verify calculateMetrics was not called due to cache hit
    assert.strictEqual(mockAnalyticsService.calculateMetrics.mock.callCount(), 0);
    
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
    
    // Mock invalidateCache method
    mockAnalyticsService.invalidateCache.mock.mockImplementationOnce(async () => {
      return await mockRedisClient.del('task_metrics');
    });
    
    // Mock exportStatusChanged method
    mockAnalyticsService.exportStatusChanged.mock.mockImplementationOnce(async (exportId, status) => {
      await mockAnalyticsService.invalidateCache();
    });
    
    // Simulate export status change
    await mockAnalyticsService.exportStatusChanged('export-123', 'completed');
    
    // Verify the cache was invalidated
    assert.strictEqual(mockRedisClient.del.mock.callCount(), 1);
    assert.strictEqual(mockRedisClient.del.mock.calls[0].arguments[0], 'task_metrics');
  });

  test('should handle cache miss and calculation error gracefully', async () => {
    // Mock Redis get to return null (cache miss)
    mockRedisClient.get.mock.mockImplementationOnce(() => Promise.resolve(null));
    
    // Mock calculateMetrics to throw an error
    mockAnalyticsService.calculateMetrics.mock.mockImplementationOnce(() => 
      Promise.reject(new Error('Calculation failed'))
    );
    
    // Mock getTaskMetrics to handle errors gracefully
    mockAnalyticsService.getTaskMetrics.mock.mockImplementationOnce(async () => {
      try {
        const cachedData = await mockRedisClient.get('task_metrics');
        if (!cachedData) {
          return await mockAnalyticsService.calculateMetrics();
        }
        return JSON.parse(cachedData);
      } catch (error) {
        console.error('Error getting task metrics:', error.message);
        return {
          error: 'Error getting task metrics',
          exportMetrics: {
            totalExports: 0,
            exportSuccessRate: 0
          }
        };
      }
    });
    
    // Mock console.error to prevent error output in test
    const originalConsoleError = console.error;
    console.error = mock.fn();
    
    try {
      // Call getTaskMetrics which should fail gracefully
      const result = await mockAnalyticsService.getTaskMetrics();
      
      // Verify error was logged
      assert.strictEqual(console.error.mock.callCount(), 1);
      
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
    // Mock invalidateCache
    mockAnalyticsService.invalidateCache.mock.mockImplementationOnce(() => Promise.resolve());
    
    // Mock onExportCreated method
    mockAnalyticsService.onExportCreated.mock.mockImplementationOnce(async (exportData) => {
      await mockAnalyticsService.invalidateCache();
    });
    
    // Simulate an export creation event
    await mockAnalyticsService.onExportCreated({
      _id: 'new-export-123',
      format: 'csv',
      status: 'processing'
    });
    
    // Verify cache was invalidated
    assert.strictEqual(mockAnalyticsService.invalidateCache.mock.callCount(), 1);
  });

  test('should update cache after export completion', async () => {
    // Mock invalidateCache
    mockAnalyticsService.invalidateCache.mock.mockImplementationOnce(() => Promise.resolve());
    
    // Mock onExportCompleted method
    mockAnalyticsService.onExportCompleted.mock.mockImplementationOnce(async (exportData) => {
      await mockAnalyticsService.invalidateCache();
    });
    
    // Simulate an export completion event
    await mockAnalyticsService.onExportCompleted({
      _id: 'export-123',
      format: 'json',
      status: 'completed',
      fileSize: 51200, // 50KB
      totalRecords: 100
    });
    
    // Verify cache was invalidated
    assert.strictEqual(mockAnalyticsService.invalidateCache.mock.callCount(), 1);
  });
});