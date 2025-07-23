<!--
  @fileoverview Example component demonstrating toast notifications
  @component ToastDemo
-->
<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title>Toast Notification Demo</v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <h3>Basic Toast Types</h3>
                <v-btn
                  color="success"
                  variant="elevated"
                  class="ma-2"
                  @click="showSuccessToast"
                >
                  Success Toast
                </v-btn>

                <v-btn
                  color="error"
                  variant="elevated"
                  class="ma-2"
                  @click="showErrorToast"
                >
                  Error Toast
                </v-btn>

                <v-btn
                  color="warning"
                  variant="elevated"
                  class="ma-2"
                  @click="showWarningToast"
                >
                  Warning Toast
                </v-btn>

                <v-btn
                  color="info"
                  variant="elevated"
                  class="ma-2"
                  @click="showInfoToast"
                >
                  Info Toast
                </v-btn>
              </v-col>

              <v-col cols="12" md="6">
                <h3>Export Status Simulation</h3>
                <v-btn
                  color="orange"
                  variant="elevated"
                  class="ma-2"
                  :loading="simulatingStatus"
                  @click="simulateStatusFlow"
                >
                  Simulate Status Changes
                </v-btn>

                <v-btn
                  color="blue"
                  variant="elevated"
                  class="ma-2"
                  @click="showPendingStatus"
                >
                  Pending Status
                </v-btn>

                <v-btn
                  color="purple"
                  variant="elevated"
                  class="ma-2"
                  @click="showProcessingStatus"
                >
                  Processing Status
                </v-btn>

                <v-btn
                  color="green"
                  variant="elevated"
                  class="ma-2"
                  @click="showCompletedStatus"
                >
                  Completed Status
                </v-btn>

                <v-btn
                  color="red"
                  variant="elevated"
                  class="ma-2"
                  @click="showFailedStatus"
                >
                  Failed Status
                </v-btn>

                <v-divider class="my-4" />

                <v-btn
                  color="error"
                  variant="outlined"
                  class="ma-2"
                  @click="clearAllToasts"
                >
                  Clear All Toasts
                </v-btn>

                <v-btn
                  color="primary"
                  variant="outlined"
                  class="ma-2"
                  :loading="simulatingExport"
                  @click="simulateExportFlow"
                >
                  Full Export Flow
                </v-btn>

                <v-btn
                  color="secondary"
                  variant="outlined"
                  class="ma-2"
                  :loading="simulatingDownload"
                  @click="simulateDownloadFlow"
                >
                  Download Flow
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
/**
 * Demo component for testing toast notifications
 *
 * This component provides buttons to test different types of toast notifications
 * and simulates the export/download flow to demonstrate real-world usage.
 */

import { ref } from 'vue'
import { useToastStore } from '@/stores/toastStore.js'
import { useExportStore } from '@/stores/exportStore.js'

// Stores
const toastStore = useToastStore()
const exportStore = useExportStore()

// State
const simulatingExport = ref(false)
const simulatingDownload = ref(false)
const simulatingStatus = ref(false)

// Methods
function showSuccessToast() {
  toastStore.showSuccess('Operation completed successfully!')
}

function showErrorToast() {
  toastStore.showError('Something went wrong. Please try again.')
}

function showWarningToast() {
  toastStore.showWarning('This action cannot be undone. Are you sure?', {})
}

function showInfoToast() {
  toastStore.showInfo(
    'Did you know you can export your data in multiple formats?',
    {
      timeout: 6000
    }
  )
}

async function simulateExportFlow() {
  simulatingExport.value = true

  // Step 1: Export creation
  toastStore.showSuccess('Export request created successfully! Format: CSV', {
    timeout: 3000
  })

  // Wait 2 seconds
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // Step 2: Export completion
  toastStore.showSuccess(
    'Export "tasks-export.csv" completed! File size: 2.4 MB',
    {
      timeout: 6000
    }
  )

  simulatingExport.value = false
}

async function simulateDownloadFlow() {
  simulatingDownload.value = true

  // Step 1: Starting download
  const _downloadToastId = toastStore.showInfo(
    'Starting download of tasks-export.csv...',
    {
      timeout: 2000
    }
  )

  // Wait 1 second
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Step 2: Progress update (for large files)
  const progressToastId = toastStore.showInfo('Downloading... 50%', {
    persistent: true
  })

  // Wait 2 seconds
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // Step 3: Download completed
  toastStore.hideToast(progressToastId)
  toastStore.showSuccess('Download completed successfully!', {
    timeout: 5000
  })

  simulatingDownload.value = false
}

function clearAllToasts() {
  toastStore.clearAllToasts()
}

// Status-specific toast demonstrations
function showPendingStatus() {
  exportStore.showStatusToast(
    toastStore,
    'pending',
    'sample-export.csv',
    'demo-export-123',
    { estimatedTime: '2-3 minutes' }
  )
}

function showProcessingStatus() {
  exportStore.showStatusToast(
    toastStore,
    'processing',
    'tasks-data.json',
    'demo-export-456',
    {
      estimatedTime: '1 minute',
      recordCount: 1500,
      startedAt: new Date().toISOString()
    }
  )
}

function showCompletedStatus() {
  exportStore.showStatusToast(
    toastStore,
    'completed',
    'user-tasks.csv',
    'demo-export-789',
    {
      fileSize: 2048576, // 2MB
      recordCount: 2500,
      completedAt: new Date().toISOString()
    }
  )
}

function showFailedStatus() {
  exportStore.showStatusToast(
    toastStore,
    'failed',
    'large-dataset.json',
    'demo-export-error',
    {
      error: 'Database connection timeout',
      canRetry: true,
      failedAt: new Date().toISOString()
    }
  )
}

async function simulateStatusFlow() {
  simulatingStatus.value = true

  // Step 1: Pending
  showPendingStatus()
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // Step 2: Processing
  showProcessingStatus()
  await new Promise((resolve) => setTimeout(resolve, 3000))

  // Step 3: Randomly choose completed or failed
  const success = Math.random() > 0.3 // 70% success rate

  if (success) {
    showCompletedStatus()
  } else {
    showFailedStatus()
  }

  simulatingStatus.value = false
}
</script>

<style scoped>
.v-btn {
  text-transform: none;
}
</style>
