<!--
/**
 * @fileoverview Task management component with CRUD operations, filtering, and pagination
 * @component TaskList
 * @description Comprehensive task list interface with create, edit, delete, filter, and sort capabilities
 * @emits {Object} task-created - Emitted when a new task is created
 * @emits {Object} task-updated - Emitted when a task is updated
 * @emits {String} task-deleted - Emitted when a task is deleted
 */
-->

<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h2 class="page-title">Tasks</h2>
      <v-spacer></v-spacer>
      
      <!-- Export Button -->
      <v-btn
        color="info"
        class="mr-2"
        prepend-icon="mdi-download"
        @click="showExportDialog = true"
        data-test="export-button"
        :disabled="taskStore.tasks.length === 0"
      >
        Export
      </v-btn>
      
      <v-btn color="primary" @click="showCreateDialog = true">
        <v-icon left>mdi-plus</v-icon>
        New Task
      </v-btn>
    </div>

    <v-card class="mb-4">
      <v-card-text>
        <v-row>
          <v-col cols="12" md="3">
            <v-select
              v-model="filters.status"
              :items="statusOptions"
              label="Status"
              clearable
              @update:model-value="updateFilters"
            ></v-select>
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="filters.priority"
              :items="priorityOptions"
              label="Priority"
              clearable
              @update:model-value="updateFilters"
            ></v-select>
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="filters.sortBy"
              :items="sortOptions"
              label="Sort by"
              @update:model-value="updateFilters"
            ></v-select>
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="filters.sortOrder"
              :items="orderOptions"
              label="Order"
              @update:model-value="updateFilters"
            ></v-select>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Advanced Filters Section -->
    <v-expansion-panels class="mb-4" data-test="advanced-filter-panel-container">
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2">mdi-filter-variant</v-icon>
          Advanced Filters
          <v-chip
            v-if="advancedFilterCount > 0"
            color="primary"
            size="small"
            class="ml-2"
            data-test="advanced-filter-count"
          >
            {{ advancedFilterCount }}
          </v-chip>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <advanced-filter-panel
            v-model="advancedFilters"
            @update:model-value="updateAdvancedFilters"
            @export="onAdvancedExport"
            :export-loading="exportStore.loading"
            data-test="advanced-filter-panel"
          />
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <!-- Active Export Notifications -->
    <div v-if="exportStore.activeExports.length > 0" class="mb-4" data-test="active-exports">
      <h3 class="text-subtitle-1 mb-2">Active Exports</h3>
      <export-progress
        v-for="exportItem in exportStore.activeExports"
        :key="exportItem._id"
        :export-id="exportItem._id"
        :export-data="exportItem"
        @download="handleExportDownload"
        @cancel="handleExportCancel"
        data-test="export-progress-item"
      />
    </div>

    <!-- Recent Export Notifications -->
    <div v-if="recentExports.length > 0 && !exportStore.activeExports.length" class="mb-4" data-test="recent-exports">
      <div class="d-flex align-center mb-2">
        <h3 class="text-subtitle-1 mb-0">Recent Exports</h3>
        <v-spacer></v-spacer>
        <v-btn
          variant="text"
          size="small"
          to="/exports"
          color="primary"
          data-test="view-all-exports"
        >
          View All
        </v-btn>
      </div>
      <export-progress
        v-for="exportItem in recentExports"
        :key="exportItem._id"
        :export-id="exportItem._id"
        :export-data="exportItem"
        @download="handleExportDownload"
        @retry="handleExportRetry"
        data-test="export-progress-item"
      />
    </div>

    <div v-if="taskStore.loading" class="text-center py-8">
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
    </div>

    <div v-else-if="taskStore.error" class="text-center py-8">
      <v-alert type="error">{{ taskStore.error }}</v-alert>
    </div>

    <div v-else-if="taskStore.tasks.length === 0" class="text-center py-8">
      <v-icon size="64" color="grey-lighten-1">mdi-format-list-checks</v-icon>
      <p class="text-grey mt-2">No tasks found</p>
    </div>

    <div v-else>
      <v-card
        v-for="task in taskStore.tasks"
        :key="task._id"
        class="task-item mb-3"
        @click="editTask(task)"
      >
        <v-card-text>
          <div class="d-flex align-start">
            <div class="flex-grow-1">
              <h3 class="task-title">{{ task.title }}</h3>
              <p v-if="task.description" class="text-body-2 mb-2">
                {{ task.description }}
              </p>
              <div class="task-meta">
                <v-chip
                  :color="getStatusColor(task.status)"
                  size="small"
                  variant="flat"
                >
                  {{ formatStatus(task.status) }}
                </v-chip>
                <v-chip
                  :color="getPriorityColor(task.priority)"
                  size="small"
                  variant="outlined"
                >
                  {{ formatPriority(task.priority) }}
                </v-chip>
                <span class="text-caption">
                  Created {{ formatDate(task.createdAt) }}
                </span>
                <span v-if="task.completedAt" class="text-caption">
                  Completed {{ formatDate(task.completedAt) }}
                </span>
              </div>
            </div>
            <v-menu>
              <template #activator="{ props }">
                <v-btn icon size="small" v-bind="props" @click.stop>
                  <v-icon>mdi-dots-vertical</v-icon>
                </v-btn>
              </template>
              <v-list>
                <v-list-item @click="editTask(task)">
                  <v-list-item-title>Edit</v-list-item-title>
                </v-list-item>
                <v-list-item @click="deleteTask(task)">
                  <v-list-item-title>Delete</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </div>
        </v-card-text>
      </v-card>

      <div class="text-center mt-4">
        <v-pagination
          v-model="taskStore.pagination.page"
          :length="taskStore.pagination.pages"
          @update:model-value="taskStore.setPage"
        ></v-pagination>
      </div>
    </div>

    <!-- Export Dialog -->
    <export-dialog
      v-model="showExportDialog"
      :filters="combinedFilters"
      @export-created="handleExportCreated"
      data-test="export-dialog"
    />

    <task-form-dialog v-model="showCreateDialog" @save="handleSave" />

    <task-form-dialog
      v-model="showEditDialog"
      :task="selectedTask"
      @save="handleSave"
    />

    <v-dialog v-model="showDeleteDialog" max-width="400">
      <v-card>
        <v-card-title>Delete Task</v-card-title>
        <v-card-text>
          Are you sure you want to delete "{{ selectedTask?.title }}"?
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="showDeleteDialog = false">Cancel</v-btn>
          <v-btn color="error" @click="confirmDelete">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useTaskStore } from '../stores/taskStore.js'
