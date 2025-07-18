# GitHub Copilot Instructions
## Task Export and Advanced Filtering System Development

### Project Context
This is a technical test implementation for a **Task Export and Advanced Filtering System** that extends an existing Task Analytics Dashboard. The system is built with Vue.js 3, Node.js, MongoDB, Redis, and Socket.IO, following Test-Driven Development (TDD) principles.

**Key Architecture:**
- **Backend:** Node.js v24+ with Express.js 5.1, MongoDB with Mongoose 8.15, Redis with ioredis 5.6, Socket.IO 4.8
- **Frontend:** Vue.js 3 with Vuetify 3, Pinia state management, real-time Socket.IO integration
- **Testing:** Node.js built-in test runner with c8 coverage (backend), Vitest (frontend)
- **Code Style:** ESLint with Google JavaScript Style Guide (backend), Vue.js style guide (frontend)

---

## 1. CODING STANDARDS AND PATTERNS

### 1.1 Backend Coding Standards

#### File Organization
```
backend/src/
├── config/         # Database and Redis configurations
├── middleware/     # Error handling middleware
├── models/         # Mongoose data models
├── routes/         # Express.js API routes
├── services/       # Business logic services
├── sockets/        # Socket.IO handlers
└── utils/          # Utility functions
```

#### API Design Patterns
**ALWAYS follow this response format:**
```javascript
// Success response
{
  "success": true,
  "data": { /* actual data */ },
  "message": "Optional success message"
}

// Error response
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { /* optional error details */ }
}
```

#### Database Patterns
**Use Mongoose with these conventions:**
```javascript
// Model definition
const schema = new mongoose.Schema({
  field: { type: String, required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'] },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) }
}, { timestamps: true });

// Add indexes for performance
schema.index({ status: 1, createdAt: -1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

#### Service Layer Pattern
```javascript
// Service class structure
class ServiceName {
  static async methodName(params) {
    try {
      // Validation
      if (!params) {
        throw new Error('Invalid parameters');
      }
      
      // Business logic
      const result = await Model.findOne(params);
      
      // Cache operations if applicable
      await RedisClient.setex(cacheKey, 300, JSON.stringify(result));
      
      return result;
    } catch (error) {
      console.error('Service error:', error);
      throw error;
    }
  }
}
```

#### Error Handling Pattern
```javascript
// Route error handling
router.get('/endpoint', async (req, res, next) => {
  try {
    const result = await Service.method(req.params);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error); // Pass to error middleware
  }
});

// Error middleware
app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: error.message,
    code: error.code || 'INTERNAL_ERROR'
  });
});
```

### 1.2 Frontend Coding Standards

#### Component Structure (Vue.js 3 Composition API)
```vue
<template>
  <div class="component-name">
    <!-- Use Vuetify 3 components -->
    <v-card>
      <v-card-title>{{ title }}</v-card-title>
      <v-card-text>
        <!-- Component content -->
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useStore } from '@/stores/storeName';

// Props
const props = defineProps({
  title: { type: String, required: true }
});

// Emits
const emit = defineEmits(['update', 'export']);

// Composables
const store = useStore();

// Reactive state
const loading = ref(false);
const data = ref([]);

// Computed properties
const filteredData = computed(() => {
  return data.value.filter(item => item.status === 'active');
});

// Methods
const handleAction = async () => {
  loading.value = true;
  try {
    await store.performAction();
    emit('update', { success: true });
  } catch (error) {
    console.error('Action failed:', error);
  } finally {
    loading.value = false;
  }
};

// Lifecycle
onMounted(() => {
  // Initialize component
});
</script>

<style scoped>
.component-name {
  /* Component-specific styles */
}
</style>
```

#### Pinia Store Pattern
```javascript
// stores/exportStore.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '@/api/client';

