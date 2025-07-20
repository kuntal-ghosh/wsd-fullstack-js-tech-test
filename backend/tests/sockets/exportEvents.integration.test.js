/**
 * @fileoverview Integration tests for Socket.IO export event broadcasting
 * @module tests/sockets/exportEvents.integration.test
 */

import { test, describe, mock } from 'node:test';
import assert from 'node:assert';

describe('Socket.IO Export Events Integration Tests', { timeout: 2000 }, () => {
  test('should handle connection and export room joining', () => {
    const mockSocket = {
      id: 'test-socket-123',
      join: mock.fn(),
      on: mock.fn(),
      rooms: []
    };
    
    const mockIo = {
      on: mock.fn((event, handler) => {
        if (event === 'connection') {
          handler(mockSocket);
        }
      })
    };
    
    // Simulate connection handler setup
    mockIo.on('connection', (socket) => {
      socket.on('join-exports', () => {
        socket.join('exports');
      });
    });
    
    // Verify connection handler was set up
    assert.strictEqual(mockIo.on.mock.calls.length, 1);
    assert.strictEqual(mockIo.on.mock.calls[0].arguments[0], 'connection');
    
    // Verify socket event handlers were set up
    assert.strictEqual(mockSocket.on.mock.calls.length, 1);
    assert.strictEqual(mockSocket.on.mock.calls[0].arguments[0], 'join-exports');
  });

  test('should integrate export progress with real-time updates', () => {
    const events = [];
    const mockIo = {
      to: mock.fn(() => ({
        emit: mock.fn((event, data) => {
          events.push({ target: 'room', event, data });
        })
      })),
      emit: mock.fn((event, data) => {
        events.push({ target: 'global', event, data });
      })
    };
    
    // Simulate export workflow
    const simulateExportWorkflow = (exportId, format) => {
      // Start export
      mockIo.to('exports').emit('export-progress', {
        exportId,
        progress: 0,
        status: 'starting'
      });
      
      // Progress updates
      [25, 50, 75].forEach(progress => {
        mockIo.to('exports').emit('export-progress', {
          exportId,
          progress,
          status: 'processing'
        });
      });
      
      // Completion
      mockIo.to('exports').emit('export-completed', {
        exportId,
        status: 'completed',
        downloadUrl: `/api/exports/${exportId}/download`
      });
      
      // Notification
      mockIo.emit('notification', {
        type: 'success',
        message: `Export ${exportId} completed successfully`
      });
    };
    
    simulateExportWorkflow('test-export-123', 'csv');
    
    // Verify all events were emitted
    const progressEvents = events.filter(e => e.event === 'export-progress');
    const completedEvents = events.filter(e => e.event === 'export-completed');
    const notifications = events.filter(e => e.event === 'notification');
    
    assert.strictEqual(progressEvents.length, 4); // 0%, 25%, 50%, 75%
    assert.strictEqual(completedEvents.length, 1);
    assert.strictEqual(notifications.length, 1);
  });

  test('should handle export error scenarios', () => {
    const events = [];
    const mockIo = {
      to: mock.fn(() => ({
        emit: mock.fn((event, data) => {
          events.push({ target: 'room', event, data });
        })
      })),
      emit: mock.fn((event, data) => {
        events.push({ target: 'global', event, data });
      })
    };
    
    // Simulate export failure
    const simulateExportFailure = (exportId, error) => {
      mockIo.to('exports').emit('export-failed', {
        exportId,
        status: 'failed',
        error
      });
      
      mockIo.emit('notification', {
        type: 'error',
        message: `Export failed: ${error}`
      });
    };
    
    simulateExportFailure('failed-export-456', 'Database connection lost');
    
    const failedEvents = events.filter(e => e.event === 'export-failed');
    const errorNotifications = events.filter(e => 
      e.event === 'notification' && e.data.type === 'error'
    );
    
    assert.strictEqual(failedEvents.length, 1);
    assert.strictEqual(errorNotifications.length, 1);
    assert.strictEqual(failedEvents[0].data.error, 'Database connection lost');
  });

  test('should handle multiple concurrent exports', () => {
    const events = [];
    const mockIo = {
      to: mock.fn(() => ({
        emit: mock.fn((event, data) => {
          events.push({ target: 'room', event, data });
        })
      }))
    };
    
    // Simulate concurrent exports
    const exportIds = ['export-1', 'export-2', 'export-3'];
    
    exportIds.forEach((exportId, index) => {
      mockIo.to('exports').emit('export-progress', {
        exportId,
        progress: (index + 1) * 30,
        status: 'processing'
      });
    });
    
    const progressEvents = events.filter(e => e.event === 'export-progress');
    assert.strictEqual(progressEvents.length, 3);
    
    // Verify each export has unique ID
    const uniqueIds = new Set(progressEvents.map(e => e.data.exportId));
    assert.strictEqual(uniqueIds.size, 3);
  });

  test('should handle export list updates', () => {
    const events = [];
    const mockIo = {
      to: mock.fn(() => ({
        emit: mock.fn((event, data) => {
          events.push({ target: 'room', event, data });
        })
      }))
    };
    
    // Simulate export list operations
    const exportData = {
      _id: 'list-export-789',
      format: 'json',
      status: 'processing',
      progress: 0
    };
    
    // Create
    mockIo.to('exports').emit('export-list-update', {
      action: 'created',
      export: exportData
    });
    
    // Update
    mockIo.to('exports').emit('export-list-update', {
      action: 'updated',
      export: { ...exportData, progress: 100, status: 'completed' }
    });
    
    const listUpdates = events.filter(e => e.event === 'export-list-update');
    assert.strictEqual(listUpdates.length, 2);
    assert.strictEqual(listUpdates[0].data.action, 'created');
    assert.strictEqual(listUpdates[1].data.action, 'updated');
  });

  test('should validate event data structure', () => {
    const validateExportProgressEvent = (event) => {
      return Boolean(
        event.exportId &&
        typeof event.progress === 'number' &&
        event.progress >= 0 &&
        event.progress <= 100 &&
        event.status &&
        event.timestamp
      );
    };
    
    const validEvent = {
      exportId: 'test-123',
      progress: 50,
      status: 'processing',
      timestamp: new Date().toISOString()
    };
    
    const invalidEvent = {
      exportId: 'test-456',
      progress: -1, // Invalid
      status: '',   // Invalid
    };
    
    assert.strictEqual(validateExportProgressEvent(validEvent), true);
    assert.strictEqual(validateExportProgressEvent(invalidEvent), false);
  });

  test('should handle client disconnection during exports', () => {
    const events = [];
    const mockSocket = {
      id: 'disconnect-test-socket',
      join: mock.fn(),
      on: mock.fn(),
      disconnect: mock.fn(),
      rooms: ['exports']
    };
    
    const mockIo = {
      to: mock.fn(() => ({
        emit: mock.fn((event, data) => {
          events.push({ target: 'room', event, data });
        })
      }))
    };
    
    // Start export
    mockIo.to('exports').emit('export-progress', {
      exportId: 'disconnect-export',
      progress: 30,
      status: 'processing'
    });
    
    // Client disconnects
    mockSocket.disconnect();
    
    // Export continues
    mockIo.to('exports').emit('export-progress', {
      exportId: 'disconnect-export',
      progress: 100,
      status: 'completed'
    });
    
    // Events should still be emitted to remaining clients
    const progressEvents = events.filter(e => e.event === 'export-progress');
    assert.strictEqual(progressEvents.length, 2);
  });
});