import { useExportStore } from '../stores/exportStore.js'
import TaskFormDialog from './TaskFormDialog.vue'
import AdvancedFilterPanel from './AdvancedFilterPanel.vue'
import ExportDialog from './ExportDialog.vue'
import ExportProgress from './ExportProgress.vue'

const taskStore = useTaskStore()
const exportStore = useExportStore()

const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const showDeleteDialog = ref(false)
const showExportDialog = ref(false)
const selectedTask = ref(null)

const filters = reactive({
  status: '',
  priority: '',
  sortBy: 'createdAt',
  sortOrder: 'desc'
})

const advancedFilters = reactive({
  search: '',
  status: [],
  priority: [],
  assignee: [],
  dateFrom: '',
  dateTo: '',
  tags: []
})

// Combined filters for export
const combinedFilters = computed(() => {
  return {
    ...filters,
    // Convert single status to array if present
    status: filters.status ? [filters.status] : advancedFilters.status,
    // Convert single priority to array if present
    priority: filters.priority ? [filters.priority] : advancedFilters.priority,
    // Add advanced filters
    search: advancedFilters.search,
    assignee: advancedFilters.assignee,
    dateFrom: advancedFilters.dateFrom,
    dateTo: advancedFilters.dateTo,
    tags: advancedFilters.tags
  }
})

// Count active advanced filters
const advancedFilterCount = computed(() => {
  let count = 0
  if (advancedFilters.search) count++
  if (advancedFilters.status?.length > 0) count++
  if (advancedFilters.priority?.length > 0) count++
  if (advancedFilters.assignee?.length > 0) count++
  if (advancedFilters.dateFrom || advancedFilters.dateTo) count++
  if (advancedFilters.tags?.length > 0) count++
  return count
})

