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
        data-test="export-button"
        :disabled="taskStore.tasks.length === 0 || exportStore.loading"
        @click="onExportClick"
      >
        Export
      </v-btn>

      <v-btn color="primary" @click="showCreateDialog = true">
        <v-icon left>mdi-plus</v-icon>
        New Task
      </v-btn>
    </div>

    <!-- Clean Search Bar -->
    <div class="search-container mb-4">
      <div class="search-wrapper">
        <div class="search-input-container">
          <v-icon class="search-icon" color="primary">mdi-magnify</v-icon>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search tasks by title or description..."
            class="search-input"
            data-test="global-search-input"
            @input="onSearchInput"
          />
          <div class="search-actions">
            <v-btn
              v-if="searchQuery"
              icon
              size="small"
              variant="text"
              class="clear-btn"
              @click="clearSearch"
            >
              <v-icon size="18">mdi-close</v-icon>
            </v-btn>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters Section -->
    <v-expansion-panels
      v-model="filterExpanded"
      class="mb-4"
      data-test="filter-panel-container"
    >
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2">mdi-filter-variant</v-icon>
          Advanced Filters
          <v-chip
            v-if="filterCount > 0"
            color="primary"
            size="small"
            class="ml-2"
            data-test="filter-count"
          >
            {{ filterCount }}
          </v-chip>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <advanced-filter-panel
            v-model="filters"
            :export-loading="exportStore.loading"
            data-test="filter-panel"
            @update:model-value="updateFilters"
            @export="onAdvancedExport"
          />
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <div v-if="taskStore.loading" class="text-center py-8">
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
    </div>

    <div v-else-if="taskStore.error" class="text-center py-8">
      <v-alert type="error">{{ taskStore.error }}</v-alert>
    </div>

    <div
      v-else-if="taskStore.tasks.length === 0"
      class="empty-state-container d-flex flex-column align-center justify-center pa-8"
      data-test="empty-state"
    >
      <!-- Animated background illustration -->
      <div class="empty-state-illustration mb-6">
        <div class="floating-documents">
          <div class="document doc-1">
            <v-icon size="40" color="primary">mdi-format-list-bulleted</v-icon>
          </div>
          <div class="document doc-2">
            <v-icon size="36" color="secondary">mdi-check-circle</v-icon>
          </div>
          <div class="document doc-3">
            <v-icon size="32" color="success">mdi-clipboard-check</v-icon>
          </div>
        </div>

        <!-- Central empty folder icon -->
        <div class="empty-folder">
          <v-icon size="80" color="grey-lighten-2"
            >mdi-format-list-checks</v-icon
          >
          <div class="folder-shine"></div>
        </div>
      </div>

      <!-- Text content -->
      <div class="text-center">
        <h3 class="text-h5 mb-3 text-grey-darken-2">
          {{
            hasActiveFilters ? 'No tasks match your filters' : 'No tasks yet'
          }}
        </h3>
        <p class="text-body-1 text-grey mb-4" style="max-width: 400px">
          {{
            hasActiveFilters
              ? 'Try adjusting your filters or create a new task to get started.'
              : 'Start by creating your first task to organize your work efficiently.'
          }}
        </p>

        <!-- Action button -->
        <v-btn
          color="primary"
          size="large"
          prepend-icon="mdi-plus"
          variant="elevated"
          class="mt-2"
          @click="showCreateDialog = true"
        >
          {{ hasActiveFilters ? 'Create New Task' : 'Create Your First Task' }}
        </v-btn>
      </div>
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
      data-test="export-dialog"
      @export-created="handleExportCreated"
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
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useTaskStore } from '../stores/taskStore.js'
import { useExportStore } from '../stores/exportStore.js'
import TaskFormDialog from './TaskFormDialog.vue'
import AdvancedFilterPanel from './AdvancedFilterPanel.vue'
import ExportDialog from './ExportDialog.vue'
import { debounce } from 'lodash-es'

const taskStore = useTaskStore()
const exportStore = useExportStore()

