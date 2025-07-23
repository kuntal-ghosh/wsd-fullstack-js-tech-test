<!--
/**
 * @fileoverview Export history component for viewing past exports with filtering and actions
 * @component ExportHistory
 * @description Displays a paginated list of export history entries with filtering, sorting,
 * metadata display, and actions like re-download, delete, and retry
 */
-->

<template>
  <v-card class="export-history">
    <!-- Header with title and refresh button -->
    <v-card-title class="d-flex justify-space-between align-center">
      Export History
      <v-btn
        icon="mdi-refresh"
        size="small"
        data-test="refresh-button"
        :loading="loading"
        @click="refreshHistory"
      />
    </v-card-title>

    <!-- Error state -->
    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      class="mx-4 mt-2"
      data-test="error-alert"
    >
      {{ error }}
      <template #append>
        <v-btn
          variant="text"
          size="small"
          data-test="refresh-button"
          @click="refreshHistory"
        >
          Retry
        </v-btn>
      </template>
    </v-alert>

    <!-- Action error message -->
    <v-alert
      v-if="actionError"
      type="error"
      variant="tonal"
      class="mx-4 mt-2"
      closable
      data-test="action-error-message"
      @click:close="actionError = ''"
    >
      {{ actionError }}
    </v-alert>

    <!-- Filters and sorting section -->
    <v-card-text>
      <v-expansion-panels variant="accordion" class="mb-4">
        <v-expansion-panel>
          <v-expansion-panel-title class="text-subtitle-1">
            <template #default="{ expanded }">
              <div class="d-flex align-center">
                <v-icon class="mr-2" :color="hasActiveFilters ? 'primary' : ''">
                  {{ hasActiveFilters ? 'mdi-filter' : 'mdi-filter-outline' }}
                </v-icon>
                <span>Filters & Sorting</span>
                <v-chip
                  v-if="hasActiveFilters"
                  color="primary"
                  size="x-small"
                  class="ml-2"
                >
                  {{ activeFiltersCount }}
                </v-chip>
                <v-spacer></v-spacer>
                <v-icon>
                  {{ expanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}
                </v-icon>
              </div>
            </template>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-row>
              <v-col cols="12" md="6" lg="3">
                <!-- Format filter -->
                <v-select
                  v-model="filters.format"
                  :items="formatOptions"
                  label="Format"
                  variant="outlined"
                  density="compact"
                  clearable
                  prepend-inner-icon="mdi-file-document"
                  data-test="format-filter"
                >
                  <template #item="{ item, props }">
                    <v-list-item
                      v-bind="props"
                      :data-test="`format-option-${item.raw}`"
                    >
                      <template #prepend>
                        <v-icon>{{ getFormatIcon(item.raw) }}</v-icon>
                      </template>
                      {{ item.title }}
                    </v-list-item>
                  </template>
                </v-select>
              </v-col>

              <v-col cols="12" md="6" lg="3">
                <!-- Status filter -->
                <v-select
                  v-model="filters.status"
                  :items="statusOptions"
                  label="Status"
                  variant="outlined"
                  density="compact"
                  clearable
                  prepend-inner-icon="mdi-state-machine"
                  data-test="status-filter"
                >
                  <template #item="{ item, props }">
                    <v-list-item
                      v-bind="props"
                      :data-test="`status-option-${item.raw}`"
                    >
                      <template #prepend>
                        <v-icon :color="getStatusColor(item.raw)">
                          {{ getStatusIcon(item.raw) }}
                        </v-icon>
                      </template>
                      {{ item.title }}
                    </v-list-item>
                  </template>
                </v-select>
              </v-col>

              <v-col cols="12" md="6" lg="3">
                <!-- From Date Picker -->
                <v-menu
                  v-model="dateMenus.from"
                  :close-on-content-click="false"
                  transition="scale-transition"
                  offset-y
                  min-width="auto"
                >
                  <template #activator="{ props }">
                    <v-text-field
                      v-model="formattedDateFrom"
                      label="From Date"
                      variant="outlined"
                      density="compact"
                      prepend-inner-icon="mdi-calendar-start"
                      data-test="date-from-filter"
                      readonly
                      clearable
                      class="date-input"
                      v-bind="props"
                      placeholder="Select date..."
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
                        :max="filters.dateTo || undefined"
                        show-adjacent-months
                        elevation="0"
                        @update:model-value="selectFromDate"
                      />
                    </v-card-text>
                  </v-card>
                </v-menu>
              </v-col>

              <v-col cols="12" md="6" lg="3">
                <!-- To Date Picker -->
                <v-menu
                  v-model="dateMenus.to"
                  :close-on-content-click="false"
                  transition="scale-transition"
                  offset-y
                  min-width="auto"
                >
                  <template #activator="{ props }">
                    <v-text-field
                      v-model="formattedDateTo"
                      label="To Date"
                      variant="outlined"
                      density="compact"
                      prepend-inner-icon="mdi-calendar-end"
                      data-test="date-to-filter"
                      readonly
                      clearable
                      class="date-input"
                      v-bind="props"
                      placeholder="Select date..."
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
                        :min="filters.dateFrom || undefined"
                        show-adjacent-months
                        elevation="0"
                        @update:model-value="selectToDate"
                      />
                    </v-card-text>
                  </v-card>
                </v-menu>
              </v-col>
            </v-row>

            <v-row class="mt-2">
              <v-col cols="12">
                <div class="d-flex justify-end gap-2">
                  <v-btn
                    variant="outlined"
                    prepend-icon="mdi-filter-remove"
                    data-test="reset-filters-button"
                    @click="resetFilters"
                  >
                    Reset
                  </v-btn>
                  <v-btn
                    color="primary"
                    prepend-icon="mdi-filter-check"
                    data-test="apply-filters-button"
                    @click="applyFilters"
                  >
                    Apply Filters
                  </v-btn>
                </div>
              </v-col>
            </v-row>

            <!-- Quick sort options -->
            <v-divider class="my-4"></v-divider>
            <div class="d-flex align-center justify-space-between">
              <div class="text-subtitle-2">Quick Sort:</div>
              <div class="d-flex gap-2">
                <v-chip
                  :color="sortBy === 'createdAt' ? 'primary' : 'default'"
                  :variant="sortBy === 'createdAt' ? 'flat' : 'outlined'"
                  size="small"
                  clickable
                  data-test="sort-by-date"
                  @click="toggleSort('createdAt')"
                >
                  <v-icon start size="small">
                    {{
                      sortBy === 'createdAt' && sortOrder === 'desc'
                        ? 'mdi-arrow-down'
                        : 'mdi-arrow-up'
                    }}
                  </v-icon>
                  Date
                </v-chip>

                <v-chip
                  :color="sortBy === 'fileSize' ? 'primary' : 'default'"
                  :variant="sortBy === 'fileSize' ? 'flat' : 'outlined'"
                  size="small"
                  clickable
                  data-test="sort-by-size"
                  @click="toggleSort('fileSize')"
                >
                  <v-icon start size="small">
                    {{
                      sortBy === 'fileSize' && sortOrder === 'desc'
                        ? 'mdi-arrow-down'
                        : 'mdi-arrow-up'
                    }}
                  </v-icon>
                  Size
                </v-chip>

                <v-chip
                  :color="sortBy === 'totalRecords' ? 'primary' : 'default'"
                  :variant="sortBy === 'totalRecords' ? 'flat' : 'outlined'"
                  size="small"
                  clickable
                  data-test="sort-by-records"
                  @click="toggleSort('totalRecords')"
                >
                  <v-icon start size="small">
                    {{
                      sortBy === 'totalRecords' && sortOrder === 'desc'
                        ? 'mdi-arrow-down'
                        : 'mdi-arrow-up'
                    }}
                  </v-icon>
                  Records
                </v-chip>
              </div>
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-card-text>

    <!-- Loading state -->
    <div
      v-if="loading"
      class="d-flex justify-center pa-4"
      data-test="loading-progress"
    >
      <v-progress-circular indeterminate />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!exportHistory.length"
      class="empty-state-container d-flex flex-column align-center justify-center pa-8"
      data-test="empty-state"
    >
      <!-- Animated background illustration -->
      <div class="empty-state-illustration mb-6">
        <div class="floating-documents">
          <div class="document doc-1">
            <v-icon size="40" color="primary">mdi-file-document</v-icon>
          </div>
          <div class="document doc-2">
            <v-icon size="36" color="secondary">mdi-file-chart</v-icon>
          </div>
          <div class="document doc-3">
            <v-icon size="32" color="success">mdi-file-excel</v-icon>
          </div>
        </div>

        <!-- Central empty folder icon -->
        <div class="empty-folder">
          <v-icon size="80" color="grey-lighten-2"
            >mdi-folder-open-outline</v-icon
          >
          <div class="folder-shine"></div>
        </div>
      </div>

      <!-- Text content -->
      <div class="text-center">
        <h3 class="text-h5 mb-3 text-grey-darken-2">
          {{
            hasActiveFilters
              ? 'No exports match your filters'
              : 'No export history yet'
          }}
        </h3>
        <p class="text-body-1 text-grey mb-4" style="max-width: 400px">
          {{
            hasActiveFilters
              ? 'Try adjusting your filters or create a new export to get started.'
              : 'Start by exporting your task data to see your export history here.'
          }}
        </p>

        <!-- Action buttons -->
        <div class="d-flex gap-3 justify-center flex-wrap">
          <v-btn
            v-if="hasActiveFilters"
            variant="outlined"
            prepend-icon="mdi-filter-remove"
            @click="resetFilters"
          >
            Clear Filters
          </v-btn>
          <v-btn
            color="primary"
            prepend-icon="mdi-file-export"
            @click="navigateToTasks"
          >
            Export Tasks
          </v-btn>
        </div>
      </div>
    </div>

    <!-- Error state -->
    <div
      v-else-if="error"
      class="d-flex flex-column align-center pa-6"
      data-test="error-state"
    >
      <v-icon size="64" color="error">mdi-alert-circle-outline</v-icon>
      <div class="text-h6 mt-4 text-error">Failed to load export history</div>
      <div class="text-body-2 mt-2">{{ error }}</div>
      <v-btn
        class="mt-4"
        color="primary"
        data-test="refresh-button"
        @click="refreshHistory"
      >
        Try Again
      </v-btn>
    </div>

    <!-- History table -->
    <v-data-table
      v-else
      :headers="headers"
      :items="exportHistory"
      :loading="loading"
      :items-per-page="itemsPerPage"
      :page="currentPage"
      :items-length="totalItems"
      :items-per-page-options="itemsPerPageOptions"
      :sort-by="[{ key: sortBy, order: sortOrder }]"
      class="export-history-table"
      item-key="id"
      data-test="export-history-table"
      @update:sort-by="handleSortChange"
    >
      <!-- Date column -->
      <template v-slot:[`item.createdAt`]="{ item }">
        <span data-test="export-date">{{ formatDate(item.createdAt) }}</span>
      </template>

      <!-- Format column -->
      <template v-slot:[`item.format`]="{ item }">
        <span data-test="export-format">{{ item.format.toUpperCase() }}</span>
      </template>

      <!-- Status column -->
      <template v-slot:[`item.status`]="{ item }">
        <v-chip
          size="small"
          :color="getStatusColor(item.status)"
          data-test="status-chip"
        >
          <v-icon size="small" class="mr-1">
            {{ getStatusIcon(item.status) }}
          </v-icon>
          {{ formatStatus(item.status) }}
        </v-chip>
      </template>

      <!-- Records column -->
      <template v-slot:[`item.totalRecords`]="{ item }">
        <div class="text-center">
          <span data-test="export-records">
            {{ item.totalRecords || '-' }}
          </span>
        </div>
      </template>

      <!-- Size column -->
      <template v-slot:[`item.fileSize`]="{ item }">
        <div class="text-center">
          <span data-test="export-size">
            {{ item.fileSize ? formatFileSize(item.fileSize) : '-' }}
          </span>
        </div>
      </template>

      <!-- Actions column -->
      <template v-slot:[`item.actions`]="{ item }">
        <div class="d-flex gap-2 justify-center">
          <!-- Download button for completed exports -->
          <v-btn
            v-if="item.status === 'completed'"
            icon="mdi-download"
            size="small"
            color="primary"
            :data-test="`download-button-${item.id}`"
            :loading="downloadProgress[item.id]?.downloading"
            :disabled="loading"
            @click="handleDownload(item)"
          />

          <!-- Download progress indicator -->
          <div
            v-if="downloadProgress[item.id]?.downloading"
            class="text-caption"
            :data-test="`download-progress-${item.id}`"
          >
            {{ downloadProgress[item.id].progress }}%
          </div>

          <!-- View details button -->
          <v-btn
            icon="mdi-information-outline"
            size="small"
            color="primary"
            :data-test="`view-details-button-${item.id}`"
            :disabled="loading"
            @click="viewDetails(item)"
          />

          <!-- Retry button for failed exports -->
          <v-btn
            v-if="item.status === 'failed'"
            icon="mdi-refresh"
            size="small"
            color="warning"
            :data-test="`retry-button-${item.id}`"
            :disabled="loading"
            @click="handleRetry(item)"
          />

          <!-- Delete button -->
          <v-btn
            icon="mdi-delete"
            size="small"
            color="error"
            :data-test="`delete-button-${item.id}`"
            :disabled="loading"
            @click="confirmDelete(item)"
          />
        </div>
      </template>

      <!-- Expanded row details -->
      <template #expanded-row="{ item, columns }">
        <tr>
          <td :colspan="columns.length">
            <v-card flat>
              <v-card-text>
                <!-- Filter details -->
                <div class="text-subtitle-2 mb-2">Applied filters</div>
                <div :data-test="`filter-details-${item.id}`" class="mb-4">
                  {{ formatFilters(item.filters) }}
                </div>

                <!-- Time details -->
                <div class="text-subtitle-2 mb-2">Time information</div>
                <div :data-test="`time-details-${item.id}`" class="mb-4">
                  <div>
                    <strong>Created:</strong>
                    {{ formatDate(item.createdAt, true) }}
                  </div>
                  <div v-if="item.completedAt">
                    <strong>Completed:</strong>
                    {{ formatDate(item.completedAt, true) }}
                  </div>
                  <div v-if="item.failedAt">
                    <strong>Failed:</strong>
                    {{ formatDate(item.failedAt, true) }}
                  </div>
                  <div v-if="item.completedAt || item.failedAt">
                    <strong>Duration:</strong> {{ calculateDuration(item) }}
                  </div>
                </div>

                <!-- Error details for failed exports -->
                <div v-if="item.status === 'failed' && item.error">
                  <div class="text-subtitle-2 mb-2">Error details</div>
                  <v-alert
                    type="error"
                    variant="tonal"
                    density="compact"
                    :data-test="`error-details-${item.id}`"
                    class="mb-4"
                  >
                    {{ item.error }}
                  </v-alert>
                </div>
              </v-card-text>
            </v-card>
          </td>
        </tr>
      </template>

      <!-- Pagination controls -->
      <template #bottom>
        <div
          class="d-flex justify-space-between align-center pa-4"
          data-test="pagination"
        >
          <div class="d-flex align-center">
            <span class="text-sm text-medium-emphasis mr-4">
              Showing
              {{
                Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)
              }}-{{ Math.min(currentPage * itemsPerPage, totalItems) }} of
              {{ totalItems }} exports
            </span>
            <v-select
              v-model="itemsPerPage"
              :items="itemsPerPageOptions"
              variant="outlined"
              density="compact"
              style="min-width: 120px; max-width: 120px"
              hide-details
              data-test="items-per-page"
              @update:model-value="onItemsPerPageChange"
            >
              <template #selection="{ item }">
                {{ item.value }} per page
              </template>
              <template #item="{ item, props }">
                <v-list-item v-bind="props" :data-test="`option-${item.raw}`">
                  {{ item.raw }} per page
                </v-list-item>
              </template>
            </v-select>
          </div>

          <v-pagination
            v-model="currentPage"
            :length="totalPages"
            :total-visible="7"
            @update:model-value="onPageChange"
          >
            <template #prev="{ props }">
              <v-btn v-bind="props" data-test="prev-page">
                <v-icon>mdi-chevron-left</v-icon>
              </v-btn>
            </template>
            <template #next="{ props }">
              <v-btn v-bind="props" data-test="next-page">
                <v-icon>mdi-chevron-right</v-icon>
              </v-btn>
            </template>
          </v-pagination>
        </div>
      </template>
    </v-data-table>

    <!-- Delete confirmation dialog -->
    <v-dialog
      v-model="deleteDialog.show"
      max-width="400"
      data-test="delete-confirmation-dialog"
    >
      <v-card>
        <v-card-title>Delete Export</v-card-title>
        <v-card-text>
          Are you sure you want to delete this export?
          <p class="mt-2">
            <strong>Type:</strong>
            {{ deleteDialog.item?.format?.toUpperCase() }}
            <br />
            <strong>Created:</strong>
            {{
              deleteDialog.item?.createdAt
                ? formatDate(deleteDialog.item.createdAt)
                : ''
            }}
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="deleteDialog.show = false">
            Cancel
          </v-btn>
          <v-btn
            color="error"
            data-test="confirm-delete-button"
            @click="handleDelete"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Export details dialog -->
    <v-dialog
      v-model="detailsDialog.show"
      max-width="800"
      data-test="export-details-dialog"
    >
      <v-card v-if="detailsDialog.item">
        <v-card-title class="d-flex align-center">
          <v-icon class="mr-2">mdi-file-export</v-icon>
          Export Details
          <v-spacer></v-spacer>
          <v-chip
            :color="getStatusColor(detailsDialog.item.status)"
            size="small"
          >
            <v-icon size="small" class="mr-1">
              {{ getStatusIcon(detailsDialog.item.status) }}
            </v-icon>
            {{ formatStatus(detailsDialog.item.status) }}
          </v-chip>
        </v-card-title>

        <v-card-text>
          <v-row>
            <!-- Basic Information -->
            <v-col cols="12" md="6">
              <v-card variant="outlined" class="h-100">
                <v-card-title class="text-h6">
                  <v-icon class="mr-2">mdi-information</v-icon>
                  Basic Information
                </v-card-title>
                <v-card-text>
                  <v-list density="compact">
                    <v-list-item>
                      <template #prepend>
                        <v-icon>mdi-identifier</v-icon>
                      </template>
                      <v-list-item-title>Export ID</v-list-item-title>
                      <v-list-item-subtitle>{{
                        detailsDialog.item.id
                      }}</v-list-item-subtitle>
                    </v-list-item>

                    <v-list-item>
                      <template #prepend>
                        <v-icon>mdi-file-document</v-icon>
                      </template>
                      <v-list-item-title>Format</v-list-item-title>
                      <v-list-item-subtitle>{{
                        detailsDialog.item.format.toUpperCase()
                      }}</v-list-item-subtitle>
                    </v-list-item>

                    <v-list-item v-if="detailsDialog.item.filename">
                      <template #prepend>
                        <v-icon>mdi-rename-box</v-icon>
                      </template>
                      <v-list-item-title>Filename</v-list-item-title>
                      <v-list-item-subtitle>{{
                        detailsDialog.item.filename
                      }}</v-list-item-subtitle>
                    </v-list-item>

                    <v-list-item v-if="detailsDialog.item.totalRecords">
                      <template #prepend>
                        <v-icon>mdi-counter</v-icon>
                      </template>
                      <v-list-item-title>Total Records</v-list-item-title>
                      <v-list-item-subtitle>{{
                        detailsDialog.item.totalRecords.toLocaleString()
                      }}</v-list-item-subtitle>
                    </v-list-item>

                    <v-list-item v-if="detailsDialog.item.fileSize">
                      <template #prepend>
                        <v-icon>mdi-harddisk</v-icon>
                      </template>
                      <v-list-item-title>File Size</v-list-item-title>
                      <v-list-item-subtitle>{{
                        formatFileSize(detailsDialog.item.fileSize)
                      }}</v-list-item-subtitle>
                    </v-list-item>

                    <v-list-item>
                      <template #prepend>
                        <v-icon>mdi-progress-check</v-icon>
                      </template>
                      <v-list-item-title>Progress</v-list-item-title>
                      <v-list-item-subtitle>
                        <v-progress-linear
                          :model-value="detailsDialog.item.progress || 0"
                          height="6"
                          :color="getStatusColor(detailsDialog.item.status)"
                          class="mr-2"
                        ></v-progress-linear>
                        {{ detailsDialog.item.progress || 0 }}%
                      </v-list-item-subtitle>
                    </v-list-item>
                  </v-list>
                </v-card-text>
              </v-card>
            </v-col>

            <!-- Time Information -->
            <v-col cols="12" md="6">
              <v-card variant="outlined" class="h-100">
                <v-card-title class="text-h6">
                  <v-icon class="mr-2">mdi-clock</v-icon>
                  Time Information
                </v-card-title>
                <v-card-text>
                  <v-list density="compact">
                    <v-list-item>
                      <template #prepend>
                        <v-icon>mdi-clock-start</v-icon>
                      </template>
                      <v-list-item-title>Created</v-list-item-title>
                      <v-list-item-subtitle>{{
                        formatDate(detailsDialog.item.createdAt, true)
                      }}</v-list-item-subtitle>
                    </v-list-item>

                    <v-list-item>
                      <template #prepend>
                        <v-icon>mdi-clock-edit</v-icon>
                      </template>
                      <v-list-item-title>Last Updated</v-list-item-title>
                      <v-list-item-subtitle>{{
                        formatDate(detailsDialog.item.updatedAt, true)
                      }}</v-list-item-subtitle>
                    </v-list-item>

                    <v-list-item v-if="detailsDialog.item.completedAt">
                      <template #prepend>
                        <v-icon>mdi-clock-check</v-icon>
                      </template>
                      <v-list-item-title>Completed</v-list-item-title>
                      <v-list-item-subtitle>{{
                        formatDate(detailsDialog.item.completedAt, true)
                      }}</v-list-item-subtitle>
                    </v-list-item>

                    <v-list-item v-if="detailsDialog.item.failedAt">
                      <template #prepend>
                        <v-icon>mdi-clock-alert</v-icon>
                      </template>
                      <v-list-item-title>Failed</v-list-item-title>
                      <v-list-item-subtitle>{{
                        formatDate(detailsDialog.item.failedAt, true)
                      }}</v-list-item-subtitle>
                    </v-list-item>

                    <v-list-item v-if="detailsDialog.item.expiresAt">
                      <template #prepend>
                        <v-icon
                          :color="
                            detailsDialog.item.isExpired ? 'error' : 'warning'
                          "
                        >
                          {{
                            detailsDialog.item.isExpired
                              ? 'mdi-clock-alert-outline'
                              : 'mdi-clock-time-eight'
                          }}
                        </v-icon>
                      </template>
                      <v-list-item-title>
                        {{
                          detailsDialog.item.isExpired ? 'Expired' : 'Expires'
                        }}
                      </v-list-item-title>
                      <v-list-item-subtitle
                        :class="
                          detailsDialog.item.isExpired
                            ? 'text-error'
                            : 'text-warning'
                        "
                      >
                        {{ formatDate(detailsDialog.item.expiresAt, true) }}
                      </v-list-item-subtitle>
                    </v-list-item>

                    <v-list-item
                      v-if="
                        (detailsDialog.item.completedAt ||
                          detailsDialog.item.failedAt) &&
                        detailsDialog.item.createdAt
                      "
                    >
                      <template #prepend>
                        <v-icon>mdi-timer</v-icon>
                      </template>
                      <v-list-item-title>Duration</v-list-item-title>
                      <v-list-item-subtitle>{{
                        calculateDuration(detailsDialog.item)
                      }}</v-list-item-subtitle>
                    </v-list-item>
                  </v-list>
                </v-card-text>
              </v-card>
            </v-col>

            <!-- Filter Information -->
            <v-col cols="12">
              <v-card variant="outlined">
                <v-card-title class="text-h6">
                  <v-icon class="mr-2">mdi-filter</v-icon>
                  Applied Filters
                </v-card-title>
                <v-card-text>
                  <div v-if="hasFilters(detailsDialog.item.filters)">
                    <v-chip-group>
                      <v-chip
                        v-for="(filterInfo, index) in getFilterChips(
                          detailsDialog.item.filters
                        )"
                        :key="index"
                        :color="filterInfo.color"
                        size="small"
                        variant="outlined"
                      >
                        <v-icon start size="small">{{
                          filterInfo.icon
                        }}</v-icon>
                        {{ filterInfo.label }}
                      </v-chip>
                    </v-chip-group>

                    <v-divider class="my-3"></v-divider>

                    <div class="text-body-2">
                      <strong>Detailed filter description:</strong><br />
                      {{ formatFilters(detailsDialog.item.filters) }}
                    </div>
                  </div>
                  <div v-else class="text-center text-muted">
                    <v-icon size="48" color="grey-lighten-2"
                      >mdi-filter-off</v-icon
                    >
                    <div class="text-body-2 mt-2">
                      No filters applied - exported all records
                    </div>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>

            <!-- Error Information (for failed exports) -->
            <v-col
              v-if="
                detailsDialog.item.status === 'failed' &&
                detailsDialog.item.error
              "
              cols="12"
            >
              <v-card variant="outlined">
                <v-card-title class="text-h6 text-error">
                  <v-icon class="mr-2" color="error">mdi-alert-circle</v-icon>
                  Error Details
                </v-card-title>
                <v-card-text>
                  <v-alert
                    type="error"
                    variant="tonal"
                    :text="detailsDialog.item.error"
                  ></v-alert>
                </v-card-text>
              </v-card>
            </v-col>

            <!-- Download Information (for completed exports) -->
            <v-col v-if="detailsDialog.item.status === 'completed'" cols="12">
              <v-card variant="outlined">
                <v-card-title class="text-h6 text-success">
                  <v-icon class="mr-2" color="success">mdi-download</v-icon>
                  Download Information
                </v-card-title>
                <v-card-text>
                  <v-list density="compact">
                    <v-list-item v-if="detailsDialog.item.downloadUrl">
                      <template #prepend>
                        <v-icon>mdi-link</v-icon>
                      </template>
                      <v-list-item-title>Download URL</v-list-item-title>
                      <v-list-item-subtitle class="text-wrap">{{
                        detailsDialog.item.downloadUrl
                      }}</v-list-item-subtitle>
                    </v-list-item>

                    <v-list-item v-if="detailsDialog.item.filePath">
                      <template #prepend>
                        <v-icon>mdi-folder</v-icon>
                      </template>
                      <v-list-item-title>Server Path</v-list-item-title>
                      <v-list-item-subtitle class="text-wrap">{{
                        detailsDialog.item.filePath
                      }}</v-list-item-subtitle>
                    </v-list-item>
                  </v-list>

                  <div class="mt-4">
                    <v-btn
                      color="primary"
                      prepend-icon="mdi-download"
                      :loading="
                        downloadProgress[detailsDialog.item.id]?.downloading
                      "
                      @click="handleDownload(detailsDialog.item)"
                    >
                      Download Export
                    </v-btn>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>

          <!-- Action buttons -->
          <v-btn
            v-if="detailsDialog.item.status === 'failed'"
            color="warning"
            prepend-icon="mdi-refresh"
            @click="handleRetryAndClose(detailsDialog.item)"
          >
            Retry Export
          </v-btn>

          <v-btn
            v-if="detailsDialog.item.status === 'completed'"
            color="primary"
            prepend-icon="mdi-download"
            :loading="downloadProgress[detailsDialog.item.id]?.downloading"
            @click="handleDownload(detailsDialog.item)"
          >
            Download
          </v-btn>

          <v-btn
            color="error"
            prepend-icon="mdi-delete"
            @click="handleDeleteAndClose(detailsDialog.item)"
          >
            Delete
          </v-btn>

          <v-btn variant="text" @click="detailsDialog.show = false">
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useExportStore } from '../stores/exportStore'