export const useExportStore = defineStore('export', () => {
  // State
  const exports = ref([]);
  const loading = ref(false);
  const error = ref(null);

  // Getters
  const activeExports = computed(() => {
    return exports.value.filter(exp => exp.status === 'processing');
  });

  // Actions
  const createExport = async (params) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.post('/exports', params);
      exports.value.push(response.data);
      return response.data;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updateExportProgress = (exportData) => {
    const index = exports.value.findIndex(exp => exp.id === exportData.id);
    if (index !== -1) {
      exports.value[index] = { ...exports.value[index], ...exportData };
    }
  };

  return {
    exports,
    loading,
    error,
    activeExports,
    createExport,
    updateExportProgress
  };
});
```

---

## 2. SPECIFIC IMPLEMENTATION REQUIREMENTS

### 2.1 Export System Implementation

#### Backend Export Service
```javascript
// services/exportService.js
import Task from '../models/Task.js';
import Export from '../models/Export.js';
import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import fs from 'fs';

class ExportService {
  static async createExport(filters, format, userId = 'anonymous') {
    // Generate cache key
    const cacheKey = this.generateCacheKey(filters, format);
    
    // Check cache first
    const cachedExport = await this.getCachedExport(cacheKey);
    if (cachedExport) {
      return cachedExport;
    }

    // Create export record
    const exportRecord = new Export({
      userId,
      format,
      filters,
      status: 'processing',
      progress: 0
    });
    await exportRecord.save();

    // Process export asynchronously
    this.processExport(exportRecord._id, filters, format, cacheKey);
    
    return exportRecord;
  }

  static async processExport(exportId, filters, format, cacheKey) {
    try {
      // Update progress
      await this.updateProgress(exportId, 10);

      // Build query
      const query = this.buildFilterQuery(filters);
      const tasks = await Task.find(query).sort({ createdAt: -1 });

      await this.updateProgress(exportId, 50);

      // Generate file
      const fileData = format === 'csv' ? 
        await this.generateCSV(tasks) : 
        await this.generateJSON(tasks);

      await this.updateProgress(exportId, 80);

      // Save file
      const filePath = await this.saveFile(fileData, format, exportId);
      
      // Update export record
      await Export.findByIdAndUpdate(exportId, {
        status: 'completed',
        progress: 100,
        filePath,
        fileSize: Buffer.byteLength(fileData),
        downloadUrl: `/api/exports/${exportId}/download`
      });

      // Cache result
      await this.setCachedExport(cacheKey, exportId);

      await this.updateProgress(exportId, 100);

      // Broadcast completion
      this.broadcastExportComplete(exportId);

    } catch (error) {
      await this.markFailed(exportId, error.message);
    }
  }

  static async generateCSV(tasks) {
    const csvWriter = createObjectCsvWriter({
      path: 'temp.csv',
      header: [
        { id: 'title', title: 'Title' },
        { id: 'description', title: 'Description' },
        { id: 'status', title: 'Status' },
        { id: 'priority', title: 'Priority' },
        { id: 'createdAt', title: 'Created At' },
        { id: 'completedAt', title: 'Completed At' }
      ]
    });

    const records = tasks.map(task => ({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      createdAt: task.createdAt.toISOString(),
      completedAt: task.completedAt ? task.completedAt.toISOString() : ''
    }));

    await csvWriter.writeRecords(records);
    return fs.readFileSync('temp.csv', 'utf8');
  }

  static async generateJSON(tasks) {
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        recordCount: tasks.length,
        format: 'json'
      },
      tasks: tasks.map(task => ({
        id: task._id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
        estimatedTime: task.estimatedTime,
        actualTime: task.actualTime
      }))
    };

    return JSON.stringify(exportData, null, 2);
  }

  static buildFilterQuery(filters) {
    const query = {};
    
    if (filters.status) query.status = filters.status;
    if (filters.priority) query.priority = filters.priority;
    
    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
    }
    
    if (filters.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } }
      ];
    }
    
    return query;
  }

  static generateCacheKey(filters, format) {
    const filterString = JSON.stringify(filters);
    const hash = Buffer.from(filterString + format).toString('base64');
    return `export:${hash}`;
  }
}