const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const showDeleteDialog = ref(false)
const showExportDialog = ref(false)
const selectedTask = ref(null)
const filterExpanded = ref([])
const searchQuery = ref('')

// Debounce search to prevent excessive API calls
const onSearchInput = debounce(() => {
  filters.search = searchQuery.value
  updateFilters()
}, 300)

// Clear search field
function clearSearch() {
  searchQuery.value = ''
  filters.search = ''
  updateFilters()
}

// Expand the filter accordion when clicking on the filter icon
function _expandFilters() {
  filterExpanded.value = [0]
}

const filters = reactive({
  search: '',
  status: [],
  priority: [],
  dateFrom: '',
  dateTo: '',
  sortBy: '',
  sortOrder: ''
})

// Combined filters for export
const combinedFilters = computed(() => {
  return { ...filters }
})

// Count active filters
const filterCount = computed(() => {
  let count = 0
  if (filters.search) count++
  if (filters.status?.length > 0) count++
  if (filters.priority?.length > 0) count++
  if (filters.dateFrom || filters.dateTo) count++
  if (filters.sortBy) count++
  if (filters.sortOrder) count++
  return count
})

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return !!(
    filters.search ||
    filters.status?.length > 0 ||
    filters.priority?.length > 0 ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.sortBy ||
    filters.sortOrder
  )
})

function updateFilters(newFilters) {
  if (newFilters) {
    Object.assign(filters, newFilters)
  }

  const filtersForUpdate = {
    ...filters,
    // Use arrays for multiple selections
    statusArray: filters.status,
    priorityArray: filters.priority
  }

  taskStore.updateFilters(filtersForUpdate)
}

function onExportClick() {
  if (exportStore.loading) return
  showExportDialog.value = true
}

function onAdvancedExport() {
  if (exportStore.loading) return
  showExportDialog.value = true
}

function handleExportCreated(exportRecord) {
  // Prevent multiple exports
  if (!exportRecord || exportStore.loading) return

  // Close export dialog
  showExportDialog.value = false

  // Show notification if export was created successfully
  if (exportRecord._id) {
    // We don't need to add to the exports list because the socket will handle that
    console.log('Export created successfully:', exportRecord)

    // Scroll to the active exports section if it exists
    nextTick(() => {
      const activeExportsElement = document.querySelector(
        '[data-test="active-exports"]'
      )
      if (activeExportsElement) {
        activeExportsElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        })
      }
    })
  }
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
/* Beautiful Empty State Styling */
.empty-state-container {
  min-height: 400px;
  background: linear-gradient(
    135deg,
    rgba(var(--v-theme-surface-variant), 0.3) 0%,
    rgba(var(--v-theme-primary), 0.05) 100%
  );
  border-radius: 16px;
  position: relative;
  overflow: hidden;
}

.empty-state-container::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(
    circle,
    rgba(var(--v-theme-primary), 0.1) 0%,
    transparent 70%
  );
  animation: shimmer 6s ease-in-out infinite;
}

@keyframes shimmer {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(180deg);
  }
}

.empty-state-illustration {
  position: relative;
  z-index: 2;
}

.empty-folder {
  position: relative;
  display: inline-block;
  animation: gentle-float 3s ease-in-out infinite;
}

@keyframes gentle-float {
  0%,
  100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}

.folder-shine {
  position: absolute;
  top: 20%;
  left: 30%;
  width: 20px;
  height: 20px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  filter: blur(8px);
  animation: shine 2s ease-in-out infinite alternate;
}

@keyframes shine {
  0% {
    opacity: 0.6;
    transform: scale(1);
  }
  100% {
    opacity: 1;
    transform: scale(1.1);
  }
}

.floating-documents {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 200px;
  height: 200px;
}

.document {
  position: absolute;
  animation: float 4s ease-in-out infinite;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0px) rotate(0deg);
  }
  33% {
    transform: translateY(-5px) rotate(2deg);
  }
  66% {
    transform: translateY(5px) rotate(-2deg);
  }
}