// Store access
const exportStore = useExportStore()
const router = useRouter()

// Define emits
const emit = defineEmits(['refresh', 'show-export-dialog'])

// Reactive state
const currentPage = ref(1)
const itemsPerPage = ref(10)
const itemsPerPageOptions = [10, 25, 50]
const actionError = ref('')
const deleteDialog = ref({
  show: false,
  item: null
})
const detailsDialog = ref({
  show: false,
  item: null
})
const dateMenus = ref({
  from: false,
  to: false
})
const tempDateFrom = ref(null)
const tempDateTo = ref(null)
const filters = ref({
  format: null,
  status: null,
  dateFrom: '',
  dateTo: ''
})
const sortBy = ref('createdAt')
const sortOrder = ref('desc')

// Computed properties
const exportHistory = computed(() => {
  return exportStore.exportHistory || []
})

const loading = computed(() => exportStore.loading)

const error = computed(() => exportStore.error)

const totalItems = computed(() => {
  return exportStore.pagination?.total || 0
})

const totalPages = computed(() => {
  return exportStore.pagination?.pages || 1
})

const downloadProgress = computed(() => {
  return exportStore.downloadProgress || {}
})

// Filter options
const formatOptions = [
  { title: 'CSV', value: 'csv' },
  { title: 'JSON', value: 'json' }
]

