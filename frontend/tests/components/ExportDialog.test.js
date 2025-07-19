/**
 * @fileoverview Unit tests for ExportDialog component
 * @module tests/components/ExportDialog.test
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
const ExportDialog = {
  name: 'ExportDialog',
  template: '<div></div>'
}

// Mock the store
vi.mock('../../src/stores/taskStore', () => ({
  useTaskStore: () => ({
    filteredTasks: [
      { id: '1', title: 'Task 1', status: 'pending' },
      { id: '2', title: 'Task 2', status: 'in-progress' }
    ],
    pagination: { total: 2 }
  })
}))

vi.mock('../../src/stores/exportStore', () => ({
  useExportStore: () => ({
    createExport: vi.fn().mockResolvedValue({ id: 'export-123', status: 'processing' }),
    loading: false,
    exports: []
  })
}))

// Create Vuetify instance for testing
const vuetify = createVuetify({
  components,
  directives
})

describe('ExportDialog', () => {
  let wrapper
  let pinia

  const defaultProps = {
    filters: { 
      status: ['pending'], 
      dateFrom: '2024-01-01', 
      dateTo: '2024-12-31' 
    },
    modelValue: false
  }

  const createWrapper = (props = {}) => {
    return mount(ExportDialog, {
      props: { ...defaultProps, ...props },
      global: {
        plugins: [vuetify, pinia],
        stubs: {
          // Stub transitions to avoid test warnings
          'v-dialog': true
        }
      }
    })
  }

  beforeEach(() => {
    // Create a fresh Pinia instance for each test
    pinia = createPinia()
    setActivePinia(pinia)
    
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Component Initialization and Dialog Management', () => {
    it('should render the export dialog when modelValue is true', async () => {
      wrapper = createWrapper({ modelValue: true })
      
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('[data-test="export-dialog"]').exists()).toBe(true)
    })

    it('should not display dialog content when modelValue is false', () => {
      wrapper = createWrapper({ modelValue: false })
      
      // The dialog itself should still exist in the DOM, but content should be hidden
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('[data-test="export-dialog-content"]').exists()).toBe(false)
    })

    it('should update v-model when dialog is closed', async () => {
      wrapper = createWrapper({ modelValue: true })
      
      await wrapper.vm.closeDialog()
      
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([false])
    })

    it('should emit cancel event when cancel button is clicked', async () => {
      wrapper = createWrapper({ modelValue: true })
      
      const cancelButton = wrapper.find('[data-test="cancel-button"]')
      await cancelButton.trigger('click')
      
      expect(wrapper.emitted('cancel')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([false])
    })
  })

  describe('Export Format Selection and Validation', () => {
    beforeEach(() => {
      wrapper = createWrapper({ modelValue: true })
    })

    it('should render format selection options', () => {
      const formatGroup = wrapper.find('[data-test="format-group"]')
      expect(formatGroup.exists()).toBe(true)
      
      const csvOption = wrapper.find('[data-test="format-csv"]')
      const jsonOption = wrapper.find('[data-test="format-json"]')
      
      expect(csvOption.exists()).toBe(true)
      expect(jsonOption.exists()).toBe(true)
    })

    it('should select CSV format by default', () => {
      expect(wrapper.vm.exportFormat).toBe('csv')
      
      const csvOption = wrapper.find('[data-test="format-csv"]')
      expect(csvOption.attributes('aria-checked')).toBe('true')
    })

    it('should update format when selection changes', async () => {
      const jsonRadio = wrapper.find('[data-test="format-json"] input')
      await jsonRadio.setValue(true)
      
      expect(wrapper.vm.exportFormat).toBe('json')
    })

    it('should validate export format', () => {
      // Set an invalid format (this should never happen through UI but tests the validation)
      wrapper.vm.exportFormat = 'invalid'
      
      const isValid = wrapper.vm.validateExportParams()
      
      expect(isValid).toBe(false)
      expect(wrapper.vm.validationErrors.format).toContain('Invalid export format')
    })

    it('should validate with valid export format', () => {
      wrapper.vm.exportFormat = 'csv'
      
      const isValid = wrapper.vm.validateExportParams()
      
      expect(isValid).toBe(true)
      expect(wrapper.vm.validationErrors.format).toEqual([])
    })
  })

  describe('Custom Filename Validation', () => {
    beforeEach(() => {
      wrapper = createWrapper({ modelValue: true })
    })

    it('should allow empty filename', () => {
      wrapper.vm.customFilename = ''
      
      const isValid = wrapper.vm.validateExportParams()
      
      expect(isValid).toBe(true)
      expect(wrapper.vm.validationErrors.filename).toEqual([])
    })

    it('should validate filename length', async () => {
      const filenameInput = wrapper.find('[data-test="filename"] input')
      const longFilename = 'a'.repeat(256)
      
      await filenameInput.setValue(longFilename)
      
      const isValid = wrapper.vm.validateExportParams()
      
      expect(isValid).toBe(false)
      expect(wrapper.vm.validationErrors.filename).toContain('Filename is too long (max 255 characters)')
    })

    it('should validate filename characters', async () => {
      const filenameInput = wrapper.find('[data-test="filename"] input')
      const invalidFilename = 'file/with\\invalid:chars?*"<>|'
      
      await filenameInput.setValue(invalidFilename)
      
      const isValid = wrapper.vm.validateExportParams()
      
      expect(isValid).toBe(false)
      expect(wrapper.vm.validationErrors.filename).toContain('Filename contains invalid characters')
    })

    it('should accept valid filename', async () => {
      const filenameInput = wrapper.find('[data-test="filename"] input')
      await filenameInput.setValue('valid-filename_123')
      
      const isValid = wrapper.vm.validateExportParams()
      
      expect(isValid).toBe(true)
      expect(wrapper.vm.validationErrors.filename).toEqual([])
    })
  })

  describe('Filter Summary Display', () => {
    it('should display record count from task store', () => {
      wrapper = createWrapper({ modelValue: true })
      
      const recordCount = wrapper.find('[data-test="record-count"]')
      expect(recordCount.exists()).toBe(true)
      expect(recordCount.text()).toContain('2')
    })

    it('should display active filters summary', () => {
      wrapper = createWrapper({
        modelValue: true,
        filters: {
          status: ['pending', 'in-progress'],
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
          search: 'test'
        }
      })
      
      const filterSummary = wrapper.find('[data-test="filter-summary"]')
      expect(filterSummary.exists()).toBe(true)
      expect(filterSummary.text()).toContain('Status: pending, in-progress')
      expect(filterSummary.text()).toContain('Date Range: 2024-01-01 to 2024-12-31')
      expect(filterSummary.text()).toContain('Search: "test"')
    })

    it('should display estimated file size based on record count', () => {
      wrapper = createWrapper({ modelValue: true })
      
      const estimatedSize = wrapper.find('[data-test="estimated-size"]')
      expect(estimatedSize.exists()).toBe(true)
      
      // Default format is CSV
      expect(wrapper.vm.estimatedSize).toContain('KB')
      
      // Change format to JSON and check if estimate changes
      wrapper.vm.exportFormat = 'json'
      expect(wrapper.vm.estimatedSize).toContain('KB')
      expect(wrapper.vm.estimatedSize).not.toBe('0 KB') // Should have some estimate
    })

    it('should show "No filters applied" when no filters are present', () => {
      wrapper = createWrapper({
        modelValue: true,
        filters: {}
      })
      
      const filterSummary = wrapper.find('[data-test="filter-summary"]')
      expect(filterSummary.text()).toContain('No filters applied')
    })

    it('should handle empty array filters correctly', () => {
      wrapper = createWrapper({
        modelValue: true,
        filters: {
          status: [],
          priority: []
        }
      })
      
      const filterSummary = wrapper.find('[data-test="filter-summary"]')
      expect(filterSummary.text()).toContain('No filters applied')
    })
  })

  describe('Export Initiation and Loading States', () => {
    beforeEach(() => {
      wrapper = createWrapper({ modelValue: true })
    })

    it('should enable start export button when there are records', () => {
      const startButton = wrapper.find('[data-test="start-export"]')
      expect(startButton.exists()).toBe(true)
      expect(startButton.attributes('disabled')).toBeUndefined()
    })

    it('should show loading state during export', async () => {
      // Mock the exporting state
      wrapper.vm.exporting = true
      await nextTick()
      
      const startButton = wrapper.find('[data-test="start-export"]')
      expect(startButton.classes()).toContain('v-btn--loading')
    })

    it('should initiate export with correct parameters', async () => {
      const exportStore = wrapper.vm.exportStore
      
      // Setup test data
      wrapper.vm.exportFormat = 'json'
      wrapper.vm.customFilename = 'test-export'
      
      // Initiate export
      await wrapper.vm.initiateExport()
      
      // Verify createExport was called with correct parameters
      expect(exportStore.createExport).toHaveBeenCalledWith({
        format: 'json',
        filters: wrapper.vm.filters,
        filename: 'test-export'
      })
    })

    it('should emit export-created event with export record', async () => {
      // Initiate export
      await wrapper.vm.initiateExport()
      
      // Verify event was emitted
      expect(wrapper.emitted('export-created')).toBeTruthy()
      expect(wrapper.emitted('export-created')[0][0].id).toBe('export-123')
    })

    it('should close dialog after successful export', async () => {
      // Initiate export
      await wrapper.vm.initiateExport()
      
      // Verify dialog was closed
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([false])
    })

    it('should handle export errors gracefully', async () => {
      // Mock the export store to throw an error
      const exportStore = wrapper.vm.exportStore
      exportStore.createExport.mockRejectedValueOnce(new Error('Export failed'))
      
      // Initiate export
      await wrapper.vm.initiateExport()
      
      // Verify error was handled
      expect(wrapper.vm.error).toBe('Export failed')
      expect(wrapper.find('[data-test="error-message"]').exists()).toBe(true)
      
      // Dialog should remain open on error
      expect(wrapper.emitted('update:modelValue')).toBeFalsy()
    })

    it('should disable start button when there are no records', async () => {
      // Override the mock task store for this test
      vi.mocked(wrapper.vm.taskStore).filteredTasks = []
      vi.mocked(wrapper.vm.taskStore).pagination.total = 0
      await nextTick()
      
      // Recalculate computed properties
      wrapper.vm.$forceUpdate()
      await nextTick()
      
      // Check if button is disabled
      const startButton = wrapper.find('[data-test="start-export"]')
      expect(startButton.attributes('disabled')).toBeDefined()
    })
  })

  describe('Parameter Validation', () => {
    beforeEach(() => {
      wrapper = createWrapper({ modelValue: true })
    })

    it('should validate all parameters together', () => {
      // Set invalid format and filename
      wrapper.vm.exportFormat = 'invalid'
      wrapper.vm.customFilename = 'a'.repeat(256)
      
      const isValid = wrapper.vm.validateExportParams()
      
      expect(isValid).toBe(false)
      expect(Object.keys(wrapper.vm.validationErrors).filter(
        key => wrapper.vm.validationErrors[key].length > 0
      ).length).toBe(2) // Both format and filename should have errors
    })

    it('should clear validation errors when parameters change', async () => {
      // Set invalid filename
      wrapper.vm.customFilename = 'a'.repeat(256)
      wrapper.vm.validateExportParams()
      
      expect(wrapper.vm.validationErrors.filename).toHaveLength(1)
      
      // Fix the issue
      wrapper.vm.customFilename = 'valid-name'
      await wrapper.vm.handleFilenameChange()
      
      expect(wrapper.vm.validationErrors.filename).toHaveLength(0)
    })

    it('should show validation errors in the UI', async () => {
      // Set invalid filename
      const filenameInput = wrapper.find('[data-test="filename"] input')
      await filenameInput.setValue('a'.repeat(256))
      
      // Trigger validation
      await wrapper.find('[data-test="start-export"]').trigger('click')
      await nextTick()
      
      // Check if error message is shown
      const errorMessage = wrapper.find('[data-test="filename-error"]')
      expect(errorMessage.exists()).toBe(true)
    })
  })
})