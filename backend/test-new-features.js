#!/usr/bin/env node

// Simple test runner for our new testing features
const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 Running KPI Productivity 2026 Testing Suite');
console.log('================================================');

// Test our new unit tests
console.log('\n📋 Running unit tests for new components...');
try {
  execSync('npm run test -- src/services/__tests__/socketService.test.ts --run', { 
    stdio: 'inherit',
    cwd: __dirname 
  });
  console.log('✅ Socket service tests completed');
} catch (error) {
  console.log('❌ Socket service tests failed');
}

try {
  execSync('npm run test -- src/services/__tests__/teamAnalyticsService.test.ts --run', { 
    stdio: 'inherit',
    cwd: __dirname 
  });
  console.log('✅ Team analytics service tests completed');
} catch (error) {
  console.log('❌ Team analytics service tests failed');
}

// Test integration tests
console.log('\n🔗 Running integration tests...');
try {
  execSync('npm run test -- src/__tests__/integration/friends.test.ts --run', { 
    stdio: 'inherit',
    cwd: __dirname 
  });
  console.log('✅ Friends integration tests completed');
} catch (error) {
  console.log('❌ Friends integration tests failed');
}

console.log('\n📊 Testing Summary Complete');
console.log('Check individual test outputs above for detailed results');