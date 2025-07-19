/**
 * @fileoverview Export store for managing export data, progress tracking, and real-time updates
 * @module stores/exportStore
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiClient from '../api/client.js'
import socket from '../plugins/socket.js'
import { useToastStore } from './toastStore.js'

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
  const autoHideTimer = ref(null)

  // Setup periodic refresh for auto-hide functionality
  if (typeof window !== 'undefined') {
    autoHideTimer.value = setInterval(() => {
      refreshActiveExports()
    }, 1000) // Check every second for auto-hide
  }

  // Computed properties for filtering exports
  const activeExports = computed(() => {
    const exportsArray = Array.isArray(exports.value) ? exports.value : []
    return exportsArray.filter(
      (exp) => (exp.status === 'pending' || exp.status === 'processing') && 
      // Only show completed exports for a brief period before auto-hiding them
      !(exp.status === 'completed' && exp._autoHideAfter && Date.now() > exp._autoHideAfter)
    )
  })

  const completedExports = computed(() => {
    const exportsArray = Array.isArray(exports.value) ? exports.value : []
    return exportsArray.filter((exp) => exp.status === 'completed')
  })

  const failedExports = computed(() => {
    const exportsArray = Array.isArray(exports.value) ? exports.value : []
    return exportsArray.filter((exp) => exp.status === 'failed')
  })

  const exportHistory = computed(() => {
    const exportsArray = Array.isArray(exports.value) ? exports.value : []
    return exportsArray
      .filter((exp) => exp.status === 'completed' || exp.status === 'failed')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  })

  const exportsByStatus = computed(() => {
    const exportsArray = Array.isArray(exports.value) ? exports.value : []
    return {
      pending: exportsArray.filter((exp) => exp.status === 'pending').length,
      processing: exportsArray.filter((exp) => exp.status === 'processing').length,
      completed: exportsArray.filter((exp) => exp.status === 'completed').length,
      failed: exportsArray.filter((exp) => exp.status === 'failed').length
    }
  })

  const exportsByFormat = computed(() => {
    const exportsArray = Array.isArray(exports.value) ? exports.value : []
    return {
      csv: exportsArray.filter((exp) => exp.format === 'csv').length,
      json: exportsArray.filter((exp) => exp.format === 'json').length,
      xlsx: exportsArray.filter((exp) => exp.format === 'xlsx').length
    }
  })

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
      console.log('Fetched exports:', response.data);
      exports.value = Array.isArray(response.data) ? response.data : []
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

    // Get toast store instance
    const toastStore = useToastStore()

    try {
      const response = await apiClient.createExport(exportConfig)

      // Ensure exports.value is an array before using array methods
      if (!Array.isArray(exports.value)) {
        exports.value = []
      }

      // Add new export to the beginning of the list
      exports.value.unshift(response.data)

      // Show success toast
      toastStore.showSuccess(
        `Export request created successfully! Format: ${exportConfig.format.toUpperCase()}`,
        {
          timeout: 4000,
          actions: [
            {
              label: 'View Progress',
              color: 'white',
              handler: () => {
                // Could navigate to exports page or show progress dialog
                console.log('Navigate to export:', response.data._id)
              }
            }
          ]
        }
      )

      return response.data
    } catch (err) {
      error.value = err.message
      console.error('Error creating export:', err)
      
      // Show error toast
      toastStore.showError(
        `Failed to create export: ${err.message}`,
        {
          actions: [
            {
              label: 'Retry',
              color: 'white',
              handler: () => {
                createExport(exportConfig)
              }
            }
          ]
        }
      )
      
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
    console.log('🔧 Frontend: Starting download for export:', id, 'with filename:', filename);
    
    // Get toast store instance
    const toastStore = useToastStore()
    
    // Initialize download progress
    downloadProgress.value[id] = { progress: 0, downloading: true }
    error.value = null
    
    // Show starting download toast
    const downloadToastId = toastStore.showInfo(
      `Starting download of ${filename || `export-${id}`}...`,
      { 
        timeout: 3000,
        actions: [
          {
            label: 'Cancel',
            color: 'white',
            handler: () => {
              // Cancel download logic could be added here
              console.log('Download cancelled by user')
            }
          }
        ]
      }
    )

    console.log('Starting download for export:', id)
    
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

      // Show progress toast for large files
      let progressToastId = null
      if (contentLength > 1024 * 1024) { // Files larger than 1MB
        progressToastId = toastStore.showInfo(
          'Downloading... 0%',
          { 
            persistent: true,
            actions: [
              {
                label: 'Hide',
                color: 'white',
                handler: (toast) => {
                  toastStore.hideToast(toast.id)
                }
              }
            ]
          }
        )
      }

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

          // Update progress toast for large files
          if (progressToastId && progress % 10 === 0) { // Update every 10%
            toastStore.updateToast(progressToastId, {
              message: `Downloading... ${progress}%`
            })
          }
        }
      }

      console.log('Download completed for export:', id, 'Total chunks:', chunks.length)
      
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

      // Update final progress
      downloadProgress.value[id] = {
        progress: 100,
        downloading: false,
        completed: true
      }

      // Hide progress toast if it exists
      if (progressToastId) {
        toastStore.hideToast(progressToastId)
      }

      // Show success toast
      const fileSize = chunks.reduce((total, chunk) => total + chunk.length, 0)
      const fileSizeFormatted = fileSize > 1024 * 1024 
        ? `${(fileSize / (1024 * 1024)).toFixed(1)} MB`
        : `${(fileSize / 1024).toFixed(1)} KB`

      toastStore.showSuccess(
        `Download completed successfully! File size: ${fileSizeFormatted}`,
        {
          timeout: 5000,
          actions: [
            {
              label: 'Download Again',
              color: 'white',
              handler: () => {
                downloadExport(id, filename)
              }
            }
          ]
        }
      )

    } catch (err) {
      error.value = err.message
      downloadProgress.value[id] = {
        progress: 0,
        downloading: false,
        error: err.message
      }
      
      console.error('Error downloading export:', err)
      
      // Show error toast with retry option
      toastStore.showError(
        `Download failed: ${err.message}`,
        {
          actions: [
            {
              label: 'Retry',
              color: 'white',
              handler: () => {
                downloadExport(id, filename)
              }
            },
            {
              label: 'Dismiss',
              color: 'white',
              autoHide: true
            }
          ]
        }
      )
      
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

    // Get toast store instance
    const toastStore = useToastStore()

    try {
      await apiClient.cancelExport(id)

      // Update export status locally
      const exportIndex = exports.value.findIndex((exp) => exp._id === id)
      if (exportIndex !== -1) {
        const exportName = exports.value[exportIndex].filename || `export-${id}`
        exports.value[exportIndex].status = 'cancelled'
        
        // Show cancellation toast
        toastStore.showWarning(
          `Export "${exportName}" has been cancelled`,
          {
            timeout: 4000,
            actions: [
              {
                label: 'Create New',
                color: 'white',
                handler: () => {
                  // Could trigger export creation dialog
                  console.log('Create new export')
                }
              }
            ]
          }
        )
      }
    } catch (err) {
      error.value = err.message
      console.error('Error cancelling export:', err)
      
      // Show error toast
      toastStore.showError(
        `Failed to cancel export: ${err.message}`,
        {
          actions: [
            {
              label: 'Retry Cancel',
              color: 'white',
              handler: () => {
                cancelExport(id)
              }
            }
          ]
        }
      )
      
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

    // Get toast store instance
    const toastStore = useToastStore()

    try {
      const response = await apiClient.retryExport(id)

      // Update export in the list
      const exportIndex = exports.value.findIndex((exp) => exp._id === id)
      if (exportIndex !== -1) {
        const exportName = exports.value[exportIndex].filename || `export-${id}`
        exports.value[exportIndex] = response.data
        
        // Show retry success toast
        toastStore.showInfo(
          `Export "${exportName}" is being retried...`,
          {
            timeout: 4000,
            actions: [
              {
                label: 'View Progress',
                color: 'white',
                handler: () => {
                  console.log('View retry progress:', id)
                }
              }
            ]
          }
        )
      }

      return response.data
    } catch (err) {
      error.value = err.message
      console.error('Error retrying export:', err)
      
      // Show retry error toast
      toastStore.showError(
        `Failed to retry export: ${err.message}`,
        {
          actions: [
            {
              label: 'Try Again',
              color: 'white',
              handler: () => {
                retryExport(id)
              }
            }
          ]
        }
      )
      
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
    console.log('Handling export progress in handleExportProgress:', exportId, progress, status);

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
    console.log('Handling export status change in handleExportStatusChange:', exportId, status, metadata);

    // Get toast store instance
    const toastStore = useToastStore()

    const exportIndex = exports.value.findIndex((exp) => exp._id === exportId)
    if (exportIndex !== -1) {
      const exportName = exports.value[exportIndex].filename || `export-${exportId}`
      const previousStatus = exports.value[exportIndex].status
      
      // Update export status
      exports.value[exportIndex] = {
        ...exports.value[exportIndex],
        status,
        metadata: { ...exports.value[exportIndex].metadata, ...metadata },
        updatedAt: data.timestamp
      }

      // Show status-specific toast notifications (only if status actually changed)
      if (previousStatus !== status) {
        showStatusToast(toastStore, status, exportName, exportId, metadata)
      }
    }
  }

  /**
   * Shows appropriate toast notification based on export status
   * @function showStatusToast
   * @param {Object} toastStore - Toast store instance
   * @param {string} status - Export status
   * @param {string} exportName - Export filename or ID
   * @param {string} exportId - Export ID
   * @param {Object} metadata - Additional metadata
   */
  function showStatusToast(toastStore, status, exportName, exportId, metadata = {}) {
    switch (status) {
      case 'pending':
        toastStore.showInfo(
          `Export "${exportName}" is queued and waiting to start...`,
          {
            timeout: 4000,
            actions: [
              {
                label: 'Cancel',
                color: 'white',
                handler: () => {
                  cancelExport(exportId)
                    .catch(error => {
                      console.error('Failed to cancel export:', error)
                    })
                }
              },
              {
                label: 'View Queue',
                color: 'white',
                handler: () => {
                  console.log('View export queue')
                }
              }
            ]
          }
        )
        break

      case 'processing':
        const estimatedTime = metadata.estimatedTime || 'Unknown'
        const recordCount = metadata.recordCount || 'Unknown'
        
        toastStore.showInfo(
          `Export "${exportName}" is now processing... Records: ${recordCount}`,
          {
            timeout: 5000,
            actions: [
              {
                label: 'View Progress',
                color: 'white',
                handler: () => {
                  console.log('View processing progress for:', exportId)
                }
              },
              {
                label: 'Cancel',
                color: 'white',
                handler: () => {
                  cancelExport(exportId)
                    .catch(error => {
                      console.error('Failed to cancel export:', error)
                    })
                }
              }
            ]
          }
        )
        break

      case 'completed':
        const fileSize = metadata.fileSize
        const fileSizeFormatted = fileSize 
          ? fileSize > 1024 * 1024 
            ? `${(fileSize / (1024 * 1024)).toFixed(1)} MB`
            : `${(fileSize / 1024).toFixed(1)} KB`
          : 'Unknown size'

        toastStore.showSuccess(
          `Export "${exportName}" completed successfully! File size: ${fileSizeFormatted}`,
          {
            timeout: 7000,
            actions: [
              {
                label: 'Download Now',
                color: 'white',
                handler: () => {
                  downloadExport(exportId, exportName)
                    .catch(error => {
                      console.error('Download failed:', error)
                    })
                }
              },
              {
                label: 'View Details',
                color: 'white',
                handler: () => {
                  console.log('View export details:', exportId)
                }
              },
              {
                label: 'Share',
                color: 'white',
                handler: () => {
                  // Could implement sharing functionality
                  console.log('Share export:', exportId)
                }
              }
            ]
          }
        )
        break

      case 'failed':
        const errorMessage = metadata.error || 'Unknown error occurred'
        const canRetry = metadata.canRetry !== false
        
        const actions = [
          {
            label: 'View Error Details',
            color: 'white',
            handler: () => {
              console.log('View error details:', exportId, errorMessage)
            }
          }
        ]

        if (canRetry) {
          actions.unshift({
            label: 'Retry Export',
            color: 'white',
            handler: () => {
              retryExport(exportId)
                .then(() => {
                  toastStore.showInfo(`Retrying export "${exportName}"...`)
                })
                .catch(error => {
                  toastStore.showError(`Failed to retry export: ${error.message}`)
                })
            }
          })
        }

        actions.push({
          label: 'Create New Export',
          color: 'white',
          handler: () => {
            console.log('Create new export to replace failed one')
          }
        })

        toastStore.showError(
          `Export "${exportName}" failed: ${errorMessage}`,
          {
            actions
          }
        )
        break

      case 'cancelled':
        toastStore.showWarning(
          `Export "${exportName}" was cancelled`,
          {
            timeout: 4000,
            actions: [
              {
                label: 'Create New',
                color: 'white',
                handler: () => {
                  console.log('Create new export to replace cancelled one')
                }
              },
              {
                label: 'View History',
                color: 'white',
                handler: () => {
                  console.log('View export history')
                }
              }
            ]
          }
        )
        break

      default:
        // For any unknown status, show a generic info toast
        toastStore.showInfo(
          `Export "${exportName}" status updated to: ${status}`,
          {
            timeout: 3000,
            actions: [
              {
                label: 'View Details',
                color: 'white',
                handler: () => {
                  console.log('View export details:', exportId)
                }
              }
            ]
          }
        )
        break
    }
  }

  /**
   * Handles export completion from Socket.IO
   * @function handleExportCompleted
   * @param {Object} data - Completion data
   */
  async function handleExportCompleted(data) {
    const { exportId, exportData } = data
    console.log('Handling export completion:', exportId, exportData);
    
    // Get toast store instance
    const toastStore = useToastStore()
    
    const exportIndex = exports.value.findIndex((exp) => exp._id === exportId)
    if (exportIndex !== -1) {
      const updatedExport = {
        ...exports.value[exportIndex],
        status: 'completed',
        progress: 100,
        ...exportData,
        completedAt: data.timestamp,
        updatedAt: data.timestamp,
        // Set auto-hide timer - component will be hidden after 5 seconds
        _autoHideAfter: Date.now() + 5000
      }
      
      exports.value[exportIndex] = updatedExport
      console.log('Export completed:', updatedExport)
      
      // Show completion toast
      const exportName = updatedExport.filename || `export-${exportId}`
      const fileSize = updatedExport.fileSize
      const fileSizeFormatted = fileSize 
        ? fileSize > 1024 * 1024 
          ? `${(fileSize / (1024 * 1024)).toFixed(1)} MB`
          : `${(fileSize / 1024).toFixed(1)} KB`
        : 'Unknown size'

      toastStore.showSuccess(
        `Export "${exportName}" completed! File size: ${fileSizeFormatted}`,
        {
          timeout: 6000,
          actions: [
            {
              label: 'Download Now',
              color: 'white',
              handler: () => {
                downloadExport(exportId, updatedExport.filename)
              }
            },
            {
              label: 'View Details',
              color: 'white',
              handler: () => {
                console.log('View export details:', exportId)
              }
            }
          ]
        }
      )
      
      // Auto-download the completed export if it has a filename
      if (updatedExport._id && updatedExport.downloadUrl) {
        console.log('Auto-downloading completed export:', exportId)
        console.log('Export download URL:', `${apiClient.baseURL}${updatedExport.downloadUrl}`);
        
        downloadExport(exportId, updatedExport.filename)
          .then(() => {
            console.log('Auto-download completed successfully for export:', exportId)
          })
          .catch(error => {
            console.error('Auto-download failed for export:', exportId, error)
            // Remove auto-hide timer on download error to keep progress visible
            if (exports.value[exportIndex]) {
              delete exports.value[exportIndex]._autoHideAfter
            }
            
            // Show error toast for auto-download failure
            toastStore.showWarning(
              `Auto-download failed for "${exportName}". You can still download manually.`,
              {
                actions: [
                  {
                    label: 'Download Manually',
                    color: 'white',
                    handler: () => {
                      downloadExport(exportId, updatedExport.filename)
                    }
                  }
                ]
              }
            )
          })
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

    // Get toast store instance
    const toastStore = useToastStore()

    const exportIndex = exports.value.findIndex((exp) => exp._id === exportId)
    if (exportIndex !== -1) {
      const exportName = exports.value[exportIndex].filename || `export-${exportId}`
      
      exports.value[exportIndex] = {
        ...exports.value[exportIndex],
        status: 'failed',
        error: exportError,
        metadata: { ...exports.value[exportIndex].metadata, ...metadata },
        failedAt: data.timestamp,
        updatedAt: data.timestamp
      }

      // Show error toast with retry option
      toastStore.showError(
        `Export "${exportName}" failed: ${exportError}`,
        {
          actions: [
            {
              label: 'Retry Export',
              color: 'white',
              handler: () => {
                retryExport(exportId)
                  .then(() => {
                    toastStore.showInfo(`Retrying export "${exportName}"...`)
                  })
                  .catch(error => {
                    toastStore.showError(`Failed to retry export: ${error.message}`)
                  })
              }
            },
            {
              label: 'View Details',
              color: 'white',
              handler: () => {
                console.log('View export error details:', exportId, exportError)
              }
            }
          ]
        }
      )
    }
  }

  /**
   * Handles export list updates from Socket.IO
   * @function handleExportListUpdate
   * @param {Object} data - List update data
   */
  function handleExportListUpdate(data) {
    console.log('🔧 Frontend: Received export-list-update event:', data)
    const { action, export: exportData } = data

    // Ensure exports.value is an array
    if (!Array.isArray(exports.value)) {
      exports.value = []
    }

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
    console.log('🔧 Frontend: Initializing export socket listeners')
    socket.emit('join-exports')
    console.log('🔧 Frontend: Emitted join-exports')

    socket.on('export-progress', handleExportProgress)
    socket.on('export-status-change', handleExportStatusChange)
    socket.on('export-completed', handleExportCompleted)
    socket.on('export-failed', handleExportFailed)
    socket.on('export-list-update', handleExportListUpdate)
    console.log('🔧 Frontend: All export event listeners registered')
  }

  /**
   * Removes Socket.IO event listeners and cleans up timers
   * @function cleanup
   */
  function cleanup() {
    socket.off('export-progress', handleExportProgress)
    socket.off('export-status-change', handleExportStatusChange)
    socket.off('export-completed', handleExportCompleted)
    socket.off('export-failed', handleExportFailed)
    socket.off('export-list-update', handleExportListUpdate)
    
    // Clear auto-hide timer
    if (autoHideTimer.value) {
      clearInterval(autoHideTimer.value)
      autoHideTimer.value = null
    }
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

  /**
   * Removes an export from the list (for closing/hiding the progress component)
   * @function removeExport
   * @param {string} id - Export ID
   */
  function removeExport(id) {
    const exportIndex = exports.value.findIndex(exp => exp._id === id)
    if (exportIndex !== -1) {
      exports.value.splice(exportIndex, 1)
      // Also clear download progress
      clearDownloadProgress(id)
      console.log('📤 Export removed from list:', id)
    }
  }

  /**
   * Forces a refresh of reactive computations by triggering an update
   * @function refreshActiveExports
   */
  function refreshActiveExports() {
    // Trigger reactivity by creating a new array reference
    exports.value = [...exports.value]
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
    removeExport,
    refreshActiveExports,
    showStatusToast,

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
