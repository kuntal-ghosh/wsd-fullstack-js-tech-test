import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

// Mock the component - will need to be created in the implementation phase
import ExportFormatChart from '../../../src/components/ExportFormatChart.vue'

// Mock chart.js
vi.mock('chart.js', () => ({
  Chart: vi.fn(),
  registerables: []
}))

// Mock the analytics store
const createMockAnalyticsStore = (exportMetrics = null) => ({
  analytics: {
    exportMetrics: exportMetrics || {
      totalExports: 50,
      exportsByFormat: { csv: 30, json: 15, xlsx: 5 }
    }
  },
  connected: true
})

vi.mock('../../../src/stores/analyticsStore', () => ({
  useAnalyticsStore: vi.fn(() => createMockAnalyticsStore())
}))

// Create Vuetify instance
const vuetify = createVuetify({ components, directives })

describe('ExportFormatChart', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders the chart component correctly', () => {
    const wrapper = mount(ExportFormatChart, {
      global: {
        plugins: [vuetify]
      }
    })

    // Chart container should exist
    expect(wrapper.find('.export-format-chart').exists()).toBe(true)
    
    // Chart title should be present
    expect(wrapper.text()).toContain('Export Format Distribution')
  })

  it('transforms analytics data into chart format correctly', () => {
    // Mock the transformData method to be accessible for testing
    const transformDataMock = vi.spyOn(ExportFormatChart.methods, 'transformFormatData')
    
    mount(ExportFormatChart, {
      global: {
        plugins: [vuetify]
      }
    })
    
    // Check that transform was called
    expect(transformDataMock).toHaveBeenCalled()
    
    // Call the method directly to test its output
    const mockData = { csv: 30, json: 15, xlsx: 5 }
    const result = ExportFormatChart.methods.transformFormatData(mockData)
    
    // Verify the transformation creates the expected chart data
    expect(result.labels).toContain('CSV')
    expect(result.labels).toContain('JSON')
    expect(result.labels).toContain('XLSX')
    expect(result.datasets[0].data).toEqual([30, 15, 5])
  })

  it('handles empty format data gracefully', () => {
    // Create a store with empty export format data
    vi.mocked(useAnalyticsStore).mockReturnValue(createMockAnalyticsStore({
      totalExports: 0,
      exportsByFormat: {}
    }))
    
    const wrapper = mount(ExportFormatChart, {
      global: {
        plugins: [vuetify]
      }
    })
    
    // Should render without errors
    expect(wrapper.find('.export-format-chart').exists()).toBe(true)
    
    // Should show a message when no data is available
    expect(wrapper.find('.no-data-message').exists()).toBe(true)
    expect(wrapper.find('.no-data-message').text()).toContain('No export data available')
  })

  it('updates chart when analytics data changes', async () => {
    const wrapper = mount(ExportFormatChart, {
      global: {
        plugins: [vuetify]
      }
    })
    
    // Mock the updateChart method
    const updateChartSpy = vi.spyOn(wrapper.vm, 'updateChart')
    
    // Simulate analytics update
    wrapper.vm.analyticsStore.analytics = {
      exportMetrics: {
        totalExports: 60,
        exportsByFormat: { csv: 35, json: 20, xlsx: 5 }
      }
    }
    
    // Wait for update
    await wrapper.vm.$nextTick()
    
    // Check that chart update was triggered
    expect(updateChartSpy).toHaveBeenCalled()
  })

  it('formats tooltips with percentages', () => {
    const wrapper = mount(ExportFormatChart, {
      global: {
        plugins: [vuetify]
      }
    })
    
    // Access the tooltip formatter function
    const tooltipFormatter = wrapper.vm.chartOptions.plugins.tooltip.callbacks.label
    
    // Create mock tooltip context
    const mockTooltipContext = {
      dataset: { data: [30, 15, 5] },
      dataIndex: 0,
      raw: 30,
      parsed: 30
    }
    
    const formattedTooltip = tooltipFormatter(mockTooltipContext)
    
    // Check format: "60% (30)"
    expect(formattedTooltip).toBe('60% (30)')
  })

  it('shows correct color scheme based on format', () => {
    const wrapper = mount(ExportFormatChart, {
      global: {
        plugins: [vuetify]
      }
    })
    
    // Get chart colors
    const colors = wrapper.vm.chartData.datasets[0].backgroundColor
    
    // Verify colors match expected scheme
    expect(colors.length).toBe(3) // For CSV, JSON, XLSX
    expect(colors[0]).toBeDefined() // CSV color
    expect(colors[1]).toBeDefined() // JSON color
    expect(colors[2]).toBeDefined() // XLSX color
    
    // Ensure colors are different
    expect(colors[0]).not.toBe(colors[1])
  })
})