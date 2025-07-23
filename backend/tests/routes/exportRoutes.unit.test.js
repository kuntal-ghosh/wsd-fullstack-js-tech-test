/**
 * @fileoverview Unit tests for exportRoutes.js
 * @module tests/routes/exportRoutes.unit.test
 */

import { describe, it, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import Export from '../../src/models/Export.js';
import ExportService from '../../src/services/exportService.js';
import exportRoutes, { setSocketHandlers } from '../../src/routes/exportRoutes.js';
import { AppError } from '../../src/middleware/errorHandler.js';

describe('Export Routes Unit Tests', () => {
  let app;
  let mockExportDoc;

  before(async () => {
    app = express();
    app.use(express.json());
    app.use('/api', exportRoutes);
    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message,
        code: err.code
      });
    });

    mockExportDoc = {
      _id: '507f1f77bcf86cd799439011',
      format: 'csv',
      filters: { status: 'completed' },
      status: 'processing',
      progress: 0,
      totalRecords: 0,
      fileSize: 0,
      filePath: null,
      downloadUrl: null,
      error: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isExpired: () => false,
      save: mock.fn()
    };
  });

  beforeEach(() => {
    mock.restoreAll();
  });

  describe('setSocketHandlers', () => {
    it('should set socket handlers correctly', () => {
      const mockHandlers = { broadcast: mock.fn() };
      const mockSetSocketHandlers = mock.method(ExportService, 'setSocketHandlers');
      
      setSocketHandlers(mockHandlers);
      
      assert.strictEqual(mockSetSocketHandlers.mock.callCount(), 1);
      assert.strictEqual(mockSetSocketHandlers.mock.calls[0].arguments[0], mockHandlers);
    });
  });

  describe('POST /api/exports', () => {
    it('should create export successfully', async () => {
      // Setup proper socket handlers mock
      const mockSocketHandlers = {
        broadcastExportListUpdate: mock.fn()
      };
      setSocketHandlers(mockSocketHandlers);
      
      mock.method(ExportService, 'createExport', () => Promise.resolve(mockExportDoc));
      mock.method(ExportService, 'processExport', () => Promise.resolve());

      const response = await request(app)
        .post('/api/exports')
        .send({
          format: 'csv',
          filters: { status: 'completed' }
        });

      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.data.format, 'csv');
    });

    it('should handle export creation error', async () => {
      mock.method(ExportService, 'createExport', () => {
        throw new Error('Unsupported export format: xml');
      });

      const response = await request(app)
        .post('/api/exports')
        .send({
          format: 'xml',
          filters: {}
        });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
    });

    it('should broadcast export list update when socket handlers available', async () => {
      const mockBroadcast = mock.fn();
      const mockHandlers = { broadcastExportListUpdate: mockBroadcast };
      setSocketHandlers(mockHandlers);

      mock.method(ExportService, 'createExport', () => Promise.resolve(mockExportDoc));
      mock.method(ExportService, 'processExport', () => Promise.resolve());

      await request(app)
        .post('/api/exports')
        .send({
          format: 'csv',
          filters: { status: 'completed' }
        });

      assert.strictEqual(mockBroadcast.mock.callCount(), 1);
      assert.strictEqual(mockBroadcast.mock.calls[0].arguments[0], 'created');
    });
  });

  describe('GET /api/exports/:id', () => {
    it('should get export status successfully', async () => {
      mock.method(Export, 'findById', () => Promise.resolve(mockExportDoc));

      const response = await request(app)
        .get('/api/exports/507f1f77bcf86cd799439011');

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.data.id, mockExportDoc._id);
    });

    it('should return 404 for non-existent export', async () => {
      mock.method(Export, 'findById', () => Promise.resolve(null));

      const response = await request(app)
        .get('/api/exports/507f1f77bcf86cd799439011');

      assert.strictEqual(response.status, 404);
      assert.strictEqual(response.body.success, false);
    });
  });

  describe('GET /api/exports/:id/download', () => {
    it('should return error if export not found', async () => {
      mock.method(Export, 'findById', () => Promise.resolve(null));

      const response = await request(app)
        .get('/api/exports/507f1f77bcf86cd799439011/download');

      assert.strictEqual(response.status, 404);
      assert.strictEqual(response.body.success, false);
    });

    it('should return error if export not completed', async () => {
      const processingExport = { ...mockExportDoc, status: 'processing' };
      mock.method(Export, 'findById', () => Promise.resolve(processingExport));

      const response = await request(app)
        .get('/api/exports/507f1f77bcf86cd799439011/download');

      assert.strictEqual(response.status, 409);
      assert.strictEqual(response.body.success, false);
    });

    it('should return error if export expired', async () => {
      const expiredExport = {
        ...mockExportDoc,
        status: 'completed',
        isExpired: () => true
      };
      mock.method(Export, 'findById', () => Promise.resolve(expiredExport));

      const response = await request(app)
        .get('/api/exports/507f1f77bcf86cd799439011/download');

      assert.strictEqual(response.status, 410);
      assert.strictEqual(response.body.success, false);
    });

    it('should return error if file path missing', async () => {
      const completedExport = {
        ...mockExportDoc,
        status: 'completed',
        filePath: null
      };
      mock.method(Export, 'findById', () => Promise.resolve(completedExport));

      const response = await request(app)
        .get('/api/exports/507f1f77bcf86cd799439011/download');

      assert.strictEqual(response.status, 500);
      assert.strictEqual(response.body.success, false);
    });
  });

  describe('GET /api/exports', () => {
    it('should get export history with pagination', async () => {
      const mockExports = [mockExportDoc];
      mock.method(Export, 'find', () => ({
        sort: mock.fn(() => ({
          limit: mock.fn(() => ({
            skip: mock.fn(() => ({
              lean: mock.fn(() => Promise.resolve(mockExports))
            }))
          }))
        }))
      }));
      mock.method(Export, 'countDocuments', () => Promise.resolve(1));

      const response = await request(app)
        .get('/api/exports?page=1&limit=10');

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.data.exports.length, 1);
    });

    it('should filter exports by status', async () => {
      const mockExports = [mockExportDoc];
      mock.method(Export, 'find', (query) => {
        assert.strictEqual(query.status, 'completed');
        return {
          sort: mock.fn(() => ({
            limit: mock.fn(() => ({
              skip: mock.fn(() => ({
                lean: mock.fn(() => Promise.resolve(mockExports))
              }))
            }))
          }))
        };
      });
      mock.method(Export, 'countDocuments', () => Promise.resolve(1));

      const response = await request(app)
        .get('/api/exports?status=completed');

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
    });

    it('should filter exports by date range', async () => {
      const mockExports = [mockExportDoc];
      mock.method(Export, 'find', (query) => {
        assert(query.createdAt);
        assert(query.createdAt.$gte);
        assert(query.createdAt.$lt);
        return {
          sort: mock.fn(() => ({
            limit: mock.fn(() => ({
              skip: mock.fn(() => ({
                lean: mock.fn(() => Promise.resolve(mockExports))
              }))
            }))
          }))
        };
      });
      mock.method(Export, 'countDocuments', () => Promise.resolve(1));

      const response = await request(app)
        .get('/api/exports?dateFrom=2024-01-01&dateTo=2024-12-31');

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
    });
  });

  describe('DELETE /api/exports/:id', () => {
    it('should delete export successfully', async () => {
      const deletableExport = { ...mockExportDoc, status: 'completed' };
      mock.method(Export, 'findById', () => Promise.resolve(deletableExport));
      mock.method(Export, 'findByIdAndDelete', () => Promise.resolve(deletableExport));

      const response = await request(app)
        .delete('/api/exports/507f1f77bcf86cd799439011');

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
    });

    it('should return 404 for non-existent export', async () => {
      mock.method(Export, 'findById', () => Promise.resolve(null));

      const response = await request(app)
        .delete('/api/exports/507f1f77bcf86cd799439011');

      assert.strictEqual(response.status, 404);
      assert.strictEqual(response.body.success, false);
    });

    it('should prevent deletion of processing export with progress', async () => {
      const processingExport = {
        ...mockExportDoc,
        status: 'processing',
        progress: 50
      };
      mock.method(Export, 'findById', () => Promise.resolve(processingExport));

      const response = await request(app)
        .delete('/api/exports/507f1f77bcf86cd799439011');

      assert.strictEqual(response.status, 409);
      assert.strictEqual(response.body.success, false);
    });
  });

  describe('POST /api/exports/:id/retry', () => {
    it('should retry failed export successfully', async () => {
      const failedExport = {
        ...mockExportDoc,
        status: 'failed',
        error: 'Processing failed',
        save: mock.fn(() => Promise.resolve())
      };
      mock.method(Export, 'findById', () => Promise.resolve(failedExport));
      mock.method(ExportService, 'processExport', () => Promise.resolve());

      const response = await request(app)
        .post('/api/exports/507f1f77bcf86cd799439011/retry');

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(failedExport.save.mock.callCount(), 1);
    });

    it('should return 404 for non-existent export', async () => {
      mock.method(Export, 'findById', () => Promise.resolve(null));

      const response = await request(app)
        .post('/api/exports/507f1f77bcf86cd799439011/retry');

      assert.strictEqual(response.status, 404);
      assert.strictEqual(response.body.success, false);
    });

    it('should prevent retry of non-failed export', async () => {
      const completedExport = { ...mockExportDoc, status: 'completed' };
      mock.method(Export, 'findById', () => Promise.resolve(completedExport));

      const response = await request(app)
        .post('/api/exports/507f1f77bcf86cd799439011/retry');

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
    });
  });
});