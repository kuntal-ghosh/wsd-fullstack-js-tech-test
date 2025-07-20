<!--
/**
 * @fileoverview Enhanced Analytics view with comprehensive task metrics, visualizations, and export management
 * @component Analytics
 * @description Unified analytics dashboard showing task metrics, charts, completion rates,
 * export history, and real-time connection status with live data updates
 */
-->

<template>
  <div>
    <!-- Header Section with Connection Status -->
    <div class="d-flex align-center mb-4">
      <h1 class="page-title mr-4">Analytics Dashboard</h1>
      <v-chip
        v-if="analyticsStore.connected"
        color="success"
        variant="flat"
        size="small"
        data-test="connection-status"
      >
        <v-icon start>mdi-wifi</v-icon>
        Live
      </v-chip>
      <v-chip v-else color="error" variant="flat" size="small" data-test="connection-status">
        <v-icon start>mdi-wifi-off</v-icon>
        Offline
      </v-chip>
      <v-spacer></v-spacer>
      
      <!-- Quick Actions -->
      <div class="d-flex gap-2">
        <v-btn
          color="secondary"
          prepend-icon="mdi-refresh"
          variant="outlined"
          :loading="analyticsStore.loading || exportStore.loading"
          @click="refreshAllData"
          data-test="refresh-all-button"
        >
          Refresh
        </v-btn>
      </div>
    </div>

    <!-- Last Updated Info -->
    <div class="d-flex justify-end mb-4">
      <small v-if="analyticsStore.analytics.lastUpdated" class="text-grey">
        Analytics last updated:
        {{ formatLastUpdated(analyticsStore.analytics.lastUpdated) }}
      </small>
    </div>

    <!-- Task Analytics Metrics -->
    <v-row class="mb-6">
      <v-col cols="12">
        <h2 class="text-h5 mb-4 d-flex align-center">
          <v-icon class="mr-2" color="primary">mdi-chart-line</v-icon>
          Task Analytics
        </h2>
      </v-col>
      <v-col cols="12" md="4">
        <metric-card
          title="Average Completion Time"
          :value="formatCompletionTime(analyticsStore.analytics.averageCompletionTime)"
          icon="mdi-clock"
          color="info"
          data-test="avg-completion-metric"
        />
      </v-col>
      <v-col cols="12" md="4">
        <metric-card
          title="High Priority Tasks"
          :value="analyticsStore.analytics.tasksByPriority.high"
          icon="mdi-priority-high"
          color="error"
          data-test="high-priority-metric"
        />
      </v-col>
      <v-col cols="12" md="4">
        <metric-card
          title="In Progress Tasks"
          :value="analyticsStore.analytics.tasksByStatus['in-progress']"
          icon="mdi-progress-clock"
          color="warning"
          data-test="in-progress-metric"
        />
      </v-col>
    </v-row>

    <!-- Export Analytics Metrics -->
    <v-row class="mb-6">
      <v-col cols="12">
        <h2 class="text-h5 mb-4 d-flex align-center">
          <v-icon class="mr-2" color="secondary">mdi-file-export</v-icon>
          Export Analytics
          <v-chip
            v-if="exportStore.connected"
            color="success"
            variant="flat"
            size="small"
            class="ml-2"
          >
            <v-icon start size="small">mdi-wifi</v-icon>
            Live
          </v-chip>
        </h2>
      </v-col>
      <v-col cols="12" md="3">
        <metric-card
          title="Total Exports"
          :value="exportMetrics.totalExports"
          icon="mdi-file-export"
          color="primary"
          data-test="total-exports-metric"
        />
      </v-col>
      <v-col cols="12" md="3">
        <metric-card
          title="Successful"
          :value="exportMetrics.successfulExports"
          icon="mdi-check-circle"
          color="success"
          data-test="successful-exports-metric"
        />
      </v-col>
      <v-col cols="12" md="3">
        <metric-card
          title="Failed"
          :value="exportMetrics.failedExports"
          icon="mdi-alert-circle"
          color="error"
          data-test="failed-exports-metric"
        />
      </v-col>
      <v-col cols="12" md="3">
        <metric-card
          title="Total Size"
          :value="formatTotalSize(exportMetrics.totalFileSize)"
          icon="mdi-harddisk"
          color="info"
          data-test="total-size-metric"
        />
      </v-col>
    </v-row>

    <!-- Charts Section -->
    <v-row class="mb-6">
      <v-col cols="12">
        <h2 class="text-h5 mb-4 d-flex align-center">
          <v-icon class="mr-2" color="success">mdi-chart-pie</v-icon>
          Task Distribution
        </h2>
      </v-col>
      <v-col cols="12" md="6">
        <v-card class="chart-container equal-height-chart" data-test="status-chart">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">mdi-format-list-checks</v-icon>
            Status Distribution
          </v-card-title>
          <v-card-text>
            <task-status-chart
              :data="analyticsStore.statusData"
              :show-legend="true"
              :height="300"
            />
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="6">
        <v-card class="chart-container equal-height-chart" data-test="priority-chart">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">mdi-priority-high</v-icon>
            Priority Distribution
          </v-card-title>
          <v-card-text>
            <task-priority-chart
              :data="analyticsStore.priorityData"
              :show-legend="true"
              :height="300"
            />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Recent Activity and Summary Section -->
    <v-row class="mb-4">
      <v-col cols="12" lg="8">
        <v-card data-test="recent-activity-card">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">mdi-timeline</v-icon>
            Recent Activity
          </v-card-title>
          <v-card-text>
            <recent-activity :show-header="false" />
          </v-card-text>
        </v-card>
      </v-col>
      
      <!-- Quick Stats Sidebar -->
      <v-col cols="12" lg="4">
        <div class="d-flex flex-column gap-4">
          <!-- Task Summary Card -->
          <v-card data-test="task-summary-card">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2">mdi-clipboard-list</v-icon>
              Task Summary
            </v-card-title>
            <v-card-text>
              <v-list density="compact">
                <v-list-item data-test="pending-tasks-item">
                  <template #prepend>
                    <v-icon color="warning">mdi-clock-outline</v-icon>
                  </template>
                  <v-list-item-title>Pending Tasks</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ analyticsStore.analytics.tasksByStatus.pending }} tasks
                    waiting to be started
                  </v-list-item-subtitle>
                </v-list-item>
                <v-list-item data-test="in-progress-tasks-item">
                  <template #prepend>
                    <v-icon color="info">mdi-progress-clock</v-icon>
                  </template>
                  <v-list-item-title>In Progress</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ analyticsStore.analytics.tasksByStatus['in-progress'] }}
                    tasks currently being worked on
                  </v-list-item-subtitle>
                </v-list-item>
                <v-list-item data-test="completed-tasks-item">
                  <template #prepend>
                    <v-icon color="success">mdi-check-circle</v-icon>
                  </template>
                  <v-list-item-title>Completed</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ analyticsStore.analytics.tasksByStatus.completed }} tasks
                    finished
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>

          <!-- Priority Breakdown Card -->
          <v-card data-test="priority-breakdown-card">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2">mdi-priority-high</v-icon>
              Priority Breakdown
            </v-card-title>
            <v-card-text>
              <v-list density="compact">
                <v-list-item data-test="low-priority-item">
                  <template #prepend>
                    <v-icon color="success">mdi-arrow-down</v-icon>
                  </template>
                  <v-list-item-title>Low Priority</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ analyticsStore.analytics.tasksByPriority.low }} tasks
                  </v-list-item-subtitle>
                </v-list-item>
                <v-list-item data-test="medium-priority-item">
                  <template #prepend>
                    <v-icon color="warning">mdi-minus</v-icon>
                  </template>
                  <v-list-item-title>Medium Priority</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ analyticsStore.analytics.tasksByPriority.medium }} tasks
                  </v-list-item-subtitle>
                </v-list-item>
                <v-list-item data-test="high-priority-item">
                  <template #prepend>
                    <v-icon color="error">mdi-arrow-up</v-icon>
                  </template>
                  <v-list-item-title>High Priority</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ analyticsStore.analytics.tasksByPriority.high }} tasks
                    requiring immediate attention
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>

          <!-- Export Quick Actions Card -->
          <v-card data-test="export-quick-actions-card">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2">mdi-lightning-bolt</v-icon>
              Quick Export Actions
            </v-card-title>
            <v-card-text>
              <div class="d-flex flex-column gap-2">
                <v-btn
                  color="primary"
                  prepend-icon="mdi-file-delimited"
                  variant="outlined"
                  block
                  @click="quickExportCSV"
                  data-test="quick-export-csv-button"
                >
                  Export All as CSV
                </v-btn>
                <v-btn
                  color="secondary"
                  prepend-icon="mdi-code-json"
                  variant="outlined"
                  block
                  @click="quickExportJSON"
                  data-test="quick-export-json-button"
                >
                  Export All as JSON
                </v-btn>
                <v-btn
                  color="success"
                  prepend-icon="mdi-check-circle"
                  variant="outlined"
                  block
                  @click="exportCompletedTasks"
                  data-test="export-completed-button"
                >
                  Export Completed Only
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </div>
      </v-col>
    </v-row>

    <!-- Export History Section -->
    <v-row class="mb-6">
      <v-col cols="12">
        <div class="d-flex align-center justify-space-between mb-4">
          <h2 class="text-h5 d-flex align-center">
            <v-icon class="mr-2" color="warning">mdi-history</v-icon>
            Export History
          </h2>
          <div class="d-flex gap-2">
            <v-btn
              color="secondary"
              prepend-icon="mdi-refresh"
              variant="outlined"
              size="small"
              :loading="exportStore.loading"
              @click="refreshExportHistory"
              data-test="refresh-export-history-button"
            >
              Refresh
            </v-btn>
          </div>
        </div>
        
        <!-- Export History Component -->
        <export-history-component 
          @show-export-dialog="showExportDialog = true" 
        />
      </v-col>
    </v-row>

    <!-- Export Dialog -->
    <export-dialog 
      v-model="showExportDialog" 
      :filters="{}"
      @export-created="handleExportCreated"
      data-test="export-dialog"
    />

    <!-- Success Snackbar -->
    <v-snackbar
      v-model="showSuccessMessage"
      color="success"
      timeout="4000"
      location="top right"
      data-test="success-snackbar"
    >
      <div class="d-flex align-center">
        <v-icon class="mr-2">mdi-check-circle</v-icon>
        {{ successMessage }}
      </div>
      <template #actions>
        <v-btn
          variant="text"
          @click="showSuccessMessage = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>

    <!-- Error Snackbar -->
    <v-snackbar
      v-model="showErrorMessage"
      color="error"
      timeout="6000"
      location="top right"
      data-test="error-snackbar"
    >
      <div class="d-flex align-center">
        <v-icon class="mr-2">mdi-alert-circle</v-icon>
        {{ errorMessage }}
      </div>
      <template #actions>
        <v-btn
          variant="text"
          @click="showErrorMessage = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAnalyticsStore } from '../stores/analyticsStore.js'
