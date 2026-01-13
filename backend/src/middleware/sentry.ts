import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { Express } from "express";

export function initializeSentry(app: Express) {
  if (!process.env.SENTRY_DSN) {
    console.warn("SENTRY_DSN not configured, skipping Sentry initialization");
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    integrations: [
      // Enable profiling
      nodeProfilingIntegration(),
      // Note: httpIntegration and expressIntegration are now automatic in v10+
    ],
    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Profiling
    profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Release tracking
    release: process.env.npm_package_version || "1.0.0",
    // Additional configuration
    beforeSend(event, hint) {
      // Filter out sensitive information
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }

      // Don't send health check errors
      if (event.request?.url?.includes('/health')) {
        return null;
      }

      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      // Filter sensitive breadcrumbs
      if (breadcrumb.category === 'http' && breadcrumb.data?.url?.includes('auth')) {
        delete breadcrumb.data.data;
      }
      return breadcrumb;
    },
  });

  // Note: In Sentry v10+, request handling and tracing are automatic
  // No need for app.use(Sentry.Handlers.requestHandler()) or app.use(Sentry.Handlers.tracingHandler())
}

export function setupSentryErrorHandler(app: Express) {
  // The error handler must be registered before any other error middleware and after all controllers
  // In v10+, use setupExpressErrorHandler instead of Handlers.errorHandler
  Sentry.setupExpressErrorHandler(app);
}

// Custom error reporting functions
export const sentryUtils = {
  // Capture exceptions with additional context
  captureException: (error: Error, context?: any) => {
    Sentry.withScope((scope) => {
      if (context) {
        scope.setContext("additional_info", context);
      }
      Sentry.captureException(error);
    });
  },

  // Capture messages with different levels
  captureMessage: (message: string, level: Sentry.SeverityLevel = "info", context?: any) => {
    Sentry.withScope((scope) => {
      if (context) {
        scope.setContext("additional_info", context);
      }
      scope.setLevel(level);
      Sentry.captureMessage(message);
    });
  },

  // Set user context for better error tracking
  setUser: (user: { id: string; email?: string; name?: string }) => {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.name,
    });
  },

  // Add breadcrumbs for debugging
  addBreadcrumb: (message: string, category: string, data?: any) => {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: "info",
      timestamp: Date.now() / 1000,
    });
  },

  // Performance monitoring (v10+ uses startSpan instead of startTransaction)
  startSpan: (name: string, op: string, callback: () => any) => {
    return Sentry.startSpan({ name, op }, callback);
  },

  // Custom tags for filtering
  setTag: (key: string, value: string) => {
    Sentry.setTag(key, value);
  },

  // Set context for additional debugging info
  setContext: (key: string, context: any) => {
    Sentry.setContext(key, context);
  },
};

export default Sentry;