# Toast Notification System for Export Status

## Overview

I've implemented a comprehensive toast notification system that shows different messages based on export status changes. The system provides real-time feedback to users about their export operations with contextual actions.

## Features Implemented

### 1. Toast Store (`src/stores/toastStore.js`)
- **Centralized toast management** with Pinia store
- **Multiple toast types**: success, error, warning, info
- **Auto-hide functionality** with configurable timeouts
- **Persistent toasts** for critical messages
- **Action buttons** support with custom handlers
- **Stacking management** for multiple simultaneous toasts

### 2. Toast Container Component (`src/components/ToastContainer.vue`)
- **Vuetify-based UI** with snackbars
- **Positioning system** for stacked toasts
- **Smooth animations** for enter/leave transitions
- **Responsive design** for mobile devices
- **Teleport to body** for proper z-index layering

### 3. Status-Specific Toast Messages

#### **Pending Status** 🟡
```javascript
// Toast: Info type with blue color
"Export 'filename.csv' is queued and waiting to start..."
Actions: [Cancel, View Queue]
Timeout: 4 seconds
```

#### **Processing Status** 🟣
```javascript
// Toast: Info type with processing details
"Export 'filename.csv' is now processing... Records: 1500"
Actions: [View Progress, Cancel]
Timeout: 5 seconds
Metadata: estimatedTime, recordCount
```

#### **Completed Status** ✅
```javascript
// Toast: Success type with file details
"Export 'filename.csv' completed successfully! File size: 2.0 MB"
Actions: [Download Now, View Details, Share]
Timeout: 7 seconds
Metadata: fileSize (formatted), recordCount, completedAt
```

#### **Failed Status** ❌
```javascript
// Toast: Error type with retry options
"Export 'filename.csv' failed: Database connection timeout"
Actions: [Retry Export, View Error Details, Create New Export]
Persistent: true (no auto-hide)
Metadata: error message, canRetry flag, failedAt
```

#### **Cancelled Status** ⚠️
```javascript
// Toast: Warning type
"Export 'filename.csv' was cancelled"
Actions: [Create New, View History]
Timeout: 4 seconds
```

### 4. Enhanced Export Store Integration

The export store now includes:
- **Smart status detection** - only shows toasts when status actually changes
- **Contextual actions** - different actions based on export state
- **Error handling** - graceful handling of missing exports
- **Metadata support** - rich information display

### 5. Download Status Toasts

#### **Download Started** 📥
```javascript
"Starting download of filename.csv..."
Actions: [Cancel]
Timeout: 3 seconds
```

#### **Download Progress** (for files > 1MB) 📊
```javascript
"Downloading... 50%"
Actions: [Hide]
Persistent: true, updates every 10%
```

#### **Download Completed** ✅
```javascript
"Download completed successfully! File size: 2.4 MB"
Actions: [Download Again]
Timeout: 5 seconds
```

#### **Download Failed** ❌
```javascript
"Download failed: Network error"
Actions: [Retry, Dismiss]
Persistent: true
```

### 6. Demo Component (`src/components/ToastDemo.vue`)

Interactive demo component with:
- **Individual status tests** - test each status type
- **Complete status flow simulation** - see full export lifecycle
- **Download flow simulation** - test download progress
- **Clear all toasts** - reset the demo

## Usage Examples

### Manual Status Toast
```javascript
import { useExportStore, useToastStore } from '@/stores'

const exportStore = useExportStore()
const toastStore = useToastStore()

// Show a processing status toast
exportStore.showStatusToast(
  toastStore,
  'processing',
  'my-export.csv',
  'export-id-123',
  { recordCount: 1500, estimatedTime: '2 minutes' }
)
```

### Automatic Status Updates (via Socket.IO)
```javascript
// This happens automatically when the backend sends status updates
socket.on('export-status-change', (data) => {
  exportStore.handleExportStatusChange(data)
  // Automatically shows appropriate toast based on status
})
```

### Custom Toast with Actions
```javascript
toastStore.showError(
  'Export failed: Database timeout',
  {
    actions: [
      {
        label: 'Retry',
        color: 'white',
        handler: () => {
          // Retry logic here
        }
      },
      {
        label: 'Report Issue',
        color: 'white',
        handler: () => {
          // Open support form
        }
      }
    ]
  }
)
```

## Technical Benefits

1. **User Experience**
   - Real-time feedback on export operations
   - Clear visual indicators for different states
   - Actionable buttons for quick user response
   - Non-intrusive notifications that auto-hide

2. **Developer Experience**
   - Type-safe with JSDoc annotations
   - Comprehensive test coverage
   - Modular and reusable components
   - Easy to extend with new status types

3. **Performance**
   - Efficient rendering with Vue 3 reactivity
   - Smart updates only when status changes
   - Minimal DOM manipulation
   - Proper cleanup and memory management

4. **Accessibility**
   - Proper ARIA labels and roles
   - Keyboard navigation support
   - High contrast colors
   - Screen reader friendly

## Integration with App

The toast system is integrated into the main application:

1. **App.vue** - Includes `<toast-container />` component
2. **Export Store** - Automatically shows toasts on status changes
3. **Socket.IO** - Real-time updates trigger appropriate toasts
4. **Error Handling** - All export operations show success/error toasts

## Testing

Comprehensive test suite includes:
- **Toast Store Tests** - All toast types and functionality
- **Export Store Integration Tests** - Status-specific toast behavior
- **Component Tests** - Toast container rendering and interactions
- **Action Button Tests** - Verify callback functions work correctly

The implementation follows TDD principles with tests written first, ensuring reliability and maintainability.

## File Structure

```
frontend/src/
├── stores/
│   ├── toastStore.js              # Central toast management
│   └── exportStore.js             # Enhanced with toast integration
├── components/
│   ├── ToastContainer.vue         # Toast rendering component
│   └── ToastDemo.vue             # Interactive demo
└── tests/
    ├── stores/
    │   ├── toastStore.test.js
    │   └── exportStore.status-toasts.test.js
    └── components/
        └── ToastContainer.test.js
```

This implementation provides a robust, user-friendly notification system that enhances the export experience with clear, actionable feedback for all export states.
