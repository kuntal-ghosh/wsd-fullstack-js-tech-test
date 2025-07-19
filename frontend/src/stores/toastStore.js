/**
 * @fileoverview Toast notification store for managing temporary messages
 * @module stores/toastStore
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Pinia store for toast notifications
 * @function useToastStore
 * @returns {Object} Toast store with reactive state and methods
 */
export const useToastStore = defineStore('toast', () => {
  // State
  const toasts = ref([])

  /**
   * Shows a toast notification
   * @function showToast
   * @param {Object} options - Toast configuration
   * @param {string} options.message - Toast message
   * @param {string} [options.type='info'] - Toast type (success, error, warning, info)
   * @param {number} [options.timeout=4000] - Auto-hide timeout in milliseconds
   * @param {boolean} [options.persistent=false] - Whether toast should not auto-hide
   * @param {Object} [options.actions] - Optional actions for the toast
   */
  function showToast({
    message,
    type = 'info',
    timeout = 4000,
    persistent = false,
    actions = null
  }) {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9)
    
    const toast = {
      id,
      message,
      type,
      timeout,
      persistent,
      actions,
      timestamp: new Date().toISOString(),
      visible: true
    }

    toasts.value.push(toast)

    // Auto-hide toast after timeout (unless persistent)
    if (!persistent && timeout > 0) {
      setTimeout(() => {
        hideToast(id)
      }, timeout)
    }

    return id
  }

  /**
   * Shows a success toast
   * @function showSuccess
   * @param {string} message - Success message
   * @param {Object} [options] - Additional options
   */
  function showSuccess(message, options = {}) {
    return showToast({
      message,
      type: 'success',
      timeout: 4000,
      ...options
    })
  }

  /**
   * Shows an error toast
   * @function showError
   * @param {string} message - Error message
   * @param {Object} [options] - Additional options
   */
  function showError(message, options = {}) {
    return showToast({
      message,
      type: 'error',
      timeout: 6000,
      persistent: true,
      ...options
    })
  }

  /**
   * Shows a warning toast
   * @function showWarning
   * @param {string} message - Warning message
   * @param {Object} [options] - Additional options
   */
  function showWarning(message, options = {}) {
    return showToast({
      message,
      type: 'warning',
      timeout: 5000,
      ...options
    })
  }

  /**
   * Shows an info toast
   * @function showInfo
   * @param {string} message - Info message
   * @param {Object} [options] - Additional options
   */
  function showInfo(message, options = {}) {
    return showToast({
      message,
      type: 'info',
      timeout: 4000,
      ...options
    })
  }

  /**
   * Hides a specific toast
   * @function hideToast
   * @param {string} id - Toast ID
   */
  function hideToast(id) {
    const index = toasts.value.findIndex(toast => toast.id === id)
    if (index !== -1) {
      toasts.value[index].visible = false
      // Remove from array after animation
      setTimeout(() => {
        const currentIndex = toasts.value.findIndex(toast => toast.id === id)
        if (currentIndex !== -1) {
          toasts.value.splice(currentIndex, 1)
        }
      }, 300) // Wait for exit animation
    }
  }

  /**
   * Clears all toasts
   * @function clearAllToasts
   */
  function clearAllToasts() {
    toasts.value.forEach(toast => {
      toast.visible = false
    })
    
    setTimeout(() => {
      toasts.value = []
    }, 300)
  }

  /**
   * Updates an existing toast
   * @function updateToast
   * @param {string} id - Toast ID
   * @param {Object} updates - Updates to apply
   */
  function updateToast(id, updates) {
    const toast = toasts.value.find(t => t.id === id)
    if (toast) {
      Object.assign(toast, updates)
    }
  }

  return {
    // State
    toasts,

    // Actions
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    hideToast,
    clearAllToasts,
    updateToast
  }
})
