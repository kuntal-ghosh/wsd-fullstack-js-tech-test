/**
 * @fileoverview Socket.IO event handlers for real-time communication
 * @module sockets/SocketHandlers
 */

import AnalyticsService from '../services/analyticsService.js';

/**
 * Handles Socket.IO connections and real-time events
 * @class SocketHandlers
 */
class SocketHandlers {
  /**
   * Creates SocketHandlers instance and sets up event listeners
   * @param {Object} io - Socket.IO server instance
   */
  constructor(io) {
    this.io = io;
    this.setupEventHandlers();
  }

  /**
   * Sets up Socket.IO event handlers for client connections
   * @private
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      socket.on('join-analytics', () => {
        socket.join('analytics');
        console.log(`📊 Client ${socket.id} joined analytics room`);
      });

      socket.on('join-exports', () => {
        socket.join('exports');
        console.log(`📤 Client ${socket.id} joined exports room`);
      });

      socket.on('request-analytics', async () => {
        try {
          const metrics = await AnalyticsService.getTaskMetrics();
          socket.emit('analytics-update', metrics);
        } catch (error) {
          console.error('Error sending analytics update:', error);
          socket.emit('analytics-error', { message: 'Failed to get analytics data' });
        }
      });

      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Broadcasts analytics updates to all connected clients in analytics room
   * @async
   * @returns {Promise<void>}
   */
  async broadcastAnalyticsUpdate() {
    try {
      const metrics = await AnalyticsService.getTaskMetrics();
      this.io.to('analytics').emit('analytics-update', metrics);
      
      // Check metrics thresholds for both tasks and exports
      await this.checkMetricThresholds(metrics);
    } catch (error) {
      console.error('Error broadcasting analytics update:', error);
    }
  }

  /**
   * Broadcasts task updates to all connected clients
   * @param {string} action - Action performed (created, updated, deleted)
   * @param {Object} task - Task data
   */
  broadcastTaskUpdate(action, task) {
    this.io.emit('task-update', {
      action,
      task,
      timestamp: new Date().toISOString()
    });

    this.broadcastAnalyticsUpdate();
  }

  /**
   * Broadcasts notifications to all connected clients
   * @param {Object|string} notification - Notification object or message string
   * @param {string} [type='info'] - Notification type (info, warning, error) when message is string
   */
  broadcastNotification(notification, type = 'info') {
    // Handle both object and string parameters
    const notificationData = typeof notification === 'string' 
      ? {
          message: notification,
          type,
          timestamp: new Date().toISOString()
        }
      : {
          ...notification,
          timestamp: notification.timestamp || new Date().toISOString()
        };

    this.io.emit('notification', notificationData);
  }

  /**
   * Checks metrics against thresholds and sends notifications if exceeded
   * @async
   * @param {Object} metrics - Analytics metrics object
   * @returns {Promise<void>}
   */
  async checkMetricThresholds(metrics) {
    if (metrics.completionRate < 50) {
      this.broadcastNotification(
        `⚠️ Task completion rate has dropped to ${metrics.completionRate}%`,
        'warning'
      );
    }

    if (metrics.tasksByStatus.pending > 20) {
      this.broadcastNotification(
        `📋 High number of pending tasks: ${metrics.tasksByStatus.pending}`,
        'info'
      );
    }

    if (metrics.tasksByPriority.high > 10) {
      this.broadcastNotification(
        `🔥 High priority tasks need attention: ${metrics.tasksByPriority.high}`,
        'warning'
      );
    }
    
    // Add export metric thresholds
    if (metrics.exportMetrics && metrics.exportMetrics.exportSuccessRate < 75) {
      this.broadcastNotification(
        `⚠️ Export success rate has dropped to ${metrics.exportMetrics.exportSuccessRate}%`,
        'warning'
      );
    }
    
    if (metrics.exportMetrics && metrics.exportMetrics.activeExports > 10) {
      this.broadcastNotification(
        `📤 High number of active exports: ${metrics.exportMetrics.activeExports}`,
        'info'
      );
    }
  }

  /**
   * Broadcasts export progress updates to all connected clients in exports room
   * @param {string} exportId - Export document ID
   * @param {number} progress - Progress percentage (0-100)
   * @param {string} [status='processing'] - Export status
   */
  broadcastExportProgress(exportId, progress, status = 'processing') {
    const progressData = {
      exportId,
      progress,
      status,
      timestamp: new Date().toISOString()
    };

    this.io.to('exports').emit('export-progress', progressData);
    console.log(`📤 Broadcasting export progress: ${exportId} - ${progress}%`);
  }

  /**
   * Broadcasts export status changes to all connected clients in exports room
   * @param {string} exportId - Export document ID
   * @param {string} status - New export status
   * @param {Object} [metadata] - Additional status metadata
   */
  async broadcastExportStatusChange(exportId, status, metadata = {}) {
    const statusData = {
      exportId,
      status,
      metadata,
      timestamp: new Date().toISOString()
    };

    this.io.to('exports').emit('export-status-change', statusData);
    console.log(`📤 Broadcasting export status change: ${exportId} - ${status}`);
    
    // Update analytics when export status changes
    await AnalyticsService.exportStatusChanged(exportId, status);
    await this.broadcastAnalyticsUpdate();
  }

  /**
   * Broadcasts export completion to all connected clients in exports room
   * @param {string} exportId - Export document ID
   * @param {Object} exportData - Completed export data
   */
  async broadcastExportCompleted(exportId, exportData) {
    const completionData = {
      exportId,
      status: 'completed',
      exportData,
      timestamp: new Date().toISOString()
    };

    this.io.to('exports').emit('export-completed', completionData);
    this.broadcastNotification(
      `✅ Export completed successfully: ${exportData.format} format with ${exportData.totalRecords || 0} records`,
      'success'
    );
    console.log(`📤 Broadcasting export completion: ${exportId}`);
    
    // Update analytics when export is completed
    await AnalyticsService.onExportCompleted(exportData);
    await this.broadcastAnalyticsUpdate();
  }

  /**
   * Broadcasts export failure to all connected clients in exports room
   * @param {string} exportId - Export document ID
   * @param {string} error - Error message
   * @param {Object} [metadata] - Additional failure metadata
   */
  async broadcastExportFailed(exportId, error, metadata = {}) {
    const failureData = {
      exportId,
      status: 'failed',
      error,
      metadata,
      timestamp: new Date().toISOString()
    };

    this.io.to('exports').emit('export-failed', failureData);
    this.broadcastNotification(
      `❌ Export failed: ${error}`,
      'error'
    );
    console.log(`📤 Broadcasting export failure: ${exportId} - ${error}`);
    
    // Update analytics when export fails
    await AnalyticsService.exportStatusChanged(exportId, 'failed');
    await this.broadcastAnalyticsUpdate();
  }

  /**
   * Broadcasts export list updates to all connected clients in exports room
   * @param {string} action - Action performed (created, updated, deleted)
   * @param {Object} exportData - Export data
   */
  async broadcastExportListUpdate(action, exportData) {
    const updateData = {
      action,
      export: exportData,
      timestamp: new Date().toISOString()
    };

    this.io.to('exports').emit('export-list-update', updateData);
    console.log(`📤 Broadcasting export list update: ${action} - ${exportData._id}`);
    
    // Update analytics when export is created
    if (action === 'created') {
      await AnalyticsService.onExportCreated(exportData);
      await this.broadcastAnalyticsUpdate();
    }
  }
}

export default SocketHandlers;
