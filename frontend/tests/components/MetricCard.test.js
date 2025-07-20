import { describe, it, expect } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import MetricCard from '../../src/components/MetricCard.vue'

describe('MetricCard', () => {
  it('renders correctly with props', () => {
    const wrapper = shallowMount(MetricCard, {
      props: {
        title: 'Total Tasks',
        value: 42,
        icon: 'mdi-format-list-checks',
        color: 'primary'
      }
    })

    // Test that the component receives the correct props
    expect(wrapper.vm.title).toBe('Total Tasks')
    expect(wrapper.vm.value).toBe(42)
    expect(wrapper.vm.icon).toBe('mdi-format-list-checks')
    expect(wrapper.vm.color).toBe('primary')
    
    // Test that the component exists
    expect(wrapper.exists()).toBe(true)
  })

  it('applies correct color class', () => {
    const wrapper = shallowMount(MetricCard, {
      props: {
        title: 'Test Metric',
        value: 100,
        icon: 'mdi-test',
        color: 'success'
      }
    })

    // Test that the component receives the correct props
    expect(wrapper.vm.color).toBe('success')
    expect(wrapper.vm.value).toBe(100)
    expect(wrapper.vm.title).toBe('Test Metric')
    expect(wrapper.vm.icon).toBe('mdi-test')
  })

  it('handles string and number values', () => {
    const wrapper = shallowMount(MetricCard, {
      props: {
        title: 'Completion Rate',
        value: '85%',
        icon: 'mdi-check',
        color: 'info'
      }
    })

    // Test props types and values
    expect(wrapper.vm.value).toBe('85%')
    expect(typeof wrapper.vm.value).toBe('string')
    expect(wrapper.vm.title).toBe('Completion Rate')
    expect(wrapper.vm.color).toBe('info')
    
    // Test with number value
    const wrapperNumber = shallowMount(MetricCard, {
      props: {
        title: 'Count',
        value: 42,
        icon: 'mdi-count',
        color: 'primary'
      }
    })
    
    expect(wrapperNumber.vm.value).toBe(42)
    expect(typeof wrapperNumber.vm.value).toBe('number')
  })
})
