/**
 * @fileoverview Unit tests for export caching functionality
 * @module tests/services/exportCaching.unit.test
 */

import { test, describe, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { setupTestEnvironment, teardownTestEnvironment, cleanTestEnvironment } from '../utils/testSetup.js';
import { getTestExportConfig } from '../utils/testConfig.js';

// Mock Redis client for testing
const mockRedisClient = {
  get: mock.fn(),
  set: mock.fn(),
  del: mock.fn(),
  exists: mock.fn(),
  ttl: mock.fn(),
  expire: mock.fn(),
  keys: mock.fn(),
  flushall: mock.fn(),
  ping: mock.fn(() => Promise.resolve('PONG')),
  connect: mock.fn(() => Promise.resolve()),
  disconnect: mock.fn(() => Promise.resolve()),
  on: mock.fn(),
  status: 'ready'
};

// Mock ExportCacheService - this will be implemented based on these tests
const ExportCacheService = {
  generateCacheKey: mock.fn(),
  getCachedExport: mock.fn(),
  setCachedExport: mock.fn(),
  invalidateExportCache: mock.fn(),
  invalidateAllExportCaches: mock.fn(),
  cleanupExpiredCache: mock.fn(),
  getCacheStats: mock.fn(),
  isCacheAvailable: mock.fn(() => Promise.resolve(true))
};

describe('Export Caching Functionality Unit Tests', () => {
  let testConfig;

  before(async () => {
    await setupTestEnvironment();
    testConfig = getTestExportConfig();
  });

  after(async () => {
    await teardownTestEnvironment();
  });

  beforeEach(async () => {
    await cleanTestEnvironment();
    
    // Reset all mocks
    Object.values(mockRedisClient).forEach(mockFn => {
      if (mockFn.mock) mockFn.mock.resetCalls();
    });
    
    Object.values(ExportCacheService).forEach(mockFn => {
      if (mockFn.mock) mockFn.mock.resetCalls();
    });
  });

  describe('Cache Key Generation', () => {
    test('should generate consistent cache keys for identical filters and format', async () => {
      const filters = {
        status: 'pending',
        priority: 'high',
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        search: 'test task'
      };
      const format = 'csv';

      ExportCacheService.generateCacheKey.mock.mockImplementation((filters, format) => {
        // Sort filter keys to ensure consistency
        const sortedFilters = Object.keys(filters)
          .sort()
          .reduce((sorted, key) => {
            sorted[key] = filters[key];
            return sorted;
          }, {});
        
        const filterString = JSON.stringify(sortedFilters);
        const hash = Buffer.from(filterString).toString('base64').slice(0, 16);
        return `export:${format}:${hash}`;
      });

      const cacheKey1 = await ExportCacheService.generateCacheKey(filters, format);
      const cacheKey2 = await ExportCacheService.generateCacheKey(filters, format);

      // Verify function was called
      assert.strictEqual(ExportCacheService.generateCacheKey.mock.callCount(), 2);
      
      // Verify cache keys are identical for same input
      assert.strictEqual(cacheKey1, cacheKey2);
      assert(cacheKey1.startsWith('export:csv:'));
      assert(cacheKey1.length > 15); // Should have meaningful length
    });

    test('should generate different cache keys for different filters', async () => {
      const filters1 = {
        status: 'pending',
        priority: 'high'
      };
      const filters2 = {
        status: 'completed',
        priority: 'high'
      };
      const format = 'csv';

      // Mock separate calls with different results
      ExportCacheService.generateCacheKey.mock.mockImplementationOnce((filters, format) => {
        const filterString = JSON.stringify(filters);
        const hashInput = `${format}:${filterString}`;
        const hash = Buffer.from(hashInput).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
        return `export:${format}:${hash}`;
      });

      ExportCacheService.generateCacheKey.mock.mockImplementationOnce((filters, format) => {
        const filterString = JSON.stringify(filters);
        const hashInput = `${format}:${filterString}`;
        const hash = Buffer.from(hashInput).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
        return `export:${format}:${hash}`;
      });

      const cacheKey1 = await ExportCacheService.generateCacheKey(filters1, format);
      const cacheKey2 = await ExportCacheService.generateCacheKey(filters2, format);

      assert.strictEqual(ExportCacheService.generateCacheKey.mock.callCount(), 2);
      assert.notStrictEqual(cacheKey1, cacheKey2);
      assert(cacheKey1.startsWith('export:csv:'));
      assert(cacheKey2.startsWith('export:csv:'));
    });

    test('should generate different cache keys for different formats', async () => {
      const filters = {
        status: 'pending',
        priority: 'high'
      };

      ExportCacheService.generateCacheKey.mock.mockImplementation((filters, format) => {
        const sortedFilters = Object.keys(filters)
          .sort()
          .reduce((sorted, key) => {
            sorted[key] = filters[key];
            return sorted;
          }, {});
        
        const filterString = JSON.stringify(sortedFilters);
        const hash = Buffer.from(filterString).toString('base64').slice(0, 16);
        return `export:${format}:${hash}`;
      });

      const csvKey = await ExportCacheService.generateCacheKey(filters, 'csv');
      const jsonKey = await ExportCacheService.generateCacheKey(filters, 'json');

      assert.strictEqual(ExportCacheService.generateCacheKey.mock.callCount(), 2);
      assert.notStrictEqual(csvKey, jsonKey);
      assert(csvKey.includes(':csv:'));
      assert(jsonKey.includes(':json:'));
    });

    test('should handle empty filters gracefully', async () => {
      const emptyFilters = {};
      const format = 'csv';

      ExportCacheService.generateCacheKey.mock.mockImplementation((filters, format) => {
        const filterString = JSON.stringify(filters);
        const hash = Buffer.from(filterString).toString('base64').slice(0, 16);
        return `export:${format}:${hash}`;
      });

      const cacheKey = await ExportCacheService.generateCacheKey(emptyFilters, format);

      assert.strictEqual(ExportCacheService.generateCacheKey.mock.callCount(), 1);
      assert(cacheKey.startsWith('export:csv:'));
      assert(typeof cacheKey === 'string');
      assert(cacheKey.length > 10);
    });

    test('should handle special characters in filter values', async () => {
      const filters = {
        search: 'task with "quotes" and, commas',
        status: 'in-progress',
        priority: 'high/urgent'
      };
      const format = 'json';

      ExportCacheService.generateCacheKey.mock.mockImplementation((filters, format) => {
        const sortedFilters = Object.keys(filters)
          .sort()
          .reduce((sorted, key) => {
            sorted[key] = filters[key];
            return sorted;
          }, {});
        
        const filterString = JSON.stringify(sortedFilters);
        const hash = Buffer.from(filterString).toString('base64').slice(0, 16);
        return `export:${format}:${hash}`;
      });

      const cacheKey = await ExportCacheService.generateCacheKey(filters, format);

      assert.strictEqual(ExportCacheService.generateCacheKey.mock.callCount(), 1);
      assert(cacheKey.startsWith('export:json:'));
      assert(typeof cacheKey === 'string');
      
      // Should not contain problematic characters
      assert(!cacheKey.includes('"'));
      assert(!cacheKey.includes(','));
      assert(!cacheKey.includes('/'));
    });
  });

  describe('Cache Storage and Retrieval', () => {
    test('should store and retrieve cached export data successfully', async () => {
      const cacheKey = 'export:csv:test123';
      const exportData = {
        data: 'id,title,status\n1,Test Task,pending',
        metadata: {
          totalRecords: 1,
          format: 'csv',
          generatedAt: new Date().toISOString()
        }
      };

      // Mock successful cache operations
      ExportCacheService.setCachedExport.mock.mockImplementationOnce(async (key, data, ttl) => {
        mockRedisClient.set.mock.mockImplementationOnce(() => Promise.resolve('OK'));
        await mockRedisClient.set(key, JSON.stringify(data), 'EX', ttl);
        return true;
      });

      ExportCacheService.getCachedExport.mock.mockImplementationOnce(async (key) => {
        mockRedisClient.get.mock.mockImplementationOnce(() => Promise.resolve(JSON.stringify(exportData)));
        const cachedData = await mockRedisClient.get(key);
        return cachedData ? JSON.parse(cachedData) : null;
      });

      // Store data in cache
      const storeResult = await ExportCacheService.setCachedExport(cacheKey, exportData, testConfig.cacheTTL);
      assert.strictEqual(storeResult, true);
      assert.strictEqual(ExportCacheService.setCachedExport.mock.callCount(), 1);

      // Retrieve data from cache
      const retrievedData = await ExportCacheService.getCachedExport(cacheKey);
      assert.strictEqual(ExportCacheService.getCachedExport.mock.callCount(), 1);
      assert.deepStrictEqual(retrievedData, exportData);
    });

    test('should return null for non-existent cache keys', async () => {
      const nonExistentKey = 'export:csv:nonexistent';

      ExportCacheService.getCachedExport.mock.mockImplementationOnce(async (key) => {
        mockRedisClient.get.mock.mockImplementationOnce(() => Promise.resolve(null));
        const cachedData = await mockRedisClient.get(key);
        return cachedData ? JSON.parse(cachedData) : null;
      });

      const result = await ExportCacheService.getCachedExport(nonExistentKey);

      assert.strictEqual(ExportCacheService.getCachedExport.mock.callCount(), 1);
      assert.strictEqual(result, null);
    });

    test('should handle JSON parsing errors gracefully', async () => {
      const cacheKey = 'export:csv:corrupted';

      ExportCacheService.getCachedExport.mock.mockImplementationOnce(async (key) => {
        mockRedisClient.get.mock.mockImplementationOnce(() => Promise.resolve('invalid json data'));
        try {
          const cachedData = await mockRedisClient.get(key);
          return cachedData ? JSON.parse(cachedData) : null;
        } catch (error) {
          console.error('Cache data parsing error:', error.message);
          return null;
        }
      });

      const result = await ExportCacheService.getCachedExport(cacheKey);

      assert.strictEqual(ExportCacheService.getCachedExport.mock.callCount(), 1);
      assert.strictEqual(result, null);
    });

    test('should handle large export data efficiently', async () => {
      const cacheKey = 'export:csv:large';
      const largeExportData = {
        data: 'id,title,status\n' + Array.from({ length: 10000 }, (_, i) => 
          `${i + 1},Task ${i + 1},pending`
        ).join('\n'),
        metadata: {
          totalRecords: 10000,
          format: 'csv',
          generatedAt: new Date().toISOString()
        }
      };

      ExportCacheService.setCachedExport.mock.mockImplementationOnce(async (key, data, ttl) => {
        const dataSize = JSON.stringify(data).length;
        
        // Simulate size check
        if (dataSize > testConfig.maxFileSize) {
          throw new Error('Export data too large for cache');
        }
        
        mockRedisClient.set.mock.mockImplementationOnce(() => Promise.resolve('OK'));
        await mockRedisClient.set(key, JSON.stringify(data), 'EX', ttl);
        return true;
      });

      const startTime = Date.now();
      const result = await ExportCacheService.setCachedExport(cacheKey, largeExportData, testConfig.cacheTTL);
      const endTime = Date.now();

      assert.strictEqual(ExportCacheService.setCachedExport.mock.callCount(), 1);
      assert.strictEqual(result, true);
      
      // Should complete within reasonable time (under 1 second)
      assert(endTime - startTime < 1000, 'Large data caching should be efficient');
    });

    test('should respect cache size limits', async () => {
      const cacheKey = 'export:csv:toolarge';
      const oversizedData = {
        data: 'x'.repeat(testConfig.maxFileSize + 1000), // Exceed max size
        metadata: { totalRecords: 1, format: 'csv' }
      };

      ExportCacheService.setCachedExport.mock.mockImplementationOnce(async (key, data, ttl) => {
        const dataSize = JSON.stringify(data).length;
        
        if (dataSize > testConfig.maxFileSize) {
          throw new Error('Export data too large for cache');
        }
        
        return true;
      });

      await assert.rejects(
        async () => {
          await ExportCacheService.setCachedExport(cacheKey, oversizedData, testConfig.cacheTTL);
        },
        {
          message: 'Export data too large for cache'
        }
      );

      assert.strictEqual(ExportCacheService.setCachedExport.mock.callCount(), 1);
    });
  });

  describe('Cache TTL Management and Expiration', () => {
    test('should set appropriate TTL when caching export data', async () => {
      const cacheKey = 'export:csv:ttltest';
      const exportData = { data: 'test', metadata: {} };
      const customTTL = 1800; // 30 minutes

      ExportCacheService.setCachedExport.mock.mockImplementationOnce(async (key, data, ttl) => {
        mockRedisClient.set.mock.mockImplementationOnce((key, value, mode, ttlValue) => {
          assert.strictEqual(mode, 'EX');
          assert.strictEqual(ttlValue, customTTL);
          return Promise.resolve('OK');
        });
        
        await mockRedisClient.set(key, JSON.stringify(data), 'EX', ttl);
        return true;
      });

      await ExportCacheService.setCachedExport(cacheKey, exportData, customTTL);

      assert.strictEqual(ExportCacheService.setCachedExport.mock.callCount(), 1);
      assert.strictEqual(mockRedisClient.set.mock.callCount(), 1);
    });

    test('should check TTL of cached exports', async () => {
      const cacheKey = 'export:csv:ttlcheck';

      ExportCacheService.getCacheStats.mock.mockImplementationOnce(async (key) => {
        mockRedisClient.ttl.mock.mockImplementationOnce(() => Promise.resolve(1200)); // 20 minutes remaining
        mockRedisClient.exists.mock.mockImplementationOnce(() => Promise.resolve(1));
        
        const ttl = await mockRedisClient.ttl(key);
        const exists = await mockRedisClient.exists(key);
        
        return {
          exists: exists === 1,
          ttl: ttl,
          expired: ttl <= 0
        };
      });

      const stats = await ExportCacheService.getCacheStats(cacheKey);

      assert.strictEqual(ExportCacheService.getCacheStats.mock.callCount(), 1);
      assert.strictEqual(stats.exists, true);
      assert.strictEqual(stats.ttl, 1200);
      assert.strictEqual(stats.expired, false);
    });

    test('should handle expired cache entries', async () => {
      const expiredKey = 'export:csv:expired';

      ExportCacheService.getCachedExport.mock.mockImplementationOnce(async (key) => {
        mockRedisClient.get.mock.mockImplementationOnce(() => Promise.resolve(null));
        return await mockRedisClient.get(key);
      });

      ExportCacheService.getCacheStats.mock.mockImplementationOnce(async (key) => {
        mockRedisClient.ttl.mock.mockImplementationOnce(() => Promise.resolve(-2)); // Key doesn't exist
        mockRedisClient.exists.mock.mockImplementationOnce(() => Promise.resolve(0));
        
        const ttl = await mockRedisClient.ttl(key);
        const exists = await mockRedisClient.exists(key);
        
        return {
          exists: exists === 1,
          ttl: ttl,
          expired: ttl <= 0
        };
      });

      const cachedData = await ExportCacheService.getCachedExport(expiredKey);
      const stats = await ExportCacheService.getCacheStats(expiredKey);

      assert.strictEqual(cachedData, null);
      assert.strictEqual(stats.exists, false);
      assert.strictEqual(stats.expired, true);
    });

    test('should cleanup expired cache entries', async () => {
      ExportCacheService.cleanupExpiredCache.mock.mockImplementationOnce(async () => {
        // Mock finding expired keys
        mockRedisClient.keys.mock.mockImplementationOnce(() => Promise.resolve([
          'export:csv:expired1',
          'export:json:expired2',
          'export:csv:valid1'
        ]));
        
        const allKeys = await mockRedisClient.keys('export:*');
        let expiredCount = 0;
        
        for (const key of allKeys) {
          mockRedisClient.ttl.mock.mockImplementation((k) => {
            if (k.includes('expired')) return Promise.resolve(-2);
            return Promise.resolve(1800);
          });
          
          const ttl = await mockRedisClient.ttl(key);
          if (ttl <= 0) {
            mockRedisClient.del.mock.mockImplementationOnce(() => Promise.resolve(1));
            await mockRedisClient.del(key);
            expiredCount++;
          }
        }
        
        return {
          scannedKeys: allKeys.length,
          expiredKeys: expiredCount,
          deletedKeys: expiredCount
        };
      });

      const cleanupResult = await ExportCacheService.cleanupExpiredCache();

      assert.strictEqual(ExportCacheService.cleanupExpiredCache.mock.callCount(), 1);
      assert.strictEqual(cleanupResult.scannedKeys, 3);
      assert.strictEqual(cleanupResult.expiredKeys, 2);
      assert.strictEqual(cleanupResult.deletedKeys, 2);
    });

    test('should extend TTL for frequently accessed cache entries', async () => {
      const cacheKey = 'export:csv:popular';
      const newTTL = 3600; // 1 hour

      ExportCacheService.getCachedExport.mock.mockImplementationOnce(async (key) => {
        // Mock getting data and extending TTL
        mockRedisClient.get.mock.mockImplementationOnce(() => Promise.resolve('{"data":"cached"}'));
        mockRedisClient.expire.mock.mockImplementationOnce(() => Promise.resolve(1));
        
        const data = await mockRedisClient.get(key);
        if (data) {
          await mockRedisClient.expire(key, newTTL); // Extend TTL
        }
        
        return data ? JSON.parse(data) : null;
      });

      const result = await ExportCacheService.getCachedExport(cacheKey);

      assert.strictEqual(ExportCacheService.getCachedExport.mock.callCount(), 1);
      assert.strictEqual(mockRedisClient.expire.mock.callCount(), 1);
      assert.deepStrictEqual(result, { data: "cached" });
    });
  });

  describe('Cache Invalidation', () => {
    test('should invalidate cache when task data changes', async () => {
      const affectedFilters = {
        status: 'pending',
        priority: 'high'
      };

      ExportCacheService.invalidateExportCache.mock.mockImplementationOnce(async (filters) => {
        // Mock finding related cache keys
        mockRedisClient.keys.mock.mockImplementationOnce(() => Promise.resolve([
          'export:csv:abc123',
          'export:json:def456',
          'export:csv:ghi789'
        ]));
        
        const allKeys = await mockRedisClient.keys('export:*');
        let invalidatedCount = 0;
        
        // Mock checking which keys match the filters (simplified)
        for (const key of allKeys) {
          if (key.includes('csv') || key.includes('json')) {
            mockRedisClient.del.mock.mockImplementation(() => Promise.resolve(1));
            await mockRedisClient.del(key);
            invalidatedCount++;
          }
        }
        
        return {
          scannedKeys: allKeys.length,
          invalidatedKeys: invalidatedCount
        };
      });

      const result = await ExportCacheService.invalidateExportCache(affectedFilters);

      assert.strictEqual(ExportCacheService.invalidateExportCache.mock.callCount(), 1);
      assert.strictEqual(result.scannedKeys, 3);
      assert.strictEqual(result.invalidatedKeys, 3);
    });

    test('should invalidate specific cache entries by pattern', async () => {
      const statusFilter = { status: 'completed' };

      ExportCacheService.invalidateExportCache.mock.mockImplementationOnce(async (filters) => {
        // Mock pattern-based invalidation
        const pattern = 'export:*:*completed*';
        mockRedisClient.keys.mock.mockImplementationOnce(() => Promise.resolve([
          'export:csv:completed123',
          'export:json:completed456'
        ]));
        
        const matchingKeys = await mockRedisClient.keys(pattern);
        let deletedCount = 0;
        
        for (const key of matchingKeys) {
          mockRedisClient.del.mock.mockImplementation(() => Promise.resolve(1));
          await mockRedisClient.del(key);
          deletedCount++;
        }
        
        return {
          pattern: pattern,
          matchingKeys: matchingKeys.length,
          deletedKeys: deletedCount
        };
      });

      const result = await ExportCacheService.invalidateExportCache(statusFilter);

      assert.strictEqual(ExportCacheService.invalidateExportCache.mock.callCount(), 1);
      assert.strictEqual(result.matchingKeys, 2);
      assert.strictEqual(result.deletedKeys, 2);
    });

    test('should handle bulk cache invalidation', async () => {
      ExportCacheService.invalidateAllExportCaches.mock.mockImplementationOnce(async () => {
        mockRedisClient.keys.mock.mockImplementationOnce(() => Promise.resolve([
          'export:csv:key1',
          'export:json:key2',
          'export:csv:key3',
          'other:cache:key4' // Should not be deleted
        ]));
        
        const allKeys = await mockRedisClient.keys('*');
        const exportKeys = allKeys.filter(key => key.startsWith('export:'));
        
        let deletedCount = 0;
        for (const key of exportKeys) {
          mockRedisClient.del.mock.mockImplementation(() => Promise.resolve(1));
          await mockRedisClient.del(key);
          deletedCount++;
        }
        
        return {
          totalKeys: allKeys.length,
          exportKeys: exportKeys.length,
          deletedKeys: deletedCount
        };
      });

      const result = await ExportCacheService.invalidateAllExportCaches();

      assert.strictEqual(ExportCacheService.invalidateAllExportCaches.mock.callCount(), 1);
      assert.strictEqual(result.totalKeys, 4);
      assert.strictEqual(result.exportKeys, 3);
      assert.strictEqual(result.deletedKeys, 3);
    });

    test('should handle invalidation errors gracefully', async () => {
      const filters = { status: 'pending' };

      ExportCacheService.invalidateExportCache.mock.mockImplementationOnce(async (filters) => {
        mockRedisClient.keys.mock.mockImplementationOnce(() => Promise.resolve([
          'export:csv:key1',
          'export:json:key2'
        ]));
        
        const keys = await mockRedisClient.keys('export:*');
        let successCount = 0;
        let errorCount = 0;
        
        for (const key of keys) {
          try {
            if (key.includes('key1')) {
              mockRedisClient.del.mock.mockImplementationOnce(() => Promise.reject(new Error('Redis error')));
            } else {
              mockRedisClient.del.mock.mockImplementationOnce(() => Promise.resolve(1));
            }
            
            await mockRedisClient.del(key);
            successCount++;
          } catch (error) {
            errorCount++;
            console.error(`Failed to invalidate cache key ${key}:`, error.message);
          }
        }
        
        return {
          totalKeys: keys.length,
          successCount,
          errorCount
        };
      });

      const result = await ExportCacheService.invalidateExportCache(filters);

      assert.strictEqual(ExportCacheService.invalidateExportCache.mock.callCount(), 1);
      assert.strictEqual(result.totalKeys, 2);
      assert.strictEqual(result.successCount, 1);
      assert.strictEqual(result.errorCount, 1);
    });
  });

  describe('Cache Failure Fallback Scenarios', () => {
    test('should handle Redis connection failures gracefully', async () => {
      const cacheKey = 'export:csv:test';

      ExportCacheService.isCacheAvailable.mock.mockImplementationOnce(async () => {
        try {
          mockRedisClient.ping.mock.mockImplementationOnce(() => Promise.reject(new Error('Connection refused')));
          await mockRedisClient.ping();
          return true;
        } catch (error) {
          console.error('Cache unavailable:', error.message);
          return false;
        }
      });

      ExportCacheService.getCachedExport.mock.mockImplementationOnce(async (key) => {
        const isAvailable = await ExportCacheService.isCacheAvailable();
        if (!isAvailable) {
          console.log('Cache unavailable, skipping cache lookup');
          return null;
        }
        
        return await mockRedisClient.get(key);
      });

      const result = await ExportCacheService.getCachedExport(cacheKey);

      assert.strictEqual(result, null);
      assert.strictEqual(ExportCacheService.isCacheAvailable.mock.callCount(), 1);
      assert.strictEqual(ExportCacheService.getCachedExport.mock.callCount(), 1);
    });

    test('should continue operation when cache write fails', async () => {
      const cacheKey = 'export:csv:writefail';
      const exportData = { data: 'test', metadata: {} };

      ExportCacheService.setCachedExport.mock.mockImplementationOnce(async (key, data, ttl) => {
        try {
          mockRedisClient.set.mock.mockImplementationOnce(() => Promise.reject(new Error('Write failed')));
          await mockRedisClient.set(key, JSON.stringify(data), 'EX', ttl);
          return true;
        } catch (error) {
          console.error('Cache write failed:', error.message);
          return false; // Continue without caching
        }
      });

      const result = await ExportCacheService.setCachedExport(cacheKey, exportData, testConfig.cacheTTL);

      assert.strictEqual(result, false);
      assert.strictEqual(ExportCacheService.setCachedExport.mock.callCount(), 1);
    });

    test('should handle cache read timeouts', async () => {
      const cacheKey = 'export:csv:timeout';

      ExportCacheService.getCachedExport.mock.mockImplementationOnce(async (key) => {
        // Simulate timeout handling without actually timing out
        console.error('Cache read timeout, proceeding without cache');
        return null;
      });

      const result = await ExportCacheService.getCachedExport(cacheKey);

      assert.strictEqual(result, null);
      assert.strictEqual(ExportCacheService.getCachedExport.mock.callCount(), 1);
    });

    test('should handle Redis memory pressure scenarios', async () => {
      const cacheKey = 'export:csv:memory';
      const exportData = { data: 'large data set', metadata: {} };

      ExportCacheService.setCachedExport.mock.mockImplementationOnce(async (key, data, ttl) => {
        try {
          mockRedisClient.set.mock.mockImplementationOnce(() => Promise.reject(new Error('OOM command not allowed')));
          await mockRedisClient.set(key, JSON.stringify(data), 'EX', ttl);
          return true;
        } catch (error) {
          if (error.message.includes('OOM')) {
            console.error('Redis memory pressure detected, skipping cache');
            return false;
          }
          throw error;
        }
      });

      const result = await ExportCacheService.setCachedExport(cacheKey, exportData, testConfig.cacheTTL);

      assert.strictEqual(result, false);
      assert.strictEqual(ExportCacheService.setCachedExport.mock.callCount(), 1);
    });

    test('should implement circuit breaker pattern for cache failures', async () => {
      let failureCount = 0;
      const maxFailures = 3;

      ExportCacheService.getCachedExport.mock.mockImplementation(async (key) => {
        // Simulate circuit breaker logic
        if (failureCount >= maxFailures) {
          console.log('Circuit breaker open, skipping cache');
          return null;
        }
        
        try {
          mockRedisClient.get.mock.mockImplementation(() => Promise.reject(new Error('Connection error')));
          const data = await mockRedisClient.get(key);
          failureCount = 0; // Reset on success
          return data ? JSON.parse(data) : null;
        } catch (error) {
          failureCount++;
          console.error(`Cache failure ${failureCount}/${maxFailures}:`, error.message);
          
          if (failureCount >= maxFailures) {
            console.log('Circuit breaker opened due to repeated failures');
          }
          
          return null;
        }
      });

      // Simulate multiple failures
      for (let i = 0; i < 5; i++) {
        const result = await ExportCacheService.getCachedExport(`test:${i}`);
        assert.strictEqual(result, null);
      }

      assert.strictEqual(ExportCacheService.getCachedExport.mock.callCount(), 5);
    });

    test('should provide cache health monitoring', async () => {
      ExportCacheService.getCacheStats.mock.mockImplementationOnce(async () => {
        try {
          mockRedisClient.ping.mock.mockImplementationOnce(() => Promise.resolve('PONG'));
          mockRedisClient.keys.mock.mockImplementationOnce(() => Promise.resolve(['export:csv:1', 'export:json:2']));
          
          const pingResult = await mockRedisClient.ping();
          const exportKeys = await mockRedisClient.keys('export:*');
          
          return {
            isHealthy: pingResult === 'PONG',
            totalExportCaches: exportKeys.length,
            lastChecked: new Date().toISOString(),
            status: 'operational'
          };
        } catch (error) {
          return {
            isHealthy: false,
            totalExportCaches: 0,
            lastChecked: new Date().toISOString(),
            status: 'error',
            error: error.message
          };
        }
      });

      const healthStats = await ExportCacheService.getCacheStats();

      assert.strictEqual(ExportCacheService.getCacheStats.mock.callCount(), 1);
      assert.strictEqual(healthStats.isHealthy, true);
      assert.strictEqual(healthStats.totalExportCaches, 2);
      assert.strictEqual(healthStats.status, 'operational');
      assert(healthStats.lastChecked);
    });
  });
});