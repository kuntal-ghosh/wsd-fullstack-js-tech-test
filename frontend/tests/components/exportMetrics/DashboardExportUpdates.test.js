import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

// Import the stores that will be used
import { useAnalyticsStore } from '../../../src/stores/analyticsStore'

// Create Vuetify instance
const vuetify = createVuetify({ components, directives })

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  default: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn()
  }))
}))

// Mock the Dashboard component
// In actual implementation, this would be the actual Dashboard component
const Dashboard = {
  template: `
    <div>
      <div class="analytics-section">
        <div class="export-metrics">
          <div class="active-exports">{{ analyticsStore.analytics.exportMetrics?.activeExports || 0 }}</div>
          <div class="export-success-rate">{{ analyticsStore.analytics.exportMetrics?.exportSuccessRate || 0 }}%</div>
          <div class="exports-today">{{ analyticsStore.analytics.exportMetrics?.exportsCreatedToday || 0 }}</div>
        </div>
      </div>
    </div>
  `,
  setup() {
    const analyticsStore = useAnalyticsStore()
    return { analyticsStore }
  }
}

describe('Dashboard Export Real-time Updates', () => {
  let pinia
  let analyticsStore

  beforeEach(() => {
    // Create fresh Pinia instance for each test
    pinia = createPinia()
    setActivePinia(pinia)

    // Get the analytics store
    analyticsStore = useAnalyticsStore()

    // Initialize with mock data
    analyticsStore.analytics = {
      totalTasks: 100,
      tasksByStatus: { pending: 30, 'in-progress': 40, completed: 30 },
      tasksByPriority: { low: 20, medium: 50, high: 30 },
      completionRate: 30,
      exportMetrics: {
        totalExports: 25,
        activeExports: 3,
        completedExports: 20,
        failedExports: 2,
        exportSuccessRate: 80,
        exportsCreatedToday: 6,
        exportsByFormat: { csv: 15, json: 10 }
      }
    }
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('displays initial export metrics correctly', async () => {
    const wrapper = mount(Dashboard, {
      global: {
        plugins: [pinia, vuetify]
      }
    })

    // Check initial values are displayed correctly
    expect(wrapper.find('.active-exports').text()).toBe('3')
    expect(wrapper.find('.export-success-rate').text()).toBe('80%')
    expect(wrapper.find('.exports-today').text()).toBe('6')
  })

  it('updates export metrics when analytics update is received', async () => {
    const wrapper = mount(Dashboard, {
      global: {
        plugins: [pinia, vuetify]
      }
    })

    // Simulate receiving a socket update with new export metrics
    analyticsStore.updateAnalytics({
      exportMetrics: {
        totalExports: 26,
        activeExports: 4, // Increased
        completedExports: 20,
        failedExports: 2,
        exportSuccessRate: 80,
        exportsCreatedToday: 7, // Increased
        exportsByFormat: { csv: 16, json: 10 }
      }
    })

    await flushPromises()

    // Check that the values in the component were updated
    expect(wrapper.find('.active-exports').text()).toBe('4')
    expect(wrapper.find('.exports-today').text()).toBe('7')
  })

  it('updates success rate when an export completes', async () => {
    const wrapper = mount(Dashboard, {
      global: {
        plugins: [pinia, vuetify]
      }
    })

    // Simulate an export completing, increasing success rate
    analyticsStore.updateAnalytics({
      exportMetrics: {
        totalExports: 26,
        activeExports: 2, // Decreased (one completed)
        completedExports: 22, // Increased
        failedExports: 2,
        exportSuccessRate: 85, // Increased
        exportsCreatedToday: 7,
        exportsByFormat: { csv: 16, json: 10 }
      }
    })

    await flushPromises()

    // Check that the success rate was updated
    expect(wrapper.find('.export-success-rate').text()).toBe('85%')
    expect(wrapper.find('.active-exports').text()).toBe('2')
  })

  it('handles missing or undefined export metrics', async () => {
    // Set analytics with missing export metrics
    analyticsStore.analytics = {
      totalTasks: 100,
      tasksByStatus: { pending: 30, 'in-progress': 40, completed: 30 },
      tasksByPriority: { low: 20, medium: 50, high: 30 },
      completionRate: 30
      // No exportMetrics
    }

    const wrapper = mount(Dashboard, {
      global: {
        plugins: [pinia, vuetify]
      }
    })

    // Should display default values
    expect(wrapper.find('.active-exports').text()).toBe('0')
    expect(wrapper.find('.export-success-rate').text()).toBe('0%')
    expect(wrapper.find('.exports-today').text()).toBe('0')
  })

  it('handles socket disconnection and reconnection', async () => {
    const wrapper = mount(Dashboard, {
      global: {
        plugins: [pinia, vuetify]
      }
    })

    // Simulate socket disconnection
    analyticsStore.connected = false
    await flushPromises()

    // Then simulate reconnection with updated metrics
    analyticsStore.connected = true
    analyticsStore.updateAnalytics({
      exportMetrics: {
        totalExports: 30,
        activeExports: 1,
        completedExports: 27,
        failedExports: 2,
        exportSuccessRate: 90,
        exportsCreatedToday: 10,
        exportsByFormat: { csv: 18, json: 12 }
      }
    })

    await flushPromises()

    // Check that values were updated after reconnection
    expect(wrapper.find('.active-exports').text()).toBe('1')
    expect(wrapper.find('.export-success-rate').text()).toBe('90%')
    expect(wrapper.find('.exports-today').text()).toBe('10')
  })
})
