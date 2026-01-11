# Sentry Integration Guide

## Overview

This guide provides comprehensive documentation for Sentry integration in the KPI Productivity application, covering error tracking, performance monitoring, and debugging patterns for both backend and frontend components.

## Table of Contents

1. [Configuration](#configuration)
2. [Error Handling Patterns](#error-handling-patterns)
3. [Performance Monitoring](#performance-monitoring)
4. [Breadcrumb Usage](#breadcrumb-usage)
5. [Context Setting](#context-setting)
6. [Custom Error Boundaries](#custom-error-boundaries)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Configuration

### Backend Configuration

The backend Sentry integration is configured in `backend/src/middleware/sentry.ts`:

```typescript
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

export function initializeSentry(app: Express) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app }),
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    release: process.env.npm_package_version || "1.0.0",
  });
}
```

### Frontend Configuration

The frontend Sentry integration is configured in `frontend/src/lib/sentry.tsx`:

```typescript
import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

export function initializeSentry() {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || "development",
    integrations: [
      new BrowserTracing({
        routingInstrumentation: Sentry.reactRouterV6Instrumentation(
          React.useEffect,
          useLocation,
          useNavigationType,
          createRoutesFromChildren,
          matchRoutes
        ),
      }),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}
```

### Environment Variables

Required environment variables:

```bash
# Backend
SENTRY_DSN=https://your-dsn@sentry.io/project-id
NODE_ENV=production|development

# Frontend
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
VITE_SENTRY_ENVIRONMENT=production|development
VITE_APP_VERSION=1.0.0
```

## Error Handling Patterns

### Basic Error Capture

**Backend Example:**
```typescript
import { sentryUtils } from '../middleware/sentry';

try {
  // Risky operation
  await processUserData(userData);
} catch (error) {
  sentryUtils.captureException(error, {
    userId: user.id,
    operation: 'processUserData',
    additionalData: userData
  });
  throw error; // Re-throw if needed
}
```

**Frontend Example:**
```typescript
import { sentryUtils } from '../lib/sentry';

const handleSubmit = async (formData) => {
  try {
    await submitForm(formData);
  } catch (error) {
    sentryUtils.captureException(error, {
      formData: formData,
      component: 'UserForm',
      action: 'submit'
    });
    setError('Failed to submit form');
  }
};
```

### Message Capture with Levels

```typescript
// Info level
sentryUtils.captureMessage('User logged in successfully', 'info', {
  userId: user.id,
  timestamp: new Date().toISOString()
});

// Warning level
sentryUtils.captureMessage('API rate limit approaching', 'warning', {
  currentRequests: requestCount,
  limit: rateLimit
});

// Error level
sentryUtils.captureMessage('Database connection failed', 'error', {
  connectionString: 'postgresql://...',
  retryAttempt: 3
});
```

### Custom Error Classes

```typescript
class ValidationError extends Error {
  constructor(message: string, public field: string, public value: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Usage
try {
  validateUserInput(input);
} catch (error) {
  if (error instanceof ValidationError) {
    sentryUtils.captureException(error, {
      field: error.field,
      value: error.value,
      validationType: 'user_input'
    });
  }
}
```

## Performance Monitoring

### Transaction Tracking

**Backend API Endpoint:**
```typescript
import { sentryUtils } from '../middleware/sentry';

app.get('/api/habits', async (req, res) => {
  const transaction = sentryUtils.startTransaction('GET /api/habits', 'http');
  
  try {
    // Database query span
    const dbSpan = transaction.startChild({
      op: 'db.query',
      description: 'Fetch user habits'
    });
    
    const habits = await prisma.habit.findMany({
      where: { userId: req.user.id }
    });
    
    dbSpan.finish();
    
    // Processing span
    const processSpan = transaction.startChild({
      op: 'process',
      description: 'Process habit data'
    });
    
    const processedHabits = habits.map(habit => ({
      ...habit,
      streak: calculateStreak(habit)
    }));
    
    processSpan.finish();
    
    res.json(processedHabits);
  } catch (error) {
    transaction.setStatus('internal_error');
    throw error;
  } finally {
    transaction.finish();
  }
});
```

**Frontend Component Performance:**
```typescript
import { useSentryTransaction } from '../lib/sentry';

const HabitsPage = () => {
  const { transaction, startSpan } = useSentryTransaction('HabitsPage', 'navigation');
  const [habits, setHabits] = useState([]);
  
  useEffect(() => {
    const fetchHabits = async () => {
      const span = startSpan('fetch-habits', 'http');
      
      try {
        const response = await api.get('/habits');
        setHabits(response.data);
      } catch (error) {
        sentryUtils.captureException(error);
      } finally {
        span?.finish();
      }
    };
    
    fetchHabits();
  }, [startSpan]);
  
  return <div>...</div>;
};
```

### Custom Performance Metrics

```typescript
// Measure custom operations
const measureOperation = async (operationName: string, operation: () => Promise<any>) => {
  const transaction = sentryUtils.startTransaction(operationName, 'custom');
  const startTime = Date.now();
  
  try {
    const result = await operation();
    
    // Add custom measurements
    transaction.setMeasurement('operation_duration', Date.now() - startTime, 'millisecond');
    transaction.setMeasurement('memory_usage', process.memoryUsage().heapUsed, 'byte');
    
    return result;
  } catch (error) {
    transaction.setStatus('internal_error');
    throw error;
  } finally {
    transaction.finish();
  }
};

// Usage
const result = await measureOperation('complex-calculation', async () => {
  return await performComplexCalculation(data);
});
```

## Breadcrumb Usage

### Automatic Breadcrumbs

Sentry automatically captures:
- HTTP requests
- Database queries
- Console logs
- Navigation events
- User interactions

### Custom Breadcrumbs

**User Actions:**
```typescript
// Track user interactions
sentryUtils.addBreadcrumb('User clicked habit toggle', 'user', {
  habitId: habit.id,
  habitName: habit.name,
  newStatus: !habit.completed
});

// Track navigation
sentryUtils.addBreadcrumb('User navigated to analytics page', 'navigation', {
  from: '/dashboard',
  to: '/analytics',
  userId: user.id
});
```

**System Events:**
```typescript
// Track system events
sentryUtils.addBreadcrumb('Cache miss for user data', 'system', {
  userId: user.id,
  cacheKey: `user:${user.id}`,
  fallbackUsed: true
});

// Track API calls
sentryUtils.addBreadcrumb('External API call initiated', 'http', {
  url: 'https://api.external-service.com/data',
  method: 'POST',
  timeout: 5000
});
```

**Business Logic:**
```typescript
// Track business logic flow
sentryUtils.addBreadcrumb('Habit streak calculation started', 'process', {
  habitId: habit.id,
  lastCompletedDate: habit.lastCompleted,
  currentDate: new Date().toISOString()
});

sentryUtils.addBreadcrumb('KPI calculation completed', 'process', {
  userId: user.id,
  kpiType: 'productivity_score',
  calculatedValue: score,
  calculationTime: Date.now() - startTime
});
```

## Context Setting

### User Context

```typescript
// Set user context for better error tracking
sentryUtils.setUser({
  id: user.id,
  email: user.email,
  name: user.name
});

// Add additional user properties
sentryUtils.setContext('user_profile', {
  subscription: user.subscription,
  joinDate: user.createdAt,
  lastActive: user.lastActiveAt,
  preferences: user.preferences
});
```

### Request Context

```typescript
// Backend middleware for request context
app.use((req, res, next) => {
  sentryUtils.setContext('request', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    sessionId: req.sessionID
  });
  
  sentryUtils.setTag('route', req.route?.path || 'unknown');
  sentryUtils.setTag('method', req.method);
  
  next();
});
```

### Application Context

```typescript
// Set application-specific context
sentryUtils.setContext('application', {
  version: process.env.npm_package_version,
  environment: process.env.NODE_ENV,
  nodeVersion: process.version,
  platform: process.platform
});

// Feature flags context
sentryUtils.setContext('feature_flags', {
  newDashboard: user.featureFlags.newDashboard,
  advancedAnalytics: user.featureFlags.advancedAnalytics,
  teamFeatures: user.featureFlags.teamFeatures
});
```

### Database Context

```typescript
// Add database context for queries
const executeQuery = async (query: string, params: any[]) => {
  sentryUtils.setContext('database', {
    query: query.substring(0, 100), // Truncate for privacy
    paramCount: params.length,
    connectionPool: prisma._engine.connectionString
  });
  
  try {
    return await prisma.$queryRaw(query, ...params);
  } catch (error) {
    sentryUtils.captureException(error);
    throw error;
  }
};
```

## Custom Error Boundaries

### React Error Boundary

```typescript
import { withSentryErrorBoundary } from '../lib/sentry';

const HabitsPage = () => {
  // Component logic
  return <div>...</div>;
};

// Wrap with error boundary
export default withSentryErrorBoundary(HabitsPage, {
  fallback: ({ error, resetError }) => (
    <div className="error-boundary">
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <button onClick={resetError}>Try again</button>
    </div>
  ),
  beforeCapture: (scope, error, errorInfo) => {
    scope.setTag('errorBoundary', 'HabitsPage');
    scope.setContext('errorInfo', errorInfo);
  }
});
```

### Higher-Order Component

```typescript
const withErrorHandling = <P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) => {
  return withSentryErrorBoundary(Component, {
    fallback: ({ error, resetError }) => (
      <ErrorFallback 
        error={error} 
        resetError={resetError} 
        componentName={componentName} 
      />
    ),
    beforeCapture: (scope, error, errorInfo) => {
      scope.setTag('component', componentName);
      scope.setContext('componentProps', errorInfo.componentStack);
    }
  });
};

// Usage
export default withErrorHandling(MyComponent, 'MyComponent');
```

### Global Error Handler

```typescript
// Frontend global error handler
window.addEventListener('error', (event) => {
  sentryUtils.captureException(event.error, {
    type: 'global_error',
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

window.addEventListener('unhandledrejection', (event) => {
  sentryUtils.captureException(event.reason, {
    type: 'unhandled_promise_rejection',
    promise: event.promise
  });
});
```

## Best Practices

### 1. Error Filtering

```typescript
// Filter sensitive information
beforeSend(event, hint) {
  // Remove sensitive headers
  if (event.request?.headers) {
    delete event.request.headers.authorization;
    delete event.request.headers.cookie;
    delete event.request.headers['x-api-key'];
  }
  
  // Filter out health check errors
  if (event.request?.url?.includes('/health')) {
    return null;
  }
  
  // Filter development errors
  if (event.environment === 'development' && event.level === 'info') {
    return null;
  }
  
  return event;
}
```

### 2. Rate Limiting

```typescript
// Implement client-side rate limiting
let errorCount = 0;
let lastErrorTime = 0;

const rateLimitedCapture = (error: Error, context?: any) => {
  const now = Date.now();
  
  // Reset counter every minute
  if (now - lastErrorTime > 60000) {
    errorCount = 0;
  }
  
  // Limit to 10 errors per minute
  if (errorCount < 10) {
    sentryUtils.captureException(error, context);
    errorCount++;
    lastErrorTime = now;
  }
};
```

### 3. Structured Logging

```typescript
// Create structured log entries
const logStructured = (level: string, message: string, data: any) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data
  };
  
  console.log(JSON.stringify(logEntry));
  
  if (level === 'error') {
    sentryUtils.captureMessage(message, 'error', data);
  }
};

// Usage
logStructured('error', 'Database connection failed', {
  database: 'postgresql',
  host: 'localhost',
  retryAttempt: 3
});
```

### 4. Performance Budgets

```typescript
// Monitor performance budgets
const monitorPerformance = (operationName: string, duration: number) => {
  const budgets = {
    'api_request': 1000, // 1 second
    'database_query': 500, // 500ms
    'page_load': 3000 // 3 seconds
  };
  
  const budget = budgets[operationName];
  if (budget && duration > budget) {
    sentryUtils.captureMessage(`Performance budget exceeded: ${operationName}`, 'warning', {
      operation: operationName,
      duration,
      budget,
      overage: duration - budget
    });
  }
};
```

## Troubleshooting

### Common Issues

**1. Sentry Not Initializing:**
```typescript
// Check DSN configuration
if (!process.env.SENTRY_DSN) {
  console.error('SENTRY_DSN environment variable not set');
  return;
}

// Verify DSN format
const dsnRegex = /^https:\/\/[a-f0-9]+@[a-z0-9.-]+\/[0-9]+$/;
if (!dsnRegex.test(process.env.SENTRY_DSN)) {
  console.error('Invalid SENTRY_DSN format');
  return;
}
```

**2. Missing Context:**
```typescript
// Ensure context is set before error occurs
const processWithContext = async (data: any) => {
  // Set context first
  sentryUtils.setContext('operation_data', {
    dataSize: JSON.stringify(data).length,
    dataType: typeof data,
    timestamp: Date.now()
  });
  
  try {
    return await processData(data);
  } catch (error) {
    // Context will be included automatically
    sentryUtils.captureException(error);
    throw error;
  }
};
```

**3. Performance Impact:**
```typescript
// Monitor Sentry overhead
const sentryMetrics = {
  errorsSent: 0,
  transactionsCreated: 0,
  overhead: 0
};

const originalCaptureException = sentryUtils.captureException;
sentryUtils.captureException = (error: Error, context?: any) => {
  const start = Date.now();
  originalCaptureException(error, context);
  sentryMetrics.overhead += Date.now() - start;
  sentryMetrics.errorsSent++;
};
```

### Debug Mode

```typescript
// Enable debug mode for troubleshooting
Sentry.init({
  // ... other config
  debug: process.env.NODE_ENV === 'development',
  beforeSend(event, hint) {
    if (process.env.NODE_ENV === 'development') {
      console.log('Sentry Event:', event);
      console.log('Sentry Hint:', hint);
    }
    return event;
  }
});
```

### Health Checks

```typescript
// Verify Sentry connectivity
const testSentryConnection = async () => {
  try {
    const eventId = sentryUtils.captureMessage('Sentry health check', 'info');
    console.log('Sentry health check sent:', eventId);
    return true;
  } catch (error) {
    console.error('Sentry health check failed:', error);
    return false;
  }
};

// Run on application startup
testSentryConnection();
```

## Integration Examples

### Express.js Middleware

```typescript
import { initializeSentry, setupSentryErrorHandler, sentryUtils } from './middleware/sentry';

const app = express();

// Initialize Sentry first
initializeSentry(app);

// Your routes and middleware
app.use('/api', apiRoutes);

// Error handler must be last
setupSentryErrorHandler(app);
```

### React Application

```typescript
import { initializeSentry } from './lib/sentry';
import { SentryErrorBoundary } from './lib/sentry';

// Initialize in main.tsx
initializeSentry();

// Wrap your app
ReactDOM.render(
  <SentryErrorBoundary>
    <App />
  </SentryErrorBoundary>,
  document.getElementById('root')
);
```

This comprehensive guide covers all aspects of Sentry integration in the KPI Productivity application, providing developers with the knowledge needed to effectively implement error tracking, performance monitoring, and debugging capabilities.