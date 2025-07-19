<!--
/**
 * @fileoverview Export history component for viewing past exports with filtering and actions
 * @component ExportHistory
 * @description Displays a paginated list of export history entries with filtering, sorting,
 * metadata display, and actions like re-download, delete, and retry
 */
-->

<template>
  <v-card class="export-history">
    <!-- Header with title and refresh button -->
    <v-card-title class="d-flex justify-space-between align-center">
      Export History
      <v-btn
        icon="mdi-refresh"
        size="small"
        data-test="refresh-button"
        :loading="loading"
        @click="refreshHistory"
      />
    </v-card-title>
    
    <!-- Error state -->
    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      class="mx-4 mt-2"
      data-test="error-alert"
    >
      {{ error }}
      <template v-slot:append>
        <v-btn
          variant="text"
          size="small"
          data-test="refresh-button"
          @click="refreshHistory"
        >
          Retry
        </v-btn>
      </template>
    </v-alert>

    <!-- Action error message -->
    <v-alert
      v-if="actionError"
      type="error"
      variant="tonal"
      class="mx-4 mt-2"
      closable
      data-test="action-error-message"
      @click:close="actionError = ''"
    >
      {{ actionError }}
    </v-alert>

    <!-- Filters and sorting section -->
    <v-card-text>
      <v-expansion-panels variant="accordion">
        <v-expansion-panel>
          <v-expansion-panel-title>
            <v-icon class="mr-2">mdi-filter-variant</v-icon>
            Filters & Sorting
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <div class="d-flex flex-wrap gap-4" data-test="filter-section">
              <!-- Format filter -->
              <v-select
                v-model="filters.format"
                :items="['csv', 'json', 'xlsx']"
                label="Format"
                variant="outlined"
                density="compact"
                clearable
                data-test="format-filter"
              >
                <template v-slot:item="{ item, props }">
                  <v-list-item
                    v-bind="props"
                    :data-test="`format-option-${item.raw}`"
                  >
                    {{ item.raw.toUpperCase() }}
                  </v-list-item>
                </template>
              </v-select>

              <!-- Status filter -->
              <v-select
                v-model="filters.status"
                :items="['completed', 'failed']"
                label="Status"
                variant="outlined"
                density="compact"
                clearable
                data-test="status-filter"
              >
                <template v-slot:item="{ item, props }">
                  <v-list-item
                    v-bind="props"
                    :data-test="`status-option-${item.raw}`"
                  >
                    {{ item.raw.charAt(0).toUpperCase() + item.raw.slice(1) }}
                  </v-list-item>
                </template>
              </v-select>

              <!-- Date range filters -->
              <v-text-field
                v-model="filters.dateFrom"
                label="From Date"
                variant="outlined"
                density="compact"
                type="date"
                data-test="date-from-filter"
              />

              <v-text-field
                v-model="filters.dateTo"
                label="To Date"
                variant="outlined"
                density="compact"
                type="date"
                data-test="date-to-filter"
              />

              <div class="d-flex align-center">
                <v-btn
                  color="primary"
                  variant="text"
                  data-test="apply-filters-button"
                  @click="applyFilters"
                >
                  Apply
                </v-btn>
                <v-btn
                  variant="text"
                  data-test="reset-filters-button"
                  @click="resetFilters"
                >
                  Reset
                </v-btn>
              </div>
            </div>

            <!-- Sorting options -->
            <div class="mt-4" data-test="sort-section">
              <div class="text-subtitle-2 mb-2">Sort by</div>
              <div class="d-flex flex-wrap gap-2">
                <v-btn
                  variant="outlined"
                  size="small"
                  :color="sortBy === 'createdAt' ? 'primary' : ''"
                  data-test="sort-by-date"
                  @click="toggleSort('createdAt')"
                >
                  Date
                  <v-icon right>
                    {{ 
                      sortBy === 'createdAt' 
                        ? (sortOrder === 'desc' ? 'mdi-arrow-down' : 'mdi-arrow-up') 
                        : 'mdi-arrow-down'
                    }}
                  </v-icon>
                </v-btn>

                <v-btn
                  variant="outlined"
                  size="small"
                  :color="sortBy === 'fileSize' ? 'primary' : ''"
                  data-test="sort-by-size"
                  @click="toggleSort('fileSize')"
                >
                  Size
                  <v-icon right>
                    {{ 
                      sortBy === 'fileSize' 
                        ? (sortOrder === 'desc' ? 'mdi-arrow-down' : 'mdi-arrow-up') 
                        : 'mdi-arrow-down'
                    }}
                  </v-icon>
                </v-btn>

                <v-btn
                  variant="outlined"
                  size="small"
                  :color="sortBy === 'totalRecords' ? 'primary' : ''"
                  data-test="sort-by-records"
                  @click="toggleSort('totalRecords')"
                >
                  Records
                  <v-icon right>
                    {{ 
                      sortBy === 'totalRecords' 
                        ? (sortOrder === 'desc' ? 'mdi-arrow-down' : 'mdi-arrow-up') 
                        : 'mdi-arrow-down'
                    }}
                  </v-icon>
                </v-btn>
              </div>
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-card-text>

    <!-- Loading state -->
    <div v-if="loading" class="d-flex justify-center pa-4" data-test="loading-progress">
      <v-progress-circular indeterminate />
    </div>

    <!-- Empty state -->
    <div 
      v-else-if="!exportHistory.length" 
      class="d-flex flex-column align-center pa-6" 
      data-test="empty-state"
    >
      <v-icon size="64" color="grey-lighten-1">mdi-archive-outline</v-icon>
      <div class="text-h6 mt-4 text-grey-darken-1">No export history found</div>
      <div class="text-body-2 text-grey mt-2">
        Create an export to see it in your history
      </div>
    </div>

    <!-- Error state -->
    <div 
      v-else-if="error" 
      class="d-flex flex-column align-center pa-6" 
      data-test="error-state"
    >
      <v-icon size="64" color="error">mdi-alert-circle-outline</v-icon>
      <div class="text-h6 mt-4 text-error">Failed to load export history</div>
      <div class="text-body-2 mt-2">{{ error }}</div>
      <v-btn 
        class="mt-4" 
        color="primary" 
        data-test="refresh-button"
        @click="refreshHistory"
      >
        Try Again
      </v-btn>
    </div>

    <!-- History table -->
    <v-data-table
      v-else
      :headers="headers"
      :items="exportHistory"
      :loading="loading"
      :items-per-page="itemsPerPage"
      :page="currentPage"
      :items-length="totalItems"
      :items-per-page-options="itemsPerPageOptions"
      class="export-history-table"
      item-key="_id"
      data-test="export-history-table"
    >
      <!-- Date column -->
      <template v-slot:item.createdAt="{ item }">
        <span data-test="export-date">{{ formatDate(item.createdAt) }}</span>
      </template>

      <!-- Format column -->
      <template v-slot:item.format="{ item }">
        <span data-test="export-format">{{ item.format.toUpperCase() }}</span>
      </template>

      <!-- Status column -->
      <template v-slot:item.status="{ item }">
        <v-chip
          size="small"
          :color="getStatusColor(item.status)"
          data-test="status-chip"
        >
          <v-icon size="small" class="mr-1">
            {{ getStatusIcon(item.status) }}
          </v-icon>
          {{ formatStatus(item.status) }}
        </v-chip>
      </template>

      <!-- Records column -->
      <template v-slot:item.totalRecords="{ item }">
        <span data-test="export-records">
          {{ item.totalRecords || '-' }}
        </span>
      </template>

      <!-- Size column -->
      <template v-slot:item.fileSize="{ item }">
        <span data-test="export-size">
          {{ item.fileSize ? formatFileSize(item.fileSize) : '-' }}
        </span>
      </template>

      <!-- Actions column -->
      <template v-slot:item.actions="{ item }">
        <div class="d-flex gap-2">
          <!-- Download button for completed exports -->
          <v-btn
            v-if="item.status === 'completed'"
            icon="mdi-download"
            size="small"
            color="primary"
            :data-test="`download-button-${item._id}`"
            :loading="downloadProgress[item._id]?.downloading"
            :disabled="loading"
            @click="handleDownload(item)"
          />

          <!-- Download progress indicator -->
          <div 
            v-if="downloadProgress[item._id]?.downloading"
            class="text-caption"
            :data-test="`download-progress-${item._id}`"
          >
            {{ downloadProgress[item._id].progress }}%
          </div>

          <!-- Retry button for failed exports -->
          <v-btn
            v-if="item.status === 'failed'"
            icon="mdi-refresh"
            size="small"
            color="warning"
            :data-test="`retry-button-${item._id}`"
            :disabled="loading"
            @click="handleRetry(item)"
          />

          <!-- Delete button -->
          <v-btn
            icon="mdi-delete"
            size="small"
            color="error"
            :data-test="`delete-button-${item._id}`"
            :disabled="loading"
            @click="confirmDelete(item)"
          />
        </div>
      </template>

      <!-- Expanded row details -->
      <template v-slot:expanded-row="{ item, columns }">
        <tr>
          <td :colspan="columns.length">
            <v-card flat>
              <v-card-text>
                <!-- Filter details -->
                <div class="text-subtitle-2 mb-2">Applied filters</div>
                <div :data-test="`filter-details-${item._id}`" class="mb-4">
                  {{ formatFilters(item.filters) }}
                </div>

                <!-- Time details -->
                <div class="text-subtitle-2 mb-2">Time information</div>
                <div :data-test="`time-details-${item._id}`" class="mb-4">
                  <div><strong>Created:</strong> {{ formatDate(item.createdAt, true) }}</div>
                  <div v-if="item.completedAt">
                    <strong>Completed:</strong> {{ formatDate(item.completedAt, true) }}
                  </div>
                  <div v-if="item.failedAt">
                    <strong>Failed:</strong> {{ formatDate(item.failedAt, true) }}
                  </div>
                  <div v-if="item.completedAt || item.failedAt">
                    <strong>Duration:</strong> {{ calculateDuration(item) }}
                  </div>
                </div>

                <!-- Error details for failed exports -->
                <div v-if="item.status === 'failed' && item.error">
                  <div class="text-subtitle-2 mb-2">Error details</div>
                  <v-alert
                    type="error"
                    variant="tonal"
                    density="compact"
                    :data-test="`error-details-${item._id}`"
                    class="mb-4"
                  >
                    {{ item.error }}
                  </v-alert>
                </div>
              </v-card-text>
            </v-card>
          </td>
        </tr>
      </template>

      <!-- Pagination controls -->
      <template v-slot:bottom>
        <div class="d-flex justify-center" data-test="pagination">
          <v-pagination
            v-model="currentPage"
            :length="totalPages"
            @update:model-value="onPageChange"
          >
            <template v-slot:prev="slotProps">
              <v-btn
                v-bind="slotProps"
                data-test="prev-page"
              >
                <v-icon>mdi-chevron-left</v-icon>
              </v-btn>
            </template>
            <template v-slot:next="slotProps">
              <v-btn
                v-bind="slotProps"
                data-test="next-page"
              >
                <v-icon>mdi-chevron-right</v-icon>
              </v-btn>
            </template>
          </v-pagination>

          <v-select
            v-model="itemsPerPage"
            :items="itemsPerPageOptions"
            variant="outlined"
            density="compact"
            class="ml-4 max-w-24"
            hide-details
            data-test="items-per-page"
            @update:model-value="onItemsPerPageChange"
          >
            <template v-slot:item="{ item, props }">
              <v-list-item
                v-bind="props"
                :data-test="`option-${item.raw}`"
              >
                {{ item.raw }} per page
              </v-list-item>
            </template>
          </v-select>
        </div>
      </template>
    </v-data-table>

    <!-- Delete confirmation dialog -->
    <v-dialog
      v-model="deleteDialog.show"
      max-width="400"
      data-test="delete-confirmation-dialog"
    >
      <v-card>
        <v-card-title>Delete Export</v-card-title>
        <v-card-text>
          Are you sure you want to delete this export?
          <p class="mt-2">
            <strong>Type:</strong> {{ deleteDialog.item?.format?.toUpperCase() }}
            <br>
            <strong>Created:</strong> {{ deleteDialog.item?.createdAt ? formatDate(deleteDialog.item.createdAt) : '' }}
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            @click="deleteDialog.show = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            data-test="confirm-delete-button"
            @click="handleDelete"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useExportStore } from '../stores/exportStore'

