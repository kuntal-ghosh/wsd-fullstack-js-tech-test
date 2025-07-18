/**
 * @fileoverview Export caching service for Redis-based cache management
 * @module services/ExportCacheService
 */

import crypto from 'crypto';
import { redisClient } from '../config/redis.js';

/**
 * Service class for handling export caching operations
 * @class ExportCacheService
 */
class ExportCacheService {
  /**
   * Default cache TTL in seconds (1 hour)
   * @static
   * @type {number}
   */
  static DEFAULT_TTL = 3600;

  /**
   * Maximum cache data size in bytes (10MB)
   * @static
   * @type {number}
   */
  static MAX_CACHE_SIZE = 10485760;

  /**
   * Circuit breaker configuration
   * @static
   * @type {Object}
   */
  static circuitBreaker = {
    failureCount: 0,
    maxFailures: 3,
    isOpen: false,
    lastFailureTime: null,
    resetTimeout: 60000 // 1 minute
  };

  /**
   * Generates a consistent cache key based on filter parameters and format
   * @static
   * @param {Object} filters - Filter parameters
   * @param {string} format - Export format ('csv' or 'json')
   * @returns {string} Generated cache key
   */
  static generateCacheKey(filters, format) {
    try {
      // Sort filter keys to ensure consistency
      const sortedFilters = Object.keys(filters || {})
        .sort()
        .reduce((sorted, key) => {
          sorted[key] = filters[key];
          return sorted;
        }, {});

      // Create a deterministic string representation
      const filterString = JSON.stringify(sortedFilters);

      // Generate hash for the filter string
      const hash = crypto
        .createHash('sha256')
        .update(filterString)
        .digest('base64')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 16);

      return `export:${format}:${hash}`;
    } catch (error) {
      console.error('Cache key generation error:', error.message);
      // Fallback to timestamp-based key
      return `export:${format}:${Date.now()}`;
    }
  }

  /**
   * Retrieves cached export data
   * @static
   * @param {string} cacheKey - Cache key to retrieve
   * @returns {Promise<Object|null>} Cached export data or null if not found
   */
  static async getCachedExport(cacheKey) {
    try {
      // Check circuit breaker
      if (this.isCircuitBreakerOpen()) {
        console.log('Circuit breaker open, skipping cache lookup');
        return null;
      }

      // Check if cache is available
      const isAvailable = await this.isCacheAvailable();
      if (!isAvailable) {
        console.log('Cache unavailable, skipping cache lookup');
        return null;
      }

      const cachedData = await redisClient.get(cacheKey);

      if (!cachedData) {
        return null;
      }

      // Parse cached data
      const parsedData = JSON.parse(cachedData);

      // Extend TTL for frequently accessed items
      await redisClient.expire(cacheKey, this.DEFAULT_TTL);

      // Reset circuit breaker on success
      this.resetCircuitBreaker();

      return parsedData;
    } catch (error) {
      console.error('Cache retrieval error:', error.message);
      this.recordFailure();

      // Handle JSON parsing errors gracefully
      if (error instanceof SyntaxError) {
        console.error('Cache data parsing error:', error.message);
        // Remove corrupted cache entry
        try {
          await redisClient.del(cacheKey);
        } catch (delError) {
          console.error('Failed to delete corrupted cache entry:', delError.message);
        }
      }

      return null;
    }
  }

  /**
   * Stores export data in cache
   * @static
   * @param {string} cacheKey - Cache key
   * @param {Object} exportData - Export data to cache
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {Promise<boolean>} True if cached successfully, false otherwise
   */
  static async setCachedExport(cacheKey, exportData, ttl = this.DEFAULT_TTL) {
    try {
      // Check circuit breaker
      if (this.isCircuitBreakerOpen()) {
        console.log('Circuit breaker open, skipping cache write');
        return false;
      }

      // Check if cache is available
      const isAvailable = await this.isCacheAvailable();
      if (!isAvailable) {
        console.log('Cache unavailable, skipping cache write');
        return false;
      }

      // Check data size
      const dataString = JSON.stringify(exportData);
      if (dataString.length > this.MAX_CACHE_SIZE) {
        throw new Error('Export data too large for cache');
      }

      // Store in cache with TTL
      const result = await redisClient.set(cacheKey, dataString, 'EX', ttl);

      // Reset circuit breaker on success
      this.resetCircuitBreaker();

      return result === 'OK';
    } catch (error) {
      console.error('Cache write error:', error.message);
      this.recordFailure();

      // Handle specific Redis errors
      if (error.message.includes('OOM')) {
        console.error('Redis memory pressure detected, skipping cache');
        return false;
      }

      // Re-throw size errors
      if (error.message.includes('too large')) {
        throw error;
      }

      return false;
    }
  }

  /**
   * Invalidates cache entries based on filter criteria
   * @static
   * @param {Object} filters - Filter parameters to match for invalidation
   * @returns {Promise<Object>} Invalidation result with counts
   */
  static async invalidateExportCache(_filters) {
    try {
      // Check if cache is available
      const isAvailable = await this.isCacheAvailable();
      if (!isAvailable) {
        return { scannedKeys: 0, invalidatedKeys: 0 };
      }

      // Get all export cache keys
      const allKeys = await redisClient.keys('export:*');

      let successCount = 0;
      let errorCount = 0;

      // For simplicity, invalidate all export caches when any filter changes
      // In a production system, you might want more sophisticated matching
      for (const key of allKeys) {
        try {
          await redisClient.del(key);
          successCount++;
        } catch (error) {
          errorCount++;
          console.error(`Failed to invalidate cache key ${key}:`, error.message);
        }
      }

      return {
        scannedKeys: allKeys.length,
        invalidatedKeys: successCount,
        successCount,
        errorCount
      };
    } catch (error) {
      console.error('Cache invalidation error:', error.message);
      return { scannedKeys: 0, invalidatedKeys: 0, successCount: 0, errorCount: 1 };
    }
  }

  /**
   * Invalidates all export cache entries
   * @static
   * @returns {Promise<Object>} Invalidation result with counts
   */
  static async invalidateAllExportCaches() {
    try {
      // Check if cache is available
      const isAvailable = await this.isCacheAvailable();
      if (!isAvailable) {
        return { totalKeys: 0, exportKeys: 0, deletedKeys: 0 };
      }

      // Get all keys and filter export keys
      const allKeys = await redisClient.keys('*');
      const exportKeys = allKeys.filter(key => key.startsWith('export:'));

      let deletedCount = 0;
      for (const key of exportKeys) {
        try {
          await redisClient.del(key);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete cache key ${key}:`, error.message);
        }
      }

      return {
        totalKeys: allKeys.length,
        exportKeys: exportKeys.length,
        deletedKeys: deletedCount
      };
    } catch (error) {
      console.error('Bulk cache invalidation error:', error.message);
      return { totalKeys: 0, exportKeys: 0, deletedKeys: 0 };
    }
  }

  /**
   * Cleans up expired cache entries
   * @static
   * @returns {Promise<Object>} Cleanup result with counts
   */
  static async cleanupExpiredCache() {
    try {
      // Check if cache is available
      const isAvailable = await this.isCacheAvailable();
      if (!isAvailable) {
        return { scannedKeys: 0, expiredKeys: 0, deletedKeys: 0 };
      }

      // Get all export cache keys
      const allKeys = await redisClient.keys('export:*');

      let expiredCount = 0;
      let deletedCount = 0;

      for (const key of allKeys) {
        try {
          const ttl = await redisClient.ttl(key);

          // TTL of -2 means key doesn't exist, -1 means no expiration set
          if (ttl === -2 || ttl <= 0) {
            await redisClient.del(key);
            expiredCount++;
            deletedCount++;
          }
        } catch (error) {
          console.error(`Failed to check/delete expired key ${key}:`, error.message);
        }
      }

      return {
        scannedKeys: allKeys.length,
        expiredKeys: expiredCount,
        deletedKeys: deletedCount
      };
    } catch (error) {
      console.error('Cache cleanup error:', error.message);
      return { scannedKeys: 0, expiredKeys: 0, deletedKeys: 0 };
    }
  }

  /**
   * Gets cache statistics and health information
   * @static
   * @param {string} cacheKey - Optional specific cache key to check
   * @returns {Promise<Object>} Cache statistics
   */
  static async getCacheStats(cacheKey = null) {
    try {
      if (cacheKey) {
        // Get stats for specific key
        const ttl = await redisClient.ttl(cacheKey);
        const exists = await redisClient.exists(cacheKey);

        return {
          exists: exists === 1,
          ttl: ttl,
          expired: ttl <= 0 && ttl !== -1
        };
      } else {
        // Get general cache health stats
        const pingResult = await redisClient.ping();
        const exportKeys = await redisClient.keys('export:*');

        return {
          isHealthy: pingResult === 'PONG',
          totalExportCaches: exportKeys.length,
          lastChecked: new Date().toISOString(),
          status: 'operational'
        };
      }
    } catch (error) {
      if (cacheKey) {
        return {
          exists: false,
          ttl: -2,
          expired: true
        };
      } else {
        return {
          isHealthy: false,
          totalExportCaches: 0,
          lastChecked: new Date().toISOString(),
          status: 'error',
          error: error.message
        };
      }
    }
  }

  /**
   * Checks if cache is available and responsive
   * @static
   * @returns {Promise<boolean>} True if cache is available
   */
  static async isCacheAvailable() {
    try {
      const result = await redisClient.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Cache availability check failed:', error.message);
      return false;
    }
  }

  /**
   * Records a cache operation failure for circuit breaker
   * @static
   * @private
   */
  static recordFailure() {
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failureCount >= this.circuitBreaker.maxFailures) {
      this.circuitBreaker.isOpen = true;
      console.log('Circuit breaker opened due to repeated failures');
    }
  }

  /**
   * Resets the circuit breaker on successful operation
   * @static
   * @private
   */
  static resetCircuitBreaker() {
    this.circuitBreaker.failureCount = 0;
    this.circuitBreaker.isOpen = false;
    this.circuitBreaker.lastFailureTime = null;
  }

  /**
   * Checks if circuit breaker is open
   * @static
   * @private
   * @returns {boolean} True if circuit breaker is open
   */
  static isCircuitBreakerOpen() {
    if (!this.circuitBreaker.isOpen) {
      return false;
    }

    // Check if enough time has passed to try again
    const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailureTime;
    if (timeSinceLastFailure > this.circuitBreaker.resetTimeout) {
      console.log('Circuit breaker reset timeout reached, attempting to close');
      this.circuitBreaker.isOpen = false;
      this.circuitBreaker.failureCount = 0;
      return false;
    }

    return true;
  }
}

export default ExportCacheService;
