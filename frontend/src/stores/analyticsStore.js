/**
 * @fileoverview Analytics store for managing task metrics and real-time updates
 * @module stores/analyticsStore
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiClient from '../api/client.js'
import socket from '../plugins/socket.js'

/**
 * Pinia store for analytics data, notifications, and real-time Socket.IO updates
 * @function useAnalyticsStore
 * @returns {Object} Analytics store with reactive state and methods
 */
export const useAnalyticsStore = defineStore('analytics', () => {
  const analytics = ref({
    totalTasks: 0,
    tasksByStatus: { pending: 0, 'in-progress': 0, completed: 0 },
    tasksByPriority: { low: 0, medium: 0, high: 0 },
    completionRate: 0,
    averageCompletionTime: 0,
    tasksCreatedToday: 0,
    tasksCompletedToday: 0,
    recentActivity: [],
    lastUpdated: null,
    // Added export metrics
    exportMetrics: {
      totalExports: 0,
      activeExports: 0,
      completedExports: 0,
      failedExports: 0,
      exportSuccessRate: 0,
      exportsCreatedToday: 0,
      exportsByFormat: { csv: 0, json: 0 },
      averageExportSize: 0,
      averageExportTime: 0
    }
  })

  const loading = ref(false)
  const error = ref(null)
  const notifications = ref([])
  const connected = ref(false)
  const networkOnline = ref(navigator.onLine) // Add network online state
  const connectionCheckInterval = ref(null)

  const statusData = computed(() => [
    {
      name: 'Pending',
      value: analytics.value.tasksByStatus.pending,
      color: '#FFC107'
    },
    {
      name: 'In Progress',
      value: analytics.value.tasksByStatus['in-progress'],
      color: '#2196F3'
    },
    {
      name: 'Completed',
      value: analytics.value.tasksByStatus.completed,
      color: '#4CAF50'
    }
  ])

  const priorityData = computed(() => [
    {
      name: 'Low',
      value: analytics.value.tasksByPriority.low,
      color: '#4CAF50'
    },
    {
      name: 'Medium',
      value: analytics.value.tasksByPriority.medium,
      color: '#FFC107'
    },
    {
      name: 'High',
      value: analytics.value.tasksByPriority.high,
      color: '#FF5252'
    }
  ])

  /**
   * Fetches analytics data from API
   * @async
   * @function fetchAnalytics
   * @returns {Promise<void>}
   */
  async function fetchAnalytics() {
    loading.value = true
    error.value = null

    try {
      const response = await apiClient.getAnalytics()
      analytics.value = response.data
    } catch (err) {
      error.value = err.message
      console.error('Error fetching analytics:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Updates analytics data with new values
   * @function updateAnalytics
   * @param {Object} newData - New analytics data to merge
   */
  function updateAnalytics(newData) {
    analytics.value = { ...analytics.value, ...newData }
  }

  /**
   * Requests fresh analytics data from server
   * @function requestAnalyticsUpdate
   */
  function requestAnalyticsUpdate() {
    if (socket.connected) {
      console.log('📊 Requesting fresh analytics data...')
      socket.emit('request-analytics')
    } else {
      console.warn('📊 Cannot request analytics - socket disconnected')
      // Fallback to HTTP fetch if socket is disconnected
      fetchAnalytics()
    }
  }

  /**
   * Adds notification to the notifications list
   * @function addNotification
   * @param {Object} notification - Notification object
   */
  function addNotification(notification) {
    const id = Date.now().toString()
    notifications.value.unshift({
      id,
      ...notification,
      timestamp: notification.timestamp || new Date().toISOString()
    })

    if (notifications.value.length > 50) {
      notifications.value = notifications.value.slice(0, 50)
    }
  }

  /**
   * Removes notification by ID
   * @function removeNotification
   * @param {string} id - Notification ID
   */
  function removeNotification(id) {
    const index = notifications.value.findIndex((n) => n.id === id)
    if (index !== -1) {
      notifications.value.splice(index, 1)
    }
  }

  /**
   * Clears all notifications
   * @function clearNotifications
   */
  function clearNotifications() {
    notifications.value = []
  }

  /**
   * Checks if the application is truly connected to the internet
   * @async
   * @function checkNetworkConnectivity
   * @returns {Promise<boolean>}
   */
  async function checkNetworkConnectivity() {
    try {
      // Try to fetch a tiny resource from the server with cache busting
      const pingUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/health/ping?_=${Date.now()}`
      const response = await fetch(pingUrl, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
        mode: 'cors',
        // Short timeout to detect connection issues quickly
        signal: AbortSignal.timeout(3000)
      })

      if (response.ok) {
        networkOnline.value = true
        return true
      } else {
        networkOnline.value = false
        return false
      }
    } catch (err) {
      console.warn('Network connectivity check failed:', err)
      networkOnline.value = false
      return false
    }
  }

  /**
   * Returns the true connection status considering both socket and network state
   * @returns {boolean}
   */
  const isReallyConnected = computed(() => {
    return connected.value && networkOnline.value
  })

  /**
   * Starts periodic connection checking
   * @function startConnectionChecking
   */
  function startConnectionChecking() {
    // Initial check
    checkNetworkConnectivity()

    // Listen for browser's online/offline events
    window.addEventListener('online', () => {
      console.log('🌐 Browser reports online')
      networkOnline.value = true
      // Reconnect socket if needed
      if (!socket.connected) {
        connect()
      }
    })

    window.addEventListener('offline', () => {
      console.log('🌐 Browser reports offline')
      networkOnline.value = false
    })

    // Periodic check every 30 seconds
    connectionCheckInterval.value = setInterval(async () => {
      await checkNetworkConnectivity()

      // If network is available but socket disconnected, try reconnecting
      if (networkOnline.value && !socket.connected) {
        console.log(
          '🔄 Network available but socket disconnected - reconnecting'
        )
        connect()
      }

      // If network is unavailable but socket thinks it's connected, force disconnect
      if (!networkOnline.value && socket.connected) {
        console.log(
          '⚠️ Network unavailable but socket thinks connected - forcing status update'
        )
        connected.value = false
      }
    }, 30000) // Check every 30 seconds
  }

  /**
   * Stops periodic connection checking
   * @function stopConnectionChecking
   */
  function stopConnectionChecking() {
    if (connectionCheckInterval.value) {
      clearInterval(connectionCheckInterval.value)
      connectionCheckInterval.value = null
    }

    window.removeEventListener('online', () => {})
    window.removeEventListener('offline', () => {})
  }

  /**
   * Sets up Socket.IO event listeners for real-time updates
   * @function initializeSocketListeners
   */
  function initializeSocketListeners() {
    // Start connection checking
    startConnectionChecking()

    socket.on('connect', () => {
      console.log('📊 Analytics store: Socket connected')
      connected.value = true
      socket.emit('join-analytics')
      socket.emit('request-analytics')

      // Verify actual network connectivity
      checkNetworkConnectivity()
    })

    socket.on('disconnect', (reason) => {
      console.log('📊 Analytics store: Socket disconnected', reason)
      connected.value = false
    })

    socket.on('connect_error', (error) => {
      console.error('📊 Analytics store: Connection error', error)
      connected.value = false
    })

    socket.on('reconnect', (attemptNumber) => {
      console.log(
        '📊 Analytics store: Reconnected after',
        attemptNumber,
        'attempts'
      )
      connected.value = true
      socket.emit('join-analytics')
      socket.emit('request-analytics')
    })

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('📊 Analytics store: Reconnection attempt', attemptNumber)
    })

    socket.on('reconnect_error', (error) => {
      console.error('📊 Analytics store: Reconnection error', error)
      connected.value = false
    })

    socket.on('reconnect_failed', () => {
      console.error('📊 Analytics store: Reconnection failed')
      connected.value = false
    })

    socket.on('analytics-update', (_data) => {
      updateAnalytics(_data)
    })

    socket.on('analytics-error', (error) => {
      console.error('Analytics error:', error)
      addNotification({
        message: error.message || 'Failed to update analytics',
        type: 'error'
      })
    })

    socket.on('notification', (notification) => {
      addNotification(notification)
    })

    socket.on('task-update', (_data) => {
      console.log(
        '📊 Task update detected, refreshing analytics...',
        _data.action
      )
      // Immediately request fresh analytics when a task is updated
      requestAnalyticsUpdate()
    })

    // Listen for export-related events to update analytics
    socket.on('export-list-update', (_data) => {
      console.log(
        '📤 Export update detected, refreshing analytics...',
        _data.action
      )
      requestAnalyticsUpdate()
    })

    socket.on('export-completed', (_data) => {
      console.log('📤 Export completed, refreshing analytics...')
      requestAnalyticsUpdate()
    })

    socket.on('export-failed', (_data) => {
      console.log('📤 Export failed, refreshing analytics...')
      requestAnalyticsUpdate()
    })
  }

  /**
   * Removes Socket.IO event listeners
   * @function cleanup
   */
  function cleanup() {
    // Stop connection checking
    stopConnectionChecking()

    socket.off('connect')
    socket.off('disconnect')
    socket.off('connect_error')
    socket.off('reconnect')
    socket.off('reconnect_attempt')
    socket.off('reconnect_error')
    socket.off('reconnect_failed')
    socket.off('analytics-update')
    socket.off('analytics-error')
    socket.off('notification')
    socket.off('task-update')
    socket.off('export-list-update')
    socket.off('export-completed')
    socket.off('export-failed')
  }

  /**
   * Connects to Socket.IO server
   * @function connect
   */
  function connect() {
    if (!socket.connected) {
      socket.connect()
    }
  }

  /**
   * Disconnects from Socket.IO server
   * @function disconnect
   */
  function disconnect() {
    if (socket.connected) {
      socket.disconnect()
    }
  }

  return {
    analytics,
    loading,
    error,
    notifications,
    connected,
    networkOnline,
    isReallyConnected, // Export the computed property
    statusData,
    priorityData,
    fetchAnalytics,
    updateAnalytics,
    requestAnalyticsUpdate,
    addNotification,
    removeNotification,
    clearNotifications,
    initializeSocketListeners,
    cleanup,
    connect,
    disconnect,
    checkNetworkConnectivity // Export the method to allow manual checks
  }
})
