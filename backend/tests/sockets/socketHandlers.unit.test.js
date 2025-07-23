/**
 * @fileoverview Unit tests for socketHandlers.js
 * @module tests/sockets/socketHandlers.unit.test
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import SocketHandlers from '../../src/sockets/socketHandlers.js';
import AnalyticsService from '../../src/services/analyticsService.js';

describe('Socket Handlers Unit Tests', () => {
  let mockIo;
  let mockSocket;
  let socketHandlers;
  let mockMetrics;
  let mockToEmit;

  beforeEach(() => {
    mock.restoreAll();

    mockSocket = {
      id: 'test-socket-id',
      join: mock.fn(),
      emit: mock.fn(),
      on: mock.fn()
    };

    mockToEmit = mock.fn();
    mockIo = {
      on: mock.fn(),
      to: mock.fn(() => ({ emit: mockToEmit })),
      emit: mock.fn()
    };

    mockMetrics = {
      completionRate: 75,
      tasksByStatus: { pending: 5, completed: 10, inProgress: 3 },
      tasksByPriority: { low: 8, medium: 7, high: 3 },
      exportMetrics: {
        exportSuccessRate: 85,
        activeExports: 5
      }
    };

    socketHandlers = new SocketHandlers(mockIo);
  });

  describe('Constructor and Setup', () => {
    it('should initialize with io instance and setup event handlers', () => {
      assert.strictEqual(socketHandlers.io, mockIo);
      assert.strictEqual(mockIo.on.mock.callCount(), 1);
      assert.strictEqual(mockIo.on.mock.calls[0].arguments[0], 'connection');
    });

    it('should setup connection event handler', () => {
      const connectionHandler = mockIo.on.mock.calls[0].arguments[1];
      
      connectionHandler(mockSocket);

      assert.strictEqual(mockSocket.on.mock.callCount(), 6);
      
      const eventNames = mockSocket.on.mock.calls.map(call => call.arguments[0]);
      assert(eventNames.includes('join-analytics'));
      assert(eventNames.includes('join-exports'));
      assert(eventNames.includes('request-analytics'));
      assert(eventNames.includes('disconnect'));
      assert(eventNames.includes('connect_error'));
      assert(eventNames.includes('error'));
    });
  });

  describe('Socket Event Handlers', () => {
    beforeEach(() => {
      const connectionHandler = mockIo.on.mock.calls[0].arguments[1];
      connectionHandler(mockSocket);
    });

    it('should handle join-analytics event', () => {
      const joinAnalyticsHandler = mockSocket.on.mock.calls
        .find(call => call.arguments[0] === 'join-analytics').arguments[1];
      
      joinAnalyticsHandler();
      
      assert.strictEqual(mockSocket.join.mock.callCount(), 1);
      assert.strictEqual(mockSocket.join.mock.calls[0].arguments[0], 'analytics');
    });

    it('should handle join-exports event', () => {
      const joinExportsHandler = mockSocket.on.mock.calls
        .find(call => call.arguments[0] === 'join-exports').arguments[1];
      
      joinExportsHandler();
      
      assert.strictEqual(mockSocket.join.mock.callCount(), 1);
      assert.strictEqual(mockSocket.join.mock.calls[0].arguments[0], 'exports');
    });

    it('should handle request-analytics event successfully', async () => {
      mock.method(AnalyticsService, 'getTaskMetrics', () => Promise.resolve(mockMetrics));
      
      const requestAnalyticsHandler = mockSocket.on.mock.calls
        .find(call => call.arguments[0] === 'request-analytics').arguments[1];
      
      await requestAnalyticsHandler();
      
      assert.strictEqual(mockSocket.emit.mock.callCount(), 1);
      assert.strictEqual(mockSocket.emit.mock.calls[0].arguments[0], 'analytics-update');
      assert.strictEqual(mockSocket.emit.mock.calls[0].arguments[1], mockMetrics);
    });

    it('should handle request-analytics event error', async () => {
      mock.method(AnalyticsService, 'getTaskMetrics', () => Promise.reject(new Error('Analytics error')));
      
      const requestAnalyticsHandler = mockSocket.on.mock.calls
        .find(call => call.arguments[0] === 'request-analytics').arguments[1];
      
      await requestAnalyticsHandler();
      
      assert.strictEqual(mockSocket.emit.mock.callCount(), 1);
      assert.strictEqual(mockSocket.emit.mock.calls[0].arguments[0], 'analytics-error');
    });

    it('should handle disconnect event', () => {
      const disconnectHandler = mockSocket.on.mock.calls
        .find(call => call.arguments[0] === 'disconnect').arguments[1];
      
      disconnectHandler('client namespace disconnect');
      
      // Should log disconnect (no assertions needed for console.log)
    });

    it('should handle connect_error event', () => {
      const connectErrorHandler = mockSocket.on.mock.calls
        .find(call => call.arguments[0] === 'connect_error').arguments[1];
      
      connectErrorHandler(new Error('Connection failed'));
      
      // Should log error (no assertions needed for console.error)
    });

    it('should handle socket error event', () => {
      const errorHandler = mockSocket.on.mock.calls
        .find(call => call.arguments[0] === 'error').arguments[1];
      
      errorHandler(new Error('Socket error'));
      
      // Should log error (no assertions needed for console.error)
    });
  });

  describe('Broadcast Methods', () => {
    describe('broadcastAnalyticsUpdate', () => {
      it('should broadcast analytics update successfully', async () => {
        mock.method(AnalyticsService, 'getTaskMetrics', () => Promise.resolve(mockMetrics));
        const mockCheckThresholds = mock.method(socketHandlers, 'checkMetricThresholds', () => Promise.resolve());
        
        await socketHandlers.broadcastAnalyticsUpdate();
        
        assert.strictEqual(mockIo.to.mock.callCount(), 1);
        assert.strictEqual(mockIo.to.mock.calls[0].arguments[0], 'analytics');
        assert.strictEqual(mockCheckThresholds.mock.callCount(), 1);
      });

      it('should handle analytics service error gracefully', async () => {
        mock.method(AnalyticsService, 'getTaskMetrics', () => Promise.reject(new Error('Service error')));
        
        await socketHandlers.broadcastAnalyticsUpdate();
        
        // Should not throw error and should log it
      });
    });

    describe('broadcastTaskUpdate', () => {
      it('should broadcast task update with correct data', () => {
        const mockBroadcastAnalytics = mock.method(socketHandlers, 'broadcastAnalyticsUpdate', () => Promise.resolve());
        const task = { id: '123', title: 'Test Task' };
        
        socketHandlers.broadcastTaskUpdate('created', task);
        
        assert.strictEqual(mockIo.emit.mock.callCount(), 1);
        assert.strictEqual(mockIo.emit.mock.calls[0].arguments[0], 'task-update');
        
        const emittedData = mockIo.emit.mock.calls[0].arguments[1];
        assert.strictEqual(emittedData.action, 'created');
        assert.strictEqual(emittedData.task, task);
        assert(emittedData.timestamp);
        
        assert.strictEqual(mockBroadcastAnalytics.mock.callCount(), 1);
      });
    });

    describe('broadcastNotification', () => {
      it('should broadcast notification with string message', () => {
        socketHandlers.broadcastNotification('Test message', 'warning');
        
        assert.strictEqual(mockIo.emit.mock.callCount(), 1);
        assert.strictEqual(mockIo.emit.mock.calls[0].arguments[0], 'notification');
        
        const notification = mockIo.emit.mock.calls[0].arguments[1];
        assert.strictEqual(notification.message, 'Test message');
        assert.strictEqual(notification.type, 'warning');
        assert(notification.timestamp);
      });

      it('should broadcast notification with object', () => {
        const notificationObj = {
          message: 'Object message',
          type: 'error',
          data: { key: 'value' }
        };
        
        socketHandlers.broadcastNotification(notificationObj);
        
        assert.strictEqual(mockIo.emit.mock.callCount(), 1);
        assert.strictEqual(mockIo.emit.mock.calls[0].arguments[0], 'notification');
        
        const notification = mockIo.emit.mock.calls[0].arguments[1];
        assert.strictEqual(notification.message, 'Object message');
        assert.strictEqual(notification.type, 'error');
        assert.strictEqual(notification.data.key, 'value');
        assert(notification.timestamp);
      });

      it('should use default type when not specified', () => {
        socketHandlers.broadcastNotification('Default type message');
        
        const notification = mockIo.emit.mock.calls[0].arguments[1];
        assert.strictEqual(notification.type, 'info');
      });
    });

    describe('checkMetricThresholds', () => {
      it('should send warning for low completion rate', async () => {
        const mockBroadcastNotification = mock.method(socketHandlers, 'broadcastNotification');
        const lowCompletionMetrics = { ...mockMetrics, completionRate: 30 };
        
        await socketHandlers.checkMetricThresholds(lowCompletionMetrics);
        
        assert.strictEqual(mockBroadcastNotification.mock.callCount(), 1);
        assert(mockBroadcastNotification.mock.calls[0].arguments[0].includes('completion rate'));
        assert.strictEqual(mockBroadcastNotification.mock.calls[0].arguments[1], 'warning');
      });

      it('should send info for high pending tasks', async () => {
        const mockBroadcastNotification = mock.method(socketHandlers, 'broadcastNotification');
        const highPendingMetrics = {
          ...mockMetrics,
          tasksByStatus: { ...mockMetrics.tasksByStatus, pending: 25 }
        };
        
        await socketHandlers.checkMetricThresholds(highPendingMetrics);
        
        assert.strictEqual(mockBroadcastNotification.mock.callCount(), 1);
        assert(mockBroadcastNotification.mock.calls[0].arguments[0].includes('pending tasks'));
        assert.strictEqual(mockBroadcastNotification.mock.calls[0].arguments[1], 'info');
      });

      it('should send warning for high priority tasks', async () => {
        const mockBroadcastNotification = mock.method(socketHandlers, 'broadcastNotification');
        const highPriorityMetrics = {
          ...mockMetrics,
          tasksByPriority: { ...mockMetrics.tasksByPriority, high: 15 }
        };
        
        await socketHandlers.checkMetricThresholds(highPriorityMetrics);
        
        assert.strictEqual(mockBroadcastNotification.mock.callCount(), 1);
        assert(mockBroadcastNotification.mock.calls[0].arguments[0].includes('High priority tasks'));
        assert.strictEqual(mockBroadcastNotification.mock.calls[0].arguments[1], 'warning');
      });

      it('should send warning for low export success rate', async () => {
        const mockBroadcastNotification = mock.method(socketHandlers, 'broadcastNotification');
        const lowExportSuccessMetrics = {
          ...mockMetrics,
          exportMetrics: { ...mockMetrics.exportMetrics, exportSuccessRate: 60 }
        };
        
        await socketHandlers.checkMetricThresholds(lowExportSuccessMetrics);
        
        assert.strictEqual(mockBroadcastNotification.mock.callCount(), 1);
        assert(mockBroadcastNotification.mock.calls[0].arguments[0].includes('Export success rate'));
        assert.strictEqual(mockBroadcastNotification.mock.calls[0].arguments[1], 'warning');
      });

      it('should send info for high active exports', async () => {
        const mockBroadcastNotification = mock.method(socketHandlers, 'broadcastNotification');
        const highActiveExportsMetrics = {
          ...mockMetrics,
          exportMetrics: { ...mockMetrics.exportMetrics, activeExports: 15 }
        };
        
        await socketHandlers.checkMetricThresholds(highActiveExportsMetrics);
        
        assert.strictEqual(mockBroadcastNotification.mock.callCount(), 1);
        assert(mockBroadcastNotification.mock.calls[0].arguments[0].includes('active exports'));
        assert.strictEqual(mockBroadcastNotification.mock.calls[0].arguments[1], 'info');
      });

      it('should not send notifications when metrics are within thresholds', async () => {
        const mockBroadcastNotification = mock.method(socketHandlers, 'broadcastNotification');
        
        await socketHandlers.checkMetricThresholds(mockMetrics);
        
        assert.strictEqual(mockBroadcastNotification.mock.callCount(), 0);
      });
    });

    describe('Export Broadcasting Methods', () => {
      it('should broadcast export progress', () => {
        socketHandlers.broadcastExportProgress('export-123', 75, 'processing');
        
        assert.strictEqual(mockIo.to.mock.callCount(), 1);
        assert.strictEqual(mockIo.to.mock.calls[0].arguments[0], 'exports');
        
        assert.strictEqual(mockToEmit.mock.callCount(), 1);
        assert.strictEqual(mockToEmit.mock.calls[0].arguments[0], 'export-progress');
        
        const progressData = mockToEmit.mock.calls[0].arguments[1];
        assert.strictEqual(progressData.exportId, 'export-123');
        assert.strictEqual(progressData.progress, 75);
        assert.strictEqual(progressData.status, 'processing');
      });

      it('should broadcast export status change', async () => {
        mock.method(AnalyticsService, 'exportStatusChanged', () => Promise.resolve());
        const mockBroadcastAnalytics = mock.method(socketHandlers, 'broadcastAnalyticsUpdate', () => Promise.resolve());
        
        await socketHandlers.broadcastExportStatusChange('export-123', 'completed', { fileSize: 1024 });
        
        assert.strictEqual(mockIo.to.mock.callCount(), 1);
        assert.strictEqual(mockIo.to.mock.calls[0].arguments[0], 'exports');
        
        assert.strictEqual(mockToEmit.mock.callCount(), 1);
        assert.strictEqual(mockToEmit.mock.calls[0].arguments[0], 'export-status-change');
        
        assert.strictEqual(mockBroadcastAnalytics.mock.callCount(), 1);
      });

      it('should broadcast export completion', async () => {
        mock.method(AnalyticsService, 'onExportCompleted', () => Promise.resolve());
        const mockBroadcastAnalytics = mock.method(socketHandlers, 'broadcastAnalyticsUpdate', () => Promise.resolve());
        const mockBroadcastNotification = mock.method(socketHandlers, 'broadcastNotification');
        
        const exportData = { format: 'csv', totalRecords: 100 };
        await socketHandlers.broadcastExportCompleted('export-123', exportData);
        
        assert.strictEqual(mockIo.to.mock.callCount(), 1);
        assert.strictEqual(mockIo.to.mock.calls[0].arguments[0], 'exports');
        
        assert.strictEqual(mockToEmit.mock.callCount(), 1);
        assert.strictEqual(mockToEmit.mock.calls[0].arguments[0], 'export-completed');
        
        assert.strictEqual(mockBroadcastNotification.mock.callCount(), 1);
        assert.strictEqual(mockBroadcastAnalytics.mock.callCount(), 1);
      });

      it('should broadcast export failure', async () => {
        mock.method(AnalyticsService, 'exportStatusChanged', () => Promise.resolve());
        const mockBroadcastAnalytics = mock.method(socketHandlers, 'broadcastAnalyticsUpdate', () => Promise.resolve());
        const mockBroadcastNotification = mock.method(socketHandlers, 'broadcastNotification');
        
        await socketHandlers.broadcastExportFailed('export-123', 'Processing failed', { attempts: 3 });
        
        assert.strictEqual(mockIo.to.mock.callCount(), 1);
        assert.strictEqual(mockIo.to.mock.calls[0].arguments[0], 'exports');
        
        assert.strictEqual(mockToEmit.mock.callCount(), 1);
        assert.strictEqual(mockToEmit.mock.calls[0].arguments[0], 'export-failed');
        
        assert.strictEqual(mockBroadcastNotification.mock.callCount(), 1);
        assert.strictEqual(mockBroadcastAnalytics.mock.callCount(), 1);
      });

      it('should broadcast export list update', async () => {
        mock.method(AnalyticsService, 'onExportCreated', () => Promise.resolve());
        const mockBroadcastAnalytics = mock.method(socketHandlers, 'broadcastAnalyticsUpdate', () => Promise.resolve());
        
        const exportData = { _id: 'export-123', format: 'json' };
        await socketHandlers.broadcastExportListUpdate('created', exportData);
        
        assert.strictEqual(mockIo.to.mock.callCount(), 1);
        assert.strictEqual(mockIo.to.mock.calls[0].arguments[0], 'exports');
        
        assert.strictEqual(mockToEmit.mock.callCount(), 1);
        assert.strictEqual(mockToEmit.mock.calls[0].arguments[0], 'export-list-update');
        
        const updateData = mockToEmit.mock.calls[0].arguments[1];
        assert.strictEqual(updateData.action, 'created');
        assert.strictEqual(updateData.export, exportData);
        
        assert.strictEqual(mockBroadcastAnalytics.mock.callCount(), 1);
      });

      it('should not call analytics for non-created export list updates', async () => {
        mock.method(AnalyticsService, 'onExportCreated', () => Promise.resolve());
        const mockBroadcastAnalytics = mock.method(socketHandlers, 'broadcastAnalyticsUpdate', () => Promise.resolve());
        
        const exportData = { _id: 'export-123', format: 'json' };
        await socketHandlers.broadcastExportListUpdate('updated', exportData);
        
        assert.strictEqual(mockBroadcastAnalytics.mock.callCount(), 0);
      });
    });
  });
});