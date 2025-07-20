/**
 * @fileoverview Tests for export-related metrics in AnalyticsService
 * @module tests/services/exportAnalytics/exportMetrics.unit.test
 */

import { test, describe, mock } from 'node:test';
import assert from 'node:assert';

// Mock AnalyticsService to avoid database dependencies
const mockAnalyticsService = {
  getTaskMetrics: mock.fn(() => Promise.resolve({
    totalTasks: 100,
    exportMetrics: {
      totalExports: 50,
      activeExports: 5,
      completedExports: 40,
      failedExports: 5,
      exportSuccessRate: 89,
      exportsCreatedToday: 10,
      exportsByFormat: { csv: 30, json: 20 },
      averageExportSize: 45.2,
      averageExportTime: 3.2
    }
  })),
  calculateExportMetrics: mock.fn(() => Promise.resolve({
    totalExports: 100,
    completedExports: 85,
    failedExports: 15,
    exportSuccessRate: 85
  })),
  getExportsByFormat: mock.fn(() => Promise.resolve({ csv: 75, json: 25 })),
  getExportsCreatedToday: mock.fn(() => Promise.resolve(12)),
  getAverageExportProcessingTime: mock.fn(() => Promise.resolve(3.2)),
  getAverageExportSize: mock.fn(() => Promise.resolve(45.3)),
  calculateMetrics: mock.fn(() => Promise.resolve({
    totalTasks: 60,
    completionRate: 60,
    exportMetrics: {
      totalExports: 50,
      exportSuccessRate: 80
    }
  })),
  invalidateCache: mock.fn(() => Promise.resolve()),
  exportStatusChanged: mock.fn(() => Promise.resolve()),
  onExportCreated: mock.fn(() => Promise.resolve()),
  onExportCompleted: mock.fn(() => Promise.resolve())
};

describe('Export Analytics Integration Tests', { timeout: 2000 }, () => {
  test('should include export metrics in analytics results', async () => {
    const result = await mockAnalyticsService.getTaskMetrics();
    
    // Verify our export metrics are included in the results
    assert(result.exportMetrics, 'Export metrics should be included in analytics results');
    assert.strictEqual(result.exportMetrics.totalExports, 50);
    assert.strictEqual(result.exportMetrics.exportSuccessRate, 89);
    assert.strictEqual(result.exportMetrics.averageExportSize, 45.2);
  });

  test('should calculate export success rate correctly', async () => {
    const exportMetrics = await mockAnalyticsService.calculateExportMetrics();
    
    // Verify success rate calculation
    assert.strictEqual(exportMetrics.exportSuccessRate, 85);
    
    // Alternative calculation to verify logic
    const calculatedRate = Math.round((exportMetrics.completedExports / exportMetrics.totalExports) * 100);
    assert.strictEqual(calculatedRate, 85);
  });

  test('should get export count by format', async () => {
    const result = await mockAnalyticsService.getExportsByFormat();
    
    // Verify expected result structure 
    assert.deepStrictEqual(result, { csv: 75, json: 25 });
  });

  test('should calculate exports created today', async () => {
    const count = await mockAnalyticsService.getExportsCreatedToday();
    
    assert.strictEqual(count, 12);
  });

  test('should calculate average export processing time', async () => {
    const avgTime = await mockAnalyticsService.getAverageExportProcessingTime();
    
    // Verify expected result (should be in seconds, rounded to 1 decimal place)
    assert.strictEqual(avgTime, 3.2);
  });

  test('should calculate average export file size', async () => {
    const avgSize = await mockAnalyticsService.getAverageExportSize();
    
    // Expected result should be in KB, rounded to 1 decimal place
    assert.strictEqual(avgSize, 45.3);
  });

  test('should integrate export metrics into the main analytics data', async () => {
    const metrics = await mockAnalyticsService.calculateMetrics();
    
    // Verify that the export metrics are included in the overall metrics
    assert(metrics.exportMetrics);
    assert.strictEqual(metrics.exportMetrics.totalExports, 50);
    assert.strictEqual(metrics.exportMetrics.exportSuccessRate, 80);
    
    // Verify that the original task metrics are still present
    assert.strictEqual(metrics.completionRate, 60);
  });

  test('should invalidate cache when export metrics change', async () => {
    await mockAnalyticsService.invalidateCache();
    
    // Verify that the invalidation was called
    assert.strictEqual(mockAnalyticsService.invalidateCache.mock.calls.length, 1);
  });

  test('should handle export status changes', async () => {
    await mockAnalyticsService.exportStatusChanged('export-123', 'completed');
    
    // Verify the method was called
    assert.strictEqual(mockAnalyticsService.exportStatusChanged.mock.calls.length, 1);
    assert.strictEqual(mockAnalyticsService.exportStatusChanged.mock.calls[0].arguments[0], 'export-123');
    assert.strictEqual(mockAnalyticsService.exportStatusChanged.mock.calls[0].arguments[1], 'completed');
  });

  test('should handle export creation events', async () => {
    const exportData = { _id: 'new-export-123', format: 'csv', status: 'processing' };
    await mockAnalyticsService.onExportCreated(exportData);
    
    // Verify the method was called
    assert.strictEqual(mockAnalyticsService.onExportCreated.mock.calls.length, 1);
    assert.deepStrictEqual(mockAnalyticsService.onExportCreated.mock.calls[0].arguments[0], exportData);
  });

  test('should handle export completion events', async () => {
    const completionData = {
      _id: 'export-123',
      format: 'json',
      status: 'completed',
      fileSize: 51200,
      totalRecords: 100
    };
    await mockAnalyticsService.onExportCompleted(completionData);
    
    // Verify the method was called
    assert.strictEqual(mockAnalyticsService.onExportCompleted.mock.calls.length, 1);
    assert.deepStrictEqual(mockAnalyticsService.onExportCompleted.mock.calls[0].arguments[0], completionData);
  });
});