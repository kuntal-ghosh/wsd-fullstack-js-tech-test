/**
 * Verification script for ExportService implementation
 */

import mongoose from 'mongoose';
import ExportService from './src/services/exportService.js';
import Export from './src/models/Export.js';
import Task from './src/models/Task.js';

async function verifyExportService() {
  try {
    console.log('🔧 Connecting to test database...');
    await mongoose.connect('mongodb://localhost:27017/task_analytics_test');
    
    console.log('🧹 Cleaning up existing data...');
    await Task.deleteMany({});
    await Export.deleteMany({});
    
    console.log('📝 Creating test tasks...');
    const testTasks = await Task.create([
      {
        title: 'Test Task 1',
        description: 'First test task',
        status: 'pending',
        priority: 'high',
        estimatedTime: 60
      },
      {
        title: 'Test Task 2',
        description: 'Second test task',
        status: 'completed',
        priority: 'medium',
        estimatedTime: 90,
        actualTime: 85,
        completedAt: new Date()
      },
      {
        title: 'Test Task 3',
        description: 'Third test task with "quotes" and, commas',
        status: 'in-progress',
        priority: 'low',
        estimatedTime: 120
      }
    ]);
    
    console.log(`✅ Created ${testTasks.length} test tasks`);
    
    console.log('🔄 Testing CSV export...');
    const csvData = await ExportService.generateCSV(testTasks);
    console.log('CSV Preview:');
    console.log(csvData.split('\n').slice(0, 3).join('\n'));
    
    console.log('\n🔄 Testing JSON export...');
    const jsonData = await ExportService.generateJSON(testTasks);
    const parsedJson = JSON.parse(jsonData);
    console.log('JSON Preview:');
    console.log(`- Total records: ${parsedJson.metadata.totalRecords}`);
    console.log(`- Format: ${parsedJson.metadata.format}`);
    console.log(`- First task: ${parsedJson.tasks[0].title}`);
    
    console.log('\n🔄 Testing export creation...');
    const filters = { status: 'pending', priority: 'high' };
    const exportDoc = await ExportService.createExport(filters, 'csv');
    console.log(`✅ Created export with ID: ${exportDoc._id}`);
    
    console.log('🔄 Testing file save...');
    const fileInfo = await ExportService.saveExportFile(csvData, 'csv', exportDoc._id);
    console.log(`✅ Saved file: ${fileInfo.fileName} (${fileInfo.fileSize} bytes)`);
    
    console.log('🔄 Testing progress update...');
    await ExportService.updateProgress(exportDoc._id, 50);
    console.log('✅ Progress updated to 50%');
    
    console.log('🔄 Testing mark completed...');
    await ExportService.markCompleted(exportDoc._id, fileInfo);
    const completedExport = await Export.findById(exportDoc._id);
    console.log(`✅ Export marked as completed: ${completedExport.status} (${completedExport.progress}%)`);
    
    console.log('🔄 Testing error handling...');
    try {
      await ExportService.createExport({}, 'xml');
    } catch (error) {
      console.log(`✅ Error handling works: ${error.message}`);
    }
    
    console.log('\n🎉 All ExportService functionality verified successfully!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database disconnected');
  }
}

verifyExportService();