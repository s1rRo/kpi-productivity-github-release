# Redis Usage and Monitoring Guide

## Overview

This guide provides comprehensive documentation for Redis integration in the KPI Productivity application, covering connection management, caching patterns, real-time features, performance optimization, and troubleshooting procedures.

## Table of Contents

1. [Configuration](#configuration)
2. [Connection Management](#connection-management)
3. [Caching Patterns](#caching-patterns)
4. [Real-time Features](#real-time-features)
5. [Performance Optimization](#performance-optimization)
6. [Monitoring and Health Checks](#monitoring-and-health-checks)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

## Configuration

### Environment Variables

```bash
# Redis connection
REDIS_URL=redis://localhost:6379
REDIS_DB=0
REDIS_PASSWORD=your_password
REDIS_USERNAME=your_username

# Production settings
REDIS_REQUIRED=true
REDIS_MAX_CONNECTIONS=10
REDIS_MIN_CONNECTIONS=2

# Monitoring
REDIS_HEALTH_CHECK_INTERVAL=30000
REDIS_PERFORMANCE_MONITORING=true
```

### Basic Configuration

```typescript
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    connectTimeout: 60000,
    lazyConnect: true,
    reconnectStrategy: (retries) => {
      // Exponential backoff with max delay of 30 seconds
      const delay = Math.min(retries * 50, 30000);
      console.log(`Redis reconnect attempt ${retries}, waiting ${delay}ms`);
      return delay;
    },
  },
  database: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB) : 0,
  password: process.env.REDIS_PASSWORD,
  username: process.env.REDIS_USERNAME,
  isolationPoolOptions: {
    min: 2,
    max: 10,
  },
});
```

### Production Configuration

```typescript
// Production-optimized Redis configuration
const productionConfig = {
  url: process.env.REDIS_URL,
  socket: {
    connectTimeout: 60000,
    lazyConnect: true,
    keepAlive: 30000,
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('Redis reconnection failed after 10 attempts');
        return false; // Stop reconnecting
      }
      return Math.min(retries * 100, 5000);
    },
  },
  // Connection pooling for high-traffic applications
  isolationPoolOptions: {
    min: parseInt(process.env.REDIS_MIN_CONNECTIONS || '5'),
    max: parseInt(process.env.REDIS_MAX_CONNECTIONS || '20'),
    acquireTimeoutMillis: 60000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
  },
  // Security settings
  password: process.env.REDIS_PASSWORD,
  username: process.env.REDIS_USERNAME,
  database: parseInt(process.env.REDIS_DB || '0'),
  // Performance settings
  commandTimeout: 5000,
  lazyConnect: true,
};
```

## Connection Management

### Connection Lifecycle

```typescript
import { connectRedis, disconnectRedis, redisUtils } from './redisClient';

// Application startup
export const initializeRedis = async () => {
  try {
    const client = await connectRedis();
    
    if (client) {
      console.log('✅ Redis initialized successfully');
      
      // Set up health monitoring
      startRedisHealthMonitoring();
      
      return client;
    } else {
      console.warn('⚠️ Redis not available, running without cache');
      return null;
    }
  } catch (error) {
    console.error('❌ Redis initialization failed:', error);
    
    if (process.env.REDIS_REQUIRED === 'true') {
      throw new Error('Redis is required but connection failed');
    }
    
    return null;
  }
};

// Graceful shutdown
export const shutdownRedis = async () => {
  try {
    await disconnectRedis();
    console.log('✅ Redis shutdown completed');
  } catch (error) {
    console.error('❌ Redis shutdown error:', error);
  }
};

// Process event handlers
process.on('SIGTERM', shutdownRedis);
process.on('SIGINT', shutdownRedis);
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  shutdownRedis().finally(() => process.exit(1));
});
```

### Connection Monitoring

```typescript
// Health monitoring with automatic recovery
const startRedisHealthMonitoring = () => {
  const interval = parseInt(process.env.REDIS_HEALTH_CHECK_INTERVAL || '30000');
  
  setInterval(async () => {
    try {
      const isHealthy = await redisUtils.healthCheck();
      
      if (!isHealthy) {
        console.warn('⚠️ Redis health check failed');
        
        // Attempt reconnection
        try {
          await connectRedis();
          console.log('✅ Redis reconnection successful');
        } catch (error) {
          console.error('❌ Redis reconnection failed:', error);
        }
      }
    } catch (error) {
      console.error('Redis health monitoring error:', error);
    }
  }, interval);
};

// Connection metrics tracking
const connectionMetrics = {
  totalConnections: 0,
  activeConnections: 0,
  failedConnections: 0,
  reconnections: 0,
  lastHealthCheck: null as Date | null,
  averageResponseTime: 0,
  responseTimes: [] as number[],
};

// Track connection events
redisClient.on('connect', () => {
  connectionMetrics.totalConnections++;
  connectionMetrics.activeConnections++;
  console.log('Redis connected. Active connections:', connectionMetrics.activeConnections);
});

redisClient.on('error', (error) => {
  connectionMetrics.failedConnections++;
  console.error('Redis connection error:', error);
});

redisClient.on('reconnecting', () => {
  connectionMetrics.reconnections++;
  console.log('Redis reconnecting. Attempt:', connectionMetrics.reconnections);
});
```

## Caching Patterns

### Basic Caching Operations

```typescript
import { cacheService } from './cacheService';

// Simple key-value caching
const cacheUserData = async (userId: string, userData: any) => {
  const success = await cacheService.set(
    `user:${userId}`, 
    userData, 
    { ttl: 3600 } // 1 hour
  );
  
  if (success) {
    console.log(`User data cached for ${userId}`);
  }
};

// Retrieve cached data
const getCachedUserData = async (userId: string) => {
  const result = await cacheService.get(`user:${userId}`);
  
  if (result.hit) {
    console.log(`Cache hit for user ${userId}`);
    return result.data;
  } else {
    console.log(`Cache miss for user ${userId}`);
    return null;
  }
};
```

### Cache-Aside Pattern

```typescript
// Get or set pattern - most common caching strategy
const getUserHabits = async (userId: string) => {
  return await cacheService.getOrSet(
    `habits:${userId}`,
    async () => {
      // Fetch from database if not in cache
      const habits = await prisma.habit.findMany({
        where: { userId },
        include: { records: true }
      });
      
      return habits;
    },
    { ttl: 600 } // 10 minutes
  );
};

// Analytics data caching with compression
const getAnalyticsReport = async (
  userId: string, 
  reportType: string, 
  startDate: Date, 
  endDate: Date
) => {
  // Check cache first
  const cached = await cacheService.getCachedAnalyticsReport(
    userId, 
    reportType, 
    startDate, 
    endDate
  );
  
  if (cached.hit) {
    return cached.data;
  }
  
  // Generate report
  const report = await generateAnalyticsReport(userId, reportType, startDate, endDate);
  
  // Cache with compression for large reports
  await cacheService.cacheAnalyticsReport(
    userId, 
    reportType, 
    startDate, 
    endDate, 
    report
  );
  
  return report;
};
```

### Write-Through Caching

```typescript
// Update both cache and database simultaneously
const updateUserHabit = async (userId: string, habitId: string, updates: any) => {
  // Update database
  const updatedHabit = await prisma.habit.update({
    where: { id: habitId, userId },
    data: updates
  });
  
  // Update cache
  const cacheKey = `habit:${habitId}`;
  await cacheService.set(cacheKey, updatedHabit, { ttl: 600 });
  
  // Invalidate related caches
  await cacheService.invalidateUserCache(userId, [
    `habits:${userId}`,
    `dashboard:${userId}:*`
  ]);
  
  return updatedHabit;
};
```

### Write-Behind Caching

```typescript
// Queue writes for batch processing
const writeQueue = new Map<string, any>();
const BATCH_SIZE = 100;
const BATCH_INTERVAL = 5000; // 5 seconds

const queueHabitUpdate = async (habitId: string, updates: any) => {
  // Update cache immediately
  const cacheKey = `habit:${habitId}`;
  await cacheService.set(cacheKey, updates, { ttl: 600 });
  
  // Queue database write
  writeQueue.set(habitId, updates);
  
  // Process queue when it reaches batch size
  if (writeQueue.size >= BATCH_SIZE) {
    await processBatchWrites();
  }
};

const processBatchWrites = async () => {
  if (writeQueue.size === 0) return;
  
  const updates = Array.from(writeQueue.entries());
  writeQueue.clear();
  
  try {
    // Batch update database
    await Promise.all(
      updates.map(([habitId, data]) =>
        prisma.habit.update({
          where: { id: habitId },
          data
        })
      )
    );
    
    console.log(`Processed ${updates.length} batch writes`);
  } catch (error) {
    console.error('Batch write error:', error);
    
    // Re-queue failed writes
    updates.forEach(([habitId, data]) => {
      writeQueue.set(habitId, data);
    });
  }
};

// Process queued writes periodically
setInterval(processBatchWrites, BATCH_INTERVAL);
```

### Cache Invalidation Strategies

```typescript
// Time-based invalidation (TTL)
const cacheWithTTL = async (key: string, data: any, ttlSeconds: number) => {
  await cacheService.set(key, data, { ttl: ttlSeconds });
};

// Event-based invalidation
const invalidateOnUserUpdate = async (userId: string) => {
  const patterns = [
    `user:${userId}`,
    `habits:${userId}`,
    `goals:${userId}`,
    `analytics:${userId}:*`,
    `dashboard:${userId}:*`
  ];
  
  await cacheService.invalidateUserCache(userId, patterns);
};

// Version-based invalidation
const cacheWithVersion = async (key: string, data: any, version: string) => {
  const versionedKey = `${key}:v${version}`;
  await cacheService.set(versionedKey, data, { ttl: 3600 });
  
  // Store current version
  await cacheService.set(`${key}:version`, version, { ttl: 3600 });
};

const getCachedWithVersion = async (key: string) => {
  const currentVersion = await cacheService.get(`${key}:version`);
  
  if (currentVersion.hit) {
    const versionedKey = `${key}:v${currentVersion.data}`;
    return await cacheService.get(versionedKey);
  }
  
  return { data: null, hit: false, key };
};
```

## Real-time Features

### Pub/Sub for Real-time Updates

```typescript
import { redisUtils } from './redisClient';

// Publisher for real-time updates
export const publishRealTimeUpdate = async (
  channel: string, 
  event: string, 
  data: any
) => {
  const message = JSON.stringify({
    event,
    data,
    timestamp: Date.now()
  });
  
  const success = await redisUtils.publish(channel, message);
  
  if (success) {
    console.log(`Published ${event} to ${channel}`);
  }
  
  return success;
};

// Habit completion real-time notification
export const notifyHabitCompletion = async (
  userId: string, 
  habitId: string, 
  habitName: string
) => {
  await publishRealTimeUpdate(
    `user:${userId}:habits`,
    'habit_completed',
    {
      habitId,
      habitName,
      completedAt: new Date().toISOString()
    }
  );
  
  // Also notify team members if user is in teams
  const userTeams = await getUserTeams(userId);
  
  for (const team of userTeams) {
    await publishRealTimeUpdate(
      `team:${team.id}:activity`,
      'member_habit_completed',
      {
        userId,
        userName: team.members.find(m => m.userId === userId)?.user.name,
        habitName,
        completedAt: new Date().toISOString()
      }
    );
  }
};

// Leaderboard updates
export const updateLeaderboard = async (teamId: string, scores: any[]) => {
  // Cache leaderboard data
  await cacheService.set(
    `leaderboard:${teamId}`,
    scores,
    { ttl: 300 } // 5 minutes
  );
  
  // Notify team members
  await publishRealTimeUpdate(
    `team:${teamId}:leaderboard`,
    'leaderboard_updated',
    { scores, updatedAt: new Date().toISOString() }
  );
};
```

### Session Management

```typescript
// Session storage in Redis
export const sessionManager = {
  // Store user session
  async createSession(userId: string, sessionData: any): Promise<string> {
    const sessionId = generateSessionId();
    const sessionKey = `session:${sessionId}`;
    
    const success = await cacheService.set(
      sessionKey,
      { userId, ...sessionData, createdAt: Date.now() },
      { ttl: 86400 } // 24 hours
    );
    
    if (success) {
      // Track active sessions for user
      await redisUtils.sadd(`user:${userId}:sessions`, sessionId);
    }
    
    return sessionId;
  },

  // Get session data
  async getSession(sessionId: string): Promise<any> {
    const result = await cacheService.get(`session:${sessionId}`);
    return result.hit ? result.data : null;
  },

  // Update session
  async updateSession(sessionId: string, updates: any): Promise<boolean> {
    const session = await this.getSession(sessionId);
    
    if (session) {
      const updatedSession = { ...session, ...updates, updatedAt: Date.now() };
      return await cacheService.set(
        `session:${sessionId}`,
        updatedSession,
        { ttl: 86400 }
      );
    }
    
    return false;
  },

  // Delete session
  async deleteSession(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    
    if (session) {
      // Remove from user's active sessions
      await redisUtils.srem(`user:${session.userId}:sessions`, sessionId);
      
      // Delete session data
      return await cacheService.delete(`session:${sessionId}`);
    }
    
    return false;
  },

  // Get all user sessions
  async getUserSessions(userId: string): Promise<string[]> {
    return await redisUtils.smembers(`user:${userId}:sessions`);
  },

  // Clean up expired sessions
  async cleanupExpiredSessions(): Promise<void> {
    // This would typically be handled by Redis TTL
    // But we can implement additional cleanup logic here
    console.log('Session cleanup completed');
  }
};
```

### Rate Limiting

```typescript
// Rate limiting using Redis
export const rateLimiter = {
  // Simple rate limiting
  async checkRateLimit(
    key: string, 
    limit: number, 
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);
    const rateLimitKey = `rate_limit:${key}`;
    
    // Get current count
    const currentCount = await redisUtils.get(rateLimitKey);
    const count = currentCount ? parseInt(currentCount) : 0;
    
    if (count >= limit) {
      const ttl = await redisClient.ttl(rateLimitKey);
      return {
        allowed: false,
        remaining: 0,
        resetTime: now + (ttl * 1000)
      };
    }
    
    // Increment counter
    const newCount = await redisUtils.incr(rateLimitKey);
    
    if (newCount === 1) {
      // Set TTL for first request in window
      await redisClient.expire(rateLimitKey, windowSeconds);
    }
    
    return {
      allowed: true,
      remaining: limit - newCount,
      resetTime: now + (windowSeconds * 1000)
    };
  },

  // Sliding window rate limiting
  async slidingWindowRateLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);
    const rateLimitKey = `sliding:${key}`;
    
    // Remove old entries
    await redisClient.zRemRangeByScore(rateLimitKey, 0, windowStart);
    
    // Count current requests
    const currentCount = await redisClient.zCard(rateLimitKey);
    
    if (currentCount >= limit) {
      return { allowed: false, remaining: 0 };
    }
    
    // Add current request
    await redisClient.zAdd(rateLimitKey, { score: now, value: `${now}-${Math.random()}` });
    
    // Set expiry
    await redisClient.expire(rateLimitKey, windowSeconds);
    
    return { allowed: true, remaining: limit - currentCount - 1 };
  }
};

// Rate limiting middleware
export const rateLimitMiddleware = (
  limit: number = 100,
  windowSeconds: number = 3600
) => {
  return async (req: any, res: any, next: any) => {
    const key = `${req.ip}:${req.route?.path || req.path}`;
    
    try {
      const result = await rateLimiter.checkRateLimit(key, limit, windowSeconds);
      
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', result.resetTime);
      
      if (!result.allowed) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        });
      }
      
      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      next(); // Allow request on error
    }
  };
};
```

## Performance Optimization

### Connection Pooling

```typescript
// Optimized connection pool configuration
const optimizeConnectionPool = () => {
  const poolConfig = {
    min: parseInt(process.env.REDIS_MIN_CONNECTIONS || '2'),
    max: parseInt(process.env.REDIS_MAX_CONNECTIONS || '10'),
    acquireTimeoutMillis: 60000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
  };
  
  console.log('Redis connection pool configured:', poolConfig);
  return poolConfig;
};

// Monitor pool performance
const monitorConnectionPool = () => {
  setInterval(async () => {
    try {
      const info = await redisClient.info('clients');
      const lines = info.split('\r\n');
      
      const metrics = {};
      lines.forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) {
          metrics[key] = value;
        }
      });
      
      console.log('Redis connection metrics:', {
        connectedClients: metrics.connected_clients,
        blockedClients: metrics.blocked_clients,
        totalConnectionsReceived: metrics.total_connections_received
      });
    } catch (error) {
      console.error('Connection pool monitoring error:', error);
    }
  }, 60000); // Every minute
};
```

### Memory Optimization

```typescript
// Memory usage monitoring
const monitorMemoryUsage = async () => {
  try {
    const info = await redisClient.info('memory');
    const lines = info.split('\r\n');
    
    const memoryMetrics = {};
    lines.forEach(line => {
      const [key, value] = line.split(':');
      if (key && value) {
        memoryMetrics[key] = value;
      }
    });
    
    const usedMemory = parseInt(memoryMetrics.used_memory || '0');
    const maxMemory = parseInt(memoryMetrics.maxmemory || '0');
    
    if (maxMemory > 0) {
      const memoryUsagePercent = (usedMemory / maxMemory) * 100;
      
      if (memoryUsagePercent > 80) {
        console.warn(`Redis memory usage high: ${memoryUsagePercent.toFixed(2)}%`);
        
        // Trigger cleanup if needed
        await cleanupExpiredKeys();
      }
    }
    
    return {
      usedMemory,
      maxMemory,
      usagePercent: maxMemory > 0 ? (usedMemory / maxMemory) * 100 : 0
    };
  } catch (error) {
    console.error('Memory monitoring error:', error);
    return null;
  }
};

// Cleanup expired keys
const cleanupExpiredKeys = async () => {
  try {
    // Get sample of keys to check for expiration
    const keys = await redisClient.randomKey();
    
    if (keys) {
      const ttl = await redisClient.ttl(keys);
      
      if (ttl === -1) {
        // Key has no expiration, consider setting one
        console.log(`Key without expiration found: ${keys}`);
      }
    }
    
    console.log('Expired keys cleanup completed');
  } catch (error) {
    console.error('Cleanup error:', error);
  }
};
```

### Pipeline Operations

```typescript
// Batch operations using pipeline
const batchCacheOperations = async (operations: Array<{
  type: 'set' | 'get' | 'del';
  key: string;
  value?: any;
  ttl?: number;
}>) => {
  const pipeline = redisClient.multi();
  
  operations.forEach(op => {
    switch (op.type) {
      case 'set':
        if (op.ttl) {
          pipeline.setEx(op.key, op.ttl, JSON.stringify(op.value));
        } else {
          pipeline.set(op.key, JSON.stringify(op.value));
        }
        break;
      case 'get':
        pipeline.get(op.key);
        break;
      case 'del':
        pipeline.del(op.key);
        break;
    }
  });
  
  try {
    const results = await pipeline.exec();
    return results;
  } catch (error) {
    console.error('Pipeline operation error:', error);
    return null;
  }
};

// Batch user data updates
const batchUpdateUserData = async (userId: string, updates: any[]) => {
  const operations = updates.map(update => ({
    type: 'set' as const,
    key: `user:${userId}:${update.type}`,
    value: update.data,
    ttl: update.ttl || 3600
  }));
  
  return await batchCacheOperations(operations);
};
```

## Monitoring and Health Checks

### Health Check Implementation

```typescript
// Comprehensive Redis health check
export const redisHealthCheck = async (): Promise<{
  status: 'healthy' | 'unhealthy' | 'degraded';
  details: any;
  metrics: any;
}> => {
  const startTime = Date.now();
  
  try {
    // Basic connectivity test
    const pingResult = await redisClient.ping();
    const pingTime = Date.now() - startTime;
    
    // Memory usage check
    const memoryInfo = await monitorMemoryUsage();
    
    // Connection info
    const clientInfo = await redisClient.info('clients');
    
    // Performance test
    const testKey = `health:${Date.now()}`;
    const testValue = { test: true, timestamp: Date.now() };
    
    const setStart = Date.now();
    await redisClient.set(testKey, JSON.stringify(testValue));
    const setTime = Date.now() - setStart;
    
    const getStart = Date.now();
    const getValue = await redisClient.get(testKey);
    const getTime = Date.now() - getStart;
    
    const delStart = Date.now();
    await redisClient.del(testKey);
    const delTime = Date.now() - delStart;
    
    // Determine status
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    
    if (pingTime > 1000 || setTime > 500 || getTime > 500) {
      status = 'degraded';
    }
    
    if (memoryInfo && memoryInfo.usagePercent > 90) {
      status = 'degraded';
    }
    
    return {
      status,
      details: {
        ping: pingResult === 'PONG',
        connectivity: true,
        operations: {
          set: setTime < 500,
          get: getTime < 500,
          del: delTime < 500
        }
      },
      metrics: {
        pingTime,
        setTime,
        getTime,
        delTime,
        memoryUsage: memoryInfo,
        totalTime: Date.now() - startTime
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
        totalTime: Date.now() - startTime
      }
    };
  }
};

// Health check endpoint
export const healthCheckEndpoint = async (req: any, res: any) => {
  const health = await redisHealthCheck();
  
  const statusCode = health.status === 'healthy' ? 200 : 
                    health.status === 'degraded' ? 200 : 503;
  
  res.status(statusCode).json({
    service: 'redis',
    ...health,
    timestamp: new Date().toISOString()
  });
};
```

### Performance Metrics

```typescript
// Performance metrics collection
const performanceMetrics = {
  operations: {
    get: { count: 0, totalTime: 0, errors: 0 },
    set: { count: 0, totalTime: 0, errors: 0 },
    del: { count: 0, totalTime: 0, errors: 0 },
    pipeline: { count: 0, totalTime: 0, errors: 0 }
  },
  
  // Track operation performance
  trackOperation: function(operation: string, duration: number, success: boolean) {
    if (this.operations[operation]) {
      this.operations[operation].count++;
      this.operations[operation].totalTime += duration;
      
      if (!success) {
        this.operations[operation].errors++;
      }
    }
  },
  
  // Get average response times
  getAverageResponseTimes: function() {
    const averages = {};
    
    Object.entries(this.operations).forEach(([op, stats]) => {
      averages[op] = {
        averageTime: stats.count > 0 ? stats.totalTime / stats.count : 0,
        totalOperations: stats.count,
        errorRate: stats.count > 0 ? (stats.errors / stats.count) * 100 : 0
      };
    });
    
    return averages;
  },
  
  // Reset metrics
  reset: function() {
    Object.keys(this.operations).forEach(op => {
      this.operations[op] = { count: 0, totalTime: 0, errors: 0 };
    });
  }
};

// Wrap Redis operations with performance tracking
const trackRedisOperation = async (
  operation: string,
  fn: () => Promise<any>
): Promise<any> => {
  const startTime = Date.now();
  let success = true;
  
  try {
    const result = await fn();
    return result;
  } catch (error) {
    success = false;
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    performanceMetrics.trackOperation(operation, duration, success);
  }
};

// Enhanced Redis utilities with performance tracking
export const trackedRedisUtils = {
  async get(key: string) {
    return trackRedisOperation('get', () => redisUtils.get(key));
  },
  
  async set(key: string, value: string, ttl?: number) {
    return trackRedisOperation('set', () => 
      ttl ? redisUtils.setWithTTL(key, value, ttl) : redisClient.set(key, value)
    );
  },
  
  async del(key: string) {
    return trackRedisOperation('del', () => redisUtils.del(key));
  }
};
```

### Alerting and Notifications

```typescript
// Alert thresholds
const alertThresholds = {
  responseTime: 1000, // 1 second
  errorRate: 5, // 5%
  memoryUsage: 85, // 85%
  connectionFailures: 3 // 3 consecutive failures
};

// Alert manager
export const alertManager = {
  consecutiveFailures: 0,
  lastAlertTime: 0,
  alertCooldown: 300000, // 5 minutes
  
  async checkAndAlert() {
    const health = await redisHealthCheck();
    const metrics = performanceMetrics.getAverageResponseTimes();
    
    const alerts = [];
    
    // Check response time
    Object.entries(metrics).forEach(([op, stats]) => {
      if (stats.averageTime > alertThresholds.responseTime) {
        alerts.push({
          type: 'performance',
          message: `Redis ${op} operation slow: ${stats.averageTime}ms average`,
          severity: 'warning'
        });
      }
      
      if (stats.errorRate > alertThresholds.errorRate) {
        alerts.push({
          type: 'error_rate',
          message: `Redis ${op} error rate high: ${stats.errorRate}%`,
          severity: 'critical'
        });
      }
    });
    
    // Check memory usage
    if (health.metrics.memoryUsage && 
        health.metrics.memoryUsage.usagePercent > alertThresholds.memoryUsage) {
      alerts.push({
        type: 'memory',
        message: `Redis memory usage high: ${health.metrics.memoryUsage.usagePercent}%`,
        severity: 'warning'
      });
    }
    
    // Check connectivity
    if (health.status === 'unhealthy') {
      this.consecutiveFailures++;
      
      if (this.consecutiveFailures >= alertThresholds.connectionFailures) {
        alerts.push({
          type: 'connectivity',
          message: `Redis connection failed ${this.consecutiveFailures} times`,
          severity: 'critical'
        });
      }
    } else {
      this.consecutiveFailures = 0;
    }
    
    // Send alerts if any and not in cooldown
    if (alerts.length > 0 && Date.now() - this.lastAlertTime > this.alertCooldown) {
      await this.sendAlerts(alerts);
      this.lastAlertTime = Date.now();
    }
    
    return alerts;
  },
  
  async sendAlerts(alerts: any[]) {
    // Send to monitoring service (e.g., Sentry, Slack, email)
    console.error('Redis Alerts:', alerts);
    
    // Example: Send to Sentry
    alerts.forEach(alert => {
      if (typeof sentryUtils !== 'undefined') {
        sentryUtils.captureMessage(alert.message, alert.severity as any, {
          type: alert.type,
          service: 'redis'
        });
      }
    });
  }
};

// Start monitoring
setInterval(() => {
  alertManager.checkAndAlert().catch(console.error);
}, 60000); // Check every minute
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Connection Issues

```typescript
// Connection troubleshooting
const diagnoseConnection = async () => {
  console.log('Diagnosing Redis connection...');
  
  try {
    // Check if Redis is running
    const ping = await redisClient.ping();
    console.log('✅ Redis is responding:', ping);
  } catch (error) {
    console.error('❌ Redis ping failed:', error.message);
    
    // Check common issues
    if (error.message.includes('ECONNREFUSED')) {
      console.log('💡 Redis server is not running or not accessible');
      console.log('   - Check if Redis server is started');
      console.log('   - Verify REDIS_URL configuration');
      console.log('   - Check firewall settings');
    }
    
    if (error.message.includes('ENOTFOUND')) {
      console.log('💡 Redis hostname cannot be resolved');
      console.log('   - Check REDIS_URL hostname');
      console.log('   - Verify DNS resolution');
    }
    
    if (error.message.includes('AUTH')) {
      console.log('💡 Redis authentication failed');
      console.log('   - Check REDIS_PASSWORD configuration');
      console.log('   - Verify Redis AUTH settings');
    }
  }
  
  // Check configuration
  console.log('Configuration check:');
  console.log('  REDIS_URL:', process.env.REDIS_URL || 'not set');
  console.log('  REDIS_DB:', process.env.REDIS_DB || 'default (0)');
  console.log('  REDIS_PASSWORD:', process.env.REDIS_PASSWORD ? 'set' : 'not set');
};
```

#### 2. Memory Issues

```typescript
// Memory troubleshooting
const diagnoseMemory = async () => {
  try {
    const info = await redisClient.info('memory');
    const keyspace = await redisClient.info('keyspace');
    
    console.log('Redis Memory Diagnosis:');
    console.log('Memory Info:', info);
    console.log('Keyspace Info:', keyspace);
    
    // Check for memory leaks
    const sampleKeys = await redisClient.randomKey();
    if (sampleKeys) {
      const ttl = await redisClient.ttl(sampleKeys);
      console.log(`Sample key TTL: ${ttl} (${ttl === -1 ? 'no expiration' : 'expires'})`);
    }
    
    // Suggest cleanup
    console.log('💡 Memory optimization suggestions:');
    console.log('   - Set appropriate TTL for all keys');
    console.log('   - Use Redis EXPIRE command for temporary data');
    console.log('   - Consider using Redis eviction policies');
    console.log('   - Monitor key patterns for memory leaks');
    
  } catch (error) {
    console.error('Memory diagnosis failed:', error);
  }
};
```

#### 3. Performance Issues

```typescript
// Performance troubleshooting
const diagnosePerformance = async () => {
  console.log('Redis Performance Diagnosis:');
  
  // Test basic operations
  const operations = ['set', 'get', 'del'];
  const results = {};
  
  for (const op of operations) {
    const times = [];
    
    for (let i = 0; i < 10; i++) {
      const key = `perf_test_${i}`;
      const value = `test_value_${i}`;
      
      const start = Date.now();
      
      switch (op) {
        case 'set':
          await redisClient.set(key, value);
          break;
        case 'get':
          await redisClient.get(key);
          break;
        case 'del':
          await redisClient.del(key);
          break;
      }
      
      times.push(Date.now() - start);
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    results[op] = {
      average: avgTime,
      min: Math.min(...times),
      max: Math.max(...times)
    };
  }
  
  console.log('Operation Performance:', results);
  
  // Performance recommendations
  Object.entries(results).forEach(([op, stats]) => {
    if (stats.average > 100) {
      console.warn(`⚠️ ${op} operation is slow (${stats.average}ms average)`);
      console.log('💡 Consider:');
      console.log('   - Check network latency');
      console.log('   - Optimize data structures');
      console.log('   - Use connection pooling');
      console.log('   - Consider Redis clustering');
    }
  });
};
```

### Debug Mode

```typescript
// Enable debug logging
const enableDebugMode = () => {
  if (process.env.REDIS_DEBUG === 'true') {
    // Log all Redis commands
    redisClient.on('ready', () => {
      console.log('🔍 Redis debug mode enabled');
    });
    
    // Monitor commands (if supported by client)
    const originalSendCommand = redisClient.sendCommand;
    if (originalSendCommand) {
      redisClient.sendCommand = function(command) {
        console.log('Redis Command:', command);
        return originalSendCommand.apply(this, arguments);
      };
    }
  }
};

// Performance profiling
const profileRedisOperations = () => {
  const profiles = new Map();
  
  const profileOperation = (operation: string) => {
    const start = process.hrtime.bigint();
    
    return {
      end: () => {
        const duration = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
        
        if (!profiles.has(operation)) {
          profiles.set(operation, []);
        }
        
        profiles.get(operation).push(duration);
        
        if (profiles.get(operation).length > 100) {
          // Keep only last 100 measurements
          profiles.get(operation).shift();
        }
      }
    };
  };
  
  // Get profiling results
  const getProfilingResults = () => {
    const results = {};
    
    profiles.forEach((times, operation) => {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      
      results[operation] = { avg, min, max, count: times.length };
    });
    
    return results;
  };
  
  return { profileOperation, getProfilingResults };
};
```

## Best Practices

### 1. Key Naming Conventions

```typescript
// Consistent key naming patterns
const keyPatterns = {
  user: (userId: string) => `user:${userId}`,
  userSession: (userId: string, sessionId: string) => `user:${userId}:session:${sessionId}`,
  userHabits: (userId: string) => `user:${userId}:habits`,
  habit: (habitId: string) => `habit:${habitId}`,
  analytics: (userId: string, type: string, date: string) => `analytics:${userId}:${type}:${date}`,
  cache: (namespace: string, key: string) => `cache:${namespace}:${key}`,
  rateLimit: (identifier: string) => `rate_limit:${identifier}`,
  session: (sessionId: string) => `session:${sessionId}`,
  team: (teamId: string) => `team:${teamId}`,
  leaderboard: (teamId: string) => `leaderboard:${teamId}`
};

// Use consistent prefixes for different data types
const keyPrefixes = {
  CACHE: 'cache:',
  SESSION: 'session:',
  USER: 'user:',
  TEAM: 'team:',
  ANALYTICS: 'analytics:',
  RATE_LIMIT: 'rate_limit:',
  TEMP: 'temp:'
};
```

### 2. TTL Management

```typescript
// TTL constants for different data types
const TTL_CONSTANTS = {
  SHORT: 300,      // 5 minutes
  MEDIUM: 1800,    // 30 minutes
  LONG: 3600,      // 1 hour
  DAILY: 86400,    // 24 hours
  WEEKLY: 604800,  // 7 days
  MONTHLY: 2592000 // 30 days
};

// TTL strategies for different data types
const ttlStrategies = {
  userSession: TTL_CONSTANTS.DAILY,
  analyticsReport: TTL_CONSTANTS.MEDIUM,
  dashboardData: TTL_CONSTANTS.LONG,
  habitData: TTL_CONSTANTS.MEDIUM,
  teamLeaderboard: TTL_CONSTANTS.SHORT,
  rateLimit: TTL_CONSTANTS.LONG,
  tempData: TTL_CONSTANTS.SHORT
};

// Automatic TTL setting
const setWithAutoTTL = async (key: string, data: any, dataType: string) => {
  const ttl = ttlStrategies[dataType] || TTL_CONSTANTS.MEDIUM;
  return await cacheService.set(key, data, { ttl });
};
```

### 3. Error Handling

```typescript
// Graceful degradation patterns
const withFallback = async <T>(
  redisOperation: () => Promise<T>,
  fallback: () => Promise<T>,
  operationName: string
): Promise<T> => {
  try {
    return await redisOperation();
  } catch (error) {
    console.warn(`Redis ${operationName} failed, using fallback:`, error.message);
    
    // Log to monitoring service
    if (typeof sentryUtils !== 'undefined') {
      sentryUtils.captureException(error, {
        operation: operationName,
        fallbackUsed: true
      });
    }
    
    return await fallback();
  }
};

// Example usage
const getUserData = async (userId: string) => {
  return await withFallback(
    // Redis operation
    async () => {
      const cached = await cacheService.get(`user:${userId}`);
      if (cached.hit) return cached.data;
      throw new Error('Cache miss');
    },
    // Fallback to database
    async () => {
      return await prisma.user.findUnique({ where: { id: userId } });
    },
    'getUserData'
  );
};
```

### 4. Security Considerations

```typescript
// Secure Redis configuration
const secureRedisConfig = {
  // Use strong passwords
  password: process.env.REDIS_PASSWORD,
  
  // Limit command access
  commandTimeout: 5000,
  
  // Use TLS in production
  tls: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true,
    ca: process.env.REDIS_TLS_CA,
    cert: process.env.REDIS_TLS_CERT,
    key: process.env.REDIS_TLS_KEY
  } : undefined,
  
  // Network security
  socket: {
    connectTimeout: 60000,
    keepAlive: 30000
  }
};

// Data sanitization
const sanitizeForCache = (data: any): any => {
  if (typeof data === 'object' && data !== null) {
    const sanitized = { ...data };
    
    // Remove sensitive fields
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.secret;
    delete sanitized.apiKey;
    
    return sanitized;
  }
  
  return data;
};

// Secure key generation
const generateSecureKey = (namespace: string, identifier: string): string => {
  // Hash sensitive identifiers
  const crypto = require('crypto');
  const hashedId = crypto.createHash('sha256').update(identifier).digest('hex').substring(0, 16);
  
  return `${namespace}:${hashedId}`;
};
```

This comprehensive Redis usage and monitoring guide provides developers with all the necessary information to effectively implement, monitor, and troubleshoot Redis integration in the KPI Productivity application.