// Store access
const exportStore = useExportStore()

// Reactive state
const currentPage = ref(1)
const itemsPerPage = ref(10)
const itemsPerPageOptions = [10, 25, 50]
const actionError = ref('')
const deleteDialog = ref({
  show: false,
  item: null
})
const filters = ref({
  format: null,
  status: null,
  dateFrom: '',
  dateTo: ''
})
const sortBy = ref('createdAt')
const sortOrder = ref('desc')

// Computed properties
const exportHistory = computed(() => {
  return exportStore.exportHistory || []
})

const loading = computed(() => exportStore.loading)

const error = computed(() => exportStore.error)

const totalItems = computed(() => {
  return exportStore.pagination?.total || 0
})

const totalPages = computed(() => {
  return exportStore.pagination?.pages || 1
})

const downloadProgress = computed(() => {
  return exportStore.downloadProgress || {}
})

// Table headers
const headers = [
  { title: 'Date', key: 'createdAt', sortable: true, align: 'start', data_test: 'table-header' },
  { title: 'Format', key: 'format', sortable: true, align: 'start', data_test: 'table-header' },
  { title: 'Status', key: 'status', sortable: true, align: 'center', data_test: 'table-header' },
  { title: 'Records', key: 'totalRecords', sortable: true, align: 'center', data_test: 'table-header' },
  { title: 'Size', key: 'fileSize', sortable: true, align: 'center', data_test: 'table-header' },
  { title: 'Actions', key: 'actions', sortable: false, align: 'center', data_test: 'table-header' }
]

