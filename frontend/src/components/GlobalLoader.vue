<!--
/**
 * @fileoverview Global loader overlay component for download operations
 * @component GlobalLoader
 * @description Overlay component that shows during file downloads with progress indication
 */
-->

<template>
  <v-overlay
    v-model="showLoader"
    class="d-flex align-center justify-center"
    persistent
    :scrim="true"
    opacity="0.8"
    data-test="global-loader-overlay"
  >
    <v-card
      class="loader-card pa-6 text-center"
      elevation="12"
      rounded="lg"
      min-width="300"
      max-width="400"
      data-test="global-loader-card"
    >
      <v-card-text>
        <!-- Loader Icon -->
        <div class="mb-4">
          <v-icon
            size="48"
            color="primary"
            class="loader-icon"
            data-test="loader-icon"
          >
            mdi-download
          </v-icon>
        </div>

        <!-- Title -->
        <h3 class="text-h6 mb-3" data-test="loader-title">
          {{ currentDownload.title }}
        </h3>

        <!-- Progress Bar -->
        <v-progress-linear
          v-if="currentDownload.progress !== undefined"
          :model-value="currentDownload.progress"
          height="8"
          color="primary"
          class="mb-3"
          rounded
          data-test="progress-bar"
        />

        <!-- Indeterminate progress for unknown progress -->
        <v-progress-linear
          v-else
          indeterminate
          height="8"
          color="primary"
          class="mb-3"
          rounded
          data-test="progress-bar-indeterminate"
        />

        <!-- Progress Details -->
        <div
          class="text-body-2 text-medium-emphasis mb-4"
          data-test="progress-details"
        >
          <div v-if="currentDownload.progress !== undefined">
            {{ Math.round(currentDownload.progress) }}% completed
          </div>
          <div
            v-if="currentDownload.receivedLength && currentDownload.totalLength"
          >
            {{ formatBytes(currentDownload.receivedLength) }} /
            {{ formatBytes(currentDownload.totalLength) }}
          </div>
          <div v-else-if="currentDownload.receivedLength">
            {{ formatBytes(currentDownload.receivedLength) }} downloaded
          </div>
          <div v-else>Preparing download...</div>
        </div>

        <!-- Status Message -->
        <div class="text-body-2 text-primary" data-test="status-message">
          {{ currentDownload.message }}
        </div>
      </v-card-text>
    </v-card>
  </v-overlay>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useExportStore } from '../stores/exportStore.js'

const exportStore = useExportStore()

// Reactive state
const showLoader = ref(false)

// Computed properties
const activeDownloads = computed(() => {
  const downloads = exportStore.downloadProgress
  return Object.keys(downloads).filter((id) => downloads[id]?.downloading)
})

const currentDownload = computed(() => {
  if (activeDownloads.value.length === 0) {
    return {
      title: 'Download Complete',
      message: 'File downloaded successfully',
      progress: 100
    }
  }

  const activeId = activeDownloads.value[0] // Show first active download
  const downloadInfo = exportStore.downloadProgress[activeId]

  return {
    title: 'Downloading File...',
    message: downloadInfo?.error
      ? 'Download failed, please try again'
      : activeDownloads.value.length > 1
        ? `${activeDownloads.value.length} downloads in progress`
        : 'Please wait while your file downloads',
    progress: downloadInfo?.progress,
    receivedLength: downloadInfo?.receivedLength,
    totalLength: downloadInfo?.totalLength,
    error: downloadInfo?.error
  }
})

// Utility functions
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Watch for download status changes
watch(
  activeDownloads,
  (newDownloads) => {
    showLoader.value = newDownloads.length > 0
  },
  { immediate: true }
)

// Watch for download progress changes to update UI
watch(
  () => exportStore.downloadProgress,
  (newProgress) => {
    // Force reactivity update for progress changes
    const hasActiveDownloads = Object.keys(newProgress).some(
      (id) => newProgress[id]?.downloading
    )
    showLoader.value = hasActiveDownloads
  },
  { deep: true, immediate: true }
)

onMounted(() => {
  // Ensure export store socket listeners are initialized
  if (!exportStore.exports) {
    exportStore.initializeSocketListeners()
  }
})
</script>

<style scoped>
.loader-card {
  backdrop-filter: blur(10px);
  background-color: rgba(var(--v-theme-surface), 0.95) !important;
}

.loader-icon {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.7;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* Dark theme support */
.v-theme--dark .loader-card {
  background-color: rgba(var(--v-theme-surface), 0.95) !important;
}
</style>
