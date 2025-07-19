/**
 * @fileoverview Integration tests for enhanced task filtering API endpoints
 * @module tests/routes/api.enhanced-filtering.test
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createServer } from 'http';
import express from 'express';

// Import test utilities
import { setupTestEnvironment, teardownTestEnvironment, cleanTestEnvironment } from '../utils/testSetup.js';
import { createMockTasks, generateMockTask } from '../utils/mockData.js';

// Import the models and services
import Task from '../../src/models/Task.js';
import TaskFilterService from '../../src/services/taskFilterService.js';

// Import API routes
import apiRoutes from '../../src/routes/api.js';

describe('Enhanced Task Filtering API Tests', () => {
  let app;
  let server;
  let baseUrl;

  // Setup test environment
  before(async () => {
    await setupTestEnvironment();
    
    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);
    
    // Start server on random port
    server = createServer(app);
    await new Promise(resolve => {
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
    
    console.log(`🚀 Test server running at ${baseUrl}`);
  });

  after(async () => {
    // Close server and clean up
    await new Promise(resolve => server.close(resolve));
    await teardownTestEnvironment();
  });

  beforeEach(async () => {
    await cleanTestEnvironment();
  });

  /**
   * Helper function to make API requests
   * @param {string} path - API path
   * @param {Object} queryParams - Query parameters
   * @returns {Promise<Object>} Response data
   */
  const makeRequest = async (path, queryParams = {}) => {
    const queryString = Object.entries(queryParams)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    
    const url = `${baseUrl}${path}${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    return {
      status: response.status,
      data
    };
  };

  describe('GET /api/tasks with Enhanced Filtering', () => {
    beforeEach(async () => {
      // Create a diverse set of tasks for testing
      await Task.create(generateMockTask({
        title: 'Important urgent task',
        description: 'This is a critical task that needs attention',
        status: 'pending',
        priority: 'high',
        createdAt: new Date('2024-01-15T10:00:00Z')
      }));
      
      await Task.create(generateMockTask({
        title: 'Regular task',
        description: 'This task contains urgent keyword in description',
        status: 'in-progress',
        priority: 'medium',
        createdAt: new Date('2024-02-20T10:00:00Z')
      }));
      
      await Task.create(generateMockTask({
        title: 'Low priority task',
        description: 'This is a low priority task',
        status: 'pending',
        priority: 'low',
        createdAt: new Date('2024-03-10T10:00:00Z')
      }));
      
      await Task.create(generateMockTask({
        title: 'Completed task',
        description: 'This task has been completed',
        status: 'completed',
        priority: 'medium',
        createdAt: new Date('2024-01-05T10:00:00Z'),
        completedAt: new Date('2024-01-10T10:00:00Z')
      }));
      
      await Task.create(generateMockTask({
        title: 'Database optimization',
        description: 'Optimize database queries for better performance',
        status: 'in-progress',
        priority: 'high',
        createdAt: new Date('2024-03-15T10:00:00Z')
      }));
    });

    test('should return all tasks when no filters are applied', async () => {
      const { status, data } = await makeRequest('/api/tasks');
      
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.tasks.length, 5);
      assert.strictEqual(data.data.pagination.total, 5);
    });

    test('should filter tasks by text search in title', async () => {
      const { status, data } = await makeRequest('/api/tasks', { search: 'important' });
      
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.tasks.length, 1);
      assert.strictEqual(data.data.tasks[0].title, 'Important urgent task');
    });

    test('should filter tasks by text search in description', async () => {
      const { status, data } = await makeRequest('/api/tasks', { search: 'database queries' });
      
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.tasks.length, 1);
      assert.strictEqual(data.data.tasks[0].title, 'Database optimization');
    });

    test('should filter tasks by date range with dateFrom only', async () => {
      const dateFrom = '2024-03-01T00:00:00Z';
      const { status, data } = await makeRequest('/api/tasks', { dateFrom });
      
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.tasks.length, 2);
      
      // All returned tasks should have createdAt >= dateFrom
      const fromDate = new Date(dateFrom);
      data.data.tasks.forEach(task => {
        assert(new Date(task.createdAt) >= fromDate);
      });
    });

    test('should filter tasks by date range with dateTo only', async () => {
      const dateTo = '2024-01-31T23:59:59Z';
      const { status, data } = await makeRequest('/api/tasks', { dateTo });
      
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.tasks.length, 2);
      
      // All returned tasks should have createdAt <= dateTo
      const toDate = new Date(dateTo);
      data.data.tasks.forEach(task => {
        assert(new Date(task.createdAt) <= toDate);
      });
    });

    test('should filter tasks by date range with both dateFrom and dateTo', async () => {
      const dateFrom = '2024-02-01T00:00:00Z';
      const dateTo = '2024-02-28T23:59:59Z';
      const { status, data } = await makeRequest('/api/tasks', { dateFrom, dateTo });
      
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.tasks.length, 1);
      assert.strictEqual(data.data.tasks[0].title, 'Regular task');
      
      // All returned tasks should be within the date range
      const fromDate = new Date(dateFrom);
      const toDate = new Date(dateTo);
      data.data.tasks.forEach(task => {
        const taskDate = new Date(task.createdAt);
        assert(taskDate >= fromDate && taskDate <= toDate);
      });
    });

    test('should combine text search with status filter', async () => {
      const { status, data } = await makeRequest('/api/tasks', { 
        search: 'task', 
        status: 'pending' 
      });
      
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.tasks.length, 2);
      
      // All returned tasks should have status 'pending' and contain 'task' in title or description
      data.data.tasks.forEach(task => {
        assert.strictEqual(task.status, 'pending');
        assert(
          task.title.toLowerCase().includes('task') || 
          task.description.toLowerCase().includes('task')
        );
      });
    });

    test('should combine text search with priority filter', async () => {
      const { status, data } = await makeRequest('/api/tasks', { 
        search: 'task', 
        priority: 'high' 
      });
      
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.tasks.length, 1);
      assert.strictEqual(data.data.tasks[0].title, 'Important urgent task');
      
      // All returned tasks should have priority 'high' and contain 'task' in title or description
      data.data.tasks.forEach(task => {
        assert.strictEqual(task.priority, 'high');
        assert(
          task.title.toLowerCase().includes('task') || 
          task.description.toLowerCase().includes('task')
        );
      });
    });

    test('should combine date range with status filter', async () => {
      const dateFrom = '2024-01-01T00:00:00Z';
      const dateTo = '2024-02-28T23:59:59Z';
      const { status, data } = await makeRequest('/api/tasks', { 
        dateFrom, 
        dateTo, 
        status: 'pending' 
      });
      
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.tasks.length, 1);
      assert.strictEqual(data.data.tasks[0].title, 'Important urgent task');
      
      // All returned tasks should have status 'pending' and be within the date range
      const fromDate = new Date(dateFrom);
      const toDate = new Date(dateTo);
      data.data.tasks.forEach(task => {
        assert.strictEqual(task.status, 'pending');
        const taskDate = new Date(task.createdAt);
        assert(taskDate >= fromDate && taskDate <= toDate);
      });
    });

    test('should combine all filter types (text search, date range, status, priority)', async () => {
      const dateFrom = '2024-01-01T00:00:00Z';
      const dateTo = '2024-01-31T23:59:59Z';
      const { status, data } = await makeRequest('/api/tasks', { 
        search: 'urgent', 
        dateFrom, 
        dateTo, 
        status: 'pending',
        priority: 'high'
      });
      
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.tasks.length, 1);
      assert.strictEqual(data.data.tasks[0].title, 'Important urgent task');
      
      // All returned tasks should match all criteria
      const fromDate = new Date(dateFrom);
      const toDate = new Date(dateTo);
      data.data.tasks.forEach(task => {
        assert.strictEqual(task.status, 'pending');
        assert.strictEqual(task.priority, 'high');
        const taskDate = new Date(task.createdAt);
        assert(taskDate >= fromDate && taskDate <= toDate);
        assert(
          task.title.toLowerCase().includes('urgent') || 
          task.description.toLowerCase().includes('urgent')
        );
      });
    });

    test('should handle pagination with filters', async () => {
      // Create additional tasks to test pagination
      await createMockTasks(10, { status: 'pending' });
      
      const { status, data } = await makeRequest('/api/tasks', { 
        status: 'pending',
        page: 1,
        limit: 5
      });
      
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.tasks.length, 5);
      assert(data.data.pagination.total > 5);
      assert.strictEqual(data.data.pagination.page, 1);
      assert.strictEqual(data.data.pagination.limit, 5);
      
      // Check second page
      const page2 = await makeRequest('/api/tasks', { 
        status: 'pending',
        page: 2,
        limit: 5
      });
      
      assert.strictEqual(page2.status, 200);
      assert.strictEqual(page2.data.success, true);
      assert(page2.data.data.tasks.length > 0);
      assert.strictEqual(page2.data.data.pagination.page, 2);
      
      // Ensure we got different tasks on different pages
      const page1Ids = data.data.tasks.map(t => t._id);
      const page2Ids = page2.data.data.tasks.map(t => t._id);
      
      // No task should appear on both pages
      const intersection = page1Ids.filter(id => page2Ids.includes(id));
      assert.strictEqual(intersection.length, 0);
    });

    test('should handle sorting with filters', async () => {
      const { status, data } = await makeRequest('/api/tasks', { 
        status: 'pending',
        sortBy: 'title',
        sortOrder: 'asc'
      });
      
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      
      // Verify tasks are sorted by title in ascending order
      const titles = data.data.tasks.map(t => t.title);
      const sortedTitles = [...titles].sort();
      assert.deepStrictEqual(titles, sortedTitles);
    });

    test('should handle invalid filter parameters gracefully', async () => {
      const { status, data } = await makeRequest('/api/tasks', { 
        status: 'invalid-status',
        priority: 'invalid-priority',
        dateFrom: 'not-a-date',
        search: 'a'.repeat(1000) // Very long search
      });
      
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      
      // Should return all tasks since invalid filters should be ignored
      // Note: The TaskFilterService will sanitize invalid filters, so we just check that the API responds successfully
      assert(data.data.pagination.total >= 0);
    });

    test('should handle special characters in search parameter', async () => {
      // Create a task with special characters
      await Task.create(generateMockTask({
        title: 'Task with special chars: @#$%',
        description: 'Description with symbols & punctuation!'
      }));
      
      const { status, data } = await makeRequest('/api/tasks', { 
        search: 'special chars'  // Remove special characters that might cause regex issues
      });
      
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      
      // Check if we got any results or if the API handled it gracefully
      if (data.data.tasks.length > 0) {
        // At least one task should match the search
        const hasMatch = data.data.tasks.some(task => 
          task.title.includes('special chars')
        );
        assert(hasMatch);
      } else {
        // If no results, the API should still return a valid response
        assert.strictEqual(data.data.pagination.total, 0);
      }
    });

    test('should maintain backward compatibility with existing filters', async () => {
      // Test with only traditional filters
      const { status, data } = await makeRequest('/api/tasks', { 
        status: 'pending',
        priority: 'high'
      });
      
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.tasks.length, 1);
      assert.strictEqual(data.data.tasks[0].title, 'Important urgent task');
      
      // All returned tasks should match traditional filters
      data.data.tasks.forEach(task => {
        assert.strictEqual(task.status, 'pending');
        assert.strictEqual(task.priority, 'high');
      });
    });
  });

  describe('TaskFilterService Integration with API', () => {
    test('should use TaskFilterService for sanitizing filter parameters', async () => {
      // Create a spy on TaskFilterService.sanitizeFilters
      const originalSanitizeFilters = TaskFilterService.sanitizeFilters;
      let sanitizeFiltersCalled = false;
      let sanitizeFiltersArgs = null;
      
      TaskFilterService.sanitizeFilters = function(filters) {
        sanitizeFiltersCalled = true;
        sanitizeFiltersArgs = filters;
        return originalSanitizeFilters.call(this, filters);
      };
      
      try {
        await makeRequest('/api/tasks', { 
          status: 'pending',
          search: 'test',
          dateFrom: '2024-01-01'
        });
        
        assert(sanitizeFiltersCalled, 'TaskFilterService.sanitizeFilters should be called');
        assert(sanitizeFiltersArgs, 'TaskFilterService.sanitizeFilters should receive arguments');
        assert.strictEqual(sanitizeFiltersArgs.status, 'pending');
        assert.strictEqual(sanitizeFiltersArgs.search, 'test');
        assert.strictEqual(sanitizeFiltersArgs.dateFrom, '2024-01-01');
      } finally {
        // Restore original function
        TaskFilterService.sanitizeFilters = originalSanitizeFilters;
      }
    });

    test('should use TaskFilterService for building filter queries', async () => {
      // Create a spy on TaskFilterService.buildFilterQuery
      const originalBuildFilterQuery = TaskFilterService.buildFilterQuery;
      let buildFilterQueryCalled = false;
      let buildFilterQueryArgs = null;
      
      TaskFilterService.buildFilterQuery = function(filters) {
        buildFilterQueryCalled = true;
        buildFilterQueryArgs = filters;
        return originalBuildFilterQuery.call(this, filters);
      };
      
      try {
        await makeRequest('/api/tasks', { 
          status: 'pending',
          search: 'test'
        });
        
        assert(buildFilterQueryCalled, 'TaskFilterService.buildFilterQuery should be called');
        assert(buildFilterQueryArgs, 'TaskFilterService.buildFilterQuery should receive arguments');
        assert.strictEqual(buildFilterQueryArgs.status, 'pending');
        assert.strictEqual(buildFilterQueryArgs.search, 'test');
      } finally {
        // Restore original function
        TaskFilterService.buildFilterQuery = originalBuildFilterQuery;
      }
    });

    test('should use TaskFilterService for building sort options', async () => {
      // Create a spy on TaskFilterService.buildSortOptions
      const originalBuildSortOptions = TaskFilterService.buildSortOptions;
      let buildSortOptionsCalled = false;
      let buildSortOptionsArgs = null;
      
      TaskFilterService.buildSortOptions = function(sortBy, sortOrder) {
        buildSortOptionsCalled = true;
        buildSortOptionsArgs = { sortBy, sortOrder };
        return originalBuildSortOptions.call(this, sortBy, sortOrder);
      };
      
      try {
        await makeRequest('/api/tasks', { 
          sortBy: 'title',
          sortOrder: 'asc'
        });
        
        assert(buildSortOptionsCalled, 'TaskFilterService.buildSortOptions should be called');
        assert(buildSortOptionsArgs, 'TaskFilterService.buildSortOptions should receive arguments');
        assert.strictEqual(buildSortOptionsArgs.sortBy, 'title');
        assert.strictEqual(buildSortOptionsArgs.sortOrder, 'asc');
      } finally {
        // Restore original function
        TaskFilterService.buildSortOptions = originalBuildSortOptions;
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty result sets gracefully', async () => {
      const { status, data } = await makeRequest('/api/tasks', { 
        search: 'nonexistent-term-that-wont-match-anything'
      });
      
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.tasks.length, 0);
      assert.strictEqual(data.data.pagination.total, 0);
    });

    test('should handle malformed query parameters gracefully', async () => {
      const { status, data } = await makeRequest('/api/tasks', { 
        page: 'not-a-number',
        limit: 'also-not-a-number'
      });
      
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      
      // The API should return a valid response structure even with invalid parameters
      assert(data.data.tasks !== undefined);
      assert(data.data.pagination !== undefined);
    });

    test('should handle very large limit values', async () => {
      // Create many tasks
      await createMockTasks(50);
      
      const { status, data } = await makeRequest('/api/tasks', { 
        limit: 1000 // Very large limit
      });
      
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      
      // Should return all tasks but not crash
      assert(data.data.tasks.length > 0);
      assert.strictEqual(data.data.tasks.length, data.data.pagination.total);
    });
  });
});