export default ExportService;
```

#### Frontend Export Dialog Component
```vue
<!-- components/ExportDialog.vue -->
<template>
  <v-dialog v-model="dialog" max-width="600">
    <template v-slot:activator="{ props }">
      <v-btn
        v-bind="props"
        color="primary"
        prepend-icon="mdi-download"
        :disabled="!hasData"
      >
        Export Data
      </v-btn>
    </template>

    <v-card>
      <v-card-title>Export Task Data</v-card-title>
      
      <v-card-text>
        <v-radio-group v-model="exportFormat" label="Export Format">
          <v-radio 
            label="CSV (Comma Separated Values)" 
            value="csv"
            data-test="format-csv"
          />
          <v-radio 
            label="JSON (JavaScript Object Notation)" 
            value="json"
            data-test="format-json"
          />
        </v-radio-group>

        <v-text-field
          v-model="customFilename"
          label="Custom Filename (optional)"
          hint="Leave empty for auto-generated filename"
          data-test="filename"
        />

        <v-card variant="outlined" class="mt-4">
          <v-card-text>
            <div class="text-body-2">
              <strong>Records to export:</strong> {{ recordCount }}
            </div>
            <div class="text-body-2">
              <strong>Applied filters:</strong> {{ activeFiltersDescription }}
            </div>
            <div class="text-body-2">
              <strong>Estimated size:</strong> {{ estimatedSize }}
            </div>
          </v-card-text>
        </v-card>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn @click="dialog = false">Cancel</v-btn>
        <v-btn 
          @click="initiateExport"
          color="primary"
          :loading="exporting"
          data-test="start-export"
        >
          Start Export
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useExportStore } from '@/stores/exportStore';
import { useTaskStore } from '@/stores/taskStore';

const props = defineProps({
  filters: { type: Object, required: true },
  modelValue: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue', 'export-created']);

const exportStore = useExportStore();
const taskStore = useTaskStore();

const exportFormat = ref('csv');
const customFilename = ref('');
const exporting = ref(false);

const dialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const recordCount = computed(() => {
  return taskStore.filteredTasks.length;
});

const hasData = computed(() => {
  return recordCount.value > 0;
});

const activeFiltersDescription = computed(() => {
  const filters = [];
  if (props.filters.status) filters.push(`Status: ${props.filters.status}`);
  if (props.filters.priority) filters.push(`Priority: ${props.filters.priority}`);
  if (props.filters.search) filters.push(`Search: "${props.filters.search}"`);
  if (props.filters.dateFrom) filters.push(`From: ${props.filters.dateFrom}`);
  if (props.filters.dateTo) filters.push(`To: ${props.filters.dateTo}`);
  return filters.length > 0 ? filters.join(', ') : 'No filters applied';
});

const estimatedSize = computed(() => {
  const avgBytesPerRecord = exportFormat.value === 'csv' ? 150 : 300;
  const totalBytes = recordCount.value * avgBytesPerRecord;
  return totalBytes > 1024 * 1024 ? 
    `${(totalBytes / (1024 * 1024)).toFixed(1)} MB` : 
    `${(totalBytes / 1024).toFixed(1)} KB`;
});

const initiateExport = async () => {
  if (!hasData.value) {
    // Show confirmation dialog for empty export
    return;
  }

  exporting.value = true;
  try {
    const exportParams = {
      format: exportFormat.value,
      filters: props.filters,
      filename: customFilename.value || null
    };

    const exportRecord = await exportStore.createExport(exportParams);
    
    emit('export-created', exportRecord);
    dialog.value = false;
    
    // Reset form
    customFilename.value = '';
    exportFormat.value = 'csv';
    
  } catch (error) {
    console.error('Export failed:', error);
    // Show error notification
  } finally {
    exporting.value = false;
  }
};
</script>
```

### 2.2 Advanced Filtering Implementation

#### Filter Service
```javascript
// services/taskFilterService.js
class TaskFilterService {
  static buildFilterQuery(filters) {
    const query = {};
    
    // Status filtering - support multiple values
    if (filters.status && filters.status.length > 0) {
      query.status = { $in: filters.status };
    }
    
    // Priority filtering - support multiple values
    if (filters.priority && filters.priority.length > 0) {
      query.priority = { $in: filters.priority };
    }
    
    // Date range filtering
    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) {
        query.createdAt.$gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        query.createdAt.$lte = new Date(filters.dateTo);
      }
    }
    
    // Completion date filtering
    if (filters.completedAfter || filters.completedBefore) {
      query.completedAt = {};
      if (filters.completedAfter) {
        query.completedAt.$gte = new Date(filters.completedAfter);
      }
      if (filters.completedBefore) {
        query.completedAt.$lte = new Date(filters.completedBefore);
      }
    }
    
    // Time estimate filtering
    if (filters.estimatedTimeMin || filters.estimatedTimeMax) {
      query.estimatedTime = {};
      if (filters.estimatedTimeMin) {
        query.estimatedTime.$gte = parseInt(filters.estimatedTimeMin);
      }
      if (filters.estimatedTimeMax) {
        query.estimatedTime.$lte = parseInt(filters.estimatedTimeMax);
      }
    }
    
    // Text search across title and description
    if (filters.search && filters.search.trim()) {
      const searchRegex = new RegExp(filters.search.trim(), 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex }
      ];
    }
    
    return query;
  }
  
  static buildSortOptions(sortBy = 'createdAt', sortOrder = 'desc') {
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    return sort;
  }
  
  static validateFilters(filters) {
    const errors = [];
    
    // Validate date formats
    if (filters.dateFrom && !this.isValidDate(filters.dateFrom)) {
      errors.push('Invalid dateFrom format. Use ISO 8601 format.');
    }
    
    if (filters.dateTo && !this.isValidDate(filters.dateTo)) {
      errors.push('Invalid dateTo format. Use ISO 8601 format.');
    }
    
    // Validate date range
    if (filters.dateFrom && filters.dateTo) {
      const fromDate = new Date(filters.dateFrom);
      const toDate = new Date(filters.dateTo);
      if (fromDate > toDate) {
        errors.push('dateFrom must be before dateTo');
      }
    }
    
    // Validate time estimates
    if (filters.estimatedTimeMin && filters.estimatedTimeMax) {
      const min = parseInt(filters.estimatedTimeMin);
      const max = parseInt(filters.estimatedTimeMax);
      if (min > max) {
        errors.push('estimatedTimeMin must be less than estimatedTimeMax');
      }
    }
    
    return errors;
  }
  
  static isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }
}

