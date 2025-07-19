<!--
/**
 * @fileoverview Export progress component for displaying export status, progress tracking, and actions
 * @component ExportProgress
 * @description Displays export progress with real-time updates, status indicators, and action buttons
 */
-->

<template>
  <v-card class="export-progress">
    <v-card-text>
      <div class="d-flex align-center">
        <!-- Format and filename -->
        <div class="flex-grow-1">
          <div class="d-flex justify-space-between align-center mb-2">
            <div>
              <span class="text-subtitle-2 font-weight-bold" data-test="export-format">
                {{ exportData ? exportData.format.toUpperCase() : 'EXPORT' }}
              </span>
              <span class="text-body-2 ml-2" data-test="export-filename">
                {{ exportData ? exportData.filename : '' }}
              </span>
            </div>
            <v-chip
              size="small"
              :color="getStatusColor(exportData?.status)"
              data-test="status-chip"
              class="text-capitalize"
            >
              <v-icon
                size="small"
                :class="{'rotating': exportData?.status === 'processing'}"
                class="mr-1"
                data-test="status-icon"
              >
                {{ getStatusIcon(exportData?.status) }}
              </v-icon>
              {{ exportData?.status }}
            </v-chip>
          </div>
        
          <!-- Progress bar -->
          <v-progress-linear
            :model-value="exportData?.progress || 0"
            height="8"
            :color="getStatusColor(exportData?.status)"
            class="mb-1"
            data-test="progress-bar"
          ></v-progress-linear>
          
          <div class="d-flex justify-space-between">
            <span class="text-caption" data-test="status-text">
              {{ getStatusText(exportData?.status) }}
            </span>
            <span class="text-caption" data-test="progress-text">
              {{ exportData?.progress || 0 }}%
            </span>
          </div>
          
          <!-- Metadata text -->
          <div class="text-caption mt-1" data-test="export-metadata">
            {{ getMetadataText() }}
          </div>
          
          <!-- Error message -->
          <div v-if="exportData?.status === 'failed' && exportData?.error" class="mt-2">
            <v-alert
              type="error"
              variant="tonal"
              density="compact"
              data-test="error-message"
              class="text-caption py-1 mb-0"
            >
              {{ exportData.error }}
            </v-alert>
          </div>
          
          <!-- Download error message -->
          <div v-if="exportData?.status === 'completed' && downloadError" class="mt-2">
            <v-alert
              type="error"
              variant="tonal"
              density="compact"
              data-test="download-error"
              class="text-caption py-1 mb-0"
            >
              {{ downloadError }}
            </v-alert>
          </div>
          
          <!-- Download progress -->
          <div v-if="isDownloading" class="mt-2">
            <div class="d-flex justify-space-between align-center">
              <span class="text-caption">Downloading...</span>
              <span class="text-caption" data-test="download-progress">
                {{ downloadProgress?.progress }}%
              </span>
            </div>
            <v-progress-linear
              :model-value="downloadProgress?.progress || 0"
              height="4"
              color="info"
              class="mt-1"
            ></v-progress-linear>
          </div>
        </div>
        
        <!-- Action buttons -->
        <div class="ml-3" v-if="showActions">
          <!-- Download button for completed exports -->
          <v-btn
            v-if="exportData?.status === 'completed'"
            icon="mdi-download"
            size="small"
            color="primary"
            variant="text"
            data-test="download-button"
            :disabled="isDownloading"
            @click="handleDownload"
          ></v-btn>
          
          <!-- Retry button for failed exports -->
          <v-btn
            v-else-if="exportData?.status === 'failed'"
            icon="mdi-refresh"
            size="small"
            color="warning"
            variant="text"
            data-test="retry-button"
            @click="handleRetry"
          ></v-btn>
          
          <!-- Cancel button for processing exports -->
          <v-btn
            v-else-if="exportData?.status === 'processing'"
            icon="mdi-close"
            size="small"
            color="error"
            variant="text"
            data-test="cancel-button"
            @click="handleCancel"
          ></v-btn>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { computed, watch, onMounted } from 'vue'
import { useExportStore } from '../stores/exportStore'

// Props
const props = defineProps({
  exportId: {
    type: String,
    required: true
  },
  exportData: {
    type: Object,
    default: () => null
  },
  showActions: {
    type: Boolean,
    default: true
  }
})

// Emits
const emit = defineEmits(['cancel', 'retry', 'download', 'error'])

// Store
const exportStore = useExportStore()

// Computed properties
const downloadProgress = computed(() => {
  return exportStore.downloadProgress[props.exportId] || null
})

const isDownloading = computed(() => {
  return downloadProgress.value && downloadProgress.value.downloading === true
})

const downloadError = computed(() => {
  return downloadProgress.value?.error || null
})

// Methods
function getStatusText(status) {
  switch (status) {
    case 'processing':
      return 'Processing export...'
    case 'completed':
      return 'Export completed'
    case 'failed':
      return 'Export failed'
    case 'cancelled':
      return 'Export cancelled'
    default:
      return 'Waiting to start...'
  }
}

function getStatusColor(status) {
  switch (status) {
    case 'processing':
      return 'primary'
    case 'completed':
      return 'success'
    case 'failed':
      return 'error'
    case 'cancelled':
      return 'grey'
    default:
      return 'grey'
  }
}

function getStatusIcon(status) {
  switch (status) {
    case 'processing':
      return 'mdi-sync'
    case 'completed':
      return 'mdi-check'
    case 'failed':
      return 'mdi-alert'
    case 'cancelled':
      return 'mdi-cancel'
    default:
      return 'mdi-dots-horizontal'
  }
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function getMetadataText() {
  const parts = []
  
  if (props.exportData?.totalRecords) {
    parts.push(`${props.exportData.totalRecords} records`)
  }
  
  if (props.exportData?.fileSize) {
    parts.push(formatFileSize(props.exportData.fileSize))
  }
  
  return parts.join(' • ') || 'Processing...'
}

async function handleDownload() {
  try {
    if (!props.exportData?.filename) return
    
    await exportStore.downloadExport(props.exportId, props.exportData.filename)
    emit('download', props.exportId)
  } catch (err) {
    console.error('Download error:', err)
    // Error is already tracked in the store
  }
}

async function handleRetry() {
  try {
    await exportStore.retryExport(props.exportId)
    emit('retry', props.exportId)
  } catch (err) {
    console.error('Retry error:', err)
  }
}

async function handleCancel() {
  try {
    await exportStore.cancelExport(props.exportId)
    emit('cancel', props.exportId)
  } catch (err) {
    console.error('Cancel error:', err)
  }
}

// Watch for error state to emit error event
watch(() => props.exportData?.status, (newStatus) => {
  if (newStatus === 'failed' && props.exportData?.error) {
    emit('error', {
      exportId: props.exportId,
      error: props.exportData.error
    })
  }
}, { immediate: true })

// Expose methods for testing
defineExpose({
  getStatusColor,
  getStatusIcon,
  getStatusText,
  formatFileSize
})
</script>

<style scoped>
.export-progress {
  margin-bottom: 12px;
}

.rotating {
  animation: rotate 1.5s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>