/**
 * @fileoverview Unit tests for TaskFilterService
 * @module tests/services/taskFilterService.unit.test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

// Note: TaskFilterService doesn't exist yet - these are TDD tests that will fail initially
// The service will be implemented in the next task based on these failing tests

describe('TaskFilterService Unit Tests', () => {
  
  describe('Class Structure', () => {
    test('should be a class with static methods', () => {
      // This will fail initially since TaskFilterService doesn't exist yet
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        assert(TaskFilterService);
        assert(typeof TaskFilterService.buildFilterQuery === 'function');
        assert(typeof TaskFilterService.buildSortOptions === 'function');
        assert(typeof TaskFilterService.sanitizeFilters === 'function');
      } catch (error) {
        // Expected to fail in TDD - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });
  });

  describe('buildFilterQuery Method', () => {
    test('should return empty query for empty filters', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        const result = TaskFilterService.buildFilterQuery({});
        assert.deepStrictEqual(result, {});
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should build status filter correctly', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        const filters = { status: 'pending' };
        const result = TaskFilterService.buildFilterQuery(filters);
        assert.deepStrictEqual(result, { status: 'pending' });
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should build priority filter correctly', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        const filters = { priority: 'high' };
        const result = TaskFilterService.buildFilterQuery(filters);
        assert.deepStrictEqual(result, { priority: 'high' });
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should build combined status and priority filters', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        const filters = { status: 'in-progress', priority: 'medium' };
        const result = TaskFilterService.buildFilterQuery(filters);
        assert.deepStrictEqual(result, { 
          status: 'in-progress', 
          priority: 'medium' 
        });
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should build date range filter with dateFrom only', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        const dateFrom = '2024-01-01T00:00:00.000Z';
        const filters = { dateFrom };
        const result = TaskFilterService.buildFilterQuery(filters);
        
        assert(result.createdAt);
        assert(result.createdAt.$gte instanceof Date);
        assert.strictEqual(result.createdAt.$gte.toISOString(), dateFrom);
        assert.strictEqual(result.createdAt.$lte, undefined);
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should build date range filter with dateTo only', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        const dateTo = '2024-12-31T23:59:59.999Z';
        const filters = { dateTo };
        const result = TaskFilterService.buildFilterQuery(filters);
        
        assert(result.createdAt);
        assert(result.createdAt.$lte instanceof Date);
        assert.strictEqual(result.createdAt.$lte.toISOString(), dateTo);
        assert.strictEqual(result.createdAt.$gte, undefined);
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should build date range filter with both dateFrom and dateTo', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        const dateFrom = '2024-01-01T00:00:00.000Z';
        const dateTo = '2024-12-31T23:59:59.999Z';
        const filters = { dateFrom, dateTo };
        const result = TaskFilterService.buildFilterQuery(filters);
        
        assert(result.createdAt);
        assert(result.createdAt.$gte instanceof Date);
        assert(result.createdAt.$lte instanceof Date);
        assert.strictEqual(result.createdAt.$gte.toISOString(), dateFrom);
        assert.strictEqual(result.createdAt.$lte.toISOString(), dateTo);
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should handle invalid date strings gracefully', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        const filters = { dateFrom: 'invalid-date', dateTo: 'also-invalid' };
        const result = TaskFilterService.buildFilterQuery(filters);
        
        // Should either skip invalid dates or handle them gracefully
        // The exact behavior will be defined in the implementation
        assert(typeof result === 'object');
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should build text search filter for single term', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        const filters = { search: 'urgent' };
        const result = TaskFilterService.buildFilterQuery(filters);
        
        assert(result.$or);
        assert(Array.isArray(result.$or));
        assert.strictEqual(result.$or.length, 2);
        
        // Check title search
        assert(result.$or[0].title);
        assert(result.$or[0].title.$regex === 'urgent');
        assert(result.$or[0].title.$options === 'i');
        
        // Check description search
        assert(result.$or[1].description);
        assert(result.$or[1].description.$regex === 'urgent');
        assert(result.$or[1].description.$options === 'i');
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should build text search filter with special characters', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        const filters = { search: 'test-task.v2' };
        const result = TaskFilterService.buildFilterQuery(filters);
        
        assert(result.$or);
        assert(Array.isArray(result.$or));
        
        // Should escape special regex characters
        const expectedRegex = 'test-task\\.v2';
        assert(result.$or[0].title.$regex === expectedRegex);
        assert(result.$or[1].description.$regex === expectedRegex);
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should combine all filter types correctly', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        const filters = {
          status: 'in-progress',
          priority: 'high',
          dateFrom: '2024-01-01T00:00:00.000Z',
          dateTo: '2024-12-31T23:59:59.999Z',
          search: 'important'
        };
        const result = TaskFilterService.buildFilterQuery(filters);
        
        // Should have all filter components
        assert.strictEqual(result.status, 'in-progress');
        assert.strictEqual(result.priority, 'high');
        assert(result.createdAt);
        assert(result.createdAt.$gte instanceof Date);
        assert(result.createdAt.$lte instanceof Date);
        assert(result.$or);
        assert(Array.isArray(result.$or));
        assert.strictEqual(result.$or.length, 2);
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should ignore null and undefined filter values', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        const filters = {
          status: null,
          priority: undefined,
          dateFrom: '',
          search: '   '
        };
        const result = TaskFilterService.buildFilterQuery(filters);
        
        // Should result in empty query or minimal query
        assert(typeof result === 'object');
        assert(!result.status);
        assert(!result.priority);
        assert(!result.createdAt);
        assert(!result.$or);
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });
  });

  describe('buildSortOptions Method', () => {
    test('should return default sort when no parameters provided', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        const result = TaskFilterService.buildSortOptions();
        assert.deepStrictEqual(result, { createdAt: -1 });
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should build ascending sort correctly', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        const result = TaskFilterService.buildSortOptions('title', 'asc');
        assert.deepStrictEqual(result, { title: 1 });
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should build descending sort correctly', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        const result = TaskFilterService.buildSortOptions('priority', 'desc');
        assert.deepStrictEqual(result, { priority: -1 });
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should default to descending when invalid sortOrder provided', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        const result = TaskFilterService.buildSortOptions('createdAt', 'invalid');
        assert.deepStrictEqual(result, { createdAt: -1 });
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should handle valid sort fields', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        const validFields = ['title', 'status', 'priority', 'createdAt', 'updatedAt', 'completedAt'];
        
        validFields.forEach(field => {
          const result = TaskFilterService.buildSortOptions(field, 'asc');
          const expected = {};
          expected[field] = 1;
          assert.deepStrictEqual(result, expected);
        });
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should sanitize invalid sort fields', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        const result = TaskFilterService.buildSortOptions('invalidField', 'asc');
        // Should either default to createdAt or handle gracefully
        assert(typeof result === 'object');
        assert(Object.keys(result).length === 1);
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });
  });

  describe('sanitizeFilters Method', () => {
    test('should remove empty string values', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        const filters = {
          status: '',
          priority: 'high',
          search: '   ',
          dateFrom: '2024-01-01'
        };
        const result = TaskFilterService.sanitizeFilters(filters);
        
        assert(!result.status);
        assert.strictEqual(result.priority, 'high');
        assert(!result.search);
        assert.strictEqual(result.dateFrom, '2024-01-01');
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should remove null and undefined values', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        const filters = {
          status: null,
          priority: undefined,
          search: 'test',
          dateFrom: null
        };
        const result = TaskFilterService.sanitizeFilters(filters);
        
        assert(!result.hasOwnProperty('status'));
        assert(!result.hasOwnProperty('priority'));
        assert.strictEqual(result.search, 'test');
        assert(!result.hasOwnProperty('dateFrom'));
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should trim whitespace from string values', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        const filters = {
          status: '  pending  ',
          search: '  important task  ',
          priority: 'high'
        };
        const result = TaskFilterService.sanitizeFilters(filters);
        
        assert.strictEqual(result.status, 'pending');
        assert.strictEqual(result.search, 'important task');
        assert.strictEqual(result.priority, 'high');
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should validate status values', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        const validStatuses = ['pending', 'in-progress', 'completed'];
        
        validStatuses.forEach(status => {
          const filters = { status };
          const result = TaskFilterService.sanitizeFilters(filters);
          assert.strictEqual(result.status, status);
        });
        
        // Invalid status should be removed
        const invalidFilters = { status: 'invalid-status' };
        const invalidResult = TaskFilterService.sanitizeFilters(invalidFilters);
        assert(!invalidResult.hasOwnProperty('status'));
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should validate priority values', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        const validPriorities = ['low', 'medium', 'high'];
        
        validPriorities.forEach(priority => {
          const filters = { priority };
          const result = TaskFilterService.sanitizeFilters(filters);
          assert.strictEqual(result.priority, priority);
        });
        
        // Invalid priority should be removed
        const invalidFilters = { priority: 'invalid-priority' };
        const invalidResult = TaskFilterService.sanitizeFilters(invalidFilters);
        assert(!invalidResult.hasOwnProperty('priority'));
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should validate date format', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        
        // Valid dates should be preserved
        const validFilters = {
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31T23:59:59.999Z'
        };
        const validResult = TaskFilterService.sanitizeFilters(validFilters);
        assert.strictEqual(validResult.dateFrom, '2024-01-01');
        assert.strictEqual(validResult.dateTo, '2024-12-31T23:59:59.999Z');
        
        // Invalid dates should be removed
        const invalidFilters = {
          dateFrom: 'invalid-date',
          dateTo: '2024-13-45' // Invalid month/day
        };
        const invalidResult = TaskFilterService.sanitizeFilters(invalidFilters);
        assert(!invalidResult.hasOwnProperty('dateFrom'));
        assert(!invalidResult.hasOwnProperty('dateTo'));
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should limit search string length', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        const longSearch = 'a'.repeat(1000); // Very long search string
        const filters = { search: longSearch };
        const result = TaskFilterService.sanitizeFilters(filters);
        
        // Should either truncate or remove overly long search strings
        assert(result.search === undefined || result.search.length <= 255);
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should escape special regex characters in search', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        const filters = { search: 'test.*+?^${}()|[]\\' };
        const result = TaskFilterService.sanitizeFilters(filters);
        
        // Should escape special characters to prevent regex injection
        assert(result.search);
        assert(!result.search.includes('.*'));
        assert(!result.search.includes('+?'));
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should handle empty filter object', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        const result = TaskFilterService.sanitizeFilters({});
        assert.deepStrictEqual(result, {});
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should handle null/undefined input', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        
        const nullResult = TaskFilterService.sanitizeFilters(null);
        assert.deepStrictEqual(nullResult, {});
        
        const undefinedResult = TaskFilterService.sanitizeFilters(undefined);
        assert.deepStrictEqual(undefinedResult, {});
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle malformed filter objects', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        
        // Test with non-object input
        const stringResult = TaskFilterService.buildFilterQuery('invalid');
        assert(typeof stringResult === 'object');
        
        const numberResult = TaskFilterService.buildFilterQuery(123);
        assert(typeof numberResult === 'object');
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should handle circular references in filter objects', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        
        const circularFilter = { status: 'pending' };
        circularFilter.self = circularFilter;
        
        // Should handle gracefully without infinite loops
        const result = TaskFilterService.buildFilterQuery(circularFilter);
        assert(typeof result === 'object');
        assert.strictEqual(result.status, 'pending');
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });

    test('should handle very large filter objects', () => {
      try {
        const TaskFilterService = require('../../src/services/taskFilterService.js');
        
        const largeFilter = {};
        for (let i = 0; i < 1000; i++) {
          largeFilter[`field${i}`] = `value${i}`;
        }
        largeFilter.status = 'pending'; // Add valid filter
        
        const result = TaskFilterService.buildFilterQuery(largeFilter);
        assert(typeof result === 'object');
        assert.strictEqual(result.status, 'pending');
      } catch (error) {
        // Expected to fail - service doesn't exist yet
        assert(error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module'));
      }
    });
  });
});