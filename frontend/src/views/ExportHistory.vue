<!--
/**
 * @fileoverview Export History page for viewing and managing export files
 * @component ExportHistory
 * @description Full-page view for export history with comprehensive filtering,
 * viewing, downloading, and deleting functionality
 */
-->

<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="page-title mr-4">Export History</h1>
      <v-chip
        v-if="exportStore.connected"
        color="success"
        variant="flat"
        size="small"
      >
        <v-icon start>mdi-wifi</v-icon>
        Live
      </v-chip>
      <v-chip v-else color="error" variant="flat" size="small">
        <v-icon start>mdi-wifi-off</v-icon>
        Offline
      </v-chip>
      <v-spacer></v-spacer>
      <v-btn
        color="primary"
        prepend-icon="mdi-file-export"
        @click="navigateToTasks"
      >
        Export Task
      </v-btn>
    </div>

    <!-- Export metrics summary -->
    <v-row class="mb-4">
      <v-col cols="12" md="3">
        <metric-card
          title="Total Exports"
          :value="exportMetrics.totalExports"
          icon="mdi-file-export"
          color="primary"
        />
      </v-col>
      <v-col cols="12" md="3">
        <metric-card
          title="Successful"
          :value="exportMetrics.successfulExports"
          icon="mdi-check-circle"
          color="success"
        />
      </v-col>
      <v-col cols="12" md="3">
        <metric-card
          title="Failed"
          :value="exportMetrics.failedExports"
          icon="mdi-alert-circle"
          color="error"
        />
      </v-col>
      <v-col cols="12" md="3">
        <metric-card
          title="Total Size"
          :value="formatTotalSize(exportMetrics.totalFileSize)"
          icon="mdi-harddisk"
          color="info"
        />
      </v-col>
    </v-row>

    <!-- Main export history component -->
    <v-row>
      <v-col cols="12">
        <export-history-component />
      </v-col>
    </v-row>

    <!-- Export dialog -->
    <export-dialog v-model="showExportDialog" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useExportStore } from '../stores/exportStore'
import MetricCard from '../components/MetricCard.vue'
import ExportHistoryComponent from '../components/ExportHistory.vue'
import ExportDialog from '../components/ExportDialog.vue'

// Store access
const exportStore = useExportStore()
const router = useRouter()

// Reactive state
const showExportDialog = ref(false)

// Computed properties for export metrics
const exportMetrics = computed(() => {
  const history = exportStore.exportHistory || []

  return {
    totalExports: history.length,
    successfulExports: history.filter((exp) => exp.status === 'completed')
      .length,
    failedExports: history.filter((exp) => exp.status === 'failed').length,
    totalFileSize: history
      .filter((exp) => exp.fileSize)
      .reduce((total, exp) => total + (exp.fileSize || 0), 0)
  }
})

// Methods
function navigateToTasks() {
  router.push('/')
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

// Lifecycle
onMounted(() => {
  // Fetch export history when the page loads
  exportStore.fetchExports({ page: 1, limit: 10 })
})
</script>

<style scoped>
.page-title {
  font-size: 2rem;
  font-weight: 300;
}
</style>
