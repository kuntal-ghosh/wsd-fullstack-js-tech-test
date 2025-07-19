/**
 * @fileoverview Tests for export validation middleware
 * @module tests/middleware/exportValidation.test
 */

import { test, describe, mock } from 'node:test';
import assert from 'node:assert';
import { validateExportRequest } from '../../src/middleware/validation.js';

describe('Export Validation Middleware Tests', () => {
  describe('Export Format Validation', () => {
    test('should accept valid export format (csv)', () => {
      const req = {
        body: {
          format: 'csv',
          filters: { status: 'pending' }
        }
      };
      
      const res = {};
      const next = mock.fn();
      
      validateExportRequest(req, res, next);
      
      // Should call next without error
      assert.strictEqual(next.mock.calls.length, 1);
      assert.strictEqual(next.mock.calls[0].arguments.length, 0);
    });
    
    test('should accept valid export format (json)', () => {
      const req = {
        body: {
          format: 'json',
          filters: { status: 'pending' }
        }
      };
      
      const res = {};
      const next = mock.fn();
      
      validateExportRequest(req, res, next);
      
      // Should call next without error
      assert.strictEqual(next.mock.calls.length, 1);
      assert.strictEqual(next.mock.calls[0].arguments.length, 0);
    });
    
    test('should reject invalid export format', () => {
      const req = {
        body: {
          format: 'xml', // Invalid format
          filters: { status: 'pending' }
        }
      };
      
      const res = {
        status: mock.fn(() => res),
        json: mock.fn()
      };
      const next = mock.fn();
      
      validateExportRequest(req, res, next);
      
      // Should not call next
      assert.strictEqual(next.mock.calls.length, 0);
      
      // Should return 400 status
      assert.strictEqual(res.status.mock.calls.length, 1);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 400);
      
      // Response should contain details about the error
      const jsonResponse = res.json.mock.calls[0].arguments[0];
      assert.strictEqual(jsonResponse.success, false);
      assert.strictEqual(jsonResponse.message, 'Validation error');
      assert(Array.isArray(jsonResponse.details));
      assert(jsonResponse.details.some(detail => 
        detail.field === 'format' && 
        detail.message.includes('valid')
      ));
    });
    
    test('should require format field', () => {
      const req = {
        body: {
          filters: { status: 'pending' }
          // Missing format
        }
      };
      
      const res = {
        status: mock.fn(() => res),
        json: mock.fn()
      };
      const next = mock.fn();
      
      validateExportRequest(req, res, next);
      
      // Should not call next
      assert.strictEqual(next.mock.calls.length, 0);
      
      // Should return 400 status
      assert.strictEqual(res.status.mock.calls.length, 1);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 400);
      
      // Response should contain details about the error
      const jsonResponse = res.json.mock.calls[0].arguments[0];
      assert.strictEqual(jsonResponse.success, false);
      assert(jsonResponse.details.some(detail => 
        detail.field === 'format' && 
        detail.message.includes('required')
      ));
    });
  });
  
  describe('Filters Validation', () => {
    test('should accept valid status filter', () => {
      const req = {
        body: {
          format: 'csv',
          filters: { 
            status: ['pending', 'in-progress'] 
          }
        }
      };
      
      const res = {};
      const next = mock.fn();
      
      validateExportRequest(req, res, next);
      
      // Should call next without error
      assert.strictEqual(next.mock.calls.length, 1);
      assert.strictEqual(next.mock.calls[0].arguments.length, 0);
    });
    
    test('should accept valid priority filter', () => {
      const req = {
        body: {
          format: 'csv',
          filters: { 
            priority: ['low', 'medium', 'high'] 
          }
        }
      };
      
      const res = {};
      const next = mock.fn();
      
      validateExportRequest(req, res, next);
      
      // Should call next without error
      assert.strictEqual(next.mock.calls.length, 1);
      assert.strictEqual(next.mock.calls[0].arguments.length, 0);
    });
    
    test('should accept valid date range filter', () => {
      const req = {
        body: {
          format: 'csv',
          filters: { 
            dateFrom: '2024-01-01',
            dateTo: '2024-12-31'
          }
        }
      };
      
      const res = {};
      const next = mock.fn();
      
      validateExportRequest(req, res, next);
      
      // Should call next without error
      assert.strictEqual(next.mock.calls.length, 1);
      assert.strictEqual(next.mock.calls[0].arguments.length, 0);
    });
    
    test('should reject invalid status filter value', () => {
      const req = {
        body: {
          format: 'csv',
          filters: { 
            status: ['invalid-status'] 
          }
        }
      };
      
      const res = {
        status: mock.fn(() => res),
        json: mock.fn()
      };
      const next = mock.fn();
      
      validateExportRequest(req, res, next);
      
      // Should not call next
      assert.strictEqual(next.mock.calls.length, 0);
      
      // Should return 400 status
      assert.strictEqual(res.status.mock.calls.length, 1);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 400);
      
      // Response should contain details about the error
      const jsonResponse = res.json.mock.calls[0].arguments[0];
      assert.strictEqual(jsonResponse.success, false);
      assert(jsonResponse.details.some(detail => 
        detail.field.includes('status') && 
        detail.message.includes('valid')
      ));
    });
    
    test('should reject invalid priority filter value', () => {
      const req = {
        body: {
          format: 'csv',
          filters: { 
            priority: ['invalid-priority'] 
          }
        }
      };
      
      const res = {
        status: mock.fn(() => res),
        json: mock.fn()
      };
      const next = mock.fn();
      
      validateExportRequest(req, res, next);
      
      // Should not call next
      assert.strictEqual(next.mock.calls.length, 0);
      
      // Response should contain details about the error
      const jsonResponse = res.json.mock.calls[0].arguments[0];
      assert.strictEqual(jsonResponse.success, false);
      assert(jsonResponse.details.some(detail => 
        detail.field.includes('priority') && 
        detail.message.includes('valid')
      ));
    });
    
    test('should reject invalid date format', () => {
      const req = {
        body: {
          format: 'csv',
          filters: { 
            dateFrom: 'not-a-date',
            dateTo: '2024-12-31'
          }
        }
      };
      
      const res = {
        status: mock.fn(() => res),
        json: mock.fn()
      };
      const next = mock.fn();
      
      validateExportRequest(req, res, next);
      
      // Should not call next
      assert.strictEqual(next.mock.calls.length, 0);
      
      // Response should contain details about the error
      const jsonResponse = res.json.mock.calls[0].arguments[0];
      assert.strictEqual(jsonResponse.success, false);
      assert(jsonResponse.details.some(detail => 
        detail.field.includes('dateFrom') && 
        detail.message.includes('date')
      ));
    });
    
    test('should reject if dateFrom is after dateTo', () => {
      const req = {
        body: {
          format: 'csv',
          filters: { 
            dateFrom: '2024-12-31',
            dateTo: '2024-01-01'  // Before dateFrom
          }
        }
      };
      
      const res = {
        status: mock.fn(() => res),
        json: mock.fn()
      };
      const next = mock.fn();
      
      validateExportRequest(req, res, next);
      
      // Should not call next
      assert.strictEqual(next.mock.calls.length, 0);
      
      // Response should contain details about the error
      const jsonResponse = res.json.mock.calls[0].arguments[0];
      assert.strictEqual(jsonResponse.success, false);
      assert(jsonResponse.details.some(detail => 
        detail.message.includes('must be greater than or equal to')
      ));
    });
    
    test('should limit search string length', () => {
      const longSearch = 'a'.repeat(300); // Longer than the 255 limit
      
      const req = {
        body: {
          format: 'csv',
          filters: { 
            search: longSearch
          }
        }
      };
      
      const res = {
        status: mock.fn(() => res),
        json: mock.fn()
      };
      const next = mock.fn();
      
      validateExportRequest(req, res, next);
      
      // Should not call next
      assert.strictEqual(next.mock.calls.length, 0);
      
      // Response should contain details about the error
      const jsonResponse = res.json.mock.calls[0].arguments[0];
      assert.strictEqual(jsonResponse.success, false);
      assert(jsonResponse.details.some(detail => 
        detail.field.includes('search') && 
        detail.message.includes('length')
      ));
    });
  });

  describe('Estimated Time Filters Validation', () => {
    test('should accept valid estimated time range', () => {
      const req = {
        body: {
          format: 'csv',
          filters: { 
            estimatedTimeMin: 10,
            estimatedTimeMax: 60
          }
        }
      };
      
      const res = {};
      const next = mock.fn();
      
      validateExportRequest(req, res, next);
      
      // Should call next without error
      assert.strictEqual(next.mock.calls.length, 1);
      assert.strictEqual(next.mock.calls[0].arguments.length, 0);
    });
    
    test('should reject negative estimated time', () => {
      const req = {
        body: {
          format: 'csv',
          filters: { 
            estimatedTimeMin: -10,
            estimatedTimeMax: 60
          }
        }
      };
      
      const res = {
        status: mock.fn(() => res),
        json: mock.fn()
      };
      const next = mock.fn();
      
      validateExportRequest(req, res, next);
      
      // Should not call next
      assert.strictEqual(next.mock.calls.length, 0);
      
      // Response should contain details about the error
      const jsonResponse = res.json.mock.calls[0].arguments[0];
      assert.strictEqual(jsonResponse.success, false);
      assert(jsonResponse.details.some(detail => 
        detail.field.includes('estimatedTimeMin') && 
        detail.message.includes('greater than or equal to 0')
      ));
    });
    
    test('should reject if estimatedTimeMin > estimatedTimeMax', () => {
      const req = {
        body: {
          format: 'csv',
          filters: { 
            estimatedTimeMin: 100,
            estimatedTimeMax: 60
          }
        }
      };
      
      const res = {
        status: mock.fn(() => res),
        json: mock.fn()
      };
      const next = mock.fn();
      
      validateExportRequest(req, res, next);
      
      // Should not call next
      assert.strictEqual(next.mock.calls.length, 0);
      
      // Response should contain details about the error
      const jsonResponse = res.json.mock.calls[0].arguments[0];
      assert.strictEqual(jsonResponse.success, false);
      assert(jsonResponse.details.some(detail => 
        detail.field.includes('estimatedTimeMax') && 
        detail.message.includes('greater than or equal to ref:estimatedTimeMin')
      ));
    });
  });
  
  describe('Custom Filename Validation', () => {
    test('should accept valid optional filename', () => {
      const req = {
        body: {
          format: 'csv',
          filters: {},
          filename: 'export-tasks-2024-01'
        }
      };
      
      const res = {};
      const next = mock.fn();
      
      validateExportRequest(req, res, next);
      
      // Should call next without error
      assert.strictEqual(next.mock.calls.length, 1);
      assert.strictEqual(next.mock.calls[0].arguments.length, 0);
    });
    
    test('should allow omitting filename', () => {
      const req = {
        body: {
          format: 'csv',
          filters: {}
          // No filename provided
        }
      };
      
      const res = {};
      const next = mock.fn();
      
      validateExportRequest(req, res, next);
      
      // Should call next without error
      assert.strictEqual(next.mock.calls.length, 1);
      assert.strictEqual(next.mock.calls[0].arguments.length, 0);
    });
    
    test('should reject filename that is too long', () => {
      const longFilename = 'a'.repeat(300); // Longer than 255 character limit
      
      const req = {
        body: {
          format: 'csv',
          filters: {},
          filename: longFilename
        }
      };
      
      const res = {
        status: mock.fn(() => res),
        json: mock.fn()
      };
      const next = mock.fn();
      
      validateExportRequest(req, res, next);
      
      // Should not call next
      assert.strictEqual(next.mock.calls.length, 0);
      
      // Response should contain details about the error
      const jsonResponse = res.json.mock.calls[0].arguments[0];
      assert.strictEqual(jsonResponse.success, false);
      assert(jsonResponse.details.some(detail => 
        detail.field === 'filename' && 
        detail.message.includes('length')
      ));
    });
    
    test('should reject filename with invalid characters', () => {
      const invalidFilenames = [
        'export/file.csv',
        'export\\file.csv',
        'export:file.csv',
        'export?file.csv',
        'export*file.csv'
      ];
      
      for (const invalidFilename of invalidFilenames) {
        const req = {
          body: {
            format: 'csv',
            filters: {},
            filename: invalidFilename
          }
        };
        
        const res = {
          status: mock.fn(() => res),
          json: mock.fn()
        };
        const next = mock.fn();
        
        validateExportRequest(req, res, next);
        
        // Should not call next
        assert.strictEqual(next.mock.calls.length, 0);
        
        // Response should contain details about the error
        const jsonResponse = res.json.mock.calls[0].arguments[0];
        assert.strictEqual(jsonResponse.success, false);
        assert(jsonResponse.details.some(detail => 
          detail.field === 'filename' && 
          detail.message.includes('valid')
        ));
      }
    });
  });
  
  describe('Multiple Validation Errors', () => {
    test('should report all validation errors at once', () => {
      const req = {
        body: {
          format: 'invalid',
          filters: { 
            status: ['invalid-status'],
            dateFrom: 'not-a-date',
            estimatedTimeMin: -10
          },
          filename: 'a'.repeat(300)  // Too long
        }
      };
      
      const res = {
        status: mock.fn(() => res),
        json: mock.fn()
      };
      const next = mock.fn();
      
      validateExportRequest(req, res, next);
      
      // Should not call next
      assert.strictEqual(next.mock.calls.length, 0);
      
      // Response should contain details about all errors
      const jsonResponse = res.json.mock.calls[0].arguments[0];
      assert.strictEqual(jsonResponse.success, false);
      
      // Should have multiple error details
      assert(jsonResponse.details.length > 1);
      
      // Should include format error
      assert(jsonResponse.details.some(detail => 
        detail.field === 'format' && 
        detail.message.includes('valid')
      ));
      
      // Should include status error
      assert(jsonResponse.details.some(detail => 
        detail.field.includes('status') && 
        detail.message.includes('valid')
      ));
      
      // Should include dateFrom error
      assert(jsonResponse.details.some(detail => 
        detail.field.includes('dateFrom') && 
        detail.message.includes('date')
      ));
      
      // Should include filename error
      assert(jsonResponse.details.some(detail => 
        detail.field === 'filename' && 
        detail.message.includes('length')
      ));
      
      // Should include estimatedTimeMin error
      assert(jsonResponse.details.some(detail => 
        detail.field.includes('estimatedTimeMin') && 
        detail.message.includes('greater than or equal to 0')
      ));
    });
  });
  
  describe('Input Sanitization', () => {
    test('should sanitize inputs', () => {
      const req = {
        body: {
          format: 'csv',
          filters: { 
            search: '<script>alert("XSS")</script>',
            status: ['pending']
          }
        }
      };
      
      const res = {};
      const next = mock.fn();
      
      validateExportRequest(req, res, next);
      
      // Should call next without error
      assert.strictEqual(next.mock.calls.length, 1);
      
      // Search should be sanitized
      assert.strictEqual(
        req.body.filters.search.includes('<script>'), 
        false,
        'Script tags should be sanitized'
      );
    });
  });
});