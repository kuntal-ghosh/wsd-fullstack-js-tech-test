/**
 * @fileoverview Unit tests for ToastContainer component
 * @module tests/components/ToastContainer.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import ToastContainer from '@/components/ToastContainer.vue'
import { useToastStore } from '@/stores/toastStore.js'

// Mock Vuetify
const vuetify = createVuetify()

describe('ToastContainer', () => {
  let wrapper
  let pinia
  let toastStore

  beforeEach(() => {
    pinia = createPinia()
    toastStore = useToastStore(pinia)

    wrapper = mount(ToastContainer, {
      global: {
        plugins: [pinia, vuetify]
      }
    })
  })

  it('should render without toasts', () => {
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.findAll('.toast-item')).toHaveLength(0)
  })

  it('should render toasts when they exist', async () => {
    toastStore.showSuccess('Test success message')
    toastStore.showError('Test error message')

    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('v-snackbar-stub')).toHaveLength(2)
  })

  it('should show correct icon for different toast types', () => {
    const component = wrapper.vm

    expect(component.getToastIcon('success')).toBe('mdi-check-circle')
    expect(component.getToastIcon('error')).toBe('mdi-alert-circle')
    expect(component.getToastIcon('warning')).toBe('mdi-alert')
    expect(component.getToastIcon('info')).toBe('mdi-information')
  })

  it('should show correct color for different toast types', () => {
    const component = wrapper.vm

    expect(component.getToastColor('success')).toBe('success')
    expect(component.getToastColor('error')).toBe('error')
    expect(component.getToastColor('warning')).toBe('warning')
    expect(component.getToastColor('info')).toBe('info')
  })

  it('should calculate correct position for stacked toasts', async () => {
    toastStore.showInfo('Toast 1')
    toastStore.showInfo('Toast 2')
    toastStore.showInfo('Toast 3')

    await wrapper.vm.$nextTick()

    const component = wrapper.vm
    const toasts = toastStore.toasts

    expect(component.getToastPosition(toasts[0])).toBe(24) // First toast
    expect(component.getToastPosition(toasts[1])).toBe(96) // Second toast (24 + 72)
    expect(component.getToastPosition(toasts[2])).toBe(168) // Third toast (24 + 72*2)
  })

  it('should format timestamp correctly', () => {
    const component = wrapper.vm
    const timestamp = '2024-01-01T12:30:45.000Z'

    const formatted = component.formatTimestamp(timestamp)

    // Should include time format (exact format depends on locale)
    expect(formatted).toMatch(/\d{1,2}:\d{2}:\d{2}/)
  })

  it('should handle action clicks', async () => {
    const actionHandler = vi.fn()
    const toast = {
      id: 'test-toast',
      message: 'Test',
      actions: [
        {
          label: 'Test Action',
          handler: actionHandler,
          autoHide: true
        }
      ]
    }

    const component = wrapper.vm
    component.handleActionClick(toast.actions[0], toast)

    expect(actionHandler).toHaveBeenCalledWith(toast)
  })

  it('should hide toast when close button is clicked', async () => {
    const toastId = toastStore.showInfo('Test message')

    await wrapper.vm.$nextTick()

    const hideToastSpy = vi.spyOn(toastStore, 'hideToast')
    const component = wrapper.vm

    component.hideToast(toastId)

    expect(hideToastSpy).toHaveBeenCalledWith(toastId)
  })
})
