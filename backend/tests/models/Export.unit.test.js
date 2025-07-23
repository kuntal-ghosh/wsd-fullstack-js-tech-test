import { test, describe } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';

// Import Export model
import Export from '../../src/models/Export.js';

describe('Export Model Unit Tests', { timeout: 5000 }, () => {
  describe('Schema Structure', () => {
    test('should be a mongoose model', () => {
      assert(Export);
      assert(Export.modelName === 'Export');
      assert(Export.schema instanceof mongoose.Schema);
    });

    test('should have correct schema structure with required fields', () => {
      const schema = Export.schema;
      const paths = schema.paths;

      // Check required fields
      assert(paths.format);
      assert(paths.format.isRequired === true);
      assert(paths.format.instance === 'String');

      // Check optional fields
      assert(paths.userId);
      assert(paths.userId.instance === 'String');

      assert(paths.filters);
      assert(paths.filters.instance === 'Mixed');

      assert(paths.totalRecords);
      assert(paths.totalRecords.instance === 'Number');

      assert(paths.fileSize);
      assert(paths.fileSize.instance === 'Number');
    });

    test('should have correct enum values for format field', () => {
      const schema = Export.schema;
      const formatPath = schema.paths.format;
      
      assert(formatPath.enumValues);
      assert(formatPath.enumValues.includes('csv'));
      assert(formatPath.enumValues.includes('json'));
    });

    test('should have correct enum values for status field', () => {
      const schema = Export.schema;
      const statusPath = schema.paths.status;
      
      assert(statusPath.enumValues);
      assert(statusPath.enumValues.includes('processing'));
      assert(statusPath.enumValues.includes('completed'));
      assert(statusPath.enumValues.includes('failed'));
    });

    test('should have correct default values', () => {
      const schema = Export.schema;
      
      assert(schema.paths.status.defaultValue === 'processing');
      assert(schema.paths.progress.defaultValue === 0);
    });

    test('should have progress field with min/max validation', () => {
      const schema = Export.schema;
      const progressPath = schema.paths.progress;
      
      assert(progressPath.options.min === 0);
      assert(progressPath.options.max === 100);
    });

    test('should have timestamps enabled', () => {
      const schema = Export.schema;
      assert(schema.options.timestamps === true);
    });
  });

  describe('Schema Validation', () => {
    test('should require format field', () => {
      const exportDoc = new Export({});
      const validationError = exportDoc.validateSync();
      
      assert(validationError);
      assert(validationError.errors.format);
      assert(validationError.errors.format.kind === 'required');
    });

    test('should validate format enum values', () => {
      const exportDoc = new Export({
        format: 'invalid-format'
      });
      const validationError = exportDoc.validateSync();
      
      assert(validationError);
      assert(validationError.errors.format);
      assert(validationError.errors.format.kind === 'enum');
    });

    test('should validate status enum values', () => {
      const exportDoc = new Export({
        format: 'csv',
        status: 'invalid-status'
      });
      const validationError = exportDoc.validateSync();
      
      assert(validationError);
      assert(validationError.errors.status);
      assert(validationError.errors.status.kind === 'enum');
    });

    test('should validate progress min value', () => {
      const exportDoc = new Export({
        format: 'csv',
        progress: -1
      });
      const validationError = exportDoc.validateSync();
      
      assert(validationError);
      assert(validationError.errors.progress);
      assert(validationError.errors.progress.kind === 'min');
    });

    test('should validate progress max value', () => {
      const exportDoc = new Export({
        format: 'csv',
        progress: 101
      });
      const validationError = exportDoc.validateSync();
      
      assert(validationError);
      assert(validationError.errors.progress);
      assert(validationError.errors.progress.kind === 'max');
    });

    test('should accept valid export document', () => {
      const exportDoc = new Export({
        format: 'csv',
        filters: {
          status: 'completed',
          priority: 'high'
        },
        status: 'completed',
        progress: 50
      });
      
      const validationError = exportDoc.validateSync();
      assert(!validationError); // Should not have validation errors
    });
  });

  describe('Indexes', () => {
    test('should have indexes defined for efficient queries', () => {
      const indexes = Export.schema.indexes();
      
      // Should have some indexes defined
      assert(Array.isArray(indexes));
      assert(indexes.length > 0);
      
      // Check for common indexes that should exist
      const hasStatusIndex = indexes.some(idx => 
        idx[0].status && Object.keys(idx[0]).length === 1
      );
      assert(hasStatusIndex, 'Should have index on status');
    });
  });

  describe('Static Methods', () => {
    test('should have static method structure', () => {
      // Test that static methods exist
      assert(typeof Export.findActiveExports === 'function');
      assert(typeof Export.findExpiredExports === 'function');
      assert(typeof Export.findByUserId === 'function');
      assert(typeof Export.cleanupExpired === 'function');
    });
  });

  describe('Instance Methods', () => {
    test('should have instance method structure', () => {
      const exportDoc = new Export({ format: 'csv' });
      
      // Test that instance methods exist
      assert(typeof exportDoc.isExpired === 'function');
      assert(typeof exportDoc.updateProgress === 'function');
      assert(typeof exportDoc.markCompleted === 'function');
      assert(typeof exportDoc.markFailed === 'function');
    });
  });
});