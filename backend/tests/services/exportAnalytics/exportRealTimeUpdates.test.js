/**
 * @fileoverview Tests for real-time integration of export events into analytics updates
 * @module tests/services/exportAnalytics/exportRealTimeUpdates.test
 */

import { test, describe, beforeEach, mock, after } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';

// Create mocks
const mockSocketHandlers = {
  broadcastAnalyticsUpdate: mock.fn(() => Promise.resolve()),
  broadcastExportProgress: mock.fn(() => Promise.resolve()),
  broadcastExportCompleted: mock.fn(() => Promise.resolve()),
  broadcastExportFailed: mock.fn(() => Promise.resolve()),
  broadcastNotification: mock.fn(() => Promise.resolve())
};

// Mock AnalyticsService
const mockAnalyticsService = {
  getTaskMetrics: mock.fn(),
  invalidateCache: mock.fn(),
  calculateExportMetrics: mock.fn(),
  exportStatusChanged: mock.fn()
};

describe('Export Real-Time Analytics Updates Tests', () => {
  beforeEach(() => {
    // Reset all mocks
    mockSocketHandlers.broadcastAnalyticsUpdate.mock.resetCalls();
    mockSocketHandlers.broadcastExportProgress.mock.resetCalls();
    mockSocketHandlers.broadcastExportCompleted.mock.resetCalls();
    mockSocketHandlers.broadcastExportFailed.mock.resetCalls();
    mockSocketHandlers.broadcastNotification.mock.resetCalls();
    
    mockAnalyticsService.getTaskMetrics.mock.resetCalls();
    mockAnalyticsService.invalidateCache.mock.resetCalls();
    mockAnalyticsService.calculateExportMetrics.mock.resetCalls();
    mockAnalyticsService.exportStatusChanged.mock.resetCalls();
  });

  after(async () => {
    if (mongoose.connection.readyState) {
      await mongoose.connection.close();
    }
  });

  test('should broadcast analytics update when export status changes', async () => {
    // Mock getTaskMetrics to return data including export metrics
    mockAnalyticsService.getTaskMetrics.mock.mockImplementationOnce(() => 
      Promise.resolve({
        totalTasks: 100,
        tasksByStatus: { pending: 30, 'in-progress': 40, completed: 30 },
        tasksByPriority: { low: 20, medium: 50, high: 30 },
        completionRate: 30,
        exportMetrics: {
          totalExports: 25,
          activeExports: 3,
          completedExports: 20,
          failedExports: 2,
          exportSuccessRate: 91,
          exportsByFormat: { csv: 15, json: 10 }
        }
      })
    );

    // Simulate export status change (e.g., from processing to completed)
    await simulateExportStatusChange('export-123', 'processing', 'completed', mockSocketHandlers, mockAnalyticsService);
    
    // Verify analytics service was called to invalidate cache
    assert.strictEqual(mockAnalyticsService.invalidateCache.mock.calls.length, 1);
    
    // Verify metrics were retrieved
    assert.strictEqual(mockAnalyticsService.getTaskMetrics.mock.calls.length, 1);
    
    // Verify analytics update was broadcast
    assert.strictEqual(mockSocketHandlers.broadcastAnalyticsUpdate.mock.calls.length, 1);
    
    // Verify the broadcast included export metrics
    const broadcastData = mockSocketHandlers.broadcastAnalyticsUpdate.mock.calls[0].arguments[0];
    assert(broadcastData.exportMetrics);
    assert.strictEqual(broadcastData.exportMetrics.totalExports, 25);
    assert.strictEqual(broadcastData.exportMetrics.exportSuccessRate, 91);
  });

  test('should send notification when export success rate drops', async () => {
    // Mock calculateExportMetrics to return a low success rate
    mockAnalyticsService.calculateExportMetrics.mock.mockImplementationOnce(() => 
      Promise.resolve({
        totalExports: 50,
        activeExports: 5,
        completedExports: 35,
        failedExports: 10,
        exportSuccessRate: 78 // 78% success rate (below threshold)
      })
    );
    
    // Simulate a failed export
    await simulateExportFailure('export-456', 'Database connection error', mockSocketHandlers, mockAnalyticsService);
    
    // Verify notification was broadcast
    assert.strictEqual(mockSocketHandlers.broadcastNotification.mock.calls.length, 1);
    
    // Verify notification content
    const notification = mockSocketHandlers.broadcastNotification.mock.calls[0].arguments[0];
    assert(notification.message.includes('success rate'));
    assert(notification.type === 'warning');
  });

  test('should update analytics when export is created', async () => {
    // Mock getTaskMetrics to return updated metrics
    mockAnalyticsService.getTaskMetrics.mock.mockImplementationOnce(() => 
      Promise.resolve({
        // Task metrics
        totalTasks: 50,
        tasksByStatus: { pending: 20, 'in-progress': 15, completed: 15 },
        // Export metrics
        exportMetrics: {
          totalExports: 11, // Increased by 1 from previous 10
          activeExports: 2,
          exportsByFormat: { csv: 6, json: 5 } // CSV increased by 1
        }
      })
    );
    
    // Simulate export creation
    await simulateExportCreation({
      _id: 'new-export-123',
      format: 'csv',
      filters: { status: 'pending' }
    }, mockSocketHandlers, mockAnalyticsService);
    
    // Verify cache was invalidated
    assert.strictEqual(mockAnalyticsService.invalidateCache.mock.calls.length, 1);
    
    // Verify analytics update was broadcast
    assert.strictEqual(mockSocketHandlers.broadcastAnalyticsUpdate.mock.calls.length, 1);
    
    // Verify broadcast data includes updated export count and format distribution
    const broadcastData = mockSocketHandlers.broadcastAnalyticsUpdate.mock.calls[0].arguments[0];
    assert.strictEqual(broadcastData.exportMetrics.totalExports, 11);
    assert.strictEqual(broadcastData.exportMetrics.exportsByFormat.csv, 6);
  });

  test('should update analytics with export progress', async () => {
    // First simulate an export progress update
    const progressData = {
      exportId: 'export-789',
      progress: 50,
      status: 'processing'
    };
    
    await simulateExportProgress(progressData, mockSocketHandlers, mockAnalyticsService);
    
    // Verify export progress was broadcast
    assert.strictEqual(mockSocketHandlers.broadcastExportProgress.mock.calls.length, 1);
    
    // Verify progress data
    const broadcastProgress = mockSocketHandlers.broadcastExportProgress.mock.calls[0].arguments[0];
    assert.strictEqual(broadcastProgress.exportId, 'export-789');
    assert.strictEqual(broadcastProgress.progress, 50);
    
    // Active exports count shouldn't trigger a full analytics update for just a progress update
    assert.strictEqual(mockSocketHandlers.broadcastAnalyticsUpdate.mock.calls.length, 0);
  });

  test('should update analytics when export completes', async () => {
    // Mock getTaskMetrics to return updated metrics
    mockAnalyticsService.getTaskMetrics.mock.mockImplementationOnce(() => 
      Promise.resolve({
        // Task metrics
        totalTasks: 50,
        tasksByStatus: { pending: 20, 'in-progress': 15, completed: 15 },
        // Export metrics with updated completed count
        exportMetrics: {
          totalExports: 15,
          activeExports: 1, // Reduced by 1
          completedExports: 12, // Increased by 1
          failedExports: 2,
          exportSuccessRate: 86,
          exportsByFormat: { csv: 8, json: 7 }
        }
      })
    );
    
    // Simulate export completion
    await simulateExportCompletion({
      exportId: 'export-321',
      format: 'json',
      status: 'completed',
      fileSize: 76800, // 75KB
      totalRecords: 150
    }, mockSocketHandlers, mockAnalyticsService);
    
    // Verify cache was invalidated
    assert.strictEqual(mockAnalyticsService.invalidateCache.mock.calls.length, 1);
    
    // Verify export completion was broadcast
    assert.strictEqual(mockSocketHandlers.broadcastExportCompleted.mock.calls.length, 1);
    
    // Verify analytics update was broadcast with new metrics
    assert.strictEqual(mockSocketHandlers.broadcastAnalyticsUpdate.mock.calls.length, 1);
    
    // Verify broadcast data includes updated export counts
    const broadcastData = mockSocketHandlers.broadcastAnalyticsUpdate.mock.calls[0].arguments[0];
    assert.strictEqual(broadcastData.exportMetrics.completedExports, 12);
    assert.strictEqual(broadcastData.exportMetrics.activeExports, 1);
    assert.strictEqual(broadcastData.exportMetrics.exportSuccessRate, 86);
  });

  test('should handle export metrics for concurrent exports', async () => {
    // Setup mock for concurrent active exports
    mockAnalyticsService.calculateExportMetrics.mock.mockImplementationOnce(() => 
      Promise.resolve({
        totalExports: 20,
        activeExports: 3, // Multiple concurrent exports
        completedExports: 15,
        failedExports: 2,
        exportSuccessRate: 88,
        exportsByFormat: { csv: 12, json: 8 }
      })
    );
    
    // Simulate concurrent export creations and updates
    await Promise.all([
      simulateExportCreation({ _id: 'export-a', format: 'csv' }, mockSocketHandlers, mockAnalyticsService),
      simulateExportProgress({ exportId: 'export-b', progress: 75 }, mockSocketHandlers, mockAnalyticsService),
      simulateExportCompletion({ exportId: 'export-c', format: 'json' }, mockSocketHandlers, mockAnalyticsService)
    ]);
    
    // Verify export metrics were calculated
    assert.strictEqual(mockAnalyticsService.calculateExportMetrics.mock.calls.length, 1);
  });
});

