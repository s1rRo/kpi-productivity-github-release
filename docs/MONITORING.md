# Monitoring and Analytics Setup - KPI Productivity 2026

## Overview

This document covers the complete monitoring and analytics setup for the KPI Productivity 2026 application, including error tracking with Sentry and usage analytics with Mixpanel.

## Error Monitoring with Sentry

### Backend Setup

The backend uses `@sentry/node` for comprehensive error tracking and performance monitoring.

#### Features Enabled:
- **Error Tracking**: Automatic capture of unhandled exceptions
- **Performance Monitoring**: API endpoint performance tracking
- **Profiling**: CPU and memory profiling in production
- **Request Tracing**: Full request lifecycle tracking
- **Custom Context**: User and request context for better debugging

#### Configuration:
```typescript
// backend/src/middleware/sentry.ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({ app }),
    nodeProfilingIntegration(),
  ],
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
});
```

#### Custom Error Reporting:
```typescript
import { sentryUtils } from '../middleware/sentry';

// Capture exceptions with context
sentryUtils.captureException(error, {
  userId: user.id,
  operation: 'kpi_calculation',
  additionalData: { date, habits }
});

// Capture messages
sentryUtils.captureMessage('KPI calculation completed', 'info', {
  kpi: result.kpi,
  userId: user.id
});
```

### Frontend Setup

The frontend uses `@sentry/react` for client-side error tracking and performance monitoring.

#### Features Enabled:
- **Error Boundaries**: React error boundary integration
- **Performance Monitoring**: Page load and navigation tracking
- **Session Replay**: User session recording for debugging
- **User Feedback**: Built-in user feedback collection
- **Custom Context**: User and application state context

#### Configuration:
```typescript
// frontend/src/lib/sentry.ts
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT,
  integrations: [
    new BrowserTracing({
      routingInstrumentation: Sentry.reactRouterV6Instrumentation(...)
    }),
  ],
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

#### Error Boundary Usage:
```typescript
import { withSentryErrorBoundary } from '../lib/sentry';

export default withSentryErrorBoundary(MyComponent, {
  fallback: CustomErrorFallback,
  beforeCapture: (scope, error, errorInfo) => {
    scope.setTag("errorBoundary", true);
    scope.setContext("errorInfo", errorInfo);
  },
});
```

## Usage Analytics with Mixpanel

### Frontend Analytics Setup

The frontend uses `mixpanel-browser` for comprehensive usage analytics and user behavior tracking.

#### Features Enabled:
- **Event Tracking**: User actions and feature usage
- **User Identification**: User journey tracking
- **Funnel Analysis**: Conversion tracking
- **Cohort Analysis**: User retention metrics
- **A/B Testing**: Feature flag support
- **GDPR Compliance**: EU data handling compliance

#### Configuration:
```typescript
// frontend/src/lib/analytics.ts
mixpanel.init(import.meta.env.VITE_MIXPANEL_TOKEN, {
  debug: import.meta.env.DEV,
  track_pageview: true,
  persistence: 'localStorage',
  api_host: 'https://api-eu.mixpanel.com', // EU endpoint for GDPR
  opt_out_tracking_by_default: false,
  ignore_dnt: false,
  secure_cookie: true,
});
```

### Tracked Events

#### User Lifecycle Events:
- **User Registered**: New user sign-up
- **User Logged In**: Authentication events
- **User Logged Out**: Session end events

#### Core Feature Usage:
- **Daily Record Created**: Habit tracking completion
- **KPI Calculated**: Performance metric calculations
- **Habit Completed**: Individual habit completion
- **Task Completed**: Task management usage

#### Analytics and Insights:
- **Analytics Page Viewed**: Report viewing behavior
- **Monthly Report Generated**: Report generation usage
- **Data Exported**: Data export feature usage

#### Skills and Testing:
- **Skill Test Completed**: Skill assessment usage
- **Skill Level Updated**: Progress tracking

#### Exception Handling:
- **Exception Added**: Exception tracking usage

### Event Implementation Examples:

```typescript
// Track user registration
analytics.track('User Registered', {
  method: 'email',
  timestamp: new Date().toISOString(),
});

