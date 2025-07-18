/**
 * @fileoverview Export service for handling task data exports
 * @module services/ExportService
 */

import fs from 'fs/promises';
import path from 'path';
import Export from '../models/Export.js';
import Task from '../models/Task.js';
import TaskFilterService from './taskFilterService.js';

/**
 * Service class for handling export operations
 * @class ExportService
 */
class ExportService {
  /**
   * Creates a new export request
   * @static
   * @param {Object} filters - Filter parameters for the export
   * @param {string} format - Export format ('csv' or 'json')
   * @returns {Promise<Export>} Created export document
   * @throws {Error} If export creation fails
   */
  static async createExport(filters, format) {
    try {
      // Validate format
      if (!['csv', 'json'].includes(format)) {
        throw new Error(`Unsupported export format: ${format}`);
      }

      // Sanitize filters
      const sanitizedFilters = TaskFilterService.sanitizeFilters(filters);

      // Create export document
      const exportDoc = new Export({
        format,
        filters: sanitizedFilters,
        status: 'processing',
        progress: 0
      });

      await exportDoc.save();
      return exportDoc;
    } catch (error) {
      throw new Error(`Failed to create export: ${error.message}`);
    }
  }

  /**
   * Processes an export by generating the file and updating status
   * @static
   * @param {string} exportId - Export document ID
   * @returns {Promise<Export>} Updated export document
   * @throws {Error} If export processing fails
   */
  static async processExport(exportId) {
    try {
      const exportDoc = await Export.findById(exportId);
      if (!exportDoc) {
        throw new Error('Export not found');
      }

      // Update progress to indicate processing started
      await this.updateProgress(exportId, 10);

      // Build query from filters
      const query = TaskFilterService.buildFilterQuery(exportDoc.filters);
      const sort = TaskFilterService.buildSortOptions(
        exportDoc.filters.sortBy,
        exportDoc.filters.sortOrder
      );

      // Update progress
      await this.updateProgress(exportId, 25);

      // Fetch tasks
      const tasks = await Task.find(query).sort(sort).lean();

      // Update progress
      await this.updateProgress(exportId, 50);

      // Generate export data
      let exportData;
      if (exportDoc.format === 'csv') {
        exportData = await this.generateCSV(tasks);
      } else {
        exportData = await this.generateJSON(tasks);
      }

      // Update progress
      await this.updateProgress(exportId, 75);

      // Save file
      const fileInfo = await this.saveExportFile(exportData, exportDoc.format, exportId);

      // Update progress and mark completed
      await this.markCompleted(exportId, {
        ...fileInfo,
        totalRecords: tasks.length
      });

      return await Export.findById(exportId);
    } catch (error) {
      await this.markFailed(exportId, error.message);
      throw error;
    }
  }

  /**
   * Generates CSV format export data
   * @static
   * @param {Array} tasks - Array of task documents
   * @returns {Promise<string>} CSV formatted string
   */
  static async generateCSV(tasks) {
    try {
      const headers = [
        'ID',
        'Title',
        'Description',
        'Status',
        'Priority',
        'Estimated Time',
        'Actual Time',
        'Created At',
        'Updated At',
        'Completed At'
      ];

      const csvRows = [headers.join(',')];

      for (const task of tasks) {
        const row = [
          task._id.toString(),
          `"${this.escapeCsvField(task.title || '')}"`,
          `"${this.escapeCsvField(task.description || '')}"`,
          task.status || '',
          task.priority || '',
          task.estimatedTime || '',
          task.actualTime || '',
          task.createdAt ? task.createdAt.toISOString() : '',
          task.updatedAt ? task.updatedAt.toISOString() : '',
          task.completedAt ? task.completedAt.toISOString() : ''
        ];
        csvRows.push(row.join(','));
      }

      return csvRows.join('\n');
    } catch (error) {
      throw new Error(`CSV generation failed: ${error.message}`);
    }
  }

