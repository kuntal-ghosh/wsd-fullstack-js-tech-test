/**
 * @fileoverview Task filtering service for building MongoDB queries and sort options
 * @module services/TaskFilterService
 */

/**
 * Service class for building task filter queries and sort options
 * @class TaskFilterService
 */
class TaskFilterService {
  /**
   * Valid status values for task filtering
   * @static
   * @readonly
   * @type {string[]}
   */
  static VALID_STATUSES = ['pending', 'in-progress', 'completed'];

  /**
   * Valid priority values for task filtering
   * @static
   * @readonly
   * @type {string[]}
   */
  static VALID_PRIORITIES = ['low', 'medium', 'high'];

  /**
   * Valid sort fields for task queries
   * @static
   * @readonly
   * @type {string[]}
   */
  static VALID_SORT_FIELDS = ['title', 'status', 'priority', 'createdAt', 'updatedAt', 'completedAt'];

  /**
   * Maximum length for search strings
   * @static
   * @readonly
   * @type {number}
   */
  static MAX_SEARCH_LENGTH = 255;

  /**
   * Builds a MongoDB filter query object from filter parameters
   * @static
   * @param {Object} filters - Filter parameters object
   * @param {string} [filters.status] - Task status filter
   * @param {string} [filters.priority] - Task priority filter
   * @param {string} [filters.dateFrom] - Start date filter (ISO string)
   * @param {string} [filters.dateTo] - End date filter (ISO string)
   * @param {string} [filters.search] - Text search query
   * @returns {Object} MongoDB query object
   * @example
   * const query = TaskFilterService.buildFilterQuery({
   *   status: 'pending',
   *   priority: 'high',
   *   search: 'urgent task'
   * });
   */
  static buildFilterQuery(filters) {
    // Handle malformed input
    if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
      return {};
    }

    const query = {};

    // Status filter
    if (filters.status && typeof filters.status === 'string') {
      query.status = filters.status;
    }

    // Priority filter
    if (filters.priority && typeof filters.priority === 'string') {
      query.priority = filters.priority;
    }

    // Date range filtering
    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};

      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        if (!isNaN(fromDate.getTime())) {
          query.createdAt.$gte = fromDate;
        }
      }

      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        if (!isNaN(toDate.getTime())) {
          query.createdAt.$lte = toDate;
        }
      }

      // Remove createdAt if no valid dates were added
      if (Object.keys(query.createdAt).length === 0) {
        delete query.createdAt;
      }
    }

    // Text search across title and description
    if (filters.search && typeof filters.search === 'string' && filters.search.trim()) {
      const searchTerm = this.escapeRegexCharacters(filters.search.trim());
      query.$or = [
        { title: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    return query;
  }

  /**
   * Builds MongoDB sort options from sort parameters
   * @static
   * @param {string} [sortBy='createdAt'] - Field to sort by
   * @param {string} [sortOrder='desc'] - Sort order ('asc' or 'desc')
   * @returns {Object} MongoDB sort object
   * @example
   * const sort = TaskFilterService.buildSortOptions('title', 'asc');
   * // Returns: { title: 1 }
   */
  static buildSortOptions(sortBy = 'createdAt', sortOrder = 'desc') {
    const sort = {};

    // Validate and sanitize sort field
    const validSortBy = this.VALID_SORT_FIELDS.includes(sortBy) ? sortBy : 'createdAt';

    // Validate sort order
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    sort[validSortBy] = sortDirection;

    return sort;
  }

  /**
   * Sanitizes and validates filter parameters
   * @static
   * @param {Object} filters - Raw filter parameters
   * @returns {Object} Sanitized filter parameters
   * @example
   * const clean = TaskFilterService.sanitizeFilters({
   *   status: '  pending  ',
   *   priority: null,
   *   search: 'test.*+?'
   * });
   */
  static sanitizeFilters(filters) {
    if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
      return {};
    }

    const sanitized = {};

    // Process each filter property
    Object.keys(filters).forEach(key => {
      const value = filters[key];

      // Skip null, undefined, or empty string values
      if (value === null || value === undefined || value === '') {
        return;
      }

      // Handle string values
      if (typeof value === 'string') {
        const trimmed = value.trim();

        // Skip empty strings after trimming
        if (!trimmed) {
          return;
        }

        // Validate specific fields
        switch (key) {
        case 'status':
          if (this.VALID_STATUSES.includes(trimmed)) {
            sanitized[key] = trimmed;
          }
          break;

        case 'priority':
          if (this.VALID_PRIORITIES.includes(trimmed)) {
            sanitized[key] = trimmed;
          }
          break;

        case 'search': {
          // Limit search string length and escape special characters
          const truncatedSearch = trimmed.length > this.MAX_SEARCH_LENGTH
            ? trimmed.substring(0, this.MAX_SEARCH_LENGTH)
            : trimmed;
          sanitized[key] = this.escapeRegexCharacters(truncatedSearch);
          break;
        }

        case 'dateFrom':
        case 'dateTo': {
          // Validate date format
          const date = new Date(trimmed);
          if (!isNaN(date.getTime())) {
            sanitized[key] = trimmed;
          }
          break;
        }

        default:
          // For other string fields, just trim
          sanitized[key] = trimmed;
          break;
        }
      } else {
        // For non-string values, include as-is (dates, numbers, etc.)
        sanitized[key] = value;
      }
    });

    return sanitized;
  }

  /**
   * Escapes special regex characters in search strings to prevent regex injection
   * @static
   * @private
   * @param {string} str - String to escape
   * @returns {string} Escaped string safe for regex use
   */
  static escapeRegexCharacters(str) {
    // Escape special regex characters
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export default TaskFilterService;