const statusOptions = [
  { title: 'Completed', value: 'completed' },
  { title: 'Failed', value: 'failed' }
]

// Filter state computed properties
const hasActiveFilters = computed(() => {
  return !!(
    filters.value.format ||
    filters.value.status ||
    filters.value.dateFrom ||
    filters.value.dateTo
  )
})

const activeFiltersCount = computed(() => {
  let count = 0
  if (filters.value.format) count++
  if (filters.value.status) count++
  if (filters.value.dateFrom) count++
  if (filters.value.dateTo) count++
  return count
})

// Formatted date display
const formattedDateFrom = computed(() => {
  return filters.value.dateFrom
    ? formatDateForDisplay(filters.value.dateFrom)
    : ''
})

const formattedDateTo = computed(() => {
  return filters.value.dateTo ? formatDateForDisplay(filters.value.dateTo) : ''
})

// Table headers
const headers = [
  {
    title: 'Date',
    key: 'createdAt',
    sortable: true,
    align: 'start',
    data_test: 'table-header'
  },
  {
    title: 'Format',
    key: 'format',
    sortable: true,
    align: 'start',
    data_test: 'table-header'
  },
  {
    title: 'Status',
    key: 'status',
    sortable: true,
    align: 'center',
    data_test: 'table-header'
  },
  {
    title: 'Records',
    key: 'totalRecords',
    sortable: true,
    align: 'center',
    data_test: 'table-header'
  },
  {
    title: 'Size',
    key: 'fileSize',
    sortable: true,
    align: 'center',
    data_test: 'table-header'
  },
  {
    title: 'Actions',
    key: 'actions',
    sortable: false,
    align: 'center',
    data_test: 'table-header'
  }
]

