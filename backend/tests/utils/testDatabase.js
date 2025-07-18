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
    // Create in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Connect mongoose to the in-memory database
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000
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
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    
    if (mongoServer) {
      await mongoServer.stop();
    }
    
    console.log('✅ Test MongoDB disconnected successfully');
  } catch (error) {
    console.error('❌ Test MongoDB disconnect failed:', error.message);
    throw error;
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