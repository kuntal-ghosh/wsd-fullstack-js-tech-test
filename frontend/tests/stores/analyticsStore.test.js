/**
 * @fileoverview Unit tests for analyticsStore.js
 * @module tests/stores/analyticsStore.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAnalyticsStore } from '../../src/stores/analyticsStore.js'

// Mock socket plugin
vi.mock('../../src/plugins/socket.js', () => ({
  default: {
    connected: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }
}))

// Mock API client
vi.mock('../../src/api/client.js', () => ({
  default: {
    getAnalytics: vi.fn()
  }
}))

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
})

// Mock AbortSignal.timeout
global.AbortSignal = {
  timeout: vi.fn(() => ({ aborted: false }))
}

// Mock window event listeners
global.window = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
}

describe('Analytics Store', () => {
  let analyticsStore
  let pinia
  let mockSocket
  let mockApiClient

  const mockAnalyticsData = {
    totalTasks: 10,
    tasksByStatus: { pending: 3, 'in-progress': 2, completed: 5 },
    tasksByPriority: { low: 4, medium: 3, high: 3 },
    completionRate: 50,
    averageCompletionTime: 24,
    tasksCreatedToday: 2,
    tasksCompletedToday: 1,
    recentActivity: [],
    lastUpdated: new Date().toISOString(),
    exportMetrics: {
      totalExports: 5,
      activeExports: 1,
      completedExports: 4,
      failedExports: 0,
      exportSuccessRate: 100,
      exportsCreatedToday: 2,
      exportsByFormat: { csv: 3, json: 2 },
      averageExportSize: 1024,
      averageExportTime: 30
    }
  }

  beforeEach(async () => {
    pinia = createPinia()
    setActivePinia(pinia)
    analyticsStore = useAnalyticsStore()

    // Get mocked modules
    const socketModule = await vi.importMock('../../src/plugins/socket.js')
    const apiModule = await vi.importMock('../../src/api/client.js')
    mockSocket = socketModule.default
    mockApiClient = apiModule.default

    // Reset all mocks
    vi.clearAllMocks()
    mockSocket.connected = false
    navigator.onLine = true
  })

  afterEach(() => {
    if (analyticsStore.connectionCheckInterval) {
      clearInterval(analyticsStore.connectionCheckInterval)
    }
  })

  describe('Initial State', () => {
    it('should initialize with default analytics data', () => {
      expect(analyticsStore.analytics.totalTasks).toBe(0)
      expect(analyticsStore.analytics.tasksByStatus).toEqual({
        pending: 0,
        'in-progress': 0,
        completed: 0
      })
      expect(analyticsStore.analytics.tasksByPriority).toEqual({
        low: 0,
        medium: 0,
        high: 0
      })
      expect(analyticsStore.analytics.completionRate).toBe(0)
    })

    it('should initialize with empty notifications', () => {
      expect(analyticsStore.notifications).toEqual([])
    })

    it('should initialize connection state as false', () => {
      expect(analyticsStore.connected).toBe(false)
    })

    it('should initialize networkOnline based on navigator.onLine', () => {
      expect(analyticsStore.networkOnline).toBe(true)
    })
  })

  describe('Computed Properties', () => {
    beforeEach(() => {
      analyticsStore.analytics = mockAnalyticsData
    })

    it('should compute statusData correctly', () => {
      const statusData = analyticsStore.statusData

      expect(statusData).toHaveLength(3)
      expect(statusData[0]).toEqual({
        name: 'Pending',
        value: 3,
        color: '#FFC107'
      })
      expect(statusData[1]).toEqual({
        name: 'In Progress',
        value: 2,
        color: '#2196F3'
      })
      expect(statusData[2]).toEqual({
        name: 'Completed',
        value: 5,
        color: '#4CAF50'
      })
    })

    it('should compute priorityData correctly', () => {
      const priorityData = analyticsStore.priorityData

      expect(priorityData).toHaveLength(3)
      expect(priorityData[0]).toEqual({
        name: 'Low',
        value: 4,
        color: '#4CAF50'
      })
      expect(priorityData[1]).toEqual({
        name: 'Medium',
        value: 3,
        color: '#FFC107'
      })
      expect(priorityData[2]).toEqual({
        name: 'High',
        value: 3,
        color: '#FF5252'
      })
    })

    it('should compute isReallyConnected correctly', () => {
      // Both connected and online
      analyticsStore.connected = true
      analyticsStore.networkOnline = true
      expect(analyticsStore.isReallyConnected).toBe(true)

      // Connected but offline
      analyticsStore.networkOnline = false
      expect(analyticsStore.isReallyConnected).toBe(false)

      // Not connected but online
      analyticsStore.connected = false
      analyticsStore.networkOnline = true
      expect(analyticsStore.isReallyConnected).toBe(false)

      // Neither connected nor online
      analyticsStore.connected = false
      analyticsStore.networkOnline = false
      expect(analyticsStore.isReallyConnected).toBe(false)
    })
  })

  describe('fetchAnalytics', () => {
    it('should fetch analytics successfully', async () => {
      mockApiClient.getAnalytics.mockResolvedValue({ data: mockAnalyticsData })

      await analyticsStore.fetchAnalytics()

      expect(analyticsStore.loading).toBe(false)
      expect(analyticsStore.error).toBe(null)
      expect(analyticsStore.analytics).toEqual(mockAnalyticsData)
      expect(mockApiClient.getAnalytics).toHaveBeenCalledOnce()
    })

    it('should handle fetch error', async () => {
      const errorMessage = 'Network error'
      mockApiClient.getAnalytics.mockRejectedValue(new Error(errorMessage))

      await analyticsStore.fetchAnalytics()

      expect(analyticsStore.loading).toBe(false)
      expect(analyticsStore.error).toBe(errorMessage)
      expect(mockApiClient.getAnalytics).toHaveBeenCalledOnce()
    })

    it('should set loading state during fetch', () => {
      const promise = new Promise(() => {}) // Never resolves
      mockApiClient.getAnalytics.mockReturnValue(promise)

      analyticsStore.fetchAnalytics()

      expect(analyticsStore.loading).toBe(true)
      expect(analyticsStore.error).toBe(null)
    })
  })

  describe('updateAnalytics', () => {
    it('should update analytics data', () => {
      const initialData = { totalTasks: 5 }
      const updateData = { totalTasks: 10, completionRate: 75 }

      analyticsStore.analytics = initialData
      analyticsStore.updateAnalytics(updateData)

      expect(analyticsStore.analytics.totalTasks).toBe(10)
      expect(analyticsStore.analytics.completionRate).toBe(75)
    })

    it('should merge with existing data', () => {
      analyticsStore.analytics = { totalTasks: 5, completionRate: 50 }
      analyticsStore.updateAnalytics({ totalTasks: 10 })

      expect(analyticsStore.analytics.totalTasks).toBe(10)
      expect(analyticsStore.analytics.completionRate).toBe(50)
    })
  })

  describe('requestAnalyticsUpdate', () => {
    it('should emit request-analytics when socket connected', () => {
      mockSocket.connected = true

      analyticsStore.requestAnalyticsUpdate()

      expect(mockSocket.emit).toHaveBeenCalledWith('request-analytics')
    })

    it('should fallback to fetchAnalytics when socket disconnected', async () => {
      mockSocket.connected = false
      mockApiClient.getAnalytics.mockResolvedValue({ data: mockAnalyticsData })

      await analyticsStore.requestAnalyticsUpdate()

      expect(mockSocket.emit).not.toHaveBeenCalled()
      expect(mockApiClient.getAnalytics).toHaveBeenCalledOnce()
    })
  })

  describe('Notification Management', () => {
    it('should add notification', () => {
      const notification = {
        message: 'Test notification',
        type: 'info'
      }

      analyticsStore.addNotification(notification)

      expect(analyticsStore.notifications).toHaveLength(1)
      expect(analyticsStore.notifications[0]).toMatchObject({
        message: 'Test notification',
        type: 'info',
        id: expect.any(String),
        timestamp: expect.any(String)
      })
    })

    it('should add timestamp if not provided', () => {
      const notification = { message: 'Test', type: 'info' }
      analyticsStore.addNotification(notification)

      expect(analyticsStore.notifications[0].timestamp).toBeDefined()
    })

    it('should use provided timestamp', () => {
      const timestamp = '2024-01-01T00:00:00.000Z'
      const notification = { message: 'Test', type: 'info', timestamp }

      analyticsStore.addNotification(notification)

      expect(analyticsStore.notifications[0].timestamp).toBe(timestamp)
    })

    it('should limit notifications to 50', () => {
      // Add 60 notifications
      for (let i = 0; i < 60; i++) {
        analyticsStore.addNotification({
          message: `Notification ${i}`,
          type: 'info'
        })
      }

      expect(analyticsStore.notifications).toHaveLength(50)
    })

    it('should remove notification by ID', () => {
      analyticsStore.addNotification({ message: 'Test 1', type: 'info' })
      analyticsStore.addNotification({ message: 'Test 2', type: 'info' })

      const notificationId = analyticsStore.notifications[0].id
      analyticsStore.removeNotification(notificationId)

      expect(analyticsStore.notifications).toHaveLength(1)
      expect(analyticsStore.notifications[0].message).toBe('Test 2')
    })

    it('should handle non-existent notification ID', () => {
      analyticsStore.addNotification({ message: 'Test', type: 'info' })

      analyticsStore.removeNotification('non-existent-id')

      expect(analyticsStore.notifications).toHaveLength(1)
    })

    it('should clear all notifications', () => {
      analyticsStore.addNotification({ message: 'Test 1', type: 'info' })
      analyticsStore.addNotification({ message: 'Test 2', type: 'info' })

      analyticsStore.clearNotifications()

      expect(analyticsStore.notifications).toHaveLength(0)
    })
  })

  describe('Network Connectivity', () => {
    it('should check network connectivity successfully', async () => {
      mockFetch.mockResolvedValue({ ok: true })

      const result = await analyticsStore.checkNetworkConnectivity()

      expect(result).toBe(true)
      expect(analyticsStore.networkOnline).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/health/ping'),
        expect.objectContaining({
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' }
        })
      )
    })

    it('should handle network connectivity failure', async () => {
      mockFetch.mockResolvedValue({ ok: false })

      const result = await analyticsStore.checkNetworkConnectivity()

      expect(result).toBe(false)
      expect(analyticsStore.networkOnline).toBe(false)
    })

    it('should handle network request error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const result = await analyticsStore.checkNetworkConnectivity()

      expect(result).toBe(false)
      expect(analyticsStore.networkOnline).toBe(false)
    })

    it('should use correct API URL', async () => {
      mockFetch.mockResolvedValue({ ok: true })

      await analyticsStore.checkNetworkConnectivity()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:3001/api/health/ping'),
        expect.any(Object)
      )
    })
  })

  describe('Socket Event Listeners', () => {
    beforeEach(() => {
      analyticsStore.initializeSocketListeners()
    })

    it('should set up socket event listeners', () => {
      expect(mockSocket.on).toHaveBeenCalledWith(
        'connect',
        expect.any(Function)
      )
      expect(mockSocket.on).toHaveBeenCalledWith(
        'disconnect',
        expect.any(Function)
      )
      expect(mockSocket.on).toHaveBeenCalledWith(
        'analytics-update',
        expect.any(Function)
      )
      expect(mockSocket.on).toHaveBeenCalledWith(
        'notification',
        expect.any(Function)
      )
      expect(mockSocket.on).toHaveBeenCalledWith(
        'task-update',
        expect.any(Function)
      )
    })

    it('should handle connect event', () => {
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )[1]

      connectHandler()

      expect(analyticsStore.connected).toBe(true)
      expect(mockSocket.emit).toHaveBeenCalledWith('join-analytics')
      expect(mockSocket.emit).toHaveBeenCalledWith('request-analytics')
    })

    it('should handle disconnect event', () => {
      analyticsStore.connected = true
      const disconnectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'disconnect'
      )[1]

      disconnectHandler('server disconnect')

      expect(analyticsStore.connected).toBe(false)
    })

    it('should handle analytics-update event', () => {
      const updateHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'analytics-update'
      )[1]

      updateHandler(mockAnalyticsData)

      expect(analyticsStore.analytics).toEqual(mockAnalyticsData)
    })

    it('should handle analytics-error event', () => {
      const errorHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'analytics-error'
      )[1]
      const error = { message: 'Analytics failed' }

      errorHandler(error)

      expect(analyticsStore.notifications).toHaveLength(1)
      expect(analyticsStore.notifications[0].message).toBe('Analytics failed')
      expect(analyticsStore.notifications[0].type).toBe('error')
    })

    it('should handle notification event', () => {
      const notificationHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'notification'
      )[1]
      const notification = { message: 'Test notification', type: 'info' }

      notificationHandler(notification)

      expect(analyticsStore.notifications).toHaveLength(1)
      expect(analyticsStore.notifications[0].message).toBe('Test notification')
    })

    it('should handle task-update event', () => {
      mockSocket.connected = true
      const taskUpdateHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'task-update'
      )[1]

      taskUpdateHandler({ action: 'created' })

      expect(mockSocket.emit).toHaveBeenCalledWith('request-analytics')
    })

    it('should handle export-related events', () => {
      mockSocket.connected = true

      // Test export-list-update
      const exportUpdateHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'export-list-update'
      )[1]
      exportUpdateHandler({ action: 'created' })

      // Test export-completed
      const exportCompletedHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'export-completed'
      )[1]
      exportCompletedHandler({ exportId: '123' })

      // Test export-failed
      const exportFailedHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'export-failed'
      )[1]
      exportFailedHandler({ exportId: '123' })

      // Each should trigger analytics request
      expect(mockSocket.emit).toHaveBeenCalledWith('request-analytics')
    })
  })

  describe('Connection Management', () => {
    it('should connect socket', () => {
      mockSocket.connected = false

      analyticsStore.connect()

      expect(mockSocket.connect).toHaveBeenCalledOnce()
    })

    it('should not connect if already connected', () => {
      mockSocket.connected = true

      analyticsStore.connect()

      expect(mockSocket.connect).not.toHaveBeenCalled()
    })

    it('should disconnect socket', () => {
      mockSocket.connected = true

      analyticsStore.disconnect()

      expect(mockSocket.disconnect).toHaveBeenCalledOnce()
    })

    it('should not disconnect if already disconnected', () => {
      mockSocket.connected = false

      analyticsStore.disconnect()

      expect(mockSocket.disconnect).not.toHaveBeenCalled()
    })
  })

  describe('Cleanup', () => {
    beforeEach(() => {
      analyticsStore.initializeSocketListeners()
    })

    it('should remove all socket event listeners', () => {
      analyticsStore.cleanup()

      expect(mockSocket.off).toHaveBeenCalledWith('connect')
      expect(mockSocket.off).toHaveBeenCalledWith('disconnect')
      expect(mockSocket.off).toHaveBeenCalledWith('analytics-update')
      expect(mockSocket.off).toHaveBeenCalledWith('notification')
      expect(mockSocket.off).toHaveBeenCalledWith('task-update')
      expect(mockSocket.off).toHaveBeenCalledWith('export-list-update')
      expect(mockSocket.off).toHaveBeenCalledWith('export-completed')
      expect(mockSocket.off).toHaveBeenCalledWith('export-failed')
    })

    it('should stop connection checking', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      analyticsStore.cleanup()

      expect(clearIntervalSpy).toHaveBeenCalled()
    })
  })

  describe('Connection Checking', () => {
    it('should start connection checking', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval')

      analyticsStore.startConnectionChecking()

      expect(window.addEventListener).toHaveBeenCalledWith(
        'online',
        expect.any(Function)
      )
      expect(window.addEventListener).toHaveBeenCalledWith(
        'offline',
        expect.any(Function)
      )
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000)
    })

    it('should stop connection checking', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')
      analyticsStore.connectionCheckInterval = 123

      analyticsStore.stopConnectionChecking()

      expect(clearIntervalSpy).toHaveBeenCalledWith(123)
      expect(analyticsStore.connectionCheckInterval).toBe(null)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing error message in analytics-error', () => {
      analyticsStore.initializeSocketListeners()
      const errorHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'analytics-error'
      )[1]

      errorHandler({})

      expect(analyticsStore.notifications[0].message).toBe(
        'Failed to update analytics'
      )
    })

    it('should handle socket events when not connected', () => {
      mockSocket.connected = false
      const taskUpdateHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'task-update'
      )[1]

      // Should not throw error
      expect(() => taskUpdateHandler({ action: 'created' })).not.toThrow()
    })
  })
})
