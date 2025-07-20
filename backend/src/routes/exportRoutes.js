/**
 * @fileoverview Export API routes for task data export functionality
 * @module routes/exportRoutes
 */

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import Export from '../models/Export.js';
import ExportService from '../services/exportService.js';
import { validateExportRequest, validateExportId, validatePagination } from '../middleware/validation.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * Socket handlers reference for real-time updates
 * @type {Object|null}
 */
let socketHandlers = null;

/**
 * Sets socket handlers for broadcasting real-time updates
 * @param {Object} handlers - Socket handler object with broadcast methods
 */
export const setSocketHandlers = (handlers) => {
  socketHandlers = handlers;
  ExportService.setSocketHandlers(handlers);
  console.log('🔧 Export routes: Socket handlers set', !!handlers);
};

/**
 * POST /api/exports - Create new export request
 * @name CreateExport
 * @function
 * @param {Object} req.body - Export request parameters
 * @param {string} req.body.format - Export format ('csv' or 'json')
 * @param {Object} [req.body.filters] - Filter parameters for the export
 * @returns {Object} Created export with ID and status
 */
router.post('/exports', validateExportRequest, async (req, res, next) => {
  try {
    const { format, filters = {}, filename } = req.body;

    // Create export
    const exportDoc = await ExportService.createExport(filters, format, filename);

    // Broadcast export list update
    console.log('🔧 Export created, socketHandlers available:', !!socketHandlers);
    if (socketHandlers) {
      console.log('🔧 Broadcasting export list update for:', exportDoc._id);
      await socketHandlers.broadcastExportListUpdate('created', exportDoc);
      console.log('🔧 Export list update broadcast completed');
    } else {
      console.log('❌ No socket handlers available for export broadcast');
    }

    // Start processing in background (don't await)
    ExportService.processExport(exportDoc._id.toString())
      .catch(error => {
        console.error('Export processing failed:', error.message, {
          exportId: exportDoc._id.toString(),
          filters,
          format,
          timestamp: new Date().toISOString()
        });
      });

    res.status(201).json({
      success: true,
      data: {
        id: exportDoc._id,
        format: exportDoc.format,
        filters: exportDoc.filters,
        status: exportDoc.status,
        progress: exportDoc.progress,
        createdAt: exportDoc.createdAt
      },
      message: 'Export created successfully'
    });
  } catch (error) {
    // Add structured error code for better client-side handling
    if (error.message.includes('Unsupported export format')) {
      error.code = 'INVALID_EXPORT_FORMAT';
      error.statusCode = 400;
    }

    next(error);
  }
});

/**
 * GET /api/exports/:id - Get export status and progress
 * @name GetExportStatus
 * @function
 * @param {string} req.params.id - Export ID
 * @returns {Object} Export status, progress, and metadata
 */
