/**
 * @fileoverview Validation middleware for API requests
 * @module middleware/validation
 */

import Joi from 'joi';

/**
 * Sanitizes input by removing potentially dangerous characters
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized input
 */
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
};

/**
 * Sanitizes export filter parameters
 * @param {Object} filters - Filter object to sanitize
 * @returns {Object} Sanitized filter object
 */
const sanitizeFilters = (filters) => {
  if (!filters || typeof filters !== 'object') {
    return {};
  }

  const sanitized = {};
  
  // Sanitize text fields
  if (filters.search) {
    sanitized.search = sanitizeInput(filters.search);
  }
  
  // Handle status arrays or single values
  if (filters.status) {
    if (Array.isArray(filters.status)) {
      sanitized.status = filters.status.map(s => sanitizeInput(s));
    } else {
      sanitized.status = sanitizeInput(filters.status);
    }
  }
  
  // Handle priority arrays or single values
  if (filters.priority) {
    if (Array.isArray(filters.priority)) {
      sanitized.priority = filters.priority.map(p => sanitizeInput(p));
    } else {
      sanitized.priority = sanitizeInput(filters.priority);
    }
  }
  
  // Copy other safe fields
  const safeFields = ['dateFrom', 'dateTo', 'estimatedTimeMin', 'estimatedTimeMax'];
  safeFields.forEach(field => {
    if (filters[field] !== undefined) {
      sanitized[field] = filters[field];
    }
  });
  
  return sanitized;
};

/**
 * Validates export request parameters
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {void}
 */
export const validateExportRequest = (req, res, next) => {
  // Define status and priority arrays for validation
  const validStatuses = ['pending', 'in-progress', 'completed'];
  const validPriorities = ['low', 'medium', 'high'];

  // Custom validation for status values
  const validateStatus = (value, helpers) => {
    // Handle array or single value
    const statuses = Array.isArray(value) ? value : [value];
    
    for (const status of statuses) {
      if (!validStatuses.includes(status)) {
        return helpers.error('any.invalid', { value: status });
      }
    }
    return value;
  };

  // Custom validation for priority values
  const validatePriority = (value, helpers) => {
    // Handle array or single value
    const priorities = Array.isArray(value) ? value : [value];
    
    for (const priority of priorities) {
      if (!validPriorities.includes(priority)) {
        return helpers.error('any.invalid', { value: priority });
      }
    }
    return value;
  };

  // Define validation schema for export request
const schema = Joi.object({
    format: Joi.string().valid('csv', 'json').required()
        .messages({
            'any.required': 'format is required',
            'any.only': 'format must be a valid format (csv or json)'
        }),
    filters: Joi.object({
        status: Joi.alternatives().try(
            Joi.string().custom(validateStatus),
            Joi.array().items(Joi.string()).custom(validateStatus)
        ).messages({
            'any.invalid': 'status must be a valid status value'
        }),
        priority: Joi.alternatives().try(
            Joi.string().custom(validatePriority),
            Joi.array().items(Joi.string()).custom(validatePriority)
        ).messages({
            'any.invalid': 'priority must be a valid priority value'
        }),
        dateFrom: Joi.alternatives()
            .try(
                Joi.string().allow(''),
                Joi.date().iso()
            )
            .messages({
                'date.base': 'dateFrom must be a valid date',
                'date.format': 'dateFrom must be a valid ISO date'
            }),
        dateTo: Joi.alternatives()
            .try(
                Joi.string().allow(''),
                Joi.date().iso().min(Joi.ref('dateFrom'))
            )
            .messages({
                'date.base': 'dateTo must be a valid date',
                'date.format': 'dateTo must be a valid ISO date',
                'date.min': 'dateTo must be greater than or equal to dateFrom'
            }),
        search: Joi.string().max(255).messages({
            'string.max': 'search must be less than or equal to 255 characters in length'
        }),
        estimatedTimeMin: Joi.number().min(0).messages({
            'number.base': 'estimatedTimeMin must be a number',
            'number.min': 'estimatedTimeMin must be greater than or equal to 0'
        }),
        estimatedTimeMax: Joi.number().min(Joi.ref('estimatedTimeMin')).messages({
            'number.base': 'estimatedTimeMax must be a number',
            'number.min': 'estimatedTimeMax must be greater than or equal to ref:estimatedTimeMin'
        })
    }).default({}),
    filename: Joi.string().max(255).pattern(/^[a-zA-Z0-9_\-. ]+$/).allow(null, '').messages({
        'string.max': 'filename must be less than or equal to 255 characters in length',
        'string.pattern.base': 'filename contains invalid characters'
    }),
    userId: Joi.string().max(100).allow(null, '').messages({
        'string.max': 'userId must be less than or equal to 100 characters in length'
    })
});

  // Apply sanitization to the filters
  if (req.body && req.body.filters) {
    req.body.filters = sanitizeFilters(req.body.filters);
  }

  // Validate request body against schema
  const { error, value } = schema.validate(req.body, { 
    abortEarly: false,
    stripUnknown: true
  });
  
  // Handle validation errors
  if (error) {
    // Format error details for the response
    const details = error.details.map(detail => {
      // Adjust field path if needed
      let field = detail.path.join('.');
      
      // Special handling for array items in status or priority
      if (field.match(/filters\.status\.\d+/) || field === 'filters.status') {
        field = 'filters.status';
      }
      if (field.match(/filters\.priority\.\d+/) || field === 'filters.priority') {
        field = 'filters.priority';
      }
      
      return {
        field,
        message: detail.message
      };
    });
    
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      details
    });
  }

  // Update req.body with validated and sanitized values
  req.body = value;
  next();
};

/**
 * Validates export ID parameter
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {void}
 */
export const validateExportId = (req, res, next) => {
  const { id } = req.params;
  
  // Validate ID format (MongoDB ObjectId is 24 hex characters)
  if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid export ID format',
      details: [{
        field: 'id',
        message: 'ID must be a valid 24-character hexadecimal string'
      }]
    });
  }
  
  next();
};

/**
 * Validates pagination parameters
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {void}
 */
export const validatePagination = (req, res, next) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
      'number.base': 'page must be a number',
      'number.min': 'page must be greater than or equal to 1'
    }),
    limit: Joi.number().integer().min(1).max(100).default(10).messages({
      'number.base': 'limit must be a number',
      'number.min': 'limit must be greater than or equal to 1',
      'number.max': 'limit must be less than or equal to 100'
    }),
    sortBy: Joi.string().valid('createdAt', 'status', 'format', 'fileSize', 'totalRecords').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
    // Filter parameters
    status: Joi.string().valid('processing', 'completed', 'failed').messages({
      'any.only': 'status must be processing, completed, or failed'
    }),
    format: Joi.string().valid('csv', 'json').messages({
      'any.only': 'format must be csv or json'
    }),
    dateFrom: Joi.string().isoDate().messages({
      'string.isoDate': 'dateFrom must be a valid ISO date (YYYY-MM-DD)'
    }),
    dateTo: Joi.string().isoDate().messages({
      'string.isoDate': 'dateTo must be a valid ISO date (YYYY-MM-DD)'
    })
  });

  const { error, value } = schema.validate(req.query, { 
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Invalid pagination parameters',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  
  req.pagination = value;
  next();
};

export {
  sanitizeInput,
  sanitizeFilters
};