// Fetch export history on component mount
onMounted(() => {
  fetchHistory()
})

// Methods
function fetchHistory() {
  const params = {
    page: currentPage.value,
    limit: itemsPerPage.value,
    sortBy: sortBy.value,
    sortOrder: sortOrder.value
  }

  // Add filters if they exist
  if (filters.value.format) params.format = filters.value.format
  if (filters.value.status) params.status = filters.value.status
  if (filters.value.dateFrom) params.dateFrom = filters.value.dateFrom
  if (filters.value.dateTo) params.dateTo = filters.value.dateTo

  return exportStore.fetchExports(params)
}

function refreshHistory() {
  // Reset page to 1 when refreshing
  currentPage.value = 1
  return fetchHistory()
}

function onPageChange(page) {
  currentPage.value = page
  fetchHistory()
}

function onItemsPerPageChange(limit) {
  itemsPerPage.value = limit
  // Reset to first page when changing items per page
  currentPage.value = 1
  fetchHistory()
}

function applyFilters() {
  // Reset to first page when applying filters
  currentPage.value = 1
  fetchHistory()
}

function resetFilters() {
  filters.value = {
    format: null,
    status: null,
    dateFrom: '',
    dateTo: ''
  }
  currentPage.value = 1
  fetchHistory()
}

