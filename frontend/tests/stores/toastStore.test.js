/**
 * @fileoverview Unit tests for toast store functionality
 * @module tests/stores/toastStore.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useToastStore } from '@/stores/toastStore.js'

describe('Toast Store', () => {
  let toastStore

  beforeEach(() => {
    setActivePinia(createPinia())
    toastStore = useToastStore()
  })

  describe('showToast', () => {
    it('should create a toast with default values', () => {
      const toastId = toastStore.showToast({ message: 'Test message' })

      expect(toastId).toBeDefined()
      expect(toastStore.toasts).toHaveLength(1)
      expect(toastStore.toasts[0]).toMatchObject({
        id: toastId,
        message: 'Test message',
        type: 'info',
        timeout: 4000,
        persistent: false,
        visible: true
      })
    })

    it('should create a toast with custom values', () => {
      const actions = [{ label: 'Action', handler: vi.fn() }]
      const toastId = toastStore.showToast({
        message: 'Custom message',
        type: 'success',
        timeout: 6000,
        persistent: true,
        actions
      })

      expect(toastStore.toasts[0]).toMatchObject({
        id: toastId,
        message: 'Custom message',
        type: 'success',
        timeout: 6000,
        persistent: true,
        actions,
        visible: true
      })
    })
  })

  describe('convenience methods', () => {
    it('should create success toast', () => {
      toastStore.showSuccess('Success message')

      expect(toastStore.toasts[0]).toMatchObject({
        message: 'Success message',
        type: 'success',
        timeout: 4000
      })
    })

    it('should create error toast', () => {
      toastStore.showError('Error message')

      expect(toastStore.toasts[0]).toMatchObject({
        message: 'Error message',
        type: 'error',
        timeout: 6000,
        persistent: true
      })
    })

    it('should create warning toast', () => {
      toastStore.showWarning('Warning message')

      expect(toastStore.toasts[0]).toMatchObject({
        message: 'Warning message',
        type: 'warning',
        timeout: 5000
      })
    })

    it('should create info toast', () => {
      toastStore.showInfo('Info message')

      expect(toastStore.toasts[0]).toMatchObject({
        message: 'Info message',
        type: 'info',
        timeout: 4000
      })
    })
  })

  describe('hideToast', () => {
    it('should mark toast as not visible', () => {
      const toastId = toastStore.showToast({ message: 'Test' })

      toastStore.hideToast(toastId)

      expect(toastStore.toasts[0].visible).toBe(false)
    })

    it('should handle invalid toast ID gracefully', () => {
      toastStore.showToast({ message: 'Test' })

      expect(() => {
        toastStore.hideToast('invalid-id')
      }).not.toThrow()

      expect(toastStore.toasts[0].visible).toBe(true)
    })
  })

  describe('updateToast', () => {
    it('should update existing toast', () => {
      const toastId = toastStore.showToast({ message: 'Original' })

      toastStore.updateToast(toastId, {
        message: 'Updated message',
        type: 'error'
      })

      expect(toastStore.toasts[0]).toMatchObject({
        message: 'Updated message',
        type: 'error'
      })
    })

    it('should handle invalid toast ID gracefully', () => {
      toastStore.showToast({ message: 'Test' })

      expect(() => {
        toastStore.updateToast('invalid-id', { message: 'Updated' })
      }).not.toThrow()

      expect(toastStore.toasts[0].message).toBe('Test')
    })
  })

  describe('clearAllToasts', () => {
    it('should mark all toasts as not visible', () => {
      toastStore.showToast({ message: 'Toast 1' })
      toastStore.showToast({ message: 'Toast 2' })

      toastStore.clearAllToasts()

      toastStore.toasts.forEach((toast) => {
        expect(toast.visible).toBe(false)
      })
    })
  })

  describe('auto-hide functionality', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should auto-hide non-persistent toasts', () => {
      const toastId = toastStore.showToast({
        message: 'Auto-hide test',
        timeout: 1000,
        persistent: false
      })

      expect(toastStore.toasts[0].visible).toBe(true)

      vi.advanceTimersByTime(1000)

      expect(toastStore.toasts[0].visible).toBe(false)
    })

    it('should not auto-hide persistent toasts', () => {
      toastStore.showToast({
        message: 'Persistent test',
        timeout: 1000,
        persistent: true
      })

      expect(toastStore.toasts[0].visible).toBe(true)

      vi.advanceTimersByTime(2000)

      expect(toastStore.toasts[0].visible).toBe(true)
    })
  })
})
