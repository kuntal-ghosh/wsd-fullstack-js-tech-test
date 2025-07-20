<template>
  <v-container>
    <v-row>
      <!-- Status Filter -->
      <v-col cols="12" md="6">
        <v-select
          v-model="localFilters.status"
          :items="statusOptions"
          label="Status"
          multiple
          chips
          clearable
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
          clearable
          variant="outlined"
          density="compact"
          data-testid="priority-select"
          :error-messages="validationErrors.priority"
          @update:model-value="onFiltersChange"
        />
      </v-col>

      <!-- Sort By Filter -->
      <v-col cols="12" md="6">
        <v-select
          v-model="localFilters.sortBy"
          :items="sortByOptions"
          label="Sort By"
          clearable
          variant="outlined"
          density="compact"
          data-testid="sort-by-select"
          :error-messages="validationErrors.sortBy"
          @update:model-value="onFiltersChange"
        />
      </v-col>

      <!-- Sort Order Filter -->
      <v-col cols="12" md="6">
        <v-select
          v-model="localFilters.sortOrder"
          :items="sortOrderOptions"
          label="Sort Order"
          clearable
          variant="outlined"
          density="compact"
          data-testid="sort-order-select"
          :error-messages="validationErrors.sortOrder"
          @update:model-value="onFiltersChange"
        />
      </v-col>

      <!-- Date Range Picker -->
      <v-col cols="12" md="6">
        <!-- From Date Picker -->
        <v-menu
          v-model="dateMenus.from"
          :close-on-content-click="false"
          transition="scale-transition"
          offset-y
          min-width="auto"
        >
          <template #activator="{ props: activatorProps }">
            <v-text-field
              v-model="formattedDateFrom"
              label="From Date"
              variant="outlined"
              density="compact"
              prepend-inner-icon="mdi-calendar-start"
              data-testid="date-from-input"
              readonly
              clearable
              class="date-input"
              v-bind="activatorProps"
              placeholder="Select date..."
              :error-messages="validationErrors.dateFrom"
              @click:clear="clearFromDate"
            />
          </template>
          <v-card class="date-picker-card">
            <v-card-title class="d-flex align-center pa-3 bg-primary">
              <v-icon class="mr-2 text-white">mdi-calendar</v-icon>
              <span class="text-white">Select From Date</span>
              <v-spacer />
              <v-btn
                icon="mdi-close"
                variant="text"
                size="small"
                color="white"
                @click="dateMenus.from = false"
              />
            </v-card-title>
            <v-card-text class="pa-0">
              <v-date-picker
                v-model="tempDateFrom"
                color="primary"
                header-color="primary"
                :max="localFilters.dateTo || undefined"
                show-adjacent-months
                elevation="0"
                @update:model-value="selectFromDate"
              />
            </v-card-text>
          </v-card>
        </v-menu>
      </v-col>

      <v-col cols="12" md="6">
        <!-- To Date Picker -->
        <v-menu
          v-model="dateMenus.to"
          :close-on-content-click="false"
          transition="scale-transition"
          offset-y
          min-width="auto"
        >
          <template #activator="{ props: activatorProps }">
            <v-text-field
              v-model="formattedDateTo"
              label="To Date"
              variant="outlined"
              density="compact"
              prepend-inner-icon="mdi-calendar-end"
              data-testid="date-to-input"
              readonly
              clearable
              class="date-input"
              v-bind="activatorProps"
              placeholder="Select date..."
              :error-messages="validationErrors.dateTo"
              @click:clear="clearToDate"
            />
          </template>
          <v-card class="date-picker-card">
            <v-card-title class="d-flex align-center pa-3 bg-primary">
              <v-icon class="mr-2 text-white">mdi-calendar</v-icon>
              <span class="text-white">Select To Date</span>
              <v-spacer />
              <v-btn
                icon="mdi-close"
                variant="text"
                size="small"
                color="white"
                @click="dateMenus.to = false"
              />
            </v-card-title>
            <v-card-text class="pa-0">
              <v-date-picker
                v-model="tempDateTo"
                color="primary"
                header-color="primary"
                :min="localFilters.dateFrom || undefined"
                show-adjacent-months
                elevation="0"
                @update:model-value="selectToDate"
              />
            </v-card-text>
          </v-card>
        </v-menu>
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
                v-if="localFilters.sortBy"
                size="small"
                closable
                color="indigo"
                data-testid="sort-by-chip"
                @click:close="resetSortBy"
              >
                Sort by: {{ formatSortBy(localFilters.sortBy) }}
              </v-chip>

              <v-chip
                v-if="localFilters.sortOrder"
                size="small"
                closable
                color="deep-purple"
                data-testid="sort-order-chip"
                @click:close="resetSortOrder"
              >
                Order: {{ formatSortOrder(localFilters.sortOrder) }}
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
</template>

<script setup>
import { ref, computed, watch } from 'vue'
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
  exportLoading: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

// Sort options
const sortByOptions = [
  { title: 'Created Date', value: 'createdAt' },
  { title: 'Title', value: 'title' },
  { title: 'Priority', value: 'priority' },
  { title: 'Status', value: 'status' },
  { title: 'Completed Date', value: 'completedAt' }
]

const sortOrderOptions = [
  { title: 'Descending', value: 'desc' },
  { title: 'Ascending', value: 'asc' }
]

// Emits
const emit = defineEmits(['update:modelValue', 'export', 'clear'])

// Reactive state
const localFilters = ref({
  search: '',
  status: [],
  priority: [],
  dateFrom: '',
  dateTo: '',
  sortBy: '', // Changed from 'createdAt' to empty string
  sortOrder: '', // Changed from 'desc' to empty string
  ...props.modelValue
})

