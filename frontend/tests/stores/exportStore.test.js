/**
 * @fileoverview Unit tests for export store - state management, actions, and Socket.IO integration
 * @module tests/stores/exportStore.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useExportStore } from '../../src/stores/exportStore.js'

// Mock the API client
vi.mock('../../src/api/client.js', () => ({
  default: {
    baseURL: 'http://localhost:3001/api',
    getExports: vi.fn(),
    getExport: vi.fn(),
    createExport: vi.fn(),
    cancelExport: vi.fn(),
    retryExport: vi.fn()
  }
}))

// Mock the socket
vi.mock('../../src/plugins/socket.js', () => ({
  default: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  }
}))

// Mock fetch for download functionality
global.fetch = vi.fn()

// Mock DOM methods for file download
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: vi.fn(() => 'mock-url'),
    revokeObjectURL: vi.fn()
  }
})

describe('Export Store', () => {
  let exportStore
  let mockApiClient
  let mockSocket

  beforeEach(async () => {
    setActivePinia(createPinia())

    // Get mocked modules
    const apiModule = await vi.importMock('../../src/api/client.js')
    const socketModule = await vi.importMock('../../src/plugins/socket.js')
    mockApiClient = apiModule.default
    mockSocket = socketModule.default

    exportStore = useExportStore()

    // Reset all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    exportStore.cleanup()
  })

  describe('Initial State', () => {
    it('should initialize with empty state', () => {
      expect(exportStore.exports).toEqual([])
      expect(exportStore.loading).toBe(false)
      expect(exportStore.error).toBe(null)
      expect(exportStore.downloadProgress).toEqual({})
    })

    it('should have correct default computed properties', () => {
      expect(exportStore.activeExports).toEqual([])
      expect(exportStore.completedExports).toEqual([])
      expect(exportStore.failedExports).toEqual([])
      expect(exportStore.exportHistory).toEqual([])
      expect(exportStore.hasActiveExports).toBe(false)
    })

    it('should initialize computed status counters to zero', () => {
      expect(exportStore.exportsByStatus).toEqual({
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0
      })
    })

    it('should initialize computed format counters to zero', () => {
      expect(exportStore.exportsByFormat).toEqual({
        csv: 0,
        json: 0,
        xlsx: 0
      })
    })
  })

  describe('Computed Properties for Active Exports and History', () => {
    beforeEach(() => {
      exportStore.exports = [
        {
          _id: '1',
          status: 'pending',
          format: 'csv',
          createdAt: '2024-01-01T10:00:00Z'
        },
        {
          _id: '2',
          status: 'processing',
          format: 'json',
          createdAt: '2024-01-01T11:00:00Z'
        },
        {
          _id: '3',
          status: 'completed',
          format: 'xlsx',
          createdAt: '2024-01-01T12:00:00Z'
        },
        {
          _id: '4',
          status: 'failed',
          format: 'csv',
          createdAt: '2024-01-01T13:00:00Z'
        }
      ]
    })

    it('should filter active exports correctly', () => {
      expect(exportStore.activeExports).toHaveLength(2)
      expect(exportStore.activeExports[0]._id).toBe('1')
      expect(exportStore.activeExports[1]._id).toBe('2')
    })

    it('should filter completed exports correctly', () => {
      expect(exportStore.completedExports).toHaveLength(1)
      expect(exportStore.completedExports[0]._id).toBe('3')
    })

    it('should filter failed exports correctly', () => {
      expect(exportStore.failedExports).toHaveLength(1)
      expect(exportStore.failedExports[0]._id).toBe('4')
    })

    it('should calculate export history correctly sorted by date', () => {
      expect(exportStore.exportHistory).toHaveLength(2)
      expect(exportStore.exportHistory[0]._id).toBe('4') // Latest failed
      expect(exportStore.exportHistory[1]._id).toBe('3') // Earlier completed
    })

    it('should calculate exports by status correctly', () => {
      expect(exportStore.exportsByStatus).toEqual({
        pending: 1,
        processing: 1,
        completed: 1,
        failed: 1
      })
    })

    it('should calculate exports by format correctly', () => {
      expect(exportStore.exportsByFormat).toEqual({
        csv: 2,
        json: 1,
        xlsx: 1
      })
    })

    it('should detect active exports correctly', () => {
      expect(exportStore.hasActiveExports).toBe(true)
    })

    it('should detect no active exports when all are complete', () => {
      exportStore.exports = [
        { _id: '1', status: 'completed' },
        { _id: '2', status: 'failed' }
      ]

      expect(exportStore.hasActiveExports).toBe(false)
    })
  })

  describe('Actions for Creating, Tracking, and Downloading Exports', () => {
    describe('fetchExports', () => {
      it('should fetch exports successfully', async () => {
        const mockExports = [
          { _id: '1', status: 'completed', format: 'csv' },
          { _id: '2', status: 'processing', format: 'json' }
        ]

        mockApiClient.getExports.mockResolvedValue({ data: mockExports })

        await exportStore.fetchExports()

        expect(mockApiClient.getExports).toHaveBeenCalled()
        expect(exportStore.exports).toEqual(mockExports)
        expect(exportStore.loading).toBe(false)
        expect(exportStore.error).toBe(null)
      })

      it('should handle fetch exports error', async () => {
        const errorMessage = 'Failed to fetch exports'
        mockApiClient.getExports.mockRejectedValue(new Error(errorMessage))

        await exportStore.fetchExports()

        expect(exportStore.error).toBe(errorMessage)
        expect(exportStore.loading).toBe(false)
        expect(exportStore.exports).toEqual([])
      })

      it('should handle empty data response', async () => {
        mockApiClient.getExports.mockResolvedValue({ data: null })

        await exportStore.fetchExports()

        expect(exportStore.exports).toEqual([])
      })
    })

    describe('getExport', () => {
      it('should fetch single export successfully', async () => {
        const mockExport = { _id: '1', status: 'completed', format: 'csv' }
        mockApiClient.getExport.mockResolvedValue({ data: mockExport })

        const result = await exportStore.getExport('1')

        expect(mockApiClient.getExport).toHaveBeenCalledWith('1')
        expect(result).toEqual(mockExport)
        expect(exportStore.loading).toBe(false)
      })

      it('should handle get export error and throw', async () => {
        const errorMessage = 'Export not found'
        mockApiClient.getExport.mockRejectedValue(new Error(errorMessage))

        await expect(exportStore.getExport('invalid')).rejects.toThrow(
          errorMessage
        )
        expect(exportStore.error).toBe(errorMessage)
      })
    })

    describe('createExport', () => {
      it('should create export successfully', async () => {
        const exportConfig = { format: 'csv', filters: { status: 'pending' } }
        const mockResponse = {
          _id: 'new-export',
          ...exportConfig,
          status: 'pending',
          createdAt: new Date().toISOString()
        }

        mockApiClient.createExport.mockResolvedValue({ data: mockResponse })

        const result = await exportStore.createExport(exportConfig)

        expect(mockApiClient.createExport).toHaveBeenCalledWith(exportConfig)
        expect(result).toEqual(mockResponse)
        expect(exportStore.exports[0]).toEqual(mockResponse)
        expect(exportStore.loading).toBe(false)
      })

      it('should handle create export error and throw', async () => {
        const errorMessage = 'Invalid export configuration'
        mockApiClient.createExport.mockRejectedValue(new Error(errorMessage))

        await expect(exportStore.createExport({})).rejects.toThrow(errorMessage)
        expect(exportStore.error).toBe(errorMessage)
      })
    })

    describe('downloadExport', () => {
      let mockResponse

      beforeEach(() => {
        mockResponse = {
          ok: true,
          headers: {
            get: vi.fn((header) => {
              if (header === 'Content-Length') return '1000'
              return null
            })
          },
          body: {
            getReader: vi.fn(() => ({
              read: vi
                .fn()
                .mockResolvedValueOnce({
                  done: false,
                  value: new Uint8Array(500)
                })
                .mockResolvedValueOnce({
                  done: false,
                  value: new Uint8Array(500)
                })
                .mockResolvedValueOnce({ done: true })
            }))
          }
        }

        global.fetch.mockResolvedValue(mockResponse)

        // Mock document methods
        const mockElement = {
          href: '',
          download: '',
          click: vi.fn()
        }
        document.createElement = vi.fn(() => mockElement)
        document.body.appendChild = vi.fn()
        document.body.removeChild = vi.fn()
      })

      it('should download export successfully with progress tracking', async () => {
        await exportStore.downloadExport('export-1', 'test-export.csv')

        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:3001/api/exports/export-1/download'
        )

        // Check progress was tracked
        expect(exportStore.downloadProgress['export-1']).toEqual({
          progress: 100,
          downloading: false,
          completed: true
        })
      })

      it('should handle download error', async () => {
        const errorMessage = 'Download failed: 404'
        mockResponse.ok = false
        mockResponse.status = 404

        await expect(
          exportStore.downloadExport('invalid', 'test.csv')
        ).rejects.toThrow(errorMessage)

        expect(exportStore.downloadProgress['invalid']).toEqual({
          progress: 0,
          downloading: false,
          error: errorMessage
        })
      })

      it('should track progress without content-length', async () => {
        mockResponse.headers.get.mockReturnValue(null)

        await exportStore.downloadExport('no-length', 'test.csv')

        expect(exportStore.downloadProgress['no-length'].completed).toBe(true)
      })

      it('should use default filename when not provided', async () => {
        await exportStore.downloadExport('export-1')

        const mockElement = document.createElement()
        expect(mockElement.download).toBe('export-export-1')
      })
    })

    describe('cancelExport', () => {
      it('should cancel export successfully', async () => {
        exportStore.exports = [{ _id: 'cancel-me', status: 'processing' }]

        mockApiClient.cancelExport.mockResolvedValue({})

        await exportStore.cancelExport('cancel-me')

        expect(mockApiClient.cancelExport).toHaveBeenCalledWith('cancel-me')
        expect(exportStore.exports[0].status).toBe('cancelled')
      })

      it('should handle cancel export error', async () => {
        const errorMessage = 'Cannot cancel completed export'
        mockApiClient.cancelExport.mockRejectedValue(new Error(errorMessage))

        await expect(
          exportStore.cancelExport('completed-export')
        ).rejects.toThrow(errorMessage)
        expect(exportStore.error).toBe(errorMessage)
      })
    })

    describe('retryExport', () => {
      it('should retry export successfully', async () => {
        exportStore.exports = [{ _id: 'retry-me', status: 'failed' }]

        const retryResponse = { _id: 'retry-me', status: 'pending' }
        mockApiClient.retryExport.mockResolvedValue({ data: retryResponse })

        const result = await exportStore.retryExport('retry-me')

        expect(mockApiClient.retryExport).toHaveBeenCalledWith('retry-me')
        expect(result).toEqual(retryResponse)
        expect(exportStore.exports[0]).toEqual(retryResponse)
      })

      it('should handle retry export error', async () => {
        const errorMessage = 'Cannot retry non-failed export'
        mockApiClient.retryExport.mockRejectedValue(new Error(errorMessage))

        await expect(exportStore.retryExport('not-failed')).rejects.toThrow(
          errorMessage
        )
        expect(exportStore.error).toBe(errorMessage)
      })
    })
  })

  describe('Socket.IO Event Handlers for Real-time Updates', () => {
    beforeEach(() => {
      exportStore.exports = [
        {
          _id: 'socket-test',
          status: 'processing',
          progress: 0,
          metadata: { phase: 'initializing' }
        }
      ]
    })

    describe('handleExportProgress', () => {
      it('should update export progress correctly', () => {
        const progressData = {
          exportId: 'socket-test',
          progress: 45,
          status: 'processing',
          timestamp: '2024-01-01T12:00:00Z'
        }

        exportStore.handleExportProgress(progressData)

        const updatedExport = exportStore.exports[0]
        expect(updatedExport.progress).toBe(45)
        expect(updatedExport.status).toBe('processing')
        expect(updatedExport.updatedAt).toBe('2024-01-01T12:00:00Z')
      })

      it('should ignore progress for non-existent export', () => {
        const progressData = {
          exportId: 'non-existent',
          progress: 50,
          status: 'processing'
        }

        exportStore.handleExportProgress(progressData)

        expect(exportStore.exports).toHaveLength(1)
        expect(exportStore.exports[0]._id).toBe('socket-test')
      })
    })

    describe('handleExportStatusChange', () => {
      it('should update export status and metadata correctly', () => {
        const statusData = {
          exportId: 'socket-test',
          status: 'processing',
          metadata: { phase: 'data-collection', step: 1 },
          timestamp: '2024-01-01T12:30:00Z'
        }

        exportStore.handleExportStatusChange(statusData)

        const updatedExport = exportStore.exports[0]
        expect(updatedExport.status).toBe('processing')
        expect(updatedExport.metadata).toEqual({
          phase: 'data-collection',
          step: 1
        })
        expect(updatedExport.updatedAt).toBe('2024-01-01T12:30:00Z')
      })

      it('should merge metadata with existing metadata', () => {
        const statusData = {
          exportId: 'socket-test',
          status: 'processing',
          metadata: { step: 2 }
        }

        exportStore.handleExportStatusChange(statusData)

        expect(exportStore.exports[0].metadata).toEqual({
          phase: 'initializing',
          step: 2
        })
      })
    })

    describe('handleExportCompleted', () => {
      it('should handle export completion correctly', () => {
        const completionData = {
          exportId: 'socket-test',
          exportData: {
            totalRecords: 100,
            fileSize: 2048,
            downloadUrl: '/api/exports/socket-test/download'
          },
          timestamp: '2024-01-01T13:00:00Z'
        }

        exportStore.handleExportCompleted(completionData)

        const completedExport = exportStore.exports[0]
        expect(completedExport.status).toBe('completed')
        expect(completedExport.progress).toBe(100)
        expect(completedExport.totalRecords).toBe(100)
        expect(completedExport.fileSize).toBe(2048)
        expect(completedExport.downloadUrl).toBe(
          '/api/exports/socket-test/download'
        )
        expect(completedExport.completedAt).toBe('2024-01-01T13:00:00Z')
        expect(completedExport.updatedAt).toBe('2024-01-01T13:00:00Z')
      })
    })

    describe('handleExportFailed', () => {
      it('should handle export failure correctly', () => {
        const failureData = {
          exportId: 'socket-test',
          error: 'Database connection timeout',
          metadata: { retryCount: 2 },
          timestamp: '2024-01-01T13:00:00Z'
        }

        exportStore.handleExportFailed(failureData)

        const failedExport = exportStore.exports[0]
        expect(failedExport.status).toBe('failed')
        expect(failedExport.error).toBe('Database connection timeout')
        expect(failedExport.metadata).toEqual({
          phase: 'initializing',
          retryCount: 2
        })
        expect(failedExport.failedAt).toBe('2024-01-01T13:00:00Z')
        expect(failedExport.updatedAt).toBe('2024-01-01T13:00:00Z')
      })
    })

    describe('handleExportListUpdate', () => {
      it('should handle export creation correctly', () => {
        const listData = {
          action: 'created',
          export: {
            _id: 'new-export',
            status: 'pending',
            format: 'json'
          }
        }

        exportStore.handleExportListUpdate(listData)

        expect(exportStore.exports).toHaveLength(2)
        expect(exportStore.exports[0]._id).toBe('new-export')
      })

      it('should not duplicate exports on creation', () => {
        const listData = {
          action: 'created',
          export: {
            _id: 'socket-test',
            status: 'pending',
            format: 'json'
          }
        }

        exportStore.handleExportListUpdate(listData)

        expect(exportStore.exports).toHaveLength(1)
      })

      it('should handle export update correctly', () => {
        const listData = {
          action: 'updated',
          export: {
            _id: 'socket-test',
            status: 'completed',
            progress: 100
          }
        }

        exportStore.handleExportListUpdate(listData)

        expect(exportStore.exports[0].status).toBe('completed')
        expect(exportStore.exports[0].progress).toBe(100)
      })

      it('should handle export deletion correctly', () => {
        const listData = {
          action: 'deleted',
          export: {
            _id: 'socket-test'
          }
        }

        exportStore.handleExportListUpdate(listData)

        expect(exportStore.exports).toHaveLength(0)
      })
    })

    describe('Socket.IO setup and cleanup', () => {
      it('should initialize socket listeners correctly', () => {
        exportStore.initializeSocketListeners()

        expect(mockSocket.emit).toHaveBeenCalledWith('join-exports')
        expect(mockSocket.on).toHaveBeenCalledWith(
          'export-progress',
          expect.any(Function)
        )
        expect(mockSocket.on).toHaveBeenCalledWith(
          'export-status-change',
          expect.any(Function)
        )
        expect(mockSocket.on).toHaveBeenCalledWith(
          'export-completed',
          expect.any(Function)
        )
        expect(mockSocket.on).toHaveBeenCalledWith(
          'export-failed',
          expect.any(Function)
        )
        expect(mockSocket.on).toHaveBeenCalledWith(
          'export-list-update',
          expect.any(Function)
        )
      })

      it('should cleanup socket listeners correctly', () => {
        exportStore.cleanup()

        expect(mockSocket.off).toHaveBeenCalledWith(
          'export-progress',
          expect.any(Function)
        )
        expect(mockSocket.off).toHaveBeenCalledWith(
          'export-status-change',
          expect.any(Function)
        )
        expect(mockSocket.off).toHaveBeenCalledWith(
          'export-completed',
          expect.any(Function)
        )
        expect(mockSocket.off).toHaveBeenCalledWith(
          'export-failed',
          expect.any(Function)
        )
        expect(mockSocket.off).toHaveBeenCalledWith(
          'export-list-update',
          expect.any(Function)
        )
      })
    })
  })

  describe('Error Handling in Store Actions', () => {
    it('should clear error state correctly', () => {
      exportStore.error = 'Some error'

      exportStore.clearError()

      expect(exportStore.error).toBe(null)
    })

    it('should clear download progress correctly', () => {
      exportStore.downloadProgress = {
        'export-1': { progress: 50, downloading: true },
        'export-2': { progress: 100, completed: true }
      }

      exportStore.clearDownloadProgress('export-1')

      expect(exportStore.downloadProgress).toEqual({
        'export-2': { progress: 100, completed: true }
      })
    })

    it('should handle API errors consistently across all actions', async () => {
      const testCases = [
        { action: 'fetchExports', args: [] },
        { action: 'getExport', args: ['test-id'] },
        { action: 'createExport', args: [{ format: 'csv' }] },
        { action: 'cancelExport', args: ['test-id'] },
        { action: 'retryExport', args: ['test-id'] }
      ]

      for (const testCase of testCases) {
        // Reset error state
        exportStore.clearError()

        // Mock API to reject
        const errorMessage = `${testCase.action} failed`

        if (testCase.action === 'cancelExport') {
          mockApiClient.cancelExport.mockRejectedValue(new Error(errorMessage))
        } else if (testCase.action === 'retryExport') {
          mockApiClient.retryExport.mockRejectedValue(new Error(errorMessage))
        } else if (testCase.action === 'createExport') {
          mockApiClient.createExport.mockRejectedValue(new Error(errorMessage))
        } else if (testCase.action === 'getExport') {
          mockApiClient.getExport.mockRejectedValue(new Error(errorMessage))
        } else {
          mockApiClient.getExports.mockRejectedValue(new Error(errorMessage))
        }

        // Test error handling
        if (
          testCase.action === 'getExport' ||
          testCase.action === 'createExport' ||
          testCase.action === 'cancelExport' ||
          testCase.action === 'retryExport'
        ) {
          await expect(
            exportStore[testCase.action](...testCase.args)
          ).rejects.toThrow(errorMessage)
        } else {
          await exportStore[testCase.action](...testCase.args)
        }

        expect(exportStore.error).toBe(errorMessage)
        expect(exportStore.loading).toBe(false)
      }
    })

    it('should handle network errors during download', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'))

      await expect(
        exportStore.downloadExport('network-fail', 'test.csv')
      ).rejects.toThrow('Network error')

      expect(exportStore.downloadProgress['network-fail']).toEqual({
        progress: 0,
        downloading: false,
        error: 'Network error'
      })
    })

    it('should handle reader errors during download', async () => {
      const mockResponse = {
        ok: true,
        headers: { get: vi.fn(() => '1000') },
        body: {
          getReader: vi.fn(() => ({
            read: vi.fn().mockRejectedValue(new Error('Read error'))
          }))
        }
      }

      global.fetch.mockResolvedValue(mockResponse)

      await expect(
        exportStore.downloadExport('read-fail', 'test.csv')
      ).rejects.toThrow('Read error')

      expect(exportStore.downloadProgress['read-fail']).toEqual({
        progress: 0,
        downloading: false,
        error: 'Read error'
      })
    })
  })
})
