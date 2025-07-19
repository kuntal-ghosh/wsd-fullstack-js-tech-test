/**
 * @fileoverview Integration tests for Socket.IO export event broadcasting
 * @module tests/sockets/exportEvents.integration.test
 */

import { test, describe, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { createServer } from 'http';
import { Server } from 'socket.io';
import SocketHandlers from '../../src/sockets/socketHandlers.js';
import { setupTestEnvironment, teardownTestEnvironment, cleanTestEnvironment } from '../utils/testSetup.js';

describe('Socket.IO Export Events Integration Tests', () => {
  let server;
  let io;
  let socketHandlers;
  let mockSocket;
  let emittedEvents;

  before(async () => {
    await setupTestEnvironment();
    
    // Create HTTP server
    server = createServer();
    
    // Create Socket.IO server
    io = new Server(server, {
      cors: { origin: '*', methods: ['GET', 'POST'] }
    });
    
    // Initialize socket handlers
    socketHandlers = new SocketHandlers(io);
  });

  after(async () => {
    await new Promise(resolve => server.close(resolve));
    await teardownTestEnvironment();
  });

  beforeEach(async () => {
    await cleanTestEnvironment();
    
    emittedEvents = [];
    
    // Create mock client socket
    mockSocket = {
      id: 'integration-test-socket',
      rooms: new Set(),
      join: mock.fn((room) => {
        mockSocket.rooms.add(room);
        return Promise.resolve();
      }),
      leave: mock.fn((room) => {
        mockSocket.rooms.delete(room);
        return Promise.resolve();
      }),
      emit: mock.fn((event, data) => {
        emittedEvents.push({ target: 'socket', event, data, socketId: mockSocket.id });
      }),
      on: mock.fn(),
      disconnect: mock.fn(),
      connected: true
    };
    
    // Mock the io.to() method to simulate room broadcasting
    io.to = mock.fn((room) => {
      return {
        emit: mock.fn((event, data) => {
          // Simulate broadcasting to clients in the room
          if (mockSocket.rooms.has(room)) {
            emittedEvents.push({ 
              target: 'room', 
              room, 
              event, 
              data, 
              recipients: [mockSocket.id] 
            });
          }
        })
      };
    });
    
    // Mock the general io.emit() method
    io.emit = mock.fn((event, data) => {
      emittedEvents.push({ target: 'broadcast', event, data });
    });
  });

  describe('Export Room Connection and Events', () => {
    test('should broadcast export progress to exports room', async () => {
      // Simulate client joining exports room
      await mockSocket.join('exports');
      
      // Broadcast export progress
      const exportId = 'integration-test-export';
      socketHandlers.broadcastExportProgress(exportId, 50, 'processing');
      
      // Verify event was broadcast to exports room
      const exportEvent = emittedEvents.find(event => 
        event.target === 'room' && 
        event.room === 'exports' && 
        event.event === 'export-progress'
      );
      
      assert(exportEvent, 'Should broadcast export-progress to exports room');
      assert.strictEqual(exportEvent.data.exportId, exportId);
      assert.strictEqual(exportEvent.data.progress, 50);
      assert.strictEqual(exportEvent.data.status, 'processing');
      assert(exportEvent.recipients.includes(mockSocket.id));
    });

    test('should broadcast export status changes to exports room', async () => {
      // Simulate client joining exports room
      await mockSocket.join('exports');
      
      // Broadcast status change
      const exportId = 'status-change-test';
      const metadata = { phase: 'file-generation' };
      socketHandlers.broadcastExportStatusChange(exportId, 'processing', metadata);
      
      // Verify event was broadcast
      const statusEvent = emittedEvents.find(event => 
        event.target === 'room' && 
        event.room === 'exports' && 
        event.event === 'export-status-change'
      );
      
      assert(statusEvent, 'Should broadcast export-status-change to exports room');
      assert.strictEqual(statusEvent.data.exportId, exportId);
      assert.strictEqual(statusEvent.data.status, 'processing');
      assert.deepStrictEqual(statusEvent.data.metadata, metadata);
    });

    test('should broadcast export completion with notifications', async () => {
      // Simulate client joining exports room
      await mockSocket.join('exports');
      
      // Broadcast completion
      const exportId = 'completion-test';
      const exportData = {
        format: 'csv',
        totalRecords: 100,
        fileSize: 2048,
        downloadUrl: `/api/exports/${exportId}/download`
      };
      
      socketHandlers.broadcastExportCompleted(exportId, exportData);
      
      // Verify completion event was broadcast to exports room
      const completionEvent = emittedEvents.find(event => 
        event.target === 'room' && 
        event.room === 'exports' && 
        event.event === 'export-completed'
      );
      
      assert(completionEvent, 'Should broadcast export-completed to exports room');
      assert.strictEqual(completionEvent.data.exportId, exportId);
      assert.strictEqual(completionEvent.data.status, 'completed');
      assert.deepStrictEqual(completionEvent.data.exportData, exportData);
      
      // Verify notification was broadcast globally
      const notificationEvent = emittedEvents.find(event => 
        event.target === 'broadcast' && 
        event.event === 'notification'
      );
      
      assert(notificationEvent, 'Should broadcast notification globally');
      assert.strictEqual(notificationEvent.data.type, 'success');
      assert(notificationEvent.data.message.includes('Export completed successfully'));
    });

    test('should broadcast export failure with error notifications', async () => {
      // Simulate client joining exports room
      await mockSocket.join('exports');
      
      // Broadcast failure
      const exportId = 'failure-test';
      const error = 'Database connection failed';
      const metadata = { retryCount: 2 };
      
      socketHandlers.broadcastExportFailed(exportId, error, metadata);
      
      // Verify failure event was broadcast to exports room
      const failureEvent = emittedEvents.find(event => 
        event.target === 'room' && 
        event.room === 'exports' && 
        event.event === 'export-failed'
      );
      
      assert(failureEvent, 'Should broadcast export-failed to exports room');
      assert.strictEqual(failureEvent.data.exportId, exportId);
      assert.strictEqual(failureEvent.data.status, 'failed');
      assert.strictEqual(failureEvent.data.error, error);
      assert.deepStrictEqual(failureEvent.data.metadata, metadata);
      
      // Verify error notification was broadcast globally
      const notificationEvent = emittedEvents.find(event => 
        event.target === 'broadcast' && 
        event.event === 'notification'
      );
      
      assert(notificationEvent, 'Should broadcast error notification globally');
      assert.strictEqual(notificationEvent.data.type, 'error');
      assert(notificationEvent.data.message.includes('Export failed'));
    });

    test('should broadcast export list updates to exports room', async () => {
      // Simulate client joining exports room
      await mockSocket.join('exports');
      
      // Broadcast list update
      const exportData = {
        _id: 'list-update-test',
        format: 'json',
        status: 'processing',
        progress: 25,
        filters: { status: 'pending' }
      };
      
      socketHandlers.broadcastExportListUpdate('created', exportData);
      
      // Verify list update event was broadcast
      const listUpdateEvent = emittedEvents.find(event => 
        event.target === 'room' && 
        event.room === 'exports' && 
        event.event === 'export-list-update'
      );
      
      assert(listUpdateEvent, 'Should broadcast export-list-update to exports room');
      assert.strictEqual(listUpdateEvent.data.action, 'created');
      assert.deepStrictEqual(listUpdateEvent.data.export, exportData);
    });
  });

  describe('Multiple Clients and Room Management', () => {
    test('should only broadcast to clients in exports room', async () => {
      // Create a second mock socket not in exports room
      const mockSocket2 = {
        id: 'socket-not-in-exports',
        rooms: new Set(),
        join: mock.fn((room) => mockSocket2.rooms.add(room))
      };
      
      // Only first socket joins exports room
      await mockSocket.join('exports');
      
      // Update io.to mock to check both sockets
      io.to = mock.fn((room) => {
        return {
          emit: mock.fn((event, data) => {
            const recipients = [];
            if (mockSocket.rooms.has(room)) recipients.push(mockSocket.id);
            if (mockSocket2.rooms.has(room)) recipients.push(mockSocket2.id);
            
            if (recipients.length > 0) {
              emittedEvents.push({ target: 'room', room, event, data, recipients });
            }
          })
        };
      });
      
      // Broadcast export progress
      socketHandlers.broadcastExportProgress('room-test', 60);
      
      // Verify only the socket in exports room receives the event
      const exportEvent = emittedEvents.find(event => 
        event.target === 'room' && 
        event.room === 'exports'
      );
      
      assert(exportEvent, 'Should broadcast to exports room');
      assert.strictEqual(exportEvent.recipients.length, 1);
      assert(exportEvent.recipients.includes(mockSocket.id));
      assert(!exportEvent.recipients.includes(mockSocket2.id));
    });

    test('should handle multiple clients in exports room', async () => {
      const mockSocket2 = {
        id: 'second-client',
        rooms: new Set(),
        join: mock.fn((room) => mockSocket2.rooms.add(room))
      };
      
      // Both sockets join exports room
      await mockSocket.join('exports');
      await mockSocket2.join('exports');
      
      // Update io.to mock for multiple clients
      io.to = mock.fn((room) => {
        return {
          emit: mock.fn((event, data) => {
            const recipients = [];
            if (mockSocket.rooms.has(room)) recipients.push(mockSocket.id);
            if (mockSocket2.rooms.has(room)) recipients.push(mockSocket2.id);
            
            if (recipients.length > 0) {
              emittedEvents.push({ target: 'room', room, event, data, recipients });
            }
          })
        };
      });
      
      // Broadcast export event
      socketHandlers.broadcastExportProgress('multi-client-test', 80);
      
      // Verify both clients receive the event
      const exportEvent = emittedEvents.find(event => 
        event.target === 'room' && 
        event.room === 'exports'
      );
      
      assert(exportEvent, 'Should broadcast to exports room');
      assert.strictEqual(exportEvent.recipients.length, 2);
      assert(exportEvent.recipients.includes(mockSocket.id));
      assert(exportEvent.recipients.includes(mockSocket2.id));
    });
  });

  describe('Integration with Existing Socket Features', () => {
    test('should not interfere with analytics room functionality', async () => {
      // Simulate client joining both rooms
      await mockSocket.join('analytics');
      await mockSocket.join('exports');
      
      // Broadcast analytics update
      await socketHandlers.broadcastAnalyticsUpdate();
      
      // Broadcast export progress
      socketHandlers.broadcastExportProgress('analytics-coexist-test', 30);
      
      // Should have events for both rooms
      const analyticsEvent = emittedEvents.find(event => 
        event.target === 'room' && event.room === 'analytics'
      );
      const exportEvent = emittedEvents.find(event => 
        event.target === 'room' && event.room === 'exports'
      );
      
      assert(analyticsEvent, 'Should broadcast analytics update');
      assert(exportEvent, 'Should broadcast export progress');
      assert.notStrictEqual(analyticsEvent.event, exportEvent.event);
    });

    test('should integrate with task update broadcasts', async () => {
      // Join exports room
      await mockSocket.join('exports');
      
      // Broadcast task update (this also triggers analytics update)
      const testTask = { _id: 'task-123', title: 'Test Task', status: 'completed' };
      socketHandlers.broadcastTaskUpdate('updated', testTask);
      
      // Broadcast export event
      socketHandlers.broadcastExportCompleted('integration-test', { format: 'csv', totalRecords: 1 });
      
      // Should have both task and export events
      const taskEvent = emittedEvents.find(event => event.event === 'task-update');
      const exportEvent = emittedEvents.find(event => event.event === 'export-completed');
      const notifications = emittedEvents.filter(event => event.event === 'notification');
      
      assert(taskEvent, 'Should broadcast task update');
      assert(exportEvent, 'Should broadcast export completion');
      assert(notifications.length >= 1, 'Should have notifications from export completion');
    });
  });

  describe('Real-time Export Lifecycle Simulation', () => {
    test('should handle complete export lifecycle', async () => {
      // Join exports room
      await mockSocket.join('exports');
      
      const exportId = 'lifecycle-test';
      const exportData = { _id: exportId, format: 'json', status: 'pending' };
      
      // Simulate complete export lifecycle
      
      // 1. Export created
      socketHandlers.broadcastExportListUpdate('created', exportData);
      
      // 2. Status change to processing
      socketHandlers.broadcastExportStatusChange(exportId, 'processing');
      
      // 3. Progress updates
      socketHandlers.broadcastExportProgress(exportId, 25);
      socketHandlers.broadcastExportProgress(exportId, 75);
      
      // 4. Export completion
      const completedData = { format: 'json', totalRecords: 500, fileSize: 4096 };
      socketHandlers.broadcastExportCompleted(exportId, completedData);
      
      // 5. List update for completion
      const updatedExportData = { ...exportData, status: 'completed', ...completedData };
      socketHandlers.broadcastExportListUpdate('updated', updatedExportData);
      
      // Verify all events were emitted
      const exportEvents = emittedEvents.filter(event => 
        event.target === 'room' && event.room === 'exports'
      );
      
      assert(exportEvents.length >= 6, 'Should have all lifecycle events');
      
      // Check for specific events
      const listCreate = exportEvents.find(e => e.event === 'export-list-update' && e.data.action === 'created');
      const statusChange = exportEvents.find(e => e.event === 'export-status-change');
      const progressEvents = exportEvents.filter(e => e.event === 'export-progress');
      const completion = exportEvents.find(e => e.event === 'export-completed');
      const listUpdate = exportEvents.find(e => e.event === 'export-list-update' && e.data.action === 'updated');
      
      assert(listCreate, 'Should have creation event');
      assert(statusChange, 'Should have status change event');
      assert(progressEvents.length >= 2, 'Should have progress events');
      assert(completion, 'Should have completion event');
      assert(listUpdate, 'Should have list update event');
      
      // Verify export ID consistency
      const eventsWithExportId = exportEvents.filter(e => e.data.exportId === exportId);
      assert(eventsWithExportId.length >= 4, 'Should have consistent export IDs');
    });

    test('should handle rapid progress updates', async () => {
      // Join exports room
      await mockSocket.join('exports');
      
      const exportId = 'rapid-progress-test';
      const progressValues = [0, 10, 25, 50, 75, 90, 100];
      
      // Simulate rapid progress updates
      for (const progress of progressValues) {
        socketHandlers.broadcastExportProgress(exportId, progress);
      }
      
      // Verify all progress events were emitted
      const progressEvents = emittedEvents.filter(event => 
        event.target === 'room' && 
        event.room === 'exports' && 
        event.event === 'export-progress'
      );
      
      assert.strictEqual(progressEvents.length, progressValues.length);
      
      // Verify progress values are correct
      progressEvents.forEach((event, index) => {
        assert.strictEqual(event.data.exportId, exportId);
        assert.strictEqual(event.data.progress, progressValues[index]);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle broadcasting with no clients in room', async () => {
      // Don't join any room, just broadcast
      socketHandlers.broadcastExportProgress('no-clients', 50);
      
      // Should still call io.to() but no events should be captured since no clients
      assert(io.to.mock.calls.length > 0, 'Should attempt to broadcast to room');
      
      // No events should be received since no clients in room
      const roomEvents = emittedEvents.filter(event => event.target === 'room');
      assert.strictEqual(roomEvents.length, 0, 'Should not emit to empty room');
    });

    test('should handle concurrent broadcasts correctly', async () => {
      // Join exports room
      await mockSocket.join('exports');
      
      // Simulate concurrent export operations
      const exports = [
        { id: 'concurrent-1', progress: 25 },
        { id: 'concurrent-2', progress: 50 },
        { id: 'concurrent-3', progress: 75 }
      ];
      
      // Broadcast all at once
      exports.forEach(exp => {
        socketHandlers.broadcastExportProgress(exp.id, exp.progress);
      });
      
      // Verify all events were emitted
      const progressEvents = emittedEvents.filter(event => 
        event.target === 'room' && 
        event.room === 'exports' && 
        event.event === 'export-progress'
      );
      
      assert.strictEqual(progressEvents.length, exports.length);
      
      // Verify each export has its own event
      exports.forEach(exp => {
        const event = progressEvents.find(e => e.data.exportId === exp.id);
        assert(event, `Should have event for export ${exp.id}`);
        assert.strictEqual(event.data.progress, exp.progress);
      });
    });

    test('should handle null or undefined data gracefully', async () => {
      // Join exports room
      await mockSocket.join('exports');
      
      // Test with minimal/edge case data
      socketHandlers.broadcastExportProgress('edge-case', 0);
      socketHandlers.broadcastExportCompleted('edge-case', {});
      socketHandlers.broadcastExportFailed('edge-case', '');
      
      // Should not throw errors and should emit events
      const exportEvents = emittedEvents.filter(event => 
        event.target === 'room' && event.room === 'exports'
      );
      
      assert.strictEqual(exportEvents.length, 3, 'Should handle edge case data');
      
      // Verify events have proper structure
      exportEvents.forEach(event => {
        assert(event.data.exportId, 'Should have export ID');
        assert(typeof event.data.timestamp === 'string', 'Should have timestamp');
      });
    });
  });
});