const validationErrors = ref({
  search: [],
  status: [],
  priority: [],
  dateFrom: [],
  dateTo: [],
  sortBy: [],
  sortOrder: []
})

// Date picker state
const dateMenus = ref({
  from: false,
  to: false
})

const tempDateFrom = ref(null)
const tempDateTo = ref(null)

// Computed properties
const hasActiveFilters = computed(() => {
  return !!(
    localFilters.value.search ||
    localFilters.value.status?.length > 0 ||
    localFilters.value.priority?.length > 0 ||
    localFilters.value.dateFrom ||
    localFilters.value.dateTo ||
    localFilters.value.sortBy || // Changed condition to check for any value
    localFilters.value.sortOrder // Changed condition to check for any value
  )
})

const activeFilterCount = computed(() => {
  let count = 0
  if (localFilters.value.search) count++
  if (localFilters.value.status?.length > 0) count++
  if (localFilters.value.priority?.length > 0) count++
  if (localFilters.value.dateFrom || localFilters.value.dateTo) count++
  if (localFilters.value.sortBy) count++ // Changed condition to check for any value
  if (localFilters.value.sortOrder) count++ // Changed condition to check for any value
  return count
})

const canExport = computed(() => {
  return hasActiveFilters.value && !props.disabled
})

// Computed properties for formatted dates
const formattedDateFrom = computed({
  get() {
    if (!localFilters.value.dateFrom) return ''
    const date = new Date(localFilters.value.dateFrom)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  },
  set(_value) {
    // This setter won't be used directly as we handle updates through date picker
  }
})

const formattedDateTo = computed({
  get() {
    if (!localFilters.value.dateTo) return ''
    const date = new Date(localFilters.value.dateTo)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  },
  set(_value) {
    // This setter won't be used directly as we handle updates through date picker
  }
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
      dateFrom: '',
      dateTo: '',
      sortBy: '', // Changed from 'createdAt' to empty string
      sortOrder: '', // Changed from 'desc' to empty string
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
    validationErrors.value.search = [
      'Search query is too long (max 255 characters)'
    ]
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
  if (
    localFilters.value.dateFrom &&
    !isValidDate(localFilters.value.dateFrom)
  ) {
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
    validationErrors.value.status = [
      `Maximum ${maxArrayLength} status filters allowed`
    ]
    isValid = false
  }

  if (localFilters.value.priority?.length > maxArrayLength) {
    validationErrors.value.priority = [
      `Maximum ${maxArrayLength} priority filters allowed`
    ]
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
    dateFrom: [],
    dateTo: [],
    sortBy: [],
    sortOrder: []
  }
}

// Event handlers
const _onSearchInput = () => {
  debouncedEmitFilters()
}

function onFiltersChange() {
  // Immediate validation and emit for non-search filters
  if (validateFilters()) {
    emit('update:modelValue', { ...localFilters.value })
  }
}

const _onDateFromChange = () => {
  onFiltersChange()
}

const _onDateToChange = () => {
  onFiltersChange()
}

const _clearSearch = () => {
  localFilters.value.search = ''
  onFiltersChange()
}

// Handle clearing select components
const _onSelectClear = (fieldName) => {
  if (fieldName === 'sortBy') {
    localFilters.value.sortBy = 'createdAt'
  } else if (fieldName === 'sortOrder') {
    localFilters.value.sortOrder = 'desc'
  } else if (localFilters.value[fieldName]) {
    localFilters.value[fieldName] = fieldName.endsWith('s') ? [] : ''
  }
  onFiltersChange()
}

// Format functions for display
function formatSortBy(sortBy) {
  const option = sortByOptions.find((opt) => opt.value === sortBy)
  return option ? option.title : sortBy
}

function formatSortOrder(sortOrder) {
  const option = sortOrderOptions.find((opt) => opt.value === sortOrder)
  return option ? option.title : sortOrder
}

// Filter chip removal functions
const _clearSearchChip = () => {
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

// Enhanced resetSortBy and resetSortOrder to work with clearable selects
function resetSortBy() {
  localFilters.value.sortBy = ''
  onFiltersChange()
}

function resetSortOrder() {
  localFilters.value.sortOrder = ''
  onFiltersChange()
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
    dateFrom: '',
    dateTo: '',
    sortBy: '', // Changed from 'createdAt' to empty string
    sortOrder: '' // Changed from 'desc' to empty string
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

// Date picker methods
function selectFromDate(date) {
  if (date) {
    localFilters.value.dateFrom = date.toISOString().split('T')[0]
    tempDateFrom.value = date
    dateMenus.value.from = false
    onFiltersChange()
  }
}

function selectToDate(date) {
  if (date) {
    localFilters.value.dateTo = date.toISOString().split('T')[0]
    tempDateTo.value = date
    dateMenus.value.to = false
    onFiltersChange()
  }
}

function clearFromDate() {
  localFilters.value.dateFrom = ''
  tempDateFrom.value = null
  onFiltersChange()
}

function clearToDate() {
  localFilters.value.dateTo = ''
  tempDateTo.value = null
  onFiltersChange()
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

/* Professional date picker styling */
.date-input {
  cursor: pointer;
}

.date-picker-card {
  max-width: 340px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  overflow: hidden;
}

.date-picker-card .v-card-title {
  background: linear-gradient(
    135deg,
    var(--v-theme-primary),
    var(--v-theme-primary-darken-1)
  );
  color: white;
  font-weight: 600;
  letter-spacing: 0.025em;
}

.date-picker-card .v-date-picker {
  border-radius: 0;
  box-shadow: none;
}

.date-picker-card .v-date-picker .v-date-picker-month {
  border-radius: 0;
}

.date-picker-card .v-btn {
  transition: all 0.2s ease;
}

.date-picker-card .v-btn:hover {
  transform: scale(1.05);
}
</style>
