import React from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Database, Wifi } from 'lucide-react';
import CodeBlock from '../components/CodeBlock';

const MonitoringPage: React.FC = () => {
  const { category } = useParams<{ category?: string }>();

  const monitoringCategories = [
    {
      id: 'sentry',
      title: 'Sentry Integration',
      icon: <AlertTriangle className="w-6 h-6 text-red-600" />,
      description: 'Error tracking and performance monitoring with Sentry',
      content: `
# Sentry Integration

Sentry provides comprehensive error tracking and performance monitoring for the KPI Productivity application.

## Configuration

Configure Sentry in your environment variables:

\`\`\`bash
SENTRY_DSN=your-sentry-dsn-here
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=1.0.0
\`\`\`

## Error Tracking

Sentry automatically captures unhandled errors and exceptions. You can also manually capture errors:

\`\`\`javascript
import * as Sentry from '@sentry/node';

// Capture an exception
try {
  // Some code that might throw
} catch (error) {
  Sentry.captureException(error);
}

// Capture a message
Sentry.captureMessage('Something went wrong', 'error');
\`\`\`

## Performance Monitoring

Enable performance monitoring to track API response times and database queries:

\`\`\`javascript
// Transaction tracking
const transaction = Sentry.startTransaction({
  op: 'api',
  name: 'GET /api/habits'
});

// Set transaction on scope
Sentry.getCurrentHub().configureScope(scope => scope.setSpan(transaction));

// Your API logic here

transaction.finish();
\`\`\`

## Custom Context

Add custom context to help with debugging:

\`\`\`javascript
Sentry.setUser({
  id: user.id,
  email: user.email
});

Sentry.setTag('feature', 'habits');
Sentry.setContext('request', {
  method: 'POST',
  url: '/api/habits'
});
\`\`\`
      `
    },
    {
      id: 'redis',
      title: 'Redis Usage',
      icon: <Database className="w-6 h-6 text-red-500" />,
      description: 'Redis caching and real-time features monitoring',
      content: `
# Redis Usage and Monitoring

Redis is used for caching, session storage, and real-time features in the KPI Productivity application.

## Connection Monitoring

Monitor Redis connection health:

\`\`\`javascript
const redis = require('redis');
const client = redis.createClient();

// Connection monitoring
client.on('connect', () => {
  console.log('Redis connected');
});

client.on('error', (err) => {
  console.error('Redis error:', err);
  // Send alert to monitoring system
});

client.on('reconnecting', () => {
  console.log('Redis reconnecting...');
});
\`\`\`

## Performance Monitoring

Track Redis performance metrics:

\`\`\`javascript
const monitorRedis = async () => {
  const start = Date.now();
  
  try {
    await client.ping();
    const latency = Date.now() - start;
    
    if (latency > 100) {
      console.warn(\`Redis latency high: \${latency}ms\`);
    }
    
    // Log metrics
    console.log(\`Redis latency: \${latency}ms\`);
  } catch (error) {
    console.error('Redis health check failed:', error);
  }
};

// Run every 30 seconds
setInterval(monitorRedis, 30000);
\`\`\`

## Cache Usage Patterns

Common caching patterns used in the application:

\`\`\`javascript
// Cache user data
const cacheUser = async (userId, userData) => {
  await client.setex(\`user:\${userId}\`, 3600, JSON.stringify(userData));
};

// Get cached user data
const getCachedUser = async (userId) => {
  const cached = await client.get(\`user:\${userId}\`);
  return cached ? JSON.parse(cached) : null;
};

// Cache invalidation
const invalidateUserCache = async (userId) => {
  await client.del(\`user:\${userId}\`);
};
\`\`\`

## Real-time Features

Redis pub/sub for real-time notifications:

\`\`\`javascript
// Publisher
const publishUpdate = async (channel, data) => {
  await client.publish(channel, JSON.stringify(data));
};

// Subscriber
const subscriber = redis.createClient();
subscriber.subscribe('user-updates');

subscriber.on('message', (channel, message) => {
  const data = JSON.parse(message);
  // Handle real-time update
});
\`\`\`
      `
    },
    {
      id: 'database',
      title: 'Database Monitoring',
      icon: <Database className="w-6 h-6 text-blue-600" />,
      description: 'PostgreSQL database health and performance monitoring',
      content: `
# Database Monitoring

Monitor PostgreSQL database health, performance, and connection status.

## Connection Pool Monitoring

Monitor database connection pool:

\`\`\`javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const monitorDatabase = async () => {
  try {
    const start = Date.now();
    await prisma.$queryRaw\`SELECT 1\`;
    const responseTime = Date.now() - start;
    
    console.log(\`Database response time: \${responseTime}ms\`);
    
    if (responseTime > 1000) {
      console.warn('Database response time is high');
      // Send alert
    }
  } catch (error) {
    console.error('Database health check failed:', error);
    // Send critical alert
  }
};

// Run every minute
setInterval(monitorDatabase, 60000);
\`\`\`

## Query Performance

Monitor slow queries:

\`\`\`javascript
// Log slow queries
const logSlowQuery = (query, duration) => {
  if (duration > 1000) {
    console.warn(\`Slow query detected: \${query} (\${duration}ms)\`);
  }
};

// Wrapper for database queries
const executeQuery = async (query, params) => {
  const start = Date.now();
  try {
    const result = await prisma.$queryRaw(query, ...params);
    const duration = Date.now() - start;
    logSlowQuery(query, duration);
    return result;
  } catch (error) {
    console.error('Query failed:', error);
    throw error;
  }
};
\`\`\`

## Migration Monitoring

Track database migrations:

\`\`\`javascript
const checkMigrationStatus = async () => {
  try {
    const migrations = await prisma.$queryRaw\`
      SELECT * FROM _prisma_migrations 
      WHERE finished_at IS NULL
    \`;
    
    if (migrations.length > 0) {
      console.warn('Pending migrations detected');
    }
  } catch (error) {
    console.error('Migration check failed:', error);
  }
};
\`\`\`

## Database Metrics

Key metrics to monitor:

- Connection count
- Query response times
- Lock waits
- Cache hit ratio
- Disk usage
- Active connections

\`\`\`javascript
const getDatabaseMetrics = async () => {
  const metrics = await prisma.$queryRaw\`
    SELECT 
      (SELECT count(*) FROM pg_stat_activity) as active_connections,
      (SELECT count(*) FROM pg_locks) as locks,
      (SELECT pg_database_size(current_database())) as database_size
  \`;
  
  return metrics[0];
};
\`\`\`
      `
    },
    {
      id: 'socketio',
      title: 'Socket.IO Monitoring',
      icon: <Wifi className="w-6 h-6 text-green-600" />,
      description: 'Real-time WebSocket connection monitoring',
      content: `
# Socket.IO Monitoring

Monitor WebSocket connections and real-time features.

## Connection Monitoring

Track Socket.IO connections:

\`\`\`javascript
const io = require('socket.io')(server);

// Connection tracking
let activeConnections = 0;
const connectionsByUser = new Map();

io.on('connection', (socket) => {
  activeConnections++;
  console.log(\`New connection: \${socket.id} (Total: \${activeConnections})\`);
  
  socket.on('authenticate', (data) => {
    const userId = data.userId;
    connectionsByUser.set(userId, socket.id);
    socket.userId = userId;
  });
  
  socket.on('disconnect', () => {
    activeConnections--;
    if (socket.userId) {
      connectionsByUser.delete(socket.userId);
    }
    console.log(\`Connection closed: \${socket.id} (Total: \${activeConnections})\`);
  });
});
\`\`\`

## Performance Monitoring

Monitor Socket.IO performance:

\`\`\`javascript
// Message latency tracking
const trackMessageLatency = (socket) => {
  socket.on('ping', (timestamp) => {
    const latency = Date.now() - timestamp;
    console.log(\`Socket latency: \${latency}ms\`);
    
    if (latency > 1000) {
      console.warn(\`High socket latency: \${latency}ms\`);
    }
    
    socket.emit('pong', { latency });
  });
};

// Room monitoring
const monitorRooms = () => {
  const rooms = io.sockets.adapter.rooms;
  console.log(\`Active rooms: \${rooms.size}\`);
  
  rooms.forEach((sockets, room) => {
    console.log(\`Room \${room}: \${sockets.size} connections\`);
  });
};

setInterval(monitorRooms, 60000);
\`\`\`

## Error Handling

Handle Socket.IO errors:

\`\`\`javascript
io.on('connection', (socket) => {
  socket.on('error', (error) => {
    console.error(\`Socket error for \${socket.id}:\`, error);
    // Log to monitoring system
  });
  
  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
  });
});

// Global error handling
io.engine.on('connection_error', (err) => {
  console.error('Engine connection error:', err);
});
\`\`\`

## Real-time Notifications

Monitor notification delivery:

\`\`\`javascript
const sendNotification = async (userId, notification) => {
  const socketId = connectionsByUser.get(userId);
  
  if (socketId) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('notification', notification);
      console.log(\`Notification sent to user \${userId}\`);
      return true;
    }
  }
  
  // User not connected, store for later
  console.log(\`User \${userId} not connected, storing notification\`);
  return false;
};
\`\`\`

## Metrics Dashboard

Key metrics to track:

- Active connections
- Messages per second
- Connection duration
- Room occupancy
- Error rates
- Latency distribution

\`\`\`javascript
const getSocketMetrics = () => {
  return {
    activeConnections,
    totalRooms: io.sockets.adapter.rooms.size,
    connectedUsers: connectionsByUser.size,
    uptime: process.uptime()
  };
};
\`\`\`
      `
    }
  ];

  const selectedCategory = category ? monitoringCategories.find(cat => cat.id === category) : null;

  if (selectedCategory) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center mb-4">
            {selectedCategory.icon}
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white ml-3">
              {selectedCategory.title}
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {selectedCategory.description}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="prose dark:prose-invert max-w-none">
            {selectedCategory.content.split('```').map((part, index) => {
              if (index % 2 === 0) {
                // Regular markdown content
                return (
                  <div key={index} className="whitespace-pre-wrap">
                    {part.split('\n').map((line, lineIndex) => {
                      if (line.startsWith('# ')) {
                        return <h1 key={lineIndex} className="text-2xl font-bold mt-8 mb-4">{line.substring(2)}</h1>;
                      } else if (line.startsWith('## ')) {
                        return <h2 key={lineIndex} className="text-xl font-semibold mt-6 mb-3">{line.substring(3)}</h2>;
                      } else if (line.startsWith('### ')) {
                        return <h3 key={lineIndex} className="text-lg font-medium mt-4 mb-2">{line.substring(4)}</h3>;
                      } else if (line.startsWith('- ')) {
                        return <li key={lineIndex} className="ml-4">{line.substring(2)}</li>;
                      } else if (line.trim()) {
                        return <p key={lineIndex} className="mb-2">{line}</p>;
                      }
                      return <br key={lineIndex} />;
                    })}
                  </div>
                );
              } else {
                // Code block
                const lines = part.split('\n');
                const language = lines[0] || 'text';
                const code = lines.slice(1).join('\n');
                return (
                  <div key={index} className="my-4">
                    <CodeBlock language={language} code={code} />
                  </div>
                );
              }
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Monitoring Documentation
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Comprehensive monitoring guides for Sentry, Redis, database, and real-time features.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {monitoringCategories.map((category) => (
          <a
            key={category.id}
            href={`/monitoring/${category.id}`}
            className="block p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {category.icon}
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {category.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  {category.description}
                </p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};

export default MonitoringPage;