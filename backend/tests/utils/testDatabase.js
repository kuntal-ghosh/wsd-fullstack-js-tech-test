/**
 * @fileoverview Test database utilities for export functionality tests
 * @module tests/utils/testDatabase
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;

/**
 * Connect to in-memory MongoDB instance for testing
 * @async
 * @function connectTestDB
 * @returns {Promise<void>}
 */
export const connectTestDB = async () => {
  try {
    // Create in-memory MongoDB instance with longer timeout
    mongoServer = await MongoMemoryServer.create({
      instance: {
        timeout: 30000  // 30 seconds
      }
    });
    const mongoUri = mongoServer.getUri();

    // Connect mongoose to the in-memory database
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000
    });

    console.log('✅ Test MongoDB connected successfully');
  } catch (error) {
    console.error('❌ Test MongoDB connection failed:', error.message);
    throw error;
  }
};

/**
 * Disconnect from test database and clean up
 * @async
 * @function disconnectTestDB
 * @returns {Promise<void>}
 */
export const disconnectTestDB = async () => {
  try {
    // Close all mongoose connections properly
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      await mongoose.disconnect();
    }
    
    // Stop MongoDB memory server
    if (mongoServer) {
      await mongoServer.stop({ force: true });
      mongoServer = null;
    }
    
    // Clear all active handles and force cleanup
    await new Promise(resolve => setImmediate(resolve));
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    console.log('✅ Test MongoDB disconnected successfully');
  } catch (error) {
    console.error('❌ Test MongoDB disconnect failed:', error.message);
    // Don't throw error on disconnect - just log it
    console.log('⚠️  Continuing despite disconnect error...');
  }
};

/**
 * Force cleanup all hanging resources and exit gracefully
 * @async
 * @function forceCleanupAndExit
 * @returns {Promise<void>}
 */
export const forceCleanupAndExit = async () => {
  try {
    // Clear all timers and intervals
    const maxTimerId = setTimeout(() => {}, 0);
    for (let i = 0; i < maxTimerId; i++) {
      clearTimeout(i);
      clearInterval(i);
    }
    
    // Close all mongoose connections
    await mongoose.disconnect();
    
    // Stop MongoDB memory server
    if (mongoServer) {
      await mongoServer.stop({ force: true });
      mongoServer = null;
    }
    
    // Force garbage collection
    if (global.gc) {
      global.gc();
    }
    
    // Log active handles for debugging
    const activeHandles = process._getActiveHandles ? process._getActiveHandles().length : 0;
    const activeRequests = process._getActiveRequests ? process._getActiveRequests().length : 0;
    
    if (activeHandles > 0 || activeRequests > 0) {
      console.log(`⚠️  Still have ${activeHandles} active handles and ${activeRequests} active requests`);
    }
    
    console.log('🧹 Force cleanup completed');
  } catch (error) {
    console.error('❌ Force cleanup failed:', error.message);
  }
};

/**
 * Clear all collections in the test database
 * @async
 * @function clearTestDB
 * @returns {Promise<void>}
 */
export const clearTestDB = async () => {
  try {
    const collections = mongoose.connection.collections;
    
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
    
    console.log('✅ Test database cleared successfully');
  } catch (error) {
    console.error('❌ Test database clear failed:', error.message);
    throw error;
  }
};

/**
 * Drop all collections in the test database
 * @async
 * @function dropTestDB
 * @returns {Promise<void>}
 */
export const dropTestDB = async () => {
  try {
    const collections = mongoose.connection.collections;
    
    for (const key in collections) {
      const collection = collections[key];
      await collection.drop();
    }
    
    console.log('✅ Test database dropped successfully');
  } catch (error) {
    console.error('❌ Test database drop failed:', error.message);
    // Don't throw error if collection doesn't exist
    if (error.message !== 'ns not found') {
      throw error;
    }
  }
};