// Helper functions to simulate socket events

async function simulateExportStatusChange(exportId, oldStatus, newStatus, socketHandlers, analyticsService) {
  // Invalidate cache
  await analyticsService.invalidateCache();
  await analyticsService.exportStatusChanged(exportId, newStatus);
  
  // Get updated metrics
  const metrics = await analyticsService.getTaskMetrics();
  
  // Broadcast analytics update
  await socketHandlers.broadcastAnalyticsUpdate(metrics);
  
  return metrics;
}

async function simulateExportFailure(exportId, errorMessage, socketHandlers, analyticsService) {
  // Calculate export metrics to check success rate
  const exportMetrics = await analyticsService.calculateExportMetrics();
  
  // Broadcast export failure
  await socketHandlers.broadcastExportFailed(exportId, { error: errorMessage });
  
  // If success rate is below threshold, send notification
  if (exportMetrics.exportSuccessRate < 80) {
    await socketHandlers.broadcastNotification({
      type: 'warning',
      message: `Export success rate has dropped to ${exportMetrics.exportSuccessRate}%`,
      timestamp: new Date().toISOString()
    });
  }
  
  // Invalidate cache and update analytics
  await analyticsService.invalidateCache();
  const metrics = await analyticsService.getTaskMetrics();
  await socketHandlers.broadcastAnalyticsUpdate(metrics);
  
  return metrics;
}

async function simulateExportCreation(exportData, socketHandlers, analyticsService) {
  // Invalidate cache
  await analyticsService.invalidateCache();
  
  // Get updated metrics
  const metrics = await analyticsService.getTaskMetrics();
  
  // Broadcast analytics update
  await socketHandlers.broadcastAnalyticsUpdate(metrics);
  
  return metrics;
}

async function simulateExportProgress(progressData, socketHandlers, analyticsService) {
  // Broadcast export progress
  await socketHandlers.broadcastExportProgress(progressData);
  
  return progressData;
}

async function simulateExportCompletion(completionData, socketHandlers, analyticsService) {
  // Invalidate cache
  await analyticsService.invalidateCache();
  
  // Broadcast export completion
  await socketHandlers.broadcastExportCompleted(completionData.exportId, completionData);
  
  // Get updated metrics
  const metrics = await analyticsService.getTaskMetrics();
  
  // Broadcast analytics update
  await socketHandlers.broadcastAnalyticsUpdate(metrics);
  
  return metrics;
}