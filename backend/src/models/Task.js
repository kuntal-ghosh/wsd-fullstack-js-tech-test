/**
 * @fileoverview Task model definition with Mongoose schema and methods
 * @module models/Task
 */

import mongoose from 'mongoose';

/**
 * Mongoose schema for Task documents
 * @typedef {Object} TaskSchema
 * @property {string} title - Task title (required, max 200 chars)
 * @property {string} description - Task description (optional, max 1000 chars)
 * @property {string} status - Task status: 'pending', 'in-progress', or 'completed'
 * @property {string} priority - Task priority: 'low', 'medium', or 'high'
 * @property {Date} createdAt - Task creation timestamp
 * @property {Date} updatedAt - Task last update timestamp
 * @property {Date} completedAt - Task completion timestamp (null if not completed)
 * @property {number} estimatedTime - Estimated completion time in minutes
 * @property {number} actualTime - Actual completion time in minutes
 */
const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed'],
    default: 'pending',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  },
  estimatedTime: {
    type: Number,
    min: 0
  },
  actualTime: {
    type: Number,
    min: 0
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
taskSchema.index({ status: 1, priority: 1 });
taskSchema.index({ createdAt: -1 });

/**
 * Pre-save middleware to automatically set completedAt when status changes to completed
 * and invalidate export caches when task data changes
 * @param {Function} next - Mongoose next function
 */
taskSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    if (this.status === 'completed' && !this.completedAt) {
      this.completedAt = new Date();
    } else if (this.status !== 'completed' && this.completedAt) {
      this.completedAt = null;
    }
  }

  // Invalidate export caches when task data changes
  if (this.isModified()) {
    // Import ExportCacheService dynamically to avoid circular dependencies
    import('../services/exportCacheService.js').then(({ default: ExportCacheService }) => {
      // Invalidate all export caches since task data has changed
      ExportCacheService.invalidateAllExportCaches().catch(error => {
        console.error('Failed to invalidate export caches:', error.message);
      });
    }).catch(error => {
      console.error('Failed to import ExportCacheService:', error.message);
    });
  }

  next();
});

/**
 * Post-remove middleware to invalidate export caches when tasks are deleted
 * @param {Function} next - Mongoose next function
 */
taskSchema.post('remove', function() {
  // Import ExportCacheService dynamically to avoid circular dependencies
  import('../services/exportCacheService.js').then(({ default: ExportCacheService }) => {
    // Invalidate all export caches since task data has changed
    ExportCacheService.invalidateAllExportCaches().catch(error => {
      console.error('Failed to invalidate export caches after task deletion:', error.message);
    });
  }).catch(error => {
    console.error('Failed to import ExportCacheService:', error.message);
  });
});

/**
 * Post-deleteOne middleware to invalidate export caches when tasks are deleted
 * @param {Function} next - Mongoose next function
 */
taskSchema.post('deleteOne', function() {
  // Import ExportCacheService dynamically to avoid circular dependencies
  import('../services/exportCacheService.js').then(({ default: ExportCacheService }) => {
    // Invalidate all export caches since task data has changed
    ExportCacheService.invalidateAllExportCaches().catch(error => {
      console.error('Failed to invalidate export caches after task deletion:', error.message);
    });
  }).catch(error => {
    console.error('Failed to import ExportCacheService:', error.message);
  });
});

/**
 * Post-deleteMany middleware to invalidate export caches when multiple tasks are deleted
 * @param {Function} next - Mongoose next function
 */
taskSchema.post('deleteMany', function() {
  // Import ExportCacheService dynamically to avoid circular dependencies
  import('../services/exportCacheService.js').then(({ default: ExportCacheService }) => {
    // Invalidate all export caches since task data has changed
    ExportCacheService.invalidateAllExportCaches().catch(error => {
      console.error('Failed to invalidate export caches after bulk task deletion:', error.message);
    });
  }).catch(error => {
    console.error('Failed to import ExportCacheService:', error.message);
  });
});

/**
 * Calculates the time taken to complete a task in minutes
 * @method calculateCompletionTime
 * @returns {number|null} Completion time in minutes, or null if not completed
 * @example
 * const task = await Task.findById(taskId);
 * const completionTime = task.calculateCompletionTime(); // returns minutes or null
 */
taskSchema.methods.calculateCompletionTime = function() {
  if (this.completedAt && this.createdAt) {
    return Math.floor((this.completedAt - this.createdAt) / (1000 * 60));
  }
  return null;
};

/**
 * Task model for managing task documents in MongoDB
 * @type {mongoose.Model}
 */
const Task = mongoose.model('Task', taskSchema);

export default Task;
