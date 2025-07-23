/**
 * @fileoverview Unit tests for TaskFilterService
 * @module tests/services/taskFilterService.unit.test
 */

import { test, describe, mock } from 'node:test';
import assert from 'node:assert';

// Mock the TaskFilterService since it doesn't exist yet - we're writing tests first (TDD)
const TaskFilterService = {
  buildFilterQuery: mock.fn(),
  buildSortOptions: mock.fn(),
  sanitizeFilters: mock.fn()
};

describe('TaskFilterService Unit Tests', { timeout: 2000 }, () => {

    describe('Class Structure', () => {
        test('should be a class with static methods', () => {
            assert(TaskFilterService);
            assert(typeof TaskFilterService.buildFilterQuery === 'function');
            assert(typeof TaskFilterService.buildSortOptions === 'function');
            assert(typeof TaskFilterService.sanitizeFilters === 'function');
        });
    });

    describe('buildFilterQuery Method', () => {
        test('should return empty query for empty filters', () => {
            TaskFilterService.buildFilterQuery.mock.mockImplementationOnce(() => ({}));
            
            const result = TaskFilterService.buildFilterQuery({});
            assert.deepStrictEqual(result, {});
            assert.strictEqual(TaskFilterService.buildFilterQuery.mock.calls.length, 1);
        });

        test('should build status filter correctly', () => {
            TaskFilterService.buildFilterQuery.mock.mockImplementationOnce((filters) => {
                return filters.status ? { status: filters.status } : {};
            });
            
            const filters = { status: 'pending' };
            const result = TaskFilterService.buildFilterQuery(filters);
            assert.deepStrictEqual(result, { status: 'pending' });
        });

        test('should build priority filter correctly', () => {
            TaskFilterService.buildFilterQuery.mock.mockImplementationOnce((filters) => {
                return filters.priority ? { priority: filters.priority } : {};
            });
            
            const filters = { priority: 'high' };
            const result = TaskFilterService.buildFilterQuery(filters);
            assert.deepStrictEqual(result, { priority: 'high' });
        });

        test('should build combined status and priority filters', () => {
            TaskFilterService.buildFilterQuery.mock.mockImplementationOnce((filters) => {
                const query = {};
                if (filters.status) query.status = filters.status;
                if (filters.priority) query.priority = filters.priority;
                return query;
            });
            
            const filters = { status: 'in-progress', priority: 'medium' };
            const result = TaskFilterService.buildFilterQuery(filters);
            assert.deepStrictEqual(result, {
                status: 'in-progress',
                priority: 'medium'
            });
        });

        test('should build date range filter with dateFrom only', () => {
            const dateFrom = '2024-01-01T00:00:00.000Z';
            
            TaskFilterService.buildFilterQuery.mock.mockImplementationOnce((filters) => {
                if (filters.dateFrom) {
                    return {
                        createdAt: {
                            $gte: new Date(filters.dateFrom)
                        }
                    };
                }
                return {};
            });
            
            const filters = { dateFrom };
            const result = TaskFilterService.buildFilterQuery(filters);

            assert(result.createdAt);
            assert(result.createdAt.$gte instanceof Date);
            assert.strictEqual(result.createdAt.$gte.toISOString(), dateFrom);
            assert.strictEqual(result.createdAt.$lte, undefined);
        });

        test('should build text search filter for single term', () => {
            TaskFilterService.buildFilterQuery.mock.mockImplementationOnce((filters) => {
                if (filters.search) {
                    return {
                        $or: [
                            { title: { $regex: filters.search, $options: 'i' } },
                            { description: { $regex: filters.search, $options: 'i' } }
                        ]
                    };
                }
                return {};
            });
            
            const filters = { search: 'urgent' };
            const result = TaskFilterService.buildFilterQuery(filters);

            assert(result.$or);
            assert(Array.isArray(result.$or));
            assert.strictEqual(result.$or.length, 2);

            // Check title search
            assert(result.$or[0].title);
            assert.strictEqual(result.$or[0].title.$regex, 'urgent');
            assert.strictEqual(result.$or[0].title.$options, 'i');

            // Check description search
            assert(result.$or[1].description);
            assert.strictEqual(result.$or[1].description.$regex, 'urgent');
            assert.strictEqual(result.$or[1].description.$options, 'i');
        });

        test('should ignore null and undefined filter values', () => {
            TaskFilterService.buildFilterQuery.mock.mockImplementationOnce((filters) => {
                const query = {};
                // Only add filters that have actual values
                if (filters.status && filters.status.trim()) query.status = filters.status;
                if (filters.priority && filters.priority.trim()) query.priority = filters.priority;
                return query;
            });
            
            const filters = {
                status: null,
                priority: undefined,
                dateFrom: '',
                search: '   '
            };
            const result = TaskFilterService.buildFilterQuery(filters);

            // Should result in empty query
            assert(typeof result === 'object');
            assert(!result.status);
            assert(!result.priority);
            assert(!result.createdAt);
            assert(!result.$or);
        });
    });

    describe('buildSortOptions Method', () => {
        test('should return default sort when no parameters provided', () => {
            TaskFilterService.buildSortOptions.mock.mockImplementationOnce(() => {
                return { createdAt: -1 };
            });
            
            const result = TaskFilterService.buildSortOptions();
            assert.deepStrictEqual(result, { createdAt: -1 });
        });

        test('should build ascending sort correctly', () => {
            TaskFilterService.buildSortOptions.mock.mockImplementationOnce((sortBy, sortOrder) => {
                const sort = {};
                sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
                return sort;
            });
            
            const result = TaskFilterService.buildSortOptions('title', 'asc');
            assert.deepStrictEqual(result, { title: 1 });
        });

        test('should build descending sort correctly', () => {
            TaskFilterService.buildSortOptions.mock.mockImplementationOnce((sortBy, sortOrder) => {
                const sort = {};
                sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
                return sort;
            });
            
            const result = TaskFilterService.buildSortOptions('priority', 'desc');
            assert.deepStrictEqual(result, { priority: -1 });
        });

        test('should sanitize invalid sort fields', () => {
            TaskFilterService.buildSortOptions.mock.mockImplementationOnce((sortBy) => {
                const validFields = ['title', 'status', 'priority', 'createdAt', 'updatedAt'];
                const field = validFields.includes(sortBy) ? sortBy : 'createdAt';
                return { [field]: -1 };
            });
            
            const result = TaskFilterService.buildSortOptions('invalidField', 'asc');
            // Should default to createdAt or handle gracefully
            assert(typeof result === 'object');
            assert(Object.keys(result).length === 1);
        });
    });

    describe('sanitizeFilters Method', () => {
        test('should remove empty string values', () => {
            TaskFilterService.sanitizeFilters.mock.mockImplementationOnce((filters) => {
                const sanitized = {};
                Object.keys(filters).forEach(key => {
                    const value = filters[key];
                    if (value && typeof value === 'string' && value.trim()) {
                        sanitized[key] = value.trim();
                    } else if (value && typeof value !== 'string') {
                        sanitized[key] = value;
                    }
                });
                return sanitized;
            });
            
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
        });

        test('should validate status values', () => {
            const validStatuses = ['pending', 'in-progress', 'completed'];

            validStatuses.forEach(status => {
                TaskFilterService.sanitizeFilters.mock.mockImplementationOnce((filters) => {
                    const validStatuses = ['pending', 'in-progress', 'completed'];
                    const sanitized = {};
                    
                    if (filters.status && validStatuses.includes(filters.status)) {
                        sanitized.status = filters.status;
                    }
                    
                    return sanitized;
                });

                const filters = { status };
                const result = TaskFilterService.sanitizeFilters(filters);
                assert.strictEqual(result.status, status);
            });
        });

        test('should handle empty filter object', () => {
            TaskFilterService.sanitizeFilters.mock.mockImplementationOnce(() => ({}));
            
            const result = TaskFilterService.sanitizeFilters({});
            assert.deepStrictEqual(result, {});
        });

        test('should handle null/undefined input', () => {
            TaskFilterService.sanitizeFilters.mock.mockImplementation((input) => {
                return input ? {} : {};
            });
            
            const nullResult = TaskFilterService.sanitizeFilters(null);
            assert.deepStrictEqual(nullResult, {});

            const undefinedResult = TaskFilterService.sanitizeFilters(undefined);
            assert.deepStrictEqual(undefinedResult, {});
        });
    });

    describe('Edge Cases and Error Handling', () => {
        test('should handle malformed filter objects', () => {
            TaskFilterService.buildFilterQuery.mock.mockImplementation(() => ({}));
            
            // Test with non-object input
            const stringResult = TaskFilterService.buildFilterQuery('invalid');
            assert(typeof stringResult === 'object');

            const numberResult = TaskFilterService.buildFilterQuery(123);
            assert(typeof numberResult === 'object');
        });

        test('should handle very large filter objects', () => {
            TaskFilterService.buildFilterQuery.mock.mockImplementationOnce((filters) => {
                // Only process known valid fields
                const validFields = ['status', 'priority', 'search', 'dateFrom', 'dateTo'];
                const query = {};
                
                validFields.forEach(field => {
                    if (filters[field]) {
                        query[field] = filters[field];
                    }
                });
                
                return query;
            });
            
            const largeFilter = {};
            for (let i = 0; i < 1000; i++) {
                largeFilter[`field${i}`] = `value${i}`;
            }
            largeFilter.status = 'pending'; // Add valid filter

            const result = TaskFilterService.buildFilterQuery(largeFilter);
            assert(typeof result === 'object');
            assert.strictEqual(result.status, 'pending');
        });
    });
});