import { useExportStore } from '../stores/exportStore'
import MetricCard from '../components/MetricCard.vue'
import TaskStatusChart from '../components/TaskStatusChart.vue'
import TaskPriorityChart from '../components/TaskPriorityChart.vue'
import RecentActivity from '../components/RecentActivity.vue'
import ExportHistoryComponent from '../components/ExportHistory.vue'
import ExportDialog from '../components/ExportDialog.vue'

// Store access
const analyticsStore = useAnalyticsStore()
const exportStore = useExportStore()

// Reactive state
const showExportDialog = ref(false)
const showSuccessMessage = ref(false)
const showErrorMessage = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

// Computed properties for export metrics
const exportMetrics = computed(() => {
  const history = exportStore.exportHistory || []

  return {
    totalExports: history.length,
    successfulExports: history.filter((exp) => exp.status === 'completed').length,
    failedExports: history.filter((exp) => exp.status === 'failed').length,
    totalFileSize: history
      .filter((exp) => exp.fileSize)
      .reduce((total, exp) => total + (exp.fileSize || 0), 0)
  }
})

// Lifecycle hooks
onMounted(async () => {
  try {
    // Load both analytics and export data
    await Promise.all([
      analyticsStore.fetchAnalytics(),
      exportStore.fetchExports({ page: 1, limit: 10 })
    ])
  } catch (error) {
    console.error('Failed to load initial data:', error)
    showError('Failed to load dashboard data. Please refresh the page.')
  }
})

