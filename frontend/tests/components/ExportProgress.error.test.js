/**
 * @fileoverview Tests for error handling in the ExportProgress component
 * @module tests/components/ExportProgress.error.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import ExportProgress from '@/components/ExportProgress.vue'
import { useExportStore } from '@/stores/exportStore'

// Mock the store
vi.mock('@/stores/exportStore')

describe('ExportProgress Error Handling Tests', () => {
  let wrapper
  let vuetify
  let pinia
  
  const mockExportData = {
    _id: 'export-123',
    status: 'processing',
    progress: 50,
    format: 'csv',
    createdAt: '2023-01-01T10:00:00Z',
    totalRecords: 100,
    fileSize: 5120 // 5KB
  }
  
  beforeEach(() => {
    // Create test vuetify instance
    vuetify = createVuetify({ components, directives })
    
    // Set up pinia
    pinia = createPinia()
    setActivePinia(pinia)
    
    // Mock export store
    vi.mocked(useExportStore).mockReturnValue({
      retryExport: vi.fn(),
      cancelExport: vi.fn(),
      downloadExport: vi.fn(),
      downloadProgress: {},
      error: null
    })
  })
  
  afterEach(() => {
    vi.clearAllMocks()
    wrapper?.unmount()
  })
  
  const createWrapper = (props = {}, exportData = mockExportData) => {
    return mount(ExportProgress, {
      props: {
        export: exportData,
        ...props
      },
      global: {
        plugins: [vuetify, pinia]
      }
    })
  }
  
  describe('Failed Export Display', () => {
    it('should display error message when export fails', () => {
      const errorMessage = 'Database connection timeout'
      
      wrapper = createWrapper({}, { 
        ...mockExportData, 
        status: 'failed', 
        error: errorMessage 
      })
      
      // Check that error state is displayed
      const errorDisplay = wrapper.find('[data-test="error-message"]')
      expect(errorDisplay.exists()).toBe(true)
      expect(errorDisplay.text()).toContain(errorMessage)
      
      // Status should reflect failure
      const statusBadge = wrapper.find('[data-test="status-badge"]')
      expect(statusBadge.exists()).toBe(true)
      expect(statusBadge.classes()).toContain('error')
      expect(statusBadge.text().toLowerCase()).toContain('failed')
    })
    
    it('should display technical error details with user-friendly explanation', () => {
      const technicalError = 'ERR_MONGODB_QUERY_EXEC_ERROR: MongoServerError: Cursor not found'
      
      wrapper = createWrapper({}, { 
        ...mockExportData, 
        status: 'failed', 
        error: technicalError,
        errorDetails: {
          code: 'MONGODB_ERROR',
          timestamp: '2023-01-01T10:05:00Z',
          requestId: '123abc'
        }
      })
      
      // Check for user-friendly error message
      const errorMessage = wrapper.find('[data-test="error-message"]')
      expect(errorMessage.exists()).toBe(true)
      expect(errorMessage.text()).toContain('Database error')
      
      // Technical details should be available but collapsed
      const techDetails = wrapper.find('[data-test="technical-details"]')
      expect(techDetails.exists()).toBe(true)
      
      // Should contain request ID for support reference
      expect(wrapper.text()).toContain('123abc')
    })
    
    it('should categorize errors with appropriate user messages', () => {
      const testCases = [
        { 
          error: 'ECONNREFUSED: Connection refused', 
          expectedMessage: 'connection' 
        },
        { 
          error: 'Timeout exceeded while awaiting headers', 
          expectedMessage: 'timeout'
        },
        { 
          error: 'Disk quota exceeded', 
          expectedMessage: 'storage'
        },
        { 
          error: 'Memory allocation failed', 
          expectedMessage: 'server resources'
        }
      ]
      
      for (const testCase of testCases) {
        wrapper = createWrapper({}, {
          ...mockExportData,
          status: 'failed',
          error: testCase.error
        })
        
        const errorMsg = wrapper.find('[data-test="error-message"]')
        expect(errorMsg.exists()).toBe(true)
        expect(errorMsg.text().toLowerCase()).toContain(testCase.expectedMessage)
      }
    })
  })
  
  describe('Error Actions', () => {
    it('should provide retry option for failed exports', async () => {
      const exportStore = useExportStore()
      
      wrapper = createWrapper({}, { 
        ...mockExportData, 
        status: 'failed', 
        error: 'Export failed' 
      })
      
      // Should have retry button
      const retryButton = wrapper.find('[data-test="retry-button"]')
      expect(retryButton.exists()).toBe(true)
      
      // Click retry button
      await retryButton.trigger('click')
      
      // Should call retry in store
      expect(exportStore.retryExport).toHaveBeenCalledWith('export-123')
    })
    
    it('should show loading state during retry', async () => {
      const exportStore = useExportStore()
      
      // Mock pending promise that won't resolve immediately
      exportStore.retryExport.mockReturnValue(new Promise(() => {}))
      
      wrapper = createWrapper({}, { 
        ...mockExportData, 
        status: 'failed', 
        error: 'Export failed' 
      })
      
      const retryButton = wrapper.find('[data-test="retry-button"]')
      await retryButton.trigger('click')
      await wrapper.vm.$nextTick()
      
      // Button should show loading state
      expect(retryButton.attributes('loading')).toBeDefined()
      expect(retryButton.attributes('disabled')).toBeDefined()
    })
    
    it('should handle retry errors gracefully', async () => {
      const exportStore = useExportStore()
      
      // Mock retry failure
      const retryError = new Error('Retry failed: Resource unavailable')
      exportStore.retryExport.mockRejectedValue(retryError)
      
      wrapper = createWrapper({}, { 
        ...mockExportData, 
        status: 'failed', 
        error: 'Original error' 
      })
      
      // Initial error
      expect(wrapper.find('[data-test="error-message"]').text()).toContain('Original error')
      
      // Attempt retry
      const retryButton = wrapper.find('[data-test="retry-button"]')
      await retryButton.trigger('click')
      await wrapper.vm.$nextTick()
      
      // Should show new error
      const updatedError = wrapper.find('[data-test="retry-error"]')
      expect(updatedError.exists()).toBe(true)
      expect(updatedError.text()).toContain('Retry failed')
    })
    
    it('should emit appropriate events on error actions', async () => {
      const exportStore = useExportStore()
      exportStore.retryExport.mockResolvedValue({ _id: 'export-123', status: 'pending' })
      
      wrapper = createWrapper({}, { 
        ...mockExportData, 
        status: 'failed', 
        error: 'Export failed' 
      })
      
      // Test retry event
      const retryButton = wrapper.find('[data-test="retry-button"]')
      await retryButton.trigger('click')
      
      expect(wrapper.emitted('export-retry')).toBeTruthy()
      expect(wrapper.emitted('export-retry')[0][0]).toEqual('export-123')
    })
  })
  
  describe('Download Error Handling', () => {
    it('should display download errors', async () => {
      const exportStore = useExportStore()
      
      // Mock download error
      const downloadError = new Error('Download failed: Network error')
      exportStore.downloadExport.mockRejectedValue(downloadError)
      
      wrapper = createWrapper({}, { 
        ...mockExportData, 
        status: 'completed', 
        progress: 100 
      })
      
      // Attempt download
      const downloadButton = wrapper.find('[data-test="download-button"]')
      await downloadButton.trigger('click')
      await wrapper.vm.$nextTick()
      
      // Should display download error
      const error = wrapper.find('[data-test="download-error"]')
      expect(error.exists()).toBe(true)
      expect(error.text()).toContain('Download failed')
    })
    
    it('should show progress and handle errors during large file downloads', async () => {
      const exportStore = useExportStore()
      
      // Set up download progress tracking
      exportStore.downloadProgress = {
        'export-123': { 
          progress: 50,
          downloading: true 
        }
      }
      
      wrapper = createWrapper({}, { 
        ...mockExportData, 
        status: 'completed',
        fileSize: 50 * 1024 * 1024 // 50MB
      })
      
      // Should display download progress
      const progressBar = wrapper.find('[data-test="download-progress"]')
      expect(progressBar.exists()).toBe(true)
      
      // Now simulate download error
      exportStore.downloadProgress = {
        'export-123': { 
          progress: 75,
          downloading: false,
          error: 'Connection lost' 
        }
      }
      
      await wrapper.vm.$nextTick()
      
      // Should show download error
      const error = wrapper.find('[data-test="download-error"]')
      expect(error.exists()).toBe(true)
      expect(error.text()).toContain('Connection lost')
      
      // Should allow retry
      const retryDownload = wrapper.find('[data-test="retry-download"]')
      expect(retryDownload.exists()).toBe(true)
    })
    
    it('should handle file not found errors', async () => {
      const exportStore = useExportStore()
      
      // Mock file not found error
      const notFoundError = new Error('File not found')
      notFoundError.status = 404
      exportStore.downloadExport.mockRejectedValue(notFoundError)
      
      wrapper = createWrapper({}, { 
        ...mockExportData, 
        status: 'completed', 
        progress: 100 
      })
      
      // Attempt download
      const downloadButton = wrapper.find('[data-test="download-button"]')
      await downloadButton.trigger('click')
      await wrapper.vm.$nextTick()
      
      // Should show specific file not found message
      const error = wrapper.find('[data-test="download-error"]')
      expect(error.exists()).toBe(true)
      expect(error.text()).toContain('file was not found')
      
      // Should suggest contacting support
      const helpText = wrapper.find('[data-test="help-text"]')
      expect(helpText.exists()).toBe(true)
      expect(helpText.text()).toContain('contact support')
    })
  })
  
  describe('Edge Cases', () => {
    it('should handle missing error messages gracefully', () => {
      wrapper = createWrapper({}, { 
        ...mockExportData, 
        status: 'failed',
        error: '' // Empty error message
      })
      
      // Should display a default error message
      const errorMsg = wrapper.find('[data-test="error-message"]')
      expect(errorMsg.exists()).toBe(true)
      expect(errorMsg.text()).toContain('Unknown error')
    })
    
    it('should handle null export data gracefully', () => {
      // Test with null export
      wrapper = createWrapper({ export: null })
      
      // Should display a helpful message
      const noData = wrapper.find('[data-test="no-export-data"]')
      expect(noData.exists()).toBe(true)
      expect(noData.text()).toContain('No export information')
    })
    
    it('should handle cancelled exports properly', () => {
      wrapper = createWrapper({}, { 
        ...mockExportData, 
        status: 'cancelled',
        cancelledAt: '2023-01-01T10:03:00Z'
      })
      
      // Should indicate cancelled status
      const statusText = wrapper.find('[data-test="status-text"]')
      expect(statusText.exists()).toBe(true)
      expect(statusText.text()).toContain('Cancelled')
      
      // Should not show error but explanation
      expect(wrapper.find('[data-test="error-message"]').exists()).toBe(false)
      expect(wrapper.find('[data-test="cancel-info"]').exists()).toBe(true)
    })
    
    it('should handle exports with missing metadata gracefully', () => {
      wrapper = createWrapper({}, { 
        _id: 'export-123',
        status: 'failed',
        error: 'Export failed',
        // Missing most fields
      })
      
      // Should not throw errors when accessing missing fields
      expect(wrapper.text()).toContain('Export failed')
      
      // Should not show undefined values
      expect(wrapper.text()).not.toContain('undefined')
    })
  })
});