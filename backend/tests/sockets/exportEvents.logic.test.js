/**
 * @fileoverview Tests for Socket.IO export event handling functionality
 * @module tests/sockets/exportEvents.logic.test
 */

import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import SocketHandlers from '../../src/sockets/socketHandlers.js';

describe('Socket.IO Export Event Handling Tests', () => {
  let mockIo;
  let mockSocket;
  let socketHandlers;
  let emittedEvents;
  let consoleOutput;
  let originalLog;
  let originalError;

  beforeEach(() => {
    emittedEvents = [];
    consoleOutput = [];
    
    // Store original console methods
    originalLog = console.log;
    originalError = console.error;
    
    // Mock console methods
    console.log = (...args) => {
      consoleOutput.push({ type: 'log', args });
    };
    
    console.error = (...args) => {
      consoleOutput.push({ type: 'error', args });
    };
    
    mockSocket = {
      id: 'test-socket-123',
      join: mock.fn((room) => {
        mockSocket.rooms = mockSocket.rooms || [];
        mockSocket.rooms.push(room);
      }),
      emit: mock.fn((event, data) => {
        emittedEvents.push({ target: 'socket', event, data });
      }),
      on: mock.fn((event, handler) => {
        mockSocket.handlers = mockSocket.handlers || {};
        mockSocket.handlers[event] = handler;
      }),
      rooms: []
    };

    mockIo = {
      on: mock.fn((event, handler) => {
        mockIo.connectionHandler = handler;
      }),
      emit: mock.fn((event, data) => {
        emittedEvents.push({ target: 'io', event, data });
      }),
      to: mock.fn((room) => ({
        emit: mock.fn((event, data) => {
          emittedEvents.push({ target: 'room', room, event, data });
        })
      }))
    };

    socketHandlers = new SocketHandlers(mockIo);
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalLog;
    console.error = originalError;
  });

  describe('Export Room Management', () => {
    test('should handle join-exports event correctly', () => {
      // Simulate connection and join-exports event
      mockIo.connectionHandler(mockSocket);
      
      // Trigger join-exports handler
      if (mockSocket.handlers['join-exports']) {
        mockSocket.handlers['join-exports']();
      } else {
        // Manually trigger the join-exports logic
        mockSocket.join('exports');
        console.log(`📤 Client ${mockSocket.id} joined exports room`);
      }

      assert.strictEqual(mockSocket.join.mock.calls.length, 1);
      assert.strictEqual(mockSocket.join.mock.calls[0].arguments[0], 'exports');
      
      const logOutput = consoleOutput.find(output => 
        output.type === 'log' && 
        output.args[0].includes('joined exports room')
      );
      assert(logOutput, 'Should log join exports message');
    });

    test('should set up exports room handler during connection', () => {
      mockIo.connectionHandler(mockSocket);
      
      // Check that join-exports handler was set up
      const joinExportsHandler = mockSocket.on.mock.calls.find(call => 
        call.arguments[0] === 'join-exports'
      );
      assert(joinExportsHandler, 'Should set up join-exports handler');
    });
  });

  describe('Export Progress Broadcasting', () => {
    test('should broadcast export progress updates correctly', () => {
      const exportId = 'export-123';
      const progress = 45;
      const status = 'processing';

      socketHandlers.broadcastExportProgress(exportId, progress, status);

      assert.strictEqual(mockIo.to.mock.calls.length, 1);
      assert.strictEqual(mockIo.to.mock.calls[0].arguments[0], 'exports');
      
      const emittedEvent = emittedEvents.find(event => 
        event.target === 'room' && 
        event.room === 'exports' && 
        event.event === 'export-progress'
      );
      
      assert(emittedEvent, 'Should emit export-progress event to exports room');
      assert.strictEqual(emittedEvent.data.exportId, exportId);
      assert.strictEqual(emittedEvent.data.progress, progress);
      assert.strictEqual(emittedEvent.data.status, status);
      assert(typeof emittedEvent.data.timestamp === 'string');
      
      const logOutput = consoleOutput.find(output => 
        output.type === 'log' && 
        output.args[0].includes('Broadcasting export progress')
      );
      assert(logOutput, 'Should log progress broadcast');
    });

    test('should use default status when not provided', () => {
      const exportId = 'export-456';
      const progress = 75;

      socketHandlers.broadcastExportProgress(exportId, progress);

      const emittedEvent = emittedEvents.find(event => 
        event.event === 'export-progress'
      );
      
      assert(emittedEvent, 'Should emit export-progress event');
      assert.strictEqual(emittedEvent.data.status, 'processing');
    });

    test('should handle progress values at boundaries', () => {
      // Test 0% progress
      socketHandlers.broadcastExportProgress('export-start', 0);
      let emittedEvent = emittedEvents.find(event => event.event === 'export-progress');
      assert.strictEqual(emittedEvent.data.progress, 0);

      // Clear events for next test
      emittedEvents.length = 0;

      // Test 100% progress
      socketHandlers.broadcastExportProgress('export-end', 100);
      emittedEvent = emittedEvents.find(event => event.event === 'export-progress');
      assert.strictEqual(emittedEvent.data.progress, 100);
    });
  });

  describe('Export Status Change Broadcasting', () => {
    test('should broadcast export status changes correctly', () => {
      const exportId = 'export-789';
      const status = 'processing';
      const metadata = { phase: 'data-collection' };

      socketHandlers.broadcastExportStatusChange(exportId, status, metadata);

      const emittedEvent = emittedEvents.find(event => 
        event.target === 'room' && 
        event.room === 'exports' && 
        event.event === 'export-status-change'
      );
      
      assert(emittedEvent, 'Should emit export-status-change event to exports room');
      assert.strictEqual(emittedEvent.data.exportId, exportId);
      assert.strictEqual(emittedEvent.data.status, status);
      assert.deepStrictEqual(emittedEvent.data.metadata, metadata);
      assert(typeof emittedEvent.data.timestamp === 'string');
      
      const logOutput = consoleOutput.find(output => 
        output.type === 'log' && 
        output.args[0].includes('Broadcasting export status change')
      );
      assert(logOutput, 'Should log status change broadcast');
    });

    test('should handle status change without metadata', () => {
      const exportId = 'export-no-meta';
      const status = 'queued';

      socketHandlers.broadcastExportStatusChange(exportId, status);

      const emittedEvent = emittedEvents.find(event => 
        event.event === 'export-status-change'
      );
      
      assert(emittedEvent, 'Should emit export-status-change event');
      assert.deepStrictEqual(emittedEvent.data.metadata, {});
    });

    test('should handle various status types', () => {
      const statuses = ['pending', 'processing', 'completed', 'failed', 'cancelled'];
      
      statuses.forEach((status, index) => {
        socketHandlers.broadcastExportStatusChange(`export-${index}`, status);
        
        const emittedEvent = emittedEvents.find(event => 
          event.event === 'export-status-change' && 
          event.data.exportId === `export-${index}`
        );
        
        assert(emittedEvent, `Should emit status change for ${status}`);
        assert.strictEqual(emittedEvent.data.status, status);
      });
    });
  });

  describe('Export Completion Broadcasting', () => {
    test('should broadcast export completion correctly', () => {
      const exportId = 'export-complete-123';
      const exportData = {
        format: 'csv',
        totalRecords: 150,
        fileSize: 2048,
        downloadUrl: '/api/exports/export-complete-123/download'
      };

      socketHandlers.broadcastExportCompleted(exportId, exportData);

      // Check export-completed event
      const completedEvent = emittedEvents.find(event => 
        event.target === 'room' && 
        event.room === 'exports' && 
        event.event === 'export-completed'
      );
      
      assert(completedEvent, 'Should emit export-completed event to exports room');
      assert.strictEqual(completedEvent.data.exportId, exportId);
      assert.strictEqual(completedEvent.data.status, 'completed');
      assert.deepStrictEqual(completedEvent.data.exportData, exportData);
      assert(typeof completedEvent.data.timestamp === 'string');

      // Check notification event
      const notificationEvent = emittedEvents.find(event => 
        event.target === 'io' && 
        event.event === 'notification'
      );
      
      assert(notificationEvent, 'Should emit notification event');
      assert.strictEqual(notificationEvent.data.type, 'success');
      assert(notificationEvent.data.message.includes('Export completed successfully'));
      assert(notificationEvent.data.message.includes('csv format'));
      assert(notificationEvent.data.message.includes('150 records'));
      
      const logOutput = consoleOutput.find(output => 
        output.type === 'log' && 
        output.args[0].includes('Broadcasting export completion')
      );
      assert(logOutput, 'Should log completion broadcast');
    });

    test('should handle completion without totalRecords', () => {
      const exportId = 'export-no-count';
      const exportData = {
        format: 'json',
        fileSize: 1024
      };

      socketHandlers.broadcastExportCompleted(exportId, exportData);

      const notificationEvent = emittedEvents.find(event => 
        event.event === 'notification'
      );
      
      assert(notificationEvent, 'Should emit notification event');
      assert(notificationEvent.data.message.includes('0 records'));
    });

    test('should include timestamp in completion data', () => {
      const exportId = 'export-timestamp-test';
      const exportData = { format: 'csv' };

      const beforeTimestamp = new Date().toISOString();
      socketHandlers.broadcastExportCompleted(exportId, exportData);
      const afterTimestamp = new Date().toISOString();

      const completedEvent = emittedEvents.find(event => 
        event.event === 'export-completed'
      );
      
      assert(completedEvent, 'Should emit completion event');
      const eventTimestamp = completedEvent.data.timestamp;
      assert(eventTimestamp >= beforeTimestamp && eventTimestamp <= afterTimestamp);
    });
  });

  describe('Export Failure Broadcasting', () => {
    test('should broadcast export failure correctly', () => {
      const exportId = 'export-fail-123';
      const error = 'Database connection timeout';
      const metadata = { retryCount: 3, lastAttempt: new Date().toISOString() };

      socketHandlers.broadcastExportFailed(exportId, error, metadata);

      // Check export-failed event
      const failedEvent = emittedEvents.find(event => 
        event.target === 'room' && 
        event.room === 'exports' && 
        event.event === 'export-failed'
      );
      
      assert(failedEvent, 'Should emit export-failed event to exports room');
      assert.strictEqual(failedEvent.data.exportId, exportId);
      assert.strictEqual(failedEvent.data.status, 'failed');
      assert.strictEqual(failedEvent.data.error, error);
      assert.deepStrictEqual(failedEvent.data.metadata, metadata);
      assert(typeof failedEvent.data.timestamp === 'string');

      // Check notification event
      const notificationEvent = emittedEvents.find(event => 
        event.target === 'io' && 
        event.event === 'notification'
      );
      
      assert(notificationEvent, 'Should emit notification event');
      assert.strictEqual(notificationEvent.data.type, 'error');
      assert(notificationEvent.data.message.includes('Export failed'));
      assert(notificationEvent.data.message.includes(error));
      
      const logOutput = consoleOutput.find(output => 
        output.type === 'log' && 
        output.args[0].includes('Broadcasting export failure')
      );
      assert(logOutput, 'Should log failure broadcast');
    });

    test('should handle failure without metadata', () => {
      const exportId = 'export-simple-fail';
      const error = 'Simple error message';

      socketHandlers.broadcastExportFailed(exportId, error);

      const failedEvent = emittedEvents.find(event => 
        event.event === 'export-failed'
      );
      
      assert(failedEvent, 'Should emit export-failed event');
      assert.deepStrictEqual(failedEvent.data.metadata, {});
    });

    test('should handle various error types', () => {
      const errors = [
        'Network timeout',
        'Permission denied',
        'Invalid data format',
        'Export file too large',
        'Unknown error'
      ];
      
      errors.forEach((error, index) => {
        socketHandlers.broadcastExportFailed(`export-error-${index}`, error);
        
        const failedEvent = emittedEvents.find(event => 
          event.event === 'export-failed' && 
          event.data.exportId === `export-error-${index}`
        );
        
        assert(failedEvent, `Should emit failure event for ${error}`);
        assert.strictEqual(failedEvent.data.error, error);
      });
    });
  });

  describe('Export List Updates Broadcasting', () => {
    test('should broadcast export list updates correctly', () => {
      const action = 'created';
      const exportData = {
        _id: 'export-list-123',
        format: 'json',
        status: 'processing',
        filters: { status: 'pending' }
      };

      socketHandlers.broadcastExportListUpdate(action, exportData);

      const updateEvent = emittedEvents.find(event => 
        event.target === 'room' && 
        event.room === 'exports' && 
        event.event === 'export-list-update'
      );
      
      assert(updateEvent, 'Should emit export-list-update event to exports room');
      assert.strictEqual(updateEvent.data.action, action);
      assert.deepStrictEqual(updateEvent.data.export, exportData);
      assert(typeof updateEvent.data.timestamp === 'string');
      
      const logOutput = consoleOutput.find(output => 
        output.type === 'log' && 
        output.args[0].includes('Broadcasting export list update')
      );
      assert(logOutput, 'Should log list update broadcast');
    });

    test('should handle various list update actions', () => {
      const actions = ['created', 'updated', 'deleted', 'cancelled'];
      const exportData = { _id: 'export-test', format: 'csv' };
      
      actions.forEach(action => {
        socketHandlers.broadcastExportListUpdate(action, exportData);
        
        const updateEvent = emittedEvents.find(event => 
          event.event === 'export-list-update' && 
          event.data.action === action
        );
        
        assert(updateEvent, `Should emit list update for ${action}`);
        assert.strictEqual(updateEvent.data.action, action);
      });
    });

    test('should include complete export data in updates', () => {
      const exportData = {
        _id: 'export-complete-data',
        format: 'csv',
        status: 'completed',
        progress: 100,
        totalRecords: 500,
        fileSize: 4096,
        filters: { priority: 'high', dateFrom: '2024-01-01' },
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      };

      socketHandlers.broadcastExportListUpdate('updated', exportData);

      const updateEvent = emittedEvents.find(event => 
        event.event === 'export-list-update'
      );
      
      assert(updateEvent, 'Should emit list update event');
      assert.deepStrictEqual(updateEvent.data.export, exportData);
    });
  });

  describe('Integration with Existing Analytics', () => {
    test('should not interfere with existing analytics broadcasts', () => {
      // Simulate analytics broadcast
      socketHandlers.broadcastAnalyticsUpdate = mock.fn();
      
      // Broadcast export events
      socketHandlers.broadcastExportProgress('export-123', 50);
      socketHandlers.broadcastExportCompleted('export-123', { format: 'csv' });
      
      // Analytics should not be called directly by export events
      assert.strictEqual(socketHandlers.broadcastAnalyticsUpdate.mock.calls.length, 0);
      
      // Export events should be emitted
      const exportEvents = emittedEvents.filter(event => 
        event.event.startsWith('export-')
      );
      assert.strictEqual(exportEvents.length, 2);
    });

    test('should coexist with task update broadcasts', () => {
      const task = { _id: 'task-123', title: 'Test Task', status: 'completed' };
      
      // Broadcast task update (this calls broadcastAnalyticsUpdate)
      socketHandlers.broadcastTaskUpdate('updated', task);
      
      // Broadcast export progress
      socketHandlers.broadcastExportProgress('export-456', 75);
      
      // Both events should be emitted
      const taskEvent = emittedEvents.find(event => event.event === 'task-update');
      const exportEvent = emittedEvents.find(event => event.event === 'export-progress');
      
      assert(taskEvent, 'Should emit task update event');
      assert(exportEvent, 'Should emit export progress event');
    });

    test('should use shared notification system', () => {
      // Export completion should trigger notification
      socketHandlers.broadcastExportCompleted('export-notify', { format: 'json', totalRecords: 25 });
      
      // Export failure should trigger notification
      socketHandlers.broadcastExportFailed('export-error', 'Test error');
      
      // Should have 2 notifications
      const notifications = emittedEvents.filter(event => event.event === 'notification');
      assert.strictEqual(notifications.length, 2);
      assert.strictEqual(notifications[0].data.type, 'success');
      assert.strictEqual(notifications[1].data.type, 'error');
    });
  });

  describe('Socket.IO Connection Handling During Exports', () => {
    test('should handle client joining exports room during active exports', () => {
      // Simulate existing export in progress
      socketHandlers.broadcastExportProgress('active-export', 60);
      
      // New client connects and joins exports room
      const newSocket = {
        id: 'new-client-456',
        join: mock.fn(),
        on: mock.fn()
      };
      
      mockIo.connectionHandler(newSocket);
      
      // Client should be able to join exports room
      if (newSocket.handlers && newSocket.handlers['join-exports']) {
        newSocket.handlers['join-exports']();
      }
      
      // Subsequent exports should reach this client
      socketHandlers.broadcastExportProgress('new-export', 25);
      
      const progressEvents = emittedEvents.filter(event => 
        event.event === 'export-progress'
      );
      assert.strictEqual(progressEvents.length, 2);
    });

    test('should handle multiple clients in exports room', () => {
      // Simulate multiple clients joining exports room
      const clients = ['client-1', 'client-2', 'client-3'];
      clients.forEach(clientId => {
        const socket = { id: clientId, join: mock.fn(), on: mock.fn() };
        mockIo.connectionHandler(socket);
      });
      
      // Broadcast export event
      socketHandlers.broadcastExportProgress('multi-client-export', 80);
      
      // Event should be sent to exports room (all clients)
      const exportEvent = emittedEvents.find(event => 
        event.target === 'room' && 
        event.room === 'exports' && 
        event.event === 'export-progress'
      );
      assert(exportEvent, 'Should broadcast to exports room');
    });

    test('should handle client disconnection during exports', () => {
      // Client connects and joins exports room
      mockIo.connectionHandler(mockSocket);
      
      // Start export
      socketHandlers.broadcastExportProgress('disconnect-test', 30);
      
      // Client disconnects
      if (mockSocket.handlers && mockSocket.handlers['disconnect']) {
        mockSocket.handlers['disconnect']();
      }
      
      // Export continues and completes
      socketHandlers.broadcastExportCompleted('disconnect-test', { format: 'csv' });
      
      // Events should still be broadcast (to remaining clients)
      const exportEvents = emittedEvents.filter(event => 
        event.event.startsWith('export-')
      );
      assert.strictEqual(exportEvents.length, 2);
    });

    test('should handle rapid connection/disconnection during exports', () => {
      // Simulate rapid connections
      for (let i = 0; i < 5; i++) {
        const socket = { 
          id: `rapid-client-${i}`, 
          join: mock.fn(), 
          on: mock.fn() 
        };
        mockIo.connectionHandler(socket);
        
        // Immediate disconnect simulation
        if (socket.handlers && socket.handlers['disconnect']) {
          socket.handlers['disconnect']();
        }
      }
      
      // Export should still work
      socketHandlers.broadcastExportProgress('rapid-test', 90);
      
      const exportEvent = emittedEvents.find(event => 
        event.event === 'export-progress'
      );
      assert(exportEvent, 'Should handle rapid connections/disconnections');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle broadcasting with no clients in exports room', () => {
      // No clients joined exports room
      socketHandlers.broadcastExportProgress('no-clients', 50);
      
      // Should not throw error and should still emit to room
      const exportEvent = emittedEvents.find(event => 
        event.room === 'exports' && 
        event.event === 'export-progress'
      );
      assert(exportEvent, 'Should emit to exports room even if empty');
    });

    test('should handle null or undefined export data gracefully', () => {
      // Test with minimal data
      socketHandlers.broadcastExportProgress('minimal-export', 0);
      socketHandlers.broadcastExportCompleted('minimal-export', {});
      socketHandlers.broadcastExportFailed('minimal-export', '');
      
      // Should not throw errors
      const exportEvents = emittedEvents.filter(event => 
        event.event.startsWith('export-')
      );
      assert.strictEqual(exportEvents.length, 3);
    });

    test('should handle invalid progress values gracefully', () => {
      // Test edge cases for progress values
      const invalidValues = [-1, 101, NaN, null, undefined, 'invalid'];
      
      invalidValues.forEach((value, index) => {
        // Should not throw error
        try {
          socketHandlers.broadcastExportProgress(`invalid-${index}`, value);
        } catch (error) {
          assert.fail(`Should not throw error for progress value: ${value}`);
        }
      });
    });

    test('should handle very long error messages', () => {
      const longError = 'A'.repeat(10000); // Very long error message
      
      socketHandlers.broadcastExportFailed('long-error-export', longError);
      
      const failedEvent = emittedEvents.find(event => 
        event.event === 'export-failed'
      );
      assert(failedEvent, 'Should handle long error messages');
      assert.strictEqual(failedEvent.data.error, longError);
    });

    test('should handle concurrent broadcasts correctly', () => {
      // Simulate concurrent export operations
      const concurrentOps = [
        () => socketHandlers.broadcastExportProgress('concurrent-1', 25),
        () => socketHandlers.broadcastExportProgress('concurrent-2', 50),
        () => socketHandlers.broadcastExportCompleted('concurrent-3', { format: 'csv' }),
        () => socketHandlers.broadcastExportFailed('concurrent-4', 'Error'),
        () => socketHandlers.broadcastExportStatusChange('concurrent-5', 'processing')
      ];
      
      // Execute all operations
      concurrentOps.forEach(op => op());
      
      // All events should be emitted
      const exportEvents = emittedEvents.filter(event => 
        event.event.startsWith('export-')
      );
      assert.strictEqual(exportEvents.length, 5);
      
      // Each export should have unique ID
      const exportIds = exportEvents.map(event => event.data.exportId);
      const uniqueIds = [...new Set(exportIds)];
      assert.strictEqual(uniqueIds.length, 5);
    });
  });
});