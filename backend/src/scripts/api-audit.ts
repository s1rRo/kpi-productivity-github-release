#!/usr/bin/env ts-node

/**
 * API Documentation Audit Script
 * 
 * This script tests all documented API endpoints against the actual implementation
 * to identify discrepancies between documentation and code.
 * 
 * Requirements: 4.1, 4.2 - Test documented endpoints and verify response formats
 */

import axios, { AxiosResponse, AxiosError } from 'axios';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

interface TestResult {
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'MISSING' | 'MISMATCH';
  expectedStatus: number;
  actualStatus?: number;
  expectedResponse?: any;
  actualResponse?: any;
  error?: string;
  notes?: string;
}

interface AuditReport {
  summary: {
    total: number;
    passed: number;
    failed: number;
    missing: number;
    mismatched: number;
  };
  results: TestResult[];
  discrepancies: string[];
}

class APIAuditor {
  private baseURL: string;
  private prisma: PrismaClient;
  private authToken: string = '';
  private testUserId: string = '';
  private testHabitId: string = '';
  private results: TestResult[] = [];
  private discrepancies: string[] = [];

  constructor(baseURL: string = 'http://localhost:3001/api') {
    this.baseURL = baseURL;
    this.prisma = new PrismaClient();
  }

  async initialize(): Promise<void> {
    console.log('🔄 Initializing API audit...');
    
    // Create test user and get auth token
    await this.setupTestUser();
    
    // Create test data
    await this.setupTestData();
    
    console.log('✅ Initialization complete');
  }

  private async setupTestUser(): Promise<void> {
    const testEmail = `test-audit-${Date.now()}@example.com`;
    const testPassword = 'testPassword123';
    
    try {
      // Create test user directly in database
      const hashedPassword = await bcrypt.hash(testPassword, 12);
      const user = await this.prisma.user.create({
        data: {
          email: testEmail,
          password: hashedPassword,
          name: 'API Audit Test User'
        }
      });
      
      this.testUserId = user.id;
      
      // Login to get token
      const loginResponse = await axios.post(`${this.baseURL}/auth/login`, {
        email: testEmail,
        password: testPassword
      });
      
      this.authToken = loginResponse.data.token;
      console.log('✅ Test user created and authenticated');
      
    } catch (error) {
      console.error('❌ Failed to setup test user:', error);
      throw error;
    }
  }

  private async setupTestData(): Promise<void> {
    try {
      // Create test habit
      const habit = await this.prisma.habit.create({
        data: {
          name: 'Test Habit',
          targetMinutes: 60,
          category: 'productivity',
          skillLevel: 1,
          eisenhowerQuadrant: 'Q2',
          isWeekdayOnly: false
        }
      });
      
      this.testHabitId = habit.id;
      console.log('✅ Test data created');
      
    } catch (error) {
      console.error('❌ Failed to setup test data:', error);
      throw error;
    }
  }

  private async makeRequest(
    method: string,
    endpoint: string,
    data?: any,
    headers?: any
  ): Promise<AxiosResponse> {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      method: method.toLowerCase(),
      url,
      data,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    return axios(config);
  }

  private async testEndpoint(
    method: string,
    endpoint: string,
    expectedStatus: number,
    data?: any,
    headers?: any,
    expectedResponseStructure?: any
  ): Promise<TestResult> {
    const result: TestResult = {
      endpoint,
      method,
      status: 'FAIL',
      expectedStatus
    };

    try {
      const response = await this.makeRequest(method, endpoint, data, headers);
      result.actualStatus = response.status;
      result.actualResponse = response.data;

      if (response.status === expectedStatus) {
        result.status = 'PASS';
        
        // Check response structure if provided
        if (expectedResponseStructure) {
          const structureMatch = this.validateResponseStructure(
            response.data,
            expectedResponseStructure
          );
          
          if (!structureMatch.isValid) {
            result.status = 'MISMATCH';
            result.notes = `Response structure mismatch: ${structureMatch.errors.join(', ')}`;
            this.discrepancies.push(
              `${method} ${endpoint}: Response structure doesn't match documentation - ${structureMatch.errors.join(', ')}`
            );
          }
        }
      } else {
        result.status = 'MISMATCH';
        result.error = `Expected status ${expectedStatus}, got ${response.status}`;
        this.discrepancies.push(
          `${method} ${endpoint}: Expected status ${expectedStatus}, got ${response.status}`
        );
      }

    } catch (error) {
      const axiosError = error as AxiosError;
      
      if (axiosError.response) {
        result.actualStatus = axiosError.response.status;
        result.actualResponse = axiosError.response.data;
        
        if (axiosError.response.status === expectedStatus) {
          result.status = 'PASS';
        } else {
          result.status = 'MISMATCH';
          result.error = `Expected status ${expectedStatus}, got ${axiosError.response.status}`;
        }
      } else if (axiosError.code === 'ECONNREFUSED') {
        result.status = 'MISSING';
        result.error = 'Server not running or endpoint not found';
      } else {
        result.status = 'FAIL';
        result.error = axiosError.message;
      }
    }

    return result;
  }

