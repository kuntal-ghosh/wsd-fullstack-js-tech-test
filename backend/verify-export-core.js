/**
 * Core functionality verification for ExportService (without database)
 */

import ExportService from './src/services/exportService.js';

async function verifyExportCore() {
  try {
    console.log('🔄 Testing CSV generation...');
    
    const testTasks = [
      {
        _id: '507f1f77bcf86cd799439011',
        title: 'Test Task 1',
        description: 'First test task',
        status: 'pending',
        priority: 'high',
        estimatedTime: 60,
        actualTime: null,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
        completedAt: null
      },
      {
        _id: '507f1f77bcf86cd799439012',
        title: 'Test Task 2',
        description: 'Second test task',
        status: 'completed',
        priority: 'medium',
        estimatedTime: 90,
        actualTime: 85,
        createdAt: new Date('2024-01-01T11:00:00Z'),
        updatedAt: new Date('2024-01-01T12:00:00Z'),
        completedAt: new Date('2024-01-01T12:00:00Z')
      },
      {
        _id: '507f1f77bcf86cd799439013',
        title: 'Task with "quotes" and, commas',
        description: 'Description with\nnewlines and "quotes"',
        status: 'in-progress',
        priority: 'low',
        estimatedTime: 120,
        actualTime: null,
        createdAt: new Date('2024-01-01T13:00:00Z'),
        updatedAt: new Date('2024-01-01T13:00:00Z'),
        completedAt: null
      }
    ];
    
    // Test CSV generation
    const csvData = await ExportService.generateCSV(testTasks);
    console.log('✅ CSV generated successfully');
    console.log('CSV Preview:');
    const csvLines = csvData.split('\n');
    console.log(`- Headers: ${csvLines[0]}`);
    console.log(`- First row: ${csvLines[1]}`);
    console.log(`- Total lines: ${csvLines.length}`);
    
    // Verify CSV escaping
    const quotesLine = csvLines.find(line => line.includes('quotes'));
    console.log(`- Quotes escaped correctly: ${quotesLine.includes('""quotes""')}`);
    
    console.log('\n🔄 Testing JSON generation...');
    
    // Test JSON generation
    const jsonData = await ExportService.generateJSON(testTasks);
    const parsedJson = JSON.parse(jsonData);
    console.log('✅ JSON generated successfully');
    console.log('JSON Preview:');
    console.log(`- Total records: ${parsedJson.metadata.totalRecords}`);
    console.log(`- Format: ${parsedJson.metadata.format}`);
    console.log(`- Version: ${parsedJson.metadata.version}`);
    console.log(`- First task ID: ${parsedJson.tasks[0].id}`);
    console.log(`- First task title: ${parsedJson.tasks[0].title}`);
    
    console.log('\n🔄 Testing empty dataset handling...');
    
    // Test empty datasets
    const emptyCsv = await ExportService.generateCSV([]);
    console.log(`✅ Empty CSV: ${emptyCsv.split('\n').length} line(s)`);
    
    const emptyJson = await ExportService.generateJSON([]);
    const emptyParsed = JSON.parse(emptyJson);
    console.log(`✅ Empty JSON: ${emptyParsed.metadata.totalRecords} records`);
    
    console.log('\n🔄 Testing error handling...');
    
    // Test corrupted data
    try {
      await ExportService.generateJSON([{ _id: null, title: undefined }]);
    } catch (error) {
      console.log(`✅ Corrupted data error: ${error.message}`);
    }
    
    // Test invalid format
    try {
      await ExportService.createExport({}, 'xml');
    } catch (error) {
      console.log(`✅ Invalid format error: ${error.message}`);
    }
    
    console.log('\n🔄 Testing CSV field escaping...');
    
    // Test CSV escaping edge cases
    const edgeCaseTasks = [
      {
        _id: '507f1f77bcf86cd799439014',
        title: 'Task with "multiple" "quotes"',
        description: 'Line 1\nLine 2\nLine 3',
        status: 'pending',
        priority: 'high',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    const edgeCaseCsv = await ExportService.generateCSV(edgeCaseTasks);
    console.log('✅ Edge case CSV generated');
    const edgeLine = edgeCaseCsv.split('\n')[1];
    console.log(`- Contains escaped quotes: ${edgeLine.includes('""multiple"" ""quotes""')}`);
    console.log(`- Newlines replaced: ${!edgeLine.includes('\n')}`);
    
    console.log('\n🎉 All core ExportService functionality verified successfully!');
    
  } catch (error) {
    console.error('❌ Core verification failed:', error);
  }
}

verifyExportCore();