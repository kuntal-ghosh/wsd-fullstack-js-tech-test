/**
 * @fileoverview Unit tests for TaskList.vue component
 * @module tests/components/TaskList.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TaskList from '../../src/components/TaskList.vue';
import { useTaskStore } from '../../src/stores/taskStore.js';
import { useExportStore } from '../../src/stores/exportStore.js';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

// Mock lodash-es debounce
vi.mock('lodash-es', () => ({
  debounce: vi.fn((fn) => fn)
}));

const vuetify = createVuetify({
  components,
  directives,
});

describe('TaskList Component', () => {
  let pinia;
  let taskStore;
  let exportStore;
  let wrapper;

  const mockTasks = [
    {
      _id: '1',
      title: 'Test Task 1',
      description: 'Description 1',
      status: 'pending',
      priority: 'high',
      createdAt: '2024-01-01T00:00:00.000Z',
      tags: ['tag1']
    },
    {
      _id: '2',
      title: 'Test Task 2',
      description: 'Description 2',
      status: 'completed',
      priority: 'medium',
      createdAt: '2024-01-02T00:00:00.000Z',
      completedAt: '2024-01-03T00:00:00.000Z',
      tags: ['tag2']
    }
  ];

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    
    taskStore = useTaskStore();
    exportStore = useExportStore();
    
    // Mock store data and methods
    taskStore.tasks = [...mockTasks];
    taskStore.loading = false;
    taskStore.error = null;
    taskStore.pagination = { page: 1, pages: 1, total: 2 };
    taskStore.fetchTasks = vi.fn();
    taskStore.deleteTask = vi.fn();
    taskStore.updateFilters = vi.fn();
    taskStore.setPage = vi.fn();
    
    exportStore.loading = false;
    exportStore.fetchExports = vi.fn();
    exportStore.initializeSocketListeners = vi.fn();
    exportStore.cleanup = vi.fn();

    wrapper = mount(TaskList, {
      global: {
        plugins: [pinia, vuetify],
        stubs: {
          'task-form-dialog': { template: '<div data-test="task-form-dialog"></div>' },
          'advanced-filter-panel': { template: '<div data-test="advanced-filter-panel"></div>' },
          'export-dialog': { template: '<div data-test="export-dialog"></div>' }
        }
      }
    });
  });

  describe('Component Initialization', () => {
    it('should mount successfully', () => {
      expect(wrapper.exists()).toBe(true);
    });

    it('should call store initialization methods on mount', () => {
      expect(taskStore.fetchTasks).toHaveBeenCalled();
      expect(exportStore.fetchExports).toHaveBeenCalled();
      expect(exportStore.initializeSocketListeners).toHaveBeenCalled();
    });

    it('should display the page title', () => {
      expect(wrapper.find('.page-title').text()).toBe('Tasks');
    });

    it('should render New Task button', () => {
      const newTaskBtn = wrapper.find('button').filter(btn => btn.text().includes('New Task'));
      expect(newTaskBtn.length).toBeGreaterThan(0);
    });
  });

  describe('Task Display', () => {
    it('should display all tasks when not loading', () => {
      const taskCards = wrapper.findAll('.task-item');
      expect(taskCards).toHaveLength(2);
    });

    it('should display task details correctly', () => {
      const firstTask = wrapper.find('.task-item');
      expect(firstTask.find('.task-title').text()).toBe('Test Task 1');
      expect(firstTask.text()).toContain('Description 1');
    });

    it('should show loading state', async () => {
      taskStore.loading = true;
      await wrapper.vm.$nextTick();
      
      const progressCircular = wrapper.find('v-progress-circular-stub');
      expect(progressCircular.exists()).toBe(true);
    });

    it('should show error state', async () => {
      taskStore.error = 'Test error message';
      await wrapper.vm.$nextTick();
      
      const errorAlert = wrapper.find('v-alert-stub');
      expect(errorAlert.exists()).toBe(true);
    });

    it('should show empty state when no tasks', async () => {
      taskStore.tasks = [];
      await wrapper.vm.$nextTick();
      
      const emptyState = wrapper.find('[data-test="empty-state"]');
      expect(emptyState.exists()).toBe(true);
      expect(emptyState.text()).toContain('No tasks yet');
    });

    it('should show filtered empty state when filters active', async () => {
      taskStore.tasks = [];
      await wrapper.setData({ filters: { status: ['completed'] } });
      await wrapper.vm.$nextTick();
      
      const emptyState = wrapper.find('[data-test="empty-state"]');
      expect(emptyState.text()).toContain('No tasks match your filters');
    });
  });

  describe('Search Functionality', () => {
    it('should render search input', () => {
      const searchInput = wrapper.find('[data-test="global-search-input"]');
      expect(searchInput.exists()).toBe(true);
    });

    it('should update search query on input', async () => {
      const searchInput = wrapper.find('[data-test="global-search-input"]');
      await searchInput.setValue('test search');
      
      expect(wrapper.vm.searchQuery).toBe('test search');
    });

    it('should clear search when clear button clicked', async () => {
      await wrapper.setData({ searchQuery: 'test search' });
      await wrapper.vm.$nextTick();
      
      wrapper.vm.clearSearch();
      
      expect(wrapper.vm.searchQuery).toBe('');
      expect(wrapper.vm.filters.search).toBe('');
    });
  });

  describe('Filter Functionality', () => {
    it('should render filter panel', () => {
      const filterPanel = wrapper.find('[data-test="filter-panel-container"]');
      expect(filterPanel.exists()).toBe(true);
    });

    it('should show filter count when filters are active', async () => {
      await wrapper.setData({ 
        filters: { 
          status: ['pending'], 
          priority: ['high'],
          search: 'test'
        } 
      });
      await wrapper.vm.$nextTick();
      
      const filterCount = wrapper.find('[data-test="filter-count"]');
      expect(filterCount.exists()).toBe(true);
      expect(wrapper.vm.filterCount).toBe(3);
    });

    it('should update filters correctly', () => {
      const newFilters = { status: ['completed'] };
      wrapper.vm.updateFilters(newFilters);
      
      expect(taskStore.updateFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ['completed'],
          statusArray: ['completed']
        })
      );
    });

    it('should compute active filters correctly', async () => {
      await wrapper.setData({ 
        filters: { 
          search: 'test',
          status: ['pending']
        } 
      });
      
      expect(wrapper.vm.hasActiveFilters).toBe(true);
    });
  });

  describe('Export Functionality', () => {
    it('should render export button', () => {
      const exportBtn = wrapper.find('[data-test="export-button"]');
      expect(exportBtn.exists()).toBe(true);
    });

    it('should disable export button when no tasks', async () => {
      taskStore.tasks = [];
      await wrapper.vm.$nextTick();
      
      const exportBtn = wrapper.find('[data-test="export-button"]');
      expect(exportBtn.attributes('disabled')).toBeDefined();
    });

    it('should open export dialog when export button clicked', async () => {
      const exportBtn = wrapper.find('[data-test="export-button"]');
      await exportBtn.trigger('click');
      
      expect(wrapper.vm.showExportDialog).toBe(true);
    });

    it('should handle export creation', () => {
      const mockExport = { _id: 'export-123', format: 'csv' };
      wrapper.vm.handleExportCreated(mockExport);
      
      expect(wrapper.vm.showExportDialog).toBe(false);
    });

    it('should trigger advanced export from filter panel', () => {
      wrapper.vm.onAdvancedExport();
      expect(wrapper.vm.showExportDialog).toBe(true);
    });
  });

  describe('Task Actions', () => {
    it('should open create dialog when New Task button clicked', async () => {
      const createBtn = wrapper.find('button').filter(btn => btn.text().includes('New Task'));
      await createBtn[0].trigger('click');
      
      expect(wrapper.vm.showCreateDialog).toBe(true);
    });

    it('should open edit dialog when task clicked', () => {
      const task = mockTasks[0];
      wrapper.vm.editTask(task);
      
      expect(wrapper.vm.selectedTask).toBe(task);
      expect(wrapper.vm.showEditDialog).toBe(true);
    });

    it('should open delete dialog when delete action triggered', () => {
      const task = mockTasks[0];
      wrapper.vm.deleteTask(task);
      
      expect(wrapper.vm.selectedTask).toBe(task);
      expect(wrapper.vm.showDeleteDialog).toBe(true);
    });

    it('should handle save action', async () => {
      wrapper.vm.handleSave();
      
      expect(wrapper.vm.showCreateDialog).toBe(false);
      expect(wrapper.vm.showEditDialog).toBe(false);
      expect(wrapper.vm.selectedTask).toBe(null);
      expect(taskStore.fetchTasks).toHaveBeenCalled();
    });

    it('should confirm delete action', async () => {
      wrapper.vm.selectedTask = mockTasks[0];
      await wrapper.vm.confirmDelete();
      
      expect(taskStore.deleteTask).toHaveBeenCalledWith('1');
      expect(wrapper.vm.showDeleteDialog).toBe(false);
      expect(wrapper.vm.selectedTask).toBe(null);
    });
  });

  describe('Utility Functions', () => {
    it('should return correct status colors', () => {
      expect(wrapper.vm.getStatusColor('pending')).toBe('warning');
      expect(wrapper.vm.getStatusColor('in-progress')).toBe('info');
      expect(wrapper.vm.getStatusColor('completed')).toBe('success');
      expect(wrapper.vm.getStatusColor('unknown')).toBe('grey');
    });

    it('should return correct priority colors', () => {
      expect(wrapper.vm.getPriorityColor('low')).toBe('success');
      expect(wrapper.vm.getPriorityColor('medium')).toBe('warning');
      expect(wrapper.vm.getPriorityColor('high')).toBe('error');
      expect(wrapper.vm.getPriorityColor('unknown')).toBe('grey');
    });

    it('should format status correctly', () => {
      expect(wrapper.vm.formatStatus('pending')).toBe('Pending');
      expect(wrapper.vm.formatStatus('in-progress')).toBe('In Progress');
      expect(wrapper.vm.formatStatus('completed')).toBe('Completed');
    });

    it('should format priority correctly', () => {
      expect(wrapper.vm.formatPriority('low')).toBe('Low');
      expect(wrapper.vm.formatPriority('medium')).toBe('Medium');
      expect(wrapper.vm.formatPriority('high')).toBe('High');
    });

    it('should format date correctly', () => {
      const testDate = '2024-01-01T00:00:00.000Z';
      const formatted = wrapper.vm.formatDate(testDate);
      expect(formatted).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });
  });

  describe('Pagination', () => {
    it('should display pagination when there are multiple pages', async () => {
      taskStore.pagination = { page: 1, pages: 3, total: 15 };
      await wrapper.vm.$nextTick();
      
      const pagination = wrapper.find('v-pagination-stub');
      expect(pagination.exists()).toBe(true);
    });

    it('should handle page changes', () => {
      const newPage = 2;
      taskStore.setPage(newPage);
      
      expect(taskStore.setPage).toHaveBeenCalledWith(newPage);
    });
  });

  describe('Component Lifecycle', () => {
    it('should cleanup on unmount', () => {
      wrapper.unmount();
      expect(exportStore.cleanup).toHaveBeenCalled();
    });
  });

  describe('Computed Properties', () => {
    it('should compute combined filters correctly', async () => {
      await wrapper.setData({ 
        filters: { 
          search: 'test',
          status: ['pending'],
          priority: ['high']
        } 
      });
      
      const combined = wrapper.vm.combinedFilters;
      expect(combined.search).toBe('test');
      expect(combined.status).toEqual(['pending']);
      expect(combined.priority).toEqual(['high']);
    });

    it('should count filters correctly', async () => {
      await wrapper.setData({ 
        filters: { 
          search: 'test',
          status: ['pending'],
          priority: ['high'],
          dateFrom: '2024-01-01',
          sortBy: 'title'
        } 
      });
      
      expect(wrapper.vm.filterCount).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing task properties gracefully', async () => {
      const taskWithMissingProps = {
        _id: '3',
        title: 'Minimal Task'
        // Missing description, tags, etc.
      };
      
      taskStore.tasks = [taskWithMissingProps];
      await wrapper.vm.$nextTick();
      
      expect(() => wrapper.html()).not.toThrow();
    });

    it('should handle invalid date formats', () => {
      const invalidDate = 'invalid-date';
      expect(() => wrapper.vm.formatDate(invalidDate)).not.toThrow();
    });

    it('should handle undefined selectedTask in delete confirmation', async () => {
      wrapper.vm.selectedTask = null;
      await wrapper.vm.confirmDelete();
      
      expect(taskStore.deleteTask).not.toHaveBeenCalled();
    });
  });
});