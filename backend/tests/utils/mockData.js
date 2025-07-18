/**
 * @fileoverview Mock data generation utilities for export functionality tests
 * @module tests/utils/mockData
 */

import Task from '../../src/models/Task.js';

/**
 * Generate mock task data for testing
 * @param {Object} overrides - Properties to override in the generated task
 * @returns {Object} Mock task data
 */
export const generateMockTask = (overrides = {}) => {
  const baseTask = {
    title: 'Test Task',
    description: 'Test task description',
    status: 'pending',
    priority: 'medium',
    estimatedTime: 60,
    actualTime: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null
  };

  return { ...baseTask, ...overrides };
};

/**
 * Generate multiple mock tasks with varied data
 * @param {number} count - Number of tasks to generate
 * @param {Object} baseOverrides - Base properties to apply to all tasks
 * @returns {Array<Object>} Array of mock task data
 */
export const generateMockTasks = (count = 10, baseOverrides = {}) => {
  const tasks = [];
  const statuses = ['pending', 'in-progress', 'completed'];
  const priorities = ['low', 'medium', 'high'];
  
  for (let i = 0; i < count; i++) {
    const task = generateMockTask({
      title: `Test Task ${i + 1}`,
      description: `Description for test task ${i + 1}`,
      status: statuses[i % statuses.length],
      priority: priorities[i % priorities.length],
      estimatedTime: (i + 1) * 30, // 30, 60, 90, etc.
      createdAt: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)), // Spread over days
      ...baseOverrides
    });
    
    // Add completion data for completed tasks
    if (task.status === 'completed') {
      task.completedAt = new Date(task.createdAt.getTime() + (task.estimatedTime * 60 * 1000));
      task.actualTime = task.estimatedTime + (Math.random() * 30 - 15); // ±15 minutes variance
    }
    
    tasks.push(task);
  }
  
  return tasks;
};

/**
 * Create mock tasks in the database
 * @param {number} count - Number of tasks to create
 * @param {Object} baseOverrides - Base properties to apply to all tasks
 * @returns {Promise<Array<Object>>} Array of created task documents
 */
export const createMockTasks = async (count = 10, baseOverrides = {}) => {
  const mockTasks = generateMockTasks(count, baseOverrides);
  const createdTasks = await Task.insertMany(mockTasks);
  return createdTasks;
};

/**
 * Generate mock export data for testing
 * @param {Object} overrides - Properties to override in the generated export
 * @returns {Object} Mock export data
 */
export const generateMockExport = (overrides = {}) => {
  const baseExport = {
    format: 'csv',
    filters: {
      status: 'pending',
      priority: 'medium',
      dateFrom: null,
      dateTo: null,
      search: '',
      sortBy: 'createdAt',
      sortOrder: 'desc'
    },
    totalRecords: 0,
    fileSize: 0,
    filePath: '',
    downloadUrl: '',
    status: 'processing',
    progress: 0,
    error: null,
    downloadCount: 0,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
  };

  return { ...baseExport, ...overrides };
};

/**
 * Generate multiple mock exports with varied data
 * @param {number} count - Number of exports to generate
 * @param {Object} baseOverrides - Base properties to apply to all exports
 * @returns {Array<Object>} Array of mock export data
 */
export const generateMockExports = (count = 5, baseOverrides = {}) => {
  const exports = [];
  const formats = ['csv', 'json'];
  const statuses = ['processing', 'completed', 'failed'];
  
  for (let i = 0; i < count; i++) {
    const exportData = generateMockExport({
      format: formats[i % formats.length],
      status: statuses[i % statuses.length],
      totalRecords: (i + 1) * 10,
      fileSize: (i + 1) * 1024, // KB
      progress: statuses[i % statuses.length] === 'completed' ? 100 : Math.floor(Math.random() * 100),
      filePath: `/tmp/exports/export_${i + 1}.${formats[i % formats.length]}`,
      downloadUrl: `/api/exports/${i + 1}/download`,
      createdAt: new Date(Date.now() - (i * 60 * 60 * 1000)), // Spread over hours
      ...baseOverrides
    });
    
    exports.push(exportData);
  }
  
  return exports;
};

/**
 * Generate mock filter combinations for testing
 * @returns {Array<Object>} Array of filter combinations
 */
export const generateMockFilters = () => {
  return [
    // Basic filters
    { status: 'pending' },
    { priority: 'high' },
    { status: 'completed', priority: 'medium' },
    
    // Date range filters
    {
      dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
      dateTo: new Date().toISOString()
    },
    
    // Search filters
    { search: 'test' },
    { search: 'important' },
    
    // Complex combinations
    {
      status: 'in-progress',
      priority: 'high',
      search: 'urgent',
      dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days ago
    },
    
    // Sort variations
    { sortBy: 'priority', sortOrder: 'asc' },
    { sortBy: 'createdAt', sortOrder: 'desc' },
    { sortBy: 'title', sortOrder: 'asc' }
  ];
};

/**
 * Clean up all mock data from the database
 * @returns {Promise<void>}
 */
export const cleanupMockData = async () => {
  try {
    await Task.deleteMany({});
    console.log('✅ Mock data cleaned up successfully');
  } catch (error) {
    console.error('❌ Mock data cleanup failed:', error.message);
    throw error;
  }
};