export default TaskFilterService;
```

---

## 3. TESTING REQUIREMENTS AND PATTERNS

### 3.1 Test-Driven Development (TDD) Approach

**ALWAYS follow this TDD cycle:**
1. **RED:** Write a failing test first
2. **GREEN:** Write minimal code to make the test pass
3. **REFACTOR:** Improve code while keeping tests green

### 3.2 Backend Testing Patterns

#### Unit Test Structure
```javascript
// tests/services/exportService.unit.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import ExportService from '../../src/services/exportService.js';

describe('ExportService', () => {
  let mockTaskModel;
  let mockExportModel;
  let mockRedisClient;

  beforeEach(() => {
    // Setup mocks
    mockTaskModel = {
      find: () => ({
        sort: () => Promise.resolve([])
      })
    };
    
    mockExportModel = {
      findByIdAndUpdate: () => Promise.resolve({}),
      save: () => Promise.resolve({ _id: 'test-id' })
    };
    
    mockRedisClient = {
      get: () => Promise.resolve(null),
      setex: () => Promise.resolve('OK')
    };
  });

  afterEach(() => {
    // Cleanup
  });

  describe('generateCSV', () => {
    it('should generate valid CSV with headers', async () => {
      const tasks = [
        { title: 'Task 1', status: 'pending', createdAt: new Date() },
        { title: 'Task 2', status: 'completed', createdAt: new Date() }
      ];
      
      const csv = await ExportService.generateCSV(tasks);
      
      assert.ok(csv.includes('Title,Description,Status'));
      assert.ok(csv.includes('Task 1'));
      assert.ok(csv.includes('Task 2'));
    });

    it('should handle empty task list', async () => {
      const csv = await ExportService.generateCSV([]);
      
      assert.ok(csv.includes('Title,Description,Status'));
      // Should have header row only
      assert.strictEqual(csv.split('\n').length, 2);
    });

    it('should escape CSV special characters', async () => {
      const tasks = [
        { 
          title: 'Task with "quotes"', 
          description: 'Contains, comma',
          status: 'pending',
          createdAt: new Date()
        }
      ];
      
      const csv = await ExportService.generateCSV(tasks);
      
      assert.ok(csv.includes('"Task with ""quotes"""'));
      assert.ok(csv.includes('"Contains, comma"'));
    });
  });

  describe('buildFilterQuery', () => {
    it('should build correct MongoDB query for date filters', () => {
      const filters = {
        dateFrom: '2023-01-01',
        dateTo: '2023-12-31',
        status: ['pending', 'in-progress']
      };
      
      const query = ExportService.buildFilterQuery(filters);
      
      assert.ok(query.createdAt);
      assert.ok(query.createdAt.$gte);
      assert.ok(query.createdAt.$lte);
      assert.ok(query.status);
      assert.ok(query.status.$in);
    });

    it('should handle text search filters', () => {
      const filters = {
        search: 'important task'
      };
      
      const query = ExportService.buildFilterQuery(filters);
      
      assert.ok(query.$or);
      assert.strictEqual(query.$or.length, 2);
    });
  });

  describe('caching', () => {
    it('should generate consistent cache keys', () => {
      const filters1 = { status: 'pending' };
      const filters2 = { status: 'pending' };
      
      const key1 = ExportService.generateCacheKey(filters1, 'csv');
      const key2 = ExportService.generateCacheKey(filters2, 'csv');
      
      assert.strictEqual(key1, key2);
    });
  });
});
```

#### Integration Test Structure
```javascript
// tests/routes/exportRoutes.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../../src/index.js';
import { setupTestDatabase, cleanupTestDatabase } from '../utils/testHelpers.js';