function handleSortChange(sortArray) {
  if (sortArray && sortArray.length > 0) {
    const sort = sortArray[0]
    sortBy.value = sort.key
    sortOrder.value = sort.order
    currentPage.value = 1
    fetchHistory()
  }
}

function toggleSort(field) {
  if (sortBy.value === field) {
    // Toggle sort direction if already sorting by this field
    sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
  } else {
    // Set new sort field with default desc order
    sortBy.value = field
    sortOrder.value = 'desc'
  }

  // Reset to first page when changing sort
  currentPage.value = 1
  fetchHistory()
}

async function handleDownload(item) {
  try {
    actionError.value = ''
    await exportStore.downloadExport(item.id, item.filename)
  } catch (error) {
    actionError.value = `Download failed: ${error.message}`
    console.error('Download error:', error)
  }
}

function viewDetails(item) {
  detailsDialog.value = {
    show: true,
    item
  }
}

function confirmDelete(item) {
  deleteDialog.value = {
    show: true,
    item
  }
}

async function handleDelete() {
  if (!deleteDialog.value.item) return

  try {
    actionError.value = ''
    await exportStore.deleteExport(deleteDialog.value.item.id)
    deleteDialog.value.show = false
    refreshHistory() // Refresh the list after deletion
  } catch (error) {
    actionError.value = `Delete failed: ${error.message}`
    console.error('Delete error:', error)
    deleteDialog.value.show = false
  }
}

