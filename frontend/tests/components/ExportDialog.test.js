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

// Import the actual component
import ExportDialog from '../../src/components/ExportDialog.vue'

// Mock the stores
const mockTaskStore = {
  filteredTasks: [
    { id: '1', title: 'Task 1', status: 'pending' },
    { id: '2', title: 'Task 2', status: 'in-progress' }
  ],
  pagination: { total: 2 }
}

const mockExportStore = {
  createExport: vi
    .fn()
    .mockResolvedValue({ id: 'export-123', status: 'processing' }),
  loading: false,
  exports: []
}

vi.mock('../../src/stores/taskStore', () => ({
  useTaskStore: () => mockTaskStore
}))

vi.mock('../../src/stores/exportStore', () => ({
  useExportStore: () => mockExportStore
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
        plugins: [vuetify, pinia]
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
      expect(wrapper.find('[data-test="export-dialog-content"]').exists()).toBe(true)
    })

    it('should not display dialog content when modelValue is false', () => {
      wrapper = createWrapper({ modelValue: false })

      // The dialog itself should still exist in the DOM, but content should be hidden
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('[data-test="export-dialog-content"]').exists()).toBe(
        false
      )
    })

    it('should update v-model when dialog is closed', async () => {
      wrapper = createWrapper({ modelValue: true })

      await wrapper.vm.closeDialog()

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([false])
    })

    it('should emit cancel event when cancel button is clicked', async () => {
      wrapper = createWrapper({ modelValue: true })
      await nextTick()

      const cancelButton = wrapper.find('[data-test="cancel-button"]')
      expect(cancelButton.exists()).toBe(true)
      await cancelButton.trigger('click')

      expect(wrapper.emitted('cancel')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([false])
    })
  })

  describe('Export Format Selection and Validation', () => {
    beforeEach(() => {
      wrapper = createWrapper({ modelValue: true })
    })

    it('should render format selection options', async () => {
      await nextTick()
      
      const formatGroup = wrapper.find('[data-test="format-group"]')
      expect(formatGroup.exists()).toBe(true)

      const csvOption = wrapper.find('[data-test="format-csv"]')
      const jsonOption = wrapper.find('[data-test="format-json"]')

      expect(csvOption.exists()).toBe(true)
      expect(jsonOption.exists()).toBe(true)
    })

    it('should select CSV format by default', async () => {
      await nextTick()
      expect(wrapper.vm.exportFormat).toBe('csv')
    })

    it('should update format when selection changes', async () => {
      await nextTick()
      
      const jsonRadio = wrapper.find('[data-test="format-json"] input')
      expect(jsonRadio.exists()).toBe(true)
      await jsonRadio.setValue('json')
      await nextTick()

      expect(wrapper.vm.exportFormat).toBe('json')
    })

    it('should validate export format', async () => {
      await nextTick()
      
      // Set an invalid format (this should never happen through UI but tests the validation)
      wrapper.vm.exportFormat = 'invalid'

      const isValid = wrapper.vm.validateExportParams()

      expect(isValid).toBe(false)
      expect(wrapper.vm.validationErrors.format).toContain(
        'Invalid export format'
      )
    })

    it('should validate with valid export format', async () => {
      await nextTick()
      
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

    it('should allow empty filename', async () => {
      await nextTick()
      
      wrapper.vm.customFilename = ''

      const isValid = wrapper.vm.validateExportParams()

      expect(isValid).toBe(true)
      expect(wrapper.vm.validationErrors.filename).toEqual([])
    })

    it('should validate filename length', async () => {
      await nextTick()
      
      const filenameInput = wrapper.find('[data-test="filename"] input')
      expect(filenameInput.exists()).toBe(true)
      
      const longFilename = 'a'.repeat(256)
      await filenameInput.setValue(longFilename)
      await nextTick()

      const isValid = wrapper.vm.validateExportParams()

      expect(isValid).toBe(false)
      expect(wrapper.vm.validationErrors.filename).toContain(
        'Filename is too long (max 255 characters)'
      )
    })

    it('should validate filename characters', async () => {
      await nextTick()
      
      const filenameInput = wrapper.find('[data-test="filename"] input')
      expect(filenameInput.exists()).toBe(true)
      
      const invalidFilename = 'file/with\\invalid:chars?*"<>|'
      await filenameInput.setValue(invalidFilename)
      await nextTick()

      const isValid = wrapper.vm.validateExportParams()

      expect(isValid).toBe(false)
      expect(wrapper.vm.validationErrors.filename).toContain(
        'Filename contains invalid characters'
      )
    })

    it('should accept valid filename', async () => {
      await nextTick()
      
      const filenameInput = wrapper.find('[data-test="filename"] input')
      expect(filenameInput.exists()).toBe(true)
      
      await filenameInput.setValue('valid-filename_123')
      await nextTick()

      const isValid = wrapper.vm.validateExportParams()

      expect(isValid).toBe(true)
      expect(wrapper.vm.validationErrors.filename).toEqual([])
    })
  })

  describe('Filter Summary Display', () => {
    it('should display record count from task store', async () => {
      wrapper = createWrapper({ modelValue: true })
      await nextTick()

      const recordCount = wrapper.find('[data-test="record-count"]')
      expect(recordCount.exists()).toBe(true)
      expect(recordCount.text()).toBe('2')
    })

    it('should display active filters summary', async () => {
      wrapper = createWrapper({
        modelValue: true,
        filters: {
          status: ['pending', 'in-progress'],
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
          search: 'test'
        }
      })
      await nextTick()

      const filterSummary = wrapper.find('[data-test="filter-summary"]')
      expect(filterSummary.exists()).toBe(true)
      const summaryText = filterSummary.text()
      expect(summaryText).toContain('Status: pending, in-progress')
      expect(summaryText).toContain('Date Range: 2024-01-01 to 2024-12-31')
      expect(summaryText).toContain('Search: "test"')
    })

    it('should display estimated file size based on record count', async () => {
      wrapper = createWrapper({ modelValue: true })
      await nextTick()

      const estimatedSize = wrapper.find('[data-test="estimated-size"]')
      expect(estimatedSize.exists()).toBe(true)

      // Default format is CSV
      expect(wrapper.vm.estimatedSize).toContain('KB')

      // Change format to JSON and check if estimate changes
      wrapper.vm.exportFormat = 'json'
      await nextTick()
      expect(wrapper.vm.estimatedSize).toContain('KB')
      expect(wrapper.vm.estimatedSize).not.toBe('0 KB') // Should have some estimate
    })

    it('should show "No filters applied" when no filters are present', async () => {
      wrapper = createWrapper({
        modelValue: true,
        filters: {}
      })
      await nextTick()

      const filterSummary = wrapper.find('[data-test="filter-summary"]')
      expect(filterSummary.text()).toContain('No filters applied')
    })

    it('should handle empty array filters correctly', async () => {
      wrapper = createWrapper({
        modelValue: true,
        filters: {
          status: [],
          priority: []
        }
      })
      await nextTick()

      const filterSummary = wrapper.find('[data-test="filter-summary"]')
      expect(filterSummary.text()).toContain('No filters applied')
    })
  })

  describe('Export Initiation and Loading States', () => {
    beforeEach(() => {
      wrapper = createWrapper({ modelValue: true })
    })

    it('should enable start export button when there are records', async () => {
      await nextTick()
      
      const startButton = wrapper.find('[data-test="start-export"]')
      expect(startButton.exists()).toBe(true)
      expect(startButton.attributes('disabled')).toBeUndefined()
    })

    it('should show loading state during export', async () => {
      await nextTick()
      
      // Mock the exporting state
      wrapper.vm.exporting = true
      await nextTick()

      const startButton = wrapper.find('[data-test="start-export"]')
      expect(startButton.classes()).toContain('v-btn--loading')
    })

    it('should initiate export with correct parameters', async () => {
      await nextTick()
      
      // Setup test data
      wrapper.vm.exportFormat = 'json'
      wrapper.vm.customFilename = 'test-export'

      // Initiate export
      await wrapper.vm.initiateExport()

      // Verify createExport was called with correct parameters
      expect(mockExportStore.createExport).toHaveBeenCalledWith({
        format: 'json',
        filters: wrapper.vm.filters,
        filename: 'test-export'
      })
    })

    it('should emit export-created event with export record', async () => {
      await nextTick()
      
      // Initiate export
      await wrapper.vm.initiateExport()

      // Verify event was emitted
      expect(wrapper.emitted('export-created')).toBeTruthy()
      expect(wrapper.emitted('export-created')[0][0].id).toBe('export-123')
    })

    it('should close dialog after successful export', async () => {
      await nextTick()
      
      // Initiate export
      await wrapper.vm.initiateExport()

      // Verify dialog was closed
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([false])
    })

    it('should handle export errors gracefully', async () => {
      await nextTick()
      
      // Mock the export store to throw an error
      mockExportStore.createExport.mockRejectedValueOnce(new Error('Export failed'))

      // Initiate export
      await wrapper.vm.initiateExport()

      // Verify error was handled
      expect(wrapper.vm.error).toBe('Export failed')
      expect(wrapper.find('[data-test="error-message"]').exists()).toBe(true)

      // Dialog should remain open on error
      const updateEvents = wrapper.emitted('update:modelValue')
      if (updateEvents) {
        // Should not have closed the dialog due to error
        expect(updateEvents.some(event => event[0] === false)).toBe(false)
      }
    })

    it('should disable start button when there are no records', async () => {
      // Override the mock task store for this test
      mockTaskStore.filteredTasks = []
      mockTaskStore.pagination.total = 0
      
      wrapper = createWrapper({ modelValue: true })
      await nextTick()

      // Check if button is disabled
      const startButton = wrapper.find('[data-test="start-export"]')
      expect(startButton.attributes('disabled')).toBeDefined()
      
      // Reset mock for other tests
      mockTaskStore.filteredTasks = [
        { id: '1', title: 'Task 1', status: 'pending' },
        { id: '2', title: 'Task 2', status: 'in-progress' }
      ]
      mockTaskStore.pagination.total = 2
    })
  })

  describe('Parameter Validation', () => {
    beforeEach(() => {
      wrapper = createWrapper({ modelValue: true })
    })

    it('should validate all parameters together', async () => {
      await nextTick()
      
      // Set invalid format and filename
      wrapper.vm.exportFormat = 'invalid'
      wrapper.vm.customFilename = 'a'.repeat(256)

      const isValid = wrapper.vm.validateExportParams()

      expect(isValid).toBe(false)
      expect(
        Object.keys(wrapper.vm.validationErrors).filter(
          (key) => wrapper.vm.validationErrors[key].length > 0
        ).length
      ).toBe(2) // Both format and filename should have errors
    })

    it('should clear validation errors when parameters change', async () => {
      await nextTick()
      
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
      await nextTick()
      
      // Set invalid filename
      const filenameInput = wrapper.find('[data-test="filename"] input')
      expect(filenameInput.exists()).toBe(true)
      await filenameInput.setValue('a'.repeat(256))

      // Trigger validation by clicking start export
      await wrapper.find('[data-test="start-export"]').trigger('click')
      await nextTick()

      // Check if error message is shown
      expect(wrapper.vm.error).toBeTruthy()
      expect(wrapper.find('[data-test="error-message"]').exists()).toBe(true)
    })
  })
})
