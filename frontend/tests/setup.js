/**
 * Test setup file for Vitest
 */
import { vi } from 'vitest';
import { config } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

// Mock CSS imports
vi.mock('*.css', () => ({}));
vi.mock('*.scss', () => ({}));
vi.mock('*.sass', () => ({}));

// Create a real Vuetify instance
const vuetify = createVuetify({
  components,
  directives,
});

// Apply Vuetify to vue-test-utils
config.global.plugins = [vuetify];

// Mock Socket.IO client
vi.mock('socket.io-client', () => ({
  default: {
    io: vi.fn(() => ({
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      connected: true,
    })),
  },
  io: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
  })),
}));

// Mock window.URL.createObjectURL for file download tests
global.URL = {
  createObjectURL: vi.fn(() => 'mock-blob-url'),
  revokeObjectURL: vi.fn(),
};

// Mock Blob for download tests
global.Blob = vi.fn(() => ({
  size: 1024,
  type: 'text/csv',
}));

// Mock fetch for download tests
global.fetch = vi.fn();

// Mock import.meta.env for API URL
Object.defineProperty(globalThis, 'import.meta', {
  value: {
    env: {
      VITE_API_URL: 'http://localhost:3001/api',
    },
  },
  writable: true,
});

// Mock ResizeObserver which Vuetify components use
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver which Vuetify components use
global.IntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));