// Fetch export history on component mount
onMounted(() => {
  fetchHistory()
})

// Methods
function fetchHistory() {
  const params = {
    page: currentPage.value,
    limit: itemsPerPage.value
  }

  // Add filters if they exist
  if (filters.value.format) params.format = filters.value.format
  if (filters.value.status) params.status = filters.value.status
  if (filters.value.dateFrom) params.dateFrom = filters.value.dateFrom
  if (filters.value.dateTo) params.dateTo = filters.value.dateTo

  // Add sorting parameters
  params.sortBy = sortBy.value
  params.sortOrder = sortOrder.value

  return exportStore.fetchExports(params)
}

function refreshHistory() {
  // Reset page to 1 when refreshing
  currentPage.value = 1
  return fetchHistory()
}

function onPageChange(page) {
  currentPage.value = page
  fetchHistory()
}

function onItemsPerPageChange(limit) {
  itemsPerPage.value = limit
  // Reset to first page when changing items per page
  currentPage.value = 1
  fetchHistory()
}

function applyFilters() {
  // Reset to first page when applying filters
  currentPage.value = 1
  fetchHistory()
}

function resetFilters() {
  filters.value = {
    format: null,
    status: null,
    dateFrom: '',
    dateTo: ''
  }
  currentPage.value = 1
  fetchHistory()
}

