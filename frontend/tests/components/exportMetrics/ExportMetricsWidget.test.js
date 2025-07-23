import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

// Mock the component - will need to be created in the implementation phase
import ExportMetricsWidget from '../../../src/components/ExportMetricsWidget.vue'

// Create mock stores
const createMockAnalyticsStore = () => ({
  analytics: {
    exportMetrics: {
      totalExports: 50,
      activeExports: 5,
      completedExports: 40,
      failedExports: 5,
      exportSuccessRate: 80,
      exportsCreatedToday: 8,
      exportsByFormat: { csv: 30, json: 20 },
      averageExportSize: 45.2, // KB
      averageExportTime: 3.2 // seconds
    }
  },
  connected: true
})

// Mock stores
vi.mock('../../../src/stores/analyticsStore', () => ({
  useAnalyticsStore: vi.fn(() => createMockAnalyticsStore())
}))

// Create Vuetify instance
const vuetify = createVuetify({ components, directives })

describe('ExportMetricsWidget', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders export metrics data correctly', () => {
    const wrapper = mount(ExportMetricsWidget, {
      global: {
        plugins: [vuetify]
      }
    })

    // Check for key metrics being displayed
    expect(wrapper.text()).toContain('5') // Active exports
    expect(wrapper.text()).toContain('8') // Exports created today
    expect(wrapper.text()).toContain('80%') // Export success rate
    expect(wrapper.text()).toContain('CSV') // Most popular format
  })

  it('shows correct formatting for average export size', () => {
    const wrapper = mount(ExportMetricsWidget, {
      global: {
        plugins: [vuetify]
      }
    })

    // Check size formatting (45.2 KB)
    expect(wrapper.text()).toContain('45.2 KB')
  })

  it('shows correct formatting for average export time', () => {
    const wrapper = mount(ExportMetricsWidget, {
      global: {
        plugins: [vuetify]
      }
    })

    // Check time formatting (3.2 seconds)
    expect(wrapper.text()).toContain('3.2 seconds')
  })

  it('displays the most used format correctly', () => {
    const wrapper = mount(ExportMetricsWidget, {
      global: {
        plugins: [vuetify]
      }
    })

    // CSV is most popular in the mock data
    expect(wrapper.text()).toContain('CSV')
    expect(wrapper.find('.most-popular-format').exists()).toBe(true)
  })

  it('shows a warning indicator when success rate is below threshold', async () => {
    // Create a store with low success rate
    const lowSuccessRateStore = {
      analytics: {
        exportMetrics: {
          totalExports: 50,
          activeExports: 5,
          completedExports: 35,
          failedExports: 15,
          exportSuccessRate: 70, // Below threshold
          exportsCreatedToday: 8,
          exportsByFormat: { csv: 30, json: 20 }
        }
      },
      connected: true
    }

    vi.mocked(useAnalyticsStore).mockReturnValue(lowSuccessRateStore)

    const wrapper = mount(ExportMetricsWidget, {
      global: {
        plugins: [vuetify]
      }
    })

    // Check for warning indicator
    expect(wrapper.find('.success-rate-warning').exists()).toBe(true)
  })

  it('does not show warning when success rate is good', () => {
    // Using the default mock with 80% success rate
    const wrapper = mount(ExportMetricsWidget, {
      global: {
        plugins: [vuetify]
      }
    })

    // Warning should not be present
    expect(wrapper.find('.success-rate-warning').exists()).toBe(false)
  })

  it('handles empty or missing export metrics gracefully', () => {
    // Create a store with missing export metrics
    const emptyStore = {
      analytics: {
        // No exportMetrics
        totalTasks: 100
      },
      connected: true
    }

    vi.mocked(useAnalyticsStore).mockReturnValue(emptyStore)

    const wrapper = mount(ExportMetricsWidget, {
      global: {
        plugins: [vuetify]
      }
    })

    // Should render without errors and show default values
    expect(wrapper.text()).toContain('0') // Default value for metrics
    expect(wrapper.text()).toContain('N/A') // Default for format
  })
})