// Track KPI calculation
analytics.track('KPI Calculated', {
  kpi: 125.5,
  date: '2026-01-07',
  baseScore: 95.0,
  efficiencyCoefficients: 15.0,
  priorityBonus: 10.0,
  revolutScore: 5.5,
});

// Track feature usage
analytics.track('Feature Used', {
  feature: 'eisenhower_matrix',
  timestamp: new Date().toISOString(),
});
```

### User Properties Tracking:

```typescript
// Set user properties
analytics.setUserProperties({
  totalHabits: 10,
  averageKPI: 118.5,
  streakDays: 15,
  totalDaysTracked: 365,
  favoriteFeature: 'analytics',
  lastActiveDate: new Date().toISOString(),
});

// Increment counters
analytics.incrementUserProperty('daily_records_created');
analytics.incrementUserProperty('kpi_calculations', 1);
```

## Performance Monitoring

### Backend Performance Tracking

#### API Endpoint Monitoring:
```typescript
// Automatic performance tracking for all routes
app.use(Sentry.Handlers.tracingHandler());

// Custom performance tracking
const transaction = sentryUtils.startTransaction('kpi_calculation', 'operation');
const span = transaction.startChild({ op: 'db', description: 'fetch_habits' });

try {
  const habits = await prisma.habit.findMany();
  span.setStatus('ok');
} catch (error) {
  span.setStatus('internal_error');
  throw error;
} finally {
  span.finish();
  transaction.finish();
}
```

#### Database Query Monitoring:
```typescript
// Prisma middleware for query performance
prisma.$use(async (params, next) => {
  const before = Date.now();
  const result = await next(params);
  const after = Date.now();
  
  const duration = after - before;
  
  if (duration > 1000) { // Log slow queries
    sentryUtils.captureMessage(`Slow query detected: ${params.model}.${params.action}`, 'warning', {
      duration,
      model: params.model,
      action: params.action,
    });
  }
  
  return result;
});
```

### Frontend Performance Tracking

#### Page Load Monitoring:
```typescript
// Automatic page load tracking
export const usePerformanceTracking = (pageName: string) => {
  const startTime = React.useRef<number>(Date.now());

  React.useEffect(() => {
    startTime.current = Date.now();

    return () => {
      const duration = Date.now() - startTime.current;
      if (duration > 3000) { // Track slow loads > 3 seconds
        analytics.trackPerformance('slow_load', duration, pageName);
      }
    };
  }, [pageName]);
};
```

#### API Response Time Tracking:
```typescript
// API client with performance tracking
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