  private validateResponseStructure(actual: any, expected: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    const validateObject = (actualObj: any, expectedObj: any, path: string = '') => {
      if (typeof expectedObj !== 'object' || expectedObj === null) {
        return;
      }

      for (const key in expectedObj) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (!(key in actualObj)) {
          errors.push(`Missing property: ${currentPath}`);
          continue;
        }

        const actualValue = actualObj[key];
        const expectedValue = expectedObj[key];

        if (typeof expectedValue === 'object' && expectedValue !== null) {
          if (Array.isArray(expectedValue)) {
            if (!Array.isArray(actualValue)) {
              errors.push(`${currentPath} should be an array`);
            } else if (expectedValue.length > 0 && actualValue.length > 0) {
              validateObject(actualValue[0], expectedValue[0], `${currentPath}[0]`);
            }
          } else {
            validateObject(actualValue, expectedValue, currentPath);
          }
        } else if (typeof actualValue !== typeof expectedValue) {
          errors.push(`${currentPath} type mismatch: expected ${typeof expectedValue}, got ${typeof actualValue}`);
        }
      }
    };

    validateObject(actual, expected);
    return { isValid: errors.length === 0, errors };
  }

  async runAudit(): Promise<AuditReport> {
    console.log('🔄 Starting API audit...');
    
    // Authentication endpoints
    await this.testAuthEndpoints();
    
    // Habits endpoints
    await this.testHabitsEndpoints();
    
    // Daily records endpoints
    await this.testDailyRecordsEndpoints();
    
    // KPI endpoints
    await this.testKPIEndpoints();
    
    // Analytics endpoints
    await this.testAnalyticsEndpoints();
    
    // Skills endpoints
    await this.testSkillsEndpoints();
    
    // Exception endpoints
    await this.testExceptionEndpoints();
    
    // Dashboard endpoints
    await this.testDashboardEndpoints();

    const summary = this.generateSummary();
    
    console.log('✅ API audit complete');
    
    return {
      summary,
      results: this.results,
      discrepancies: this.discrepancies
    };
  }

  private async testAuthEndpoints(): Promise<void> {
    console.log('🔄 Testing authentication endpoints...');

    // Test registration
    const registerResult = await this.testEndpoint(
      'POST',
      '/auth/register',
      201,
      {
        email: `test-register-${Date.now()}@example.com`,
        password: 'testPassword123',
        name: 'Test User'
      },
      {},
      {
        user: {
          id: 'string',
          email: 'string',
          name: 'string'
        },
        token: 'string'
      }
    );
    this.results.push(registerResult);

    // Test login
    const loginResult = await this.testEndpoint(
      'POST',
      '/auth/login',
      200,
      {
        email: `test-audit-${Date.now()}@example.com`,
        password: 'wrongPassword'
      },
      {},
      {
        error: 'string'
      }
    );
    this.results.push(loginResult);
  }

  private async testHabitsEndpoints(): Promise<void> {
    console.log('🔄 Testing habits endpoints...');

    const authHeaders = { Authorization: `Bearer ${this.authToken}` };

    // Test get all habits
    const getHabitsResult = await this.testEndpoint(
      'GET',
      '/habits',
      200,
      undefined,
      authHeaders,
      {
        habits: [{
          id: 'string',
          name: 'string',
          targetMinutes: 'number',
          category: 'string',
          skillLevel: 'number',
          eisenhowerQuadrant: 'string',
          isWeekdayOnly: 'boolean'
        }]
      }
    );
    this.results.push(getHabitsResult);

    // Test create habit
    const createHabitResult = await this.testEndpoint(
      'POST',
      '/habits',
      201,
      {
        name: 'Test Audit Habit',
        targetMinutes: 30,
        category: 'wellness',
        skillLevel: 1,
        eisenhowerQuadrant: 'Q2'
      },
      authHeaders,
      {
        habit: {
          id: 'string',
          name: 'string',
          targetMinutes: 'number',
          category: 'string',
          skillLevel: 'number',
          eisenhowerQuadrant: 'string',
          isWeekdayOnly: 'boolean'
        }
      }
    );
    this.results.push(createHabitResult);

    // Test update habit
    const updateHabitResult = await this.testEndpoint(
      'PUT',
      `/habits/${this.testHabitId}`,
      200,
      {
        targetMinutes: 45,
        skillLevel: 2
      },
      authHeaders,
      {
        habit: {
          id: 'string',
          name: 'string',
          targetMinutes: 'number',
          skillLevel: 'number'
        }
      }
    );
    this.results.push(updateHabitResult);

    // Test delete habit
    const deleteHabitResult = await this.testEndpoint(
      'DELETE',
      `/habits/${this.testHabitId}`,
      200,
      undefined,
      authHeaders
    );
    this.results.push(deleteHabitResult);
  }

  private async testDailyRecordsEndpoints(): Promise<void> {
    console.log('🔄 Testing daily records endpoints...');

    const authHeaders = { Authorization: `Bearer ${this.authToken}` };

    // Test get daily records
    const getDailyRecordsResult = await this.testEndpoint(
      'GET',
      '/daily-records',
      200,
      undefined,
      authHeaders,
      {
        dailyRecords: [{
          id: 'string',
          date: 'string',
          totalKPI: 'number',
          exceptionType: 'string',
          exceptionNote: 'string',
          habitRecords: 'object',
          tasks: 'object'
        }]
      }
    );
    this.results.push(getDailyRecordsResult);

    // Test create daily record
    const createDailyRecordResult = await this.testEndpoint(
      'POST',
      '/daily-records',
      201,
      {
        date: new Date().toISOString().split('T')[0],
        habitRecords: [{
          habitId: this.testHabitId,
          actualMinutes: 45,
          qualityScore: 4
        }],
        tasks: [{
          title: 'Test task',
          priority: 'high',
          eisenhowerQuadrant: 'Q1'
        }]
      },
      authHeaders
    );
    this.results.push(createDailyRecordResult);
  }

  private async testKPIEndpoints(): Promise<void> {
    console.log('🔄 Testing KPI endpoints...');

    const authHeaders = { Authorization: `Bearer ${this.authToken}` };

    // Test KPI calculation
    const kpiCalculateResult = await this.testEndpoint(
      'POST',
      '/kpi/calculate',
      200,
      {
        habitRecords: [{
          habitId: this.testHabitId,
          actualMinutes: 45,
          qualityScore: 4
        }],
        tasks: [{
          title: 'Test task',
          priority: 'high',
          eisenhowerQuadrant: 'Q1'
        }],
        habits: [{
          id: this.testHabitId,
          name: 'Test Habit',
          targetMinutes: 60,
          category: 'productivity',
          skillLevel: 1,
          eisenhowerQuadrant: 'Q2'
        }],
        revolutPillars: {
          deliverables: 0,
          skills: 0,
          culture: 0
        }
      },
      authHeaders
    );
    this.results.push(kpiCalculateResult);

    // Test get efficiency laws
    const lawsResult = await this.testEndpoint(
      'GET',
      '/kpi/laws',
      200,
      undefined,
      authHeaders
    );
    this.results.push(lawsResult);
  }

  private async testAnalyticsEndpoints(): Promise<void> {
    console.log('🔄 Testing analytics endpoints...');

    const authHeaders = { Authorization: `Bearer ${this.authToken}` };

    // Test analytics report
    const analyticsReportResult = await this.testEndpoint(
      'GET',
      '/analytics/report?startDate=2026-01-01&endDate=2026-01-31&type=month',
      200,
      undefined,
      authHeaders
    );
    this.results.push(analyticsReportResult);

    // Test analytics summary
    const analyticsSummaryResult = await this.testEndpoint(
      'GET',
      '/analytics/summary?days=30',
      200,
      undefined,
      authHeaders
    );
    this.results.push(analyticsSummaryResult);
  }

  private async testSkillsEndpoints(): Promise<void> {
    console.log('🔄 Testing skills endpoints...');

    const authHeaders = { Authorization: `Bearer ${this.authToken}` };

    // Test get skill tests
    const skillTestsResult = await this.testEndpoint(
      'GET',
      '/skills/tests',
      200,
      undefined,
      authHeaders
    );
    this.results.push(skillTestsResult);

    // Test get skill progress
    const skillProgressResult = await this.testEndpoint(
      'GET',
      '/skills/progress',
      200,
      undefined,
      authHeaders
    );
    this.results.push(skillProgressResult);
  }

  private async testExceptionEndpoints(): Promise<void> {
    console.log('🔄 Testing exception endpoints...');

    const authHeaders = { Authorization: `Bearer ${this.authToken}` };

    // Test get exception types
    const exceptionTypesResult = await this.testEndpoint(
      'GET',
      '/exceptions/types',
      200,
      undefined,
      authHeaders
    );
    this.results.push(exceptionTypesResult);

    // Test mark exception
    const markExceptionResult = await this.testEndpoint(
      'POST',
      '/exceptions/mark',
      201,
      {
        date: new Date().toISOString().split('T')[0],
        exceptionType: 'illness',
        exceptionNote: 'Test exception'
      },
      authHeaders
    );
    this.results.push(markExceptionResult);
  }

  private async testDashboardEndpoints(): Promise<void> {
    console.log('🔄 Testing dashboard endpoints...');

    const authHeaders = { Authorization: `Bearer ${this.authToken}` };

    // Test year overview
    const yearOverviewResult = await this.testEndpoint(
      'GET',
      '/dashboard/year/2026',
      200,
      undefined,
      authHeaders
    );
    this.results.push(yearOverviewResult);

    // Test month overview
    const monthOverviewResult = await this.testEndpoint(
      'GET',
      '/dashboard/month/2026/1',
      200,
      undefined,
      authHeaders
    );
    this.results.push(monthOverviewResult);
  }

  private generateSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const missing = this.results.filter(r => r.status === 'MISSING').length;
    const mismatched = this.results.filter(r => r.status === 'MISMATCH').length;

    return {
      total,
      passed,
      failed,
      missing,
      mismatched
    };
  }

  async cleanup(): Promise<void> {
    console.log('🔄 Cleaning up test data...');
    
    try {
      // Delete test user and related data
      await this.prisma.user.delete({
        where: { id: this.testUserId }
      });
      
      console.log('✅ Cleanup complete');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    } finally {
      await this.prisma.$disconnect();
    }
  }
}

// Main execution
async function main() {
  const auditor = new APIAuditor();
  
  try {
    await auditor.initialize();
    const report = await auditor.runAudit();
    
    // Generate detailed report
    console.log('\n📊 API AUDIT REPORT');
    console.log('==================');
    console.log(`Total endpoints tested: ${report.summary.total}`);
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log(`🔍 Missing: ${report.summary.missing}`);
    console.log(`⚠️  Mismatched: ${report.summary.mismatched}`);
    
    if (report.discrepancies.length > 0) {
      console.log('\n🚨 DISCREPANCIES FOUND:');
      report.discrepancies.forEach((discrepancy, index) => {
        console.log(`${index + 1}. ${discrepancy}`);
      });
    }
    
    // Save detailed report to file
    const fs = require('fs');
    const reportPath = 'api-audit-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
  } catch (error) {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  } finally {
    await auditor.cleanup();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { APIAuditor, TestResult, AuditReport };