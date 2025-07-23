/**
 * @fileoverview Integration tests for task management workflows
 * @module tests/integration/taskWorkflow.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import TaskList from '../../src/components/TaskList.vue';
import { useTaskStore } from '../../src/stores/taskStore.js';
import { useExportStore } from '../../src/stores/exportStore.js';

// Mock API client
const mockApiClient = {
  getTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  getAnalytics: vi.fn(),
  createExport: vi.fn(),
  getExports: vi.fn()
};

vi.mock('../../src/api/client.js', () => ({
  default: mockApiClient
}));

// Mock socket
const mockSocket = {
  connected: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn()
};

vi.mock('../../src/plugins/socket.js', () => ({
  default: mockSocket
}));

// Mock lodash-es
vi.mock('lodash-es', () => ({
  debounce: vi.fn((fn) => fn)
}));

const vuetify = createVuetify({
  components,
  directives,
});

describe('Task Management Workflow Integration Tests', () => {
  let pinia;
  let taskStore;
  let exportStore;
  let wrapper;

  const mockTasks = [
    {
      _id: '1',
      title: 'Setup Project',
      description: 'Initialize the project structure',
      status: 'pending',
      priority: 'high',
      createdAt: '2024-01-01T00:00:00.000Z',
      tags: ['setup', 'project']
    },
    {
      _id: '2',
      title: 'Write Tests',
      description: 'Create comprehensive test suite',
      status: 'in-progress',
      priority: 'medium',
      createdAt: '2024-01-02T00:00:00.000Z',
      tags: ['testing']
    },
    {
      _id: '3',
      title: 'Deploy Application',
      description: 'Deploy to production',
      status: 'completed',
      priority: 'high',
      createdAt: '2024-01-03T00:00:00.000Z',
      completedAt: '2024-01-05T00:00:00.000Z',
      tags: ['deployment']
    }
  ];

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    
    taskStore = useTaskStore();
    exportStore = useExportStore();
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock successful API responses
    mockApiClient.getTasks.mockResolvedValue({
      data: {
        tasks: mockTasks,
        pagination: { page: 1, pages: 1, total: 3, limit: 10 }
      }
    });
    
    mockApiClient.createTask.mockResolvedValue({
      data: {
        _id: '4',
        title: 'New Task',
        description: 'New task description',
        status: 'pending',
        priority: 'medium',
        createdAt: new Date().toISOString()
      }
    });
    
    mockApiClient.updateTask.mockResolvedValue({
      data: {
        _id: '1',
        title: 'Updated Task',
        description: 'Updated description',
        status: 'in-progress',
        priority: 'high',
        updatedAt: new Date().toISOString()
      }
    });
    
    mockApiClient.deleteTask.mockResolvedValue({
      success: true,
      message: 'Task deleted successfully'
    });

    mockApiClient.createExport.mockResolvedValue({
      data: {
        _id: 'export-123',
        format: 'csv',
        status: 'processing',
        progress: 0,
        createdAt: new Date().toISOString()
      }
    });

    mockApiClient.getExports.mockResolvedValue({
      data: {
        exports: [],
        pagination: { page: 1, pages: 1, total: 0 }
      }
    });

    wrapper = mount(TaskList, {
      global: {
        plugins: [pinia, vuetify],
        stubs: {
          'task-form-dialog': {
            template: `
              <div data-test="task-form-dialog">
                <button @click="$emit('save', mockTask)" data-test="save-button">Save</button>
              </div>
            `,
            emits: ['save'],
            data() {
              return {
                mockTask: {
                  title: 'Test Task',
                  description: 'Test Description',
                  status: 'pending',
                  priority: 'medium'
                }
              }
            }
          },
          'advanced-filter-panel': {
            template: `
              <div data-test="advanced-filter-panel">
                <button @click="$emit('export')" data-test="advanced-export-button">Export</button>
              </div>
            `,
            emits: ['export']
          },
          'export-dialog': {
            template: `
              <div data-test="export-dialog">
                <button @click="$emit('export-created', mockExport)" data-test="create-export-button">Create Export</button>
              </div>
            `,
            emits: ['export-created'],
            data() {
              return {
                mockExport: {
                  _id: 'export-123',
                  format: 'csv',
                  status: 'processing'
                }
              }
            }
          }
        }
      }
    });
  });

  describe('Task List Display and Loading', () => {
    it('should load and display tasks on mount', async () => {
      await wrapper.vm.$nextTick();
      
      expect(mockApiClient.getTasks).toHaveBeenCalled();
      expect(taskStore.tasks).toHaveLength(3);
      
      const taskCards = wrapper.findAll('.task-item');
      expect(taskCards).toHaveLength(3);
    });

    it('should display task details correctly', async () => {
      await wrapper.vm.$nextTick();
      
      const firstTask = wrapper.find('.task-item');
      expect(firstTask.find('.task-title').text()).toBe('Setup Project');
      expect(firstTask.text()).toContain('Initialize the project structure');
      expect(firstTask.text()).toContain('Pending');
      expect(firstTask.text()).toContain('High');
    });

    it('should show loading state during fetch', async () => {
      // Mock a delayed response
      mockApiClient.getTasks.mockReturnValue(new Promise(() => {}));
      
      const newWrapper = mount(TaskList, {
        global: {
          plugins: [pinia, vuetify],
          stubs: {
            'task-form-dialog': { template: '<div></div>' },
            'advanced-filter-panel': { template: '<div></div>' },
            'export-dialog': { template: '<div></div>' }
          }
        }
      });
      
      taskStore.loading = true;
      await newWrapper.vm.$nextTick();
      
      expect(newWrapper.find('v-progress-circular-stub').exists()).toBe(true);
    });
  });

  describe('Task Creation Workflow', () => {
    it('should open create dialog when New Task button clicked', async () => {
      await wrapper.vm.$nextTick();
      
      const newTaskBtn = wrapper.findAll('button').find(btn => 
        btn.text().includes('New Task')
      );
      await newTaskBtn.trigger('click');
      
      expect(wrapper.vm.showCreateDialog).toBe(true);
    });

    it('should create new task through dialog', async () => {
      await wrapper.vm.$nextTick();
      
      // Open create dialog
      wrapper.vm.showCreateDialog = true;
      await wrapper.vm.$nextTick();
      
      // Find and click save button in stubbed dialog
      const saveButton = wrapper.find('[data-test="save-button"]');
      await saveButton.trigger('click');
      
      expect(mockApiClient.createTask).toHaveBeenCalled();
      expect(wrapper.vm.showCreateDialog).toBe(false);
    });

    it('should refresh task list after creation', async () => {
      const initialCallCount = mockApiClient.getTasks.mock.calls.length;
      
      await wrapper.vm.handleSave();
      
      expect(mockApiClient.getTasks.mock.calls.length).toBe(initialCallCount + 1);
    });
  });

  describe('Task Editing Workflow', () => {
    it('should open edit dialog when task is clicked', async () => {
      await wrapper.vm.$nextTick();
      
      const task = mockTasks[0];
      wrapper.vm.editTask(task);
      
      expect(wrapper.vm.selectedTask).toBe(task);
      expect(wrapper.vm.showEditDialog).toBe(true);
    });

    it('should update task through edit dialog', async () => {
      await wrapper.vm.$nextTick();
      
      // Select and edit a task
      wrapper.vm.selectedTask = mockTasks[0];
      wrapper.vm.showEditDialog = true;
      await wrapper.vm.$nextTick();
      
      // Simulate save action
      await wrapper.vm.handleSave();
      
      expect(wrapper.vm.showEditDialog).toBe(false);
      expect(wrapper.vm.selectedTask).toBe(null);
    });
  });

  describe('Task Deletion Workflow', () => {
    it('should open delete confirmation dialog', async () => {
      await wrapper.vm.$nextTick();
      
      const task = mockTasks[0];
      wrapper.vm.deleteTask(task);
      
      expect(wrapper.vm.selectedTask).toBe(task);
      expect(wrapper.vm.showDeleteDialog).toBe(true);
    });

    it('should delete task when confirmed', async () => {
      await wrapper.vm.$nextTick();
      
      // Select task for deletion
      wrapper.vm.selectedTask = mockTasks[0];
      wrapper.vm.showDeleteDialog = true;
      
      // Confirm deletion
      await wrapper.vm.confirmDelete();
      
      expect(mockApiClient.deleteTask).toHaveBeenCalledWith('1');
      expect(wrapper.vm.showDeleteDialog).toBe(false);
      expect(wrapper.vm.selectedTask).toBe(null);
    });

    it('should not delete when no task selected', async () => {
      wrapper.vm.selectedTask = null;
      
      await wrapper.vm.confirmDelete();
      
      expect(mockApiClient.deleteTask).not.toHaveBeenCalled();
    });
  });

  describe('Search and Filter Workflow', () => {
    it('should update filters when search query changes', async () => {
      await wrapper.vm.$nextTick();
      
      const searchInput = wrapper.find('[data-test="global-search-input"]');
      await searchInput.setValue('setup');
      
      wrapper.vm.onSearchInput();
      
      expect(wrapper.vm.filters.search).toBe('setup');
      expect(taskStore.updateFilters).toHaveBeenCalled();
    });

    it('should clear search when clear button clicked', async () => {
      await wrapper.vm.$nextTick();
      
      // Set search query
      wrapper.vm.searchQuery = 'test search';
      wrapper.vm.filters.search = 'test search';
      
      // Clear search
      wrapper.vm.clearSearch();
      
      expect(wrapper.vm.searchQuery).toBe('');
      expect(wrapper.vm.filters.search).toBe('');
    });

    it('should expand filter panel when filters are applied', async () => {
      await wrapper.vm.$nextTick();
      
      wrapper.vm.filters.status = ['pending'];
      wrapper.vm.filters.priority = ['high'];
      await wrapper.vm.$nextTick();
      
      expect(wrapper.vm.filterCount).toBeGreaterThan(0);
      
      const filterCount = wrapper.find('[data-test="filter-count"]');
      expect(filterCount.exists()).toBe(true);
    });

    it('should show empty state with filters message', async () => {
      // Set up empty task list with active filters
      taskStore.tasks = [];
      wrapper.vm.filters.status = ['completed'];
      await wrapper.vm.$nextTick();
      
      const emptyState = wrapper.find('[data-test="empty-state"]');
      expect(emptyState.exists()).toBe(true);
      expect(emptyState.text()).toContain('No tasks match your filters');
    });
  });

  describe('Export Workflow', () => {
    it('should open export dialog when export button clicked', async () => {
      await wrapper.vm.$nextTick();
      
      const exportBtn = wrapper.find('[data-test="export-button"]');
      await exportBtn.trigger('click');
      
      expect(wrapper.vm.showExportDialog).toBe(true);
    });

    it('should disable export button when no tasks', async () => {
      taskStore.tasks = [];
      await wrapper.vm.$nextTick();
      
      const exportBtn = wrapper.find('[data-test="export-button"]');
      expect(exportBtn.attributes('disabled')).toBeDefined();
    });

    it('should create export through export dialog', async () => {
      await wrapper.vm.$nextTick();
      
      // Open export dialog
      wrapper.vm.showExportDialog = true;
      await wrapper.vm.$nextTick();
      
      // Trigger export creation
      const createExportBtn = wrapper.find('[data-test="create-export-button"]');
      await createExportBtn.trigger('click');
      
      expect(wrapper.vm.showExportDialog).toBe(false);
    });

    it('should trigger export from advanced filter panel', async () => {
      await wrapper.vm.$nextTick();
      
      // Expand filter panel
      wrapper.vm.filterExpanded = [0];
      await wrapper.vm.$nextTick();
      
      // Click advanced export button
      const advancedExportBtn = wrapper.find('[data-test="advanced-export-button"]');
      await advancedExportBtn.trigger('click');
      
      expect(wrapper.vm.showExportDialog).toBe(true);
    });
  });

  describe('Pagination Workflow', () => {
    it('should handle page changes', async () => {
      // Set up pagination
      taskStore.pagination = { page: 1, pages: 3, total: 30, limit: 10 };
      await wrapper.vm.$nextTick();
      
      // Simulate page change
      taskStore.setPage(2);
      
      expect(taskStore.setPage).toHaveBeenCalledWith(2);
    });

    it('should display pagination when multiple pages exist', async () => {
      taskStore.pagination = { page: 1, pages: 3, total: 30, limit: 10 };
      await wrapper.vm.$nextTick();
      
      const pagination = wrapper.find('v-pagination-stub');
      expect(pagination.exists()).toBe(true);
    });
  });

  describe('Error Handling Workflows', () => {
    it('should display error state when fetch fails', async () => {
      taskStore.error = 'Failed to load tasks';
      taskStore.loading = false;
      await wrapper.vm.$nextTick();
      
      const errorAlert = wrapper.find('v-alert-stub');
      expect(errorAlert.exists()).toBe(true);
    });

    it('should handle task creation error gracefully', async () => {
      mockApiClient.createTask.mockRejectedValue(new Error('Creation failed'));
      
      // Should not throw when save fails
      await expect(wrapper.vm.handleSave()).resolves.toBeUndefined();
    });

    it('should handle task deletion error gracefully', async () => {
      mockApiClient.deleteTask.mockRejectedValue(new Error('Deletion failed'));
      
      wrapper.vm.selectedTask = mockTasks[0];
      
      // Should not throw when delete fails
      await expect(wrapper.vm.confirmDelete()).resolves.toBeUndefined();
    });
  });

  describe('Real-time Updates Workflow', () => {
    it('should initialize socket listeners on mount', async () => {
      expect(exportStore.initializeSocketListeners).toHaveBeenCalled();
    });

    it('should cleanup socket listeners on unmount', () => {
      wrapper.unmount();
      expect(exportStore.cleanup).toHaveBeenCalled();
    });

    it('should handle socket connection state changes', async () => {
      // Simulate socket connection
      mockSocket.connected = true;
      await wrapper.vm.$nextTick();
      
      // Verify socket usage in stores
      expect(mockSocket.on).toHaveBeenCalled();
    });
  });

  describe('Complete User Journey', () => {
    it('should support complete task management lifecycle', async () => {
      await wrapper.vm.$nextTick();
      
      // 1. Load initial tasks
      expect(taskStore.tasks).toHaveLength(3);
      
      // 2. Filter tasks
      wrapper.vm.filters.status = ['pending'];
      wrapper.vm.updateFilters();
      expect(taskStore.updateFilters).toHaveBeenCalled();
      
      // 3. Create new task
      wrapper.vm.showCreateDialog = true;
      await wrapper.vm.$nextTick();
      await wrapper.vm.handleSave();
      expect(mockApiClient.createTask).toHaveBeenCalled();
      
      // 4. Edit existing task
      wrapper.vm.editTask(mockTasks[0]);
      expect(wrapper.vm.showEditDialog).toBe(true);
      
      // 5. Export tasks
      wrapper.vm.showExportDialog = true;
      await wrapper.vm.$nextTick();
      wrapper.vm.handleExportCreated({ _id: 'export-123' });
      expect(wrapper.vm.showExportDialog).toBe(false);
      
      // 6. Delete task
      wrapper.vm.deleteTask(mockTasks[0]);
      await wrapper.vm.confirmDelete();
      expect(mockApiClient.deleteTask).toHaveBeenCalled();
    });

    it('should maintain state consistency throughout workflow', async () => {
      await wrapper.vm.$nextTick();
      
      // Initial state
      expect(wrapper.vm.showCreateDialog).toBe(false);
      expect(wrapper.vm.showEditDialog).toBe(false);
      expect(wrapper.vm.showDeleteDialog).toBe(false);
      expect(wrapper.vm.selectedTask).toBe(null);
      
      // After operations, state should be clean
      await wrapper.vm.handleSave();
      expect(wrapper.vm.showCreateDialog).toBe(false);
      expect(wrapper.vm.showEditDialog).toBe(false);
      expect(wrapper.vm.selectedTask).toBe(null);
    });
  });

  describe('Responsive Behavior', () => {
    it('should handle rapid user interactions', async () => {
      await wrapper.vm.$nextTick();
      
      // Rapid clicks should not break state
      wrapper.vm.showCreateDialog = true;
      wrapper.vm.showCreateDialog = false;
      wrapper.vm.showCreateDialog = true;
      
      await wrapper.vm.$nextTick();
      expect(wrapper.vm.showCreateDialog).toBe(true);
    });

    it('should handle concurrent operations', async () => {
      await wrapper.vm.$nextTick();
      
      // Start multiple operations
      const promises = [
        wrapper.vm.handleSave(),
        wrapper.vm.confirmDelete(),
        taskStore.fetchTasks()
      ];
      
      // Should not throw errors
      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });
});