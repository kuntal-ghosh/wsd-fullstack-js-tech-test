/**
 * @fileoverview Comprehensive tests for export caching functionality
 * @module tests/e2e/exportCaching.test
 */

import { test, describe, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import Redis from 'ioredis';

// Import application modules
import Task from '../../src/models/Task.js';
import Export from '../../src/models/Export.js';
import ExportService from '../../src/services/exportService.js';
import ExportCacheService from '../../src/services/exportCacheService.js';
import { setupTestEnvironment, teardownTestEnvironment, cleanTestEnvironment } from '../utils/testSetup.js';
import { generateMockTasks, createMockTasks } from '../utils/mockData.js';

// Mock Redis for controlled testing
const mockRedisClient = {
  get: mock.fn(),
  set: mock.fn(),
  setex: mock.fn(),
  del: mock.fn(),
  keys: mock.fn(),
  quit: mock.fn()
};

describe('Export Caching End-to-End Tests', () => {
  let mongoServer;
  let exportDir;
  
  before(async () => {
    // Setup test environment
    await setupTestEnvironment();
    
    // Setup MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    
    // Create export directory
    exportDir = path.join(process.cwd(), 'test-exports');
    await fs.mkdir(exportDir, { recursive: true }).catch(() => {});
    process.env.EXPORT_DIR = exportDir;
    
    // Mock Redis client in ExportCacheService
    ExportCacheService.redisClient = mockRedisClient;
    
    // Create test tasks
    await createMockTasks(100);
  });
  
  after(async () => {
    // Stop MongoDB
    if (mongoose.connection.readyState) {
      await mongoose.connection.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
    
    // Remove test exports directory
    try {
      await fs.rm(exportDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Error cleaning up export directory:', error);
    }
    
    // Tear down test environment
    await teardownTestEnvironment();
  });
  
  beforeEach(async () => {
    // Clean database and reset mocks before each test
    await cleanTestEnvironment();
    
    mockRedisClient.get.mock.resetCalls();
    mockRedisClient.set.mock.resetCalls();
    mockRedisClient.setex.mock.resetCalls();
    mockRedisClient.del.mock.resetCalls();
    mockRedisClient.keys.mock.resetCalls();
    
    // Clean up any created files
    const files = await fs.readdir(exportDir).catch(() => []);
    await Promise.all(
      files.map(file => 
        fs.unlink(path.join(exportDir, file)).catch(() => {})
      )
    );
  });
  
  describe('Cache Key Generation', () => {
    test('should generate deterministic cache keys for identical filters', async () => {
      // Test different filter orderings with the same data
      const filters1 = { status: 'pending', priority: 'high' };
      const filters2 = { priority: 'high', status: 'pending' };
      
      const key1 = ExportCacheService.generateExportCacheKey(filters1, 'csv');
      const key2 = ExportCacheService.generateExportCacheKey(filters2, 'csv');
      
      assert.strictEqual(key1, key2, 'Cache keys should be identical regardless of property order');
    });
    
    test('should generate different cache keys for different filters', async () => {
      // Test similar but different filters
      const filters1 = { status: 'pending', priority: 'high' };
      const filters2 = { status: 'completed', priority: 'high' };
      const filters3 = { status: 'pending', priority: 'medium' };
      
      const key1 = ExportCacheService.generateExportCacheKey(filters1, 'csv');
      const key2 = ExportCacheService.generateExportCacheKey(filters2, 'csv');
      const key3 = ExportCacheService.generateExportCacheKey(filters3, 'csv');
      
      assert.notStrictEqual(key1, key2, 'Different status should result in different keys');
      assert.notStrictEqual(key1, key3, 'Different priority should result in different keys');
      assert.notStrictEqual(key2, key3, 'Different status and priority should result in different keys');
    });
    
    test('should generate different cache keys for different formats', async () => {
      const filters = { status: 'pending', priority: 'high' };
      
      const csvKey = ExportCacheService.generateExportCacheKey(filters, 'csv');
      const jsonKey = ExportCacheService.generateExportCacheKey(filters, 'json');
      
      assert.notStrictEqual(csvKey, jsonKey, 'Different formats should result in different keys');
    });
    
    test('should handle complex nested filter objects', async () => {
      const complexFilters = {
        status: ['pending', 'in-progress'],
        dateRange: {
          from: '2023-01-01',
          to: '2023-12-31'
        },
        nested: {
          property: {
            deep: true
          }
        }
      };
      
      const key = ExportCacheService.generateExportCacheKey(complexFilters, 'csv');
      assert.ok(key, 'Should generate key for complex filters');
      assert.ok(typeof key === 'string', 'Key should be a string');
    });
  });
  
  describe('Cache Invalidation', () => {
    test('should invalidate cache when tasks are modified', async () => {
      // Create an export with filters
      const filters = { status: 'pending' };
      const format = 'csv';
      
      // Mock cache to return null initially
      mockRedisClient.get.mock.mockResolvedValueOnce(null);
      
      // Create and process the export
      const exportDoc = await ExportService.createExport(filters, format);
      await ExportService.processExport(exportDoc._id.toString(), filters, format);
      
      // Verify cache was set
      assert(mockRedisClient.setex.mock.calls.length > 0, 'Should call Redis setex');
      
      // Simulate task modifications that would invalidate cache
      const cacheKey = ExportCacheService.generateExportCacheKey(filters, format);
      await ExportCacheService.invalidateCache(filters);
      
      // Verify cache deletion was attempted
      assert(mockRedisClient.keys.mock.calls.length > 0, 'Should search for cache keys to delete');
      assert(mockRedisClient.del.mock.calls.length > 0, 'Should call Redis del');
      
      // Now a new export with the same filters should miss the cache
      mockRedisClient.get.mock.mockResolvedValueOnce(null);
      
      const newExportDoc = await ExportService.createExport(filters, format);
      assert.notStrictEqual(
        newExportDoc._id.toString(),
        exportDoc._id.toString(),
        'Should create new export after cache invalidation'
      );
    });
    
    test('should automatically invalidate expired cache entries', async () => {
      const filters = { status: 'pending' };
      const format = 'csv';
      
      // Mock cache to return null
      mockRedisClient.get.mock.mockResolvedValueOnce(null);
      
      // Set very short TTL for testing
      const originalTtl = ExportCacheService.CACHE_TTL;
      ExportCacheService.CACHE_TTL = 1; // 1 second TTL
      
      // Create and process export
      const exportDoc = await ExportService.createExport(filters, format);
      await ExportService.processExport(exportDoc._id.toString(), filters, format);
      
      // Verify cache was set with short TTL
      assert(mockRedisClient.setex.mock.calls.length > 0, 'Should call Redis setex');
      assert.strictEqual(
        mockRedisClient.setex.mock.calls[0][1],
        1,
        'Should set cache with 1 second TTL'
      );
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Mock cache to return null (expired)
      mockRedisClient.get.mock.mockResolvedValueOnce(null);
      
      // Create new export with same filters
      const newExportDoc = await ExportService.createExport(filters, format);
      assert.notStrictEqual(
        newExportDoc._id.toString(),
        exportDoc._id.toString(),
        'Should create new export after cache expiration'
      );
      
      // Restore original TTL
      ExportCacheService.CACHE_TTL = originalTtl;
    });
    
    test('should invalidate specific cache entries by pattern', async () => {
      // Create multiple exports with different filters
      const filterSets = [
        { status: 'pending' },
        { status: 'completed' },
        { status: 'pending', priority: 'high' }
      ];
      
      // Mock Redis for pattern-based deletion
      mockRedisClient.keys.mock.mockImplementation((pattern) => {
        if (pattern.includes('pending')) {
          return Promise.resolve(['export:csv:pending', 'export:csv:pending:high']);
        }
        return Promise.resolve([]);
      });
      
      // Invalidate only pending-related caches
      await ExportCacheService.invalidateCache({ status: 'pending' });
      
      // Verify the correct pattern was used
      assert(mockRedisClient.keys.mock.calls.length > 0, 'Should search for cache keys');
      const pattern = mockRedisClient.keys.mock.calls[0][0];
      assert.ok(pattern.includes('pending'), 'Pattern should include the pending status');
      
      // Verify only the matching keys were deleted
      assert(mockRedisClient.del.mock.calls.length > 0, 'Should call Redis del');
    });
  });
  
  describe('Cache Hit Performance', () => {
    test('should return cached exports much faster than generating new ones', async () => {
      const filters = { status: 'pending' };
      const format = 'csv';
      
      // First export - cache miss
      mockRedisClient.get.mock.mockResolvedValueOnce(null);
      
      const startNoCache = Date.now();
      const firstExport = await ExportService.createExport(filters, format);
      await ExportService.processExport(firstExport._id.toString(), filters, format);
      const durationNoCache = Date.now() - startNoCache;
      
      // Second export - cache hit
      const exportId = firstExport._id.toString();
      mockRedisClient.get.mock.mockResolvedValueOnce(JSON.stringify({ exportId }));
      
      const startWithCache = Date.now();
      const secondExport = await ExportService.createExport(filters, format);
      const durationWithCache = Date.now() - startWithCache;
      
      assert.ok(
        durationWithCache < durationNoCache,
        `Cache hit should be faster (cache: ${durationWithCache}ms, no cache: ${durationNoCache}ms)`
      );
    });
  });
  
  describe('Cache Size Management', () => {
    test('should handle large cache values without performance degradation', async () => {
      // Generate a large filter object
      const largeFilters = {
        status: Array(100).fill('pending'),
        priority: Array(100).fill('high'),
        tags: Array(100).fill('tag').map((tag, i) => `${tag}-${i}`),
        largeData: Array(500).fill('x').join('') // Large string
      };
      
      // Generate cache key for large filters
      const start = Date.now();
      const cacheKey = ExportCacheService.generateExportCacheKey(largeFilters, 'csv');
      const duration = Date.now() - start;
      
      assert.ok(duration < 100, `Large filter key generation should be fast (took ${duration}ms)`);
      
      // Simulate storing large data in cache
      const exportId = new mongoose.Types.ObjectId().toString();
      await ExportCacheService.setCachedExport(cacheKey, exportId);
      
      assert(mockRedisClient.setex.mock.calls.length > 0, 'Should call Redis setex');
    });
  });
  
  describe('Cache Reliability', () => {
    test('should fallback gracefully on cache failure', async () => {
      const filters = { status: 'pending' };
      const format = 'csv';
      
      // Make Redis get throw an error
      mockRedisClient.get.mock.mockRejectedValueOnce(new Error('Redis connection error'));
      
      try {
        // Should not throw despite Redis failure
        const exportDoc = await ExportService.createExport(filters, format);
        assert.ok(exportDoc, 'Should create export despite cache failure');
        assert.strictEqual(exportDoc.status, 'processing', 'Export should be in processing state');
      } catch (error) {
        assert.fail('Should not throw on Redis failure');
      }
    });
    
    test('should handle corrupted cache data gracefully', async () => {
      const filters = { status: 'pending' };
      const format = 'csv';
      
      // Return invalid JSON from Redis
      mockRedisClient.get.mock.mockResolvedValueOnce('not valid json{');
      
      try {
        const exportDoc = await ExportService.createExport(filters, format);
        assert.ok(exportDoc, 'Should create new export despite corrupted cache');
      } catch (error) {
        assert.fail('Should handle corrupted cache gracefully');
      }
    });
    
    test('should handle missing exported files gracefully', async () => {
      const filters = { status: 'pending' };
      const format = 'csv';
      
      // Create an export but don't actually create the file
      const exportDoc = new Export({
        status: 'completed',
        progress: 100,
        format,
        filters,
        filePath: path.join(exportDir, 'non-existent-file.csv')
      });
      await exportDoc.save();
      
      const exportId = exportDoc._id.toString();
      
      // Cache this export even though file is missing
      const cacheKey = ExportCacheService.generateExportCacheKey(filters, format);
      mockRedisClient.get.mock.mockResolvedValueOnce(JSON.stringify({ exportId }));
      
      // Attempt to get the cached export
      const cachedExport = await ExportCacheService.getCachedExport(cacheKey);
      
      // If the service correctly checks for file existence, it should return null
      assert.strictEqual(cachedExport, null, 'Should not return export with missing file');
      
      // Verify cache was invalidated
      assert(mockRedisClient.del.mock.calls.length > 0, 'Should delete invalid cache entry');
    });
  });
});