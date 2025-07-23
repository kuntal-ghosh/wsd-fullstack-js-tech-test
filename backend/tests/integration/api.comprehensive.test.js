/**
 * @fileoverview Comprehensive integration tests for API endpoints
 * @module tests/integration/api.comprehensive.test
 */

import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Task from '../../src/models/Task.js';
import Export from '../../src/models/Export.js';
import apiRoutes from '../../src/routes/api.js';
import exportRoutes from '../../src/routes/exportRoutes.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';

describe('API Integration Tests', () => {
  let app;
  let mongoServer;
  let testTasks = [];

  before(async () => {
    // Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);
    app.use('/api', exportRoutes);
    app.use(errorHandler);

    // Create test data
    testTasks = await Task.create([
      {
        title: 'High Priority Task',
        description: 'Urgent task that needs attention',
        status: 'pending',
        priority: 'high',
        tags: ['urgent', 'critical']
      },
      {
        title: 'Medium Priority Task',
        description: 'Regular task',
        status: 'in-progress',
        priority: 'medium',
        tags: ['regular']
      },
      {
        title: 'Completed Task',
        description: 'This task is done',
        status: 'completed',
        priority: 'low',
        tags: ['done']
      },
      {
        title: 'Another Pending Task',
        description: 'Another pending task',
        status: 'pending',
        priority: 'medium',
        tags: ['pending']
      }
    ]);
  });

  after(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clean up exports before each test
    await Export.deleteMany({});
  });

  describe('Task CRUD Operations', () => {
    describe('GET /api/tasks', () => {
      it('should get all tasks with default pagination', async () => {
        const response = await request(app)
          .get('/api/tasks')
          .expect(200);

        assert.strictEqual(response.body.success, true);
        assert(Array.isArray(response.body.data.tasks));
        assert.strictEqual(response.body.data.tasks.length, 4);
        assert(response.body.data.pagination);
        assert.strictEqual(response.body.data.pagination.page, 1);
        assert.strictEqual(response.body.data.pagination.total, 4);
      });

      it('should filter tasks by status', async () => {
        const response = await request(app)
          .get('/api/tasks?status=pending')
          .expect(200);

        assert.strictEqual(response.body.success, true);
        assert.strictEqual(response.body.data.tasks.length, 2);
        response.body.data.tasks.forEach(task => {
          assert.strictEqual(task.status, 'pending');
        });
      });

      it('should filter tasks by priority', async () => {
        const response = await request(app)
          .get('/api/tasks?priority=high')
          .expect(200);

        assert.strictEqual(response.body.success, true);
        assert.strictEqual(response.body.data.tasks.length, 1);
        assert.strictEqual(response.body.data.tasks[0].priority, 'high');
      });

      it('should filter tasks by tags', async () => {
        const response = await request(app)
          .get('/api/tasks?tags=urgent')
          .expect(200);

        assert.strictEqual(response.body.success, true);
        assert.strictEqual(response.body.data.tasks.length, 1);
        assert(response.body.data.tasks[0].tags.includes('urgent'));
      });

      it('should handle pagination correctly', async () => {
        const response = await request(app)
          .get('/api/tasks?page=2&limit=2')
          .expect(200);

        assert.strictEqual(response.body.success, true);
        assert.strictEqual(response.body.data.tasks.length, 2);
        assert.strictEqual(response.body.data.pagination.page, 2);
        assert.strictEqual(response.body.data.pagination.limit, 2);
      });

      it('should sort tasks correctly', async () => {
        const response = await request(app)
          .get('/api/tasks?sortBy=priority&sortOrder=desc')
          .expect(200);

        assert.strictEqual(response.body.success, true);
        const priorities = response.body.data.tasks.map(task => task.priority);
        assert.strictEqual(priorities[0], 'high');
      });
    });

    describe('POST /api/tasks', () => {
      it('should create a new task successfully', async () => {
        const newTask = {
          title: 'New Test Task',
          description: 'A task created during testing',
          status: 'pending',
          priority: 'medium',
          tags: ['test']
        };

        const response = await request(app)
          .post('/api/tasks')
          .send(newTask)
          .expect(201);

        assert.strictEqual(response.body.success, true);
        assert.strictEqual(response.body.data.title, newTask.title);
        assert.strictEqual(response.body.data.description, newTask.description);
        assert(response.body.data._id);
      });

      it('should validate required fields', async () => {
        const invalidTask = {
          description: 'Missing title'
        };

        const response = await request(app)
          .post('/api/tasks')
          .send(invalidTask)
          .expect(400);

        assert.strictEqual(response.body.success, false);
        assert(response.body.message.includes('required'));
      });

      it('should validate status enum', async () => {
        const invalidTask = {
          title: 'Invalid Status Task',
          description: 'Task with invalid status',
          status: 'invalid-status'
        };

        const response = await request(app)
          .post('/api/tasks')
          .send(invalidTask)
          .expect(400);

        assert.strictEqual(response.body.success, false);
      });

      it('should validate priority enum', async () => {
        const invalidTask = {
          title: 'Invalid Priority Task',
          description: 'Task with invalid priority',
          priority: 'invalid-priority'
        };

        const response = await request(app)
          .post('/api/tasks')
          .send(invalidTask)
          .expect(400);

        assert.strictEqual(response.body.success, false);
      });
    });

    describe('GET /api/tasks/:id', () => {
      it('should get a specific task by ID', async () => {
        const taskId = testTasks[0]._id;

        const response = await request(app)
          .get(`/api/tasks/${taskId}`)
          .expect(200);

        assert.strictEqual(response.body.success, true);
        assert.strictEqual(response.body.data._id, taskId.toString());
        assert.strictEqual(response.body.data.title, testTasks[0].title);
      });

      it('should return 404 for non-existent task', async () => {
        const nonExistentId = new mongoose.Types.ObjectId();

        const response = await request(app)
          .get(`/api/tasks/${nonExistentId}`)
          .expect(404);

        assert.strictEqual(response.body.success, false);
        assert(response.body.message.includes('not found'));
      });

      it('should return 400 for invalid ObjectId', async () => {
        const response = await request(app)
          .get('/api/tasks/invalid-id')
          .expect(400);

        assert.strictEqual(response.body.success, false);
      });
    });

    describe('PUT /api/tasks/:id', () => {
      it('should update a task successfully', async () => {
        const taskId = testTasks[0]._id;
        const updates = {
          title: 'Updated Task Title',
          status: 'in-progress'
        };

        const response = await request(app)
          .put(`/api/tasks/${taskId}`)
          .send(updates)
          .expect(200);

        assert.strictEqual(response.body.success, true);
        assert.strictEqual(response.body.data.title, updates.title);
        assert.strictEqual(response.body.data.status, updates.status);
      });

      it('should return 404 for non-existent task', async () => {
        const nonExistentId = new mongoose.Types.ObjectId();
        const updates = { title: 'Updated Title' };

        const response = await request(app)
          .put(`/api/tasks/${nonExistentId}`)
          .send(updates)
          .expect(404);

        assert.strictEqual(response.body.success, false);
      });

      it('should validate update data', async () => {
        const taskId = testTasks[0]._id;
        const invalidUpdates = {
          status: 'invalid-status'
        };

        const response = await request(app)
          .put(`/api/tasks/${taskId}`)
          .send(invalidUpdates)
          .expect(400);

        assert.strictEqual(response.body.success, false);
      });
    });

    describe('DELETE /api/tasks/:id', () => {
      it('should delete a task successfully', async () => {
        const taskId = testTasks[0]._id;

        const response = await request(app)
          .delete(`/api/tasks/${taskId}`)
          .expect(200);

        assert.strictEqual(response.body.success, true);
        assert(response.body.message.includes('deleted'));

        // Verify task is actually deleted
        const deletedTask = await Task.findById(taskId);
        assert.strictEqual(deletedTask, null);
      });

      it('should return 404 for non-existent task', async () => {
        const nonExistentId = new mongoose.Types.ObjectId();

        const response = await request(app)
          .delete(`/api/tasks/${nonExistentId}`)
          .expect(404);

        assert.strictEqual(response.body.success, false);
      });
    });
  });

  describe('Analytics Endpoints', () => {
    describe('GET /api/analytics/metrics', () => {
      it('should return analytics metrics', async () => {
        const response = await request(app)
          .get('/api/analytics/metrics')
          .expect(200);

        assert.strictEqual(response.body.success, true);
        assert(response.body.data.totalTasks);
        assert(response.body.data.tasksByStatus);
        assert(response.body.data.tasksByPriority);
        assert(typeof response.body.data.completionRate === 'number');
      });

      it('should calculate metrics correctly', async () => {
        const response = await request(app)
          .get('/api/analytics/metrics')
          .expect(200);

        const metrics = response.body.data;
        
        // Should have correct total (minus any deleted tasks)
        assert(metrics.totalTasks >= 3);
        
        // Should have completion rate
        assert(metrics.completionRate >= 0 && metrics.completionRate <= 100);
        
        // Should have status breakdown
        assert(metrics.tasksByStatus.pending >= 0);
        assert(metrics.tasksByStatus.completed >= 0);
        assert(metrics.tasksByStatus['in-progress'] >= 0);
      });
    });

    describe('GET /api/analytics/charts', () => {
      it('should return chart data', async () => {
        const response = await request(app)
          .get('/api/analytics/charts')
          .expect(200);

        assert.strictEqual(response.body.success, true);
        assert(response.body.data.statusChart);
        assert(response.body.data.priorityChart);
        assert(Array.isArray(response.body.data.statusChart.data));
        assert(Array.isArray(response.body.data.priorityChart.data));
      });
    });
  });

  describe('Export Endpoints', () => {
    describe('POST /api/exports', () => {
      it('should create export request successfully', async () => {
        const exportRequest = {
          format: 'csv',
          filters: { status: 'completed' }
        };

        const response = await request(app)
          .post('/api/exports')
          .send(exportRequest)
          .expect(201);

        assert.strictEqual(response.body.success, true);
        assert.strictEqual(response.body.data.format, 'csv');
        assert.strictEqual(response.body.data.status, 'processing');
        assert(response.body.data.id);
      });

      it('should validate export format', async () => {
        const invalidRequest = {
          format: 'invalid-format',
          filters: {}
        };

        const response = await request(app)
          .post('/api/exports')
          .send(invalidRequest)
          .expect(400);

        assert.strictEqual(response.body.success, false);
      });

      it('should create JSON export', async () => {
        const exportRequest = {
          format: 'json',
          filters: { priority: 'high' }
        };

        const response = await request(app)
          .post('/api/exports')
          .send(exportRequest)
          .expect(201);

        assert.strictEqual(response.body.success, true);
        assert.strictEqual(response.body.data.format, 'json');
      });
    });

    describe('GET /api/exports', () => {
      it('should get export history', async () => {
        // Create a test export first
        await Export.create({
          format: 'csv',
          filters: { status: 'completed' },
          status: 'completed',
          filename: 'test-export.csv'
        });

        const response = await request(app)
          .get('/api/exports')
          .expect(200);

        assert.strictEqual(response.body.success, true);
        assert(Array.isArray(response.body.data.exports));
        assert(response.body.data.pagination);
      });

      it('should filter exports by status', async () => {
        // Create exports with different statuses
        await Export.create([
          {
            format: 'csv',
            filters: {},
            status: 'completed',
            filename: 'completed-export.csv'
          },
          {
            format: 'json',
            filters: {},
            status: 'processing',
            filename: 'processing-export.json'
          }
        ]);

        const response = await request(app)
          .get('/api/exports?status=completed')
          .expect(200);

        assert.strictEqual(response.body.success, true);
        response.body.data.exports.forEach(exportDoc => {
          assert.strictEqual(exportDoc.status, 'completed');
        });
      });

      it('should handle pagination for exports', async () => {
        const response = await request(app)
          .get('/api/exports?page=1&limit=5')
          .expect(200);

        assert.strictEqual(response.body.success, true);
        assert.strictEqual(response.body.data.pagination.page, 1);
        assert.strictEqual(response.body.data.pagination.limit, 5);
      });
    });

    describe('GET /api/exports/:id', () => {
      it('should get export status', async () => {
        const exportDoc = await Export.create({
          format: 'csv',
          filters: { status: 'completed' },
          status: 'processing',
          filename: 'status-test-export.csv'
        });

        const response = await request(app)
          .get(`/api/exports/${exportDoc._id}`)
          .expect(200);

        assert.strictEqual(response.body.success, true);
        assert.strictEqual(response.body.data.id, exportDoc._id.toString());
        assert.strictEqual(response.body.data.format, 'csv');
        assert.strictEqual(response.body.data.status, 'processing');
      });

      it('should return 404 for non-existent export', async () => {
        const nonExistentId = new mongoose.Types.ObjectId();

        const response = await request(app)
          .get(`/api/exports/${nonExistentId}`)
          .expect(404);

        assert.strictEqual(response.body.success, false);
      });
    });

    describe('DELETE /api/exports/:id', () => {
      it('should delete completed export', async () => {
        const exportDoc = await Export.create({
          format: 'csv',
          filters: {},
          status: 'completed',
          filename: 'delete-test-export.csv'
        });

        const response = await request(app)
          .delete(`/api/exports/${exportDoc._id}`)
          .expect(200);

        assert.strictEqual(response.body.success, true);

        // Verify export is deleted
        const deletedExport = await Export.findById(exportDoc._id);
        assert.strictEqual(deletedExport, null);
      });

      it('should prevent deletion of processing export with progress', async () => {
        const exportDoc = await Export.create({
          format: 'csv',
          filters: {},
          status: 'processing',
          progress: 50,
          filename: 'processing-export.csv'
        });

        const response = await request(app)
          .delete(`/api/exports/${exportDoc._id}`)
          .expect(409);

        assert.strictEqual(response.body.success, false);
        assert(response.body.message.includes('processing'));
      });
    });

    describe('POST /api/exports/:id/retry', () => {
      it('should retry failed export', async () => {
        const exportDoc = await Export.create({
          format: 'csv',
          filters: {},
          status: 'failed',
          error: 'Processing failed',
          filename: 'retry-test-export.csv'
        });

        const response = await request(app)
          .post(`/api/exports/${exportDoc._id}/retry`)
          .expect(200);

        assert.strictEqual(response.body.success, true);
        assert.strictEqual(response.body.data.status, 'processing');

        // Verify export was updated
        const updatedExport = await Export.findById(exportDoc._id);
        assert.strictEqual(updatedExport.status, 'processing');
        assert.strictEqual(updatedExport.progress, 0);
        assert.strictEqual(updatedExport.error, null);
      });

      it('should prevent retry of non-failed export', async () => {
        const exportDoc = await Export.create({
          format: 'csv',
          filters: {},
          status: 'completed',
          filename: 'completed-retry-test.csv'
        });

        const response = await request(app)
          .post(`/api/exports/${exportDoc._id}/retry`)
          .expect(400);

        assert.strictEqual(response.body.success, false);
        assert(response.body.message.includes('failed exports'));
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send('{"invalid": json}')
        .set('Content-Type', 'application/json')
        .expect(400);

      assert.strictEqual(response.body.success, false);
    });

    it('should handle undefined routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      // Should return error or be handled by error middleware
    });

    it('should handle database connection errors gracefully', async () => {
      // Temporarily close connection
      await mongoose.disconnect();

      const response = await request(app)
        .get('/api/tasks')
        .expect(500);

      // Reconnect for other tests
      const mongoUri = mongoServer.getUri();
      await mongoose.connect(mongoUri);
    });
  });
});