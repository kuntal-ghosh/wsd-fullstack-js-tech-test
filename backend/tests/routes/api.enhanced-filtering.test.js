/**
 * @fileoverview Enhanced task filtering API tests - Compatible with Node.js test runner
 * @module tests/routes/api.enhanced-filtering.compatible
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';

// Import test utilities
import { setupTestEnvironment, teardownTestEnvironment, cleanTestEnvironment } from '../utils/testSetup.js';
import { createMockTasks, generateMockTask } from '../utils/mockData.js';

// Import the models and services
import Task from '../../src/models/Task.js';
import TaskFilterService from '../../src/services/taskFilterService.js';

describe('Enhanced Task Filtering Logic Tests', () => {
  // Setup test environment
  before(async () => {
    await setupTestEnvironment();
  });

  after(async () => {
    await teardownTestEnvironment();
  });

  beforeEach(async () => {
    await cleanTestEnvironment();
  });

  describe('Enhanced Filter Parameters Integration', () => {
    test('should support search parameter for text filtering', async () => {
      // Create test tasks with searchable content
      await createMockTasks(5, {});
      await Task.create(generateMockTask({
        title: 'Important urgent task',
        description: 'This is a critical task that needs attention'
      }));
      await Task.create(generateMockTask({
        title: 'Regular task',
        description: 'This task contains urgent keyword in description'
      }));

      // Test the filter service directly
      const filters = TaskFilterService.sanitizeFilters({ search: 'urgent' });
      const query = TaskFilterService.buildFilterQuery(filters);
      const tasks = await Task.find(query);

      assert.strictEqual(tasks.length, 2);
      
      // Verify both tasks contain the search term
      const hasUrgentInTitle = tasks.some(task => 
        task.title.toLowerCase().includes('urgent')
      );
      const hasUrgentInDescription = tasks.some(task => 
        task.description && task.description.toLowerCase().includes('urgent')
      );
      
      assert(hasUrgentInTitle || hasUrgentInDescription);
    });

    test('should support dateFrom parameter for date range filtering', async () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Create tasks with different creation dates
      await Task.create(generateMockTask({
        title: 'Recent task',
        createdAt: now
      }));
      await Task.create(generateMockTask({
        title: 'Old task',
        createdAt: sevenDaysAgo
      }));

      const filters = TaskFilterService.sanitizeFilters({ 
        dateFrom: threeDaysAgo.toISOString() 
      });
      const query = TaskFilterService.buildFilterQuery(filters);
      const tasks = await Task.find(query);

      assert.strictEqual(tasks.length, 1);
      assert.strictEqual(tasks[0].title, 'Recent task');
    });

    test('should support dateTo parameter for date range filtering', async () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Create tasks with different creation dates
      await Task.create(generateMockTask({
        title: 'Recent task',
        createdAt: now
      }));
      await Task.create(generateMockTask({
        title: 'Old task',
        createdAt: sevenDaysAgo
      }));

      const filters = TaskFilterService.sanitizeFilters({ 
        dateTo: threeDaysAgo.toISOString() 
      });
      const query = TaskFilterService.buildFilterQuery(filters);
      const tasks = await Task.find(query);

      assert.strictEqual(tasks.length, 1);
      assert.strictEqual(tasks[0].title, 'Old task');
    });

    test('should support both dateFrom and dateTo for date range filtering', async () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Create tasks with different creation dates
      await Task.create(generateMockTask({
        title: 'Very recent task',
        createdAt: now
      }));
      await Task.create(generateMockTask({
        title: 'In range task',
        createdAt: fiveDaysAgo
      }));
      await Task.create(generateMockTask({
        title: 'Old task',
        createdAt: sevenDaysAgo
      }));

      const filters = TaskFilterService.sanitizeFilters({ 
        dateFrom: sevenDaysAgo.toISOString(),
        dateTo: twoDaysAgo.toISOString()
      });
      const query = TaskFilterService.buildFilterQuery(filters);
      const tasks = await Task.find(query);

      // Should find tasks within the date range (both old task and in range task should match)
      assert.strictEqual(tasks.length, 2);
      const titles = tasks.map(task => task.title);
      assert(titles.includes('In range task'));
      assert(titles.includes('Old task'));
    });

    test('should combine multiple filter parameters correctly', async () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      // Create tasks with various combinations
      await Task.create(generateMockTask({
        title: 'High priority urgent task',
        priority: 'high',
        status: 'pending',
        createdAt: now
      }));
      await Task.create(generateMockTask({
        title: 'Low priority urgent task',
        priority: 'low',
        status: 'pending',
        createdAt: now
      }));
      await Task.create(generateMockTask({
        title: 'High priority old task',
        priority: 'high',
        status: 'pending',
        createdAt: threeDaysAgo
      }));

      const filters = TaskFilterService.sanitizeFilters({ 
        search: 'urgent',
        priority: 'high',
        status: 'pending',
        dateFrom: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString() // 1 day ago
      });
      const query = TaskFilterService.buildFilterQuery(filters);
      const tasks = await Task.find(query);

      assert.strictEqual(tasks.length, 1);
      assert.strictEqual(tasks[0].title, 'High priority urgent task');
    });
  });

  describe('Text Search Functionality', () => {
    beforeEach(async () => {
      // Create tasks with varied content for search testing
      await Task.create(generateMockTask({
        title: 'Database optimization task',
        description: 'Optimize database queries for better performance'
      }));
      await Task.create(generateMockTask({
        title: 'Frontend development',
        description: 'Implement new user interface components'
      }));
      await Task.create(generateMockTask({
        title: 'API documentation',
        description: 'Write comprehensive API documentation'
      }));
      await Task.create(generateMockTask({
        title: 'Performance testing',
        description: 'Test application performance under load'
      }));
    });

    test('should search in task titles', async () => {
      const filters = TaskFilterService.sanitizeFilters({ search: 'database' });
      const query = TaskFilterService.buildFilterQuery(filters);
      const tasks = await Task.find(query);

      assert.strictEqual(tasks.length, 1);
      assert(tasks[0].title.toLowerCase().includes('database'));
    });

    test('should search in task descriptions', async () => {
      const filters = TaskFilterService.sanitizeFilters({ search: 'performance' });
      const query = TaskFilterService.buildFilterQuery(filters);
      const tasks = await Task.find(query);

      assert.strictEqual(tasks.length, 2);
      
      const titles = tasks.map(task => task.title);
      assert(titles.includes('Database optimization task'));
      assert(titles.includes('Performance testing'));
    });

    test('should be case insensitive', async () => {
      const filters = TaskFilterService.sanitizeFilters({ search: 'API' });
      const query = TaskFilterService.buildFilterQuery(filters);
      const tasks = await Task.find(query);

      assert.strictEqual(tasks.length, 1);
      assert.strictEqual(tasks[0].title, 'API documentation');
    });

    test('should handle partial word matches', async () => {
      const filters = TaskFilterService.sanitizeFilters({ search: 'develop' });
      const query = TaskFilterService.buildFilterQuery(filters);
      const tasks = await Task.find(query);

      assert.strictEqual(tasks.length, 1);
      assert.strictEqual(tasks[0].title, 'Frontend development');
    });

    test('should return empty results for non-matching search', async () => {
      const filters = TaskFilterService.sanitizeFilters({ search: 'nonexistent' });
      const query = TaskFilterService.buildFilterQuery(filters);
      const tasks = await Task.find(query);

      assert.strictEqual(tasks.length, 0);
    });

    test('should handle empty search parameter', async () => {
      const filters = TaskFilterService.sanitizeFilters({ search: '' });
      const query = TaskFilterService.buildFilterQuery(filters);
      const tasks = await Task.find(query);

      assert.strictEqual(tasks.length, 4); // All tasks
    });

    test('should handle special characters in search', async () => {
      await Task.create(generateMockTask({
        title: 'Task with special chars: @#$%',
        description: 'Description with symbols & punctuation!'
      }));

      const filters = TaskFilterService.sanitizeFilters({ search: 'special chars' });
      const query = TaskFilterService.buildFilterQuery(filters);
      const tasks = await Task.find(query);

      assert.strictEqual(tasks.length, 1);
    });
  });

  describe('Date Range Filtering', () => {
    beforeEach(async () => {
      const now = new Date();
      
      // Create tasks with specific dates
      await Task.create(generateMockTask({
        title: 'Today task',
        createdAt: now
      }));
      await Task.create(generateMockTask({
        title: 'Yesterday task',
        createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000)
      }));
      await Task.create(generateMockTask({
        title: 'Week old task',
        createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      }));
      await Task.create(generateMockTask({
        title: 'Month old task',
        createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      }));
    });

    test('should filter tasks from specific date', async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      
      const filters = TaskFilterService.sanitizeFilters({ 
        dateFrom: threeDaysAgo.toISOString() 
      });
      const query = TaskFilterService.buildFilterQuery(filters);
      const tasks = await Task.find(query);

      assert.strictEqual(tasks.length, 2); // Today and yesterday
      
      const titles = tasks.map(task => task.title);
      assert(titles.includes('Today task'));
      assert(titles.includes('Yesterday task'));
    });

    test('should filter tasks until specific date', async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      
      const filters = TaskFilterService.sanitizeFilters({ 
        dateTo: threeDaysAgo.toISOString() 
      });
      const query = TaskFilterService.buildFilterQuery(filters);
      const tasks = await Task.find(query);

      assert.strictEqual(tasks.length, 2); // Week old and month old
      
      const titles = tasks.map(task => task.title);
      assert(titles.includes('Week old task'));
      assert(titles.includes('Month old task'));
    });

    test('should handle invalid date formats gracefully', async () => {
      const filters = TaskFilterService.sanitizeFilters({ 
        dateFrom: 'invalid-date' 
      });
      const query = TaskFilterService.buildFilterQuery(filters);
      const tasks = await Task.find(query);

      assert.strictEqual(tasks.length, 4); // All tasks (filter ignored)
    });

    test('should handle future dates correctly', async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      const filters = TaskFilterService.sanitizeFilters({ 
        dateFrom: tomorrow.toISOString() 
      });
      const query = TaskFilterService.buildFilterQuery(filters);
      const tasks = await Task.find(query);

      assert.strictEqual(tasks.length, 0); // No future tasks
    });

    test('should handle dateFrom after dateTo gracefully', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const filters = TaskFilterService.sanitizeFilters({ 
        dateFrom: now.toISOString(),
        dateTo: yesterday.toISOString()
      });
      const query = TaskFilterService.buildFilterQuery(filters);
      const tasks = await Task.find(query);

      assert.strictEqual(tasks.length, 0); // No tasks in invalid range
    });
  });

  describe('TaskFilterService Integration', () => {
    test('should use TaskFilterService for building filter queries', async () => {
      // Create test tasks
      await createMockTasks(5, { status: 'pending', priority: 'high' });
      await createMockTasks(3, { status: 'completed', priority: 'low' });

      const rawFilters = {
        status: 'pending',
        priority: 'high',
        search: 'Test Task'
      };

      // Test filter sanitization and query building
      const sanitizedFilters = TaskFilterService.sanitizeFilters(rawFilters);
      const query = TaskFilterService.buildFilterQuery(sanitizedFilters);
      const tasks = await Task.find(query);

      // Should find tasks that match the criteria
      assert(tasks.length > 0);
      tasks.forEach(task => {
        assert.strictEqual(task.status, 'pending');
        assert.strictEqual(task.priority, 'high');
      });
    });

    test('should use TaskFilterService for building sort options', async () => {
      await createMockTasks(5, {});

      const sortBy = 'title';
      const sortOrder = 'asc';
      
      const sortOptions = TaskFilterService.buildSortOptions(sortBy, sortOrder);
      const tasks = await Task.find({}).sort(sortOptions);

      // Verify tasks are sorted correctly
      for (let i = 1; i < tasks.length; i++) {
        assert(tasks[i-1].title <= tasks[i].title);
      }
    });

    test('should sanitize filters using TaskFilterService logic', async () => {
      await createMockTasks(3, { status: 'pending' });

      // Test with potentially problematic input
      const rawFilters = { 
        status: '  pending  ', // Extra whitespace
        search: 'test.*+?^${}()|[]\\', // Regex special characters
        priority: 'invalid-priority' // Invalid value
      };

      const sanitizedFilters = TaskFilterService.sanitizeFilters(rawFilters);
      const query = TaskFilterService.buildFilterQuery(sanitizedFilters);
      const tasks = await Task.find(query);

      // Should handle sanitization gracefully
      assert(Array.isArray(tasks));
      assert.strictEqual(sanitizedFilters.status, 'pending'); // Trimmed
      assert(sanitizedFilters.search); // Special chars escaped
      assert(!sanitizedFilters.priority); // Invalid value removed
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle very long search strings', async () => {
      await createMockTasks(3, {});
      
      const longSearch = 'a'.repeat(1000); // Very long search string
      
      const filters = TaskFilterService.sanitizeFilters({ search: longSearch });
      const query = TaskFilterService.buildFilterQuery(filters);
      const tasks = await Task.find(query);

      // Should truncate search string and handle gracefully
      assert(Array.isArray(tasks));
      assert(filters.search.length <= 255); // Should be truncated
    });

    test('should handle malformed filter objects', async () => {
      await createMockTasks(3, {});

      // Test various malformed inputs
      const malformedInputs = [
        null,
        undefined,
        'string',
        123,
        [],
        { status: null },
        { priority: undefined },
        { search: '' }
      ];

      for (const input of malformedInputs) {
        const filters = TaskFilterService.sanitizeFilters(input);
        const query = TaskFilterService.buildFilterQuery(filters);
        const tasks = await Task.find(query);

        // Should handle gracefully without throwing errors
        assert(Array.isArray(tasks));
      }
    });
  });
});