describe('Export API Integration', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  describe('POST /api/exports', () => {
    it('should create export request successfully', async () => {
      const exportRequest = {
        format: 'csv',
        filters: { status: 'pending' }
      };

      const response = await request(app)
        .post('/api/exports')
        .send(exportRequest)
        .expect(201);

      assert.ok(response.body.success);
      assert.ok(response.body.data.exportId);
      assert.strictEqual(response.body.data.status, 'processing');
    });

    it('should validate export format', async () => {
      const exportRequest = {
        format: 'invalid',
        filters: {}
      };

      await request(app)
        .post('/api/exports')
        .send(exportRequest)
        .expect(400);
    });
  });
});
```

### 3.3 Frontend Testing Patterns

#### Component Unit Tests
```javascript
// tests/components/ExportDialog.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import ExportDialog from '@/components/ExportDialog.vue';

describe('ExportDialog', () => {
  let wrapper;
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    
    wrapper = mount(ExportDialog, {
      props: {
        filters: { status: 'pending' },
        modelValue: true
      },
      global: {
        plugins: [pinia]
      }
    });
  });

  it('should render export dialog', () => {
    expect(wrapper.exists()).toBe(true);
    expect(wrapper.find('[data-test="format-csv"]').exists()).toBe(true);
  });

  it('should emit export event with correct parameters', async () => {
    const csvRadio = wrapper.find('[data-test="format-csv"]');
    await csvRadio.trigger('click');
    
    const filenameInput = wrapper.find('[data-test="filename"]');
    await filenameInput.setValue('test-export');
    
    const exportButton = wrapper.find('[data-test="start-export"]');
    await exportButton.trigger('click');
    
    expect(wrapper.emitted('export-created')).toBeTruthy();
  });
});
```

#### Store Tests
```javascript
// tests/stores/exportStore.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useExportStore } from '@/stores/exportStore.js';

vi.mock('@/api/client.js', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn()
  }
}));

