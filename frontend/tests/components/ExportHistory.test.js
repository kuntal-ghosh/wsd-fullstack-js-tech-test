/**
 * @fileoverview Unit tests for ExportHistory component
 * @module tests/components/ExportHistory.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { createPinia, setActivePinia } from 'pinia'

// Import the actual component
import ExportHistory from '../../src/components/ExportHistory.vue'

// Mock the store with proper function wrapping
const mockExportStore = {
  fetchExports: vi.fn().mockResolvedValue([]),
  downloadExport: vi.fn().mockResolvedValue({}),
  deleteExport: vi.fn().mockResolvedValue({}),
  retryExport: vi.fn().mockResolvedValue({}),
  loading: false,
  error: null,
  exportHistory: [],
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  },
  downloadProgress: {}
}

// Mock the store module
vi.mock('../../src/stores/exportStore.js', () => ({
  useExportStore: vi.fn(() => mockExportStore)
}))

// Import after mocking
import { useExportStore } from '../../src/stores/exportStore.js'

// Create Vuetify instance for testing
const vuetify = createVuetify({
  components,
  directives
})

describe('ExportHistory', () => {
  let wrapper
  let pinia

  // Mock export history data for testing
  const mockExportHistory = [
    {
      _id: 'export-1',
      format: 'csv',
      status: 'completed',
      progress: 100,
      createdAt: '2024-05-01T10:00:00Z',
      completedAt: '2024-05-01T10:05:00Z',
      filename: 'task-export-1.csv',
      totalRecords: 150,
      fileSize: 7168, // 7KB
      filters: {
        status: ['pending', 'in-progress'],
        dateFrom: '2024-01-01',
        dateTo: '2024-04-30'
      },
      downloadUrl: '/api/exports/export-1/download'
    },
    {
      _id: 'export-2',
      format: 'json',
      status: 'completed',
      progress: 100,
      createdAt: '2024-05-02T12:00:00Z',
      completedAt: '2024-05-02T12:03:00Z',
      filename: 'task-export-2.json',
      totalRecords: 75,
      fileSize: 12288, // 12KB
      filters: {
        priority: ['high'],
        search: 'urgent'
      },
      downloadUrl: '/api/exports/export-2/download'
    },
    {
      _id: 'export-3',
      format: 'csv',
      status: 'failed',
      progress: 45,
      createdAt: '2024-05-03T14:00:00Z',
      failedAt: '2024-05-03T14:02:00Z',
      error: 'Database connection timeout',
      filters: {
        assignee: ['john.doe']
      }
    }
  ]

  const createWrapper = (exportHistory = mockExportHistory) => {
    // Mock the store to return our test export history
    vi.mocked(useExportStore).mockImplementation(() => ({
      fetchExports: vi.fn().mockResolvedValue(exportHistory),
      downloadExport: vi.fn().mockResolvedValue({}),
      deleteExport: vi.fn().mockResolvedValue({}),
      retryExport: vi.fn().mockResolvedValue({}),
      loading: false,
      error: null,
      exportHistory: exportHistory,
      pagination: {
        page: 1,
        limit: 10,
        total: exportHistory.length,
        pages: Math.ceil(exportHistory.length / 10)
      },
      downloadProgress: {}
    }))

    return mount(ExportHistory, {
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

  describe('Component Initialization and Data Loading', () => {
    it('should fetch export history on mount', async () => {
      wrapper = createWrapper()

      const exportStore = useExportStore()
      expect(exportStore.fetchExports).toHaveBeenCalledTimes(1)
    })

    it('should show loading state while fetching data', async () => {
      // Mock loading state
      vi.mocked(useExportStore).mockImplementation(() => ({
        fetchExports: vi.fn().mockResolvedValue([]),
        loading: true,
        exportHistory: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          pages: 0
        }
      }))

      wrapper = mount(ExportHistory, {
        global: {
          plugins: [vuetify, pinia]
        }
      })

      const loadingProgress = wrapper.find('[data-test="loading-progress"]')
      expect(loadingProgress.exists()).toBe(true)
    })

    it('should display error message when fetch fails', async () => {
      const errorMessage = 'Failed to load export history'

      // Mock error state
      vi.mocked(useExportStore).mockImplementation(() => ({
        fetchExports: vi.fn().mockRejectedValue(new Error(errorMessage)),
        loading: false,
        error: errorMessage,
        exportHistory: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          pages: 0
        }
      }))

      wrapper = mount(ExportHistory, {
        global: {
          plugins: [vuetify, pinia]
        }
      })
      await nextTick()

      const errorAlert = wrapper.find('[data-test="error-alert"]')
      expect(errorAlert.exists()).toBe(true)
      expect(errorAlert.text()).toContain(errorMessage)
    })
  })

  describe('Export History Table Display', () => {
    it('should display export history in a table format', () => {
      wrapper = createWrapper()

      const historyTable = wrapper.find('[data-test="export-history-table"]')
      expect(historyTable.exists()).toBe(true)

      // Check table headers
      const tableHeaders = wrapper.findAll('[data-test="table-header"]')
      expect(tableHeaders.length).toBeGreaterThan(0)

      // Verify expected columns
      const headerTexts = tableHeaders.map((h) => h.text())
      expect(headerTexts).toContain('Date')
      expect(headerTexts).toContain('Format')
      expect(headerTexts).toContain('Status')
      expect(headerTexts).toContain('Records')
      expect(headerTexts).toContain('Size')
      expect(headerTexts).toContain('Actions')
    })

    it('should display each export history entry correctly', () => {
      wrapper = createWrapper()

      const historyRows = wrapper.findAll('[data-test="history-row"]')
      expect(historyRows).toHaveLength(mockExportHistory.length)

      // Check first row details
      const firstRow = historyRows[0]
      expect(firstRow.find('[data-test="export-date"]').text()).toContain(
        '2024-05-01'
      )
      expect(firstRow.find('[data-test="export-format"]').text()).toContain(
        'CSV'
      )
      expect(firstRow.find('[data-test="export-status"]').text()).toContain(
        'Completed'
      )
      expect(firstRow.find('[data-test="export-records"]').text()).toContain(
        '150'
      )
      expect(firstRow.find('[data-test="export-size"]').text()).toContain('7KB')
    })

    it('should format dates in a user-friendly way', () => {
      wrapper = createWrapper()

      const dateCells = wrapper.findAll('[data-test="export-date"]')
      expect(dateCells[0].text()).not.toContain('T') // Should not show raw ISO format
      expect(dateCells[0].text()).toContain('2024-05-01') // Should contain the date part
    })

    it('should show appropriate status indicators with correct colors', () => {
      wrapper = createWrapper()

      const statusChips = wrapper.findAll('[data-test="status-chip"]')

      // Check completed status
      expect(statusChips[0].classes()).toContain('bg-success')
      expect(statusChips[0].text()).toContain('Completed')

      // Check failed status
      expect(statusChips[2].classes()).toContain('bg-error')
      expect(statusChips[2].text()).toContain('Failed')
    })

    it('should format file sizes in a human-readable format', () => {
      wrapper = createWrapper()

      const sizeCells = wrapper.findAll('[data-test="export-size"]')
      expect(sizeCells[0].text()).toContain('KB') // Should use KB format
      expect(sizeCells[0].text()).not.toContain('7168') // Should not show raw bytes
      expect(sizeCells[0].text()).toContain('7KB') // Should show formatted size
    })
  })

  describe('Pagination Functionality', () => {
    it('should display pagination controls when there are multiple pages', () => {
      // Create mock data with more than one page
      const manyExports = Array.from({ length: 15 }, (_, i) => ({
        _id: `export-${i + 1}`,
        format: 'csv',
        status: 'completed',
        createdAt: `2024-05-0${(i % 9) + 1}T10:00:00Z`
      }))

      // Mock pagination data
      vi.mocked(useExportStore).mockImplementation(() => ({
        fetchExports: vi.fn().mockResolvedValue(manyExports.slice(0, 10)),
        loading: false,
        error: null,
        exportHistory: manyExports.slice(0, 10),
        pagination: {
          page: 1,
          limit: 10,
          total: 15,
          pages: 2
        }
      }))

      wrapper = mount(ExportHistory, {
        global: {
          plugins: [vuetify, pinia]
        }
      })

      const pagination = wrapper.find('[data-test="pagination"]')
      expect(pagination.exists()).toBe(true)
    })

    it('should load next page when pagination is clicked', async () => {
      // Create mock data with more than one page
      const manyExports = Array.from({ length: 15 }, (_, i) => ({
        _id: `export-${i + 1}`,
        format: 'csv',
        status: 'completed',
        createdAt: `2024-05-0${(i % 9) + 1}T10:00:00Z`
      }))

      // Mock store with pagination
      const mockFetchExports = vi
        .fn()
        .mockResolvedValueOnce(manyExports.slice(0, 10))
        .mockResolvedValueOnce(manyExports.slice(10, 15))

      vi.mocked(useExportStore).mockImplementation(() => ({
        fetchExports: mockFetchExports,
        loading: false,
        error: null,
        exportHistory: manyExports.slice(0, 10),
        pagination: {
          page: 1,
          limit: 10,
          total: 15,
          pages: 2
        }
      }))

      wrapper = mount(ExportHistory, {
        global: {
          plugins: [vuetify, pinia]
        }
      })

      // Find next page button and click it
      const nextPageButton = wrapper.find('[data-test="next-page"]')
      await nextPageButton.trigger('click')

      // Verify fetchExports was called with page 2
      expect(mockFetchExports).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2
        })
      )
    })

    it('should allow changing items per page', async () => {
      const mockFetchExports = vi.fn().mockResolvedValue(mockExportHistory)

      vi.mocked(useExportStore).mockImplementation(() => ({
        fetchExports: mockFetchExports,
        loading: false,
        error: null,
        exportHistory: mockExportHistory,
        pagination: {
          page: 1,
          limit: 10,
          total: mockExportHistory.length,
          pages: 1
        }
      }))

      wrapper = mount(ExportHistory, {
        global: {
          plugins: [vuetify, pinia]
        }
      })

      // Find items per page selector and change it
      const itemsPerPageSelect = wrapper.find('[data-test="items-per-page"]')
      await itemsPerPageSelect.trigger('click')

      // Select 25 items per page option
      const option25 = wrapper.find('[data-test="option-25"]')
      await option25.trigger('click')

      // Verify fetchExports was called with limit 25
      expect(mockFetchExports).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 25
        })
      )
    })
  })

  describe('Export Metadata Display', () => {
    it('should show filter summary when expanding an export row', async () => {
      wrapper = createWrapper()

      // Find expand button and click it
      const expandButton = wrapper.find('[data-test="expand-row-export-1"]')
      await expandButton.trigger('click')

      // Check if filter details are displayed
      const filterDetails = wrapper.find(
        '[data-test="filter-details-export-1"]'
      )
      expect(filterDetails.exists()).toBe(true)
      expect(filterDetails.text()).toContain('Status: pending, in-progress')
      expect(filterDetails.text()).toContain(
        'Date Range: 2024-01-01 to 2024-04-30'
      )
    })

    it('should format different types of filters correctly', async () => {
      wrapper = createWrapper()

      // Expand the second export with different filter types
      const expandButton = wrapper.find('[data-test="expand-row-export-2"]')
      await expandButton.trigger('click')

      const filterDetails = wrapper.find(
        '[data-test="filter-details-export-2"]'
      )
      expect(filterDetails.exists()).toBe(true)
      expect(filterDetails.text()).toContain('Priority: high')
      expect(filterDetails.text()).toContain('Search: "urgent"')
    })

    it('should display creation and completion timestamps', async () => {
      wrapper = createWrapper()

      // Expand the first export
      const expandButton = wrapper.find('[data-test="expand-row-export-1"]')
      await expandButton.trigger('click')

      const timeDetails = wrapper.find('[data-test="time-details-export-1"]')
      expect(timeDetails.exists()).toBe(true)
      expect(timeDetails.text()).toContain('Created:')
      expect(timeDetails.text()).toContain('Completed:')
      expect(timeDetails.text()).toContain('Duration:')
      expect(timeDetails.text()).toContain('5 minutes') // Duration calculation
    })

    it('should show appropriate details for failed exports', async () => {
      wrapper = createWrapper()

      // Expand the failed export
      const expandButton = wrapper.find('[data-test="expand-row-export-3"]')
      await expandButton.trigger('click')

      const errorDetails = wrapper.find('[data-test="error-details-export-3"]')
      expect(errorDetails.exists()).toBe(true)
      expect(errorDetails.text()).toContain('Database connection timeout')

      const timeDetails = wrapper.find('[data-test="time-details-export-3"]')
      expect(timeDetails.text()).toContain('Failed:')
    })

    it('should handle missing filter data gracefully', async () => {
      // Create mock data with missing filters
      const exportsWithMissingData = [
        {
          _id: 'export-missing',
          format: 'csv',
          status: 'completed',
          createdAt: '2024-05-01T10:00:00Z'
          // No filters property
        }
      ]

      wrapper = createWrapper(exportsWithMissingData)

      // Expand the export with missing data
      const expandButton = wrapper.find(
        '[data-test="expand-row-export-missing"]'
      )
      await expandButton.trigger('click')

      // Check if filter details are displayed gracefully
      const filterDetails = wrapper.find(
        '[data-test="filter-details-export-missing"]'
      )
      expect(filterDetails.exists()).toBe(true)
      expect(filterDetails.text()).toContain('No filters applied')
    })
  })

  describe('Export Actions (Download, Delete, Retry)', () => {
    it('should show download button for completed exports', () => {
      wrapper = createWrapper()

      // Check download button for completed exports
      const downloadButtons = wrapper.findAll('[data-test="download-button"]')
      expect(downloadButtons.length).toBe(2) // Two completed exports in mock data
    })

    it('should trigger download when button is clicked', async () => {
      wrapper = createWrapper()
      const exportStore = useExportStore()

      // Find download button for first export and click it
      const downloadButton = wrapper.find(
        '[data-test="download-button-export-1"]'
      )
      await downloadButton.trigger('click')

      // Verify downloadExport was called
      expect(exportStore.downloadExport).toHaveBeenCalledWith(
        'export-1',
        'task-export-1.csv'
      )
    })

    it('should show download progress during download', async () => {
      // Mock download in progress
      vi.mocked(useExportStore).mockImplementation(() => ({
        fetchExports: vi.fn().mockResolvedValue(mockExportHistory),
        downloadExport: vi.fn().mockResolvedValue({}),
        loading: false,
        error: null,
        exportHistory: mockExportHistory,
        pagination: {
          page: 1,
          limit: 10,
          total: mockExportHistory.length,
          pages: 1
        },
        downloadProgress: {
          'export-1': { progress: 75, downloading: true }
        }
      }))

      wrapper = mount(ExportHistory, {
        global: {
          plugins: [vuetify, pinia]
        }
      })

      // Check for progress indicator
      const downloadProgress = wrapper.find(
        '[data-test="download-progress-export-1"]'
      )
      expect(downloadProgress.exists()).toBe(true)
      expect(downloadProgress.text()).toContain('75%')
    })

    it('should show delete button for each export', () => {
      wrapper = createWrapper()

      // Check delete buttons exist for all exports
      const deleteButtons = wrapper.findAll('[data-test="delete-button"]')
      expect(deleteButtons.length).toBe(mockExportHistory.length)
    })

    it('should show confirmation dialog before deleting', async () => {
      wrapper = createWrapper()

      // Find delete button for first export and click it
      const deleteButton = wrapper.find('[data-test="delete-button-export-1"]')
      await deleteButton.trigger('click')

      // Check confirmation dialog is shown
      const confirmDialog = wrapper.find(
        '[data-test="delete-confirmation-dialog"]'
      )
      expect(confirmDialog.exists()).toBe(true)
      expect(confirmDialog.text()).toContain(
        'Are you sure you want to delete this export?'
      )
    })

    it('should delete export when confirmation is confirmed', async () => {
      wrapper = createWrapper()
      const exportStore = useExportStore()

      // Find delete button for first export and click it
      const deleteButton = wrapper.find('[data-test="delete-button-export-1"]')
      await deleteButton.trigger('click')

      // Find confirm button in dialog and click it
      const confirmButton = wrapper.find('[data-test="confirm-delete-button"]')
      await confirmButton.trigger('click')

      // Verify deleteExport was called
      expect(exportStore.deleteExport).toHaveBeenCalledWith('export-1')
    })

    it('should show retry button for failed exports', () => {
      wrapper = createWrapper()

      // Check retry button for failed export
      const retryButton = wrapper.find('[data-test="retry-button-export-3"]')
      expect(retryButton.exists()).toBe(true)
    })

    it('should trigger retry when button is clicked', async () => {
      wrapper = createWrapper()
      const exportStore = useExportStore()

      // Find retry button for failed export and click it
      const retryButton = wrapper.find('[data-test="retry-button-export-3"]')
      await retryButton.trigger('click')

      // Verify retryExport was called
      expect(exportStore.retryExport).toHaveBeenCalledWith('export-3')
    })

    it('should disable action buttons when loading', async () => {
      // Mock loading state
      vi.mocked(useExportStore).mockImplementation(() => ({
        fetchExports: vi.fn().mockResolvedValue(mockExportHistory),
        downloadExport: vi.fn().mockResolvedValue({}),
        deleteExport: vi.fn().mockResolvedValue({}),
        retryExport: vi.fn().mockResolvedValue({}),
        loading: true,
        error: null,
        exportHistory: mockExportHistory,
        pagination: {
          page: 1,
          limit: 10,
          total: mockExportHistory.length,
          pages: 1
        }
      }))

      wrapper = mount(ExportHistory, {
        global: {
          plugins: [vuetify, pinia]
        }
      })

      // Check action buttons are disabled
      const buttons = wrapper.findAll(
        '[data-test^="download-button"], [data-test^="delete-button"], [data-test^="retry-button"]'
      )
      buttons.forEach((button) => {
        expect(button.attributes('disabled')).toBeDefined()
      })
    })
  })

  describe('Empty and Error States', () => {
    it('should display empty state message when there are no exports', () => {
      wrapper = createWrapper([])

      const emptyState = wrapper.find('[data-test="empty-state"]')
      expect(emptyState.exists()).toBe(true)
      expect(emptyState.text()).toContain('No export history found')
    })

    it('should show error state when fetch fails', async () => {
      const errorMessage = 'Failed to load export history'

      // Mock error state
      vi.mocked(useExportStore).mockImplementation(() => ({
        fetchExports: vi.fn().mockRejectedValue(new Error(errorMessage)),
        loading: false,
        error: errorMessage,
        exportHistory: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          pages: 0
        }
      }))

      wrapper = mount(ExportHistory, {
        global: {
          plugins: [vuetify, pinia]
        }
      })
      await nextTick()

      const errorState = wrapper.find('[data-test="error-state"]')
      expect(errorState.exists()).toBe(true)
      expect(errorState.text()).toContain('Failed to load export history')
    })

    it('should provide a refresh button when error occurs', async () => {
      const errorMessage = 'Failed to load export history'
      const mockFetchExports = vi
        .fn()
        .mockRejectedValue(new Error(errorMessage))

      // Mock error state
      vi.mocked(useExportStore).mockImplementation(() => ({
        fetchExports: mockFetchExports,
        loading: false,
        error: errorMessage,
        exportHistory: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          pages: 0
        }
      }))

      wrapper = mount(ExportHistory, {
        global: {
          plugins: [vuetify, pinia]
        }
      })
      await nextTick()

      // Find refresh button and click it
      const refreshButton = wrapper.find('[data-test="refresh-button"]')
      expect(refreshButton.exists()).toBe(true)
      await refreshButton.trigger('click')

      // Verify fetchExports was called again
      expect(mockFetchExports).toHaveBeenCalledTimes(2)
    })

    it('should handle API error responses for actions gracefully', async () => {
      wrapper = createWrapper()
      const exportStore = useExportStore()

      // Mock API error for download
      exportStore.downloadExport.mockRejectedValueOnce(
        new Error('Download failed')
      )

      // Try to download
      const downloadButton = wrapper.find(
        '[data-test="download-button-export-1"]'
      )
      await downloadButton.trigger('click')

      // Check error message is displayed
      const errorMessage = wrapper.find('[data-test="action-error-message"]')
      expect(errorMessage.exists()).toBe(true)
      expect(errorMessage.text()).toContain('Download failed')
    })

    it('should update UI after successful actions', async () => {
      const mockFetchExports = vi
        .fn()
        .mockResolvedValueOnce(mockExportHistory)
        .mockResolvedValueOnce([...mockExportHistory.slice(1)]) // Return without first export

      vi.mocked(useExportStore).mockImplementation(() => ({
        fetchExports: mockFetchExports,
        deleteExport: vi.fn().mockResolvedValue({}),
        loading: false,
        error: null,
        exportHistory: mockExportHistory,
        pagination: {
          page: 1,
          limit: 10,
          total: mockExportHistory.length,
          pages: 1
        }
      }))

      wrapper = mount(ExportHistory, {
        global: {
          plugins: [vuetify, pinia]
        }
      })

      const exportStore = useExportStore()

      // Delete an export
      const deleteButton = wrapper.find('[data-test="delete-button-export-1"]')
      await deleteButton.trigger('click')

      // Confirm deletion
      const confirmButton = wrapper.find('[data-test="confirm-delete-button"]')
      await confirmButton.trigger('click')

      expect(exportStore.deleteExport).toHaveBeenCalledWith('export-1')
      expect(mockFetchExports).toHaveBeenCalledTimes(2) // Initial + refresh after delete
    })
  })

  describe('Filters and Sorting', () => {
    it('should provide filter options for export history', () => {
      wrapper = createWrapper()

      const filterSection = wrapper.find('[data-test="filter-section"]')
      expect(filterSection.exists()).toBe(true)

      // Check for format filter
      const formatFilter = wrapper.find('[data-test="format-filter"]')
      expect(formatFilter.exists()).toBe(true)
    })

    it('should apply format filter when selected', async () => {
      wrapper = createWrapper()
      const exportStore = useExportStore()

      // Find format filter and select CSV
      const formatFilter = wrapper.find('[data-test="format-filter"]')
      await formatFilter.trigger('click')

      const csvOption = wrapper.find('[data-test="format-option-csv"]')
      await csvOption.trigger('click')

      // Verify fetchExports was called with format filter
      expect(exportStore.fetchExports).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'csv'
        })
      )
    })

    it('should apply status filter when selected', async () => {
      wrapper = createWrapper()
      const exportStore = useExportStore()

      // Find status filter and select completed
      const statusFilter = wrapper.find('[data-test="status-filter"]')
      await statusFilter.trigger('click')

      const completedOption = wrapper.find(
        '[data-test="status-option-completed"]'
      )
      await completedOption.trigger('click')

      // Verify fetchExports was called with status filter
      expect(exportStore.fetchExports).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed'
        })
      )
    })

    it('should allow date range filtering', async () => {
      wrapper = createWrapper()
      const exportStore = useExportStore()

      // Set date from filter
      const dateFromFilter = wrapper.find('[data-test="date-from-filter"]')
      await dateFromFilter.setValue('2024-05-01')
      await dateFromFilter.trigger('change')

      // Set date to filter
      const dateToFilter = wrapper.find('[data-test="date-to-filter"]')
      await dateToFilter.setValue('2024-05-31')
      await dateToFilter.trigger('change')

      // Apply date filters
      const applyFiltersButton = wrapper.find(
        '[data-test="apply-filters-button"]'
      )
      await applyFiltersButton.trigger('click')

      // Verify fetchExports was called with date filters
      expect(exportStore.fetchExports).toHaveBeenCalledWith(
        expect.objectContaining({
          dateFrom: '2024-05-01',
          dateTo: '2024-05-31'
        })
      )
    })

    it('should provide sorting options for export history', async () => {
      wrapper = createWrapper()

      const sortSection = wrapper.find('[data-test="sort-section"]')
      expect(sortSection.exists()).toBe(true)

      // Check for date sort option
      const dateSort = wrapper.find('[data-test="sort-by-date"]')
      expect(dateSort.exists()).toBe(true)
    })

    it('should apply sorting when selected', async () => {
      wrapper = createWrapper()
      const exportStore = useExportStore()

      // Find sort by size option and click it
      const sizeSort = wrapper.find('[data-test="sort-by-size"]')
      await sizeSort.trigger('click')

      // Verify fetchExports was called with sort parameters
      expect(exportStore.fetchExports).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'fileSize',
          sortOrder: 'desc'
        })
      )
    })

    it('should toggle sort direction when clicked again', async () => {
      wrapper = createWrapper()
      const exportStore = useExportStore()

      // Find sort by date option and click it twice
      const dateSort = wrapper.find('[data-test="sort-by-date"]')
      await dateSort.trigger('click') // First click - desc
      await dateSort.trigger('click') // Second click - asc

      // Verify fetchExports was called with changed sort direction
      expect(exportStore.fetchExports).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'createdAt',
          sortOrder: 'asc'
        })
      )
    })

    it('should clear all filters when reset button clicked', async () => {
      wrapper = createWrapper()
      const exportStore = useExportStore()

      // Apply some filters first
      const formatFilter = wrapper.find('[data-test="format-filter"]')
      await formatFilter.trigger('click')
      const csvOption = wrapper.find('[data-test="format-option-csv"]')
      await csvOption.trigger('click')

      // Now clear filters
      const resetFiltersButton = wrapper.find(
        '[data-test="reset-filters-button"]'
      )
      await resetFiltersButton.trigger('click')

      // Verify fetchExports was called without filters
      expect(exportStore.fetchExports).toHaveBeenCalledWith({
        page: 1,
        limit: 10
      })
    })
  })
})
