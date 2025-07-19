/**
 * @fileoverview Export store for managing export data, progress tracking, and real-time updates
 * @module stores/exportStore
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiClient from '../api/client.js'
import socket from '../plugins/socket.js'

/**
 * Pinia store for export management with real-time progress tracking and history
 * @function useExportStore
 * @returns {Object} Export store with reactive state and methods
 */
export const useExportStore = defineStore('exports', () => {
  // State
  const exports = ref([])
  const loading = ref(false)
  const error = ref(null)
  const downloadProgress = ref({})

  // Computed properties for filtering exports
  const activeExports = computed(() =>
    exports.value.filter(
      (exp) => exp.status === 'pending' || exp.status === 'processing'
    )
  )

  const completedExports = computed(() =>
    exports.value.filter((exp) => exp.status === 'completed')
  )

  const failedExports = computed(() =>
    exports.value.filter((exp) => exp.status === 'failed')
  )

  const exportHistory = computed(() =>
    exports.value
      .filter((exp) => exp.status === 'completed' || exp.status === 'failed')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  )

  const exportsByStatus = computed(() => ({
    pending: exports.value.filter((exp) => exp.status === 'pending').length,
    processing: exports.value.filter((exp) => exp.status === 'processing')
      .length,
    completed: exports.value.filter((exp) => exp.status === 'completed').length,
    failed: exports.value.filter((exp) => exp.status === 'failed').length
  }))

  const exportsByFormat = computed(() => ({
    csv: exports.value.filter((exp) => exp.format === 'csv').length,
    json: exports.value.filter((exp) => exp.format === 'json').length,
    xlsx: exports.value.filter((exp) => exp.format === 'xlsx').length
  }))

  const hasActiveExports = computed(() => activeExports.value.length > 0)

  /**
   * Fetches all exports from the API
   * @async
   * @function fetchExports
   * @returns {Promise<void>}
   */
  async function fetchExports() {
    loading.value = true
    error.value = null

    try {
      const response = await apiClient.getExports()
      exports.value = response.data || []
    } catch (err) {
      error.value = err.message
      console.error('Error fetching exports:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetches a specific export by ID
   * @async
   * @function getExport
   * @param {string} id - Export ID
   * @returns {Promise<Object>} Export data
   */
  async function getExport(id) {
    loading.value = true
    error.value = null

    try {
      const response = await apiClient.getExport(id)
      return response.data
    } catch (err) {
      error.value = err.message
      console.error('Error fetching export:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Creates a new export request
   * @async
   * @function createExport
   * @param {Object} exportConfig - Export configuration
   * @param {string} exportConfig.format - Export format (csv, json, xlsx)
   * @param {Object} [exportConfig.filters] - Filters to apply to export
   * @returns {Promise<Object>} Created export response
   */
  async function createExport(exportConfig) {
    loading.value = true
    error.value = null

    try {
      const response = await apiClient.createExport(exportConfig)

      // Add new export to the beginning of the list
      exports.value.unshift(response.data)

      return response.data
    } catch (err) {
      error.value = err.message
      console.error('Error creating export:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Downloads an export file
   * @async
   * @function downloadExport
   * @param {string} id - Export ID
   * @param {string} filename - Desired filename for download
   * @returns {Promise<void>}
   */
  async function downloadExport(id, filename) {
    downloadProgress.value[id] = { progress: 0, downloading: true }
    error.value = null

    try {
      const response = await fetch(
        `${apiClient.baseURL}/exports/${id}/download`
      )

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`)
      }

      const contentLength = +response.headers.get('Content-Length')
      const reader = response.body.getReader()
      const chunks = []
      let receivedLength = 0

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        chunks.push(value)
        receivedLength += value.length

        // Update download progress
        if (contentLength) {
          const progress = Math.round((receivedLength / contentLength) * 100)
          downloadProgress.value[id] = {
            progress,
            downloading: true,
            receivedLength,
            totalLength: contentLength
          }
        }
      }

      // Create blob and trigger download
      const blob = new Blob(chunks)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || `export-${id}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      downloadProgress.value[id] = {
        progress: 100,
        downloading: false,
        completed: true
      }
    } catch (err) {
      error.value = err.message
      downloadProgress.value[id] = {
        progress: 0,
        downloading: false,
        error: err.message
      }
      console.error('Error downloading export:', err)
      throw err
    }
  }

  /**
   * Cancels an active export
   * @async
   * @function cancelExport
   * @param {string} id - Export ID
   * @returns {Promise<void>}
   */
  async function cancelExport(id) {
    loading.value = true
    error.value = null

    try {
      await apiClient.cancelExport(id)

      // Update export status locally
      const exportIndex = exports.value.findIndex((exp) => exp._id === id)
      if (exportIndex !== -1) {
        exports.value[exportIndex].status = 'cancelled'
      }
    } catch (err) {
      error.value = err.message
      console.error('Error cancelling export:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Retries a failed export
   * @async
   * @function retryExport
   * @param {string} id - Export ID
   * @returns {Promise<Object>} Retried export response
   */
  async function retryExport(id) {
    loading.value = true
    error.value = null

    try {
      const response = await apiClient.retryExport(id)

      // Update export in the list
      const exportIndex = exports.value.findIndex((exp) => exp._id === id)
      if (exportIndex !== -1) {
        exports.value[exportIndex] = response.data
      }

      return response.data
    } catch (err) {
      error.value = err.message
      console.error('Error retrying export:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Handles real-time export progress updates from Socket.IO
   * @function handleExportProgress
   * @param {Object} data - Progress update data
   */
  function handleExportProgress(data) {
    const { exportId, progress, status } = data

    const exportIndex = exports.value.findIndex((exp) => exp._id === exportId)
    if (exportIndex !== -1) {
      exports.value[exportIndex] = {
        ...exports.value[exportIndex],
        progress,
        status,
        updatedAt: data.timestamp
      }
    }
  }

  /**
   * Handles real-time export status changes from Socket.IO
   * @function handleExportStatusChange
   * @param {Object} data - Status change data
   */
  function handleExportStatusChange(data) {
    const { exportId, status, metadata } = data

    const exportIndex = exports.value.findIndex((exp) => exp._id === exportId)
    if (exportIndex !== -1) {
      exports.value[exportIndex] = {
        ...exports.value[exportIndex],
        status,
        metadata: { ...exports.value[exportIndex].metadata, ...metadata },
        updatedAt: data.timestamp
      }
    }
  }

  /**
   * Handles export completion from Socket.IO
   * @function handleExportCompleted
   * @param {Object} data - Completion data
   */
  function handleExportCompleted(data) {
    const { exportId, exportData } = data

    const exportIndex = exports.value.findIndex((exp) => exp._id === exportId)
    if (exportIndex !== -1) {
      exports.value[exportIndex] = {
        ...exports.value[exportIndex],
        status: 'completed',
        progress: 100,
        ...exportData,
        completedAt: data.timestamp,
        updatedAt: data.timestamp
      }
    }
  }

  /**
   * Handles export failure from Socket.IO
   * @function handleExportFailed
   * @param {Object} data - Failure data
   */
  function handleExportFailed(data) {
    const { exportId, error: exportError, metadata } = data

    const exportIndex = exports.value.findIndex((exp) => exp._id === exportId)
    if (exportIndex !== -1) {
      exports.value[exportIndex] = {
        ...exports.value[exportIndex],
        status: 'failed',
        error: exportError,
        metadata: { ...exports.value[exportIndex].metadata, ...metadata },
        failedAt: data.timestamp,
        updatedAt: data.timestamp
      }
    }
  }

  /**
   * Handles export list updates from Socket.IO
   * @function handleExportListUpdate
   * @param {Object} data - List update data
   */
  function handleExportListUpdate(data) {
    const { action, export: exportData } = data

    switch (action) {
      case 'created':
        // Add new export if not already present
        if (!exports.value.find((exp) => exp._id === exportData._id)) {
          exports.value.unshift(exportData)
        }
        break
      case 'updated': {
        const exportIndex = exports.value.findIndex(
          (exp) => exp._id === exportData._id
        )
        if (exportIndex !== -1) {
          exports.value[exportIndex] = exportData
        }
        break
      }
      case 'deleted': {
        const deleteIndex = exports.value.findIndex(
          (exp) => exp._id === exportData._id
        )
        if (deleteIndex !== -1) {
          exports.value.splice(deleteIndex, 1)
        }
        break
      }
    }
  }

  /**
   * Sets up Socket.IO event listeners for export events
   * @function initializeSocketListeners
   */
  function initializeSocketListeners() {
    socket.emit('join-exports')

    socket.on('export-progress', handleExportProgress)
    socket.on('export-status-change', handleExportStatusChange)
    socket.on('export-completed', handleExportCompleted)
    socket.on('export-failed', handleExportFailed)
    socket.on('export-list-update', handleExportListUpdate)
  }

  /**
   * Removes Socket.IO event listeners
   * @function cleanup
   */
  function cleanup() {
    socket.off('export-progress', handleExportProgress)
    socket.off('export-status-change', handleExportStatusChange)
    socket.off('export-completed', handleExportCompleted)
    socket.off('export-failed', handleExportFailed)
    socket.off('export-list-update', handleExportListUpdate)
  }

  /**
   * Clears all error states
   * @function clearError
   */
  function clearError() {
    error.value = null
  }

  /**
   * Clears download progress for a specific export
   * @function clearDownloadProgress
   * @param {string} id - Export ID
   */
  function clearDownloadProgress(id) {
    delete downloadProgress.value[id]
  }

  return {
    // State
    exports,
    loading,
    error,
    downloadProgress,

    // Computed properties
    activeExports,
    completedExports,
    failedExports,
    exportHistory,
    exportsByStatus,
    exportsByFormat,
    hasActiveExports,

    // Actions
    fetchExports,
    getExport,
    createExport,
    downloadExport,
    cancelExport,
    retryExport,
    clearError,
    clearDownloadProgress,

    // Socket.IO handlers
    handleExportProgress,
    handleExportStatusChange,
    handleExportCompleted,
    handleExportFailed,
    handleExportListUpdate,
    initializeSocketListeners,
    cleanup
  }
})