.doc-1 {
  top: 10%;
  left: 70%;
  animation-delay: -1s;
}

.doc-2 {
  top: 60%;
  left: 80%;
  animation-delay: -2s;
}

.doc-3 {
  top: 70%;
  left: 15%;
  animation-delay: -3s;
}

.document:hover {
  animation-play-state: paused;
  transform: scale(1.1);
}

.document .v-icon {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.document:hover .v-icon {
  transform: scale(1.2);
}

/* Empty state content styling */
.empty-state-container .text-h5 {
  font-weight: 600;
  letter-spacing: -0.02em;
}

.empty-state-container .text-body-1 {
  line-height: 1.6;
}

/* Button animations in empty state */
.empty-state-container .v-btn {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.empty-state-container .v-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
}

/* Responsive empty state */
@media (max-width: 600px) {
  .empty-state-container {
    min-height: 350px;
    padding: 32px 16px;
  }

  .floating-documents {
    width: 150px;
    height: 150px;
  }

  .empty-folder .v-icon {
    font-size: 60px !important;
  }
}

/* Clean Search Bar Styling */
.search-container {
  position: relative;
  margin-bottom: 24px;
}

.search-wrapper {
  display: flex;
  align-items: center;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-outline), 0.2);
  border-radius: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  max-width: 600px;
  margin: 0 auto;
}

.search-wrapper:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-color: rgba(var(--v-theme-primary), 0.3);
}

.search-wrapper:focus-within {
  box-shadow: 0 4px 12px rgba(var(--v-theme-primary), 0.2);
  border-color: rgb(var(--v-theme-primary));
}

.search-input-container {
  display: flex;
  align-items: center;
  flex-grow: 1;
  padding: 12px 16px;
  gap: 12px;
}

.search-icon {
  color: rgba(var(--v-theme-on-surface), 0.6);
  flex-shrink: 0;
}

.search-input {
  border: none;
  outline: none;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-size: 16px;
  font-weight: 400;
  flex-grow: 1;
  min-width: 0;
  text-align: left;
}

.search-input:focus,
.search-input:not(:placeholder-shown) {
  text-align: left;
}

.search-input::placeholder {
  color: rgba(var(--v-theme-on-surface), 0.6);
  text-align: left;
}

.search-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.clear-btn,
.filter-btn {
  color: rgba(var(--v-theme-on-surface), 0.7);
  transition: color 0.2s ease;
}

.clear-btn:hover,
.filter-btn:hover {
  color: rgb(var(--v-theme-primary));
}

/* Badge positioning fix */
.v-badge {
  position: relative;
}

.v-badge .v-badge__badge {
  position: absolute;
  top: -8px;
  right: -8px;
  min-width: 16px;
  height: 16px;
  font-size: 10px;
  font-weight: 600;
}

/* Filters Section */
.v-expansion-panels {
  background: rgba(var(--v-theme-surface), 0.9);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.v-expansion-panel {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
}

.v-expansion-panel:last-child {
  border-bottom: none;
}

.v-expansion-panel-title {
  background: rgba(var(--v-theme-primary), 0.1);
  color: var(--v-theme-primary);
  font-weight: 500;
}

.v-expansion-panel-text {
  background: rgba(var(--v-theme-surface), 0.9);
}

/* Task Item Styling */
.task-item {
  background: rgba(var(--v-theme-surface), 0.9);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

.task-item:hover {
  transform: translateY(-2px);
}

.task-title {
  color: var(--v-theme-on-surface);
  font-weight: 600;
}

.task-meta {
  margin-top: 8px;
}

.task-meta .v-chip {
  height: 24px;
  font-size: 0.875rem;
}

/* Pagination Styling */
.v-pagination {
  .v-pagination__item {
    border-radius: 8px;
    transition: background 0.3s ease;
  }

  .v-pagination__item:hover {
    background: rgba(var(--v-theme-primary), 0.1);
  }

  .v-pagination__item--active {
    background: var(--v-theme-primary);
    color: white;
  }
}
</style>
