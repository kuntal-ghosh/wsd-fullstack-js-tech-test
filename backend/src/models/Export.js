/**
 * @fileoverview Export model definition with Mongoose schema and methods
 * @module models/Export
 */

import mongoose from 'mongoose';

/**
 * Mongoose schema for Export documents
 * @typedef {Object} ExportSchema
 * @property {string} userId - User identifier for the export (optional)
 * @property {string} format - Export format: 'csv' or 'json' (required)
 * @property {Object} filters - Filter criteria applied to the export
 * @property {number} totalRecords - Number of records in the export
 * @property {number} fileSize - Size of the export file in bytes
 * @property {string} filePath - Server file path for the export
 * @property {string} downloadUrl - Public download URL for the export
 * @property {string} status - Export status: 'processing', 'completed', or 'failed'
 * @property {number} progress - Export progress percentage (0-100)
 * @property {string} error - Error message if export failed
 * @property {Date} expiresAt - Export expiration timestamp
 * @property {Date} createdAt - Export creation timestamp
 * @property {Date} updatedAt - Export last update timestamp
 */
const exportSchema = new mongoose.Schema({
  userId: {
    type: String,
    trim: true
  },
  format: {
    type: String,
    required: true,
    enum: ['csv', 'json']
  },
  filters: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  totalRecords: {
    type: Number,
    min: 0
  },
  fileSize: {
    type: Number,
    min: 0
  },
  filePath: {
    type: String,
    trim: true
  },
  downloadUrl: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing'
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  error: {
    type: String,
    trim: true
  },
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Database indexes for efficient queries
exportSchema.index({ status: 1 });
exportSchema.index({ createdAt: -1 });
exportSchema.index({ expiresAt: 1 });
exportSchema.index({ userId: 1, createdAt: -1 });

/**
 * Pre-save middleware to set expiresAt to 24 hours from now if not provided
 * @param {Function} next - Mongoose next function
 */
exportSchema.pre('save', function (next) {
  if (this.isNew && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
  }
  next();
});

/**
 * Updates the export progress and saves the document
 * @method updateProgress
 * @param {number} progressValue - Progress percentage (0-100)
 * @returns {Promise<Export>} Updated export document
 * @example
 * const exportDoc = await Export.findById(exportId);
 * await exportDoc.updateProgress(75);
 */
exportSchema.methods.updateProgress = async function (progressValue) {
  this.progress = progressValue;
  return await this.save();
};

/**
 * Marks the export as completed with file information
 * @method markCompleted
 * @param {Object} fileInfo - File information object
 * @param {string} fileInfo.filePath - Server file path
 * @param {string} fileInfo.downloadUrl - Public download URL
 * @param {number} fileInfo.fileSize - File size in bytes
 * @param {number} fileInfo.totalRecords - Number of exported records
 * @returns {Promise<Export>} Updated export document
 * @example
 * const exportDoc = await Export.findById(exportId);
 * await exportDoc.markCompleted({
 *   filePath: '/exports/export-123.csv',
 *   downloadUrl: '/api/exports/123/download',
 *   fileSize: 1024,
 *   totalRecords: 100
 * });
 */
exportSchema.methods.markCompleted = async function (fileInfo) {
  this.status = 'completed';
  this.progress = 100;
  this.filePath = fileInfo.filePath;
  this.downloadUrl = fileInfo.downloadUrl;
  this.fileSize = fileInfo.fileSize;
  this.totalRecords = fileInfo.totalRecords;
  return await this.save();
};

/**
 * Marks the export as failed with error message
 * @method markFailed
 * @param {string} errorMessage - Error message describing the failure
 * @returns {Promise<Export>} Updated export document
 * @example
 * const exportDoc = await Export.findById(exportId);
 * await exportDoc.markFailed('Database connection failed');
 */
exportSchema.methods.markFailed = async function (errorMessage) {
  this.status = 'failed';
  this.error = errorMessage;
  return await this.save();
};

/**
 * Checks if the export has expired
 * @method isExpired
 * @returns {boolean} True if export has expired, false otherwise
 * @example
 * const exportDoc = await Export.findById(exportId);
 * if (exportDoc.isExpired()) {
 *   console.log('Export has expired');
 * }
 */
exportSchema.methods.isExpired = function () {
  return this.expiresAt && this.expiresAt < new Date();
};

/**
 * Finds all exports with 'processing' status
 * @static
 * @method findActiveExports
 * @returns {Promise<Export[]>} Array of active export documents
 * @example
 * const activeExports = await Export.findActiveExports();
 */
exportSchema.statics.findActiveExports = function () {
  return this.find({ status: 'processing' });
};

/**
 * Finds all exports that have passed their expiration date
 * @static
 * @method findExpiredExports
 * @returns {Promise<Export[]>} Array of expired export documents
 * @example
 * const expiredExports = await Export.findExpiredExports();
 */
exportSchema.statics.findExpiredExports = function () {
  return this.find({ expiresAt: { $lt: new Date() } });
};

/**
 * Finds exports for a specific user, sorted by creation date (newest first)
 * @static
 * @method findByUserId
 * @param {string} userId - User identifier
 * @returns {Promise<Export[]>} Array of export documents for the user
 * @example
 * const userExports = await Export.findByUserId('user123');
 */
exportSchema.statics.findByUserId = function (userId) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

/**
 * Removes all expired export records from the database
 * @static
 * @method cleanupExpired
 * @returns {Promise<Object>} Deletion result with deletedCount
 * @example
 * const result = await Export.cleanupExpired();
 * console.log(`Deleted ${result.deletedCount} expired exports`);
 */
exportSchema.statics.cleanupExpired = function () {
  return this.deleteMany({ expiresAt: { $lt: new Date() } });
};

/**
 * Export model for managing export documents in MongoDB
 * @type {mongoose.Model}
 */
const Export = mongoose.model('Export', exportSchema);

export default Export;
