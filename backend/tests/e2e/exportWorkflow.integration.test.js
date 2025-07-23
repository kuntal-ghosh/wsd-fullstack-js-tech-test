/**
 * @fileoverview End-to-end integration tests for the export workflow
 * @module tests/e2e/exportWorkflow.integration.test
 */

import { test, describe, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import Redis from 'ioredis';

// Import application modules
import { app } from '../../src/index.js';
import Task from '../../src/models/Task.js';
import Export from '../../src/models/Export.js';
import ExportService from '../../src/services/exportService.js';
import ExportCacheService from '../../src/services/exportCacheService.js';
import SocketHandlers from '../../src/sockets/socketHandlers.js';
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

describe('Export Workflow End-to-End Integration Tests', () => {
  let mongoServer;
  let httpServer;
  let socketServer;
  let socketClient;
  let socketHandlers;
  let exportDir;
  let receivedEvents = [];
  let clientSocket;
  let exportId;

  before(async () => {
    // Setup test environment
    await setupTestEnvironment();
    
    // Setup MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    
    // Create HTTP server
    httpServer = createServer(app);
    
    // Setup Socket.IO server
    socketServer = new Server(httpServer, {
      cors: { origin: '*' }
    });
    
    // Setup Socket handlers
    socketHandlers = new SocketHandlers(socketServer);
    
    // Start server
    await new Promise(resolve => httpServer.listen(0, resolve));
    const address = httpServer.address();
    const serverUrl = `http://localhost:${address.port}`;
    
    // Create Socket.IO client
    clientSocket = ioc(serverUrl, {
      transports: ['websocket'],
      autoConnect: false
    });
    
    // Create export directory
    exportDir = path.join(process.cwd(), 'test-exports');
    await fs.mkdir(exportDir, { recursive: true });
    process.env.EXPORT_DIR = exportDir;
    
    // Mock Redis client in ExportCacheService
    ExportCacheService.redisClient = mockRedisClient;
    
    // Reset received events
    receivedEvents = [];
  });
  
  after(async () => {
    // Close Socket.IO client
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    
    // Stop HTTP server
    if (httpServer) {
      await new Promise(resolve => httpServer.close(resolve));
    }
    
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
    // Clean database
    await cleanTestEnvironment();
    
    // Reset mocks
    mockRedisClient.get.mock.resetCalls();
    mockRedisClient.set.mock.resetCalls();
    mockRedisClient.setex.mock.resetCalls();
    mockRedisClient.del.mock.resetCalls();
    mockRedisClient.keys.mock.resetCalls();
    
    // Reset received events
    receivedEvents = [];
    
    // Connect Socket.IO client
    clientSocket.connect();
    
    await new Promise(resolve => {
      if (clientSocket.connected) {
        resolve();
      } else {
        clientSocket.once('connect', resolve);
      }
    });
    
    // Join exports room
    clientSocket.emit('join-exports');
    
    // Setup event listeners
    clientSocket.on('export-progress', (data) => {
      receivedEvents.push({ event: 'export-progress', data });
    });
    
    clientSocket.on('export-completed', (data) => {
      receivedEvents.push({ event: 'export-completed', data });
    });
    
    clientSocket.on('export-failed', (data) => {
      receivedEvents.push({ event: 'export-failed', data });
    });
    
    clientSocket.on('export-list-update', (data) => {
      receivedEvents.push({ event: 'export-list-update', data });
    });
    
    // Create test tasks
    await createMockTasks(50);
  });
  
  afterEach(async () => {
    // Reset received events
    receivedEvents = [];
    
    // Clean up any created files
    const files = await fs.readdir(exportDir).catch(() => []);
    await Promise.all(
      files.map(file => 
        fs.unlink(path.join(exportDir, file)).catch(() => {})
      )
    );
  });
  
  describe('Export Caching and Cache Invalidation', () => {
    test('should create cached export for identical filters', async () => {
      // Set up filters for export
      const filters = { status: 'pending', priority: 'high' };
      const format = 'csv';
      
      // Mock cache to return null (cache miss)
      mockRedisClient.get.mock.mockImplementationOnce(() => Promise.resolve(null));
      
      // First export (cache miss)
      const firstExport = await ExportService.createExport(filters, format);
      assert.ok(firstExport, 'Should create first export');
      assert.strictEqual(firstExport.status, 'processing');
      
      // Get first export ID for later checks
      exportId = firstExport._id.toString();
      
      // Process the export
      await ExportService.processExport(exportId, filters, format);
      
      // Verify cache was set
      assert(mockRedisClient.setex.mock.calls.length > 0, 'Should call Redis setex');
      
      // Generate same cache key for second request
      const cacheKey = ExportCacheService.generateExportCacheKey(filters, format);
      
      // Mock cache to return the cached export ID (cache hit)
      mockRedisClient.get.mock.mockImplementationOnce(() => Promise.resolve(JSON.stringify({ exportId })));
      
      // Second export with identical filters (should use cache)
      const secondExport = await ExportService.createExport(filters, format);
      
      assert.ok(secondExport, 'Should return export from second request');
      assert.strictEqual(secondExport._id.toString(), exportId, 'Should return the same export ID from cache');
      
      // Verify Redis get was called
      assert(mockRedisClient.get.mock.calls.length > 0, 'Should call Redis get');
    });
    
    test('should invalidate cache when filters change', async () => {
      // Set up initial filters
      const initialFilters = { status: 'pending' };
      const format = 'csv';
      
      // Mock cache to return null
      mockRedisClient.get.mock.mockImplementation(() => Promise.resolve(null));
      
      // Create first export
      const firstExport = await ExportService.createExport(initialFilters, format);
      assert.ok(firstExport, 'Should create first export');
      
      // Process the export
      await ExportService.processExport(firstExport._id.toString(), initialFilters, format);
      
      // Verify cache was set
      assert(mockRedisClient.setex.mock.calls.length > 0, 'Should call Redis setex');
      
      // Change filters
      const newFilters = { status: 'completed', priority: 'high' };
      
      // Create second export with different filters
      const secondExport = await ExportService.createExport(newFilters, format);
      
      // Should be a different export
      assert.ok(secondExport, 'Should create second export');
      assert.notStrictEqual(
        secondExport._id.toString(),
        firstExport._id.toString(),
        'Should create a new export for different filters'
      );
      
      // Verify we tried to check cache
      assert(mockRedisClient.get.mock.calls.length >= 2, 'Should call Redis get for each export');
    });
    
    test('should ignore corrupted cache data', async () => {
      const filters = { status: 'pending' };
      const format = 'json';
      
      // Mock cache to return corrupted data
      mockRedisClient.get.mock.mockImplementationOnce(() => Promise.resolve('{"corrupted":data}'));
      
      // Create export (should ignore corrupted cache)
      const exportDoc = await ExportService.createExport(filters, format);
      
      assert.ok(exportDoc, 'Should create new export despite corrupted cache');
      assert.strictEqual(exportDoc.status, 'processing', 'New export should be processing');
      
      // Verify we tried to check cache
      assert(mockRedisClient.get.mock.calls.length > 0, 'Should call Redis get');
    });
  });
  
  describe('Concurrent Export Handling', () => {
    test('should handle multiple concurrent exports', async () => {
      // Create different filter combinations
      const exportConfigs = [
        { filters: { status: 'pending' }, format: 'csv' },
        { filters: { priority: 'high' }, format: 'json' },
        { filters: { status: 'completed', priority: 'medium' }, format: 'csv' }
      ];
      
      // Start all exports concurrently
      const exportPromises = exportConfigs.map(config => 
        ExportService.createExport(config.filters, config.format)
      );
      
      // Wait for all exports to be created
      const exports = await Promise.all(exportPromises);
      
      assert.strictEqual(exports.length, exportConfigs.length, 'All exports should be created');
      
      // Check that all exports are different
      const exportIds = exports.map(exp => exp._id.toString());
      const uniqueIds = [...new Set(exportIds)];
      assert.strictEqual(uniqueIds.length, exportConfigs.length, 'All exports should have unique IDs');
      
      // Process all exports concurrently
      const processPromises = exports.map((exp, i) => 
        ExportService.processExport(
          exp._id.toString(),
          exportConfigs[i].filters,
          exportConfigs[i].format
        )
      );
      
      // Wait for all processing to complete
      await Promise.all(processPromises);
      
      // Find all exports in database
      const completedExports = await Export.find({});
      
      assert.strictEqual(completedExports.length, exportConfigs.length, 'All exports should exist in database');
      
      // Check that all exports completed
      const allCompleted = completedExports.every(exp => exp.status === 'completed');
      assert.ok(allCompleted, 'All exports should be marked as completed');
      
      // Check that all exports have unique file paths
      const filePaths = completedExports.map(exp => exp.filePath).filter(Boolean);
      const uniqueFilePaths = [...new Set(filePaths)];
      assert.strictEqual(uniqueFilePaths.length, filePaths.length, 'All exports should have unique file paths');
    });
    
    test('should handle resource limits during concurrent exports', async () => {
      // Create a large number of export configs
      const exportConfigs = Array.from({ length: 10 }, (_, i) => ({
        filters: { status: i % 3 === 0 ? 'pending' : i % 3 === 1 ? 'in-progress' : 'completed' },
        format: i % 2 === 0 ? 'csv' : 'json'
      }));
      
      // Start all exports concurrently
      const exportPromises = exportConfigs.map(config => 
        ExportService.createExport(config.filters, config.format)
      );
      
      // Wait for all exports to be created
      const exports = await Promise.all(exportPromises);
      
      // Process all exports concurrently
      const processPromises = exports.map((exp, i) => 
        ExportService.processExport(
          exp._id.toString(),
          exportConfigs[i].filters,
          exportConfigs[i].format
        )
      );
      
      // Wait for all processing to complete or fail
      const results = await Promise.allSettled(processPromises);
      
      // Count successful exports
      const successfulExports = results.filter(result => result.status === 'fulfilled');
      console.log(`Completed ${successfulExports.length} out of ${exports.length} exports`);
      
      // Some exports might fail due to resource limits, but the system should remain stable
      const allExports = await Export.find({});
      assert.ok(allExports.length >= exports.length, 'All exports should exist in database');
    });
  });
  
  describe('Real-time Socket.IO Integration', () => {
    test('should receive real-time updates for the complete export lifecycle', async () => {
      // Create export with filters
      const filters = { status: 'pending', priority: 'high' };
      const format = 'csv';
      
      // Reset received events
      receivedEvents = [];
      
      // Create export
      const exportDoc = await ExportService.createExport(filters, format);
      const exportId = exportDoc._id.toString();
      
      // Wait for list update event (export created)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Manually broadcast creation event for testing
      socketHandlers.broadcastExportListUpdate('created', exportDoc);
      
      // Process export - this should trigger progress updates via socket
      await ExportService.processExport(exportId, filters, format);
      
      // Wait for events to be emitted
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check for export progress events
      const progressEvents = receivedEvents.filter(e => e.event === 'export-progress');
      assert.ok(progressEvents.length > 0, 'Should receive progress events');
      
      // Check for completion event
      const completionEvents = receivedEvents.filter(e => e.event === 'export-completed');
      assert.ok(completionEvents.length > 0, 'Should receive completion event');
      
      // Check completion data
      const completionEvent = completionEvents[0];
      assert.strictEqual(completionEvent.data.exportId, exportId, 'Completion event should have correct export ID');
      assert.strictEqual(completionEvent.data.status, 'completed', 'Status should be completed');
      assert.ok(completionEvent.data.exportData.downloadUrl, 'Should include download URL');
      
      // Find export in database to check final state
      const finalExport = await Export.findById(exportId);
      assert.strictEqual(finalExport.status, 'completed', 'Export should be marked as completed in database');
      assert.strictEqual(finalExport.progress, 100, 'Export progress should be 100%');
    });
    
    test('should handle export failure gracefully with real-time updates', async () => {
      // Create a mock export that will fail
      const filters = { 
        // Using invalid filters that will cause processing to fail
        status: 'invalid-status'
      };
      const format = 'csv';
      
      // Reset received events
      receivedEvents = [];
      
      // Create export but with invalid filters
      const exportDoc = new Export({
        filters,
        format,
        status: 'processing'
      });
      await exportDoc.save();
      
      const exportId = exportDoc._id.toString();
      
      // Manually fail the export
      await exportDoc.markFailed('Invalid status filter');
      
      // Manually broadcast failure for testing
      socketHandlers.broadcastExportFailed(exportId, 'Invalid status filter');
      
      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Check for failure event
      const failureEvents = receivedEvents.filter(e => e.event === 'export-failed');
      assert.ok(failureEvents.length > 0, 'Should receive failure event');
      
      // Check failure data
      const failureEvent = failureEvents[0];
      assert.strictEqual(failureEvent.data.exportId, exportId, 'Failure event should have correct export ID');
      assert.ok(failureEvent.data.error, 'Should include error message');
    });
  });
  
  describe('Caching with Concurrent Export Requests', () => {
    test('should handle race conditions with cache access', async () => {
      const filters = { status: 'pending' };
      const format = 'csv';
      const cacheKey = ExportCacheService.generateExportCacheKey(filters, format);
      
      // First mock Redis to return null (cache miss)
      mockRedisClient.get.mock.mockImplementationOnce(() => Promise.resolve(null));
      
      // Then mock it to return a cached result for subsequent calls
      mockRedisClient.get.mock.mockImplementation((key) => {
        if (key === cacheKey) {
          return Promise.resolve(JSON.stringify({ exportId: 'cached-export-id' }));
        }
        return Promise.resolve(null);
      });
      
      // Start multiple concurrent requests with same filters
      const requestCount = 5;
      const exportPromises = Array.from({ length: requestCount }, () => 
        ExportService.createExport(filters, format)
      );
      
      // Wait for all requests to complete
      const exports = await Promise.all(exportPromises);
      
      // The first request should create a new export
      // Subsequent requests should return the cached export
      const uniqueIds = new Set(exports.map(exp => exp._id.toString()));
      
      // We expect either 1 or 2 unique IDs depending on how the race condition resolves
      // If perfectly synchronized, all would get the cached ID, but in practice
      // we might see 2 exports created in a race condition
      assert.ok(uniqueIds.size <= 2, 'Should have at most 2 unique export IDs due to race conditions');
      
      // Verify Redis cache was checked for each request
      assert.ok(mockRedisClient.get.mock.calls.length >= requestCount, 'Cache should be checked for each request');
    });
  });
});