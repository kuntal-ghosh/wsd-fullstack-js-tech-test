<template>
  <div
    class="connection-status"
    :class="{
      connected: analyticsStore.isReallyConnected,
      disconnected: !analyticsStore.isReallyConnected
    }"
  >
    <v-icon
      size="small"
      :color="analyticsStore.isReallyConnected ? 'success' : 'error'"
      class="mr-1"
    >
      {{ analyticsStore.isReallyConnected ? 'mdi-wifi' : 'mdi-wifi-off' }}
    </v-icon>
    {{ analyticsStore.isReallyConnected ? 'Connected' : 'Disconnected' }}
    <v-tooltip v-if="!analyticsStore.isReallyConnected" location="bottom">
      <template #activator="{ props }">
        <v-icon size="small" color="warning" class="ml-1" v-bind="props">
          mdi-information-outline
        </v-icon>
      </template>
      <span>
        {{ getConnectionErrorMessage() }}
      </span>
    </v-tooltip>
    <v-btn
      v-if="!analyticsStore.isReallyConnected"
      size="x-small"
      variant="text"
      color="primary"
      class="ml-2"
      icon="mdi-refresh"
      @click="checkConnection"
    ></v-btn>
  </div>
</template>

<script setup>
import { useAnalyticsStore } from '../stores/analyticsStore.js'
import { ref } from 'vue'

const analyticsStore = useAnalyticsStore()
const checkingConnection = ref(false)

/**
 * Checks the connection status and attempts to reconnect
 */
async function checkConnection() {
  if (checkingConnection.value) return

  checkingConnection.value = true
  try {
    console.log('Manually checking connection status...')
    await analyticsStore.checkNetworkConnectivity()

    if (analyticsStore.networkOnline && !analyticsStore.connected) {
      console.log('Network available, attempting to reconnect...')
      analyticsStore.connect()
    }
  } finally {
    checkingConnection.value = false
  }
}

/**
 * Returns appropriate error message based on connection status
 */
function getConnectionErrorMessage() {
  if (!analyticsStore.networkOnline) {
    return 'Internet connection unavailable. Please check your network settings.'
  } else if (!analyticsStore.connected) {
    return 'Unable to connect to the server. The service may be down or unreachable.'
  } else {
    return 'Connection issue detected. Please try refreshing.'
  }
}
</script>

<style scoped>
.connection-status {
  display: flex;
  align-items: center;
  padding: 0.3rem 0.8rem;
  border-radius: 16px;
  font-size: 0.875rem;
  transition: all 0.3s ease;
}

.connected {
  background-color: rgba(76, 175, 80, 0.1);
  color: #4caf50;
}

.disconnected {
  background-color: rgba(244, 67, 54, 0.1);
  color: #f44336;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    opacity: 1;
  }
}
</style>