describe('Export Store', () => {
  let exportStore;

  beforeEach(() => {
    setActivePinia(createPinia());
    exportStore = useExportStore();
  });

  it('should track active exports count', () => {
    exportStore.exports = [
      { id: '1', status: 'processing' },
      { id: '2', status: 'completed' }
    ];
    
    expect(exportStore.activeExports).toHaveLength(1);
  });

  it('should create export successfully', async () => {
    const mockExport = { id: 'test-123', status: 'processing' };
    
    const api = await import('@/api/client.js');
    api.default.post.mockResolvedValue({ data: mockExport });

    const result = await exportStore.createExport({ format: 'csv' });

    expect(result).toEqual(mockExport);
    expect(exportStore.exports).toContain(mockExport);
  });
});
```

### 3.4 Performance Tests
```javascript
// tests/performance/exportPerformance.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';
import ExportService from '../../src/services/exportService.js';

describe('Export Performance', () => {
  it('should handle large dataset export within time limit', async () => {
    const largeTasks = Array.from({ length: 10000 }, (_, i) => ({
      title: `Task ${i}`,
      description: `Description ${i}`,
      status: 'pending',
      createdAt: new Date()
    }));

    const startTime = Date.now();
    const csv = await ExportService.generateCSV(largeTasks);
    const endTime = Date.now();
    
    const processingTime = endTime - startTime;
    
    // Should complete within 5 seconds
    assert.ok(processingTime < 5000, `Export took ${processingTime}ms`);
    
    // Should contain all records
    const lines = csv.split('\n');
    assert.ok(lines.length > 10000);
  });
});
```

---

## 4. REAL-TIME INTEGRATION PATTERNS

### 4.1 Socket.IO Implementation

#### Backend Socket Handlers
```javascript
// sockets/exportHandlers.js
import { Server } from 'socket.io';

export const setupExportHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Join export room for updates
    socket.join('export-updates');
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
};

export const broadcastExportProgress = (io, exportId, progress) => {
  io.to('export-updates').emit('export-progress', {
    exportId,
    progress,
    timestamp: new Date()
  });
};

export const broadcastExportComplete = (io, exportId, downloadUrl) => {
  io.to('export-updates').emit('export-completed', {
    exportId,
    downloadUrl,
    timestamp: new Date()
  });
};

export const broadcastExportFailed = (io, exportId, error) => {
  io.to('export-updates').emit('export-failed', {
    exportId,
    error,
    timestamp: new Date()
  });
};
```

#### Frontend Socket Integration
```javascript
// composables/useSocket.js
import { ref, onMounted, onUnmounted } from 'vue';
import { io } from 'socket.io-client';
import { useExportStore } from '@/stores/exportStore';

export const useSocket = () => {
  const socket = ref(null);
  const connected = ref(false);
  const exportStore = useExportStore();

  onMounted(() => {
    socket.value = io(import.meta.env.VITE_SOCKET_URL);
    
    socket.value.on('connect', () => {
      connected.value = true;
      console.log('Socket connected');
    });

    socket.value.on('disconnect', () => {
      connected.value = false;
      console.log('Socket disconnected');
    });

    socket.value.on('export-progress', (data) => {
      exportStore.updateExportProgress(data);
    });

    socket.value.on('export-completed', (data) => {
      exportStore.markExportCompleted(data);
    });

    socket.value.on('export-failed', (data) => {
      exportStore.markExportFailed(data);
    });
  });

  onUnmounted(() => {
    if (socket.value) {
      socket.value.disconnect();
    }
  });

  return {
    socket,
    connected
  };
};
```

---

## 5. PERFORMANCE AND CACHING GUIDELINES

### 5.1 Redis Caching Patterns
```javascript
// utils/cacheUtils.js
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6380,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3
});

