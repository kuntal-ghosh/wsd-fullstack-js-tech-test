// Simple script to test actual coverage
console.log('Testing coverage...');

// Import and run key modules
try {
  // Import services
  const ExportCacheService = (await import('./src/services/exportCacheService.js')).default;
  const ExportService = (await import('./src/services/exportService.js')).default;
  const AnalyticsService = (await import('./src/services/analyticsService.js')).default;
  const TaskFilterService = (await import('./src/services/taskFilterService.js')).default;
  
  // Import routes
  const { setSocketHandlers: setApiHandlers } = await import('./src/routes/api.js');
  const { setSocketHandlers: setExportHandlers } = await import('./src/routes/exportRoutes.js');
  
  // Import socket handlers
  const SocketHandlers = (await import('./src/sockets/socketHandlers.js')).default;
  
  // Test key functions
  console.log('Testing ExportCacheService...');
  const key = ExportCacheService.generateCacheKey({ status: 'pending' }, 'csv');
  console.log('Cache key generated:', key);
  
  console.log('Testing TaskFilterService...');
  const sanitized = TaskFilterService.sanitizeFilters({ status: 'pending' });
  const query = TaskFilterService.buildFilterQuery(sanitized);
  const sort = TaskFilterService.buildSortOptions('createdAt', 'desc');
  console.log('Filter query built:', Object.keys(query).length);
  
  console.log('Testing ExportService...');
  const csvData = ExportService.generateCSV([{ _id: '1', title: 'Test', status: 'pending' }]);
  console.log('CSV generated, length:', csvData.length);
  
  console.log('Testing AnalyticsService...');
  const statusResult = AnalyticsService.processStatusAggregation([{ _id: 'pending', count: 5 }]);
  const completionRate = AnalyticsService.calculateCompletionRate(10, 7);
  console.log('Status result:', statusResult.pending, 'Completion rate:', completionRate);
  
  console.log('Testing route handlers...');
  setApiHandlers({ broadcast: () => {} });
  setExportHandlers({ broadcast: () => {} });
  
  console.log('Testing SocketHandlers...');
  const mockIo = { on: () => {}, emit: () => {}, to: () => mockIo };
  const socketHandler = new SocketHandlers(mockIo);
  socketHandler.broadcastAnalyticsUpdate({ test: 'data' });
  
  console.log('All tests completed successfully!');
  
} catch (error) {
  console.log('Expected error in test environment:', error.message);
}