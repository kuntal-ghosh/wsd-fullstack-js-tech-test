/**
 * @fileoverview Task store for managing task data, CRUD operations, and real-time updates
 * @module stores/taskStore
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiClient from '../api/client.js'
import socket from '../plugins/socket.js'

/**
 * Pinia store for task management with pagination, filtering, and real-time updates
 * @function useTaskStore
 * @returns {Object} Task store with reactive state and methods
 */
export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref([])
  const loading = ref(false)
  const error = ref(null)
  const pagination = ref({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  })

  // Enhanced filters with advanced options
  const filters = ref({
    status: '',
    priority: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    // Advanced filter properties
    search: '',
    dateFrom: '',
    dateTo: '',
    statusArray: [], // For multi-select status filter
    priorityArray: [], // For multi-select priority filter
    assignee: [],
    tags: []
  })

  const pendingTasks = computed(() =>
    tasks.value.filter((task) => task.status === 'pending')
  )

  const inProgressTasks = computed(() =>
    tasks.value.filter((task) => task.status === 'in-progress')
  )

  const completedTasks = computed(() =>
    tasks.value.filter((task) => task.status === 'completed')
  )

  const highPriorityTasks = computed(() =>
    tasks.value.filter((task) => task.priority === 'high')
  )

  const tasksByStatus = computed(() => ({
    pending: pendingTasks.value.length,
    'in-progress': inProgressTasks.value.length,
    completed: completedTasks.value.length
  }))

  const tasksByPriority = computed(() => ({
    low: tasks.value.filter((task) => task.priority === 'low').length,
    medium: tasks.value.filter((task) => task.priority === 'medium').length,
    high: tasks.value.filter((task) => task.priority === 'high').length
  }))

  /**
   * Gets tasks filtered by current client-side filters
   * For export dialog and other uses
   * @computed
   * @returns {Array} Filtered tasks
   */
  const filteredTasks = computed(() => {
    return tasks.value.filter(task => {
      // Apply text search filter
      if (filters.value.search) {
        const search = filters.value.search.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(search);
        const matchDesc = task.description?.toLowerCase().includes(search) || false;
        
        if (!matchTitle && !matchDesc) {
          return false;
        }
      }
      
      // Apply status filters (single or multiple)
      if (filters.value.status && task.status !== filters.value.status) {
        return false;
      }
      
      if (filters.value.statusArray && 
          filters.value.statusArray.length > 0 && 
          !filters.value.statusArray.includes(task.status)) {
        return false;
      }
      
      // Apply priority filters (single or multiple)
      if (filters.value.priority && task.priority !== filters.value.priority) {
        return false;
      }
      
      if (filters.value.priorityArray && 
          filters.value.priorityArray.length > 0 && 
          !filters.value.priorityArray.includes(task.priority)) {
        return false;
      }
      
      // Apply date range filters
      if (filters.value.dateFrom) {
        const fromDate = new Date(filters.value.dateFrom);
        const taskDate = new Date(task.createdAt);
        if (taskDate < fromDate) {
          return false;
        }
      }
      
      if (filters.value.dateTo) {
        const toDate = new Date(filters.value.dateTo);
        toDate.setHours(23, 59, 59, 999); // End of day
        const taskDate = new Date(task.createdAt);
        if (taskDate > toDate) {
          return false;
        }
      }
      
      // All filters passed
      return true;
    });
  });

  /**
   * Fetches tasks with pagination and filtering
   * @async
   * @function fetchTasks
   * @param {Object} [params={}] - Query parameters
   * @returns {Promise<void>}
   */
  async function fetchTasks(params = {}) {
    loading.value = true
    error.value = null

    try {
      // Build query parameters with enhanced filter support
      const queryParams = {
        page: pagination.value.page,
        limit: pagination.value.limit,
        ...params
      }

      // Add basic filters
      if (filters.value.status) queryParams.status = filters.value.status
      if (filters.value.priority) queryParams.priority = filters.value.priority
      if (filters.value.sortBy) queryParams.sortBy = filters.value.sortBy
      if (filters.value.sortOrder) queryParams.sortOrder = filters.value.sortOrder
      
      // Add advanced filters
      if (filters.value.search) queryParams.search = filters.value.search
      if (filters.value.dateFrom) queryParams.dateFrom = filters.value.dateFrom
      if (filters.value.dateTo) queryParams.dateTo = filters.value.dateTo
      
      // Handle array filters
      if (filters.value.statusArray && filters.value.statusArray.length > 0) {
        queryParams.status = filters.value.statusArray
      }
      
      if (filters.value.priorityArray && filters.value.priorityArray.length > 0) {
        queryParams.priority = filters.value.priorityArray
      }
      
      if (filters.value.assignee && filters.value.assignee.length > 0) {
        queryParams.assignee = filters.value.assignee
      }
      
      if (filters.value.tags && filters.value.tags.length > 0) {
        queryParams.tags = filters.value.tags
      }

      const response = await apiClient.getTasks(queryParams)

      tasks.value = response.data.tasks
      pagination.value = response.data.pagination
    } catch (err) {
      error.value = err.message
      console.error('Error fetching tasks:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetches a single task by ID
   * @async
   * @function getTask
   * @param {string} id - Task ID
   * @returns {Promise<Object>} Task data
   */
  async function getTask(id) {
    loading.value = true
    error.value = null

    try {
      const response = await apiClient.getTask(id)
      return response.data
    } catch (err) {
      error.value = err.message
      console.error('Error fetching task:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Creates a new task
   * @async
   * @function createTask
   * @param {Object} taskData - Task data
   * @returns {Promise<Object>} Created task
   */
  async function createTask(taskData) {
    loading.value = true
    error.value = null

    try {
      const response = await apiClient.createTask(taskData)

      tasks.value.unshift(response.data)
      pagination.value.total++

      return response.data
    } catch (err) {
      error.value = err.message
      console.error('Error creating task:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Updates an existing task
   * @async
   * @function updateTask
   * @param {string} id - Task ID
   * @param {Object} updates - Update data
   * @returns {Promise<Object>} Updated task
   */
  async function updateTask(id, updates) {
    loading.value = true
    error.value = null

    try {
      const response = await apiClient.updateTask(id, updates)

      const index = tasks.value.findIndex((task) => task._id === id)
      if (index !== -1) {
        tasks.value[index] = response.data
      }

      return response.data
    } catch (err) {
      error.value = err.message
      console.error('Error updating task:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Deletes a task by ID
   * @async
   * @function deleteTask
   * @param {string} id - Task ID
   * @returns {Promise<void>}
   */
  async function deleteTask(id) {
    loading.value = true
    error.value = null

    try {
      await apiClient.deleteTask(id)

      const index = tasks.value.findIndex((task) => task._id === id)
      if (index !== -1) {
        tasks.value.splice(index, 1)
        pagination.value.total--
      }
    } catch (err) {
      error.value = err.message
      console.error('Error deleting task:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Updates task filters and refetches data
   * @function updateFilters
   * @param {Object} newFilters - New filter values
   */
  function updateFilters(newFilters) {
    filters.value = { ...filters.value, ...newFilters }
    pagination.value.page = 1
    fetchTasks()
  }

  /**
   * Sets pagination page and refetches data
   * @function setPage
   * @param {number} page - Page number
   */
  function setPage(page) {
    pagination.value.page = page
    fetchTasks()
  }

  /**
   * Handles real-time task updates from Socket.IO
   * @function handleTaskUpdate
   * @param {Object} data - Task update data
   */
  function handleTaskUpdate(data) {
    const { action, task } = data

    switch (action) {
      case 'created':
        if (!tasks.value.find((t) => t._id === task._id)) {
          tasks.value.unshift(task)
          pagination.value.total++
        }
        break
      case 'updated': {
        const index = tasks.value.findIndex((t) => t._id === task._id)
        if (index !== -1) {
          tasks.value[index] = task
        }
        break
      }
      case 'deleted': {
        const deleteIndex = tasks.value.findIndex((t) => t._id === task._id)
        if (deleteIndex !== -1) {
          tasks.value.splice(deleteIndex, 1)
          pagination.value.total--
        }
        break
      }
    }
  }

  /**
   * Sets up Socket.IO event listeners
   * @function initializeSocketListeners
   */
  function initializeSocketListeners() {
    socket.on('task-update', handleTaskUpdate)
  }

  /**
   * Removes Socket.IO event listeners
   * @function cleanup
   */
  function cleanup() {
    socket.off('task-update', handleTaskUpdate)
  }

  /**
   * Clears all filters
   * @function clearFilters
   */
  function clearFilters() {
    filters.value = {
      status: '',
      priority: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      search: '',
      dateFrom: '',
      dateTo: '',
      statusArray: [],
      priorityArray: [],
      assignee: [],
      tags: []
    }
    fetchTasks()
  }

  return {
    tasks,
    loading,
    error,
    pagination,
    filters,
    pendingTasks,
    inProgressTasks,
    completedTasks,
    highPriorityTasks,
    tasksByStatus,
    tasksByPriority,
    filteredTasks,
    fetchTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    updateFilters,
    setPage,
    clearFilters,
    handleTaskUpdate,
    initializeSocketListeners,
    cleanup
  }
})