export class CacheService {
  static async get(key) {
    try {
      const result = await redis.get(key);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  static async set(key, value, ttl = 3600) {
    try {
      const serialized = JSON.stringify(value);
      await redis.setex(key, ttl, serialized);
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  static async invalidatePattern(pattern) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      return true;
    } catch (error) {
      console.error('Cache invalidation error:', error);
      return false;
    }
  }

  static generateExportCacheKey(filters, format) {
    const filterHash = Buffer.from(JSON.stringify(filters)).toString('base64');
    return `export:${format}:${filterHash}`;
  }
}
```

### 5.2 Database Optimization
```javascript
// Database indexes for performance
// In models/Task.js
TaskSchema.index({ status: 1, createdAt: -1 });
TaskSchema.index({ priority: 1, createdAt: -1 });
TaskSchema.index({ createdAt: -1 });
TaskSchema.index({ completedAt: -1 });
TaskSchema.index({ 
  title: 'text', 
  description: 'text' 
}, { 
  name: 'text_search_index' 
});

// In models/Export.js
ExportSchema.index({ userId: 1, createdAt: -1 });
ExportSchema.index({ status: 1, createdAt: -1 });
ExportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

---

## 6. ERROR HANDLING AND VALIDATION

### 6.1 Input Validation
```javascript
// middleware/validation.js
import Joi from 'joi';

export const validateExportRequest = (req, res, next) => {
  const schema = Joi.object({
    format: Joi.string().valid('csv', 'json').required(),
    filters: Joi.object({
      status: Joi.array().items(Joi.string().valid('pending', 'in-progress', 'completed')),
      priority: Joi.array().items(Joi.string().valid('low', 'medium', 'high')),
      dateFrom: Joi.date().iso(),
      dateTo: Joi.date().iso().min(Joi.ref('dateFrom')),
      search: Joi.string().max(255),
      estimatedTimeMin: Joi.number().min(0),
      estimatedTimeMax: Joi.number().min(Joi.ref('estimatedTimeMin'))
    }).default({}),
    filename: Joi.string().max(255).optional()
  });

  const { error, value } = schema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  req.body = value;
  next();
};
```

### 6.2 Error Boundary Pattern
```vue
<!-- components/ErrorBoundary.vue -->
<template>
  <div v-if="hasError" class="error-boundary">
    <v-alert
      type="error"
      prominent
      border="left"
      class="mb-4"
    >
      <v-alert-title>Something went wrong</v-alert-title>
      <div>{{ error.message }}</div>
      <template v-slot:append>
        <v-btn @click="retry" variant="outlined">
          Retry
        </v-btn>
      </template>
    </v-alert>
  </div>
  <slot v-else />
</template>

<script setup>
import { ref, onErrorCaptured } from 'vue';

const hasError = ref(false);
const error = ref(null);

const emit = defineEmits(['error']);

onErrorCaptured((err, instance, info) => {
  hasError.value = true;
  error.value = err;
  emit('error', { error: err, instance, info });
  
  // Log error for debugging
  console.error('Error caught by boundary:', err);
  
  return false; // Prevent error from bubbling up
});

const retry = () => {
  hasError.value = false;
  error.value = null;
  // Trigger component refresh
  location.reload();
};
</script>
```

---

## 7. SECURITY GUIDELINES

### 7.1 Input Sanitization
```javascript
// utils/sanitization.js
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/[{}]/g, '') // Remove object notation
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
};

export const sanitizeFilters = (filters) => {
  const sanitized = {};
  
  if (filters.search) {
    sanitized.search = sanitizeInput(filters.search);
  }
  
  if (filters.status) {
    sanitized.status = Array.isArray(filters.status) 
      ? filters.status.map(s => sanitizeInput(s))
      : sanitizeInput(filters.status);
  }
  
  // Copy other safe fields
  ['priority', 'dateFrom', 'dateTo', 'estimatedTimeMin', 'estimatedTimeMax']
    .forEach(field => {
      if (filters[field] !== undefined) {
        sanitized[field] = filters[field];
      }
    });
  
  return sanitized;
};
```

### 7.2 File Security
```javascript
// utils/fileUtils.js
import path from 'path';
import fs from 'fs';

export const validateFilePath = (filePath) => {
  const normalized = path.normalize(filePath);
  const exportDir = path.resolve('./exports');
  
  // Ensure file is within exports directory
  if (!normalized.startsWith(exportDir)) {
    throw new Error('Invalid file path');
  }
  
  return normalized;
};

export const secureFileDelete = async (filePath) => {
  try {
    const validPath = validateFilePath(filePath);
    
    // Check if file exists
    if (fs.existsSync(validPath)) {
      await fs.promises.unlink(validPath);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('File deletion error:', error);
    return false;
  }
};
```

---

## 8. TESTING COVERAGE REQUIREMENTS

### 8.1 Coverage Targets
**Backend:**
- Unit tests: 90% line coverage
- Integration tests: 85% line coverage
- All critical paths covered

**Frontend:**
- Component tests: 80% line coverage
- Store tests: 95% line coverage
- E2E tests: 70% critical path coverage

### 8.2 Test Commands
```bash
# Backend testing
npm run test:unit          # Unit tests only
npm run test:export        # Export-specific tests
npm run test:coverage      # Coverage report
npm run test:all           # All tests

# Frontend testing
npm run test               # Unit tests
npm run test:coverage      # Coverage report
npm run test:e2e          # End-to-end tests
```

---

## 9. DEPLOYMENT AND MONITORING

### 9.1 Environment Variables
```bash
# Backend .env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27018/task-analytics
REDIS_HOST=localhost
REDIS_PORT=6380
EXPORT_DIR=./exports
EXPORT_TTL=604800  # 7 days in seconds
MAX_CONCURRENT_EXPORTS=10

# Frontend .env
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
```

### 9.2 Health Checks
```javascript
// routes/health.js
router.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      redis: 'unknown',
      filesystem: 'unknown'
    }
  };

  try {
    // Check database
    await mongoose.connection.db.admin().ping();
    health.services.database = 'healthy';
  } catch (error) {
    health.services.database = 'unhealthy';
    health.status = 'degraded';
  }

  try {
    // Check Redis
    await redis.ping();
    health.services.redis = 'healthy';
  } catch (error) {
    health.services.redis = 'unhealthy';
    health.status = 'degraded';
  }

  try {
    // Check filesystem
    await fs.promises.access('./exports', fs.constants.W_OK);
    health.services.filesystem = 'healthy';
  } catch (error) {
    health.services.filesystem = 'unhealthy';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

---

## 10. COPILOT CODING GUIDELINES

### 10.1 Code Generation Preferences
When generating code, ALWAYS:
- Follow the established patterns in this document
- Include comprehensive error handling
- Add appropriate JSDoc comments
- Include data-test attributes for testing
- Implement proper validation
- Follow the existing file structure
- Use the established naming conventions

### 10.2 Testing Preferences
When generating tests, ALWAYS:
- Write tests in TDD style (test first)
- Include both positive and negative test cases
- Test edge cases and error conditions
- Use descriptive test names
- Include setup and teardown when needed
- Mock external dependencies
- Test async operations properly

### 10.3 Component Generation
When generating Vue components, ALWAYS:
- Use Composition API with `<script setup>`
- Include proper TypeScript-style prop definitions
- Add data-test attributes for testing
- Use Vuetify 3 components consistently
- Include proper error handling
- Follow the established component structure
- Include accessibility attributes

### 10.4 API Generation
When generating API endpoints, ALWAYS:
- Follow the established response format
- Include proper validation middleware
- Add comprehensive error handling
- Include rate limiting considerations
- Add proper logging
- Include caching where appropriate
- Follow RESTful conventions

---

## 11. FINAL REMINDERS

1. **Test-Driven Development**: Always write tests before implementation
2. **Code Quality**: Maintain high code quality standards with proper linting
3. **Performance**: Consider performance implications of every implementation
4. **Security**: Validate and sanitize all inputs
5. **Documentation**: Document complex business logic and architectural decisions
6. **Integration**: Ensure seamless integration with existing codebase
7. **Real-time**: Implement proper real-time updates for user feedback
8. **Caching**: Use caching effectively to improve performance
9. **Error Handling**: Implement graceful error handling throughout
10. **Monitoring**: Include proper logging and monitoring capabilities

This document serves as your comprehensive guide for implementing the Task Export and Advanced Filtering System. Follow these patterns and requirements to ensure a high-quality, maintainable, and well-tested implementation.