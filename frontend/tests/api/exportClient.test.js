/**
 * @fileoverview Unit tests for export API client methods
 * @module tests/api/exportClient.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import apiClient from '../../src/api/client.js'

// Mock fetch globally
global.fetch = vi.fn()

describe('Export API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset console.error mock
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createExport', () => {
    it('should create export with valid configuration', async () => {
      const exportConfig = {
        format: 'csv',
        filters: {
          status: 'pending',
          priority: 'high'
        },
        fields: ['title', 'status', 'priority', 'createdAt']
      }

      const mockResponse = {
        success: true,
        data: {
          _id: 'export-123',
          ...exportConfig,
          status: 'pending',
          progress: 0,
          createdAt: '2024-01-01T10:00:00Z'
        }
      }

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const result = await apiClient.createExport(exportConfig)

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/exports',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(exportConfig)
        }
      )
      expect(result).toEqual(mockResponse)
    })

    it('should handle createExport validation errors', async () => {
      const invalidConfig = {
        format: 'invalid-format'
      }

      const errorResponse = {
        success: false,
        message: 'Invalid export format. Supported formats: csv, json, xlsx'
      }

      global.fetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => errorResponse
      })

      await expect(apiClient.createExport(invalidConfig)).rejects.toThrow(
        'Invalid export format. Supported formats: csv, json, xlsx'
      )

      expect(console.error).toHaveBeenCalledWith(
        'API Request failed:',
        expect.any(Error)
      )
    })

    it('should handle createExport with minimal configuration', async () => {
      const minimalConfig = {
        format: 'json'
      }

      const mockResponse = {
        success: true,
        data: {
          _id: 'export-minimal',
          format: 'json',
          status: 'pending',
          progress: 0,
          filters: {},
          fields: []
        }
      }

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const result = await apiClient.createExport(minimalConfig)

      expect(result).toEqual(mockResponse)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(minimalConfig)
        })
      )
    })

    it('should handle createExport with complex filters', async () => {
      const complexConfig = {
        format: 'xlsx',
        filters: {
          status: ['pending', 'in-progress'],
          priority: 'high',
          assignee: 'user-123',
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
          search: 'important project'
        },
        fields: [
          'title',
          'description',
          'status',
          'priority',
          'assignee',
          'createdAt',
          'updatedAt'
        ]
      }

      const mockResponse = {
        success: true,
        data: {
          _id: 'export-complex',
          ...complexConfig,
          status: 'pending'
        }
      }

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const result = await apiClient.createExport(complexConfig)

      expect(result).toEqual(mockResponse)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(complexConfig)
        })
      )
    })
  })

  describe('getExportStatus', () => {
    it('should get export status successfully', async () => {
      const exportId = 'export-status-123'
      const mockResponse = {
        success: true,
        data: {
          _id: exportId,
          status: 'processing',
          progress: 45,
          message: 'Filtering and processing records...',
          estimatedCompletion: '2024-01-01T10:05:00Z',
          processedRecords: 450,
          totalRecords: 1000
        }
      }

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const result = await apiClient.getExportStatus(exportId)

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:3001/api/exports/${exportId}/status`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
      expect(result).toEqual(mockResponse)
    })

    it('should handle getExportStatus for completed export', async () => {
      const exportId = 'export-completed'
      const mockResponse = {
        success: true,
        data: {
          _id: exportId,
          status: 'completed',
          progress: 100,
          completedAt: '2024-01-01T10:05:00Z',
          fileSize: 2048,
          totalRecords: 1000,
          downloadUrl: `/api/exports/${exportId}/download`
        }
      }

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const result = await apiClient.getExportStatus(exportId)

      expect(result).toEqual(mockResponse)
      expect(result.data.status).toBe('completed')
      expect(result.data.progress).toBe(100)
    })

    it('should handle getExportStatus for failed export', async () => {
      const exportId = 'export-failed'
      const mockResponse = {
        success: true,
        data: {
          _id: exportId,
          status: 'failed',
          progress: 25,
          error: 'Database connection timeout',
          failedAt: '2024-01-01T10:03:00Z',
          retryCount: 2
        }
      }

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const result = await apiClient.getExportStatus(exportId)

      expect(result).toEqual(mockResponse)
      expect(result.data.status).toBe('failed')
      expect(result.data.error).toBe('Database connection timeout')
    })

    it('should handle getExportStatus not found error', async () => {
      const nonExistentId = 'non-existent-export'
      const errorResponse = {
        success: false,
        message: 'Export not found'
      }

      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => errorResponse
      })

      await expect(apiClient.getExportStatus(nonExistentId)).rejects.toThrow(
        'Export not found'
      )
    })
  })

  describe('downloadExport', () => {
    it('should download export successfully', async () => {
      const exportId = 'download-test'
      const mockBlob = new Blob(['csv,data,here'], { type: 'text/csv' })

      const mockResponse = {
        ok: true,
        headers: {
          get: vi.fn((header) => {
            if (header === 'Content-Type') return 'text/csv'
            if (header === 'Content-Length') return '1000'
            if (header === 'Content-Disposition')
              return 'attachment; filename="export.csv"'
            return null
          })
        },
        blob: async () => mockBlob
      }

      global.fetch.mockResolvedValue(mockResponse)

      const result = await apiClient.downloadExport(exportId)

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:3001/api/exports/${exportId}/download`,
        {
          headers: {}
        }
      )
      expect(result).toEqual(mockResponse)
      expect(result.ok).toBe(true)
    })

    it('should download export with custom headers', async () => {
      const exportId = 'download-with-headers'
      const customOptions = {
        headers: {
          Authorization: 'Bearer token123',
          Accept: 'application/octet-stream'
        }
      }

      const mockResponse = {
        ok: true,
        headers: {
          get: vi.fn(
            () =>
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          )
        }
      }

      global.fetch.mockResolvedValue(mockResponse)

      await apiClient.downloadExport(exportId, customOptions)

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:3001/api/exports/${exportId}/download`,
        {
          headers: {
            Authorization: 'Bearer token123',
            Accept: 'application/octet-stream'
          }
        }
      )
    })

    it('should handle download export not ready error', async () => {
      const exportId = 'not-ready-export'
      const errorResponse = {
        success: false,
        message: 'Export is still processing. Current status: processing'
      }

      global.fetch.mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => errorResponse
      })

      await expect(apiClient.downloadExport(exportId)).rejects.toThrow(
        'Export is still processing. Current status: processing'
      )

      expect(console.error).toHaveBeenCalledWith(
        'Export download failed:',
        expect.any(Error)
      )
    })

    it('should handle download export file not found', async () => {
      const exportId = 'missing-file-export'

      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({})
      })

      await expect(apiClient.downloadExport(exportId)).rejects.toThrow(
        'Download failed! status: 404'
      )
    })

    it('should handle download network error gracefully', async () => {
      const exportId = 'network-error-export'

      global.fetch.mockRejectedValue(new Error('Network error'))

      await expect(apiClient.downloadExport(exportId)).rejects.toThrow(
        'Network error'
      )

      expect(console.error).toHaveBeenCalledWith(
        'Export download failed:',
        expect.any(Error)
      )
    })

    it('should handle download with invalid JSON error response', async () => {
      const exportId = 'invalid-json-export'

      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('Invalid JSON')
        }
      })

      await expect(apiClient.downloadExport(exportId)).rejects.toThrow(
        'Download failed! status: 500'
      )
    })
  })

  describe('getExportHistory', () => {
    it('should get export history without filters', async () => {
      const mockResponse = {
        success: true,
        data: {
          exports: [
            {
              _id: 'export-1',
              format: 'csv',
              status: 'completed',
              createdAt: '2024-01-01T10:00:00Z',
              completedAt: '2024-01-01T10:05:00Z',
              totalRecords: 500
            },
            {
              _id: 'export-2',
              format: 'json',
              status: 'failed',
              createdAt: '2024-01-01T09:00:00Z',
              failedAt: '2024-01-01T09:03:00Z',
              error: 'Database error'
            }
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 2,
            pages: 1
          }
        }
      }

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const result = await apiClient.getExportHistory()

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/exports/history',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
      expect(result).toEqual(mockResponse)
      expect(result.data.exports).toHaveLength(2)
    })

    it('should get export history with filters and pagination', async () => {
      const filters = {
        status: 'completed',
        format: 'csv',
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        page: 2,
        limit: 5
      }

      const mockResponse = {
        success: true,
        data: {
          exports: [
            {
              _id: 'export-filtered',
              format: 'csv',
              status: 'completed',
              createdAt: '2024-06-01T10:00:00Z',
              totalRecords: 1000
            }
          ],
          pagination: {
            page: 2,
            limit: 5,
            total: 6,
            pages: 2
          },
          appliedFilters: filters
        }
      }

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const result = await apiClient.getExportHistory(filters)

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/exports/history?status=completed&format=csv&dateFrom=2024-01-01&dateTo=2024-12-31&page=2&limit=5',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
      expect(result).toEqual(mockResponse)
      expect(result.data.appliedFilters).toEqual(filters)
    })

    it('should get export history with user-specific filtering', async () => {
      const filters = {
        userId: 'user-123',
        status: ['completed', 'failed'],
        sortBy: 'createdAt',
        sortOrder: 'desc'
      }

      const mockResponse = {
        success: true,
        data: {
          exports: [
            {
              _id: 'export-user-1',
              userId: 'user-123',
              format: 'xlsx',
              status: 'completed'
            }
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            pages: 1
          }
        }
      }

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const result = await apiClient.getExportHistory(filters)

      expect(result).toEqual(mockResponse)
      expect(result.data.exports[0].userId).toBe('user-123')
    })

    it('should handle empty export history', async () => {
      const mockResponse = {
        success: true,
        data: {
          exports: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            pages: 0
          }
        }
      }

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const result = await apiClient.getExportHistory()

      expect(result).toEqual(mockResponse)
      expect(result.data.exports).toEqual([])
      expect(result.data.pagination.total).toBe(0)
    })

    it('should handle getExportHistory access denied error', async () => {
      const errorResponse = {
        success: false,
        message: 'Insufficient permissions to view export history'
      }

      global.fetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => errorResponse
      })

      await expect(apiClient.getExportHistory()).rejects.toThrow(
        'Insufficient permissions to view export history'
      )
    })
  })

  describe('deleteExport', () => {
    it('should delete export successfully', async () => {
      const exportId = 'delete-test-export'
      const mockResponse = {
        success: true,
        message: 'Export deleted successfully',
        data: {
          _id: exportId,
          deletedAt: '2024-01-01T10:00:00Z'
        }
      }

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const result = await apiClient.deleteExport(exportId)

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:3001/api/exports/${exportId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
      expect(result).toEqual(mockResponse)
      expect(result.message).toBe('Export deleted successfully')
    })

    it('should handle deleteExport not found error', async () => {
      const nonExistentId = 'non-existent-export'
      const errorResponse = {
        success: false,
        message: 'Export not found'
      }

      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => errorResponse
      })

      await expect(apiClient.deleteExport(nonExistentId)).rejects.toThrow(
        'Export not found'
      )
    })

    it('should handle deleteExport permission denied', async () => {
      const exportId = 'protected-export'
      const errorResponse = {
        success: false,
        message: 'Cannot delete export owned by another user'
      }

      global.fetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => errorResponse
      })

      await expect(apiClient.deleteExport(exportId)).rejects.toThrow(
        'Cannot delete export owned by another user'
      )
    })

    it('should handle deleteExport for active export', async () => {
      const activeExportId = 'active-export'
      const errorResponse = {
        success: false,
        message: 'Cannot delete export that is currently processing'
      }

      global.fetch.mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => errorResponse
      })

      await expect(apiClient.deleteExport(activeExportId)).rejects.toThrow(
        'Cannot delete export that is currently processing'
      )
    })
  })

  describe('Error Handling and Response Formatting', () => {
    it('should handle network errors consistently across all export methods', async () => {
      const networkError = new Error('Network connection failed')
      global.fetch.mockRejectedValue(networkError)

      const exportMethods = [
        () => apiClient.createExport({ format: 'csv' }),
        () => apiClient.getExportStatus('test-id'),
        () => apiClient.downloadExport('test-id'),
        () => apiClient.getExportHistory(),
        () => apiClient.deleteExport('test-id')
      ]

      for (const method of exportMethods) {
        await expect(method()).rejects.toThrow('Network connection failed')
      }

      expect(console.error).toHaveBeenCalledTimes(exportMethods.length)
    })

    it('should handle JSON parsing errors gracefully', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON')
        }
      })

      await expect(apiClient.createExport({ format: 'csv' })).rejects.toThrow(
        'Invalid JSON'
      )
    })

    it('should handle different HTTP error status codes', async () => {
      const testCases = [
        { status: 400, message: 'Bad Request' },
        { status: 401, message: 'Unauthorized' },
        { status: 403, message: 'Forbidden' },
        { status: 404, message: 'Not Found' },
        { status: 409, message: 'Conflict' },
        { status: 422, message: 'Validation Error' },
        { status: 500, message: 'Internal Server Error' },
        { status: 503, message: 'Service Unavailable' }
      ]

      for (const testCase of testCases) {
        global.fetch.mockResolvedValue({
          ok: false,
          status: testCase.status,
          json: async () => ({
            success: false,
            message: testCase.message
          })
        })

        await expect(apiClient.getExportStatus('test')).rejects.toThrow(
          testCase.message
        )
      }
    })

    it('should use default error message when response has no message', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          success: false
        })
      })

      await expect(apiClient.createExport({ format: 'csv' })).rejects.toThrow(
        'HTTP error! status: 500'
      )
    })
  })

  describe('Request/Response Data Transformation', () => {
    it('should properly serialize complex export configuration', async () => {
      const complexConfig = {
        format: 'xlsx',
        filters: {
          status: ['pending', 'in-progress'],
          priority: ['high', 'medium'],
          tags: ['urgent', 'client-request'],
          dateRange: {
            from: '2024-01-01T00:00:00Z',
            to: '2024-12-31T23:59:59Z'
          },
          assignees: ['user-1', 'user-2'],
          customFields: {
            department: 'engineering',
            project: 'web-app'
          }
        },
        fields: [
          'id',
          'title',
          'description',
          'status',
          'priority',
          'assignee',
          'createdAt',
          'updatedAt',
          'dueDate',
          'tags',
          'customFields.department',
          'customFields.project'
        ],
        options: {
          includeComments: true,
          includeAttachments: false,
          includeHistory: true,
          groupBy: 'status',
          sortBy: 'priority',
          sortOrder: 'desc'
        }
      }

      const mockResponse = {
        success: true,
        data: {
          _id: 'complex-export',
          ...complexConfig,
          status: 'pending'
        }
      }

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const result = await apiClient.createExport(complexConfig)

      // Verify that complex nested objects are properly serialized
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(complexConfig)
        })
      )

      expect(result).toEqual(mockResponse)
    })

    it('should handle response data with nested structures', async () => {
      const mockResponse = {
        success: true,
        data: {
          _id: 'nested-response',
          format: 'json',
          status: 'completed',
          metadata: {
            processing: {
              startedAt: '2024-01-01T10:00:00Z',
              completedAt: '2024-01-01T10:05:00Z',
              duration: '5 minutes'
            },
            statistics: {
              totalRecords: 1000,
              filteredRecords: 750,
              exportedRecords: 750,
              skippedRecords: 0
            },
            fileInfo: {
              size: 2048,
              compression: 'none',
              encoding: 'utf-8',
              mimeType: 'application/json'
            }
          }
        }
      }

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const result = await apiClient.getExportStatus('nested-response')

      expect(result).toEqual(mockResponse)
      expect(result.data.metadata.statistics.totalRecords).toBe(1000)
      expect(result.data.metadata.fileInfo.mimeType).toBe('application/json')
    })

    it('should preserve data types in request transformation', async () => {
      const configWithTypes = {
        format: 'csv',
        filters: {
          isActive: true,
          priority: ['high'],
          createdAfter: new Date('2024-01-01'),
          estimatedTime: 120,
          tags: null,
          description: undefined
        },
        options: {
          limit: 1000,
          offset: 0,
          includeDeleted: false
        }
      }

      const mockResponse = { success: true, data: { _id: 'type-test' } }
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      await apiClient.createExport(configWithTypes)

      const callArgs = global.fetch.mock.calls[0][1]
      const sentData = JSON.parse(callArgs.body)

      expect(sentData.filters.isActive).toBe(true)
      expect(sentData.options.limit).toBe(1000)
      expect(sentData.options.includeDeleted).toBe(false)
      expect(sentData.filters.createdAfter).toBe('2024-01-01T00:00:00.000Z')
    })

    it('should handle URL parameter encoding for export history', async () => {
      const filtersWithSpecialChars = {
        search: 'project name with spaces & symbols!',
        tags: ['tag with spaces', 'tag/with/slashes'],
        description: 'contains "quotes" and other chars: @#$%',
        dateFrom: '2024-01-01T10:00:00+05:30'
      }

      const mockResponse = { success: true, data: { exports: [] } }
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      await apiClient.getExportHistory(filtersWithSpecialChars)

      const callUrl = global.fetch.mock.calls[0][0]
      expect(callUrl.includes('search=project%20name%20with%20spaces%20%26%20symbols!')).toBe(true)
      expect(callUrl.includes('dateFrom=2024-01-01T10%3A00%3A00%2B05%3A30')).toBe(true)
    })
  })

  describe('Integration with Existing Error Handling Patterns', () => {
    it('should follow consistent error format across all export methods', async () => {
      const standardErrorResponse = {
        success: false,
        message: 'Standard error message',
        code: 'EXPORT_ERROR',
        details: {
          field: 'format',
          reason: 'invalid_value'
        }
      }

      global.fetch.mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => standardErrorResponse
      })

      const methods = [
        () => apiClient.createExport({}),
        () => apiClient.getExportStatus('test'),
        () => apiClient.getExportHistory(),
        () => apiClient.deleteExport('test')
      ]

      for (const method of methods) {
        await expect(method()).rejects.toThrow('Standard error message')
      }
    })

    it('should handle API client request method integration', async () => {
      // Test that export methods properly use the base request method
      const spy = vi.spyOn(apiClient, 'request')

      const mockResponse = { success: true, data: {} }
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      await apiClient.createExport({ format: 'csv' })
      await apiClient.getExportStatus('test-id')
      await apiClient.getExportHistory({ page: 1 })
      await apiClient.deleteExport('test-id')

      expect(spy).toHaveBeenCalledTimes(4)
      expect(spy).toHaveBeenCalledWith(
        '/exports',
        expect.objectContaining({
          method: 'POST'
        })
      )
      expect(spy).toHaveBeenCalledWith(
        '/exports/test-id/status',
        expect.objectContaining({
          method: 'GET'
        })
      )
      expect(spy).toHaveBeenCalledWith(
        '/exports/history?page=1',
        expect.objectContaining({
          method: 'GET'
        })
      )
      expect(spy).toHaveBeenCalledWith(
        '/exports/test-id',
        expect.objectContaining({
          method: 'DELETE'
        })
      )

      spy.mockRestore()
    })

    it('should maintain consistent header handling', async () => {
      const customHeaders = {
        Authorization: 'Bearer token123',
        'X-Request-ID': 'req-123'
      }

      // Mock the request method to check headers
      const originalRequest = apiClient.request
      apiClient.request = vi.fn().mockResolvedValue({ success: true })

      // Test that downloadExport handles headers differently (direct fetch)
      global.fetch.mockResolvedValue({
        ok: true,
        headers: { get: vi.fn() }
      })

      await apiClient.downloadExport('test-id', { headers: customHeaders })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: customHeaders
        })
      )

      // Restore original method
      apiClient.request = originalRequest
    })
  })
})
