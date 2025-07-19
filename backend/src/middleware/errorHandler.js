/**
 * @fileoverview Error handling middleware for Express
 * @module middleware/errorHandler
 */

/**
 * Custom error class with status code
 * @class AppError
 * @extends Error
 */
class AppError extends Error {
  /**
   * @constructor
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {string} code - Error code for frontend handling
   * @param {any} details - Additional error details
   */
  constructor(message, statusCode, code, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || `ERROR_${statusCode}`;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 404 Not Found middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
const notFound = (req, res, next) => {
  const error = new AppError(`Not Found - ${req.originalUrl}`, 404, 'RESOURCE_NOT_FOUND');
  next(error);
};

/**
 * Global error handling middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  
  // Log error
  console.error('Error:', {
    message: error.message,
    code: error.code || err.code,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Handle specific error types
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    error = new AppError('Validation Error', 400, 'VALIDATION_ERROR', messages);
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    error = new AppError('Invalid ID format', 400, 'INVALID_ID_FORMAT');
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    error = new AppError('Duplicate field value', 409, 'DUPLICATE_VALUE');
  }

  // Export specific errors
  if (err.message && err.message.includes('Export not found')) {
    error = new AppError(err.message, 404, 'EXPORT_NOT_FOUND');
  }
  
  if (err.message && err.message.includes('not ready for download')) {
    error = new AppError(err.message, 409, 'EXPORT_NOT_READY');
  }
  
  if (err.message && err.message.includes('Export has expired')) {
    error = new AppError(err.message, 410, 'EXPORT_EXPIRED');
  }
  
  if (err.message && err.message.includes('file not found')) {
    error = new AppError(err.message, 404, 'EXPORT_FILE_NOT_FOUND');
  }

  // File access errors
  if (err.code === 'ENOENT') {
    error = new AppError('File not found', 404, 'FILE_NOT_FOUND');
  }
  
  if (err.code === 'EACCES') {
    error = new AppError('Permission denied accessing file', 403, 'FILE_ACCESS_DENIED');
  }

  // Construct response
  const statusCode = error.statusCode || err.statusCode || 500;
  const errorResponse = {
    success: false,
    message: error.message || 'Internal Server Error',
    code: error.code || err.code || 'INTERNAL_ERROR'
  };
  
  // Add details if available
  if (error.details || err.details) {
    errorResponse.errors = error.details || err.details;
  }

  // Include stack trace in development mode
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack || err.stack;
  }

  res.status(statusCode).json(errorResponse);
};

// Export handler methods and error class
export {
  errorHandler,
  notFound,
  AppError
};
