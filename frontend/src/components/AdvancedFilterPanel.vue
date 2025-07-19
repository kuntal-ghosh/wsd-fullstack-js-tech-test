<template>
  <v-expansion-panels v-model="panelOpen">
    <v-expansion-panel>
      <v-expansion-panel-title>
        <v-icon class="mr-2">mdi-filter-variant</v-icon>
        Advanced Filters
        <v-chip
          v-if="activeFilterCount > 0"
          color="primary"
          size="small"
          class="ml-2"
          data-testid="active-filter-count"
        >
          {{ activeFilterCount }}
        </v-chip>
      </v-expansion-panel-title>

      <v-expansion-panel-text>
        <v-container>
          <v-row>
            <!-- Search Input -->
            <v-col cols="12" md="6">
              <v-text-field
                v-model="localFilters.search"
                label="Search tasks"
                placeholder="Enter keywords to search..."
                prepend-inner-icon="mdi-magnify"
                clearable
                variant="outlined"
                density="compact"
                data-testid="search-input"
                :error-messages="validationErrors.search"
                @input="onSearchInput"
                @click:clear="clearSearch"
              />
            </v-col>

            <!-- Status Filter -->
            <v-col cols="12" md="6">
              <v-select
                v-model="localFilters.status"
                :items="statusOptions"
                label="Status"
                multiple
                chips
                variant="outlined"
                density="compact"
                data-testid="status-select"
                :error-messages="validationErrors.status"
                @update:model-value="onFiltersChange"
              />
            </v-col>

            <!-- Priority Filter -->
            <v-col cols="12" md="6">
              <v-select
                v-model="localFilters.priority"
                :items="priorityOptions"
                label="Priority"
                multiple
                chips
                variant="outlined"
                density="compact"
                data-testid="priority-select"
                :error-messages="validationErrors.priority"
                @update:model-value="onFiltersChange"
              />
            </v-col>

            <!-- Assignee Filter -->
            <v-col cols="12" md="6">
              <v-combobox
                v-model="localFilters.assignee"
                :items="assigneeOptions"
                label="Assignee"
                multiple
                chips
                variant="outlined"
                density="compact"
                data-testid="assignee-combobox"
                :error-messages="validationErrors.assignee"
                @update:model-value="onFiltersChange"
              />
            </v-col>

            <!-- Date Range Picker -->
            <v-col cols="12" md="6">
              <v-text-field
                v-model="localFilters.dateFrom"
                label="From Date"
                type="date"
                variant="outlined"
                density="compact"
                data-testid="date-from-input"
                :error-messages="validationErrors.dateFrom"
                :max="localFilters.dateTo || undefined"
                @update:model-value="onDateFromChange"
              />
            </v-col>

            <v-col cols="12" md="6">
              <v-text-field
                v-model="localFilters.dateTo"
                label="To Date"
                type="date"
                variant="outlined"
                density="compact"
                data-testid="date-to-input"
                :error-messages="validationErrors.dateTo"
                :min="localFilters.dateFrom || undefined"
                @update:model-value="onDateToChange"
              />
            </v-col>

            <!-- Tags Filter -->
            <v-col cols="12">
              <v-combobox
                v-model="localFilters.tags"
                :items="tagOptions"
                label="Tags"
                multiple
                chips
                variant="outlined"
                density="compact"
                data-testid="tags-combobox"
                :error-messages="validationErrors.tags"
                @update:model-value="onFiltersChange"
              />
            </v-col>
          </v-row>

          <!-- Filter Summary -->
          <v-row v-if="hasActiveFilters" class="mt-2">
            <v-col cols="12">
              <v-card variant="tonal" color="info" class="pa-3">
                <v-card-title class="text-subtitle-2 pb-2">
                  Active Filters Summary
                </v-card-title>
                <v-card-text class="pt-0">
                  <div class="d-flex flex-wrap gap-2" data-testid="filter-summary">
                    <v-chip
                      v-if="localFilters.search"
                      size="small"
                      closable
                      color="primary"
                      data-testid="search-chip"
                      @click:close="clearSearchChip"
                    >
                      Search: "{{ localFilters.search }}"
                    </v-chip>

                    <v-chip
                      v-for="status in localFilters.status"
                      :key="`status-${status}`"
                      size="small"
                      closable
                      color="blue"
                      data-testid="status-chip"
                      @click:close="removeStatusFilter(status)"
                    >
                      Status: {{ status }}
                    </v-chip>

                    <v-chip
                      v-for="priority in localFilters.priority"
                      :key="`priority-${priority}`"
                      size="small"
                      closable
                      color="orange"
                      data-testid="priority-chip"
                      @click:close="removePriorityFilter(priority)"
                    >
                      Priority: {{ priority }}
                    </v-chip>

                    <v-chip
                      v-for="assignee in localFilters.assignee"
                      :key="`assignee-${assignee}`"
                      size="small"
                      closable
                      color="green"
                      data-testid="assignee-chip"
                      @click:close="removeAssigneeFilter(assignee)"
                    >
                      Assignee: {{ assignee }}
                    </v-chip>

                    <v-chip
                      v-if="localFilters.dateFrom || localFilters.dateTo"
                      size="small"
                      closable
                      color="purple"
                      data-testid="date-range-chip"
                      @click:close="clearDateRange"
                    >
                      Date: {{ formatDateRange() }}
                    </v-chip>

                    <v-chip
                      v-for="tag in localFilters.tags"
                      :key="`tag-${tag}`"
                      size="small"
                      closable
                      color="teal"
                      data-testid="tag-chip"
                      @click:close="removeTagFilter(tag)"
                    >
                      Tag: {{ tag }}
                    </v-chip>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <!-- Action Buttons -->
          <v-row class="mt-4">
            <v-col cols="12" class="d-flex justify-end gap-3">
              <v-btn
                variant="outlined"
                color="secondary"
                prepend-icon="mdi-filter-remove"
                data-testid="clear-filters-btn"
                :disabled="!hasActiveFilters"
                @click="clearAllFilters"
              >
                Clear Filters
              </v-btn>

              <v-btn
                variant="elevated"
                color="primary"
                prepend-icon="mdi-download"
                data-testid="export-btn"
                :disabled="!canExport"
                :loading="exportLoading"
                @click="onExportClick"
              >
                Export Results
              </v-btn>
            </v-col>
          </v-row>
        </v-container>
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { debounce } from 'lodash-es'

