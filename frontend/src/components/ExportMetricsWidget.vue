<template>
  <v-card class="export-metrics-widget">
    <v-card-title class="d-flex align-center">
      <v-icon color="primary" class="mr-2">mdi-file-export</v-icon>
      Export Metrics
    </v-card-title>

    <v-card-text>
      <v-row>
        <v-col cols="6" sm="3">
          <div class="metric-value">{{ activeExports }}</div>
          <div class="metric-label">Active Exports</div>
        </v-col>

        <v-col cols="6" sm="3">
          <div class="metric-value">{{ exportsCreatedToday }}</div>
          <div class="metric-label">Created Today</div>
        </v-col>

        <v-col cols="6" sm="3">
          <div
            class="metric-value"
            :class="{ 'success-rate-warning': showSuccessRateWarning }"
          >
            {{ exportSuccessRate }}
            <v-icon v-if="showSuccessRateWarning" color="warning" small
              >mdi-alert</v-icon
            >
          </div>
          <div class="metric-label">Success Rate</div>
        </v-col>

        <v-col cols="6" sm="3">
          <div class="metric-value most-popular-format">
            {{ mostPopularFormat }}
          </div>
          <div class="metric-label">Most Used Format</div>
        </v-col>
      </v-row>

      <v-divider class="my-3"></v-divider>

      <v-row>
        <v-col cols="6">
          <div class="metric-value-secondary">{{ averageExportSize }}</div>
          <div class="metric-label">Average Size</div>
        </v-col>

        <v-col cols="6">
          <div class="metric-value-secondary">{{ averageExportTime }}</div>
          <div class="metric-label">Average Time</div>
        </v-col>
      </v-row>

      <v-divider class="my-3"></v-divider>

      <v-row>
        <v-col cols="12">
          <div class="export-format-distribution">
            <div class="format-stats d-flex justify-space-around">
              <div class="format-item">
                <div class="format-count">{{ exportsByFormat.csv }}</div>
                <div class="format-name">CSV</div>
              </div>
              <div class="format-item">
                <div class="format-count">{{ exportsByFormat.json }}</div>
                <div class="format-name">JSON</div>
              </div>
            </div>
          </div>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { computed } from 'vue'
import { useAnalyticsStore } from '../stores/analyticsStore'

const analyticsStore = useAnalyticsStore()

// Success rate threshold - show warning below this value
const SUCCESS_RATE_THRESHOLD = 75

// Active exports count
const activeExports = computed(() => {
  return analyticsStore.analytics.exportMetrics?.activeExports ?? 0
})

// Exports created today
const exportsCreatedToday = computed(() => {
  return analyticsStore.analytics.exportMetrics?.exportsCreatedToday ?? 0
})

// Export success rate with % symbol
const exportSuccessRate = computed(() => {
  const rate = analyticsStore.analytics.exportMetrics?.exportSuccessRate ?? 0
  return `${rate}%`
})

// Average export size formatted as KB
const averageExportSize = computed(() => {
  const size = analyticsStore.analytics.exportMetrics?.averageExportSize ?? 0
  return `${size} KB`
})

// Average export time formatted as seconds
const averageExportTime = computed(() => {
  const time = analyticsStore.analytics.exportMetrics?.averageExportTime ?? 0
  return `${time} seconds`
})

// Format distribution data
const exportsByFormat = computed(() => {
  return (
    analyticsStore.analytics.exportMetrics?.exportsByFormat ?? {
      csv: 0,
      json: 0
    }
  )
})

// Most popular export format
const mostPopularFormat = computed(() => {
  const formats = analyticsStore.analytics.exportMetrics?.exportsByFormat
  if (!formats) return 'N/A'

  const csv = formats.csv || 0
  const json = formats.json || 0

  if (csv === 0 && json === 0) return 'N/A'
  return csv >= json ? 'CSV' : 'JSON'
})

// Show warning if success rate is below threshold
const showSuccessRateWarning = computed(() => {
  const rate = analyticsStore.analytics.exportMetrics?.exportSuccessRate ?? 0
  return rate < SUCCESS_RATE_THRESHOLD && rate > 0
})
</script>

<style scoped>
.export-metrics-widget {
  height: 100%;
}

.metric-value {
  font-size: 1.8rem;
  font-weight: bold;
  color: #1976d2;
  text-align: center;
}

.metric-value-secondary {
  font-size: 1.4rem;
  font-weight: bold;
  color: #1976d2;
  text-align: center;
}

.metric-label {
  font-size: 0.9rem;
  color: rgba(0, 0, 0, 0.6);
  text-align: center;
}

.success-rate-warning {
  color: #fb8c00;
}

.format-stats {
  margin-top: 8px;
}

.format-item {
  text-align: center;
  padding: 0 12px;
}

.format-count {
  font-size: 1.2rem;
  font-weight: bold;
  color: #1976d2;
}

.format-name {
  font-size: 0.9rem;
  color: rgba(0, 0, 0, 0.6);
}

.most-popular-format {
  position: relative;
}
</style>