// Methods
async function refreshAllData() {
  try {
    await Promise.all([
      analyticsStore.fetchAnalytics(),
      exportStore.fetchExports({ page: 1, limit: 10 })
    ])
    showSuccess('Dashboard data refreshed successfully')
  } catch (error) {
    console.error('Failed to refresh data:', error)
    showError('Failed to refresh data. Please try again.')
  }
}

async function refreshExportHistory() {
  try {
    await exportStore.fetchExports({ page: 1, limit: 10 })
    showSuccess('Export history refreshed')
  } catch (error) {
    console.error('Failed to refresh export history:', error)
    showError('Failed to refresh export history')
  }
}

async function quickExportCSV() {
  try {
    const exportRecord = await exportStore.createExport({
      format: 'csv',
      filters: {},
      filename: null
    })
    showSuccess('CSV export started successfully')
    handleExportCreated(exportRecord)
  } catch (error) {
    console.error('Quick CSV export failed:', error)
    showError('Failed to start CSV export. Please try again.')
  }
}

async function quickExportJSON() {
  try {
    const exportRecord = await exportStore.createExport({
      format: 'json',
      filters: {},
      filename: null
    })
    showSuccess('JSON export started successfully')
    handleExportCreated(exportRecord)
  } catch (error) {
    console.error('Quick JSON export failed:', error)
    showError('Failed to start JSON export. Please try again.')
  }
}

