import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../utils/testDatabase.js';

// Import Export model (will be created in next task)
import Export from '../../src/models/Export.js';

describe('Export Model Unit Tests', () => {
  before(async () => {
    await connectTestDB();
  });

  after(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

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

      assert(paths.filePath);
      assert(paths.filePath.instance === 'String');

      assert(paths.downloadUrl);
      assert(paths.downloadUrl.instance === 'String');

      assert(paths.status);
      assert(paths.status.instance === 'String');

      assert(paths.progress);
      assert(paths.progress.instance === 'Number');

      assert(paths.error);
      assert(paths.error.instance === 'String');

      assert(paths.expiresAt);
      assert(paths.expiresAt.instance === 'Date');
    });

    test('should have correct enum values for format field', () => {
      const schema = Export.schema;
      const formatPath = schema.paths.format;
      
      assert(formatPath.enumValues.includes('csv'));
      assert(formatPath.enumValues.includes('json'));
      assert(formatPath.enumValues.length === 2);
    });

    test('should have correct enum values for status field', () => {
      const schema = Export.schema;
      const statusPath = schema.paths.status;
      
      assert(statusPath.enumValues.includes('processing'));
      assert(statusPath.enumValues.includes('completed'));
      assert(statusPath.enumValues.includes('failed'));
      assert(statusPath.enumValues.length === 3);
    });

    test('should have correct default values', () => {
      const schema = Export.schema;
      const paths = schema.paths;

      assert(paths.status.defaultValue === 'processing');
      assert(paths.progress.defaultValue === 0);
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
    test('should require format field', async () => {
      const exportDoc = new Export({});
      
      try {
        await exportDoc.validate();
        assert.fail('Should have thrown validation error');
      } catch (error) {
        assert(error.errors.format);
        assert(error.errors.format.kind === 'required');
      }
    });

    test('should validate format enum values', async () => {
      const exportDoc = new Export({
        format: 'invalid-format'
      });
      
      try {
        await exportDoc.validate();
        assert.fail('Should have thrown validation error');
      } catch (error) {
        assert(error.errors.format);
        assert(error.errors.format.kind === 'enum');
      }
    });

    test('should validate status enum values', async () => {
      const exportDoc = new Export({
        format: 'csv',
        status: 'invalid-status'
      });
      
      try {
        await exportDoc.validate();
        assert.fail('Should have thrown validation error');
      } catch (error) {
        assert(error.errors.status);
        assert(error.errors.status.kind === 'enum');
      }
    });

    test('should validate progress min value', async () => {
      const exportDoc = new Export({
        format: 'csv',
        progress: -1
      });
      
      try {
        await exportDoc.validate();
        assert.fail('Should have thrown validation error');
      } catch (error) {
        assert(error.errors.progress);
        assert(error.errors.progress.kind === 'min');
      }
    });

    test('should validate progress max value', async () => {
      const exportDoc = new Export({
        format: 'csv',
        progress: 101
      });
      
      try {
        await exportDoc.validate();
        assert.fail('Should have thrown validation error');
      } catch (error) {
        assert(error.errors.progress);
        assert(error.errors.progress.kind === 'max');
      }
    });

    test('should accept valid export document', async () => {
      const exportDoc = new Export({
        format: 'csv',
        filters: {
          status: 'completed',
          priority: 'high'
        },
        status: 'processing',
        progress: 50
      });
      
      await exportDoc.validate(); // Should not throw
    });
  });

  describe('Indexes', () => {
    test('should have indexes defined for efficient queries', () => {
      const indexes = Export.schema.indexes();
      
      // Should have index on status for filtering active exports
      const statusIndex = indexes.find(idx => 
        idx[0].status && Object.keys(idx[0]).length === 1
      );
      assert(statusIndex, 'Should have index on status');

      // Should have index on createdAt for sorting
      const createdAtIndex = indexes.find(idx => 
        idx[0].createdAt && Object.keys(idx[0]).length === 1
      );
      assert(createdAtIndex, 'Should have index on createdAt');

      // Should have index on expiresAt for cleanup operations
      const expiresAtIndex = indexes.find(idx => 
        idx[0].expiresAt && Object.keys(idx[0]).length === 1
      );
      assert(expiresAtIndex, 'Should have index on expiresAt');

      // Should have compound index on userId and createdAt for user history
      const userHistoryIndex = indexes.find(idx => 
        idx[0].userId && idx[0].createdAt && Object.keys(idx[0]).length === 2
      );
      assert(userHistoryIndex, 'Should have compound index on userId and createdAt');
    });
  });

  describe('Pre-save Middleware', () => {
    test('should have pre-save middleware defined', () => {
      const schema = Export.schema;
      assert(schema.pre, 'Schema should have pre hooks');
    });

    test('should set expiresAt to 24 hours from now if not provided', async () => {
      const exportDoc = new Export({
        format: 'csv'
      });

      await exportDoc.save();
      
      const now = new Date();
      const expectedExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const timeDiff = Math.abs(exportDoc.expiresAt.getTime() - expectedExpiry.getTime());
      
      // Allow 1 second tolerance for test execution time
      assert(timeDiff < 1000, 'expiresAt should be set to 24 hours from now');
    });

    test('should not override expiresAt if already provided', async () => {
      const customExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
      const exportDoc = new Export({
        format: 'csv',
        expiresAt: customExpiry
      });

      await exportDoc.save();
      
      assert.strictEqual(
        exportDoc.expiresAt.getTime(), 
        customExpiry.getTime(),
        'Should preserve custom expiresAt value'
      );
    });
  });

  describe('Instance Methods', () => {
    test('should have updateProgress method', () => {
      const exportDoc = new Export({ format: 'csv' });
      assert(typeof exportDoc.updateProgress === 'function');
    });

    test('updateProgress should update progress and save', async () => {
      const exportDoc = new Export({ format: 'csv' });
      await exportDoc.save();

      await exportDoc.updateProgress(75);
      
      assert.strictEqual(exportDoc.progress, 75);
      
      // Verify it was saved to database
      const savedDoc = await Export.findById(exportDoc._id);
      assert.strictEqual(savedDoc.progress, 75);
    });

    test('updateProgress should validate progress range', async () => {
      const exportDoc = new Export({ format: 'csv' });
      await exportDoc.save();

      try {
        await exportDoc.updateProgress(150);
        assert.fail('Should have thrown validation error');
      } catch (error) {
        assert(error.message.includes('validation'));
      }
    });

    test('should have markCompleted method', () => {
      const exportDoc = new Export({ format: 'csv' });
      assert(typeof exportDoc.markCompleted === 'function');
    });

    test('markCompleted should set status to completed and progress to 100', async () => {
      const exportDoc = new Export({ format: 'csv' });
      await exportDoc.save();

      const fileInfo = {
        filePath: '/exports/test.csv',
        downloadUrl: '/api/exports/123/download',
        fileSize: 1024,
        totalRecords: 100
      };

      await exportDoc.markCompleted(fileInfo);
      
      assert.strictEqual(exportDoc.status, 'completed');
      assert.strictEqual(exportDoc.progress, 100);
      assert.strictEqual(exportDoc.filePath, fileInfo.filePath);
      assert.strictEqual(exportDoc.downloadUrl, fileInfo.downloadUrl);
      assert.strictEqual(exportDoc.fileSize, fileInfo.fileSize);
      assert.strictEqual(exportDoc.totalRecords, fileInfo.totalRecords);
    });

    test('should have markFailed method', () => {
      const exportDoc = new Export({ format: 'csv' });
      assert(typeof exportDoc.markFailed === 'function');
    });

    test('markFailed should set status to failed and store error message', async () => {
      const exportDoc = new Export({ format: 'csv' });
      await exportDoc.save();

      const errorMessage = 'Database connection failed';
      await exportDoc.markFailed(errorMessage);
      
      assert.strictEqual(exportDoc.status, 'failed');
      assert.strictEqual(exportDoc.error, errorMessage);
    });

    test('should have isExpired method', () => {
      const exportDoc = new Export({ format: 'csv' });
      assert(typeof exportDoc.isExpired === 'function');
    });

    test('isExpired should return true for expired exports', () => {
      const pastDate = new Date(Date.now() - 1000); // 1 second ago
      const exportDoc = new Export({
        format: 'csv',
        expiresAt: pastDate
      });
      
      assert.strictEqual(exportDoc.isExpired(), true);
    });

    test('isExpired should return false for non-expired exports', () => {
      const futureDate = new Date(Date.now() + 60000); // 1 minute from now
      const exportDoc = new Export({
        format: 'csv',
        expiresAt: futureDate
      });
      
      assert.strictEqual(exportDoc.isExpired(), false);
    });
  });

  describe('Static Methods', () => {
    test('should have findActiveExports static method', () => {
      assert(typeof Export.findActiveExports === 'function');
    });

    test('findActiveExports should return exports with processing status', async () => {
      // Create test exports
      await Export.create([
        { format: 'csv', status: 'processing' },
        { format: 'json', status: 'completed' },
        { format: 'csv', status: 'processing' },
        { format: 'json', status: 'failed' }
      ]);

      const activeExports = await Export.findActiveExports();
      
      assert.strictEqual(activeExports.length, 2);
      activeExports.forEach(exp => {
        assert.strictEqual(exp.status, 'processing');
      });
    });

    test('should have findExpiredExports static method', () => {
      assert(typeof Export.findExpiredExports === 'function');
    });

    test('findExpiredExports should return exports past expiration date', async () => {
      const pastDate = new Date(Date.now() - 1000);
      const futureDate = new Date(Date.now() + 60000);

      // Create test exports
      await Export.create([
        { format: 'csv', expiresAt: pastDate },
        { format: 'json', expiresAt: futureDate },
        { format: 'csv', expiresAt: pastDate }
      ]);

      const expiredExports = await Export.findExpiredExports();
      
      assert.strictEqual(expiredExports.length, 2);
      expiredExports.forEach(exp => {
        assert(exp.expiresAt < new Date());
      });
    });

    test('should have findByUserId static method', () => {
      assert(typeof Export.findByUserId === 'function');
    });

    test('findByUserId should return exports for specific user sorted by creation date', async () => {
      // Create test exports with different userIds
      const exports = await Export.create([
        { format: 'csv', userId: 'user1' },
        { format: 'json', userId: 'user2' },
        { format: 'csv', userId: 'user1' }
      ]);

      const userExports = await Export.findByUserId('user1');
      
      assert.strictEqual(userExports.length, 2);
      userExports.forEach(exp => {
        assert.strictEqual(exp.userId, 'user1');
      });

      // Should be sorted by createdAt descending (newest first)
      if (userExports.length > 1) {
        assert(userExports[0].createdAt >= userExports[1].createdAt);
      }
    });

    test('should have cleanupExpired static method', () => {
      assert(typeof Export.cleanupExpired === 'function');
    });

    test('cleanupExpired should remove expired export records', async () => {
      const pastDate = new Date(Date.now() - 1000);
      const futureDate = new Date(Date.now() + 60000);

      // Create test exports
      await Export.create([
        { format: 'csv', expiresAt: pastDate },
        { format: 'json', expiresAt: futureDate },
        { format: 'csv', expiresAt: pastDate }
      ]);

      const result = await Export.cleanupExpired();
      
      assert.strictEqual(result.deletedCount, 2);
      
      // Verify only non-expired exports remain
      const remainingExports = await Export.find();
      assert.strictEqual(remainingExports.length, 1);
      assert(remainingExports[0].expiresAt > new Date());
    });
  });

  describe('Status Transitions', () => {
    test('should allow valid status transitions', async () => {
      const exportDoc = new Export({ format: 'csv' });
      await exportDoc.save();

      // processing -> completed
      exportDoc.status = 'completed';
      await exportDoc.save(); // Should not throw

      // Reset for next test
      exportDoc.status = 'processing';
      await exportDoc.save();

      // processing -> failed
      exportDoc.status = 'failed';
      await exportDoc.save(); // Should not throw
    });

    test('should track status change history in updatedAt', async () => {
      const exportDoc = new Export({ format: 'csv' });
      await exportDoc.save();
      
      const initialUpdatedAt = exportDoc.updatedAt;
      
      // Small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      exportDoc.status = 'completed';
      await exportDoc.save();
      
      assert(exportDoc.updatedAt > initialUpdatedAt);
    });
  });

  describe('Query Methods', () => {
    beforeEach(async () => {
      // Create test data for query tests
      await Export.create([
        { 
          format: 'csv', 
          status: 'processing',
          filters: { status: 'completed' },
          createdAt: new Date(Date.now() - 3600000) // 1 hour ago
        },
        { 
          format: 'json', 
          status: 'completed',
          filters: { priority: 'high' },
          createdAt: new Date(Date.now() - 1800000) // 30 minutes ago
        },
        { 
          format: 'csv', 
          status: 'failed',
          filters: { status: 'pending' },
          createdAt: new Date() // now
        }
      ]);
    });

    test('should query by status efficiently', async () => {
      const processingExports = await Export.find({ status: 'processing' });
      assert.strictEqual(processingExports.length, 1);
      assert.strictEqual(processingExports[0].format, 'csv');
    });

    test('should query by format efficiently', async () => {
      const csvExports = await Export.find({ format: 'csv' });
      assert.strictEqual(csvExports.length, 2);
    });

    test('should sort by createdAt efficiently', async () => {
      const exports = await Export.find().sort({ createdAt: -1 });
      
      // Should be in descending order (newest first)
      for (let i = 0; i < exports.length - 1; i++) {
        assert(exports[i].createdAt >= exports[i + 1].createdAt);
      }
    });

    test('should support pagination', async () => {
      const page1 = await Export.find().limit(2).skip(0);
      const page2 = await Export.find().limit(2).skip(2);
      
      assert.strictEqual(page1.length, 2);
      assert.strictEqual(page2.length, 1);
      
      // Ensure no overlap
      const page1Ids = page1.map(e => e._id.toString());
      const page2Ids = page2.map(e => e._id.toString());
      const intersection = page1Ids.filter(id => page2Ids.includes(id));
      assert.strictEqual(intersection.length, 0);
    });
  });
});