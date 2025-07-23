<!--
  @fileoverview Toast notification component with Vuetify styling
  @component ToastContainer
-->
<template>
  <teleport to="body">
    <div class="toast-container">
      <transition-group name="toast" tag="div">
        <v-snackbar
          v-for="toast in visibleToasts"
          :key="toast.id"
          :model-value="toast.visible"
          :color="getToastColor(toast.type)"
          :timeout="toast.persistent ? 0 : toast.timeout"
          :multi-line="toast.message.length > 60"
          location="top right"
          variant="elevated"
          class="toast-item"
          :style="{
            position: 'fixed',
            zIndex: 9999,
            top: `${getToastPosition(toast)}px`,
            right: '24px',
            maxWidth: '400px',
            minWidth: '300px'
          }"
          @update:model-value="(value) => !value && hideToast(toast.id)"
        >
          <div class="d-flex align-center">
            <v-icon
              :icon="getToastIcon(toast.type)"
              class="mr-3"
              :color="getIconColor(toast.type)"
            />

            <div class="flex-grow-1">
              <div class="toast-message">{{ toast.message }}</div>
              <div v-if="toast.timestamp" class="toast-timestamp">
                {{ formatTimestamp(toast.timestamp) }}
              </div>
            </div>
          </div>

          <template #actions>
            <!-- Custom actions if provided -->
            <template v-if="toast.actions">
              <v-btn
                v-for="action in toast.actions"
                :key="action.label"
                :color="action.color || 'white'"
                variant="text"
                size="small"
                @click="handleActionClick(action, toast)"
              >
                {{ action.label }}
              </v-btn>
            </template>

            <!-- Always show close button -->
            <v-btn
              icon="mdi-close"
              variant="text"
              size="small"
              @click="hideToast(toast.id)"
            />
          </template>
        </v-snackbar>
      </transition-group>
    </div>
  </teleport>
</template>

<script setup>
/**
 * Toast container component for displaying temporary notifications
 *
 * Features:
 * - Multiple toast types (success, error, warning, info)
 * - Auto-positioning with stacking
 * - Custom actions support
 * - Smooth animations
 * - Responsive design
 */

import { computed } from 'vue'
import { useToastStore } from '../stores/toastStore.js'

// Store
const toastStore = useToastStore()

// Computed properties
const visibleToasts = computed(() =>
  toastStore.toasts.filter((toast) => toast.visible)
)

// Methods
function hideToast(id) {
  toastStore.hideToast(id)
}

function getToastColor(toastType) {
  const colors = {
    success: 'success',
    error: 'error',
    warning: 'warning',
    info: 'info'
  }
  return colors[toastType] || 'info'
}

function getToastIcon(toastType) {
  const icons = {
    success: 'mdi-check-circle',
    error: 'mdi-alert-circle',
    warning: 'mdi-alert',
    info: 'mdi-information'
  }
  return icons[toastType] || 'mdi-information'
}

function getIconColor(_toastType) {
  // Use white for all types since we're using colored backgrounds
  return 'white'
}

function getToastPosition(toast) {
  const baseTop = 24
  const toastHeight = 72 // Approximate height including margin
  const index = visibleToasts.value.findIndex((t) => t.id === toast.id)
  return baseTop + index * toastHeight
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function handleActionClick(action, toast) {
  if (typeof action.handler === 'function') {
    action.handler(toast)
  }

  // Auto-hide toast after action unless specified otherwise
  if (action.autoHide !== false) {
    hideToast(toast.id)
  }
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 9999;
  pointer-events: none;
}

.toast-item {
  pointer-events: auto;
  margin-bottom: 8px;
}

.toast-message {
  font-weight: 500;
  line-height: 1.4;
  word-break: break-word;
}

.toast-timestamp {
  font-size: 0.75rem;
  opacity: 0.8;
  margin-top: 2px;
}

/* Toast animations */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-move {
  transition: transform 0.3s ease;
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .toast-item {
    right: 16px !important;
    left: 16px !important;
    max-width: none !important;
    min-width: none !important;
  }
}
</style>
