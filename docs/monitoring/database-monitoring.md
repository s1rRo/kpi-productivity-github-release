# Database Monitoring Guide

## Overview

This guide provides comprehensive documentation for database monitoring in the KPI Productivity application, covering health check procedures, connection monitoring, migration management, performance optimization, and troubleshooting for both SQLite and PostgreSQL databases.

## Table of Contents

1. [Database Configuration](#database-configuration)
2. [Health Check Procedures](#health-check-procedures)
3. [Connection Monitoring](#connection-monitoring)
4. [Migration Management](#migration-management)
5. [Performance Monitoring](#performance-monitoring)
6. [Query Optimization](#query-optimization)
7. [Backup and Recovery](#backup-and-recovery)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)

## Database Configuration

### Environment Variables

```bash
# Database connection
DATABASE_URL="sqlite:./prisma/dev.db"
# or for PostgreSQL
DATABASE_URL="postgresql://username:password@localhost:5432/kpi_productivity"

# Connection pool settings
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_POOL_TIMEOUT=60000

# Monitoring settings
DATABASE_HEALTH_CHECK_INTERVAL=30000
DATABASE_SLOW_QUERY_THRESHOLD=1000
DATABASE_MONITORING_ENABLED=true
```

### Prisma Configuration

```typescript
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["metrics", "tracing"]
}

datasource db {
  provider = "sqlite" // or "postgresql"
  url      = env("DATABASE_URL")
}
```

### Connection Pool Configuration

```typescript
import { PrismaClient } from '@prisma/client';

// Production-optimized Prisma client
const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'event' },
    { level: 'info', emit: 'event' },
    { level: 'warn', emit: 'event' },
  ],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Connection pool monitoring
prisma.$on('query', (e) => {
  if (parseInt(process.env.DATABASE_SLOW_QUERY_THRESHOLD || '1000') < e.duration) {
    console.warn(`Slow query detected: ${e.duration}ms`);
    console.warn(`Query: ${e.query}`);
    console.warn(`Params: ${e.params}`);
  }
});

prisma.$on('error', (e) => {
  console.error('Database error:', e);
});

export { prisma };
```

## Health Check Procedures

### Basic Health Check

```typescript
// Database health check implementation
export const databaseHealthCheck = async (): Promise<{
  status: 'healthy' | 'unhealthy' | 'degraded';
  details: any;
  metrics: any;
}> => {
  const startTime = Date.now();
  
  try {
    // Basic connectivity test
    const connectivityStart = Date.now();
    await prisma.$queryRaw`SELECT 1 as test`;
    const connectivityTime = Date.now() - connectivityStart;
    
    // Connection pool status
    const poolMetrics = await getConnectionPoolMetrics();
    
    // Database size and table counts
    const databaseMetrics = await getDatabaseMetrics();
    
    // Performance test
    const performanceMetrics = await performanceTest();
    
    // Determine overall status
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    
    if (connectivityTime > 5000 || performanceMetrics.averageQueryTime > 1000) {
      status = 'degraded';
    }
    
    if (poolMetrics.activeConnections >= poolMetrics.maxConnections * 0.9) {
      status = 'degraded';
    }
    
    return {
      status,
      details: {
        connectivity: true,
        poolStatus: poolMetrics,
        databaseSize: databaseMetrics,
        performance: performanceMetrics
      },
      metrics: {
        connectivityTime,
        totalHealthCheckTime: Date.now() - startTime
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        connectivity: false
      },
      metrics: {
        totalHealthCheckTime: Date.now() - startTime
      }
    };
  }
};

// Get connection pool metrics
const getConnectionPoolMetrics = async () => {
  try {
    // For PostgreSQL
    if (process.env.DATABASE_URL?.includes('postgresql')) {
      const result = await prisma.$queryRaw`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity 
        WHERE datname = current_database();
      ` as any[];
      
      return {
        totalConnections: result[0]?.total_connections || 0,
        activeConnections: result[0]?.active_connections || 0,
        idleConnections: result[0]?.idle_connections || 0,
        maxConnections: parseInt(process.env.DATABASE_POOL_MAX || '10')
      };
    } else {
      // For SQLite (limited connection info)
      return {
        totalConnections: 1,
        activeConnections: 1,
        idleConnections: 0,
        maxConnections: 1
      };
    }
  } catch (error) {
    console.error('Error getting connection pool metrics:', error);
    return {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      maxConnections: 0
    };
  }
};

// Get database metrics
const getDatabaseMetrics = async () => {
  try {
    if (process.env.DATABASE_URL?.includes('postgresql')) {
      // PostgreSQL database metrics
      const sizeResult = await prisma.$queryRaw`
        SELECT pg_size_pretty(pg_database_size(current_database())) as database_size;
      ` as any[];
      
      const tableCountResult = await prisma.$queryRaw`
        SELECT count(*) as table_count 
        FROM information_schema.tables 
        WHERE table_schema = 'public';
      ` as any[];
      
      return {
        databaseSize: sizeResult[0]?.database_size || 'Unknown',
        tableCount: tableCountResult[0]?.table_count || 0
      };
    } else {
      // SQLite database metrics
      const tableCountResult = await prisma.$queryRaw`
        SELECT count(*) as table_count 
        FROM sqlite_master 
        WHERE type = 'table';
      ` as any[];
      
      // Get file size for SQLite
      const fs = require('fs');
      const path = require('path');
      const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './prisma/dev.db';
      
      let fileSize = 'Unknown';
      try {
        const stats = fs.statSync(dbPath);
        fileSize = `${(stats.size / 1024 / 1024).toFixed(2)} MB`;
      } catch (error) {
        console.warn('Could not get database file size:', error);
      }
      
      return {
        databaseSize: fileSize,
        tableCount: tableCountResult[0]?.table_count || 0
      };
    }
  } catch (error) {
    console.error('Error getting database metrics:', error);
    return {
      databaseSize: 'Unknown',
      tableCount: 0
    };
  }
};

// Performance test
const performanceTest = async () => {
  const tests = [];
  
  try {
    // Test 1: Simple SELECT
    const start1 = Date.now();
    await prisma.user.count();
    tests.push(Date.now() - start1);
    
    // Test 2: JOIN query
    const start2 = Date.now();
    await prisma.user.findMany({
      take: 10,
      include: {
        dailyRecords: {
          take: 5,
          orderBy: { date: 'desc' }
        }
      }
    });
    tests.push(Date.now() - start2);
    
    // Test 3: Aggregation
    const start3 = Date.now();
    await prisma.habitRecord.aggregate({
      _avg: { actualMinutes: true },
      _count: { id: true }
    });
    tests.push(Date.now() - start3);
    
    const averageQueryTime = tests.reduce((a, b) => a + b, 0) / tests.length;
    
    return {
      averageQueryTime,
      testResults: tests,
      slowQueries: tests.filter(time => time > 1000).length
    };
  } catch (error) {
    console.error('Performance test error:', error);
    return {
      averageQueryTime: 0,
      testResults: [],
      slowQueries: 0
    };
  }
};
```

### Health Check Endpoint

```typescript
// Express endpoint for database health check
export const databaseHealthEndpoint = async (req: any, res: any) => {
  try {
    const health = await databaseHealthCheck();
    
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      service: 'database',
      ...health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      service: 'database',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
};

// Automated health monitoring
export const startDatabaseHealthMonitoring = () => {
  const interval = parseInt(process.env.DATABASE_HEALTH_CHECK_INTERVAL || '30000');
  
  setInterval(async () => {
    try {
      const health = await databaseHealthCheck();
      
      if (health.status !== 'healthy') {
        console.warn(`Database health check: ${health.status}`, health.details);
        
        // Send alert if unhealthy
        if (health.status === 'unhealthy') {
          await sendDatabaseAlert(health);
        }
      }
    } catch (error) {
      console.error('Database health monitoring error:', error);
    }
  }, interval);
};

// Alert function
const sendDatabaseAlert = async (healthStatus: any) => {
  console.error('🚨 Database Alert:', healthStatus);
  
  // Send to monitoring service (Sentry, Slack, etc.)
  if (typeof sentryUtils !== 'undefined') {
    sentryUtils.captureMessage('Database health check failed', 'error', {
      healthStatus,
      service: 'database'
    });
  }
};
```

## Connection Monitoring

### Connection Pool Monitoring

```typescript
// Connection pool monitoring
export const connectionPoolMonitor = {
  metrics: {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    connectionErrors: 0,
    connectionTimeouts: 0,
    averageConnectionTime: 0,
    connectionTimes: [] as number[]
  },
  
  // Track connection creation
  trackConnection: function(duration: number, success: boolean) {
    this.metrics.totalConnections++;
    
    if (success) {
      this.metrics.connectionTimes.push(duration);
      
      // Keep only last 100 measurements
      if (this.metrics.connectionTimes.length > 100) {
        this.metrics.connectionTimes.shift();
      }
      
      // Calculate average
      this.metrics.averageConnectionTime = 
        this.metrics.connectionTimes.reduce((a, b) => a + b, 0) / 
        this.metrics.connectionTimes.length;
    } else {
      this.metrics.connectionErrors++;
    }
  },
  
  // Get current metrics
  getMetrics: function() {
    return { ...this.metrics };
  },
  
  // Reset metrics
  reset: function() {
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      connectionErrors: 0,
      connectionTimeouts: 0,
      averageConnectionTime: 0,
      connectionTimes: []
    };
  }
};

// Monitor Prisma client events
prisma.$on('query', (e) => {
  // Track query performance
  queryPerformanceMonitor.trackQuery(e.query, e.duration, e.params);
});

prisma.$on('error', (e) => {
  connectionPoolMonitor.metrics.connectionErrors++;
  console.error('Prisma error:', e);
});

// Connection wrapper with monitoring
export const monitoredQuery = async <T>(
  queryFn: () => Promise<T>,
  queryName: string
): Promise<T> => {
  const startTime = Date.now();
  let success = true;
  
  try {
    const result = await queryFn();
    return result;
  } catch (error) {
    success = false;
    connectionPoolMonitor.metrics.connectionErrors++;
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    connectionPoolMonitor.trackConnection(duration, success);
    
    if (duration > 5000) {
      console.warn(`Slow database operation: ${queryName} took ${duration}ms`);
    }
  }
};
```

### Query Performance Monitoring

```typescript
// Query performance monitoring
export const queryPerformanceMonitor = {
  queries: new Map<string, {
    count: number;
    totalTime: number;
    averageTime: number;
    slowQueries: number;
    errors: number;
  }>(),
  
  // Track query performance
  trackQuery: function(query: string, duration: number, params?: string) {
    // Normalize query (remove specific values)
    const normalizedQuery = this.normalizeQuery(query);
    
    if (!this.queries.has(normalizedQuery)) {
      this.queries.set(normalizedQuery, {
        count: 0,
        totalTime: 0,
        averageTime: 0,
        slowQueries: 0,
        errors: 0
      });
    }
    
    const stats = this.queries.get(normalizedQuery)!;
    stats.count++;
    stats.totalTime += duration;
    stats.averageTime = stats.totalTime / stats.count;
    
    // Track slow queries
    const slowThreshold = parseInt(process.env.DATABASE_SLOW_QUERY_THRESHOLD || '1000');
    if (duration > slowThreshold) {
      stats.slowQueries++;
      console.warn(`Slow query detected: ${duration}ms`);
      console.warn(`Query: ${normalizedQuery}`);
      if (params) console.warn(`Params: ${params}`);
    }
  },
  
  // Normalize query for grouping
  normalizeQuery: function(query: string): string {
    return query
      .replace(/\$\d+/g, '?') // Replace PostgreSQL parameters
      .replace(/'[^']*'/g, '?') // Replace string literals
      .replace(/\d+/g, '?') // Replace numbers
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  },
  
  // Get performance report
  getPerformanceReport: function() {
    const report = {
      totalQueries: 0,
      slowQueries: 0,
      averageQueryTime: 0,
      topSlowQueries: [] as any[]
    };
    
    const queryStats = Array.from(this.queries.entries()).map(([query, stats]) => ({
      query,
      ...stats
    }));
    
    report.totalQueries = queryStats.reduce((sum, stats) => sum + stats.count, 0);
    report.slowQueries = queryStats.reduce((sum, stats) => sum + stats.slowQueries, 0);
    
    if (queryStats.length > 0) {
      const totalTime = queryStats.reduce((sum, stats) => sum + stats.totalTime, 0);
      report.averageQueryTime = totalTime / report.totalQueries;
    }
    
    // Top 10 slowest queries
    report.topSlowQueries = queryStats
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 10)
      .map(stats => ({
        query: stats.query.substring(0, 100) + '...',
        averageTime: stats.averageTime,
        count: stats.count,
        slowQueries: stats.slowQueries
      }));
    
    return report;
  },
  
  // Reset monitoring data
  reset: function() {
    this.queries.clear();
  }
};

// Performance report endpoint
export const queryPerformanceEndpoint = async (req: any, res: any) => {
  try {
    const report = queryPerformanceMonitor.getPerformanceReport();
    const connectionMetrics = connectionPoolMonitor.getMetrics();
    
    res.json({
      timestamp: new Date().toISOString(),
      queryPerformance: report,
      connectionPool: connectionMetrics
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
```

## Migration Management

### Migration Monitoring

```typescript
import { runMigrations } from '../utils/migrations';

// Migration status tracking
export const migrationMonitor = {
  status: 'idle' as 'idle' | 'running' | 'completed' | 'failed',
  lastRun: null as Date | null,
  lastError: null as string | null,
  migrationHistory: [] as Array<{
    timestamp: Date;
    status: 'success' | 'failure';
    duration: number;
    error?: string;
  }>,
  
  // Run migrations with monitoring
  async runWithMonitoring(): Promise<boolean> {
    if (this.status === 'running') {
      console.warn('Migration already in progress');
      return false;
    }
    
    this.status = 'running';
    const startTime = Date.now();
    
    try {
      console.log('Starting database migrations...');
      await runMigrations();
      
      const duration = Date.now() - startTime;
      this.status = 'completed';
      this.lastRun = new Date();
      this.lastError = null;
      
      this.migrationHistory.push({
        timestamp: new Date(),
        status: 'success',
        duration
      });
      
      console.log(`Migrations completed successfully in ${duration}ms`);
      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.status = 'failed';
      this.lastError = errorMessage;
      
      this.migrationHistory.push({
        timestamp: new Date(),
        status: 'failure',
        duration,
        error: errorMessage
      });
      
      console.error('Migration failed:', errorMessage);
      
      // Send alert
      if (typeof sentryUtils !== 'undefined') {
        sentryUtils.captureException(error as Error, {
          context: 'database_migration',
          duration
        });
      }
      
      return false;
    } finally {
      // Reset status after delay to allow status checking
      setTimeout(() => {
        this.status = 'idle';
      }, 5000);
    }
  },
  
  // Get migration status
  getStatus: function() {
    return {
      status: this.status,
      lastRun: this.lastRun,
      lastError: this.lastError,
      history: this.migrationHistory.slice(-10) // Last 10 migrations
    };
  }
};

// Migration health check
export const migrationHealthCheck = async () => {
  try {
    // Check if all expected tables exist
    const expectedTables = [
      'users', 'habits', 'daily_records', 'habit_records',
      'tasks', 'skill_tests', 'skill_progress', 'habit_history',
      'goals', 'goal_connections', 'goal_habits',
      'friend_requests', 'friendships', 'friend_invites',
      'teams', 'team_members', 'team_goals', 'team_goal_progress',
      'team_invites', 'principle_preferences'
    ];
    
    const missingTables = [];
    
    for (const table of expectedTables) {
      try {
        if (process.env.DATABASE_URL?.includes('postgresql')) {
          const result = await prisma.$queryRaw`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = ${table};
          ` as any[];
          
          if (!result || result.length === 0) {
            missingTables.push(table);
          }
        } else {
          const result = await prisma.$queryRaw`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name = ${table};
          ` as any[];
          
          if (!result || result.length === 0) {
            missingTables.push(table);
          }
        }
      } catch (error) {
        missingTables.push(table);
      }
    }
    
    return {
      status: missingTables.length === 0 ? 'healthy' : 'unhealthy',
      missingTables,
      totalTables: expectedTables.length,
      existingTables: expectedTables.length - missingTables.length
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Migration endpoint
export const migrationEndpoint = async (req: any, res: any) => {
  const { action } = req.body;
  
  try {
    switch (action) {
      case 'status':
        const status = migrationMonitor.getStatus();
        const healthCheck = await migrationHealthCheck();
        
        res.json({
          migration: status,
          schema: healthCheck,
          timestamp: new Date().toISOString()
        });
        break;
        
      case 'run':
        if (migrationMonitor.status === 'running') {
          return res.status(409).json({
            error: 'Migration already in progress'
          });
        }
        
        // Run migrations asynchronously
        migrationMonitor.runWithMonitoring();
        
        res.json({
          message: 'Migration started',
          status: 'running'
        });
        break;
        
      default:
        res.status(400).json({
          error: 'Invalid action. Use "status" or "run"'
        });
    }
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
```

### Schema Validation

```typescript
// Schema validation utilities
export const schemaValidator = {
  // Validate table structure
  async validateTableStructure(tableName: string, expectedColumns: string[]): Promise<{
    valid: boolean;
    missingColumns: string[];
    extraColumns: string[];
  }> {
    try {
      let actualColumns: string[] = [];
      
      if (process.env.DATABASE_URL?.includes('postgresql')) {
        const result = await prisma.$queryRaw`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = ${tableName}
          ORDER BY ordinal_position;
        ` as any[];
        
        actualColumns = result.map(row => row.column_name);
      } else {
        const result = await prisma.$queryRaw`
          PRAGMA table_info(${tableName});
        ` as any[];
        
        actualColumns = result.map(row => row.name);
      }
      
      const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));
      const extraColumns = actualColumns.filter(col => !expectedColumns.includes(col));
      
      return {
        valid: missingColumns.length === 0,
        missingColumns,
        extraColumns
      };
    } catch (error) {
      console.error(`Error validating table ${tableName}:`, error);
      return {
        valid: false,
        missingColumns: expectedColumns,
        extraColumns: []
      };
    }
  },
  
  // Validate all tables
  async validateAllTables(): Promise<{
    valid: boolean;
    results: Array<{
      table: string;
      valid: boolean;
      missingColumns: string[];
      extraColumns: string[];
    }>;
  }> {
    const tableSchemas = {
      users: ['id', 'email', 'password', 'name', 'inviteCode', 'privacySettings', 'createdAt', 'updatedAt'],
      habits: ['id', 'name', 'targetMinutes', 'category', 'skillLevel', 'eisenhowerQuadrant', 'isWeekdayOnly', 'createdAt'],
      daily_records: ['id', 'userId', 'date', 'totalKpi', 'exceptionType', 'exceptionNote', 'createdAt'],
      habit_records: ['id', 'dailyRecordId', 'habitId', 'actualMinutes', 'qualityScore', 'efficiencyCoefficients', 'createdAt'],
      // Add more table schemas as needed
    };
    
    const results = [];
    let allValid = true;
    
    for (const [tableName, expectedColumns] of Object.entries(tableSchemas)) {
      const validation = await this.validateTableStructure(tableName, expectedColumns);
      results.push({
        table: tableName,
        ...validation
      });
      
      if (!validation.valid) {
        allValid = false;
      }
    }
    
    return {
      valid: allValid,
      results
    };
  }
};
```

## Performance Monitoring

### Query Analysis

```typescript
// Query analysis and optimization suggestions
export const queryAnalyzer = {
  // Analyze slow queries
  async analyzeSlowQueries(): Promise<{
    slowQueries: Array<{
      query: string;
      averageTime: number;
      count: number;
      suggestions: string[];
    }>;
    totalSlowQueries: number;
  }> {
    const performanceReport = queryPerformanceMonitor.getPerformanceReport();
    const slowThreshold = parseInt(process.env.DATABASE_SLOW_QUERY_THRESHOLD || '1000');
    
    const slowQueries = performanceReport.topSlowQueries
      .filter(query => query.averageTime > slowThreshold)
      .map(query => ({
        ...query,
        suggestions: this.generateOptimizationSuggestions(query.query, query.averageTime)
      }));
    
    return {
      slowQueries,
      totalSlowQueries: performanceReport.slowQueries
    };
  },
  
  // Generate optimization suggestions
  generateOptimizationSuggestions: function(query: string, averageTime: number): string[] {
    const suggestions = [];
    const lowerQuery = query.toLowerCase();
    
    // Check for missing indexes
    if (lowerQuery.includes('where') && !lowerQuery.includes('index')) {
      suggestions.push('Consider adding indexes on WHERE clause columns');
    }
    
    // Check for N+1 queries
    if (lowerQuery.includes('select') && averageTime > 100) {
      suggestions.push('Consider using JOIN instead of separate queries');
    }
    
    // Check for SELECT *
    if (lowerQuery.includes('select *')) {
      suggestions.push('Avoid SELECT *, specify only needed columns');
    }
    
    // Check for missing LIMIT
    if (lowerQuery.includes('select') && !lowerQuery.includes('limit') && !lowerQuery.includes('count')) {
      suggestions.push('Consider adding LIMIT to prevent large result sets');
    }
    
    // Check for complex JOINs
    const joinCount = (lowerQuery.match(/join/g) || []).length;
    if (joinCount > 3) {
      suggestions.push('Complex JOINs detected, consider query restructuring');
    }
    
    // Check for subqueries
    if (lowerQuery.includes('select') && lowerQuery.match(/\(/g)?.length > 1) {
      suggestions.push('Consider optimizing subqueries or using JOINs');
    }
    
    return suggestions;
  },
  
  // Database statistics
  async getDatabaseStatistics(): Promise<any> {
    try {
      if (process.env.DATABASE_URL?.includes('postgresql')) {
        // PostgreSQL statistics
        const tableStats = await prisma.$queryRaw`
          SELECT 
            schemaname,
            tablename,
            n_tup_ins as inserts,
            n_tup_upd as updates,
            n_tup_del as deletes,
            n_live_tup as live_tuples,
            n_dead_tup as dead_tuples
          FROM pg_stat_user_tables
          ORDER BY n_live_tup DESC;
        `;
        
        const indexStats = await prisma.$queryRaw`
          SELECT 
            schemaname,
            tablename,
            indexname,
            idx_tup_read as index_reads,
            idx_tup_fetch as index_fetches
          FROM pg_stat_user_indexes
          ORDER BY idx_tup_read DESC
          LIMIT 10;
        `;
        
        return {
          type: 'postgresql',
          tables: tableStats,
          indexes: indexStats
        };
      } else {
        // SQLite statistics (limited)
        const tables = await prisma.$queryRaw`
          SELECT name, sql 
          FROM sqlite_master 
          WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
          ORDER BY name;
        `;
        
        const indexes = await prisma.$queryRaw`
          SELECT name, sql 
          FROM sqlite_master 
          WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
          ORDER BY name;
        `;
        
        return {
          type: 'sqlite',
          tables,
          indexes
        };
      }
    } catch (error) {
      console.error('Error getting database statistics:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
};

// Performance monitoring endpoint
export const performanceMonitoringEndpoint = async (req: any, res: any) => {
  try {
    const { type } = req.query;
    
    switch (type) {
      case 'slow-queries':
        const slowQueries = await queryAnalyzer.analyzeSlowQueries();
        res.json(slowQueries);
        break;
        
      case 'statistics':
        const stats = await queryAnalyzer.getDatabaseStatistics();
        res.json(stats);
        break;
        
      case 'performance':
        const performance = queryPerformanceMonitor.getPerformanceReport();
        res.json(performance);
        break;
        
      default:
        const health = await databaseHealthCheck();
        const slowQueriesData = await queryAnalyzer.analyzeSlowQueries();
        const performanceData = queryPerformanceMonitor.getPerformanceReport();
        
        res.json({
          health,
          slowQueries: slowQueriesData,
          performance: performanceData,
          timestamp: new Date().toISOString()
        });
    }
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
```

## Query Optimization

### Index Management

```typescript
// Index management utilities
export const indexManager = {
  // Suggest indexes based on query patterns
  async suggestIndexes(): Promise<Array<{
    table: string;
    columns: string[];
    reason: string;
    estimatedImpact: 'high' | 'medium' | 'low';
  }>> {
    const suggestions = [];
    
    // Analyze common query patterns
    const queryPatterns = queryPerformanceMonitor.queries;
    
    for (const [query, stats] of queryPatterns) {
      if (stats.averageTime > 500 && stats.count > 10) {
        const indexSuggestions = this.analyzeQueryForIndexes(query);
        suggestions.push(...indexSuggestions);
      }
    }
    
    return suggestions;
  },
  
  // Analyze query for potential indexes
  analyzeQueryForIndexes: function(query: string): Array<{
    table: string;
    columns: string[];
    reason: string;
    estimatedImpact: 'high' | 'medium' | 'low';
  }> {
    const suggestions = [];
    const lowerQuery = query.toLowerCase();
    
    // Extract WHERE conditions
    const whereMatch = lowerQuery.match(/where\s+(.+?)(?:\s+order|\s+group|\s+limit|$)/);
    if (whereMatch) {
      const whereClause = whereMatch[1];
      
      // Look for equality conditions
      const equalityMatches = whereClause.match(/(\w+)\s*=\s*\?/g);
      if (equalityMatches) {
        equalityMatches.forEach(match => {
          const column = match.split('=')[0].trim();
          suggestions.push({
            table: 'unknown', // Would need more sophisticated parsing
            columns: [column],
            reason: `Equality condition on ${column}`,
            estimatedImpact: 'high'
          });
        });
      }
      
      // Look for range conditions
      const rangeMatches = whereClause.match(/(\w+)\s*[<>]=?\s*\?/g);
      if (rangeMatches) {
        rangeMatches.forEach(match => {
          const column = match.split(/[<>]/)[0].trim();
          suggestions.push({
            table: 'unknown',
            columns: [column],
            reason: `Range condition on ${column}`,
            estimatedImpact: 'medium'
          });
        });
      }
    }
    
    // Extract ORDER BY columns
    const orderMatch = lowerQuery.match(/order\s+by\s+(.+?)(?:\s+limit|$)/);
    if (orderMatch) {
      const orderClause = orderMatch[1];
      const columns = orderClause.split(',').map(col => col.trim().split(' ')[0]);
      
      suggestions.push({
        table: 'unknown',
        columns,
        reason: 'ORDER BY optimization',
        estimatedImpact: 'medium'
      });
    }
    
    return suggestions;
  },
  
  // Create index (PostgreSQL)
  async createIndex(tableName: string, columns: string[], indexName?: string): Promise<boolean> {
    if (!process.env.DATABASE_URL?.includes('postgresql')) {
      console.warn('Index creation only supported for PostgreSQL');
      return false;
    }
    
    try {
      const indexNameFinal = indexName || `idx_${tableName}_${columns.join('_')}`;
      const columnsStr = columns.join(', ');
      
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS ${indexNameFinal} ON ${tableName} (${columnsStr});`
      );
      
      console.log(`Created index ${indexNameFinal} on ${tableName}(${columnsStr})`);
      return true;
    } catch (error) {
      console.error('Error creating index:', error);
      return false;
    }
  },
  
  // Drop index (PostgreSQL)
  async dropIndex(indexName: string): Promise<boolean> {
    if (!process.env.DATABASE_URL?.includes('postgresql')) {
      console.warn('Index management only supported for PostgreSQL');
      return false;
    }
    
    try {
      await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS ${indexName};`);
      console.log(`Dropped index ${indexName}`);
      return true;
    } catch (error) {
      console.error('Error dropping index:', error);
      return false;
    }
  }
};
```

### Query Optimization Patterns

```typescript
// Common query optimization patterns
export const queryOptimizer = {
  // Optimize user data queries
  optimizedUserQueries: {
    // Instead of N+1 queries
    getUserWithHabits: async (userId: string) => {
      return await monitoredQuery(
        () => prisma.user.findUnique({
          where: { id: userId },
          include: {
            dailyRecords: {
              orderBy: { date: 'desc' },
              take: 30,
              include: {
                habitRecords: {
                  include: {
                    habit: true
                  }
                }
              }
            }
          }
        }),
        'getUserWithHabits'
      );
    },
    
    // Optimized analytics query
    getUserAnalytics: async (userId: string, startDate: Date, endDate: Date) => {
      return await monitoredQuery(
        () => prisma.$queryRaw`
          SELECT 
            h.name as habit_name,
            h.category,
            COUNT(hr.id) as total_records,
            AVG(hr.actualMinutes) as avg_minutes,
            SUM(hr.actualMinutes) as total_minutes,
            AVG(hr.qualityScore) as avg_quality
          FROM habits h
          LEFT JOIN habit_records hr ON h.id = hr.habitId
          LEFT JOIN daily_records dr ON hr.dailyRecordId = dr.id
          WHERE dr.userId = ${userId}
            AND dr.date >= ${startDate}
            AND dr.date <= ${endDate}
          GROUP BY h.id, h.name, h.category
          ORDER BY total_minutes DESC;
        `,
        'getUserAnalytics'
      );
    }
  },
  
  // Batch operations
  batchOperations: {
    // Batch insert habit records
    batchInsertHabitRecords: async (records: Array<{
      dailyRecordId: string;
      habitId: string;
      actualMinutes: number;
      qualityScore?: number;
    }>) => {
      return await monitoredQuery(
        () => prisma.habitRecord.createMany({
          data: records,
          skipDuplicates: true
        }),
        'batchInsertHabitRecords'
      );
    },
    
    // Batch update user KPIs
    batchUpdateKPIs: async (updates: Array<{
      userId: string;
      date: Date;
      totalKpi: number;
    }>) => {
      const promises = updates.map(update =>
        prisma.dailyRecord.upsert({
          where: {
            userId_date: {
              userId: update.userId,
              date: update.date
            }
          },
          update: {
            totalKpi: update.totalKpi
          },
          create: {
            userId: update.userId,
            date: update.date,
            totalKpi: update.totalKpi
          }
        })
      );
      
      return await monitoredQuery(
        () => Promise.all(promises),
        'batchUpdateKPIs'
      );
    }
  }
};
```

## Backup and Recovery

### Backup Procedures

```typescript
// Database backup utilities
export const backupManager = {
  // Create backup
  async createBackup(backupPath?: string): Promise<{
    success: boolean;
    backupPath?: string;
    size?: number;
    error?: string;
  }> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const defaultPath = `./backups/backup-${timestamp}`;
      const finalPath = backupPath || defaultPath;
      
      if (process.env.DATABASE_URL?.includes('postgresql')) {
        return await this.createPostgreSQLBackup(finalPath);
      } else {
        return await this.createSQLiteBackup(finalPath);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },
  
  // PostgreSQL backup
  async createPostgreSQLBackup(backupPath: string): Promise<{
    success: boolean;
    backupPath?: string;
    size?: number;
    error?: string;
  }> {
    const { spawn } = require('child_process');
    const fs = require('fs');
    const path = require('path');
    
    return new Promise((resolve) => {
      try {
        // Ensure backup directory exists
        const backupDir = path.dirname(backupPath);
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const finalPath = `${backupPath}.sql`;
        const databaseUrl = new URL(process.env.DATABASE_URL!);
        
        const pgDump = spawn('pg_dump', [
          '-h', databaseUrl.hostname,
          '-p', databaseUrl.port || '5432',
          '-U', databaseUrl.username,
          '-d', databaseUrl.pathname.slice(1),
          '-f', finalPath,
          '--verbose'
        ], {
          env: {
            ...process.env,
            PGPASSWORD: databaseUrl.password
          }
        });
        
        pgDump.on('close', (code) => {
          if (code === 0) {
            const stats = fs.statSync(finalPath);
            resolve({
              success: true,
              backupPath: finalPath,
              size: stats.size
            });
          } else {
            resolve({
              success: false,
              error: `pg_dump exited with code ${code}`
            });
          }
        });
        
        pgDump.on('error', (error) => {
          resolve({
            success: false,
            error: error.message
          });
        });
      } catch (error) {
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  },
  
  // SQLite backup
  async createSQLiteBackup(backupPath: string): Promise<{
    success: boolean;
    backupPath?: string;
    size?: number;
    error?: string;
  }> {
    const fs = require('fs');
    const path = require('path');
    
    try {
      // Ensure backup directory exists
      const backupDir = path.dirname(backupPath);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      const finalPath = `${backupPath}.db`;
      const sourcePath = process.env.DATABASE_URL?.replace('file:', '') || './prisma/dev.db';
      
      // Copy SQLite file
      fs.copyFileSync(sourcePath, finalPath);
      
      const stats = fs.statSync(finalPath);
      
      return {
        success: true,
        backupPath: finalPath,
        size: stats.size
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },
  
  // List backups
  async listBackups(backupDir: string = './backups'): Promise<Array<{
    name: string;
    path: string;
    size: number;
    created: Date;
  }>> {
    const fs = require('fs');
    const path = require('path');
    
    try {
      if (!fs.existsSync(backupDir)) {
        return [];
      }
      
      const files = fs.readdirSync(backupDir);
      const backups = [];
      
      for (const file of files) {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile() && (file.endsWith('.sql') || file.endsWith('.db'))) {
          backups.push({
            name: file,
            path: filePath,
            size: stats.size,
            created: stats.birthtime
          });
        }
      }
      
      return backups.sort((a, b) => b.created.getTime() - a.created.getTime());
    } catch (error) {
      console.error('Error listing backups:', error);
      return [];
    }
  },
  
  // Automated backup scheduling
  startAutomatedBackups: function(intervalHours: number = 24) {
    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    setInterval(async () => {
      try {
        console.log('Starting automated backup...');
        const result = await this.createBackup();
        
        if (result.success) {
          console.log(`Automated backup completed: ${result.backupPath}`);
        } else {
          console.error('Automated backup failed:', result.error);
        }
      } catch (error) {
        console.error('Automated backup error:', error);
      }
    }, intervalMs);
    
    console.log(`Automated backups scheduled every ${intervalHours} hours`);
  }
};

// Backup endpoint
export const backupEndpoint = async (req: any, res: any) => {
  const { action } = req.body;
  
  try {
    switch (action) {
      case 'create':
        const result = await backupManager.createBackup();
        res.json(result);
        break;
        
      case 'list':
        const backups = await backupManager.listBackups();
        res.json({ backups });
        break;
        
      default:
        res.status(400).json({
          error: 'Invalid action. Use "create" or "list"'
        });
    }
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
```

## Troubleshooting

### Common Issues and Solutions

```typescript
// Database troubleshooting utilities
export const databaseTroubleshooter = {
  // Diagnose connection issues
  async diagnoseConnection(): Promise<{
    status: string;
    issues: string[];
    suggestions: string[];
  }> {
    const issues = [];
    const suggestions = [];
    
    try {
      // Test basic connectivity
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      issues.push('Cannot connect to database');
      
      if (error instanceof Error) {
        if (error.message.includes('ECONNREFUSED')) {
          suggestions.push('Check if database server is running');
          suggestions.push('Verify DATABASE_URL configuration');
        }
        
        if (error.message.includes('authentication')) {
          suggestions.push('Check database credentials');
          suggestions.push('Verify username and password');
        }
        
        if (error.message.includes('database') && error.message.includes('does not exist')) {
          suggestions.push('Create the database or check database name');
        }
      }
    }
    
    // Check connection pool
    try {
      const poolMetrics = await getConnectionPoolMetrics();
      
      if (poolMetrics.activeConnections >= poolMetrics.maxConnections * 0.9) {
        issues.push('Connection pool nearly exhausted');
        suggestions.push('Increase connection pool size');
        suggestions.push('Check for connection leaks');
      }
    } catch (error) {
      issues.push('Cannot get connection pool metrics');
    }
    
    // Check disk space (SQLite)
    if (!process.env.DATABASE_URL?.includes('postgresql')) {
      try {
        const fs = require('fs');
        const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './prisma/dev.db';
        const stats = fs.statSync(dbPath);
        
        if (stats.size > 1024 * 1024 * 1024) { // 1GB
          issues.push('Database file is very large');
          suggestions.push('Consider archiving old data');
          suggestions.push('Implement data retention policies');
        }
      } catch (error) {
        issues.push('Cannot check database file size');
      }
    }
    
    return {
      status: issues.length === 0 ? 'healthy' : 'issues_detected',
      issues,
      suggestions
    };
  },
  
  // Diagnose performance issues
  async diagnosePerformance(): Promise<{
    status: string;
    issues: string[];
    suggestions: string[];
  }> {
    const issues = [];
    const suggestions = [];
    
    // Check query performance
    const performanceReport = queryPerformanceMonitor.getPerformanceReport();
    
    if (performanceReport.averageQueryTime > 500) {
      issues.push(`Average query time is high: ${performanceReport.averageQueryTime}ms`);
      suggestions.push('Review slow queries and add indexes');
      suggestions.push('Consider query optimization');
    }
    
    if (performanceReport.slowQueries > performanceReport.totalQueries * 0.1) {
      issues.push('High percentage of slow queries');
      suggestions.push('Analyze and optimize slow queries');
      suggestions.push('Consider database schema optimization');
    }
    
    // Check for missing indexes
    const indexSuggestions = await indexManager.suggestIndexes();
    if (indexSuggestions.length > 0) {
      issues.push('Potential missing indexes detected');
      suggestions.push('Review index suggestions');
      suggestions.push('Add indexes for frequently queried columns');
    }
    
    return {
      status: issues.length === 0 ? 'optimal' : 'needs_optimization',
      issues,
      suggestions
    };
  },
  
  // Generate diagnostic report
  async generateDiagnosticReport(): Promise<{
    timestamp: string;
    connection: any;
    performance: any;
    health: any;
    migration: any;
  }> {
    const [connection, performance, health, migration] = await Promise.all([
      this.diagnoseConnection(),
      this.diagnosePerformance(),
      databaseHealthCheck(),
      migrationHealthCheck()
    ]);
    
    return {
      timestamp: new Date().toISOString(),
      connection,
      performance,
      health,
      migration
    };
  }
};

// Troubleshooting endpoint
export const troubleshootingEndpoint = async (req: any, res: any) => {
  try {
    const report = await databaseTroubleshooter.generateDiagnosticReport();
    res.json(report);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
};
```

## Best Practices

### 1. Connection Management

```typescript
// Best practices for connection management
export const connectionBestPractices = {
  // Proper connection lifecycle
  async initializeDatabase(): Promise<void> {
    try {
      // Test connection
      await prisma.$connect();
      console.log('✅ Database connected successfully');
      
      // Run health check
      const health = await databaseHealthCheck();
      if (health.status !== 'healthy') {
        console.warn('⚠️ Database health check failed:', health.details);
      }
      
      // Start monitoring
      startDatabaseHealthMonitoring();
      
      // Start automated backups
      if (process.env.NODE_ENV === 'production') {
        backupManager.startAutomatedBackups(24); // Daily backups
      }
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  },
  
  // Graceful shutdown
  async shutdownDatabase(): Promise<void> {
    try {
      await prisma.$disconnect();
      console.log('✅ Database disconnected gracefully');
    } catch (error) {
      console.error('❌ Database shutdown error:', error);
    }
  }
};

// Process event handlers
process.on('SIGTERM', connectionBestPractices.shutdownDatabase);
process.on('SIGINT', connectionBestPractices.shutdownDatabase);
```

### 2. Query Best Practices

```typescript
// Query best practices
export const queryBestPractices = {
  // Use transactions for related operations
  async createUserWithHabits(userData: any, habitsData: any[]) {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: userData
      });
      
      const habits = await tx.habit.createMany({
        data: habitsData.map(habit => ({
          ...habit,
          userId: user.id
        }))
      });
      
      return { user, habits };
    });
  },
  
  // Use proper error handling
  async safeQuery<T>(queryFn: () => Promise<T>, fallback?: T): Promise<T | null> {
    try {
      return await queryFn();
    } catch (error) {
      console.error('Query error:', error);
      
      // Log to monitoring service
      if (typeof sentryUtils !== 'undefined') {
        sentryUtils.captureException(error as Error, {
          context: 'database_query'
        });
      }
      
      return fallback || null;
    }
  },
  
  // Use pagination for large datasets
  async getPaginatedResults<T>(
    queryFn: (skip: number, take: number) => Promise<T[]>,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{
    data: T[];
    pagination: {
      page: number;
      pageSize: number;
      hasMore: boolean;
    };
  }> {
    const skip = (page - 1) * pageSize;
    const take = pageSize + 1; // Get one extra to check if there are more
    
    const results = await queryFn(skip, take);
    const hasMore = results.length > pageSize;
    
    if (hasMore) {
      results.pop(); // Remove the extra item
    }
    
    return {
      data: results,
      pagination: {
        page,
        pageSize,
        hasMore
      }
    };
  }
};
```

### 3. Security Best Practices

```typescript
// Database security best practices
export const securityBestPractices = {
  // Input validation and sanitization
  validateAndSanitizeInput: function(input: any, schema: any): any {
    // Implement input validation using a library like Joi or Zod
    // This is a simplified example
    if (typeof input === 'string') {
      // Remove potentially dangerous characters
      return input.replace(/[<>'"]/g, '');
    }
    
    return input;
  },
  
  // Use parameterized queries (Prisma handles this automatically)
  async safeRawQuery(query: string, params: any[]): Promise<any> {
    // Always use parameterized queries for raw SQL
    return await prisma.$queryRaw(query, ...params);
  },
  
  // Implement row-level security
  async getUserData(userId: string, requestingUserId: string): Promise<any> {
    // Ensure users can only access their own data
    if (userId !== requestingUserId) {
      throw new Error('Unauthorized access');
    }
    
    return await prisma.user.findUnique({
      where: { id: userId }
    });
  }
};
```

This comprehensive database monitoring guide provides developers with all the necessary tools and knowledge to effectively monitor, maintain, and troubleshoot the database layer of the KPI Productivity application.