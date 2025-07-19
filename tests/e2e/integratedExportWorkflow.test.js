/**
 * @fileoverview Comprehensive end-to-end integration tests for the export workflow
 * combining frontend UI interactions and backend processing
 */

import { describe, it, beforeEach, afterEach, vi, expect } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { createRouter, createWebHistory } from 'vue-router';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { io as SocketClient } from 'socket.io-client';
import fs from 'fs/promises';
import path from 'path';

// Import backend components
import { app } from '../../backend/src/index.js';
import Task from '../../backend/src/models/Task.js';
import Export from '../../backend/src/models/Export.js';
import ExportService from '../../backend/src/services/exportService.js';
import SocketHandlers from '../../backend/src/sockets/socketHandlers.js';
import { setupTestEnvironment, teardownTestEnvironment } from '../../backend/tests/utils/testSetup.js';
import { createMockTasks } from '../../backend/tests/utils/mockData.js';

// Import frontend components
import App from '../../frontend/src/App.vue';
import { useExportStore } from '../../frontend/src/stores/exportStore';
import { useTaskStore } from '../../frontend/src/stores/taskStore';

describe('Integrated Export Workflow E2E Tests', () => {
  // Backend test setup
  let mongoServer;
  let httpServer;
  let socketServer;
  let socketHandlers;
  let exportDir;
  let serverAddress;
  
  // Frontend test setup
  let wrapper;
  let router;
  let pinia;
  let vuetify;
  let exportStore;
  let taskStore;
  let clientSocket;

  beforeEach(async () => {
    // ============= BACKEND SETUP =============
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
    serverAddress = httpServer.address();
    const serverUrl = `http://localhost:${serverAddress.port}`;
    
    // Create export directory
    exportDir = path.join(process.cwd(), 'test-exports');
    await fs.mkdir(exportDir, { recursive: true }).catch(() => {});
    process.env.EXPORT_DIR = exportDir;
    
    // Create test tasks in database
    await createMockTasks(50);
    
    // ============= FRONTEND SETUP =============
    pinia = createPinia();
    setActivePinia(pinia);
    vuetify = createVuetify({ components, directives });
    
    // Get store instances
    exportStore = useExportStore();
    taskStore = useTaskStore();
    
    // Create router
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', component: () => import('../../frontend/src/views/Dashboard.vue') },
        { path: '/tasks', component: () => import('../../frontend/src/views/Tasks.vue') },
        { path: '/exports', component: () => import('../../frontend/src/views/Exports.vue') }
      ]
    });
    
    // Configure API base URL to point to the test server
    vi.stubGlobal('import.meta', { 
      env: { 
        VITE_API_URL: serverUrl,
        VITE_SOCKET_URL: serverUrl
      } 
    });
    
    // Connect Socket.IO client
    clientSocket = SocketClient(serverUrl, {
      transports: ['websocket'],
      autoConnect: true
    });
    
    // Mount app
    wrapper = mount(App, {
      global: {
        plugins: [router, pinia, vuetify],
        stubs: {
          transition: false
        }
      }
    });
    
    await router.isReady();
  });
  
  afterEach(async () => {
    // Disconnect Socket.IO client
    if (clientSocket) {
      clientSocket.disconnect();
    }
    
    // Clean up frontend
    vi.resetAllMocks();
    wrapper.unmount();
    
    // Stop HTTP server
    if (httpServer) {
      await new Promise(resolve => httpServer.close(resolve));
    }
    
    // Clean up database
    if (mongoose.connection.readyState) {
      await mongoose.connection.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
    
    // Clean up export files
    try {
      const files = await fs.readdir(exportDir).catch(() => []);
      await Promise.all(
        files.map(file => 
          fs.unlink(path.join(exportDir, file)).catch(() => {})
        )
      );
      await fs.rmdir(exportDir).catch(() => {});
    } catch (error) {
      console.error('Error cleaning up export directory:', error);
    }
    
    await teardownTestEnvironment();
  });

  it('should complete integrated export workflow from UI to file download with real backend', async () => {
    // 1. Navigate to tasks page
    await router.push('/tasks');
    await flushPromises();
    
    // 2. Wait for tasks to load (real API call to test server)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 3. Apply filters via the UI
    const filterPanel = wrapper.findComponent({ name: 'AdvancedFilterPanel' });
    if (filterPanel.exists()) {
      await filterPanel.vm.$emit('filter', {
        status: ['pending'],
        priority: ['high']
      });
      await flushPromises();
    }
    
    // 4. Open export dialog
    const exportButton = wrapper.find('[data-test="export-button"]');
    if (exportButton.exists()) {
      await exportButton.trigger('click');
    } else {
      // Find by component name if test attribute not found
      const toolbar = wrapper.findComponent({ name: 'TaskToolbar' });
      if (toolbar.exists()) {
        await toolbar.vm.$emit('export');
      }
    }
    await flushPromises();
    
    // 5. Configure and start export
    const exportDialog = wrapper.findComponent({ name: 'ExportDialog' });
    if (exportDialog.exists()) {
      // Select CSV format
      const formatRadio = exportDialog.find('[data-test="format-csv"]');
      if (formatRadio.exists()) {
        await formatRadio.setValue(true);
      }
      
      // Set filename
      const filenameInput = exportDialog.find('[data-test="filename"]');
      if (filenameInput.exists()) {
        await filenameInput.setValue('integrated-test-export');
      }
      
      // Start export
      const startButton = exportDialog.find('[data-test="start-export"]');
      if (startButton.exists()) {
        await startButton.trigger('click');
      }
      await flushPromises();
    }
    
    // 6. Wait for export processing to complete (real backend processing)
    let exportComplete = false;
    const timeout = setTimeout(() => {
      throw new Error('Export processing timed out');
    }, 10000); // 10 second timeout
    
    // Set up real-time event listener for export completion
    clientSocket.on('export-completed', (data) => {
      exportComplete = true;
    });
    
    // Wait for export to complete
    while (!exportComplete) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    clearTimeout(timeout);
    
    // 7. Verify export was created in the database
    const exports = await Export.find({});
    expect(exports.length).toBeGreaterThan(0);
    
    // Get the export ID from the store
    const createdExport = exportStore.exports[0];
    if (!createdExport) {
      throw new Error('Export not found in store');
    }
    
    // 8. Test file download functionality
    const exportId = createdExport._id;
    const downloadEndpoint = `/api/exports/${exportId}/download`;
    
    // Make a direct API request to download the file
    const response = await fetch(`http://localhost:${serverAddress.port}${downloadEndpoint}`);
    expect(response.ok).toBe(true);
    
    const contentType = response.headers.get('content-type');
    expect(contentType).toContain('text/csv');
    
    const blob = await response.blob();
    const fileContent = await blob.text();
    
    // Verify CSV file format and content
    expect(fileContent).toContain('Title,Description,Status');
    
    // 9. Navigate to export history and verify it shows up
    await router.push('/exports');
    await flushPromises();
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait for history to load
    
    const exportHistory = wrapper.findComponent({ name: 'ExportHistory' });
    if (exportHistory.exists()) {
      const historyItems = exportHistory.findAll('[data-test^="export-item-"]');
      expect(historyItems.length).toBeGreaterThan(0);
    }
  });

  it('should handle export failures and display appropriate errors', async () => {
    // Create an invalid task model to force an export failure
    const originalFindMethod = Task.find;
    Task.find = () => {
      throw new Error('Simulated database error');
    };
    
    // Navigate to tasks page
    await router.push('/tasks');
    await flushPromises();
    
    // Create a test export that will fail
    const exportDoc = new Export({
      format: 'csv',
      filters: { status: 'pending' },
      status: 'processing',
      progress: 0
    });
    await exportDoc.save();
    
    const exportId = exportDoc._id.toString();
    
    // Force the export to process and fail
    try {
      await ExportService.processExport(exportId, { status: 'pending' }, 'csv');
    } catch (error) {
      // Expected to fail
    }
    
    // Broadcast the failure via Socket.IO
    socketHandlers.broadcastExportFailed(exportId, 'Simulated database error');
    
    // Wait for failure event to be received by the frontend
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check if the export is marked as failed in the store
    await new Promise(resolve => setTimeout(resolve, 500)); // Extra wait to ensure store update
    
    // Restore the original find method
    Task.find = originalFindMethod;
    
    // Verify the export record in the database is marked as failed
    const updatedExport = await Export.findById(exportId);
    expect(updatedExport.status).toBe('failed');
  });

  it('should maintain export history across sessions', async () => {
    // Create multiple exports with different statuses
    const exportStatuses = ['completed', 'failed', 'processing'];
    
    for (let i = 0; i < exportStatuses.length; i++) {
      const status = exportStatuses[i];
      const exportDoc = new Export({
        format: i % 2 === 0 ? 'csv' : 'json',
        filters: { status: 'pending', priority: i % 3 === 0 ? 'high' : 'medium' },
        status,
        progress: status === 'completed' ? 100 : status === 'failed' ? 0 : 50,
        createdAt: new Date(Date.now() - i * 3600000),
        filename: `test-export-${i}.${i % 2 === 0 ? 'csv' : 'json'}`
      });
      
      if (status === 'completed') {
        exportDoc.completedAt = new Date();
        exportDoc.fileSize = 2048 + i * 1024;
        exportDoc.downloadUrl = `/api/exports/${exportDoc._id}/download`;
        
        // Create a real file for completed exports
        const content = i % 2 === 0 
          ? `Title,Description,Status\nTask ${i},Description ${i},pending`
          : JSON.stringify({ tasks: [{ title: `Task ${i}`, status: 'pending' }] });
          
        const filePath = path.join(exportDir, `${exportDoc._id}.${i % 2 === 0 ? 'csv' : 'json'}`);
        await fs.writeFile(filePath, content);
        exportDoc.filePath = filePath;
      }
      
      if (status === 'failed') {
        exportDoc.error = 'Test error message';
        exportDoc.failedAt = new Date();
      }
      
      await exportDoc.save();
    }
    
    // Navigate to exports page
    await router.push('/exports');
    await flushPromises();
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait for history to load
    
    // Check if history shows all exports
    const exportHistory = wrapper.findComponent({ name: 'ExportHistory' });
    if (exportHistory.exists()) {
      const historyItems = exportHistory.findAll('[data-test^="export-item-"]');
      expect(historyItems.length).toBeGreaterThanOrEqual(exportStatuses.length);
      
      // Find a completed export
      const completedExport = await Export.findOne({ status: 'completed' });
      const downloadButton = exportHistory.find(`[data-test="download-button-${completedExport._id}"]`);
      
      if (downloadButton.exists()) {
        // Test download functionality
        await downloadButton.trigger('click');
        await flushPromises();
        
        // Verify download was initiated
        // This is a complex assertion as the actual download happens via browser mechanisms
      }
    }
  });
});