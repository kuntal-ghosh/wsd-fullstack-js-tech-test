<!--
/**
 * @fileoverview Export dialog component for configuring and initiating task data exports
 * @component ExportDialog
 * @description Dialog component for exporting task data with format selection, filename customization,
 * filter summary display, and validation
 */
-->

<template>
  <v-dialog v-model="dialog" max-width="600" data-test="export-dialog">
    <v-card v-if="dialog" data-test="export-dialog-content">
      <v-card-title>Export Task Data</v-card-title>

      <v-card-text>
        <!-- Format Selection -->
        <v-radio-group
          v-model="exportFormat"
          label="Export Format"
          data-test="format-group"
        >
          <v-radio
            label="CSV (Comma Separated Values)"
            value="csv"
            data-test="format-csv"
          ></v-radio>
          <v-radio
            label="JSON (JavaScript Object Notation)"
            value="json"
            data-test="format-json"
          ></v-radio>
        </v-radio-group>

        <!-- Custom Filename -->
        <v-text-field
          v-model="customFilename"
          label="Custom Filename (optional)"
          hint="Leave empty for auto-generated filename"
          data-test="filename"
          :error-messages="validationErrors.filename"
          @update:model-value="handleFilenameChange"
        ></v-text-field>

        <!-- Export Summary -->
        <v-card variant="outlined" class="mt-4">
          <v-card-text>
            <div class="text-body-2 mb-2">
              <strong>Records to export:</strong>
              <span data-test="record-count">{{ recordCount }}</span>
            </div>
            <div class="text-body-2 mb-2">
              <strong>Applied filters:</strong>
              <span data-test="filter-summary">{{
                activeFiltersDescription
              }}</span>
            </div>
            <div class="text-body-2">
              <strong>Estimated size:</strong>
              <span data-test="estimated-size">{{ estimatedSize }}</span>
            </div>
          </v-card-text>
        </v-card>

        <!-- Error Message -->
        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          class="mt-4"
          data-test="error-message"
          icon="mdi-alert-circle"
          closable
          @click:close="error = null"
        >
          <div class="font-weight-bold">{{ errorTitle }}</div>
          <div>{{ error }}</div>
        </v-alert>

        <!-- Detailed Error Information -->
        <v-expand-transition>
          <div
            v-if="errorDetails && errorDetails.length > 0"
            class="mt-2"
            data-test="error-details"
          >
            <v-list density="compact" bg-color="error-lighten-5" rounded>
              <v-list-item v-for="(detail, index) in errorDetails" :key="index">
                <template #prepend>
                  <v-icon color="error" size="small"
                    >mdi-alert-circle-outline</v-icon
                  >
                </template>
                <v-list-item-subtitle>
                  {{ detail.field ? `${detail.field}: ` : ''
                  }}{{ detail.message }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </div>
        </v-expand-transition>

        <!-- Empty Dataset Warning -->
        <v-alert
          v-if="recordCount === 0"
          type="warning"
          variant="tonal"
          class="mt-4"
          data-test="empty-dataset-warning"
        >
          No records match the current filters. Please adjust your filters or
          select all records.
        </v-alert>
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn variant="text" data-test="cancel-button" @click="closeDialog">
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          :loading="exporting"
          :disabled="!canExport"
          data-test="start-export"
          @click="initiateExport"
        >
          Start Export
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useTaskStore } from '../stores/taskStore'
import { useExportStore } from '../stores/exportStore'

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  filters: {
    type: Object,
    required: true,
    default: () => ({})
  }
})

// Emits
const emit = defineEmits(['update:modelValue', 'export-created', 'cancel'])

// Store access
const taskStore = useTaskStore()
const exportStore = useExportStore()

// Reactive state
const exportFormat = ref('csv')
const customFilename = ref('')
const exporting = ref(false)
const error = ref(null)
const errorDetails = ref(null)
const errorCode = ref(null)
const validationErrors = ref({
  format: [],
  filename: []
})

// Two-way binding for dialog state
const dialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Computed properties
const recordCount = computed(() => {
  return taskStore.filteredTasks.length || taskStore.pagination?.total || 0
})

const canExport = computed(() => {
  return recordCount.value > 0 && !exporting.value
})

const errorTitle = computed(() => {
  if (!errorCode.value) return 'Export Error'

  switch (errorCode.value) {
    case 'VALIDATION_ERROR':
      return 'Validation Error'
    case 'FILE_ACCESS_DENIED':
      return 'File Permission Error'
    case 'EXPORT_NOT_READY':
      return 'Export Not Ready'
    case 'EXPORT_PROCESSING_ERROR':
      return 'Processing Failed'
    case 'EXPORT_FILE_NOT_FOUND':
      return 'File Not Found'
    case 'NETWORK_ERROR':
      return 'Network Error'
    default:
      return 'Export Error'
  }
})