function toggleSort(field) {
  if (sortBy.value === field) {
    // Toggle sort direction if already sorting by this field
    sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
  } else {
    // Set new sort field with default desc order
    sortBy.value = field
    sortOrder.value = 'desc'
  }
  fetchHistory()
}

async function handleDownload(item) {
  try {
    actionError.value = ''
    await exportStore.downloadExport(item._id, item.filename)
  } catch (error) {
    actionError.value = `Download failed: ${error.message}`
    console.error('Download error:', error)
  }
}

function confirmDelete(item) {
  deleteDialog.value = {
    show: true,
    item
  }
}

async function handleDelete() {
  if (!deleteDialog.value.item) return
  
  try {
    actionError.value = ''
    await exportStore.deleteExport(deleteDialog.value.item._id)
    deleteDialog.value.show = false
    refreshHistory() // Refresh the list after deletion
  } catch (error) {
    actionError.value = `Delete failed: ${error.message}`
    console.error('Delete error:', error)
    deleteDialog.value.show = false
  }
}

async function handleRetry(item) {
  try {
    actionError.value = ''
    await exportStore.retryExport(item._id)
    refreshHistory() // Refresh the list after retry
  } catch (error) {
    actionError.value = `Retry failed: ${error.message}`
    console.error('Retry error:', error)
  }
}

