/**
 * @fileoverview Browser compatibility tests for export functionality
 * @module tests/e2e/exportBrowserCompat
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useExportStore } from '@/stores/exportStore';

// Mock API client
vi.mock('@/api/client', () => {
  return {
    default: {
      downloadExport: vi.fn()
    }
  };
});

describe('Export Browser Compatibility Tests', () => {
  let exportStore;
  let apiClient;
  let originalBlob;
  let originalCreateObjectURL;
  let originalRevokeObjectURL;
  let originalDocument;
  let originalNavigator;
  let mockLink;

  beforeEach(() => {
    // Setup Pinia
    const pinia = createPinia();
    setActivePinia(pinia);
    exportStore = useExportStore();
    
    // Get API client
    apiClient = (await import('@/api/client')).default;
    
    // Save original browser objects
    originalBlob = global.Blob;
    originalCreateObjectURL = global.URL?.createObjectURL;
    originalRevokeObjectURL = global.URL?.revokeObjectURL;
    originalDocument = { ...global.document };
    originalNavigator = { ...global.navigator };
    
    // Create mock link element
    mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
      style: {},
      setAttribute: vi.fn()
    };
    
    // Mock document methods
    global.document.createElement = vi.fn(() => mockLink);
    global.document.body = {
      appendChild: vi.fn(),
      removeChild: vi.fn()
    };
    
    // Mock URL methods
    global.URL = {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn()
    };
    
    // Set test exports in store
    exportStore.exports = [
      {
        _id: 'csv-export',
        status: 'completed',
        progress: 100,
        format: 'csv',
        downloadUrl: '/api/exports/csv-export/download',
        filename: 'tasks-export.csv',
        fileSize: 2048,
        totalRecords: 50
      },
      {
        _id: 'json-export',
        status: 'completed',
        progress: 100,
        format: 'json',
        downloadUrl: '/api/exports/json-export/download',
        filename: 'tasks-export.json',
        fileSize: 4096,
        totalRecords: 50
      }
    ];
  });
  
  afterEach(() => {
    // Restore original browser objects
    global.Blob = originalBlob;
    if (originalCreateObjectURL) global.URL.createObjectURL = originalCreateObjectURL;
    if (originalRevokeObjectURL) global.URL.revokeObjectURL = originalRevokeObjectURL;
    global.document = originalDocument;
    global.navigator = originalNavigator;
    
    vi.resetAllMocks();
  });

  describe('Chrome/Firefox/Edge (Modern Browsers)', () => {
    it('should download CSV files with correct MIME type', async () => {
      // Setup for Chrome/Firefox
      global.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36';
      
      // Mock fetch response for CSV
      const csvBlob = new Blob(['id,title,status\n1,Task 1,pending'], { type: 'text/csv' });
      const csvResponse = {
        ok: true,
        blob: vi.fn().mockResolvedValue(csvBlob),
        headers: new Map([
          ['Content-Type', 'text/csv'],
          ['Content-Disposition', 'attachment; filename="tasks-export.csv"']
        ])
      };
      csvResponse.headers.get = header => csvResponse.headers.get(header);
      
      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue(csvResponse);
      
      // Download CSV export
      await exportStore.downloadExport('csv-export', 'tasks-export.csv');
      
      // Check that fetch was called with correct URL
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/exports/csv-export/download',
        expect.any(Object)
      );
      
      // Check that blob URL was created
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(csvBlob);
      
      // Check that link was created and clicked
      expect(global.document.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.download).toBe('tasks-export.csv');
      expect(mockLink.href).toBe('blob:mock-url');
      expect(mockLink.click).toHaveBeenCalled();
      
      // Check that URL was revoked
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
    
    it('should download JSON files with correct MIME type', async () => {
      // Setup for Chrome/Firefox
      global.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36';
      
      // Mock fetch response for JSON
      const jsonData = { tasks: [{ id: 1, title: 'Task 1', status: 'pending' }] };
      const jsonBlob = new Blob([JSON.stringify(jsonData)], { type: 'application/json' });
      const jsonResponse = {
        ok: true,
        blob: vi.fn().mockResolvedValue(jsonBlob),
        headers: new Map([
          ['Content-Type', 'application/json'],
          ['Content-Disposition', 'attachment; filename="tasks-export.json"']
        ])
      };
      jsonResponse.headers.get = header => jsonResponse.headers.get(header);
      
      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue(jsonResponse);
      
      // Download JSON export
      await exportStore.downloadExport('json-export', 'tasks-export.json');
      
      // Check that fetch was called with correct URL
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/exports/json-export/download',
        expect.any(Object)
      );
      
      // Check that blob URL was created
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(jsonBlob);
      
      // Check that link was created and clicked
      expect(global.document.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.download).toBe('tasks-export.json');
      expect(mockLink.href).toBe('blob:mock-url');
      expect(mockLink.click).toHaveBeenCalled();
      
      // Check that URL was revoked
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
    
    it('should handle download progress tracking for large files', async () => {
      // Setup mock XHR
      const originalXHR = global.XMLHttpRequest;
      const mockXHR = {
        open: vi.fn(),
        send: vi.fn(),
        setRequestHeader: vi.fn(),
        responseType: '',
        onload: null,
        onprogress: null,
        onerror: null,
        status: 200,
        response: new Blob(['large file content'], { type: 'text/csv' })
      };
      global.XMLHttpRequest = vi.fn(() => mockXHR);
      
      // Mock URL and document
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      
      // Start download with progress tracking
      const downloadPromise = exportStore.downloadExportWithProgress('csv-export', 'tasks-export.csv');
      
      // Simulate progress events
      if (mockXHR.onprogress) {
        [10, 25, 50, 75, 100].forEach(percent => {
          mockXHR.onprogress({
            loaded: percent,
            total: 100
          });
          
          // Check progress was tracked
          expect(exportStore.downloadProgress['csv-export'].progress).toBe(percent);
        });
      }
      
      // Simulate load complete
      if (mockXHR.onload) {
        mockXHR.onload();
      }
      
      await downloadPromise;
      
      // Check final state
      expect(exportStore.downloadProgress['csv-export'].completed).toBe(true);
      
      // Restore XHR
      global.XMLHttpRequest = originalXHR;
    });
  });
  
  describe('Safari Browser', () => {
    it('should handle Safari-specific download behavior', async () => {
      // Setup for Safari
      global.navigator.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15';
      
      // Mock fetch response
      const csvBlob = new Blob(['id,title,status\n1,Task 1,pending'], { type: 'text/csv' });
      const csvResponse = {
        ok: true,
        blob: vi.fn().mockResolvedValue(csvBlob),
        headers: new Map([
          ['Content-Type', 'text/csv'],
          ['Content-Disposition', 'attachment; filename="tasks-export.csv"']
        ])
      };
      csvResponse.headers.get = header => csvResponse.headers.get(header);
      
      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue(csvResponse);
      
      // Safari requires special handling for some downloads
      // The link should be made visible and/or use a window.open approach
      
      // Download export
      await exportStore.downloadExport('csv-export', 'tasks-export.csv');
      
      // Check that link had visibility modification (Safari workaround)
      expect(mockLink.setAttribute).toHaveBeenCalledWith('target', '_blank');
      expect(mockLink.click).toHaveBeenCalled();
    });
  });
  
  describe('Internet Explorer Compatibility', () => {
    it('should handle IE-specific download approach', async () => {
      // Setup for IE
      global.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko';
      
      // Remove Blob support to simulate old IE
      global.Blob = undefined;
      
      // Create mock msSaveBlob for IE
      global.navigator.msSaveBlob = vi.fn();
      global.navigator.msSaveOrOpenBlob = vi.fn();
      
      // Mock fetch response
      const csvData = 'id,title,status\n1,Task 1,pending';
      const csvResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue(csvData),
        headers: new Map([
          ['Content-Type', 'text/csv'],
          ['Content-Disposition', 'attachment; filename="tasks-export.csv"']
        ])
      };
      csvResponse.headers.get = header => csvResponse.headers.get(header);
      
      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue(csvResponse);
      
      // Download export
      await exportStore.downloadExport('csv-export', 'tasks-export.csv');
      
      // Should use msSaveBlob or msSaveOrOpenBlob for IE
      expect(global.navigator.msSaveBlob).toHaveBeenCalled() || 
      expect(global.navigator.msSaveOrOpenBlob).toHaveBeenCalled();
      
      // Link should not be created
      expect(global.document.createElement).not.toHaveBeenCalled();
    });
  });
  
  describe('Mobile Browsers', () => {
    it('should handle mobile browser download behavior', async () => {
      // Setup for Mobile Safari
      global.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';
      
      // Mock fetch response
      const csvBlob = new Blob(['id,title,status\n1,Task 1,pending'], { type: 'text/csv' });
      const csvResponse = {
        ok: true,
        blob: vi.fn().mockResolvedValue(csvBlob),
        headers: new Map([
          ['Content-Type', 'text/csv'],
          ['Content-Disposition', 'attachment; filename="tasks-export.csv"']
        ])
      };
      csvResponse.headers.get = header => csvResponse.headers.get(header);
      
      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue(csvResponse);
      
      // Download export
      await exportStore.downloadExport('csv-export', 'tasks-export.csv');
      
      // Mobile browsers often need special handling
      expect(mockLink.setAttribute).toHaveBeenCalledWith('target', '_blank');
      expect(mockLink.click).toHaveBeenCalled();
    });
  });
  
  describe('Download Error Handling', () => {
    it('should handle network errors during download', async () => {
      // Mock network failure
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      
      // Attempt download
      await expect(exportStore.downloadExport('csv-export')).rejects.toThrow('Network error');
      
      // Check error was tracked in download progress
      expect(exportStore.downloadProgress['csv-export'].error).toBeTruthy();
      expect(exportStore.downloadProgress['csv-export'].downloading).toBe(false);
    });
    
    it('should handle server errors during download', async () => {
      // Mock server error response
      const errorResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: vi.fn().mockResolvedValue({
          message: 'Server error occurred'
        })
      };
      
      global.fetch = vi.fn().mockResolvedValue(errorResponse);
      
      // Attempt download
      await expect(exportStore.downloadExport('csv-export')).rejects.toThrow();
      
      // Check error was tracked in download progress
      expect(exportStore.downloadProgress['csv-export'].error).toBeTruthy();
      expect(exportStore.downloadProgress['csv-export'].downloading).toBe(false);
    });
    
    it('should handle export not found', async () => {
      // Mock not found response
      const notFoundResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: vi.fn().mockResolvedValue({
          message: 'Export not found'
        })
      };
      
      global.fetch = vi.fn().mockResolvedValue(notFoundResponse);
      
      // Attempt download
      await expect(exportStore.downloadExport('nonexistent-export')).rejects.toThrow();
      
      // Check error was tracked in download progress
      expect(exportStore.downloadProgress['nonexistent-export'].error).toBeTruthy();
      expect(exportStore.downloadProgress['nonexistent-export'].downloading).toBe(false);
    });
  });
});