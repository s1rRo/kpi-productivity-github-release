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
      // Enable HTTP calls tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // Enable Express.js middleware tracing
      new Sentry.Integrations.Express({ app }),
      // Enable profiling
      nodeProfilingIntegration(),
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

  // RequestHandler creates a separate execution context, so that all
  // transactions/spans/breadcrumbs are isolated across requests
  app.use(Sentry.Handlers.requestHandler());
  
  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler());
}

export function setupSentryErrorHandler(app: Express) {
  // The error handler must be registered before any other error middleware and after all controllers
  app.use(Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Capture all 4xx and 5xx errors
      return error.status >= 400;
    },
  }));
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

  // Performance monitoring
  startTransaction: (name: string, op: string) => {
    return Sentry.startTransaction({ name, op });
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