  /**
   * Generates JSON format export data
   * @static
   * @param {Array} tasks - Array of task documents
   * @returns {Promise<string>} JSON formatted string
   */
  static async generateJSON(tasks) {
    try {
      // Validate task data
      for (const task of tasks) {
        if (!task._id || !task.title) {
          throw new Error('Corrupted task data detected');
        }
      }

      const exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          totalRecords: tasks.length,
          format: 'json',
          version: '1.0'
        },
        tasks: tasks.map(task => ({
          id: task._id.toString(),
          title: task.title,
          description: task.description || null,
          status: task.status,
          priority: task.priority,
          estimatedTime: task.estimatedTime || null,
          actualTime: task.actualTime || null,
          createdAt: task.createdAt ? task.createdAt.toISOString() : null,
          updatedAt: task.updatedAt ? task.updatedAt.toISOString() : null,
          completedAt: task.completedAt ? task.completedAt.toISOString() : null
        }))
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      throw new Error(`JSON generation failed: ${error.message}`);
    }
  }

  /**
   * Saves export data to file system
   * @static
   * @param {string} data - Export data to save
   * @param {string} format - File format ('csv' or 'json')
   * @param {string} exportId - Export document ID
   * @returns {Promise<Object>} File information object
   */
  static async saveExportFile(data, format, exportId) {
    try {
      const exportDir = process.env.EXPORT_DIR || './test-exports';
      const fileName = `export_${exportId}_${Date.now()}.${format}`;
      const filePath = path.join(exportDir, fileName);

      // Ensure export directory exists
      await fs.mkdir(exportDir, { recursive: true });

      // Write file
      await fs.writeFile(filePath, data, 'utf8');

      // Get file stats
      const stats = await fs.stat(filePath);

      return {
        filePath,
        fileName,
        fileSize: stats.size,
        downloadUrl: `/api/exports/${exportId}/download`
      };
    } catch (error) {
      throw new Error(`File save failed: ${error.message}`);
    }
  }

  /**
   * Cleans up expired export files
   * @static
   * @returns {Promise<Object>} Cleanup result with counts
   */
  static async cleanupExpiredFiles() {
    try {
      const expiredExports = await Export.findExpiredExports();
      let deletedFiles = 0;

      for (const exportDoc of expiredExports) {
        if (exportDoc.filePath) {
          try {
            await fs.unlink(exportDoc.filePath);
            deletedFiles++;
          } catch (error) {
            console.error(`Failed to delete file: ${exportDoc.filePath}`, error);
          }
        }
      }

      // Remove expired export records
      const deleteResult = await Export.cleanupExpired();

      return {
        deletedFiles,
        deletedRecords: deleteResult.deletedCount
      };
    } catch (error) {
      throw new Error(`Cleanup failed: ${error.message}`);
    }
  }

  /**
   * Updates export progress
   * @static
   * @param {string} exportId - Export document ID
   * @param {number} progress - Progress percentage (0-100)
   * @returns {Promise<Export>} Updated export document
   */
  static async updateProgress(exportId, progress) {
    try {
      if (progress < 0 || progress > 100) {
        throw new Error('Progress must be between 0 and 100');
      }

      const exportDoc = await Export.findById(exportId);
      if (!exportDoc) {
        throw new Error('Export not found');
      }

      return await exportDoc.updateProgress(progress);
    } catch (error) {
      throw new Error(`Progress update failed: ${error.message}`);
    }
  }

  /**
   * Marks export as completed
   * @static
   * @param {string} exportId - Export document ID
   * @param {Object} fileInfo - File information object
   * @returns {Promise<Export>} Updated export document
   */
  static async markCompleted(exportId, fileInfo) {
    try {
      const exportDoc = await Export.findById(exportId);
      if (!exportDoc) {
        throw new Error('Export not found');
      }

      return await exportDoc.markCompleted(fileInfo);
    } catch (error) {
      throw new Error(`Mark completed failed: ${error.message}`);
    }
  }

  /**
   * Marks export as failed
   * @static
   * @param {string} exportId - Export document ID
   * @param {string} errorMessage - Error message
   * @returns {Promise<Export>} Updated export document
   */
  static async markFailed(exportId, errorMessage) {
    try {
      const exportDoc = await Export.findById(exportId);
      if (!exportDoc) {
        throw new Error('Export not found');
      }

      return await exportDoc.markFailed(errorMessage);
    } catch (error) {
      console.error(`Failed to mark export as failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets cached export (placeholder for future caching implementation)
   * @static
   * @param {string} cacheKey - Cache key
   * @returns {Promise<null>} Always returns null for now
   */
  static async getCachedExport(cacheKey) {
    // Placeholder for caching implementation in Phase 4
    return null;
  }

  /**
   * Sets cached export (placeholder for future caching implementation)
   * @static
   * @param {string} cacheKey - Cache key
   * @param {Object} exportData - Export data to cache
   * @returns {Promise<void>}
   */
  static async setCachedExport(cacheKey, exportData) {
    // Placeholder for caching implementation in Phase 4
    return;
  }

  /**
   * Invalidates export cache (placeholder for future caching implementation)
   * @static
   * @param {Object} filters - Filter parameters
   * @returns {Promise<void>}
   */
  static async invalidateExportCache(filters) {
    // Placeholder for caching implementation in Phase 4
    return;
  }

  /**
   * Escapes CSV field content to handle quotes and special characters
   * @static
   * @private
   * @param {string} field - Field content to escape
   * @returns {string} Escaped field content
   */
  static escapeCsvField(field) {
    if (typeof field !== 'string') {
      return '';
    }
    
    // Escape quotes by doubling them and replace newlines with spaces
    return field.replace(/"/g, '""').replace(/\n/g, ' ');
  }
}

export default ExportService;