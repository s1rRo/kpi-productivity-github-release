# Socket.IO Real-time Monitoring Guide

## Overview

This guide provides comprehensive documentation for Socket.IO real-time monitoring in the KPI Productivity application, covering connection monitoring, event handling, performance optimization, and troubleshooting for real-time features including notifications, leaderboards, and friend activity.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Connection Monitoring](#connection-monitoring)
3. [Event Handling](#event-handling)
4. [Performance Optimization](#performance-optimization)
5. [Real-time Features](#real-time-features)
6. [Health Monitoring](#health-monitoring)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

## Architecture Overview

### Socket.IO Server Architecture

```typescript
// Backend Socket Service Structure
export class SocketService {
  private io: SocketIOServer;
  private prisma: PrismaClient;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId
  
  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? ['https://your-frontend-domain.com'] 
          : ['http://localhost:3000', 'http://localhost:5173'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });
  }
}
```

### Client Architecture

```typescript
// Frontend Socket Service Structure
class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventListeners: Map<string, Function[]> = new Map();
}
```

## Connection Monitoring

### Server-side Connection Tracking

```typescript
// Connection metrics tracking
export const socketMetrics = {
  totalConnections: 0,
  activeConnections: 0,
  connectionsByUser: new Map<string, number>(),
  connectionEvents: [] as Array<{
    type: 'connect' | 'disconnect' | 'error';
    userId?: string;
    socketId: string;
    timestamp: Date;
    reason?: string;
  }>,
  
  // Track connection event
  trackConnection: function(event: {
    type: 'connect' | 'disconnect' | 'error';
    userId?: string;
    socketId: string;
    reason?: string;
  }) {
    this.connectionEvents.push({
      ...event,
      timestamp: new Date()
    });
    
    // Keep only last 1000 events
    if (this.connectionEvents.length > 1000) {
      this.connectionEvents.shift();
    }
    
    // Update counters
    switch (event.type) {
      case 'connect':
        this.totalConnections++;
        this.activeConnections++;
        if (event.userId) {
          this.connectionsByUser.set(
            event.userId, 
            (this.connectionsByUser.get(event.userId) || 0) + 1
          );
        }
        break;
      case 'disconnect':
        this.activeConnections = Math.max(0, this.activeConnections - 1);
        if (event.userId) {
          const current = this.connectionsByUser.get(event.userId) || 0;
          if (current <= 1) {
            this.connectionsByUser.delete(event.userId);
          } else {
            this.connectionsByUser.set(event.userId, current - 1);
          }
        }
        break;
    }
  },
  
  // Get connection statistics
  getStats: function() {
    const now = Date.now();
    const lastHour = now - (60 * 60 * 1000);
    
    const recentEvents = this.connectionEvents.filter(
      event => event.timestamp.getTime() > lastHour
    );
    
    const connectionsLastHour = recentEvents.filter(e => e.type === 'connect').length;
    const disconnectionsLastHour = recentEvents.filter(e => e.type === 'disconnect').length;
    const errorsLastHour = recentEvents.filter(e => e.type === 'error').length;
    
    return {
      totalConnections: this.totalConnections,
      activeConnections: this.activeConnections,
      uniqueUsers: this.connectionsByUser.size,
      connectionsLastHour,
      disconnectionsLastHour,
      errorsLastHour,
      connectionRate: connectionsLastHour / 60, // per minute
      errorRate: errorsLastHour / Math.max(connectionsLastHour, 1) * 100 // percentage
    };
  }
};
```#
## Enhanced Connection Monitoring

```typescript
// Enhanced socket service with monitoring
export class MonitoredSocketService extends SocketService {
  private connectionMonitor: ConnectionMonitor;
  
  constructor(server: HTTPServer) {
    super(server);
    this.connectionMonitor = new ConnectionMonitor();
    this.setupMonitoring();
  }
  
  private setupMonitoring() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const startTime = Date.now();
      
      // Track connection
      socketMetrics.trackConnection({
        type: 'connect',
        userId: socket.userId,
        socketId: socket.id
      });
      
      // Monitor connection health
      this.connectionMonitor.addConnection(socket.id, {
        userId: socket.userId,
        connectedAt: new Date(),
        lastPing: new Date(),
        userAgent: socket.handshake.headers['user-agent'],
        ip: socket.handshake.address
      });
      
      // Set up ping/pong monitoring
      const pingInterval = setInterval(() => {
        socket.emit('ping', { timestamp: Date.now() });
      }, 30000); // Every 30 seconds
      
      socket.on('pong', (data) => {
        this.connectionMonitor.updateLastPing(socket.id);
        const latency = Date.now() - data.timestamp;
        this.connectionMonitor.updateLatency(socket.id, latency);
      });
      
      socket.on('disconnect', (reason) => {
        clearInterval(pingInterval);
        
        const connectionTime = Date.now() - startTime;
        
        socketMetrics.trackConnection({
          type: 'disconnect',
          userId: socket.userId,
          socketId: socket.id,
          reason
        });
        
        this.connectionMonitor.removeConnection(socket.id, {
          reason,
          connectionDuration: connectionTime
        });
      });
      
      socket.on('error', (error) => {
        socketMetrics.trackConnection({
          type: 'error',
          userId: socket.userId,
          socketId: socket.id,
          reason: error.message
        });
        
        this.connectionMonitor.logError(socket.id, error);
      });
    });
  }
}

// Connection monitor class
class ConnectionMonitor {
  private connections: Map<string, {
    userId?: string;
    connectedAt: Date;
    lastPing: Date;
    latency: number[];
    userAgent?: string;
    ip?: string;
    errors: Array<{ error: any; timestamp: Date }>;
  }> = new Map();
  
  addConnection(socketId: string, data: any) {
    this.connections.set(socketId, {
      ...data,
      latency: [],
      errors: []
    });
  }
  
  removeConnection(socketId: string, disconnectInfo: any) {
    const connection = this.connections.get(socketId);
    if (connection) {
      // Log connection summary
      console.log(`Connection ${socketId} summary:`, {
        userId: connection.userId,
        duration: disconnectInfo.connectionDuration,
        averageLatency: this.getAverageLatency(socketId),
        errorCount: connection.errors.length,
        reason: disconnectInfo.reason
      });
    }
    
    this.connections.delete(socketId);
  }
  
  updateLastPing(socketId: string) {
    const connection = this.connections.get(socketId);
    if (connection) {
      connection.lastPing = new Date();
    }
  }
  
  updateLatency(socketId: string, latency: number) {
    const connection = this.connections.get(socketId);
    if (connection) {
      connection.latency.push(latency);
      
      // Keep only last 10 latency measurements
      if (connection.latency.length > 10) {
        connection.latency.shift();
      }
    }
  }
  
  logError(socketId: string, error: any) {
    const connection = this.connections.get(socketId);
    if (connection) {
      connection.errors.push({
        error,
        timestamp: new Date()
      });
    }
  }
  
  getAverageLatency(socketId: string): number {
    const connection = this.connections.get(socketId);
    if (connection && connection.latency.length > 0) {
      return connection.latency.reduce((a, b) => a + b, 0) / connection.latency.length;
    }
    return 0;
  }
  
  getConnectionHealth(): {
    totalConnections: number;
    healthyConnections: number;
    staleConnections: number;
    highLatencyConnections: number;
    averageLatency: number;
  } {
    const now = Date.now();
    const staleThreshold = 60000; // 1 minute
    const highLatencyThreshold = 1000; // 1 second
    
    let totalLatency = 0;
    let latencyCount = 0;
    let healthyConnections = 0;
    let staleConnections = 0;
    let highLatencyConnections = 0;
    
    for (const [socketId, connection] of this.connections) {
      const timeSinceLastPing = now - connection.lastPing.getTime();
      const avgLatency = this.getAverageLatency(socketId);
      
      if (timeSinceLastPing > staleThreshold) {
        staleConnections++;
      } else {
        healthyConnections++;
      }
      
      if (avgLatency > highLatencyThreshold) {
        highLatencyConnections++;
      }
      
      if (connection.latency.length > 0) {
        totalLatency += avgLatency;
        latencyCount++;
      }
    }
    
    return {
      totalConnections: this.connections.size,
      healthyConnections,
      staleConnections,
      highLatencyConnections,
      averageLatency: latencyCount > 0 ? totalLatency / latencyCount : 0
    };
  }
}
```

### Client-side Connection Monitoring

```typescript
// Client-side connection monitoring
class ClientSocketMonitor {
  private connectionStats = {
    connectTime: null as Date | null,
    disconnectCount: 0,
    reconnectAttempts: 0,
    lastDisconnectReason: null as string | null,
    latencyHistory: [] as number[],
    averageLatency: 0,
    connectionDuration: 0
  };
  
  private pingInterval: NodeJS.Timeout | null = null;
  
  startMonitoring(socket: Socket) {
    this.connectionStats.connectTime = new Date();
    
    // Start ping monitoring
    this.pingInterval = setInterval(() => {
      const pingStart = Date.now();
      socket.emit('ping', { timestamp: pingStart });
    }, 30000);
    
    socket.on('pong', (data) => {
      const latency = Date.now() - data.timestamp;
      this.updateLatency(latency);
    });
    
    socket.on('disconnect', (reason) => {
      this.connectionStats.disconnectCount++;
      this.connectionStats.lastDisconnectReason = reason;
      
      if (this.connectionStats.connectTime) {
        this.connectionStats.connectionDuration = 
          Date.now() - this.connectionStats.connectTime.getTime();
      }
      
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
    });
    
    socket.on('connect', () => {
      this.connectionStats.connectTime = new Date();
      this.connectionStats.reconnectAttempts = 0;
    });
  }
  
  private updateLatency(latency: number) {
    this.connectionStats.latencyHistory.push(latency);
    
    // Keep only last 20 measurements
    if (this.connectionStats.latencyHistory.length > 20) {
      this.connectionStats.latencyHistory.shift();
    }
    
    // Calculate average
    this.connectionStats.averageLatency = 
      this.connectionStats.latencyHistory.reduce((a, b) => a + b, 0) / 
      this.connectionStats.latencyHistory.length;
  }
  
  getConnectionStats() {
    return {
      ...this.connectionStats,
      isConnected: this.connectionStats.connectTime !== null,
      uptime: this.connectionStats.connectTime 
        ? Date.now() - this.connectionStats.connectTime.getTime()
        : 0
    };
  }
  
  getConnectionQuality(): 'excellent' | 'good' | 'poor' | 'disconnected' {
    if (!this.connectionStats.connectTime) return 'disconnected';
    
    const avgLatency = this.connectionStats.averageLatency;
    
    if (avgLatency < 100) return 'excellent';
    if (avgLatency < 500) return 'good';
    return 'poor';
  }
}
```## 
Event Handling

### Event Monitoring and Analytics

```typescript
// Event tracking system
export const eventMonitor = {
  events: new Map<string, {
    count: number;
    totalProcessingTime: number;
    averageProcessingTime: number;
    errors: number;
    lastOccurrence: Date;
  }>(),
  
  // Track event processing
  trackEvent: function(eventName: string, processingTime: number, success: boolean) {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, {
        count: 0,
        totalProcessingTime: 0,
        averageProcessingTime: 0,
        errors: 0,
        lastOccurrence: new Date()
      });
    }
    
    const stats = this.events.get(eventName)!;
    stats.count++;
    stats.totalProcessingTime += processingTime;
    stats.averageProcessingTime = stats.totalProcessingTime / stats.count;
    stats.lastOccurrence = new Date();
    
    if (!success) {
      stats.errors++;
    }
  },
  
  // Get event statistics
  getEventStats: function() {
    const stats = Array.from(this.events.entries()).map(([eventName, data]) => ({
      eventName,
      ...data,
      errorRate: data.count > 0 ? (data.errors / data.count) * 100 : 0
    }));
    
    return stats.sort((a, b) => b.count - a.count);
  },
  
  // Get slow events
  getSlowEvents: function(threshold: number = 1000) {
    return Array.from(this.events.entries())
      .filter(([_, stats]) => stats.averageProcessingTime > threshold)
      .map(([eventName, stats]) => ({ eventName, ...stats }))
      .sort((a, b) => b.averageProcessingTime - a.averageProcessingTime);
  }
};

// Enhanced event handler with monitoring
const monitoredEventHandler = (eventName: string, handler: Function) => {
  return async (...args: any[]) => {
    const startTime = Date.now();
    let success = true;
    
    try {
      await handler(...args);
    } catch (error) {
      success = false;
      console.error(`Event ${eventName} error:`, error);
      throw error;
    } finally {
      const processingTime = Date.now() - startTime;
      eventMonitor.trackEvent(eventName, processingTime, success);
      
      if (processingTime > 1000) {
        console.warn(`Slow event detected: ${eventName} took ${processingTime}ms`);
      }
    }
  };
};

// Usage in socket service
socket.on('progress:update', monitoredEventHandler('progress:update', async (data) => {
  await this.handleProgressUpdate(socket, data);
}));

socket.on('team_goal:progress_update', monitoredEventHandler('team_goal:progress_update', async (data) => {
  await this.handleTeamGoalProgressUpdate(socket, data);
}));
```

### Real-time Event Broadcasting

```typescript
// Broadcasting monitor
export const broadcastMonitor = {
  broadcasts: new Map<string, {
    count: number;
    totalRecipients: number;
    averageRecipients: number;
    lastBroadcast: Date;
    failedDeliveries: number;
  }>(),
  
  // Track broadcast
  trackBroadcast: function(eventType: string, recipientCount: number, failedCount: number = 0) {
    if (!this.broadcasts.has(eventType)) {
      this.broadcasts.set(eventType, {
        count: 0,
        totalRecipients: 0,
        averageRecipients: 0,
        lastBroadcast: new Date(),
        failedDeliveries: 0
      });
    }
    
    const stats = this.broadcasts.get(eventType)!;
    stats.count++;
    stats.totalRecipients += recipientCount;
    stats.averageRecipients = stats.totalRecipients / stats.count;
    stats.lastBroadcast = new Date();
    stats.failedDeliveries += failedCount;
  },
  
  // Get broadcast statistics
  getBroadcastStats: function() {
    return Array.from(this.broadcasts.entries()).map(([eventType, stats]) => ({
      eventType,
      ...stats,
      failureRate: stats.count > 0 ? (stats.failedDeliveries / stats.totalRecipients) * 100 : 0
    }));
  }
};

// Enhanced broadcasting with monitoring
export const monitoredBroadcast = {
  // Broadcast to room with monitoring
  toRoom: async function(io: SocketIOServer, room: string, event: string, data: any) {
    const startTime = Date.now();
    
    try {
      // Get room size
      const roomSockets = await io.in(room).fetchSockets();
      const recipientCount = roomSockets.length;
      
      if (recipientCount === 0) {
        console.warn(`No recipients for broadcast to room ${room}`);
        broadcastMonitor.trackBroadcast(event, 0, 0);
        return;
      }
      
      // Broadcast
      io.to(room).emit(event, data);
      
      // Track successful broadcast
      broadcastMonitor.trackBroadcast(event, recipientCount, 0);
      
      const duration = Date.now() - startTime;
      console.log(`Broadcast ${event} to ${recipientCount} users in room ${room} (${duration}ms)`);
      
    } catch (error) {
      console.error(`Broadcast error for event ${event} to room ${room}:`, error);
      broadcastMonitor.trackBroadcast(event, 0, 1);
    }
  },
  
  // Broadcast to specific users
  toUsers: async function(io: SocketIOServer, userIds: string[], event: string, data: any) {
    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;
    
    for (const userId of userIds) {
      try {
        const userSockets = await io.in(`user:${userId}`).fetchSockets();
        
        if (userSockets.length > 0) {
          io.to(`user:${userId}`).emit(event, data);
          successCount++;
        } else {
          failureCount++;
        }
      } catch (error) {
        console.error(`Failed to broadcast to user ${userId}:`, error);
        failureCount++;
      }
    }
    
    broadcastMonitor.trackBroadcast(event, successCount, failureCount);
    
    const duration = Date.now() - startTime;
    console.log(`Broadcast ${event} to ${successCount}/${userIds.length} users (${duration}ms)`);
  }
};
```

## Performance Optimization

### Connection Scaling

```typescript
// Connection scaling monitor
export const scalingMonitor = {
  metrics: {
    maxConcurrentConnections: 0,
    connectionSpikes: [] as Array<{ timestamp: Date; count: number }>,
    resourceUsage: [] as Array<{
      timestamp: Date;
      memoryUsage: number;
      cpuUsage: number;
      connectionCount: number;
    }>
  },
  
  // Monitor connection scaling
  monitorScaling: function() {
    setInterval(() => {
      const currentConnections = socketMetrics.activeConnections;
      
      // Track max connections
      if (currentConnections > this.metrics.maxConcurrentConnections) {
        this.metrics.maxConcurrentConnections = currentConnections;
      }
      
      // Detect spikes (50% increase in 1 minute)
      const lastSpike = this.metrics.connectionSpikes[this.metrics.connectionSpikes.length - 1];
      if (!lastSpike || currentConnections > lastSpike.count * 1.5) {
        this.metrics.connectionSpikes.push({
          timestamp: new Date(),
          count: currentConnections
        });
        
        // Keep only last 100 spikes
        if (this.metrics.connectionSpikes.length > 100) {
          this.metrics.connectionSpikes.shift();
        }
      }
      
      // Track resource usage
      const memoryUsage = process.memoryUsage();
      this.metrics.resourceUsage.push({
        timestamp: new Date(),
        memoryUsage: memoryUsage.heapUsed,
        cpuUsage: process.cpuUsage().user,
        connectionCount: currentConnections
      });
      
      // Keep only last 1440 measurements (24 hours at 1-minute intervals)
      if (this.metrics.resourceUsage.length > 1440) {
        this.metrics.resourceUsage.shift();
      }
      
    }, 60000); // Every minute
  },
  
  // Get scaling recommendations
  getScalingRecommendations: function() {
    const recommendations = [];
    const currentConnections = socketMetrics.activeConnections;
    const maxConnections = this.metrics.maxConcurrentConnections;
    
    // Connection-based recommendations
    if (currentConnections > 1000) {
      recommendations.push({
        type: 'scaling',
        priority: 'high',
        message: 'Consider implementing Redis adapter for horizontal scaling',
        details: `Current connections: ${currentConnections}`
      });
    }
    
    if (maxConnections > 5000) {
      recommendations.push({
        type: 'infrastructure',
        priority: 'high',
        message: 'Consider load balancing across multiple Socket.IO instances',
        details: `Peak connections: ${maxConnections}`
      });
    }
    
    // Resource-based recommendations
    const recentUsage = this.metrics.resourceUsage.slice(-60); // Last hour
    if (recentUsage.length > 0) {
      const avgMemory = recentUsage.reduce((sum, usage) => sum + usage.memoryUsage, 0) / recentUsage.length;
      const memoryMB = avgMemory / 1024 / 1024;
      
      if (memoryMB > 512) {
        recommendations.push({
          type: 'memory',
          priority: 'medium',
          message: 'High memory usage detected',
          details: `Average memory usage: ${memoryMB.toFixed(2)}MB`
        });
      }
    }
    
    return recommendations;
  }
};
```

### Message Queue Integration

```typescript
// Message queue for handling high-volume events
export class SocketMessageQueue {
  private queue: Array<{
    id: string;
    type: string;
    data: any;
    recipients: string[];
    priority: 'high' | 'medium' | 'low';
    timestamp: Date;
    retries: number;
  }> = [];
  
  private processing = false;
  private maxRetries = 3;
  private batchSize = 100;
  
  // Add message to queue
  enqueue(message: {
    type: string;
    data: any;
    recipients: string[];
    priority?: 'high' | 'medium' | 'low';
  }) {
    this.queue.push({
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...message,
      priority: message.priority || 'medium',
      timestamp: new Date(),
      retries: 0
    });
    
    // Sort by priority and timestamp
    this.queue.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp.getTime() - b.timestamp.getTime();
    });
    
    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }
  }
  
  // Process message queue
  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, this.batchSize);
        
        await Promise.all(
          batch.map(message => this.processMessage(message))
        );
        
        // Small delay between batches to prevent overwhelming
        if (this.queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
    } catch (error) {
      console.error('Queue processing error:', error);
    } finally {
      this.processing = false;
    }
  }
  
  // Process individual message
  private async processMessage(message: any) {
    try {
      // Broadcast to recipients
      await monitoredBroadcast.toUsers(
        this.io,
        message.recipients,
        message.type,
        message.data
      );
      
      console.log(`Processed message ${message.id} for ${message.recipients.length} recipients`);
    } catch (error) {
      console.error(`Failed to process message ${message.id}:`, error);
      
      // Retry logic
      if (message.retries < this.maxRetries) {
        message.retries++;
        message.timestamp = new Date(); // Update timestamp for retry
        this.queue.push(message);
      } else {
        console.error(`Message ${message.id} failed after ${this.maxRetries} retries`);
      }
    }
  }
  
  // Get queue statistics
  getQueueStats() {
    const priorityCounts = this.queue.reduce((acc, msg) => {
      acc[msg.priority] = (acc[msg.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalMessages: this.queue.length,
      priorityCounts,
      processing: this.processing,
      oldestMessage: this.queue.length > 0 ? this.queue[this.queue.length - 1].timestamp : null
    };
  }
}
```## Real-t
ime Features

### Leaderboard System Monitoring

```typescript
// Leaderboard monitoring
export const leaderboardMonitor = {
  updates: new Map<string, {
    updateCount: number;
    lastUpdate: Date;
    averageUpdateTime: number;
    totalUpdateTime: number;
    subscriberCount: number;
    errors: number;
  }>(),
  
  // Track leaderboard update
  trackUpdate: function(teamId: string, updateTime: number, subscriberCount: number, success: boolean) {
    if (!this.updates.has(teamId)) {
      this.updates.set(teamId, {
        updateCount: 0,
        lastUpdate: new Date(),
        averageUpdateTime: 0,
        totalUpdateTime: 0,
        subscriberCount: 0,
        errors: 0
      });
    }
    
    const stats = this.updates.get(teamId)!;
    stats.updateCount++;
    stats.lastUpdate = new Date();
    stats.totalUpdateTime += updateTime;
    stats.averageUpdateTime = stats.totalUpdateTime / stats.updateCount;
    stats.subscriberCount = subscriberCount;
    
    if (!success) {
      stats.errors++;
    }
  },
  
  // Get leaderboard performance
  getLeaderboardPerformance: function() {
    return Array.from(this.updates.entries()).map(([teamId, stats]) => ({
      teamId,
      ...stats,
      errorRate: stats.updateCount > 0 ? (stats.errors / stats.updateCount) * 100 : 0,
      updatesPerHour: stats.updateCount // This would need time-based calculation
    }));
  }
};

// Enhanced leaderboard update with monitoring
export const monitoredLeaderboardUpdate = async (
  io: SocketIOServer,
  teamId: string,
  leaderboardData: any
) => {
  const startTime = Date.now();
  let success = true;
  let subscriberCount = 0;
  
  try {
    // Get subscriber count
    const roomSockets = await io.in(`leaderboard:${teamId}`).fetchSockets();
    subscriberCount = roomSockets.length;
    
    if (subscriberCount === 0) {
      console.warn(`No subscribers for leaderboard update: team ${teamId}`);
      return;
    }
    
    // Broadcast update
    io.to(`leaderboard:${teamId}`).emit('leaderboard:update', {
      teamId,
      leaderboard: leaderboardData,
      timestamp: new Date()
    });
    
    console.log(`Leaderboard updated for team ${teamId}: ${subscriberCount} subscribers`);
    
  } catch (error) {
    success = false;
    console.error(`Leaderboard update failed for team ${teamId}:`, error);
  } finally {
    const updateTime = Date.now() - startTime;
    leaderboardMonitor.trackUpdate(teamId, updateTime, subscriberCount, success);
  }
};
```

### Friend Activity Monitoring

```typescript
// Friend activity monitoring
export const friendActivityMonitor = {
  activities: new Map<string, {
    activityCount: number;
    lastActivity: Date;
    friendsNotified: number;
    totalNotificationTime: number;
    averageNotificationTime: number;
  }>(),
  
  // Track friend activity
  trackActivity: function(userId: string, notificationTime: number, friendsNotified: number) {
    if (!this.activities.has(userId)) {
      this.activities.set(userId, {
        activityCount: 0,
        lastActivity: new Date(),
        friendsNotified: 0,
        totalNotificationTime: 0,
        averageNotificationTime: 0
      });
    }
    
    const stats = this.activities.get(userId)!;
    stats.activityCount++;
    stats.lastActivity = new Date();
    stats.friendsNotified += friendsNotified;
    stats.totalNotificationTime += notificationTime;
    stats.averageNotificationTime = stats.totalNotificationTime / stats.activityCount;
  },
  
  // Get activity statistics
  getActivityStats: function() {
    return Array.from(this.activities.entries()).map(([userId, stats]) => ({
      userId,
      ...stats,
      averageFriendsPerActivity: stats.activityCount > 0 ? stats.friendsNotified / stats.activityCount : 0
    }));
  }
};

// Enhanced friend activity notification
export const notifyFriendActivity = async (
  io: SocketIOServer,
  prisma: PrismaClient,
  userId: string,
  activity: { type: string; data: any }
) => {
  const startTime = Date.now();
  
  try {
    // Get user's friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId }
        ]
      }
    });
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true }
    });
    
    let friendsNotified = 0;
    
    // Notify each friend
    for (const friendship of friendships) {
      const friendId = friendship.user1Id === userId ? friendship.user2Id : friendship.user1Id;
      
      try {
        const friendSockets = await io.in(`friends:${friendId}`).fetchSockets();
        
        if (friendSockets.length > 0) {
          io.to(`friends:${friendId}`).emit('friend:activity', {
            userId,
            userName: user?.name || user?.email,
            activity,
            timestamp: new Date()
          });
          
          friendsNotified++;
        }
      } catch (error) {
        console.error(`Failed to notify friend ${friendId}:`, error);
      }
    }
    
    const notificationTime = Date.now() - startTime;
    friendActivityMonitor.trackActivity(userId, notificationTime, friendsNotified);
    
    console.log(`Friend activity notification sent: ${friendsNotified} friends notified in ${notificationTime}ms`);
    
  } catch (error) {
    console.error('Friend activity notification error:', error);
  }
};
```

### Notification System Monitoring

```typescript
// Notification monitoring
export const notificationMonitor = {
  notifications: new Map<string, {
    sent: number;
    delivered: number;
    failed: number;
    averageDeliveryTime: number;
    totalDeliveryTime: number;
    lastSent: Date;
  }>(),
  
  // Track notification
  trackNotification: function(
    type: string, 
    deliveryTime: number, 
    success: boolean
  ) {
    if (!this.notifications.has(type)) {
      this.notifications.set(type, {
        sent: 0,
        delivered: 0,
        failed: 0,
        averageDeliveryTime: 0,
        totalDeliveryTime: 0,
        lastSent: new Date()
      });
    }
    
    const stats = this.notifications.get(type)!;
    stats.sent++;
    stats.lastSent = new Date();
    
    if (success) {
      stats.delivered++;
      stats.totalDeliveryTime += deliveryTime;
      stats.averageDeliveryTime = stats.totalDeliveryTime / stats.delivered;
    } else {
      stats.failed++;
    }
  },
  
  // Get notification statistics
  getNotificationStats: function() {
    return Array.from(this.notifications.entries()).map(([type, stats]) => ({
      type,
      ...stats,
      deliveryRate: stats.sent > 0 ? (stats.delivered / stats.sent) * 100 : 0,
      failureRate: stats.sent > 0 ? (stats.failed / stats.sent) * 100 : 0
    }));
  }
};

// Enhanced notification system
export const sendMonitoredNotification = async (
  io: SocketIOServer,
  userId: string,
  notification: {
    title: string;
    body: string;
    type: string;
    data?: any;
  }
) => {
  const startTime = Date.now();
  let success = true;
  
  try {
    // Check if user is connected
    const userSockets = await io.in(`user:${userId}`).fetchSockets();
    
    if (userSockets.length === 0) {
      console.warn(`User ${userId} not connected for notification: ${notification.title}`);
      success = false;
    } else {
      // Send real-time notification
      io.to(`user:${userId}`).emit('notification:push', {
        ...notification,
        timestamp: new Date()
      });
      
      console.log(`Notification sent to user ${userId}: ${notification.title}`);
    }
    
  } catch (error) {
    success = false;
    console.error(`Notification delivery failed for user ${userId}:`, error);
  } finally {
    const deliveryTime = Date.now() - startTime;
    notificationMonitor.trackNotification(notification.type, deliveryTime, success);
  }
};
```

## Health Monitoring

### Socket.IO Health Check

```typescript
// Socket.IO health check system
export const socketHealthCheck = {
  // Comprehensive health check
  async performHealthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
    metrics: any;
  }> {
    const startTime = Date.now();
    
    try {
      // Connection health
      const connectionHealth = connectionPoolMonitor.getConnectionHealth();
      
      // Event processing health
      const eventStats = eventMonitor.getEventStats();
      const slowEvents = eventMonitor.getSlowEvents(1000);
      
      // Broadcasting health
      const broadcastStats = broadcastMonitor.getBroadcastStats();
      
      // Resource usage
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // Determine overall status
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      // Check for degraded conditions
      if (connectionHealth.staleConnections > connectionHealth.totalConnections * 0.1) {
        status = 'degraded';
      }
      
      if (connectionHealth.averageLatency > 1000) {
        status = 'degraded';
      }
      
      if (slowEvents.length > 5) {
        status = 'degraded';
      }
      
      // Check for unhealthy conditions
      if (connectionHealth.staleConnections > connectionHealth.totalConnections * 0.3) {
        status = 'unhealthy';
      }
      
      const errorRate = eventStats.reduce((sum, stat) => sum + stat.errorRate, 0) / eventStats.length;
      if (errorRate > 10) {
        status = 'unhealthy';
      }
      
      return {
        status,
        details: {
          connections: connectionHealth,
          events: {
            totalEvents: eventStats.length,
            slowEvents: slowEvents.length,
            averageErrorRate: errorRate
          },
          broadcasting: {
            totalBroadcasts: broadcastStats.length,
            averageFailureRate: broadcastStats.reduce((sum, stat) => sum + stat.failureRate, 0) / broadcastStats.length
          }
        },
        metrics: {
          memoryUsage: {
            heapUsed: memoryUsage.heapUsed,
            heapTotal: memoryUsage.heapTotal,
            external: memoryUsage.external
          },
          cpuUsage: {
            user: cpuUsage.user,
            system: cpuUsage.system
          },
          healthCheckTime: Date.now() - startTime
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        metrics: {
          healthCheckTime: Date.now() - startTime
        }
      };
    }
  },
  
  // Start automated health monitoring
  startHealthMonitoring: function(intervalMs: number = 60000) {
    setInterval(async () => {
      try {
        const health = await this.performHealthCheck();
        
        if (health.status !== 'healthy') {
          console.warn(`Socket.IO health check: ${health.status}`, health.details);
          
          // Send alert for unhealthy status
          if (health.status === 'unhealthy') {
            this.sendHealthAlert(health);
          }
        }
      } catch (error) {
        console.error('Socket.IO health monitoring error:', error);
      }
    }, intervalMs);
  },
  
  // Send health alert
  sendHealthAlert: function(healthStatus: any) {
    console.error('🚨 Socket.IO Health Alert:', healthStatus);
    
    // Send to monitoring service
    if (typeof sentryUtils !== 'undefined') {
      sentryUtils.captureMessage('Socket.IO health check failed', 'error', {
        healthStatus,
        service: 'socketio'
      });
    }
  }
};

// Health check endpoint
export const socketHealthEndpoint = async (req: any, res: any) => {
  try {
    const health = await socketHealthCheck.performHealthCheck();
    
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      service: 'socketio',
      ...health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      service: 'socketio',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
};
```## Trou
bleshooting

### Common Issues and Solutions

#### 1. Connection Issues

```typescript
// Connection troubleshooting utilities
export const connectionTroubleshooter = {
  // Diagnose connection problems
  async diagnoseConnectionIssues(): Promise<{
    issues: string[];
    suggestions: string[];
    diagnostics: any;
  }> {
    const issues = [];
    const suggestions = [];
    const diagnostics = {};
    
    // Check connection metrics
    const connectionStats = socketMetrics.getStats();
    diagnostics.connectionStats = connectionStats;
    
    if (connectionStats.errorRate > 5) {
      issues.push(`High connection error rate: ${connectionStats.errorRate.toFixed(2)}%`);
      suggestions.push('Check authentication middleware');
      suggestions.push('Verify JWT token validation');
      suggestions.push('Review CORS configuration');
    }
    
    if (connectionStats.activeConnections === 0 && connectionStats.totalConnections > 0) {
      issues.push('No active connections despite connection attempts');
      suggestions.push('Check for connection drops');
      suggestions.push('Review disconnect event handlers');
      suggestions.push('Verify client reconnection logic');
    }
    
    // Check connection health
    const connectionHealth = connectionPoolMonitor.getConnectionHealth();
    diagnostics.connectionHealth = connectionHealth;
    
    if (connectionHealth.staleConnections > connectionHealth.totalConnections * 0.2) {
      issues.push(`High number of stale connections: ${connectionHealth.staleConnections}`);
      suggestions.push('Implement connection cleanup');
      suggestions.push('Reduce ping interval');
      suggestions.push('Check client-side connection monitoring');
    }
    
    if (connectionHealth.averageLatency > 2000) {
      issues.push(`High average latency: ${connectionHealth.averageLatency}ms`);
      suggestions.push('Check network connectivity');
      suggestions.push('Optimize server performance');
      suggestions.push('Consider using WebSocket transport only');
    }
    
    return { issues, suggestions, diagnostics };
  },
  
  // Test connection functionality
  async testConnection(io: SocketIOServer): Promise<boolean> {
    try {
      // Test basic server functionality
      const sockets = await io.fetchSockets();
      console.log(`Connection test: ${sockets.length} active sockets`);
      
      // Test broadcasting
      io.emit('test:ping', { timestamp: Date.now() });
      
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }
};
```

#### 2. Performance Issues

```typescript
// Performance troubleshooting
export const performanceTroubleshooter = {
  // Diagnose performance problems
  diagnosePerformance(): {
    issues: string[];
    suggestions: string[];
    metrics: any;
  } {
    const issues = [];
    const suggestions = [];
    
    // Event performance
    const slowEvents = eventMonitor.getSlowEvents(500);
    const eventStats = eventMonitor.getEventStats();
    
    if (slowEvents.length > 0) {
      issues.push(`${slowEvents.length} slow events detected`);
      suggestions.push('Optimize event handlers');
      suggestions.push('Consider async processing for heavy operations');
      suggestions.push('Implement event queuing for high-volume events');
    }
    
    // Broadcasting performance
    const broadcastStats = broadcastMonitor.getBroadcastStats();
    const highFailureRateBroadcasts = broadcastStats.filter(stat => stat.failureRate > 10);
    
    if (highFailureRateBroadcasts.length > 0) {
      issues.push(`${highFailureRateBroadcasts.length} broadcast types with high failure rates`);
      suggestions.push('Check room management');
      suggestions.push('Verify user presence before broadcasting');
      suggestions.push('Implement retry logic for failed broadcasts');
    }
    
    // Memory usage
    const memoryUsage = process.memoryUsage();
    const memoryMB = memoryUsage.heapUsed / 1024 / 1024;
    
    if (memoryMB > 512) {
      issues.push(`High memory usage: ${memoryMB.toFixed(2)}MB`);
      suggestions.push('Check for memory leaks in event handlers');
      suggestions.push('Implement connection cleanup');
      suggestions.push('Consider connection limits');
    }
    
    return {
      issues,
      suggestions,
      metrics: {
        slowEvents,
        eventStats,
        broadcastStats,
        memoryUsage: memoryMB
      }
    };
  },
  
  // Performance optimization recommendations
  getOptimizationRecommendations(): Array<{
    category: string;
    priority: 'high' | 'medium' | 'low';
    recommendation: string;
    impact: string;
  }> {
    const recommendations = [];
    const connectionCount = socketMetrics.activeConnections;
    
    // Connection-based recommendations
    if (connectionCount > 1000) {
      recommendations.push({
        category: 'scaling',
        priority: 'high',
        recommendation: 'Implement Redis adapter for horizontal scaling',
        impact: 'Enables multiple server instances'
      });
    }
    
    if (connectionCount > 100) {
      recommendations.push({
        category: 'performance',
        priority: 'medium',
        recommendation: 'Implement connection pooling and rate limiting',
        impact: 'Reduces server load and prevents abuse'
      });
    }
    
    // Event-based recommendations
    const slowEvents = eventMonitor.getSlowEvents(1000);
    if (slowEvents.length > 0) {
      recommendations.push({
        category: 'events',
        priority: 'high',
        recommendation: 'Optimize slow event handlers',
        impact: 'Improves response times and reduces blocking'
      });
    }
    
    return recommendations;
  }
};
```

#### 3. Memory Leaks

```typescript
// Memory leak detection
export const memoryLeakDetector = {
  snapshots: [] as Array<{
    timestamp: Date;
    memoryUsage: NodeJS.MemoryUsage;
    connectionCount: number;
    eventListenerCount: number;
  }>,
  
  // Take memory snapshot
  takeSnapshot: function() {
    const snapshot = {
      timestamp: new Date(),
      memoryUsage: process.memoryUsage(),
      connectionCount: socketMetrics.activeConnections,
      eventListenerCount: this.getEventListenerCount()
    };
    
    this.snapshots.push(snapshot);
    
    // Keep only last 100 snapshots
    if (this.snapshots.length > 100) {
      this.snapshots.shift();
    }
    
    return snapshot;
  },
  
  // Get event listener count (approximation)
  getEventListenerCount: function(): number {
    // This would need to be implemented based on your specific setup
    return process.listenerCount('uncaughtException') + 
           process.listenerCount('unhandledRejection');
  },
  
  // Detect memory leaks
  detectLeaks: function(): {
    leakDetected: boolean;
    analysis: any;
    recommendations: string[];
  } {
    if (this.snapshots.length < 10) {
      return {
        leakDetected: false,
        analysis: { message: 'Insufficient data for leak detection' },
        recommendations: []
      };
    }
    
    const recent = this.snapshots.slice(-10);
    const oldest = recent[0];
    const newest = recent[recent.length - 1];
    
    const memoryGrowth = newest.memoryUsage.heapUsed - oldest.memoryUsage.heapUsed;
    const connectionGrowth = newest.connectionCount - oldest.connectionCount;
    const timeSpan = newest.timestamp.getTime() - oldest.timestamp.getTime();
    
    // Calculate growth rates
    const memoryGrowthRate = memoryGrowth / timeSpan; // bytes per ms
    const memoryGrowthMBPerHour = (memoryGrowthRate * 3600000) / (1024 * 1024);
    
    const leakDetected = memoryGrowthMBPerHour > 10 && connectionGrowth < memoryGrowthMBPerHour;
    
    const recommendations = [];
    if (leakDetected) {
      recommendations.push('Review event listener cleanup');
      recommendations.push('Check for unclosed database connections');
      recommendations.push('Verify proper socket cleanup on disconnect');
      recommendations.push('Monitor for circular references');
    }
    
    return {
      leakDetected,
      analysis: {
        memoryGrowthMBPerHour,
        connectionGrowth,
        timeSpanHours: timeSpan / 3600000,
        oldestSnapshot: oldest,
        newestSnapshot: newest
      },
      recommendations
    };
  },
  
  // Start automated leak detection
  startMonitoring: function(intervalMs: number = 300000) { // 5 minutes
    setInterval(() => {
      this.takeSnapshot();
      
      const leakAnalysis = this.detectLeaks();
      if (leakAnalysis.leakDetected) {
        console.warn('🚨 Memory leak detected:', leakAnalysis.analysis);
        console.warn('Recommendations:', leakAnalysis.recommendations);
      }
    }, intervalMs);
  }
};
```

### Debug Mode

```typescript
// Debug mode for Socket.IO
export const socketDebugger = {
  debugMode: process.env.SOCKET_DEBUG === 'true',
  
  // Enable debug logging
  enableDebugMode: function(io: SocketIOServer) {
    if (!this.debugMode) return;
    
    console.log('🔍 Socket.IO debug mode enabled');
    
    // Log all events
    io.on('connection', (socket) => {
      console.log(`[DEBUG] Connection: ${socket.id} (User: ${socket.userId})`);
      
      // Log all incoming events
      const originalEmit = socket.emit;
      socket.emit = function(event, ...args) {
        console.log(`[DEBUG] Outgoing event: ${event}`, args);
        return originalEmit.apply(this, [event, ...args]);
      };
      
      // Log all outgoing events
      const originalOn = socket.on;
      socket.on = function(event, handler) {
        const wrappedHandler = (...args: any[]) => {
          console.log(`[DEBUG] Incoming event: ${event}`, args);
          return handler(...args);
        };
        return originalOn.call(this, event, wrappedHandler);
      };
      
      socket.on('disconnect', (reason) => {
        console.log(`[DEBUG] Disconnect: ${socket.id} (Reason: ${reason})`);
      });
    });
  },
  
  // Performance profiling
  profileEvent: function(eventName: string, handler: Function) {
    if (!this.debugMode) return handler;
    
    return async (...args: any[]) => {
      const start = process.hrtime.bigint();
      const memoryBefore = process.memoryUsage();
      
      try {
        const result = await handler(...args);
        
        const duration = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
        const memoryAfter = process.memoryUsage();
        const memoryDiff = memoryAfter.heapUsed - memoryBefore.heapUsed;
        
        console.log(`[PROFILE] ${eventName}: ${duration.toFixed(2)}ms, Memory: ${memoryDiff} bytes`);
        
        return result;
      } catch (error) {
        const duration = Number(process.hrtime.bigint() - start) / 1000000;
        console.error(`[PROFILE] ${eventName} ERROR: ${duration.toFixed(2)}ms`, error);
        throw error;
      }
    };
  }
};
```

## Best Practices

### 1. Connection Management

```typescript
// Best practices for connection management
export const connectionBestPractices = {
  // Implement proper authentication
  setupAuthentication: function(io: SocketIOServer) {
    io.use(async (socket: any, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }
        
        // Verify token and set user context
        const decoded = jwt.verify(token, process.env.JWT_SECRET!);
        socket.userId = decoded.userId;
        
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });
  },
  
  // Implement connection limits
  setupConnectionLimits: function(io: SocketIOServer) {
    const connectionLimits = new Map<string, number>();
    const maxConnectionsPerUser = 5;
    
    io.use((socket: any, next) => {
      const userId = socket.userId;
      const currentConnections = connectionLimits.get(userId) || 0;
      
      if (currentConnections >= maxConnectionsPerUser) {
        return next(new Error('Connection limit exceeded'));
      }
      
      connectionLimits.set(userId, currentConnections + 1);
      
      socket.on('disconnect', () => {
        const current = connectionLimits.get(userId) || 0;
        if (current <= 1) {
          connectionLimits.delete(userId);
        } else {
          connectionLimits.set(userId, current - 1);
        }
      });
      
      next();
    });
  },
  
  // Implement graceful shutdown
  setupGracefulShutdown: function(io: SocketIOServer) {
    const shutdown = async () => {
      console.log('Shutting down Socket.IO server...');
      
      // Notify all clients
      io.emit('server:shutdown', {
        message: 'Server is shutting down',
        timestamp: new Date()
      });
      
      // Wait for clients to disconnect
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Close server
      io.close(() => {
        console.log('Socket.IO server closed');
        process.exit(0);
      });
    };
    
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }
};
```

### 2. Event Handling Best Practices

```typescript
// Event handling best practices
export const eventBestPractices = {
  // Implement event validation
  validateEvent: function(eventData: any, schema: any): boolean {
    // Implement validation logic using a library like Joi or Zod
    // This is a simplified example
    return typeof eventData === 'object' && eventData !== null;
  },
  
  // Implement rate limiting for events
  setupEventRateLimit: function() {
    const eventLimits = new Map<string, Map<string, number>>();
    const maxEventsPerMinute = 60;
    
    return (socket: any, eventName: string) => {
      const userId = socket.userId;
      const now = Date.now();
      const windowStart = now - 60000; // 1 minute window
      
      if (!eventLimits.has(userId)) {
        eventLimits.set(userId, new Map());
      }
      
      const userLimits = eventLimits.get(userId)!;
      const eventCount = userLimits.get(eventName) || 0;
      
      if (eventCount >= maxEventsPerMinute) {
        socket.emit('error', {
          message: 'Event rate limit exceeded',
          eventName,
          limit: maxEventsPerMinute
        });
        return false;
      }
      
      userLimits.set(eventName, eventCount + 1);
      
      // Reset counter after window
      setTimeout(() => {
        const current = userLimits.get(eventName) || 0;
        userLimits.set(eventName, Math.max(0, current - 1));
      }, 60000);
      
      return true;
    };
  },
  
  // Implement error handling
  wrapEventHandler: function(handler: Function) {
    return async (...args: any[]) => {
      try {
        await handler(...args);
      } catch (error) {
        console.error('Event handler error:', error);
        
        // Send error to client if socket is available
        const socket = args[0];
        if (socket && socket.emit) {
          socket.emit('error', {
            message: 'Internal server error',
            timestamp: new Date()
          });
        }
      }
    };
  }
};
```

### 3. Performance Best Practices

```typescript
// Performance best practices
export const performanceBestPractices = {
  // Implement efficient room management
  optimizeRoomManagement: function(io: SocketIOServer) {
    // Use Redis adapter for scaling
    if (process.env.REDIS_URL) {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const { createClient } = require('redis');
      
      const pubClient = createClient({ url: process.env.REDIS_URL });
      const subClient = pubClient.duplicate();
      
      io.adapter(createAdapter(pubClient, subClient));
    }
    
    // Implement room cleanup
    setInterval(async () => {
      const rooms = await io.fetchSockets();
      console.log(`Active rooms: ${rooms.length}`);
      
      // Clean up empty rooms if needed
    }, 300000); // Every 5 minutes
  },
  
  // Implement message batching
  setupMessageBatching: function() {
    const messageQueue = new SocketMessageQueue();
    
    return {
      queueMessage: (message: any) => {
        messageQueue.enqueue(message);
      },
      getQueueStats: () => {
        return messageQueue.getQueueStats();
      }
    };
  },
  
  // Monitor and optimize memory usage
  optimizeMemoryUsage: function() {
    // Start memory leak detection
    memoryLeakDetector.startMonitoring();
    
    // Implement garbage collection hints
    if (global.gc) {
      setInterval(() => {
        global.gc();
      }, 300000); // Every 5 minutes
    }
    
    // Monitor memory usage
    setInterval(() => {
      const usage = process.memoryUsage();
      const usageMB = usage.heapUsed / 1024 / 1024;
      
      if (usageMB > 512) {
        console.warn(`High memory usage: ${usageMB.toFixed(2)}MB`);
      }
    }, 60000); // Every minute
  }
};
```

This comprehensive Socket.IO monitoring guide provides developers with all the necessary tools and knowledge to effectively monitor, optimize, and troubleshoot real-time features in the KPI Productivity application.