// Props
const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({})
  },
  statusOptions: {
    type: Array,
    default: () => ['pending', 'in-progress', 'completed', 'cancelled']
  },
  priorityOptions: {
    type: Array,
    default: () => ['low', 'medium', 'high']
  },
  assigneeOptions: {
    type: Array,
    default: () => []
  },
  tagOptions: {
    type: Array,
    default: () => []
  },
  exportLoading: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['update:modelValue', 'export', 'clear'])

// Reactive state
const panelOpen = ref([0])
const localFilters = ref({
  search: '',
  status: [],
  priority: [],
  assignee: [],
  dateFrom: '',
  dateTo: '',
  tags: [],
  ...props.modelValue
})

const validationErrors = ref({
  search: [],
  status: [],
  priority: [],
  assignee: [],
  dateFrom: [],
  dateTo: [],
  tags: []
})

// Computed properties
const hasActiveFilters = computed(() => {
  return !!(
    localFilters.value.search ||
    localFilters.value.status?.length > 0 ||
    localFilters.value.priority?.length > 0 ||
    localFilters.value.assignee?.length > 0 ||
    localFilters.value.dateFrom ||
    localFilters.value.dateTo ||
    localFilters.value.tags?.length > 0
  )
})

const activeFilterCount = computed(() => {
  let count = 0
  if (localFilters.value.search) count++
  if (localFilters.value.status?.length > 0) count++
  if (localFilters.value.priority?.length > 0) count++
  if (localFilters.value.assignee?.length > 0) count++
  if (localFilters.value.dateFrom || localFilters.value.dateTo) count++
  if (localFilters.value.tags?.length > 0) count++
  return count
})

const canExport = computed(() => {
  return hasActiveFilters.value && !props.disabled
})

// Debounced search function
const debouncedEmitFilters = debounce(() => {
  if (validateFilters()) {
    emit('update:modelValue', { ...localFilters.value })
  }
}, 300)

// Watch for prop changes
watch(
  () => props.modelValue,
  (newValue) => {
    localFilters.value = {
      search: '',
      status: [],
      priority: [],
      assignee: [],
      dateFrom: '',
      dateTo: '',
      tags: [],
      ...newValue
    }
  },
  { deep: true }
)