async function handleRetry(item) {
  try {
    actionError.value = ''
    await exportStore.retryExport(item.id)
    refreshHistory() // Refresh the list after retry
  } catch (error) {
    actionError.value = `Retry failed: ${error.message}`
    console.error('Retry error:', error)
  }
}

async function handleRetryAndClose(item) {
  await handleRetry(item)
  detailsDialog.value.show = false
}

function handleDeleteAndClose(item) {
  confirmDelete(item)
  detailsDialog.value.show = false
}

// Navigate to tasks page
function navigateToTasks() {
  // Modified to keep users in the Analytics page and open export dialog
  if (router.currentRoute.value.path === '/analytics') {
    // Emit an event that can be captured in the parent component
    emit('show-export-dialog')
  } else {
    // Default to tasks page
    router.push('/tasks')
  }
}

// Format date for display
function formatDate(dateString, includeTime = false) {
  if (!dateString) return ''

  const date = new Date(dateString)
  const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit' }

  if (includeTime) {
    dateOptions.hour = '2-digit'
    dateOptions.minute = '2-digit'
    dateOptions.second = '2-digit'
  }

  return new Intl.DateTimeFormat('en-US', dateOptions).format(date)
}

// Format file size for display
function formatFileSize(bytes) {
  if (!bytes) return '-'

  if (bytes < 1024) {
    return `${bytes} B`
  } else if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)}KB`
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }
}

// Get color for status chip
function getStatusColor(status) {
  const colors = {
    completed: 'success',
    failed: 'error',
    processing: 'primary',
    pending: 'info'
  }
  return colors[status] || 'grey'
}

// Get icon for status chip
function getStatusIcon(status) {
  const icons = {
    completed: 'mdi-check-circle',
    failed: 'mdi-alert-circle',
    processing: 'mdi-sync',
    pending: 'mdi-clock-outline'
  }
  return icons[status] || 'mdi-help-circle'
}

// Format status for display
function formatStatus(status) {
  if (!status) return ''
  return status.charAt(0).toUpperCase() + status.slice(1)
}

// Get icon for format
function getFormatIcon(format) {
  const icons = {
    csv: 'mdi-file-delimited',
    json: 'mdi-code-json'
  }
  return icons[format] || 'mdi-file-document'
}

// Date picker functions
function formatDateForDisplay(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function formatDateForAPI(date) {
  if (!date) return ''
  if (typeof date === 'string') return date
  return date.toISOString().split('T')[0]
}

function selectFromDate(date) {
  if (date) {
    filters.value.dateFrom = formatDateForAPI(date)
    dateMenus.value.from = false
  }
}

function selectToDate(date) {
  if (date) {
    filters.value.dateTo = formatDateForAPI(date)
    dateMenus.value.to = false
  }
}

function clearFromDate() {
  filters.value.dateFrom = ''
  tempDateFrom.value = null
}

function clearToDate() {
  filters.value.dateTo = ''
  tempDateTo.value = null
}

// Format filters for display
function formatFilters(filters) {
  if (!filters || Object.keys(filters).length === 0) {
    return 'No filters applied'
  }

  const formattedFilters = []

  // Status filter
  if (filters.status && filters.status.length > 0) {
    formattedFilters.push(`Status: ${filters.status.join(', ')}`)
  }

  // Priority filter
  if (filters.priority && filters.priority.length > 0) {
    formattedFilters.push(`Priority: ${filters.priority.join(', ')}`)
  }

  // Assignee filter
  if (filters.assignee && filters.assignee.length > 0) {
    formattedFilters.push(`Assignee: ${filters.assignee.join(', ')}`)
  }

  // Date range filter
  if (filters.dateFrom || filters.dateTo) {
    const dateRange = []
    if (filters.dateFrom && filters.dateTo) {
      dateRange.push(`Date Range: ${filters.dateFrom} to ${filters.dateTo}`)
    } else if (filters.dateFrom) {
      dateRange.push(`Date From: ${filters.dateFrom}`)
    } else if (filters.dateTo) {
      dateRange.push(`Date To: ${filters.dateTo}`)
    }
    formattedFilters.push(dateRange.join(', '))
  }

  // Search filter
  if (filters.search) {
    formattedFilters.push(`Search: "${filters.search}"`)
  }

  // Tags filter
  if (filters.tags && filters.tags.length > 0) {
    formattedFilters.push(`Tags: ${filters.tags.join(', ')}`)
  }

  return formattedFilters.join('; ')
}

// Calculate duration between created and completed/failed time
function calculateDuration(item) {
  const startTime = new Date(item.createdAt).getTime()
  let endTime

  if (item.completedAt) {
    endTime = new Date(item.completedAt).getTime()
  } else if (item.failedAt) {
    endTime = new Date(item.failedAt).getTime()
  } else {
    return '-'
  }

  const durationMs = endTime - startTime
  const durationMinutes = Math.round(durationMs / 60000)

  if (durationMinutes < 1) {
    const durationSeconds = Math.round(durationMs / 1000)
    return `${durationSeconds} seconds`
  } else if (durationMinutes < 60) {
    return `${durationMinutes} minute${durationMinutes !== 1 ? 's' : ''}`
  } else {
    const hours = Math.floor(durationMinutes / 60)
    const minutes = durationMinutes % 60
    return `${hours} hour${hours !== 1 ? 's' : ''}${minutes > 0 ? ` ${minutes} minute${minutes !== 1 ? 's' : ''}` : ''}`
  }
}

// Check if export has any filters applied
function hasFilters(filters) {
  if (!filters || typeof filters !== 'object') return false

  return Object.keys(filters).some((key) => {
    const value = filters[key]
    if (Array.isArray(value)) {
      return value.length > 0
    }
    return value !== null && value !== undefined && value !== ''
  })
}

// Create filter chips for visual display
function getFilterChips(filters) {
  if (!filters || typeof filters !== 'object') return []

  const chips = []

  // Status filter
  if (
    filters.status &&
    Array.isArray(filters.status) &&
    filters.status.length > 0
  ) {
    chips.push({
      label: `Status: ${filters.status.join(', ')}`,
      color: 'blue',
      icon: 'mdi-format-list-checks'
    })
  }

  // Priority filter
  if (
    filters.priority &&
    Array.isArray(filters.priority) &&
    filters.priority.length > 0
  ) {
    chips.push({
      label: `Priority: ${filters.priority.join(', ')}`,
      color: 'orange',
      icon: 'mdi-priority-high'
    })
  }

  // Assignee filter
  if (
    filters.assignee &&
    Array.isArray(filters.assignee) &&
    filters.assignee.length > 0
  ) {
    chips.push({
      label: `Assignee: ${filters.assignee.join(', ')}`,
      color: 'purple',
      icon: 'mdi-account'
    })
  }

  // Search filter
  if (filters.search && filters.search.trim()) {
    chips.push({
      label: `Search: "${filters.search}"`,
      color: 'green',
      icon: 'mdi-magnify'
    })
  }

  // Date range filters
  if (filters.dateFrom || filters.dateTo) {
    let dateLabel = 'Date: '
    if (filters.dateFrom && filters.dateTo) {
      dateLabel += `${filters.dateFrom} to ${filters.dateTo}`
    } else if (filters.dateFrom) {
      dateLabel += `from ${filters.dateFrom}`
    } else if (filters.dateTo) {
      dateLabel += `until ${filters.dateTo}`
    }

    chips.push({
      label: dateLabel,
      color: 'teal',
      icon: 'mdi-calendar'
    })
  }

  // Tags filter
  if (filters.tags && Array.isArray(filters.tags) && filters.tags.length > 0) {
    chips.push({
      label: `Tags: ${filters.tags.join(', ')}`,
      color: 'pink',
      icon: 'mdi-tag'
    })
  }

  return chips
}

// Expose methods for testing
defineExpose({
  formatDate,
  formatFileSize,
  getStatusColor,
  getStatusIcon,
  formatStatus,
  formatFilters,
  calculateDuration,
  hasFilters,
  getFilterChips,
  viewDetails,
  selectFromDate,
  selectToDate,
  clearFromDate,
  clearToDate
})
</script>

<style scoped>
.gap-2 {
  gap: 8px;
}

.gap-4 {
  gap: 16px;
}

.max-w-24 {
  max-width: 96px;
}

.export-history-table :deep(tr[data-test='history-row']) {
  cursor: pointer;
}

.export-history-table :deep(.v-data-table__tr:hover) {
  background-color: rgba(var(--v-theme-primary), 0.08) !important;
}

.export-history-table :deep(.v-data-table-header) {
  background-color: rgb(var(--v-theme-surface-bright));
}

/* Filter section styling */
.v-expansion-panel-title {
  font-weight: 500;
}

.v-expansion-panel-text :deep(.v-expansion-panel-text__wrapper) {
  padding: 16px 24px 24px;
}

/* Custom chip styling */
.v-chip.v-chip--clickable:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);
  transition: all 0.2s ease-in-out;
}

/* Pagination styling */
.v-pagination :deep(.v-btn) {
  border-radius: 8px;
}

/* Table actions styling */
.v-btn--icon {
  transition: all 0.2s ease-in-out;
}

.v-btn--icon:hover {
  transform: scale(1.1);
}

/* Status chip animation */
.v-chip {
  transition: all 0.2s ease-in-out;
}

/* Rotating animation for processing status */
.rotating {
  animation: rotate 1.5s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Card elevation on hover */
.v-card {
  transition: box-shadow 0.3s ease-in-out;
}

.v-card:hover {
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.12) !important;
}

/* Enhanced form field styling */
.v-text-field :deep(.v-field) {
  border-radius: 8px;
}

.v-select :deep(.v-field) {
  border-radius: 8px;
}

/* Filter chip indicator */
.filter-indicator {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  background-color: rgb(var(--v-theme-primary));
  border-radius: 50%;
}

/* Beautiful Empty State Styling */
.empty-state-container {
  min-height: 400px;
  background: linear-gradient(
    135deg,
    rgba(var(--v-theme-surface-variant), 0.3) 0%,
    rgba(var(--v-theme-primary), 0.05) 100%
  );
  border-radius: 16px;
  position: relative;
  overflow: hidden;
}

.empty-state-container::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(
    circle,
    rgba(var(--v-theme-primary), 0.1) 0%,
    transparent 70%
  );
  animation: shimmer 6s ease-in-out infinite;
}

.empty-state-illustration {
  position: relative;
  z-index: 2;
}

.empty-folder {
  position: relative;
  display: inline-block;
  animation: gentle-float 3s ease-in-out infinite;
}

.folder-shine {
  position: absolute;
  top: 20%;
  left: 30%;
  width: 20px;
  height: 20px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  filter: blur(8px);
  animation: shine 2s ease-in-out infinite alternate;
}

.floating-documents {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 200px;
  height: 200px;
}

.document {
  position: absolute;
  animation: float 4s ease-in-out infinite;
}

.doc-1 {
  top: 10%;
  left: 60%;
  animation-delay: -0.5s;
}

.doc-2 {
  top: 60%;
  left: 10%;
  animation-delay: -1s;
}

.doc-3 {
  top: 70%;
  right: 15%;
  animation-delay: -1.5s;
}

/* Keyframe Animations */
@keyframes shimmer {
  0%,
  100% {
    transform: rotate(0deg);
    opacity: 0.5;
  }
  50% {
    transform: rotate(180deg);
    opacity: 0.8;
  }
}

@keyframes gentle-float {
  0%,
  100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0px) rotate(0deg);
    opacity: 0.7;
  }
  33% {
    transform: translateY(-15px) rotate(5deg);
    opacity: 0.9;
  }
  66% {
    transform: translateY(-5px) rotate(-3deg);
    opacity: 0.8;
  }
}

@keyframes shine {
  0% {
    opacity: 0.3;
    transform: scale(1);
  }
  100% {
    opacity: 0.8;
    transform: scale(1.2);
  }
}

/* Empty state content styling */
.empty-state-container .text-h5 {
  font-weight: 600;
  letter-spacing: -0.02em;
}

.empty-state-container .text-body-1 {
  line-height: 1.6;
}

/* Button animations in empty state */
.empty-state-container .v-btn {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.empty-state-container .v-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
}

/* Professional Date Picker Styling */
.date-picker-card {
  border-radius: 12px !important;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12) !important;
  border: 1px solid rgba(var(--v-theme-primary), 0.1);
}

.date-picker-card .v-card-title {
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-primary)),
    rgb(var(--v-theme-secondary))
  ) !important;
  border-radius: 0;
  min-height: 56px;
}

.date-picker-card .v-date-picker {
  background: rgb(var(--v-theme-surface));
  border-radius: 0;
}

.date-picker-card .v-date-picker :deep(.v-date-picker-header) {
  background: rgb(var(--v-theme-surface-bright));
  padding: 16px;
  border-bottom: 1px solid rgba(var(--v-theme-outline), 0.1);
}

.date-picker-card .v-date-picker :deep(.v-date-picker-month) {
  padding: 16px;
}

.date-picker-card .v-date-picker :deep(.v-btn) {
  border-radius: 8px;
  transition: all 0.2s ease-in-out;
}

.date-picker-card .v-date-picker :deep(.v-btn:hover) {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Enhanced text field styling for date inputs */
.v-text-field.date-input :deep(.v-field) {
  border-radius: 10px;
  transition: all 0.3s ease;
}

.v-text-field.date-input :deep(.v-field:hover) {
  box-shadow: 0 2px 8px rgba(var(--v-theme-primary), 0.1);
}

.v-text-field.date-input :deep(.v-field--focused) {
  box-shadow: 0 4px 12px rgba(var(--v-theme-primary), 0.15);
}

/* Date picker menu animation */
.v-overlay :deep(.v-menu__content) {
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

/* Custom calendar styling */
.date-picker-card .v-date-picker :deep(.v-date-picker-title) {
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
}

.date-picker-card .v-date-picker :deep(.v-date-picker-month__day--selected) {
  background: rgb(var(--v-theme-primary)) !important;
  color: white !important;
  border-radius: 8px;
}

.date-picker-card .v-date-picker :deep(.v-date-picker-month__day--today) {
  border: 2px solid rgb(var(--v-theme-primary));
  border-radius: 8px;
}

/* Responsive empty state */
@media (max-width: 600px) {
  .empty-state-container {
    min-height: 350px;
    padding: 32px 16px;
  }

  .floating-documents {
    width: 150px;
    height: 150px;
  }

  .empty-folder .v-icon {
    font-size: 60px !important;
  }

  .date-picker-card {
    margin: 8px;
    max-width: calc(100vw - 32px) !important;
  }
}
</style>
