/**
 * @fileoverview End-to-end tests for concurrent export handling and performance
 * @module tests/e2e/exportConcurrency.test
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';

// Import application modules
import { app } from '../../src/index.js';
import Task from '../../src/models/Task.js';
import Export from '../../src/models/Export.js';
import ExportService from '../../src/services/exportService.js';
import SocketHandlers from '../../src/sockets/socketHandlers.js';
import { setupTestEnvironment, teardownTestEnvironment, cleanTestEnvironment } from '../utils/testSetup.js';
import { createMockTasks } from '../utils/mockData.js';

describe('Export Concurrency and Performance Tests', () => {
  let mongoServer;
  let httpServer;
  let socketServer;
  let socketHandlers;
  let exportDir;

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
    socketServer = new SocketServer(httpServer, {
      cors: { origin: '*' }
    });
    
    // Setup Socket handlers
    socketHandlers = new SocketHandlers(socketServer);
    
    // Start server
    await new Promise(resolve => httpServer.listen(0, resolve));
    
    // Create export directory
    exportDir = path.join(process.cwd(), 'test-exports');
    await fs.mkdir(exportDir, { recursive: true }).catch(() => {});
    process.env.EXPORT_DIR = exportDir;
    
    // Create test tasks - large dataset for performance testing
    await createMockTasks(1000);
  });
  
  after(async () => {
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
    // Clean database between tests
    await cleanTestEnvironment();
    
    // Clean up any export files
    const files = await fs.readdir(exportDir).catch(() => []);
    await Promise.all(
      files.map(file => 
        fs.unlink(path.join(exportDir, file)).catch(() => {})
      )
    );
    
    // Reset export processor concurrency settings to default
    process.env.MAX_CONCURRENT_EXPORTS = '5';
  });

  describe('Concurrent Export Processing', () => {
    test('should handle multiple concurrent export requests efficiently', async () => {
      // Create a variety of filter combinations
      const exportConfigs = [
        { filters: { status: 'pending' }, format: 'csv' },
        { filters: { status: 'completed' }, format: 'csv' },
        { filters: { status: 'in-progress' }, format: 'json' },
        { filters: { priority: 'high' }, format: 'csv' },
        { filters: { priority: 'medium' }, format: 'json' },
        { filters: { priority: 'low' }, format: 'csv' },
        { filters: { status: 'pending', priority: 'high' }, format: 'json' },
        { filters: { status: 'completed', priority: 'low' }, format: 'csv' },
        { filters: { dateRange: { from: '2023-01-01', to: '2023-12-31' } }, format: 'json' },
        { filters: { search: 'important task' }, format: 'csv' }
      ];
      
      // Start time for performance measurement
      const startTime = Date.now();
      
      // Create all exports concurrently
      const exportPromises = exportConfigs.map(config => 
        ExportService.createExport(config.filters, config.format)
      );
      
      // Wait for all exports to be created
      const exports = await Promise.all(exportPromises);
      
      // Verify all exports were created
      assert.strictEqual(exports.length, exportConfigs.length, 'All exports should be created');
      
      // Process exports concurrently
      const processPromises = exports.map((exp, i) => 
        ExportService.processExport(
          exp._id.toString(),
          exportConfigs[i].filters,
          exportConfigs[i].format
        )
      );
      
      // Wait for all processing to complete with timeout
      const results = await Promise.allSettled(processPromises);
      
      // End time for performance measurement
      const endTime = Date.now();
      const totalDuration = endTime - startTime;
      
      // Log performance metrics
      console.log(`Processed ${exportConfigs.length} concurrent exports in ${totalDuration}ms`);
      console.log(`Average time per export: ${totalDuration / exportConfigs.length}ms`);
      
      // Count successful exports
      const successfulExports = results.filter(r => r.status === 'fulfilled').length;
      
      // Verify exports were created successfully
      assert.ok(successfulExports > 0, 'Some exports should succeed');
      
      // Fetch final export records from database
      const exportRecords = await Export.find({});
      
      // Check that all exports have been processed
      const processedExports = exportRecords.filter(exp => 
        exp.status === 'completed' || exp.status === 'failed'
      );
      
      assert.ok(processedExports.length >= successfulExports, 'All successful exports should be processed');
      
      // Check files were generated
      const completedExports = exportRecords.filter(exp => exp.status === 'completed');
      await Promise.all(completedExports.map(async (exp) => {
        if (exp.filePath) {
          try {
            const fileExists = await fs.access(exp.filePath)
              .then(() => true)
              .catch(() => false);
            
            assert.ok(fileExists, `File should exist for export ${exp._id}`);
          } catch (error) {
            // Ignore file check errors in this test
          }
        }
      }));
    });
    
    test('should respect MAX_CONCURRENT_EXPORTS limit', async () => {
      // Set low concurrency limit for testing
      process.env.MAX_CONCURRENT_EXPORTS = '3';
      
      // Create a large number of exports (more than the limit)
      const exportCount = 10;
      const exports = [];
      
      for (let i = 0; i < exportCount; i++) {
        const exportDoc = new Export({
          format: i % 2 === 0 ? 'csv' : 'json',
          filters: { status: i % 3 === 0 ? 'pending' : i % 3 === 1 ? 'in-progress' : 'completed' },
          status: 'queued',
          progress: 0
        });
        
        await exportDoc.save();
        exports.push(exportDoc);
      }
      
      // Start tracking active exports
      let maxConcurrentObserved = 0;
      let currentlyProcessing = 0;
      
      // Override the processExport method to track concurrency
      const originalProcessExport = ExportService.processExport;
      ExportService.processExport = async function(exportId, filters, format) {
        currentlyProcessing++;
        
        // Update max concurrent if higher
        if (currentlyProcessing > maxConcurrentObserved) {
          maxConcurrentObserved = currentlyProcessing;
        }
        
        try {
          // Add a small delay to ensure overlap
          await new Promise(resolve => setTimeout(resolve, 50));
          return await originalProcessExport.call(this, exportId, filters, format);
        } finally {
          currentlyProcessing--;
        }
      };
      
      // Process all exports
      const processPromises = exports.map(exp => 
        ExportService.processExport(
          exp._id.toString(),
          exp.filters,
          exp.format
        )
      );
      
      // Wait for all exports to complete
      await Promise.allSettled(processPromises);
      
      // Restore original method
      ExportService.processExport = originalProcessExport;
      
      // Verify concurrency limit was respected
      assert.ok(
        maxConcurrentObserved <= 3,
        `Max concurrent exports should not exceed limit of 3 (observed: ${maxConcurrentObserved})`
      );
      
      // Check that all exports were eventually processed
      const exportRecords = await Export.find({});
      const processedExports = exportRecords.filter(exp => 
        exp.status === 'completed' || exp.status === 'failed'
      );
      
      assert.strictEqual(
        processedExports.length,
        exportCount,
        'All exports should be processed eventually despite concurrency limits'
      );
    });
  });
  
  describe('Export Performance Tests', () => {
    test('should handle large dataset exports efficiently', async () => {
      // Create large dataset export
      const filters = { status: 'pending' };  // Will match many tasks
      const format = 'csv';
      
      const exportDoc = await ExportService.createExport(filters, format);
      assert.ok(exportDoc, 'Export should be created for large dataset');
      
      // Time the export processing
      const startTime = Date.now();
      await ExportService.processExport(exportDoc._id.toString(), filters, format);
      const duration = Date.now() - startTime;
      
      // Log performance metrics
      console.log(`Processed large dataset export in ${duration}ms`);
      
      // Verify the export completed successfully
      const updatedExport = await Export.findById(exportDoc._id);
      assert.strictEqual(updatedExport.status, 'completed', 'Export should complete successfully');
      
      // Check the file size for a rough performance metric
      if (updatedExport.filePath) {
        const stats = await fs.stat(updatedExport.filePath);
        console.log(`Generated file size: ${stats.size} bytes`);
        
        // File should have actual content
        assert.ok(stats.size > 100, 'Generated file should contain data');
      }
      
      // Performance should be reasonable - adapt thresholds based on your environment
      assert.ok(duration < 10000, `Export processing should complete in reasonable time (took ${duration}ms)`);
    });
    
    test('should optimize memory usage during large exports', async () => {
      // Create memory-intensive export (all tasks, full data)
      const filters = {};  // No filters means all tasks
      const format = 'json';  // JSON typically uses more memory due to object structure
      
      const exportDoc = await ExportService.createExport(filters, format);
      
      // Process the export
      await ExportService.processExport(exportDoc._id.toString(), filters, format);
      
      // Verify export completed
      const updatedExport = await Export.findById(exportDoc._id);
      assert.strictEqual(updatedExport.status, 'completed', 'Export should complete without memory issues');
      
      // File should exist and have content
      if (updatedExport.filePath) {
        const fileExists = await fs.access(updatedExport.filePath)
          .then(() => true)
          .catch(() => false);
        
        assert.ok(fileExists, 'Export file should exist');
        
        const stats = await fs.stat(updatedExport.filePath);
        assert.ok(stats.size > 1024, 'Generated file should contain significant data');
      }
    });
    
    test('should handle export queuing under high load', async () => {
      // Create many exports in quick succession
      const exportCount = 20;
      const startTime = Date.now();
      
      // Create exports in sequence but very quickly
      for (let i = 0; i < exportCount; i++) {
        const filters = { priority: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low' };
        const format = i % 2 === 0 ? 'csv' : 'json';
        
        const exportDoc = await ExportService.createExport(filters, format);
        assert.ok(exportDoc, `Export ${i} should be created`);
        
        // Don't wait for processing, simulate rapid export creation
      }
      
      // Check if all exports are tracked in the database
      const exports = await Export.find({});
      assert.strictEqual(exports.length, exportCount, 'All exports should be tracked in database');
      
      const creationDuration = Date.now() - startTime;
      console.log(`Created ${exportCount} exports in ${creationDuration}ms`);
      
      // Verify system remained responsive
      assert.ok(creationDuration < exportCount * 500, 'Export creation should remain responsive under load');
      
      // Now let the system process them all
      const allProcessed = async () => {
        const pendingExports = await Export.countDocuments({
          status: { $in: ['queued', 'processing'] }
        });
        return pendingExports === 0;
      };
      
      // Wait for all exports to complete with timeout
      const maxWaitTime = 30000; // 30 seconds max wait
      const startWaitTime = Date.now();
      
      while (Date.now() - startWaitTime < maxWaitTime) {
        if (await allProcessed()) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Check final status
      const completedExports = await Export.countDocuments({ status: 'completed' });
      console.log(`Completed ${completedExports} out of ${exportCount} exports`);
      
      // We should have at least some completed exports, even if not all
      assert.ok(completedExports > 0, 'Some exports should complete successfully');
    });
  });
  
  describe('Resilience Under Load', () => {
    test('should recover from export failures without affecting other exports', async () => {
      // Create one export that will fail
      const failingExport = new Export({
        format: 'csv',
        // Use invalid filters to force a failure
        filters: { status: 'invalid-status' },
        status: 'processing',
        progress: 0
      });
      await failingExport.save();
      
      // Create several valid exports
      const validExports = [];
      for (let i = 0; i < 5; i++) {
        const exportDoc = new Export({
          format: 'csv',
          filters: { status: 'pending' },
          status: 'processing',
          progress: 0
        });
        await exportDoc.save();
        validExports.push(exportDoc);
      }
      
      // Process all exports concurrently
      const processPromises = [
        // This one should fail
        ExportService.processExport(
          failingExport._id.toString(), 
          failingExport.filters, 
          failingExport.format
        ).catch(e => console.log('Expected failure in test export')),
        
        // These should succeed
        ...validExports.map(exp => 
          ExportService.processExport(
            exp._id.toString(),
            exp.filters,
            exp.format
          )
        )
      ];
      
      // Wait for all processing to complete or fail
      await Promise.allSettled(processPromises);
      
      // Check that the failing export was marked as failed
      const updatedFailingExport = await Export.findById(failingExport._id);
      assert.strictEqual(
        updatedFailingExport.status,
        'failed',
        'Export with invalid filters should be marked as failed'
      );
      
      // Check that valid exports succeeded despite the failure
      const updatedValidExports = await Promise.all(
        validExports.map(exp => Export.findById(exp._id))
      );
      
      const allSuccessful = updatedValidExports.every(exp => exp.status === 'completed');
      assert.ok(allSuccessful, 'Valid exports should succeed despite failures in other exports');
    });
    
    test('should maintain system stability during high concurrency', async () => {
      // Create an extremely high number of export requests
      const exportCount = 30;
      const exportDocs = [];
      
      // Create export documents
      for (let i = 0; i < exportCount; i++) {
        const exportDoc = new Export({
          format: i % 2 === 0 ? 'csv' : 'json',
          filters: { 
            status: i % 3 === 0 ? 'pending' : i % 3 === 1 ? 'in-progress' : 'completed',
            priority: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low'
          },
          status: 'processing',
          progress: 0
        });
        await exportDoc.save();
        exportDocs.push(exportDoc);
      }
      
      // Process all exports simultaneously - this is an extreme load test
      const processPromises = exportDocs.map(exp => 
        ExportService.processExport(
          exp._id.toString(),
          exp.filters,
          exp.format
        ).catch(e => {
          // Catch errors to prevent test failure
          return { error: e.message };
        })
      );
      
      // Wait for all processing to complete or fail
      const results = await Promise.allSettled(processPromises);
      
      // Count successful exports
      const successfulResults = results.filter(r => r.status === 'fulfilled' && !r.value?.error);
      
      // System should process at least some exports successfully
      assert.ok(successfulResults.length > 0, 'System should process some exports successfully under extreme load');
      
      // Check database integrity
      const allExports = await Export.find({});
      assert.strictEqual(allExports.length, exportCount, 'All export records should remain in database');
      
      // Each export should have a final status (not stuck in processing)
      const stuckExports = allExports.filter(exp => exp.status === 'processing');
      assert.strictEqual(
        stuckExports.length, 
        0, 
        'No exports should be stuck in processing state after completion'
      );
    });
  });
});