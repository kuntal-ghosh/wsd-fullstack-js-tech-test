/**
 * @fileoverview Tests for error handling in the ExportDialog component
 * @module tests/components/ExportDialog.error.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import ExportDialog from '@/components/ExportDialog.vue'
import { useExportStore } from '@/stores/exportStore'
import { useTaskStore } from '@/stores/taskStore'

// Mock the stores
const mockExportStore = {
  createExport: vi.fn().mockResolvedValue({ id: 'export-123', status: 'processing' }),
  loading: false,
  exports: []
}

const mockTaskStore = {
  tasks: [],
  loading: false
}

vi.mock('@/stores/exportStore', () => ({
  useExportStore: () => mockExportStore
}))

vi.mock('@/stores/taskStore', () => ({
  useTaskStore: () => mockTaskStore
}))

describe('ExportDialog Error Handling Tests', () => {
  let wrapper
  let vuetify
  let pinia

  beforeEach(() => {
    // Create test vuetify instance
    vuetify = createVuetify({ components, directives })

    // Set up pinia
    pinia = createPinia()
    setActivePinia(pinia)

    // Mock stores
    vi.mocked(useExportStore).mockReturnValue({
      createExport: vi.fn(),
      clearError: vi.fn(),
      error: null
    })

    vi.mocked(useTaskStore).mockReturnValue({
      filteredTasks: Array(100).fill({}),
      pagination: {
        total: 100
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    wrapper?.unmount()
  })

  const createWrapper = (props = {}) => {
    return mount(ExportDialog, {
      global: {
        plugins: [vuetify, pinia]
      },
      props: {
        modelValue: true,
        filters: { status: 'pending' },
        ...props
      }
    })
  }

  describe('Validation Error Handling', () => {
    it('should display validation errors for invalid export format', async () => {
      wrapper = createWrapper()

      // Set an invalid format
      wrapper.vm.exportFormat = 'invalid'
      await wrapper.vm.$nextTick()

      // Validate
      const isValid = wrapper.vm.validateExportParams()
      await wrapper.vm.$nextTick()

      // Check for error message
      expect(isValid).toBe(false)
      expect(wrapper.vm.validationErrors.format).toContain(
        'Invalid export format'
      )

      // Check if error is displayed in UI
      const errorText = wrapper.find('[data-test="format-error"]').text()
      expect(errorText).toContain('Invalid export format')
    })

    it('should display validation errors for invalid filename', async () => {
      wrapper = createWrapper()

      // Set an invalid filename (too long)
      const filenameInput = wrapper.find('[data-test="filename"] input')
      await filenameInput.setValue('a'.repeat(256))

      // Validate
      const isValid = wrapper.vm.validateExportParams()
      await wrapper.vm.$nextTick()

      // Check for error message
      expect(isValid).toBe(false)
      expect(wrapper.vm.validationErrors.filename.length).toBeGreaterThan(0)

      // Check if error is displayed in UI
      const errorText = wrapper.find('[data-test="filename-error"]').text()
      expect(errorText).toContain('too long')
    })

    it('should display validation errors for invalid filename characters', async () => {
      wrapper = createWrapper()

      // Set filename with invalid characters
      const filenameInput = wrapper.find('[data-test="filename"] input')
      await filenameInput.setValue('file/with\\invalid:characters?')

      // Validate
      const isValid = wrapper.vm.validateExportParams()
      await wrapper.vm.$nextTick()

      // Check for error message
      expect(isValid).toBe(false)
      expect(wrapper.vm.validationErrors.filename.length).toBeGreaterThan(0)

      // Check if error is displayed in UI
      const errorText = wrapper.find('[data-test="filename-error"]').text()
      expect(errorText).toContain('invalid characters')
    })

    it('should clear validation errors when input becomes valid', async () => {
      wrapper = createWrapper()

      // Set invalid filename
      const filenameInput = wrapper.find('[data-test="filename"] input')
      await filenameInput.setValue('a'.repeat(256))

      // Validate to generate error
      wrapper.vm.validateExportParams()
      await wrapper.vm.$nextTick()

      // Check that error exists
      expect(wrapper.find('[data-test="filename-error"]').exists()).toBe(true)

      // Fix the filename
      await filenameInput.setValue('valid-filename')
      await wrapper.vm.handleFilenameChange()

      // Check that error is cleared
      expect(wrapper.vm.validationErrors.filename).toHaveLength(0)
    })
  })

  describe('API Error Handling', () => {
    it('should display API errors when export creation fails', async () => {
      wrapper = createWrapper()
      const exportStore = useExportStore()

      // Mock API error
      const errorMessage = 'Failed to create export: Server error'
      exportStore.createExport.mockRejectedValue(new Error(errorMessage))

      // Try to create export
      const exportButton = wrapper.find('[data-test="start-export"]')
      await exportButton.trigger('click')
      await wrapper.vm.$nextTick()

      // Check that error is displayed
      expect(wrapper.vm.error).toBe(errorMessage)
      const errorAlert = wrapper.find('[data-test="error-message"]')
      expect(errorAlert.exists()).toBe(true)
      expect(errorAlert.text()).toContain(errorMessage)
    })

    it('should display network errors with user-friendly message', async () => {
      wrapper = createWrapper()
      const exportStore = useExportStore()

      // Mock network error
      exportStore.createExport.mockRejectedValue(new Error('Network Error'))

      // Try to create export
      const exportButton = wrapper.find('[data-test="start-export"]')
      await exportButton.trigger('click')
      await wrapper.vm.$nextTick()

      // Check that user-friendly error is displayed
      const errorAlert = wrapper.find('[data-test="error-message"]')
      expect(errorAlert.exists()).toBe(true)
      expect(errorAlert.text()).toContain('network')
    })

    it('should handle and parse API validation errors', async () => {
      wrapper = createWrapper()
      const exportStore = useExportStore()

      // Mock API validation error with details
      const validationError = new Error('Validation Error')
      validationError.details = [
        { field: 'format', message: 'Invalid export format' },
        { field: 'filters.dateFrom', message: 'Invalid date format' }
      ]
      exportStore.createExport.mockRejectedValue(validationError)

      // Try to create export
      const exportButton = wrapper.find('[data-test="start-export"]')
      await exportButton.trigger('click')
      await wrapper.vm.$nextTick()

      // Check that validation errors are displayed
      const errorAlert = wrapper.find('[data-test="error-message"]')
      expect(errorAlert.exists()).toBe(true)
      expect(errorAlert.text()).toContain('Validation Error')

      // The component should show detailed validation errors
      const errorDetails = wrapper.find('[data-test="error-details"]')
      expect(errorDetails.exists()).toBe(true)
      expect(errorDetails.text()).toContain('Invalid export format')
      expect(errorDetails.text()).toContain('Invalid date format')
    })
  })

  describe('Error State Management', () => {
    it('should close dialog only on successful export', async () => {
      wrapper = createWrapper()
      const exportStore = useExportStore()

      // Mock API error
      exportStore.createExport.mockRejectedValue(new Error('Export failed'))

      // Try to create export
      const exportButton = wrapper.find('[data-test="start-export"]')
      await exportButton.trigger('click')
      await wrapper.vm.$nextTick()

      // Dialog should remain open on error
      expect(wrapper.emitted('update:modelValue')).toBeFalsy()

      // Now mock success
      exportStore.createExport.mockResolvedValue({ id: 'export-123' })

      // Try again
      await exportButton.trigger('click')
      await wrapper.vm.$nextTick()

      // Now dialog should close
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([false])
    })

    it('should clear error state when dialog is reopened', async () => {
      // Start with closed dialog
      wrapper = createWrapper({ modelValue: false })
      const exportStore = useExportStore()

      // Mock API error for later
      exportStore.createExport.mockRejectedValue(new Error('Export failed'))

      // Open dialog
      await wrapper.setProps({ modelValue: true })
      await wrapper.vm.$nextTick()

      // Verify error state is clean
      expect(wrapper.vm.error).toBeNull()
      expect(exportStore.clearError).toHaveBeenCalled()

      // Create failed export to generate error
      const exportButton = wrapper.find('[data-test="start-export"]')
      await exportButton.trigger('click')
      await wrapper.vm.$nextTick()

      // Verify we have error now
      expect(wrapper.vm.error).not.toBeNull()

      // Close and reopen dialog
      await wrapper.setProps({ modelValue: false })
      await wrapper.setProps({ modelValue: true })
      await wrapper.vm.$nextTick()

      // Error should be cleared
      expect(wrapper.vm.error).toBeNull()
      expect(exportStore.clearError).toHaveBeenCalledTimes(2)
    })

    it('should provide retry option after export failure', async () => {
      wrapper = createWrapper()
      const exportStore = useExportStore()

      // Mock API error
      exportStore.createExport.mockRejectedValueOnce(new Error('Export failed'))

      // Try to create export
      const exportButton = wrapper.find('[data-test="start-export"]')
      await exportButton.trigger('click')
      await wrapper.vm.$nextTick()

      // Check that retry button exists
      const retryButton = wrapper.find('[data-test="retry-button"]')
      expect(retryButton.exists()).toBe(true)

      // Mock successful response for retry
      exportStore.createExport.mockResolvedValueOnce({ id: 'export-123' })

      // Click retry
      await retryButton.trigger('click')
      await wrapper.vm.$nextTick()

      // Should have cleared error and succeeded
      expect(wrapper.vm.error).toBeNull()
      expect(wrapper.emitted('export-created')).toBeTruthy()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty dataset warning', async () => {
      // Mock store with no tasks
      vi.mocked(useTaskStore).mockReturnValue({
        filteredTasks: [],
        pagination: {
          total: 0
        }
      })

      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      // Should show empty dataset warning
      const emptyWarning = wrapper.find('[data-test="empty-dataset-warning"]')
      expect(emptyWarning.exists()).toBe(true)
      expect(emptyWarning.text()).toContain('No data')

      // Export button should be disabled
      const exportButton = wrapper.find('[data-test="start-export"]')
      expect(exportButton.attributes('disabled')).toBeDefined()
    })

    it('should handle very large datasets with warning', async () => {
      // Mock store with large number of tasks
      vi.mocked(useTaskStore).mockReturnValue({
        filteredTasks: Array(10000).fill({}),
        pagination: {
          total: 10000
        }
      })

      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      // Should show large dataset warning
      const largeWarning = wrapper.find('[data-test="large-dataset-warning"]')
      expect(largeWarning.exists()).toBe(true)
      expect(largeWarning.text()).toContain('large')

      // Export should still be allowed
      const exportButton = wrapper.find('[data-test="start-export"]')
      expect(exportButton.attributes('disabled')).toBeUndefined()
    })

    it('should handle server timeout errors gracefully', async () => {
      wrapper = createWrapper()
      const exportStore = useExportStore()

      // Mock timeout error
      const timeoutError = new Error('Request timed out after 30 seconds')
      exportStore.createExport.mockRejectedValue(timeoutError)

      // Try to create export
      const exportButton = wrapper.find('[data-test="start-export"]')
      await exportButton.trigger('click')
      await wrapper.vm.$nextTick()

      // Should show user-friendly timeout message
      const errorAlert = wrapper.find('[data-test="error-message"]')
      expect(errorAlert.exists()).toBe(true)
      expect(errorAlert.text()).toContain('timed out')

      // Should suggest retry
      const retryText = wrapper.find('[data-test="timeout-help"]')
      expect(retryText.exists()).toBe(true)
      expect(retryText.text()).toContain('try again')
    })
  })
})
