/**
 * @fileoverview Unit tests for export store status-specific toast notifications
 * @module tests/stores/exportStore.status-toasts.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useExportStore } from '@/stores/exportStore.js'
import { useToastStore } from '@/stores/toastStore.js'

// Mock the toast store
vi.mock('@/stores/toastStore.js', () => ({
  useToastStore: vi.fn(() => ({
    showInfo: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn()
  }))
}))

// Mock the API client
vi.mock('@/api/client.js', () => ({
  default: {
    baseURL: 'http://localhost:3000/api',
    getExports: vi.fn(),
    createExport: vi.fn(),
    cancelExport: vi.fn(),
    retryExport: vi.fn()
  }
}))

// Mock the socket
vi.mock('@/plugins/socket.js', () => ({
  default: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }
}))

describe('Export Store - Status Toast Notifications', () => {
  let exportStore
  let mockToastStore

  beforeEach(() => {
    setActivePinia(createPinia())
    exportStore = useExportStore()
    mockToastStore = useToastStore()
  })

  describe('showStatusToast', () => {
    it('should show info toast for pending status', () => {
      exportStore.showStatusToast(
        mockToastStore,
        'pending',
        'test-export.csv',
        'export-123',
        { estimatedTime: '2 minutes' }
      )

      expect(mockToastStore.showInfo).toHaveBeenCalledWith(
        'Export "test-export.csv" is queued and waiting to start...',
        expect.objectContaining({
          timeout: 4000,
          actions: expect.arrayContaining([
            expect.objectContaining({ label: 'Cancel' }),
            expect.objectContaining({ label: 'View Queue' })
          ])
        })
      )
    })

    it('should show info toast for processing status with metadata', () => {
      exportStore.showStatusToast(
        mockToastStore,
        'processing',
        'tasks-data.json',
        'export-456',
        { 
          estimatedTime: '1 minute',
          recordCount: 1500
        }
      )

      expect(mockToastStore.showInfo).toHaveBeenCalledWith(
        'Export "tasks-data.json" is now processing... Records: 1500',
        expect.objectContaining({
          timeout: 5000,
          actions: expect.arrayContaining([
            expect.objectContaining({ label: 'View Progress' }),
            expect.objectContaining({ label: 'Cancel' })
          ])
        })
      )
    })

    it('should show success toast for completed status', () => {
      exportStore.showStatusToast(
        mockToastStore,
        'completed',
        'user-data.csv',
        'export-789',
        { 
          fileSize: 2048576 // 2MB
        }
      )

      expect(mockToastStore.showSuccess).toHaveBeenCalledWith(
        'Export "user-data.csv" completed successfully! File size: 2.0 MB',
        expect.objectContaining({
          timeout: 7000,
          actions: expect.arrayContaining([
            expect.objectContaining({ label: 'Download Now' }),
            expect.objectContaining({ label: 'View Details' }),
            expect.objectContaining({ label: 'Share' })
          ])
        })
      )
    })

    it('should show error toast for failed status with retry option', () => {
      exportStore.showStatusToast(
        mockToastStore,
        'failed',
        'large-export.json',
        'export-error',
        { 
          error: 'Database timeout',
          canRetry: true
        }
      )

      expect(mockToastStore.showError).toHaveBeenCalledWith(
        'Export "large-export.json" failed: Database timeout',
        expect.objectContaining({
          actions: expect.arrayContaining([
            expect.objectContaining({ label: 'Retry Export' }),
            expect.objectContaining({ label: 'View Error Details' }),
            expect.objectContaining({ label: 'Create New Export' })
          ])
        })
      )
    })

    it('should show error toast for failed status without retry option', () => {
      exportStore.showStatusToast(
        mockToastStore,
        'failed',
        'critical-export.csv',
        'export-critical-error',
        { 
          error: 'Critical system error',
          canRetry: false
        }
      )

      expect(mockToastStore.showError).toHaveBeenCalledWith(
        'Export "critical-export.csv" failed: Critical system error',
        expect.objectContaining({
          actions: expect.not.arrayContaining([
            expect.objectContaining({ label: 'Retry Export' })
          ])
        })
      )
    })

    it('should show warning toast for cancelled status', () => {
      exportStore.showStatusToast(
        mockToastStore,
        'cancelled',
        'cancelled-export.json',
        'export-cancelled'
      )

      expect(mockToastStore.showWarning).toHaveBeenCalledWith(
        'Export "cancelled-export.json" was cancelled',
        expect.objectContaining({
          timeout: 4000,
          actions: expect.arrayContaining([
            expect.objectContaining({ label: 'Create New' }),
            expect.objectContaining({ label: 'View History' })
          ])
        })
      )
    })

    it('should show generic info toast for unknown status', () => {
      exportStore.showStatusToast(
        mockToastStore,
        'unknown-status',
        'test-export.csv',
        'export-unknown'
      )

      expect(mockToastStore.showInfo).toHaveBeenCalledWith(
        'Export "test-export.csv" status updated to: unknown-status',
        expect.objectContaining({
          timeout: 3000,
          actions: expect.arrayContaining([
            expect.objectContaining({ label: 'View Details' })
          ])
        })
      )
    })

    it('should format file sizes correctly', () => {
      // Test KB formatting
      exportStore.showStatusToast(
        mockToastStore,
        'completed',
        'small-file.csv',
        'export-small',
        { fileSize: 1536 } // 1.5 KB
      )

      expect(mockToastStore.showSuccess).toHaveBeenCalledWith(
        expect.stringContaining('File size: 1.5 KB'),
        expect.any(Object)
      )

      // Test MB formatting
      exportStore.showStatusToast(
        mockToastStore,
        'completed',
        'large-file.json',
        'export-large',
        { fileSize: 3145728 } // 3 MB
      )

      expect(mockToastStore.showSuccess).toHaveBeenCalledWith(
        expect.stringContaining('File size: 3.0 MB'),
        expect.any(Object)
      )
    })
  })

  describe('handleExportStatusChange', () => {
    beforeEach(() => {
      // Add a mock export to the store
      exportStore.exports = [
        {
          _id: 'test-export-123',
          filename: 'test-export.csv',
          status: 'pending',
          metadata: {}
        }
      ]
    })

    it('should update export status and show toast for status change', () => {
      const statusData = {
        exportId: 'test-export-123',
        status: 'processing',
        metadata: { recordCount: 500 },
        timestamp: new Date().toISOString()
      }

      exportStore.handleExportStatusChange(statusData)

      // Check that the export was updated
      expect(exportStore.exports[0].status).toBe('processing')
      expect(exportStore.exports[0].metadata.recordCount).toBe(500)

      // Check that a toast was shown
      expect(mockToastStore.showInfo).toHaveBeenCalledWith(
        expect.stringContaining('processing... Records: 500'),
        expect.any(Object)
      )
    })

    it('should not show toast if status has not changed', () => {
      const statusData = {
        exportId: 'test-export-123',
        status: 'pending', // Same as current status
        metadata: { estimatedTime: '2 minutes' },
        timestamp: new Date().toISOString()
      }

      exportStore.handleExportStatusChange(statusData)

      // Check that the export was updated with new metadata
      expect(exportStore.exports[0].metadata.estimatedTime).toBe('2 minutes')

      // Check that no toast was shown
      expect(mockToastStore.showInfo).not.toHaveBeenCalled()
      expect(mockToastStore.showSuccess).not.toHaveBeenCalled()
      expect(mockToastStore.showError).not.toHaveBeenCalled()
      expect(mockToastStore.showWarning).not.toHaveBeenCalled()
    })

    it('should handle non-existent export gracefully', () => {
      const statusData = {
        exportId: 'non-existent-export',
        status: 'processing',
        metadata: {},
        timestamp: new Date().toISOString()
      }

      expect(() => {
        exportStore.handleExportStatusChange(statusData)
      }).not.toThrow()

      // No toast should be shown for non-existent export
      expect(mockToastStore.showInfo).not.toHaveBeenCalled()
    })
  })

  describe('action button callbacks', () => {
    it('should call appropriate store methods when action buttons are clicked', () => {
      const cancelSpy = vi.spyOn(exportStore, 'cancelExport').mockResolvedValue()
      const retrySpy = vi.spyOn(exportStore, 'retryExport').mockResolvedValue({})
      const downloadSpy = vi.spyOn(exportStore, 'downloadExport').mockResolvedValue()

      // Test cancel action
      exportStore.showStatusToast(
        mockToastStore,
        'pending',
        'test.csv',
        'export-123'
      )

      const cancelAction = mockToastStore.showInfo.mock.calls[0][1].actions.find(
        action => action.label === 'Cancel'
      )
      cancelAction.handler()
      expect(cancelSpy).toHaveBeenCalledWith('export-123')

      // Test retry action
      exportStore.showStatusToast(
        mockToastStore,
        'failed',
        'test.csv',
        'export-456',
        { error: 'Test error', canRetry: true }
      )

      const retryAction = mockToastStore.showError.mock.calls[0][1].actions.find(
        action => action.label === 'Retry Export'
      )
      retryAction.handler()
      expect(retrySpy).toHaveBeenCalledWith('export-456')

      // Test download action
      exportStore.showStatusToast(
        mockToastStore,
        'completed',
        'test.csv',
        'export-789',
        { fileSize: 1024 }
      )

      const downloadAction = mockToastStore.showSuccess.mock.calls[0][1].actions.find(
        action => action.label === 'Download Now'
      )
      downloadAction.handler()
      expect(downloadSpy).toHaveBeenCalledWith('export-789', 'test.csv')
    })
  })
})