// Validation functions
function validateFilters() {
  clearValidationErrors()
  let isValid = true

  // Search validation
  if (localFilters.value.search && localFilters.value.search.length > 255) {
    validationErrors.value.search = ['Search query is too long (max 255 characters)']
    isValid = false
  }

  // Date range validation
  if (localFilters.value.dateFrom && localFilters.value.dateTo) {
    const fromDate = new Date(localFilters.value.dateFrom)
    const toDate = new Date(localFilters.value.dateTo)
    
    if (fromDate > toDate) {
      validationErrors.value.dateFrom = ['From date cannot be after To date']
      validationErrors.value.dateTo = ['To date cannot be before From date']
      isValid = false
    }
  }

  // Date format validation
  if (localFilters.value.dateFrom && !isValidDate(localFilters.value.dateFrom)) {
    validationErrors.value.dateFrom = ['Invalid date format']
    isValid = false
  }

  if (localFilters.value.dateTo && !isValidDate(localFilters.value.dateTo)) {
    validationErrors.value.dateTo = ['Invalid date format']
    isValid = false
  }

  // Array length validation
  const maxArrayLength = 10
  if (localFilters.value.status?.length > maxArrayLength) {
    validationErrors.value.status = [`Maximum ${maxArrayLength} status filters allowed`]
    isValid = false
  }

  if (localFilters.value.priority?.length > maxArrayLength) {
    validationErrors.value.priority = [`Maximum ${maxArrayLength} priority filters allowed`]
    isValid = false
  }

  if (localFilters.value.assignee?.length > maxArrayLength) {
    validationErrors.value.assignee = [`Maximum ${maxArrayLength} assignee filters allowed`]
    isValid = false
  }

  if (localFilters.value.tags?.length > maxArrayLength) {
    validationErrors.value.tags = [`Maximum ${maxArrayLength} tag filters allowed`]
    isValid = false
  }

  return isValid
}

function isValidDate(dateString) {
  const date = new Date(dateString)
  return !isNaN(date.getTime()) && dateString.match(/^\d{4}-\d{2}-\d{2}$/)
}

function clearValidationErrors() {
  validationErrors.value = {
    search: [],
    status: [],
    priority: [],
    assignee: [],
    dateFrom: [],
    dateTo: [],
    tags: []
  }
}

// Event handlers
function onSearchInput() {
  debouncedEmitFilters()
}

function onFiltersChange() {
  // Immediate validation and emit for non-search filters
  if (validateFilters()) {
    emit('update:modelValue', { ...localFilters.value })
  }
}

function onDateFromChange() {
  onFiltersChange()
}

function onDateToChange() {
  onFiltersChange()
}

function clearSearch() {
  localFilters.value.search = ''
  onFiltersChange()
}

// Filter chip removal functions
function clearSearchChip() {
  localFilters.value.search = ''
  onFiltersChange()
}

function removeStatusFilter(status) {
  const index = localFilters.value.status.indexOf(status)
  if (index > -1) {
    localFilters.value.status.splice(index, 1)
    onFiltersChange()
  }
}

function removePriorityFilter(priority) {
  const index = localFilters.value.priority.indexOf(priority)
  if (index > -1) {
    localFilters.value.priority.splice(index, 1)
    onFiltersChange()
  }
}

function removeAssigneeFilter(assignee) {
  const index = localFilters.value.assignee.indexOf(assignee)
  if (index > -1) {
    localFilters.value.assignee.splice(index, 1)
    onFiltersChange()
  }
}

function removeTagFilter(tag) {
  const index = localFilters.value.tags.indexOf(tag)
  if (index > -1) {
    localFilters.value.tags.splice(index, 1)
    onFiltersChange()
  }
}

function clearDateRange() {
  localFilters.value.dateFrom = ''
  localFilters.value.dateTo = ''
  onFiltersChange()
}

function clearAllFilters() {
  localFilters.value = {
    search: '',
    status: [],
    priority: [],
    assignee: [],
    dateFrom: '',
    dateTo: '',
    tags: []
  }
  clearValidationErrors()
  emit('update:modelValue', { ...localFilters.value })
  emit('clear')
}

function onExportClick() {
  if (canExport.value) {
    emit('export', { ...localFilters.value })
  }
}

function formatDateRange() {
  const from = localFilters.value.dateFrom
  const to = localFilters.value.dateTo
  
  if (from && to) {
    return `${from} to ${to}`
  } else if (from) {
    return `from ${from}`
  } else if (to) {
    return `until ${to}`
  }
  return ''
}

// Expose methods for testing
defineExpose({
  validateFilters,
  clearAllFilters,
  localFilters,
  validationErrors,
  hasActiveFilters,
  activeFilterCount,
  canExport
})
</script>

<style scoped>
.gap-2 {
  gap: 8px;
}

.gap-3 {
  gap: 12px;
}
</style>