apiClient.interceptors.request.use((config) => {
  config.metadata = { startTime: Date.now() };
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const duration = Date.now() - response.config.metadata.startTime;
    
    if (duration > 2000) { // Track slow API calls
      analytics.trackPerformance('api_error', duration, response.config.url);
    }
    
    return response;
  },
  (error) => {
    const duration = Date.now() - error.config.metadata.startTime;
    analytics.trackPerformance('api_error', duration, error.config.url);
    return Promise.reject(error);
  }
);
```

## Alert Configuration

### Sentry Alerts

#### Error Rate Alerts:
- **Threshold**: > 5% error rate in 5 minutes
- **Notification**: Email + Slack
- **Escalation**: Page on-call after 15 minutes

#### Performance Alerts:
- **API Response Time**: > 2 seconds average
- **Database Query Time**: > 1 second average
- **Memory Usage**: > 80% for 10 minutes

#### Custom Alerts:
```typescript
// Custom alert for KPI calculation failures
if (kpiCalculationFailed) {
  sentryUtils.captureMessage('KPI calculation failed', 'error', {
    userId: user.id,
    date: date,
    errorType: 'calculation_failure',
    severity: 'high',
  });
}
```

### Mixpanel Insights and Alerts

#### Usage Alerts:
- **Daily Active Users**: Drop > 20% day-over-day
- **Feature Adoption**: New feature usage < 10% after 1 week
- **Conversion Rate**: Registration to first KPI calculation < 70%

#### Performance Insights:
- **Page Load Times**: Track 95th percentile load times
- **Feature Usage Patterns**: Identify most/least used features
- **User Journey Analysis**: Track drop-off points in user flow

## Dashboard Setup

### Sentry Dashboard

#### Key Metrics:
- **Error Rate**: Percentage of requests resulting in errors
- **Response Time**: P95 response time for API endpoints
- **Throughput**: Requests per minute
- **Apdex Score**: Application performance index

#### Custom Dashboards:
- **KPI Calculation Performance**: Track calculation times and errors
- **User Authentication**: Monitor login/registration success rates
- **Database Performance**: Query performance and connection health

### Mixpanel Dashboard

#### User Engagement:
- **Daily/Weekly/Monthly Active Users**
- **Session Duration and Frequency**
- **Feature Adoption Rates**
- **User Retention Cohorts**

#### Product Analytics:
- **KPI Calculation Frequency**: How often users calculate KPIs
- **Habit Completion Rates**: Which habits are most/least completed
- **Export Usage**: Data export feature adoption
- **Mobile vs Desktop Usage**: Platform preferences

#### Business Metrics:
- **User Growth Rate**: New user acquisition trends
- **Feature Usage Trends**: Popular features over time
- **User Journey Funnels**: Registration to active usage

## Privacy and Compliance

### GDPR Compliance

#### Data Collection:
- **Explicit Consent**: Users must opt-in to analytics
- **Data Minimization**: Only collect necessary data
- **Right to Deletion**: Users can request data deletion
- **Data Portability**: Users can export their data

#### Implementation:
```typescript
// Privacy controls
export const PrivacyControls = () => {
  const { optOut, optIn } = useAnalytics();
  
  return (
    <div>
      <button onClick={optOut}>Opt out of analytics</button>
      <button onClick={optIn}>Opt in to analytics</button>
    </div>
  );
};
```

### Data Retention

#### Sentry:
- **Error Data**: 90 days retention
- **Performance Data**: 30 days retention
- **User Data**: Anonymized after 1 year

#### Mixpanel:
- **Event Data**: 5 years retention (configurable)
- **User Profiles**: Until user deletion request
- **Anonymization**: Automatic after 2 years of inactivity

## Troubleshooting

### Common Issues

#### Sentry Not Capturing Errors:
1. Check DSN configuration
2. Verify environment variables
3. Check network connectivity
4. Review beforeSend filters

#### Mixpanel Events Not Tracking:
1. Verify token configuration
2. Check browser console for errors
3. Verify opt-out status
4. Check network requests in dev tools

#### Performance Issues:
1. Review sampling rates (too high can impact performance)
2. Check for memory leaks in error handlers
3. Monitor bundle size impact
4. Review custom instrumentation overhead

### Debug Mode

#### Enable Debug Logging:
```bash
# Backend
SENTRY_DEBUG=true

# Frontend
VITE_DEBUG_MODE=true
```

#### Test Error Reporting:
```typescript
// Test Sentry integration
throw new Error('Test error for Sentry');

// Test Mixpanel integration
analytics.track('Test Event', { test: true });
```

## Maintenance

### Regular Tasks

#### Weekly:
- Review error trends and patterns
- Check performance degradation
- Update alert thresholds based on usage
- Review user feedback from Sentry

#### Monthly:
- Analyze user behavior patterns
- Update tracking events based on new features
- Review and clean up old alerts
- Performance optimization based on metrics

#### Quarterly:
- Full monitoring stack review
- Update retention policies
- Security audit of tracking data
- Cost optimization review

### Scaling Considerations

#### High Traffic Handling:
- Adjust sampling rates for performance monitoring
- Implement client-side rate limiting
- Use Sentry's quota management
- Consider Mixpanel's data pipeline limits

#### Cost Management:
- Monitor Sentry event quotas
- Optimize Mixpanel event volume
- Use appropriate retention periods
- Regular cleanup of unused alerts and dashboards

---

This monitoring setup provides comprehensive visibility into application health, user behavior, and performance metrics, enabling data-driven decisions and proactive issue resolution.