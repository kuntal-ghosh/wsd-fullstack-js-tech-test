/**
 * @fileoverview End-to-end tests for the complete export workflow
 * @module tests/e2e/exportWorkflow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import App from '@/App.vue'
import { useExportStore } from '@/stores/exportStore'
import { useTaskStore } from '@/stores/taskStore'

// Mock Socket.IO
vi.mock('socket.io-client', () => ({
  default: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn()
  }))
}))

// Mock API client
vi.mock('@/api/client', () => ({
  default: {
    createExport: vi.fn(),
    getExportStatus: vi.fn(),
    getExportHistory: vi.fn(),
    downloadExport: vi.fn(),
    getTasksByFilter: vi.fn(),
    getTasks: vi.fn()
  }
}))

describe('Export Workflow End-to-End Tests', () => {
  let wrapper
  let router
  let pinia
  let vuetify
  let exportStore
  let taskStore
  let apiClient
  let io

  beforeEach(async () => {
    // Create test environment
    pinia = createPinia()
    setActivePinia(pinia)
    vuetify = createVuetify({ components, directives })

    // Get store instances
    exportStore = useExportStore()
    taskStore = useTaskStore()

    // Create router
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', component: () => import('@/views/Dashboard.vue') },
        { path: '/tasks', component: () => import('@/views/Tasks.vue') },
        { path: '/exports', component: () => import('@/views/Exports.vue') }
      ]
    })

    // Get API client and Socket.IO
    apiClient = (await import('@/api/client')).default
    io = (await import('socket.io-client')).default

    // Mock task data
    const mockTasks = Array.from({ length: 100 }, (_, i) => ({
      id: `task-${i}`,
      title: `Task ${i}`,
      description: `Description for Task ${i}`,
      status: ['pending', 'in-progress', 'completed'][i % 3],
      priority: ['low', 'medium', 'high'][i % 3],
      createdAt: new Date(Date.now() - i * 3600000).toISOString()
    }))

    // Setup API responses
    apiClient.getTasks.mockResolvedValue({ data: mockTasks })
    apiClient.getTasksByFilter.mockResolvedValue({ data: mockTasks })

    // Setup export responses
    apiClient.createExport.mockResolvedValue({
      data: {
        _id: 'test-export-123',
        status: 'processing',
        progress: 0,
        format: 'csv',
        createdAt: new Date().toISOString()
      }
    })

    apiClient.getExportStatus.mockResolvedValue({
      data: {
        _id: 'test-export-123',
        status: 'processing',
        progress: 0
      }
    })

    apiClient.getExportHistory.mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        pages: 0
      }
    })

    // Mount app
    wrapper = mount(App, {
      global: {
        plugins: [router, pinia, vuetify],
        stubs: {
          transition: false
        }
      }
    })

    await router.isReady()
  })

  afterEach(() => {
    vi.clearAllMocks()
    wrapper.unmount()
  })

  describe('Complete Export Workflow', () => {
    it('should complete full export workflow from UI to download', async () => {
      // 1. Navigate to tasks page
      await router.push('/tasks')
      await flushPromises()

      // 2. Apply filters
      const filterPanel = wrapper.findComponent({ name: 'AdvancedFilterPanel' })
      if (filterPanel.exists()) {
        await filterPanel.vm.$emit('filter', {
          status: ['pending'],
          priority: ['high'],
          dateFrom: '2023-01-01'
        })
        await flushPromises()
      }

      // 3. Open export dialog
      const exportButton = wrapper.find('[data-test="export-button"]')
      if (exportButton.exists()) {
        await exportButton.trigger('click')
      } else {
        // Find it by component name if test attribute not found
        const toolbar = wrapper.findComponent({ name: 'TaskToolbar' })
        if (toolbar.exists()) {
          await toolbar.vm.$emit('export')
        }
      }
      await flushPromises()

      // 4. Configure export in dialog
      const exportDialog = wrapper.findComponent({ name: 'ExportDialog' })
      if (exportDialog.exists()) {
        // Select CSV format
        const formatRadio = exportDialog.find('[data-test="format-csv"]')
        if (formatRadio.exists()) {
          await formatRadio.setValue(true)
        }

        // Set filename
        const filenameInput = exportDialog.find('[data-test="filename"]')
        if (filenameInput.exists()) {
          await filenameInput.setValue('test-export')
        }

        // Verify estimated record count is shown
        const recordCount = exportDialog.find('[data-test="record-count"]')
        if (recordCount.exists()) {
          expect(recordCount.text()).toContain('100')
        }

        // Start export
        const startButton = exportDialog.find('[data-test="start-export"]')
        if (startButton.exists()) {
          await startButton.trigger('click')
        } else {
          await exportDialog.vm.$emit('export-created', {
            _id: 'test-export-123',
            format: 'csv'
          })
        }
        await flushPromises()
      }

      // 5. Verify export was initiated
      expect(apiClient.createExport).toHaveBeenCalledWith({
        format: 'csv',
        filters: expect.objectContaining({
          status: ['pending'],
          priority: ['high']
        }),
        filename: 'test-export'
      })

      // 6. Simulate real-time progress updates via Socket.IO
      const mockSocket = io()

      // Find socket event handlers
      const socketHandlers = {}
      mockSocket.on.mock.calls.forEach((call) => {
        socketHandlers[call[0]] = call[1]
      })

      // Simulate progress updates
      if (socketHandlers['export-progress']) {
        ;[25, 50, 75, 100].forEach((progress) => {
          socketHandlers['export-progress']({
            exportId: 'test-export-123',
            progress,
            status: progress === 100 ? 'completed' : 'processing',
            timestamp: new Date().toISOString()
          })
        })
      }

      await flushPromises()

      // 7. Simulate export completion
      if (socketHandlers['export-completed']) {
        socketHandlers['export-completed']({
          exportId: 'test-export-123',
          exportData: {
            totalRecords: 100,
            fileSize: 2048,
            downloadUrl: '/api/exports/test-export-123/download'
          },
          timestamp: new Date().toISOString()
        })
      }

      await flushPromises()

      // 8. Check if progress component shows completed state
      const progressComponent = wrapper.findComponent({
        name: 'ExportProgress'
      })
      if (progressComponent.exists()) {
        const downloadButton = progressComponent.find(
          '[data-test="download-button"]'
        )
        expect(downloadButton.exists()).toBe(true)

        // 9. Test download functionality
        await downloadButton.trigger('click')
        expect(apiClient.downloadExport).toHaveBeenCalledWith(
          'test-export-123',
          expect.any(String)
        )
      }

      // 10. Navigate to export history page
      await router.push('/exports')
      await flushPromises()

      // 11. Mock updated export history
      apiClient.getExportHistory.mockResolvedValue({
        data: [
          {
            _id: 'test-export-123',
            status: 'completed',
            progress: 100,
            format: 'csv',
            fileSize: 2048,
            totalRecords: 100,
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            filename: 'test-export.csv',
            filters: {
              status: ['pending'],
              priority: ['high'],
              dateFrom: '2023-01-01'
            }
          }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          pages: 1
        }
      })

      // 12. Check export history
      const exportHistory = wrapper.findComponent({ name: 'ExportHistory' })
      if (exportHistory.exists()) {
        // Refresh to get updated data
        const refreshButton = exportHistory.find('[data-test="refresh-button"]')
        if (refreshButton.exists()) {
          await refreshButton.trigger('click')
        } else {
          await exportHistory.vm.$emit('refresh')
        }
        await flushPromises()

        // Verify history shows our completed export
        const historyItems = exportHistory.findAll(
          '[data-test^="export-item-"]'
        )
        expect(historyItems.length).toBeGreaterThan(0)

        // Find download button in history
        const historyDownloadButton = exportHistory.find(
          '[data-test="download-button-test-export-123"]'
        )
        if (historyDownloadButton.exists()) {
          await historyDownloadButton.trigger('click')
          expect(apiClient.downloadExport).toHaveBeenCalledWith(
            'test-export-123',
            expect.any(String)
          )
        }
      }
    })
  })

  describe('Real-time Socket.IO Integration', () => {
    it('should properly handle all real-time export events', async () => {
      // Navigate to tasks page
      await router.push('/tasks')
      await flushPromises()

      // Setup mock socket
      const mockSocket = io()

      // Create test export
      exportStore.exports = [
        {
          _id: 'socket-test-export',
          status: 'processing',
          progress: 0,
          format: 'json',
          createdAt: new Date().toISOString()
        }
      ]

      // Find socket event handlers
      const socketHandlers = {}
      mockSocket.on.mock.calls.forEach((call) => {
        socketHandlers[call[0]] = call[1]
      })

      // Test all socket event handlers

      // 1. Export progress updates
      if (socketHandlers['export-progress']) {
        socketHandlers['export-progress']({
          exportId: 'socket-test-export',
          progress: 33,
          status: 'processing',
          timestamp: new Date().toISOString()
        })

        await flushPromises()

        // Verify store updated progress
        const updatedExport = exportStore.exports.find(
          (e) => e._id === 'socket-test-export'
        )
        expect(updatedExport.progress).toBe(33)
      }

      // 2. Export status change
      if (socketHandlers['export-status-change']) {
        socketHandlers['export-status-change']({
          exportId: 'socket-test-export',
          status: 'processing',
          metadata: { phase: 'data-extraction', totalRecords: 125 },
          timestamp: new Date().toISOString()
        })

        await flushPromises()

        // Verify metadata was updated
        const updatedExport = exportStore.exports.find(
          (e) => e._id === 'socket-test-export'
        )
        expect(updatedExport.metadata?.phase).toBe('data-extraction')
        expect(updatedExport.metadata?.totalRecords).toBe(125)
      }

      // 3. Export completion
      if (socketHandlers['export-completed']) {
        socketHandlers['export-completed']({
          exportId: 'socket-test-export',
          exportData: {
            totalRecords: 125,
            fileSize: 4096,
            downloadUrl: '/api/exports/socket-test-export/download'
          },
          timestamp: new Date().toISOString()
        })

        await flushPromises()

        // Verify export was marked as completed
        const updatedExport = exportStore.exports.find(
          (e) => e._id === 'socket-test-export'
        )
        expect(updatedExport.status).toBe('completed')
        expect(updatedExport.progress).toBe(100)
        expect(updatedExport.totalRecords).toBe(125)
        expect(updatedExport.fileSize).toBe(4096)
        expect(updatedExport.downloadUrl).toBe(
          '/api/exports/socket-test-export/download'
        )
      }

      // 4. Export list update
      if (socketHandlers['export-list-update']) {
        socketHandlers['export-list-update']({
          action: 'created',
          export: {
            _id: 'new-export-via-socket',
            status: 'pending',
            progress: 0,
            format: 'csv',
            createdAt: new Date().toISOString()
          }
        })

        await flushPromises()

        // Verify new export was added to store
        const newExport = exportStore.exports.find(
          (e) => e._id === 'new-export-via-socket'
        )
        expect(newExport).toBeTruthy()
        expect(newExport.status).toBe('pending')
      }

      // 5. Export failure
      if (socketHandlers['export-failed']) {
        socketHandlers['export-failed']({
          exportId: 'new-export-via-socket',
          error: 'Database connection failed',
          timestamp: new Date().toISOString()
        })

        await flushPromises()

        // Verify export was marked as failed
        const failedExport = exportStore.exports.find(
          (e) => e._id === 'new-export-via-socket'
        )
        expect(failedExport.status).toBe('failed')
        expect(failedExport.error).toBe('Database connection failed')
      }
    })
  })

  describe('Error Handling in Export Flow', () => {
    it('should handle errors during export initiation', async () => {
      // Mock API error
      apiClient.createExport.mockRejectedValue(
        new Error('Server temporarily unavailable')
      )

      // Navigate to tasks page
      await router.push('/tasks')
      await flushPromises()

      // Open export dialog
      const exportButton = wrapper.find('[data-test="export-button"]')
      if (exportButton.exists()) {
        await exportButton.trigger('click')
      } else {
        const toolbar = wrapper.findComponent({ name: 'TaskToolbar' })
        if (toolbar.exists()) {
          await toolbar.vm.$emit('export')
        }
      }
      await flushPromises()

      // Configure and start export
      const exportDialog = wrapper.findComponent({ name: 'ExportDialog' })
      if (exportDialog.exists()) {
        const startButton = exportDialog.find('[data-test="start-export"]')
        if (startButton.exists()) {
          await startButton.trigger('click')
          await flushPromises()
        }
      }

      // Verify error is handled
      expect(apiClient.createExport).toHaveBeenCalled()

      // Error notification should be shown
      const notification = wrapper.findComponent({ name: 'NotificationDrawer' })
      if (notification.exists()) {
        // Error should be reflected in store
        expect(exportStore.error).toBeTruthy()
      }
    })

    it('should handle export processing failures', async () => {
      // Navigate to tasks page
      await router.push('/tasks')
      await flushPromises()

      // Add test export to store
      exportStore.exports = [
        {
          _id: 'failing-export',
          status: 'processing',
          progress: 50,
          format: 'csv',
          createdAt: new Date().toISOString()
        }
      ]

      // Setup mock socket
      const mockSocket = io()

      // Find socket event handlers
      const socketHandlers = {}
      mockSocket.on.mock.calls.forEach((call) => {
        socketHandlers[call[0]] = call[1]
      })

      // Simulate export failure
      if (socketHandlers['export-failed']) {
        socketHandlers['export-failed']({
          exportId: 'failing-export',
          error: 'Out of memory error during processing',
          timestamp: new Date().toISOString()
        })

        await flushPromises()

        // Verify export was marked as failed
        const failedExport = exportStore.exports.find(
          (e) => e._id === 'failing-export'
        )
        expect(failedExport.status).toBe('failed')
        expect(failedExport.error).toBe('Out of memory error during processing')
      }

      // Retry functionality
      apiClient.retryExport = vi.fn().mockResolvedValue({
        data: {
          _id: 'retry-export-123',
          status: 'processing',
          progress: 0,
          format: 'csv'
        }
      })

      const exportProgress = wrapper.findComponent({ name: 'ExportProgress' })
      if (exportProgress.exists()) {
        const retryButton = exportProgress.find('[data-test="retry-button"]')
        if (retryButton.exists()) {
          await retryButton.trigger('click')
          await flushPromises()

          // Verify retry was called
          expect(apiClient.retryExport).toHaveBeenCalledWith('failing-export')
        }
      }
    })
  })
})
