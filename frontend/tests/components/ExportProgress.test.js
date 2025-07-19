/**
 * @fileoverview Unit tests for ExportProgress component
 * @module tests/components/ExportProgress.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { createPinia, setActivePinia } from 'pinia'

// Import the component that will be created later
// The component doesn't exist yet (TDD approach)
const ExportProgress = {
  name: 'ExportProgress',
  template: '<div></div>'
}

// Mock the store
vi.mock('../../src/stores/exportStore', () => ({
  useExportStore: vi.fn(() => ({
    downloadExport: vi.fn().mockResolvedValue({}),
    cancelExport: vi.fn().mockResolvedValue({}),
    retryExport: vi.fn().mockResolvedValue({}),
    downloadProgress: {},
    exports: []
  }))
}))

// Create Vuetify instance for testing
const vuetify = createVuetify({
  components,
  directives
})

describe('ExportProgress', () => {
  let wrapper
  let pinia
  
  // Sample export data for testing
  const defaultProps = {
    exportId: 'export-123',
    showActions: true
  }
  
  const mockExportData = {
    _id: 'export-123',
    format: 'csv',
    status: 'processing',
    progress: 45,
    createdAt: '2024-01-01T10:00:00Z',
    filename: 'task-export.csv',
    totalRecords: 100,
    fileSize: 5120, // 5KB
    error: null
  }
  
  const createWrapper = (props = {}, exportData = mockExportData) => {
    // Mock the store to return our test export
    vi.mocked(useExportStore).mockImplementation(() => ({
      downloadExport: vi.fn().mockResolvedValue({}),
      cancelExport: vi.fn().mockResolvedValue({}),
      retryExport: vi.fn().mockResolvedValue({}),
      downloadProgress: {},
      exports: [exportData],
      getExportById: vi.fn((id) => exportData._id === id ? exportData : null)
    }))
    
    return mount(ExportProgress, {
      props: { ...defaultProps, ...props },
      global: {
        plugins: [vuetify, pinia]
      }
    })
  }
  
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
  })
  
  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })
  
  describe('Export Status and Progress Display', () => {
    it('should display export format and filename', () => {
      wrapper = createWrapper()
      
      expect(wrapper.find('[data-test="export-format"]').text()).toContain('CSV')
      expect(wrapper.find('[data-test="export-filename"]').text()).toContain('task-export.csv')
    })
    
    it('should show the correct progress percentage', () => {
      wrapper = createWrapper()
      
      const progressText = wrapper.find('[data-test="progress-text"]')
      expect(progressText.text()).toContain('45%')
      
      const progressBar = wrapper.find('[data-test="progress-bar"]')
      expect(progressBar.attributes('aria-valuenow')).toBe('45')
    })
    
    it('should display progress bar with the correct status color', async () => {
      // Test processing status
      wrapper = createWrapper({}, { ...mockExportData, status: 'processing' })
      expect(wrapper.find('[data-test="progress-bar"]').classes()).toContain('bg-primary')
      
      // Test completed status
      wrapper = createWrapper({}, { ...mockExportData, status: 'completed', progress: 100 })
      expect(wrapper.find('[data-test="progress-bar"]').classes()).toContain('bg-success')
      
      // Test failed status
      wrapper = createWrapper({}, { ...mockExportData, status: 'failed', error: 'Export failed' })
      expect(wrapper.find('[data-test="progress-bar"]').classes()).toContain('bg-error')
    })
    
    it('should show appropriate status text', () => {
      // Test processing status
      wrapper = createWrapper({}, { ...mockExportData, status: 'processing' })
      expect(wrapper.find('[data-test="status-text"]').text()).toContain('Processing')
      
      // Test completed status
      wrapper = createWrapper({}, { ...mockExportData, status: 'completed', progress: 100 })
      expect(wrapper.find('[data-test="status-text"]').text()).toContain('Completed')
      
      // Test failed status
      wrapper = createWrapper({}, { ...mockExportData, status: 'failed', error: 'Export failed' })
      expect(wrapper.find('[data-test="status-text"]').text()).toContain('Failed')
    })
    
    it('should show file size and record count when available', () => {
      wrapper = createWrapper()
      
      const metadataText = wrapper.find('[data-test="export-metadata"]')
      expect(metadataText.text()).toContain('5KB')
      expect(metadataText.text()).toContain('100 records')
    })
    
    it('should handle missing metadata gracefully', () => {
      wrapper = createWrapper({}, {
        _id: 'export-123',
        format: 'csv',
        status: 'processing',
        progress: 30
      })
      
      const metadataText = wrapper.find('[data-test="export-metadata"]')
      expect(metadataText.exists()).toBe(true)
      // Should not display "undefined" or cause errors
      expect(metadataText.text()).not.toContain('undefined')
      expect(metadataText.text()).not.toContain('null')
    })
  })
  
  describe('Real-time Progress Updates via Socket.IO', () => {
    it('should update progress bar when export progress changes', async () => {
      wrapper = createWrapper()
      
      expect(wrapper.find('[data-test="progress-bar"]').attributes('aria-valuenow')).toBe('45')
      expect(wrapper.find('[data-test="progress-text"]').text()).toContain('45%')
      
      // Simulate progress update
      await wrapper.setProps({
        exportData: { ...mockExportData, progress: 75 }
      })
      
      expect(wrapper.find('[data-test="progress-bar"]').attributes('aria-valuenow')).toBe('75')
      expect(wrapper.find('[data-test="progress-text"]').text()).toContain('75%')
    })
    
    it('should update status when export status changes', async () => {
      wrapper = createWrapper()
      
      expect(wrapper.find('[data-test="status-text"]').text()).toContain('Processing')
      
      // Simulate status update
      await wrapper.setProps({
        exportData: { ...mockExportData, status: 'completed', progress: 100 }
      })
      
      expect(wrapper.find('[data-test="status-text"]').text()).toContain('Completed')
      expect(wrapper.find('[data-test="progress-bar"]').attributes('aria-valuenow')).toBe('100')
    })
    
    it('should update UI elements when export is complete', async () => {
      wrapper = createWrapper()
      
      // Initially no download button
      expect(wrapper.find('[data-test="download-button"]').exists()).toBe(false)
      
      // Simulate completion
      await wrapper.setProps({
        exportData: { ...mockExportData, status: 'completed', progress: 100 }
      })
      
      // Download button should appear
      expect(wrapper.find('[data-test="download-button"]').exists()).toBe(true)
    })
    
    it('should update UI when export fails', async () => {
      wrapper = createWrapper()
      
      // Initially no error message
      expect(wrapper.find('[data-test="error-message"]').exists()).toBe(false)
      
      // Simulate failure
      await wrapper.setProps({
        exportData: { 
          ...mockExportData, 
          status: 'failed', 
          progress: 45, 
          error: 'Database connection error' 
        }
      })
      
      // Error message should appear
      expect(wrapper.find('[data-test="error-message"]').exists()).toBe(true)
      expect(wrapper.find('[data-test="error-message"]').text()).toContain('Database connection error')
      
      // Retry button should appear
      expect(wrapper.find('[data-test="retry-button"]').exists()).toBe(true)
    })
  })
  
  describe('Download Button Functionality', () => {
    it('should show download button only for completed exports', () => {
      // Processing export - no download button
      wrapper = createWrapper({}, { ...mockExportData, status: 'processing' })
      expect(wrapper.find('[data-test="download-button"]').exists()).toBe(false)
      
      // Completed export - show download button
      wrapper = createWrapper({}, { ...mockExportData, status: 'completed', progress: 100 })
      expect(wrapper.find('[data-test="download-button"]').exists()).toBe(true)
      
      // Failed export - no download button
      wrapper = createWrapper({}, { ...mockExportData, status: 'failed' })
      expect(wrapper.find('[data-test="download-button"]').exists()).toBe(false)
    })
    
    it('should call downloadExport when download button is clicked', async () => {
      const exportStore = useExportStore()
      
      wrapper = createWrapper({}, { ...mockExportData, status: 'completed', progress: 100 })
      
      const downloadButton = wrapper.find('[data-test="download-button"]')
      await downloadButton.trigger('click')
      
      expect(exportStore.downloadExport).toHaveBeenCalledWith(
        'export-123', 
        'task-export.csv'
      )
    })
    
    it('should show download progress when downloading', async () => {
      const exportStore = useExportStore()
      exportStore.downloadProgress = {
        'export-123': { progress: 50, downloading: true }
      }
      
      wrapper = createWrapper({}, { ...mockExportData, status: 'completed', progress: 100 })
      
      const downloadProgress = wrapper.find('[data-test="download-progress"]')
      expect(downloadProgress.exists()).toBe(true)
      expect(downloadProgress.text()).toContain('50%')
      
      // Download button should be disabled during download
      const downloadButton = wrapper.find('[data-test="download-button"]')
      expect(downloadButton.attributes('disabled')).toBeDefined()
    })
    
    it('should handle download errors', async () => {
      const exportStore = useExportStore()
      exportStore.downloadProgress = {
        'export-123': { error: 'Download failed', downloading: false }
      }
      
      wrapper = createWrapper({}, { ...mockExportData, status: 'completed', progress: 100 })
      
      const downloadError = wrapper.find('[data-test="download-error"]')
      expect(downloadError.exists()).toBe(true)
      expect(downloadError.text()).toContain('Download failed')
      
      // Download button should be enabled to retry
      const downloadButton = wrapper.find('[data-test="download-button"]')
      expect(downloadButton.attributes('disabled')).toBeUndefined()
    })
  })
  
  describe('Export Status Indicators with Colors', () => {
    it('should apply appropriate colors to status indicators', () => {
      // Processing status
      wrapper = createWrapper({}, { ...mockExportData, status: 'processing' })
      expect(wrapper.find('[data-test="status-chip"]').classes()).toContain('bg-primary')
      expect(wrapper.find('[data-test="status-icon"]').text()).toContain('mdi-sync')
      
      // Completed status
      wrapper = createWrapper({}, { ...mockExportData, status: 'completed' })
      expect(wrapper.find('[data-test="status-chip"]').classes()).toContain('bg-success')
      expect(wrapper.find('[data-test="status-icon"]').text()).toContain('mdi-check')
      
      // Failed status
      wrapper = createWrapper({}, { ...mockExportData, status: 'failed' })
      expect(wrapper.find('[data-test="status-chip"]').classes()).toContain('bg-error')
      expect(wrapper.find('[data-test="status-icon"]').text()).toContain('mdi-alert')
    })
    
    it('should animate the progress icon for processing exports', () => {
      wrapper = createWrapper({}, { ...mockExportData, status: 'processing' })
      expect(wrapper.find('[data-test="status-icon"]').classes()).toContain('rotating')
    })
    
    it('should show the correct status color based on current status', () => {
      const statusColors = {
        processing: 'primary',
        completed: 'success',
        failed: 'error',
        cancelled: 'grey'
      }
      
      // Test all status colors
      for (const [status, color] of Object.entries(statusColors)) {
        wrapper = createWrapper({}, { ...mockExportData, status })
        expect(wrapper.vm.getStatusColor(status)).toBe(color)
      }
    })
  })
  
  describe('Export Failure States with Error Messages', () => {
    it('should display error message when export fails', () => {
      const errorMessage = 'Failed to generate export: Database error'
      
      wrapper = createWrapper({}, { 
        ...mockExportData, 
        status: 'failed', 
        error: errorMessage 
      })
      
      const errorDisplay = wrapper.find('[data-test="error-message"]')
      expect(errorDisplay.exists()).toBe(true)
      expect(errorDisplay.text()).toContain(errorMessage)
    })
    
    it('should show a retry button for failed exports', async () => {
      const exportStore = useExportStore()
      
      wrapper = createWrapper({}, { 
        ...mockExportData, 
        status: 'failed', 
        error: 'Export failed' 
      })
      
      const retryButton = wrapper.find('[data-test="retry-button"]')
      expect(retryButton.exists()).toBe(true)
      
      await retryButton.trigger('click')
      expect(exportStore.retryExport).toHaveBeenCalledWith('export-123')
    })
    
    it('should handle different error scenarios with appropriate messages', () => {
      // Test timeout error
      wrapper = createWrapper({}, {
        ...mockExportData,
        status: 'failed',
        error: 'Export timed out after 30 seconds'
      })
      expect(wrapper.find('[data-test="error-message"]').text())
        .toContain('Export timed out after 30 seconds')
      
      // Test permissions error
      wrapper = createWrapper({}, {
        ...mockExportData,
        status: 'failed',
        error: 'Insufficient permissions to export data'
      })
      expect(wrapper.find('[data-test="error-message"]').text())
        .toContain('Insufficient permissions to export data')
    })
    
    it('should emit error event when showing error state', async () => {
      wrapper = createWrapper({}, { 
        ...mockExportData, 
        status: 'failed', 
        error: 'Export failed' 
      })
      
      expect(wrapper.emitted('error')).toBeTruthy()
      expect(wrapper.emitted('error')[0][0]).toEqual({
        exportId: 'export-123',
        error: 'Export failed'
      })
    })
  })
  
  describe('Action Buttons', () => {
    it('should show cancel button for processing exports', async () => {
      const exportStore = useExportStore()
      
      wrapper = createWrapper({}, { ...mockExportData, status: 'processing' })
      
      const cancelButton = wrapper.find('[data-test="cancel-button"]')
      expect(cancelButton.exists()).toBe(true)
      
      await cancelButton.trigger('click')
      expect(exportStore.cancelExport).toHaveBeenCalledWith('export-123')
    })
    
    it('should not show action buttons when showActions is false', () => {
      wrapper = createWrapper({ showActions: false }, { ...mockExportData, status: 'processing' })
      
      expect(wrapper.find('[data-test="cancel-button"]').exists()).toBe(false)
      
      // For completed export
      wrapper = createWrapper({ showActions: false }, { ...mockExportData, status: 'completed' })
      expect(wrapper.find('[data-test="download-button"]').exists()).toBe(false)
    })
    
    it('should emit events when actions are performed', async () => {
      wrapper = createWrapper({}, { ...mockExportData, status: 'processing' })
      
      const cancelButton = wrapper.find('[data-test="cancel-button"]')
      await cancelButton.trigger('click')
      
      expect(wrapper.emitted('cancel')).toBeTruthy()
      expect(wrapper.emitted('cancel')[0][0]).toBe('export-123')
      
      // For retry action
      wrapper = createWrapper({}, { ...mockExportData, status: 'failed' })
      
      const retryButton = wrapper.find('[data-test="retry-button"]')
      await retryButton.trigger('click')
      
      expect(wrapper.emitted('retry')).toBeTruthy()
      expect(wrapper.emitted('retry')[0][0]).toBe('export-123')
    })
  })
})