const estimatedSize = computed(() => {
  const avgRecordSize = exportFormat.value === 'csv' ? 150 : 350 // Average bytes per record
  const totalBytes = recordCount.value * avgRecordSize

  if (totalBytes < 1024) {
    return `${totalBytes} B`
  } else if (totalBytes < 1024 * 1024) {
    return `${(totalBytes / 1024).toFixed(1)} KB`
  } else {
    return `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
  }
})

const activeFiltersDescription = computed(() => {
  const descriptions = []
  const filters = props.filters

  // Status filter
  if (filters.status && filters.status.length > 0) {
    descriptions.push(`Status: ${filters.status.join(', ')}`)
  }

  // Priority filter
  if (filters.priority && filters.priority.length > 0) {
    descriptions.push(`Priority: ${filters.priority.join(', ')}`)
  }

  // Assignee filter
  if (filters.assignee && filters.assignee.length > 0) {
    descriptions.push(`Assignee: ${filters.assignee.join(', ')}`)
  }

  // Date range filter
  if (filters.dateFrom || filters.dateTo) {
    const dateRange = []
    if (filters.dateFrom) dateRange.push(filters.dateFrom)
    if (filters.dateTo) dateRange.push('to', filters.dateTo)
    descriptions.push(`Date Range: ${dateRange.join(' ')}`)
  }

  // Search filter
  if (filters.search) {
    descriptions.push(`Search: "${filters.search}"`)
  }

  // Tags filter
  if (filters.tags && filters.tags.length > 0) {
    descriptions.push(`Tags: ${filters.tags.join(', ')}`)
  }

  return descriptions.length > 0
    ? descriptions.join('; ')
    : 'No filters applied'
})

// Methods
function closeDialog() {
  dialog.value = false
  emit('cancel')
}

function handleFilenameChange() {
  // Clear validation errors when input changes
  validationErrors.value.filename = []

  // Clear any existing error
  if (error.value) {
    error.value = null
    errorDetails.value = null
  }
}

function validateExportParams() {
  // Reset validation errors
  validationErrors.value = {
    format: [],
    filename: []
  }
  errorDetails.value = []

  let isValid = true

  // Validate format
  if (!['csv', 'json'].includes(exportFormat.value)) {
    validationErrors.value.format.push('Invalid export format')
    errorDetails.value.push({
      field: 'format',
      message: 'Please select a valid format (CSV or JSON)'
    })
    isValid = false
  }

  // Validate filename if provided
  if (customFilename.value) {
    // Check length
    if (customFilename.value.length > 255) {
      validationErrors.value.filename.push(
        'Filename is too long (max 255 characters)'
      )
      errorDetails.value.push({
        field: 'filename',
        message: 'Filename must be less than 255 characters'
      })
      isValid = false
    }

    // Check for invalid characters
    if (!/^[a-zA-Z0-9_\-. ]+$/.test(customFilename.value)) {
      validationErrors.value.filename.push(
        'Filename contains invalid characters'
      )
      errorDetails.value.push({
        field: 'filename',
        message:
          'Filename can only contain letters, numbers, spaces, underscores, hyphens, and periods'
      })
      isValid = false
    }
  }

  // Validate data availability
  if (recordCount.value === 0) {
    errorDetails.value.push({
      message: 'No data available to export with current filters'
    })
    isValid = false
  }

  if (!isValid) {
    error.value = 'Please correct the validation errors below'
    errorCode.value = 'VALIDATION_ERROR'
  }

  return isValid
}

function parseErrorResponse(err) {
  // Reset error state
  error.value = null
  errorDetails.value = []
  errorCode.value = null

  // Handle API error responses
  if (err.response) {
    const { data } = err.response

    // Use structured error from API if available
    if (data && !data.success) {
      error.value = data.message || 'Export operation failed'
      errorCode.value = data.code || 'EXPORT_ERROR'

      // Add detailed error information if available
      if (data.details) {
        errorDetails.value = Array.isArray(data.details)
          ? data.details
          : [data.details]
      }
      return
    }
  }

  // Handle network errors
  if (err.isAxiosError && !err.response) {
    error.value =
      'Unable to connect to the server. Please check your connection.'
    errorCode.value = 'NETWORK_ERROR'
    return
  }

  // Handle validation error objects
  if (err.name === 'ValidationError' && err.details) {
    error.value = 'Invalid export parameters'
    errorCode.value = 'VALIDATION_ERROR'
    errorDetails.value = err.details
    return
  }

  // Generic error fallback
  error.value = err.message || 'An unexpected error occurred'
  errorCode.value = err.code || 'UNKNOWN_ERROR'
}

async function initiateExport() {
  if (!canExport.value) return

  // Validate parameters
  if (!validateExportParams()) return

  error.value = null
  errorDetails.value = null
  errorCode.value = null
  exporting.value = true

  try {
    const exportParams = {
      format: exportFormat.value,
      filters: props.filters,
      filename: customFilename.value || undefined
    }

    const exportRecord = await exportStore.createExport(exportParams)

    emit('export-created', exportRecord)
    dialog.value = false
  } catch (err) {
    parseErrorResponse(err)
    console.error('Export failed:', err)
  } finally {
    exporting.value = false
  }
}

// Clear form on close
watch(
  () => props.modelValue,
  (value) => {
    if (!value) {
      // Reset form when dialog is closed
      exportFormat.value = 'csv'
      customFilename.value = ''
      error.value = null
      errorDetails.value = null
      errorCode.value = null
      validationErrors.value = { format: [], filename: [] }
    }
  }
)

// Expose methods for testing
defineExpose({
  validateExportParams,
  closeDialog,
  handleFilenameChange,
  initiateExport,
  parseErrorResponse,
  exportFormat,
  customFilename,
  validationErrors,
  error,
  errorDetails,
  errorCode,
  exporting,
  estimatedSize
})
</script>

<style scoped>
/* Component-specific styles */
.error-lighten-5 {
  background-color: rgba(244, 67, 54, 0.05);
}
</style>
