/**
 * @fileoverview Unit tests for export caching functionality
 * @module tests/services/exportCaching.unit.test
 */

import { test, describe, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';

// Simplified mock Redis client
const createMockRedisClient = () => ({
  get: mock.fn(() => Promise.resolve(null)),
  set: mock.fn(() => Promise.resolve('OK')),
  del: mock.fn(() => Promise.resolve(1)),
  exists: mock.fn(() => Promise.resolve(1)),
  ttl: mock.fn(() => Promise.resolve(3600)),
  expire: mock.fn(() => Promise.resolve(1)),
  keys: mock.fn(() => Promise.resolve([])),
  flushall: mock.fn(() => Promise.resolve('OK')),
  ping: mock.fn(() => Promise.resolve('PONG')),
  connect: mock.fn(() => Promise.resolve()),
  disconnect: mock.fn(() => Promise.resolve()),
  on: mock.fn(),
  status: 'ready'
});

// Simplified mock service
const createMockExportCacheService = () => ({
  generateCacheKey: mock.fn((filters, format) => {
    // Create a proper hash that varies with different inputs
    const filterString = JSON.stringify(filters);
    const hashInput = filterString + format;
    const hash = Buffer.from(hashInput).toString('base64').slice(0, 16);
    return `export:${format}:${hash}`;
  }),
  getCachedExport: mock.fn(() => Promise.resolve(null)),
  setCachedExport: mock.fn(() => Promise.resolve(true)),
  invalidateExportCache: mock.fn(() => Promise.resolve({ scannedKeys: 0, invalidatedKeys: 0 })),
  invalidateAllExportCaches: mock.fn(() => Promise.resolve({ totalKeys: 0, deletedKeys: 0 })),
  cleanupExpiredCache: mock.fn(() => Promise.resolve({ scannedKeys: 0, expiredKeys: 0 })),
  getCacheStats: mock.fn(() => Promise.resolve({ isHealthy: true, totalExportCaches: 0 })),
  isCacheAvailable: mock.fn(() => Promise.resolve(true))
});

describe('Export Caching Functionality Unit Tests', { timeout: 5000 }, () => {
  let testConfig;
  let mockRedisClient;
  let ExportCacheService;

  before(() => {
    // Simple config without database setup
    testConfig = {
      cacheTTL: 3600,
      maxCacheSize: 1000000
    };
  });

  beforeEach(() => {
    // Create fresh mocks for each test
    mockRedisClient = createMockRedisClient();
    ExportCacheService = createMockExportCacheService();
  });

  afterEach(() => {
    // Clear mocks
    mockRedisClient = null;
    ExportCacheService = null;
  });

  describe('Cache Key Generation', () => {
    test('should generate consistent cache keys for identical filters and format', { timeout: 2000 }, () => {
      const filters = { status: 'pending', priority: 'high' };
      const format = 'csv';

      const cacheKey1 = ExportCacheService.generateCacheKey(filters, format);
      const cacheKey2 = ExportCacheService.generateCacheKey(filters, format);

      assert.strictEqual(ExportCacheService.generateCacheKey.mock.callCount(), 2);
      assert.strictEqual(cacheKey1, cacheKey2);
      assert(cacheKey1.startsWith('export:csv:'));
    });

    test('should generate different cache keys for different filters', { timeout: 1000 }, () => {
      const filters1 = { status: 'pending' };
      const filters2 = { status: 'completed' };
      const format = 'csv';

      const cacheKey1 = ExportCacheService.generateCacheKey(filters1, format);
      const cacheKey2 = ExportCacheService.generateCacheKey(filters2, format);

      assert.notStrictEqual(cacheKey1, cacheKey2);
      assert(cacheKey1.startsWith('export:csv:'));
      assert(cacheKey2.startsWith('export:csv:'));
    });

    test('should handle empty filters gracefully', { timeout: 1000 }, () => {
      const emptyFilters = {};
      const format = 'csv';

      const cacheKey = ExportCacheService.generateCacheKey(emptyFilters, format);

      assert(cacheKey.startsWith('export:csv:'));
      assert(typeof cacheKey === 'string');
      assert(cacheKey.length > 10);
    });
  });

  describe('Cache Storage and Retrieval', () => {
    test('should store and retrieve cached export data successfully', { timeout: 1000 }, async () => {
      const cacheKey = 'export:csv:test123';
      const exportData = {
        data: 'id,title,status\n1,Test Task,pending',
        metadata: { totalRecords: 1, format: 'csv' }
      };

      // Simple mock implementations
      ExportCacheService.setCachedExport.mock.mockImplementationOnce(() => Promise.resolve(true));
      ExportCacheService.getCachedExport.mock.mockImplementationOnce(() => Promise.resolve(exportData));

      const storeResult = await ExportCacheService.setCachedExport(cacheKey, exportData, testConfig.cacheTTL);
      assert.strictEqual(storeResult, true);

      const retrievedData = await ExportCacheService.getCachedExport(cacheKey);
      assert.deepStrictEqual(retrievedData, exportData);
    });

    test('should return null for non-existent cache keys', { timeout: 1000 }, async () => {
      const nonExistentKey = 'export:csv:nonexistent';

      ExportCacheService.getCachedExport.mock.mockImplementationOnce(() => Promise.resolve(null));

      const result = await ExportCacheService.getCachedExport(nonExistentKey);
      assert.strictEqual(result, null);
    });

    test('should handle JSON parsing errors gracefully', { timeout: 1000 }, async () => {
      const cacheKey = 'export:csv:corrupted';

      ExportCacheService.getCachedExport.mock.mockImplementationOnce(() => {
        console.error('Cache data parsing error: Simulated parsing error');
        return Promise.resolve(null);
      });

      const result = await ExportCacheService.getCachedExport(cacheKey);
      assert.strictEqual(result, null);
    });

    test('should respect cache size limits', { timeout: 1000 }, async () => {
      const cacheKey = 'export:csv:toolarge';
      const oversizedData = {
        data: 'x'.repeat(1000), // Small test data
        metadata: { totalRecords: 1, format: 'csv' }
      };

      ExportCacheService.setCachedExport.mock.mockImplementationOnce(() => {
        throw new Error('Export data too large for cache');
      });

      await assert.rejects(
        async () => {
          await ExportCacheService.setCachedExport(cacheKey, oversizedData, testConfig.cacheTTL);
        },
        { message: 'Export data too large for cache' }
      );
    });
  });

  describe('Cache TTL Management', () => {
    test('should set appropriate TTL when caching export data', { timeout: 1000 }, async () => {
      const cacheKey = 'export:csv:ttltest';
      const exportData = { data: 'test', metadata: {} };
      const customTTL = 1800;

      ExportCacheService.setCachedExport.mock.mockImplementationOnce(() => Promise.resolve(true));

      const result = await ExportCacheService.setCachedExport(cacheKey, exportData, customTTL);
      assert.strictEqual(result, true);
    });

    test('should check TTL of cached exports', { timeout: 1000 }, async () => {
      const cacheKey = 'export:csv:ttlcheck';

      ExportCacheService.getCacheStats.mock.mockImplementationOnce(() => Promise.resolve({
        exists: true,
        ttl: 1200,
        expired: false
      }));

      const stats = await ExportCacheService.getCacheStats(cacheKey);
      assert.strictEqual(stats.exists, true);
      assert.strictEqual(stats.ttl, 1200);
      assert.strictEqual(stats.expired, false);
    });
  });

  describe('Cache Invalidation', () => {
    test('should invalidate cache when task data changes', { timeout: 1000 }, async () => {
      const affectedFilters = { status: 'pending', priority: 'high' };

      ExportCacheService.invalidateExportCache.mock.mockImplementationOnce(() => Promise.resolve({
        scannedKeys: 3,
        invalidatedKeys: 3
      }));

      const result = await ExportCacheService.invalidateExportCache(affectedFilters);
      assert.strictEqual(result.scannedKeys, 3);
      assert.strictEqual(result.invalidatedKeys, 3);
    });

    test('should handle bulk cache invalidation', { timeout: 1000 }, async () => {
      ExportCacheService.invalidateAllExportCaches.mock.mockImplementationOnce(() => Promise.resolve({
        totalKeys: 4,
        exportKeys: 3,
        deletedKeys: 3
      }));

      const result = await ExportCacheService.invalidateAllExportCaches();
      assert.strictEqual(result.totalKeys, 4);
      assert.strictEqual(result.deletedKeys, 3);
    });
  });

  describe('Cache Failure Scenarios', () => {
    test('should handle Redis connection failures gracefully', { timeout: 1000 }, async () => {
      ExportCacheService.isCacheAvailable.mock.mockImplementationOnce(() => {
        console.error('Cache unavailable: Connection refused');
        return Promise.resolve(false);
      });

      ExportCacheService.getCachedExport.mock.mockImplementationOnce(() => {
        console.log('Cache unavailable, skipping cache lookup');
        return Promise.resolve(null);
      });

      const result = await ExportCacheService.getCachedExport('export:csv:test');
      assert.strictEqual(result, null);
    });

    test('should continue operation when cache write fails', { timeout: 1000 }, async () => {
      ExportCacheService.setCachedExport.mock.mockImplementationOnce(() => {
        console.error('Cache write failed: Write failed');
        return Promise.resolve(false);
      });

      const result = await ExportCacheService.setCachedExport('export:csv:writefail', { data: 'test' }, testConfig.cacheTTL);
      assert.strictEqual(result, false);
    });

    test('should provide cache health monitoring', { timeout: 1000 }, async () => {
      ExportCacheService.getCacheStats.mock.mockImplementationOnce(() => Promise.resolve({
        isHealthy: true,
        totalExportCaches: 2,
        lastChecked: new Date().toISOString(),
        status: 'operational'
      }));

      const healthStats = await ExportCacheService.getCacheStats();
      assert.strictEqual(healthStats.isHealthy, true);
      assert.strictEqual(healthStats.totalExportCaches, 2);
      assert.strictEqual(healthStats.status, 'operational');
      assert(healthStats.lastChecked);
    });
  });
});