// Get recent exports (completed or failed in the last 24 hours)
const recentExports = computed(() => {
  const oneDayAgo = new Date()
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)
  
  return exportStore.exports
    .filter(exp => 
      (exp.status === 'completed' || exp.status === 'failed') && 
      new Date(exp.updatedAt) > oneDayAgo
    )
    .slice(0, 3) // Show only last 3
})

const statusOptions = [
  { title: 'Pending', value: 'pending' },
  { title: 'In Progress', value: 'in-progress' },
  { title: 'Completed', value: 'completed' }
]

const priorityOptions = [
  { title: 'Low', value: 'low' },
  { title: 'Medium', value: 'medium' },
  { title: 'High', value: 'high' }
]

const sortOptions = [
  { title: 'Created Date', value: 'createdAt' },
  { title: 'Updated Date', value: 'updatedAt' },
  { title: 'Title', value: 'title' },
  { title: 'Priority', value: 'priority' },
  { title: 'Status', value: 'status' }
]

const orderOptions = [
  { title: 'Newest First', value: 'desc' },
  { title: 'Oldest First', value: 'asc' }
]

function updateFilters() {
  taskStore.updateFilters(filters)
}

function updateAdvancedFilters(newFilters) {
  Object.assign(advancedFilters, newFilters)
  
  // Clear basic filters that overlap with advanced filters
  if (advancedFilters.status?.length > 0) filters.status = ''
  if (advancedFilters.priority?.length > 0) filters.priority = ''
  
  // Update task store with combined filters
  const combinedFiltersForUpdate = {
    ...filters,
    // Add advanced filter properties
    search: advancedFilters.search,
    dateFrom: advancedFilters.dateFrom,
    dateTo: advancedFilters.dateTo,
    // Use arrays for multiple selections
    statusArray: advancedFilters.status,
    priorityArray: advancedFilters.priority,
    assignee: advancedFilters.assignee,
    tags: advancedFilters.tags
  }
  
  taskStore.updateFilters(combinedFiltersForUpdate)
}

function onAdvancedExport() {
  showExportDialog.value = true
}

function handleExportCreated(exportRecord) {
  // Add notification or display progress
  console.log('Export created:', exportRecord)
  showExportDialog.value = false
}

function handleExportDownload(exportId) {
  console.log('Export downloaded:', exportId)
}

function handleExportCancel(exportId) {
  console.log('Export cancelled:', exportId)
}

function handleExportRetry(exportId) {
  console.log('Export retry:', exportId)
}

function editTask(task) {
  selectedTask.value = task
  showEditDialog.value = true
}

function deleteTask(task) {
  selectedTask.value = task
  showDeleteDialog.value = true
}

async function handleSave() {
  showCreateDialog.value = false
  showEditDialog.value = false
  selectedTask.value = null
  await taskStore.fetchTasks()
}

async function confirmDelete() {
  if (selectedTask.value) {
    await taskStore.deleteTask(selectedTask.value._id)
    showDeleteDialog.value = false
    selectedTask.value = null
  }
}

function getStatusColor(status) {
  switch (status) {
    case 'pending':
      return 'warning'
    case 'in-progress':
      return 'info'
    case 'completed':
      return 'success'
    default:
      return 'grey'
  }
}

function getPriorityColor(priority) {
  switch (priority) {
    case 'low':
      return 'success'
    case 'medium':
      return 'warning'
    case 'high':
      return 'error'
    default:
      return 'grey'
  }
}

function formatStatus(status) {
  return status.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

function formatPriority(priority) {
  return priority.charAt(0).toUpperCase() + priority.slice(1)
}

function formatDate(date) {
  return new Date(date).toLocaleDateString()
}

onMounted(() => {
  taskStore.fetchTasks()
  exportStore.fetchExports()
  exportStore.initializeSocketListeners()
})

onUnmounted(() => {
  exportStore.cleanup()
})
</script>

<style scoped>
/* Add any component-specific styles here */
</style>
