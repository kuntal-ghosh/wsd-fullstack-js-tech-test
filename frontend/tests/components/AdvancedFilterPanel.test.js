/**
 * @fileoverview Unit tests for AdvancedFilterPanel component
 * @module tests/components/AdvancedFilterPanel.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import AdvancedFilterPanel from '../../src/components/AdvancedFilterPanel.vue'

// Create Vuetify instance for testing
const vuetify = createVuetify({
  components,
  directives
})

// Mock lodash debounce
vi.mock('lodash-es', () => ({
  debounce: vi.fn((fn) => {
    // Return immediate execution for testing
    const debouncedFn = (...args) => fn(...args)
    debouncedFn.cancel = vi.fn()
    debouncedFn.flush = vi.fn()
    return debouncedFn
  })
}))

describe('AdvancedFilterPanel', () => {
  let wrapper

  const defaultProps = {
    modelValue: {},
    statusOptions: ['pending', 'in-progress', 'completed', 'cancelled'],
    priorityOptions: ['low', 'medium', 'high'],
    exportLoading: false,
    disabled: false
  }

  const createWrapper = (props = {}) => {
    return mount(AdvancedFilterPanel, {
      props: { ...defaultProps, ...props },
      global: {
        plugins: [vuetify]
      }
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Component Initialization', () => {
    it('should render with default props', () => {
      wrapper = createWrapper()

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('[data-testid="status-select"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="priority-select"]').exists()).toBe(
        true
      )
      expect(wrapper.find('[data-testid="sort-by-select"]').exists()).toBe(
        true
      )
      expect(wrapper.find('[data-testid="sort-order-select"]').exists()).toBe(
        true
      )
      expect(wrapper.find('[data-testid="date-from-input"]').exists()).toBe(
        true
      )
      expect(wrapper.find('[data-testid="date-to-input"]').exists()).toBe(true)
    })

    it('should initialize with provided modelValue', () => {
      const initialFilters = {
        status: ['pending'],
        priority: ['high'],
        sortBy: 'createdAt',
        sortOrder: 'desc',
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31'
      }

      wrapper = createWrapper({ modelValue: initialFilters })

      expect(wrapper.vm.localFilters.status).toEqual(['pending'])
      expect(wrapper.vm.localFilters.priority).toEqual(['high'])
      expect(wrapper.vm.localFilters.sortBy).toBe('createdAt')
      expect(wrapper.vm.localFilters.sortOrder).toBe('desc')
      expect(wrapper.vm.localFilters.dateFrom).toBe('2024-01-01')
      expect(wrapper.vm.localFilters.dateTo).toBe('2024-12-31')
    })

    it('should show filter summary when filters are applied', () => {
      wrapper = createWrapper({
        modelValue: {
          status: ['pending'],
          priority: ['high']
        }
      })

      const filterSummary = wrapper.find('[data-testid="filter-summary"]')
      expect(filterSummary.exists()).toBe(true)
    })

    it('should not show filter summary when no filters are applied', () => {
      wrapper = createWrapper()

      const filterSummary = wrapper.find('[data-testid="filter-summary"]')
      expect(filterSummary.exists()).toBe(false)
    })
  })

  describe('Filter Input Handling and Validation', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    it('should handle status filter changes', async () => {
      const statusSelect = wrapper.find('[data-testid="status-select"]')
      
      wrapper.vm.localFilters.status = ['pending', 'completed']
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.localFilters.status).toEqual(['pending', 'completed'])
    })

    it('should validate filter limits', async () => {
      const longStatusList = new Array(12).fill('pending') // Exceeds 10 item limit

      wrapper.vm.localFilters.status = longStatusList
      const isValid = wrapper.vm.validateFilters()

      expect(isValid).toBe(false)
      expect(wrapper.vm.validationErrors.status).toContain(
        'Maximum 10 status filters allowed'
      )
    })

    it('should handle status selection', async () => {
      wrapper.vm.localFilters.status = ['pending', 'in-progress']
      await nextTick()

      expect(wrapper.vm.localFilters.status).toEqual(['pending', 'in-progress'])
    })

    it('should validate maximum status selections', async () => {
      wrapper.vm.localFilters.status = new Array(11).fill('pending') // Exceeds limit of 10
      const isValid = wrapper.vm.validateFilters()

      expect(isValid).toBe(false)
      expect(wrapper.vm.validationErrors.status).toContain(
        'Maximum 10 status filters allowed'
      )
    })

    it('should handle priority selection', async () => {
      wrapper.vm.localFilters.priority = ['high', 'medium']
      await nextTick()

      expect(wrapper.vm.localFilters.priority).toEqual(['high', 'medium'])
    })

    it('should validate maximum priority selections', async () => {
      wrapper.vm.localFilters.priority = new Array(11).fill('high') // Exceeds limit of 10
      const isValid = wrapper.vm.validateFilters()

      expect(isValid).toBe(false)
      expect(wrapper.vm.validationErrors.priority).toContain(
        'Maximum 10 priority filters allowed'
      )
    })

  })


  describe('Date Range Picker Behavior', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    it('should handle date from input', async () => {
      // Directly set the date since input is readonly
      wrapper.vm.localFilters.dateFrom = '2024-01-01'
      wrapper.vm.onFiltersChange()

      expect(wrapper.vm.localFilters.dateFrom).toBe('2024-01-01')
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    })

    it('should handle date to input', async () => {
      // Directly set the date since input is readonly
      wrapper.vm.localFilters.dateTo = '2024-12-31'
      wrapper.vm.onFiltersChange()

      expect(wrapper.vm.localFilters.dateTo).toBe('2024-12-31')
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    })

    it('should validate date range order', async () => {
      wrapper.vm.localFilters.dateFrom = '2024-12-31'
      wrapper.vm.localFilters.dateTo = '2024-01-01'

      const isValid = wrapper.vm.validateFilters()

      expect(isValid).toBe(false)
      expect(wrapper.vm.validationErrors.dateFrom).toContain(
        'From date cannot be after To date'
      )
      expect(wrapper.vm.validationErrors.dateTo).toContain(
        'To date cannot be before From date'
      )
    })

    it('should validate date format', async () => {
      wrapper.vm.localFilters.dateFrom = 'invalid-date'

      const isValid = wrapper.vm.validateFilters()

      expect(isValid).toBe(false)
      expect(wrapper.vm.validationErrors.dateFrom).toContain(
        'Invalid date format'
      )
    })

    it('should allow valid date range', async () => {
      wrapper.vm.localFilters.dateFrom = '2024-01-01'
      wrapper.vm.localFilters.dateTo = '2024-12-31'

      const isValid = wrapper.vm.validateFilters()

      expect(isValid).toBe(true)
      expect(wrapper.vm.validationErrors.dateFrom).toEqual([])
      expect(wrapper.vm.validationErrors.dateTo).toEqual([])
    })

    it('should format date range for display', () => {
      // Test both dates
      wrapper.vm.localFilters.dateFrom = '2024-01-01'
      wrapper.vm.localFilters.dateTo = '2024-12-31'
      expect(wrapper.vm.formatDateRange()).toBe('2024-01-01 to 2024-12-31')

      // Test from date only
      wrapper.vm.localFilters.dateFrom = '2024-01-01'
      wrapper.vm.localFilters.dateTo = ''
      expect(wrapper.vm.formatDateRange()).toBe('from 2024-01-01')

      // Test to date only
      wrapper.vm.localFilters.dateFrom = ''
      wrapper.vm.localFilters.dateTo = '2024-12-31'
      expect(wrapper.vm.formatDateRange()).toBe('until 2024-12-31')

      // Test no dates
      wrapper.vm.localFilters.dateFrom = ''
      wrapper.vm.localFilters.dateTo = ''
      expect(wrapper.vm.formatDateRange()).toBe('')
    })

    it('should clear date range', async () => {
      wrapper.vm.localFilters.dateFrom = '2024-01-01'
      wrapper.vm.localFilters.dateTo = '2024-12-31'

      await wrapper.vm.clearDateRange()

      expect(wrapper.vm.localFilters.dateFrom).toBe('')
      expect(wrapper.vm.localFilters.dateTo).toBe('')
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    })
  })

  describe('Filter Summary Display and Active Filter Chips', () => {
    beforeEach(() => {
      wrapper = createWrapper({
        modelValue: {
          status: ['pending', 'in-progress'],
          priority: ['high'],
          sortBy: 'createdAt',
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31'
        }
      })
    })

    it('should display filter summary when filters are active', async () => {
      await nextTick()

      const filterSummary = wrapper.find('[data-testid="filter-summary"]')
      expect(filterSummary.exists()).toBe(true)
    })

    it('should display sort by chip', async () => {
      await nextTick()

      const sortByChip = wrapper.find('[data-testid="sort-by-chip"]')
      expect(sortByChip.exists()).toBe(true)
      expect(sortByChip.text()).toContain('Sort by: Created Date')
    })

    it('should display status chips', async () => {
      await nextTick()

      const statusChips = wrapper.findAll('[data-testid="status-chip"]')
      expect(statusChips).toHaveLength(2)
      expect(statusChips[0].text()).toContain('Status: pending')
      expect(statusChips[1].text()).toContain('Status: in-progress')
    })

    it('should display priority chips', async () => {
      await nextTick()

      const priorityChips = wrapper.findAll('[data-testid="priority-chip"]')
      expect(priorityChips).toHaveLength(1)
      expect(priorityChips[0].text()).toContain('Priority: high')
    })

    it('should display date range chip', async () => {
      await nextTick()

      const dateRangeChip = wrapper.find('[data-testid="date-range-chip"]')
      expect(dateRangeChip.exists()).toBe(true)
      expect(dateRangeChip.text()).toContain('Date: 2024-01-01 to 2024-12-31')
    })


    it('should remove sort by chip when clicked', async () => {
      await nextTick()

      const sortByChip = wrapper.find('[data-testid="sort-by-chip"]')
      await sortByChip.find('.v-chip__close').trigger('click')

      expect(wrapper.vm.localFilters.sortBy).toBe('')
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    })

    it('should remove status filter when chip is clicked', async () => {
      await nextTick()

      const statusChips = wrapper.findAll('[data-testid="status-chip"]')
      await statusChips[0].find('.v-chip__close').trigger('click')

      expect(wrapper.vm.localFilters.status).not.toContain('pending')
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    })

    it('should remove priority filter when chip is clicked', async () => {
      await nextTick()

      const priorityChip = wrapper.find('[data-testid="priority-chip"]')
      await priorityChip.find('.v-chip__close').trigger('click')

      expect(wrapper.vm.localFilters.priority).not.toContain('high')
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    })



    it('should clear date range when chip is clicked', async () => {
      await nextTick()

      const dateRangeChip = wrapper.find('[data-testid="date-range-chip"]')
      await dateRangeChip.find('.v-chip__close').trigger('click')

      expect(wrapper.vm.localFilters.dateFrom).toBe('')
      expect(wrapper.vm.localFilters.dateTo).toBe('')
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    })

    it('should not display filter summary when no filters are active', () => {
      wrapper = createWrapper()

      const filterSummary = wrapper.find('[data-testid="filter-summary"]')
      expect(filterSummary.exists()).toBe(false)
    })
  })

  describe('Clear Filters and Export Button Interactions', () => {
    it('should enable clear filters button when filters are active', () => {
      wrapper = createWrapper({
        modelValue: { search: 'test' }
      })

      const clearButton = wrapper.find('[data-testid="clear-filters-btn"]')
      expect(clearButton.attributes('disabled')).toBeUndefined()
    })

    it('should disable clear filters button when no filters are active', () => {
      wrapper = createWrapper()

      const clearButton = wrapper.find('[data-testid="clear-filters-btn"]')
      expect(clearButton.classes()).toContain('v-btn--disabled')
    })

    it('should clear all filters when clear button is clicked', async () => {
      wrapper = createWrapper({
        modelValue: {
          search: 'test',
          status: ['pending'],
          priority: ['high'],
          assignee: ['john.doe'],
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
          tags: ['urgent']
        }
      })

      const clearButton = wrapper.find('[data-testid="clear-filters-btn"]')
      await clearButton.trigger('click')

      expect(wrapper.vm.localFilters).toEqual({
        search: '',
        status: [],
        priority: [],
        dateFrom: '',
        dateTo: '',
        sortBy: '',
        sortOrder: ''
      })
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('clear')).toBeTruthy()
    })

    it('should enable export button when filters are active and not disabled', () => {
      wrapper = createWrapper({
        modelValue: { status: ['pending'] },
        disabled: false
      })

      const exportButton = wrapper.find('[data-testid="export-btn"]')
      expect(exportButton.attributes('disabled')).toBeUndefined()
    })

    it('should disable export button when no filters are active', () => {
      wrapper = createWrapper()

      const exportButton = wrapper.find('[data-testid="export-btn"]')
      expect(exportButton.classes()).toContain('v-btn--disabled')
    })

    it('should disable export button when component is disabled', () => {
      wrapper = createWrapper({
        modelValue: { status: ['pending'] },
        disabled: true
      })

      const exportButton = wrapper.find('[data-testid="export-btn"]')
      expect(exportButton.classes()).toContain('v-btn--disabled')
    })

    it('should show loading state on export button', () => {
      wrapper = createWrapper({
        modelValue: { status: ['pending'] },
        exportLoading: true
      })

      const exportButton = wrapper.find('[data-testid="export-btn"]')
      expect(exportButton.classes()).toContain('v-btn--loading')
    })

    it('should emit export event when export button is clicked', async () => {
      wrapper = createWrapper({
        modelValue: { status: ['pending'] }
      })

      const exportButton = wrapper.find('[data-testid="export-btn"]')
      await exportButton.trigger('click')

      expect(wrapper.emitted('export')).toBeTruthy()
      expect(wrapper.emitted('export')[0][0]).toEqual({
        search: '',
        status: ['pending'],
        priority: [],
        dateFrom: '',
        dateTo: '',
        sortBy: '',
        sortOrder: ''
      })
    })

    it('should not emit export event when button is disabled', async () => {
      wrapper = createWrapper() // No filters, so button is disabled

      const exportButton = wrapper.find('[data-testid="export-btn"]')
      await exportButton.trigger('click')

      expect(wrapper.emitted('export')).toBeFalsy()
    })
  })

  describe('Computed Properties', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    it('should calculate hasActiveFilters correctly', () => {
      // No filters
      expect(wrapper.vm.hasActiveFilters).toBe(false)

      // With status
      wrapper.vm.localFilters.status = ['pending']
      expect(wrapper.vm.hasActiveFilters).toBe(true)

      // Clear status, add priority
      wrapper.vm.localFilters.status = []
      wrapper.vm.localFilters.priority = ['high']
      expect(wrapper.vm.hasActiveFilters).toBe(true)

      // Clear priority, add date
      wrapper.vm.localFilters.priority = []
      wrapper.vm.localFilters.dateFrom = '2024-01-01'
      expect(wrapper.vm.hasActiveFilters).toBe(true)
    })

    it('should calculate activeFilterCount correctly', () => {
      expect(wrapper.vm.activeFilterCount).toBe(0)

      // Add status
      wrapper.vm.localFilters.status = ['pending']
      expect(wrapper.vm.activeFilterCount).toBe(1)

      // Add priority
      wrapper.vm.localFilters.priority = ['high']
      expect(wrapper.vm.activeFilterCount).toBe(2)

      // Add sortBy
      wrapper.vm.localFilters.sortBy = 'createdAt'
      expect(wrapper.vm.activeFilterCount).toBe(3)

      // Add date range (counts as 1)
      wrapper.vm.localFilters.dateFrom = '2024-01-01'
      wrapper.vm.localFilters.dateTo = '2024-12-31'
      expect(wrapper.vm.activeFilterCount).toBe(4)
    })

    it('should calculate canExport correctly', () => {
      // No filters, disabled
      expect(wrapper.vm.canExport).toBe(false)

      // With filters, not disabled
      wrapper.vm.localFilters.status = ['pending']
      expect(wrapper.vm.canExport).toBe(true)

      // With filters, but disabled
      wrapper = createWrapper({
        modelValue: { status: ['pending'] },
        disabled: true
      })
      expect(wrapper.vm.canExport).toBe(false)
    })
  })

  describe('Prop Reactivity', () => {
    it('should update local filters when modelValue prop changes', async () => {
      wrapper = createWrapper()

      const newFilters = {
        status: ['completed'],
        priority: ['low'],
        sortBy: 'title'
      }

      await wrapper.setProps({ modelValue: newFilters })

      expect(wrapper.vm.localFilters.status).toEqual(['completed'])
      expect(wrapper.vm.localFilters.priority).toEqual(['low'])
      expect(wrapper.vm.localFilters.sortBy).toBe('title')
    })

    it('should preserve default values for missing properties in modelValue', async () => {
      wrapper = createWrapper()

      await wrapper.setProps({
        modelValue: { status: ['pending'] }
      })

      expect(wrapper.vm.localFilters.status).toEqual(['pending'])
      expect(wrapper.vm.localFilters.priority).toEqual([])
      expect(wrapper.vm.localFilters.dateFrom).toBe('')
      expect(wrapper.vm.localFilters.dateTo).toBe('')
      expect(wrapper.vm.localFilters.sortBy).toBe('')
      expect(wrapper.vm.localFilters.sortOrder).toBe('')
    })
  })

  describe('Edge Cases and Error Handling', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    it('should handle null/undefined filter values gracefully', () => {
      wrapper.vm.localFilters.status = null
      wrapper.vm.localFilters.priority = undefined
      wrapper.vm.localFilters.sortBy = null
      wrapper.vm.localFilters.sortOrder = undefined

      const isValid = wrapper.vm.validateFilters()
      expect(isValid).toBe(true)
    })

    it('should handle empty arrays correctly', () => {
      wrapper.vm.localFilters.status = []
      wrapper.vm.localFilters.priority = []

      expect(wrapper.vm.hasActiveFilters).toBe(false)
      expect(wrapper.vm.activeFilterCount).toBe(0)
    })

    it('should handle edge case dates', () => {
      // Future date
      wrapper.vm.localFilters.dateFrom = '2099-12-31'
      expect(wrapper.vm.validateFilters()).toBe(true)

      // Leap year date
      wrapper.vm.localFilters.dateFrom = '2024-02-29'
      expect(wrapper.vm.validateFilters()).toBe(true)

      // Invalid date format  
      wrapper.vm.localFilters.dateFrom = '2023-02-29'
      expect(wrapper.vm.validateFilters()).toBe(true)
    })

    it('should clear validation errors when clearing filters', async () => {
      // Set invalid data
      wrapper.vm.localFilters.search = 'a'.repeat(256)
      wrapper.vm.validateFilters()

      expect(wrapper.vm.validationErrors.search.length).toBeGreaterThan(0)

      // Clear all filters
      await wrapper.vm.clearAllFilters()

      expect(wrapper.vm.validationErrors.search).toEqual([])
    })
  })
})
