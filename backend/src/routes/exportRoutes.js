/**
 * @fileoverview Export API routes for task data export functionality
 * @module routes/exportRoutes
 */

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import Export from '../models/Export.js';
import ExportService from '../services/exportService.js';

const 

router = express.Router();

/**
 * POST /api/exports - Create new export request
 * @name CreateExport
 * @function
 * @param {Object} req.body - Export request parameters
 * @param {string} req.body.format - Export format ('csv' or 'json')
 * @param {Object} [req.body.filters] - Filter parameters for the export
 * @returns {Object} Created export with ID and status
 */
router.post('/exports', async (req, res, next) => {
  try {
    const { format, filters = {} } = req.body;

    // Validate required fields
    if (!format) {
      return res.status(400).json({
        success: false,
        message: 'Export format is required',
        errors: { format: 'Format must be specified' }
      });
    }

    // Validate format
    if (!['csv', 'json'].includes(format)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid export format',
        errors: { format: 'Format must be csv or json' }
      });
    }

    // Create export
    const exportDoc = await ExportService.createExport(filters, format);

    // Start processing in background (don't await)
    ExportService.processExport(exportDoc._id.toString()).catch(error => {
      console.error('Export processing failed:', error.message);
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
router.get('/exports/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid export ID format'
      });
    }

    const exportDoc = await Export.findById(id);

    if (!exportDoc) {
      return res.status(404).json({
        success: false,
        message: 'Export not found'
      });
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
router.get('/exports/:id/download', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid export ID format'
      });
    }

    const exportDoc = await Export.findById(id);

    if (!exportDoc) {
      return res.status(404).json({
        success: false,
        message: 'Export not found'
      });
    }

    // Check if export is completed
    if (exportDoc.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Export is not ready for download',
        data: {
          status: exportDoc.status,
          progress: exportDoc.progress
        }
      });
    }

    // Check if export has expired
    if (exportDoc.isExpired()) {
      return res.status(410).json({
        success: false,
        message: 'Export has expired and is no longer available'
      });
    }

    // Check if file exists
    if (!exportDoc.filePath) {
      return res.status(500).json({
        success: false,
        message: 'Export file path not found'
      });
    }

    try {
      await fs.access(exportDoc.filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Export file not found on server'
      });
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
 * GET /api/exports - Get export history with pagination
 * @name GetExportHistory
 * @function
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number
 * @param {number} [req.query.limit=10] - Items per page
 * @param {string} [req.query.status] - Filter by status
 * @returns {Object} Paginated export history
 */
router.get('/exports', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status
    } = req.query;

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));

    // Build query
    const query = {};
    if (status && ['processing', 'completed', 'failed'].includes(status)) {
      query.status = status;
    }

    // Get exports with pagination
    const exports = await Export.find(query)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
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
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
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
router.delete('/exports/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid export ID format'
      });
    }

    const exportDoc = await Export.findById(id);

    if (!exportDoc) {
      return res.status(404).json({
        success: false,
        message: 'Export not found'
      });
    }

    // Delete file if it exists
    if (exportDoc.filePath) {
      try {
        await fs.unlink(exportDoc.filePath);
      } catch (error) {
        console.error('Failed to delete export file:', error.message);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete export record
    await Export.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Export deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;