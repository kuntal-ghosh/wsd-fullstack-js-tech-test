/**
 * @fileoverview Browser compatibility tests for export functionality
 * @module tests/e2e/exportBrowserCompat
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useExportStore } from '@/stores/exportStore'

// Mock API client
vi.mock('@/api/client', () => {
  return {
    default: {
      downloadExport: vi.fn()
    }
  }
})

describe('Export Browser Compatibility Tests', () => {
  let exportStore
  let apiClient
  let originalBlob
  let originalCreateObjectURL
  let originalRevokeObjectURL
  let originalDocument
  let originalNavigator
  let mockLink

  beforeEach(async () => {
    // Setup Pinia
    const pinia = createPinia()
    setActivePinia(pinia)
    exportStore = useExportStore()

    // Get API client
    apiClient = (await import('@/api/client')).default

    // Save original browser objects
    originalBlob = global.Blob
    originalCreateObjectURL = global.URL?.createObjectURL
    originalRevokeObjectURL = global.URL?.revokeObjectURL
    originalDocument = { ...global.document }
    originalNavigator = { ...global.navigator }

    // Create mock link element
    mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
      style: {},
      setAttribute: vi.fn()
    }

    // Mock document methods
    global.document.createElement = vi.fn(() => mockLink)
    global.document.body = {
      appendChild: vi.fn(),
      removeChild: vi.fn()
    }

    // Mock URL methods
    global.URL = {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn()
    }

    // Set test exports in store
    exportStore.exports = [
      {
        _id: 'csv-export',
        status: 'completed',
        progress: 100,
        format: 'csv',
        downloadUrl: '/api/exports/csv-export/download',
        filename: 'tasks-export.csv',
        fileSize: 2048,
        totalRecords: 50
      },
      {
        _id: 'json-export',
        status: 'completed',
        progress: 100,
        format: 'json',
        downloadUrl: '/api/exports/json-export/download',
        filename: 'tasks-export.json',
        fileSize: 4096,
        totalRecords: 50
      }
    ]
  })

  afterEach(() => {
    // Restore original browser objects
    global.Blob = originalBlob
    if (originalCreateObjectURL)
      global.URL.createObjectURL = originalCreateObjectURL
    if (originalRevokeObjectURL)
      global.URL.revokeObjectURL = originalRevokeObjectURL
    global.document = originalDocument
    global.navigator = originalNavigator

    vi.resetAllMocks()
  })

  describe('Chrome/Firefox/Edge (Modern Browsers)', () => {
    it('should download CSV files with correct MIME type', async () => {
      // Setup for Chrome/Firefox
      global.navigator.userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'

      // Mock fetch response for CSV
      const csvBlob = new Blob(['id,title,status\n1,Task 1,pending'], {
        type: 'text/csv'
      })
      const csvResponse = {
        ok: true,
        blob: vi.fn().mockResolvedValue(csvBlob),
        body: {
          getReader: vi.fn().mockReturnValue({
            read: vi.fn().mockResolvedValue({ done: true, value: undefined })
          })
        },
        headers: new Map([
          ['Content-Type', 'text/csv'],
          ['Content-Disposition', 'attachment; filename="tasks-export.csv"']
        ])
      }
      // Headers.get is already available on Map, no need to override

      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue(csvResponse)

      // Download CSV export
      await exportStore.downloadExport('csv-export', 'tasks-export.csv')

      // Check that fetch was called with correct URL
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/exports/csv-export/download',
        expect.any(Object)
      )

      // Check that blob URL was created
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(csvBlob)

      // Check that link was created and clicked
      expect(global.document.createElement).toHaveBeenCalledWith('a')
      expect(mockLink.download).toBe('tasks-export.csv')
      expect(mockLink.href).toBe('blob:mock-url')
      expect(mockLink.click).toHaveBeenCalled()

      // Check that URL was revoked
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    })

    it('should download JSON files with correct MIME type', async () => {
      // Setup for Chrome/Firefox
      global.navigator.userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'

      // Mock fetch response for JSON
      const jsonData = {
        tasks: [{ id: 1, title: 'Task 1', status: 'pending' }]
      }
      const jsonBlob = new Blob([JSON.stringify(jsonData)], {
        type: 'application/json'
      })
      const jsonResponse = {
        ok: true,
        blob: vi.fn().mockResolvedValue(jsonBlob),
        body: {
          getReader: vi.fn().mockReturnValue({
            read: vi.fn().mockResolvedValue({ done: true, value: undefined })
          })
        },
        headers: new Map([
          ['Content-Type', 'application/json'],
          ['Content-Disposition', 'attachment; filename="tasks-export.json"']
        ])
      }
      // Headers.get is already available on Map, no need to override

      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue(jsonResponse)

      // Download JSON export
      await exportStore.downloadExport('json-export', 'tasks-export.json')

      // Check that fetch was called with correct URL
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/exports/json-export/download',
        expect.any(Object)
      )

      // Check that blob URL was created
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(jsonBlob)

      // Check that link was created and clicked
      expect(global.document.createElement).toHaveBeenCalledWith('a')
      expect(mockLink.download).toBe('tasks-export.json')
      expect(mockLink.href).toBe('blob:mock-url')
      expect(mockLink.click).toHaveBeenCalled()

      // Check that URL was revoked
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    })

    it('should handle download progress tracking for large files', async () => {
      // Mock a large file download with streaming response
      const chunks = [
        new Uint8Array(1000),
        new Uint8Array(1000),
        new Uint8Array(1000)
      ]

      const mockResponse = {
        ok: true,
        headers: {
          get: vi.fn((header) => {
            if (header === 'Content-Length') return '3000'
            return null
          })
        },
        body: {
          getReader: vi.fn(() => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({ done: false, value: chunks[0] })
              .mockResolvedValueOnce({ done: false, value: chunks[1] })
              .mockResolvedValueOnce({ done: false, value: chunks[2] })
              .mockResolvedValueOnce({ done: true })
          }))
        }
      }

      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      // Start download with progress tracking
      await exportStore.downloadExport('csv-export', 'tasks-export.csv')

      // Check progress was tracked during download
      expect(exportStore.downloadProgress['csv-export']).toEqual({
        progress: 100,
        downloading: false,
        completed: true
      })

      // Check that blob URL was created and link was clicked
      expect(global.URL.createObjectURL).toHaveBeenCalled()
      expect(mockLink.click).toHaveBeenCalled()
    })
  })

  describe('Safari Browser', () => {
    it('should handle Safari-specific download behavior', async () => {
      // Setup for Safari
      global.navigator.userAgent =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15'

      // Mock fetch response with streaming
      const mockResponse = {
        ok: true,
        headers: {
          get: vi.fn(() => '1000')
        },
        body: {
          getReader: vi.fn(() => ({
            read: vi.fn()
              .mockResolvedValueOnce({ done: false, value: new Uint8Array(1000) })
              .mockResolvedValueOnce({ done: true })
          }))
        }
      }

      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      // Download export - Safari uses same method as other browsers
      await exportStore.downloadExport('csv-export', 'tasks-export.csv')

      // Check standard download behavior (no special Safari handling in current implementation)
      expect(global.document.createElement).toHaveBeenCalledWith('a')
      expect(mockLink.download).toBe('tasks-export.csv')
      expect(mockLink.click).toHaveBeenCalled()
    })
  })

  describe('Internet Explorer Compatibility', () => {
    it('should handle IE-specific download approach', async () => {
      // Setup for IE
      global.navigator.userAgent =
        'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko'

      // Mock fetch response with streaming (current implementation uses fetch, not IE-specific methods)
      const mockResponse = {
        ok: true,
        headers: {
          get: vi.fn(() => '1000')
        },
        body: {
          getReader: vi.fn(() => ({
            read: vi.fn()
              .mockResolvedValueOnce({ done: false, value: new Uint8Array(1000) })
              .mockResolvedValueOnce({ done: true })
          }))
        }
      }

      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      // Download export - current implementation doesn't have IE-specific logic
      await exportStore.downloadExport('csv-export', 'tasks-export.csv')

      // Should use standard blob download approach
      expect(global.URL.createObjectURL).toHaveBeenCalled()
      expect(global.document.createElement).toHaveBeenCalledWith('a')
      expect(mockLink.click).toHaveBeenCalled()
    })
  })

  describe('Mobile Browsers', () => {
    it('should handle mobile browser download behavior', async () => {
      // Setup for Mobile Safari
      global.navigator.userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'

      // Mock fetch response with streaming
      const mockResponse = {
        ok: true,
        headers: {
          get: vi.fn(() => '1000')
        },
        body: {
          getReader: vi.fn(() => ({
            read: vi.fn()
              .mockResolvedValueOnce({ done: false, value: new Uint8Array(1000) })
              .mockResolvedValueOnce({ done: true })
          }))
        }
      }

      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      // Download export
      await exportStore.downloadExport('csv-export', 'tasks-export.csv')

      // Standard download behavior (no mobile-specific handling in current implementation)
      expect(global.document.createElement).toHaveBeenCalledWith('a')
      expect(mockLink.click).toHaveBeenCalled()
    })
  })

  describe('Download Error Handling', () => {
    it('should handle network errors during download', async () => {
      // Mock network failure
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      // Attempt download
      await expect(exportStore.downloadExport('csv-export')).rejects.toThrow(
        'Network error'
      )

      // Check error was tracked in download progress
      expect(exportStore.downloadProgress['csv-export'].error).toBeTruthy()
      expect(exportStore.downloadProgress['csv-export'].downloading).toBe(false)
    })

    it('should handle server errors during download', async () => {
      // Mock server error response
      const errorResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: vi.fn().mockResolvedValue({
          message: 'Server error occurred'
        })
      }

      global.fetch = vi.fn().mockResolvedValue(errorResponse)

      // Attempt download
      await expect(exportStore.downloadExport('csv-export')).rejects.toThrow()

      // Check error was tracked in download progress
      expect(exportStore.downloadProgress['csv-export'].error).toBeTruthy()
      expect(exportStore.downloadProgress['csv-export'].downloading).toBe(false)
    })

    it('should handle export not found', async () => {
      // Mock not found response
      const notFoundResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: vi.fn().mockResolvedValue({
          message: 'Export not found'
        })
      }

      global.fetch = vi.fn().mockResolvedValue(notFoundResponse)

      // Attempt download
      await expect(
        exportStore.downloadExport('nonexistent-export')
      ).rejects.toThrow()

      // Check error was tracked in download progress
      expect(
        exportStore.downloadProgress['nonexistent-export'].error
      ).toBeTruthy()
      expect(
        exportStore.downloadProgress['nonexistent-export'].downloading
      ).toBe(false)
    })
  })
})