async function exportCompletedTasks() {
  try {
    const exportRecord = await exportStore.createExport({
      format: 'csv',
      filters: { status: ['completed'] },
      filename: null
    })
    showSuccess('Completed tasks export started successfully')
    handleExportCreated(exportRecord)
  } catch (error) {
    console.error('Completed tasks export failed:', error)
    showError('Failed to start completed tasks export. Please try again.')
  }
}

function handleExportCreated(exportRecord) {
  // Close dialog if open
  showExportDialog.value = false
  
  // Refresh export history to show the new export
  refreshExportHistory()
  
  // Show success message with export ID
  showSuccess(`Export ${exportRecord.id} created successfully and is being processed`)
}

function showSuccess(message) {
  successMessage.value = message
  showSuccessMessage.value = true
}

function showError(message) {
  errorMessage.value = message
  showErrorMessage.value = true
}

function formatLastUpdated(timestamp) {
  const now = new Date()
  const updated = new Date(timestamp)
  const diffInSeconds = Math.floor((now - updated) / 1000)

  if (diffInSeconds < 10) {
    return 'just now'
  } else if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes}m ago`
  } else {
    return updated.toLocaleTimeString()
  }
}

function formatCompletionTime(hours) {
  if (!hours || hours <= 0) {
    return 'N/A'
  }

  if (hours < 1) {
    const minutes = Math.round(hours * 60)
    return `${minutes}m`
  } else if (hours < 24) {
    return `${hours}h`
  } else {
    const days = Math.round((hours / 24) * 10) / 10
    return `${days}d`
  }
}

function formatTotalSize(bytes) {
  if (!bytes || bytes === 0) return '0 B'

  if (bytes < 1024) {
    return `${bytes} B`
  } else if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }
}
</script>

<style scoped>
.page-title {
  font-size: 2.5rem;
  font-weight: 300;
  color: rgb(var(--v-theme-primary));
}

.equal-height-chart {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.equal-height-chart .v-card-text {
  flex: 1;
  display: flex;
  align-items: center;
}

.gap-2 {
  gap: 8px;
}

.gap-4 {
  gap: 16px;
}

/* Enhanced Card Styling */
.v-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 12px;
  border: 1px solid rgba(var(--v-theme-outline), 0.1);
}

.v-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12) !important;
}

/* Section Headers */
.text-h5 {
  font-weight: 600;
  letter-spacing: -0.02em;
}

/* Metric Cards Enhancement */
.metric-card-container {
  transition: transform 0.2s ease-in-out;
}

.metric-card-container:hover {
  transform: scale(1.02);
}

/* Button Enhancements */
.v-btn {
  border-radius: 8px;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0.02em;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.v-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Chart Container Styling */
.chart-container {
  background: linear-gradient(135deg, rgba(var(--v-theme-surface), 0.8) 0%, rgba(var(--v-theme-surface-bright), 0.9) 100%);
  backdrop-filter: blur(10px);
}

.chart-container .v-card-title {
  background: rgba(var(--v-theme-primary), 0.05);
  border-bottom: 1px solid rgba(var(--v-theme-outline), 0.1);
  font-weight: 600;
}

/* List Item Enhancements */
.v-list-item {
  border-radius: 8px;
  margin-bottom: 4px;
  transition: background-color 0.2s ease;
}

.v-list-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.05);
}

/* Chip Styling */
.v-chip {
  font-weight: 500;
  border-radius: 12px;
}

/* Snackbar Styling */
.v-snackbar :deep(.v-snackbar__wrapper) {
  border-radius: 12px;
  backdrop-filter: blur(10px);
}

/* Responsive Design */
@media (max-width: 960px) {
  .page-title {
    font-size: 2rem;
  }
  
  .d-flex.gap-2 {
    flex-direction: column;
    gap: 8px;
  }
  
  .equal-height-chart {
    height: auto;
  }
}

@media (max-width: 600px) {
  .page-title {
    font-size: 1.75rem;
  }
  
  .v-row .v-col {
    padding: 8px;
  }
}

/* Loading States */
.v-btn[loading] {
  pointer-events: none;
}

/* Enhanced Animation */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.v-card {
  animation: fadeInUp 0.4s ease-out;
}

/* Export Quick Actions Styling */
.export-quick-actions-card .v-btn {
  margin-bottom: 8px;
}

.export-quick-actions-card .v-btn:last-child {
  margin-bottom: 0;
}

/* Enhanced Theme Support */
.v-theme--dark .chart-container {
  background: linear-gradient(135deg, rgba(var(--v-theme-surface), 0.9) 0%, rgba(var(--v-theme-surface-bright), 0.95) 100%);
}

.v-theme--light .chart-container {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(var(--v-theme-surface-bright), 0.9) 100%);
}
</style>