router.get('/exports/:id', validateExportId, async (req, res, next) => {
  try {
    const { id } = req.params;
    const exportDoc = await Export.findById(id);

    if (!exportDoc) {
      throw new AppError('Export not found', 404, 'EXPORT_NOT_FOUND', { exportId: id });
    }

    res.json({
      success: true,
      data: {
        id: exportDoc._id,
        format: exportDoc.format,
        filters: exportDoc.filters,
        status: exportDoc.status,
        progress: exportDoc.progress,
        totalRecords: exportDoc.totalRecords,
        fileSize: exportDoc.fileSize,
        filePath: exportDoc.filePath,
        downloadUrl: exportDoc.downloadUrl,
        error: exportDoc.error,
        createdAt: exportDoc.createdAt,
        updatedAt: exportDoc.updatedAt,
        expiresAt: exportDoc.expiresAt,
        isExpired: exportDoc.isExpired()
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/exports/:id/download - Download export file
 * @name DownloadExport
 * @function
 * @param {string} req.params.id - Export ID
 * @returns {File} Export file stream or error response
 */
router.get('/exports/:id/download', validateExportId, async (req, res, next) => {
  try {
    const { id } = req.params;
    const exportDoc = await Export.findById(id);

    if (!exportDoc) {
      throw new AppError('Export not found', 404, 'EXPORT_NOT_FOUND', { exportId: id });
    }

    // Check if export is completed
    if (exportDoc.status !== 'completed') {
      throw new AppError(
        `Export is not ready for download. Current status: ${exportDoc.status}`,
        409,
        'EXPORT_NOT_READY',
        {
          status: exportDoc.status,
          progress: exportDoc.progress
        }
      );
    }

    // Check if export has expired
    if (exportDoc.isExpired()) {
      throw new AppError(
        'Export has expired and is no longer available',
        410,
        'EXPORT_EXPIRED',
        {
          exportId: id,
          expiresAt: exportDoc.expiresAt
        }
      );
    }

    // Check if file exists
    if (!exportDoc.filePath) {
      throw new AppError(
        'Export file path not found',
        500,
        'EXPORT_FILE_MISSING',
        { exportId: id }
      );
    }

    try {
      await fs.access(exportDoc.filePath);
    } catch {
      throw new AppError(
        'Export file not found on server',
        404,
        'EXPORT_FILE_NOT_FOUND',
        { exportId: id, path: exportDoc.filePath }
      );
    }

    // Set appropriate headers
    const fileName = path.basename(exportDoc.filePath);
    const contentType = exportDoc.format === 'csv'
      ? 'text/csv'
      : 'application/json';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // Stream file to client
    const fileContent = await fs.readFile(exportDoc.filePath, 'utf8');
    res.send(fileContent);

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/exports - Get export history with pagination and filtering
 * @name GetExportHistory
 * @function
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number
 * @param {number} [req.query.limit=10] - Items per page
 * @param {string} [req.query.sortBy='createdAt'] - Field to sort by
 * @param {string} [req.query.sortOrder='desc'] - Sort order ('asc' or 'desc')
 * @param {string} [req.query.status] - Filter by status ('processing', 'completed', 'failed')
 * @param {string} [req.query.format] - Filter by format ('csv', 'json')
 * @param {string} [req.query.dateFrom] - Filter exports from this date (YYYY-MM-DD)
 * @param {string} [req.query.dateTo] - Filter exports until this date (YYYY-MM-DD)
 * @returns {Object} Paginated export history
 */
router.get('/exports', validatePagination, async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      format,
      dateFrom,
      dateTo
    } = req.pagination || req.query;

    // Build query
    const query = {};

    // Status filter
    if (status && ['processing', 'completed', 'failed'].includes(status)) {
      query.status = status;
    }

    // Format filter
    if (format && ['csv', 'json'].includes(format)) {
      query.format = format;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        // Add one day to include the entire dateTo day
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        query.createdAt.$lt = endDate;
      }
    }

    // Get exports with pagination
    const exports = await Export.find(query)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    // Get total count
    const total = await Export.countDocuments(query);

    // Format response data
    const formattedExports = exports.map(exportDoc => ({
      id: exportDoc._id,
      format: exportDoc.format,
      filters: exportDoc.filters,
      status: exportDoc.status,
      progress: exportDoc.progress,
      totalRecords: exportDoc.totalRecords,
      fileSize: exportDoc.fileSize,
      downloadUrl: exportDoc.downloadUrl,
      error: exportDoc.error,
      createdAt: exportDoc.createdAt,
      updatedAt: exportDoc.updatedAt,
      expiresAt: exportDoc.expiresAt,
      isExpired: exportDoc.expiresAt && exportDoc.expiresAt < new Date()
    }));

    res.json({
      success: true,
      data: {
        exports: formattedExports,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/exports/:id - Cancel or delete export
 * @name DeleteExport
 * @function
 * @param {string} req.params.id - Export ID
 * @returns {Object} Success message
 */
router.delete('/exports/:id', validateExportId, async (req, res, next) => {
  try {
    const { id } = req.params;
    const exportDoc = await Export.findById(id);

    if (!exportDoc) {
      throw new AppError('Export not found', 404, 'EXPORT_NOT_FOUND', { exportId: id });
    }

    // Check if export is in progress and block deletion
    if (exportDoc.status === 'processing' && exportDoc.progress > 0) {
      throw new AppError(
        'Cannot delete export that is currently processing',
        409,
        'EXPORT_IN_PROGRESS',
        { status: exportDoc.status, progress: exportDoc.progress }
      );
    }

    // Delete file if it exists
    if (exportDoc.filePath) {
      try {
        await fs.unlink(exportDoc.filePath);
      } catch (error) {
        console.error('Failed to delete export file:', error.message, {
          exportId: id,
          filePath: exportDoc.filePath
        });
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete export record
    await Export.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Export deleted successfully',
      data: {
        id: exportDoc._id,
        deletedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/exports/:id/retry - Retry failed export
 * @name RetryExport
 * @function
 * @param {string} req.params.id - Export ID
 * @returns {Object} Updated export with new status
 */
router.post('/exports/:id/retry', validateExportId, async (req, res, next) => {
  try {
    const { id } = req.params;
    const exportDoc = await Export.findById(id);

    if (!exportDoc) {
      throw new AppError('Export not found', 404, 'EXPORT_NOT_FOUND', { exportId: id });
    }

    // Check if export is failed (only failed exports can be retried)
    if (exportDoc.status !== 'failed') {
      throw new AppError(
        `Only failed exports can be retried. Current status: ${exportDoc.status}`,
        400,
        'INVALID_EXPORT_STATUS',
        { status: exportDoc.status }
      );
    }

    // Reset export for retry
    exportDoc.status = 'processing';
    exportDoc.progress = 0;
    exportDoc.error = null;
    await exportDoc.save();

    // Start processing in background (don't await)
    ExportService.processExport(exportDoc._id.toString())
      .catch(error => {
        console.error('Export retry processing failed:', error.message, {
          exportId: exportDoc._id.toString(),
          timestamp: new Date().toISOString()
        });
      });

    res.json({
      success: true,
      data: {
        id: exportDoc._id,
        format: exportDoc.format,
        filters: exportDoc.filters,
        status: exportDoc.status,
        progress: exportDoc.progress,
        createdAt: exportDoc.createdAt,
        updatedAt: exportDoc.updatedAt
      },
      message: 'Export retry initiated successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