// Format date for display
function formatDate(dateString, includeTime = false) {
  if (!dateString) return ''
  
  const date = new Date(dateString)
  const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit' }
  
  if (includeTime) {
    dateOptions.hour = '2-digit'
    dateOptions.minute = '2-digit'
    dateOptions.second = '2-digit'
  }
  
  return new Intl.DateTimeFormat('en-US', dateOptions).format(date)
}

// Format file size for display
function formatFileSize(bytes) {
  if (!bytes) return '-'
  
  if (bytes < 1024) {
    return `${bytes} B`
  } else if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)}KB`
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }
}

// Get color for status chip
function getStatusColor(status) {
  const colors = {
    completed: 'success',
    failed: 'error',
    processing: 'primary',
    pending: 'info'
  }
  return colors[status] || 'grey'
}

// Get icon for status chip
function getStatusIcon(status) {
  const icons = {
    completed: 'mdi-check-circle',
    failed: 'mdi-alert-circle',
    processing: 'mdi-sync',
    pending: 'mdi-clock-outline'
  }
  return icons[status] || 'mdi-help-circle'
}

// Format status for display
function formatStatus(status) {
  if (!status) return ''
  return status.charAt(0).toUpperCase() + status.slice(1)
}

// Format filters for display
function formatFilters(filters) {
  if (!filters || Object.keys(filters).length === 0) {
    return 'No filters applied'
  }
  
  const formattedFilters = []
  
  // Status filter
  if (filters.status && filters.status.length > 0) {
    formattedFilters.push(`Status: ${filters.status.join(', ')}`)
  }
  
  // Priority filter
  if (filters.priority && filters.priority.length > 0) {
    formattedFilters.push(`Priority: ${filters.priority.join(', ')}`)
  }
  
  // Assignee filter
  if (filters.assignee && filters.assignee.length > 0) {
    formattedFilters.push(`Assignee: ${filters.assignee.join(', ')}`)
  }
  
  // Date range filter
  if (filters.dateFrom || filters.dateTo) {
    const dateRange = []
    if (filters.dateFrom && filters.dateTo) {
      dateRange.push(`Date Range: ${filters.dateFrom} to ${filters.dateTo}`)
    } else if (filters.dateFrom) {
      dateRange.push(`Date From: ${filters.dateFrom}`)
    } else if (filters.dateTo) {
      dateRange.push(`Date To: ${filters.dateTo}`)
    }
    formattedFilters.push(dateRange.join(', '))
  }
  
  // Search filter
  if (filters.search) {
    formattedFilters.push(`Search: "${filters.search}"`)
  }
  
  // Tags filter
  if (filters.tags && filters.tags.length > 0) {
    formattedFilters.push(`Tags: ${filters.tags.join(', ')}`)
  }
  
  return formattedFilters.join('; ')
}

// Calculate duration between created and completed/failed time
function calculateDuration(item) {
  const startTime = new Date(item.createdAt).getTime()
  let endTime
  
  if (item.completedAt) {
    endTime = new Date(item.completedAt).getTime()
  } else if (item.failedAt) {
    endTime = new Date(item.failedAt).getTime()
  } else {
    return '-'
  }
  
  const durationMs = endTime - startTime
  const durationMinutes = Math.round(durationMs / 60000)
  
  if (durationMinutes < 1) {
    const durationSeconds = Math.round(durationMs / 1000)
    return `${durationSeconds} seconds`
  } else if (durationMinutes < 60) {
    return `${durationMinutes} minute${durationMinutes !== 1 ? 's' : ''}`
  } else {
    const hours = Math.floor(durationMinutes / 60)
    const minutes = durationMinutes % 60
    return `${hours} hour${hours !== 1 ? 's' : ''}${minutes > 0 ? ` ${minutes} minute${minutes !== 1 ? 's' : ''}` : ''}`
  }
}

// Expose methods for testing
defineExpose({
  formatDate,
  formatFileSize,
  getStatusColor,
  getStatusIcon,
  formatStatus,
  formatFilters,
  calculateDuration
})
</script>

<style scoped>
.gap-2 {
  gap: 8px;
}

.gap-4 {
  gap: 16px;
}

.max-w-24 {
  max-width: 96px;
}

.export-history-table :deep(tr[data-test="history-row"]) {
  cursor: pointer;
}

/* Rotating animation for processing status */
.rotating {
  animation: rotate 1.5s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>