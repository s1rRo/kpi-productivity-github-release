import express from 'express';
import { config } from './config';
import { logger } from './utils/logger';
import {
  securityHeaders,
  corsMiddleware,
  rateLimitMiddleware,
  requestLogger,
  validateRequest,
} from './middleware/security';
import {
  backendProxy,
  frontendProxy,
  healthCheckProxy,
} from './middleware/proxy';
import healthRoutes from './routes/health';
import securityRoutes, { initializeSecurityRoutes } from './routes/security';
import { PortManager } from './services/portManager';
import { ConnectionMonitor } from './services/connectionMonitor';
import { FirewallManager } from './services/firewallManager';
import { AccessLogger } from './services/accessLogger';
import { SecurityAuditor } from './services/securityAuditor';

const app = express();

// Initialize security services
const portManager = new PortManager();
const connectionMonitor = new ConnectionMonitor(portManager);
const firewallManager = new FirewallManager();
const accessLogger = new AccessLogger();
const securityAuditor = new SecurityAuditor(
  accessLogger,
  connectionMonitor,
  portManager,
  firewallManager
);

// Configure firewall on startup
firewallManager.configureSecureFirewall().catch(error => {
  logger.error('Failed to configure firewall on startup', { error });
});

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Apply security middleware stack
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(rateLimitMiddleware);
app.use(requestLogger);
app.use(validateRequest);

// Connection monitoring middleware
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const sourceIP = req.ip || req.connection.remoteAddress || 'unknown';
  const targetPort = config.gateway.port;
  const userAgent = req.get('User-Agent');
  
  const result = connectionMonitor.monitorConnection(sourceIP, targetPort, 'TCP', userAgent);
  
  if (!result.allowed) {
    logger.warn('Connection blocked by monitor', {
      sourceIP,
      targetPort,
      reason: result.reason,
      path: req.path,
    });

    // Log blocked access attempt
    accessLogger.logAccess({
      sourceIP,
      targetPort,
      protocol: 'TCP',
      method: req.method,
      path: req.path,
      userAgent,
      action: 'BLOCKED',
      reason: result.reason,
      responseCode: 403,
    });

    // Log audit event
    securityAuditor.logAuditEvent({
      type: 'ACCESS_DENIED',
      severity: 'MEDIUM',
      source: 'Gateway',
      description: `Access denied to ${req.path}`,
      details: {
        sourceIP,
        path: req.path,
        method: req.method,
        reason: result.reason,
      },
      sourceIP,
    });
    
    return res.status(403).json({
      error: 'Access denied',
      message: 'Connection not allowed',
      timestamp: new Date().toISOString(),
    });
  }

  // Log successful access attempt
  const startTime = Date.now();
  
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    
    accessLogger.logAccess({
      sourceIP,
      targetPort,
      protocol: 'TCP',
      method: req.method,
      path: req.path,
      userAgent,
      action: 'ALLOWED',
      responseCode: res.statusCode,
      responseTime,
      bytesTransferred: parseInt(res.get('Content-Length') || '0'),
    });
  });
  
  next();
});

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize security routes with service instances
initializeSecurityRoutes(portManager, connectionMonitor, firewallManager, accessLogger, securityAuditor);

// Gateway health and status routes
app.use(healthRoutes);

// Security monitoring routes
app.use('/security', securityRoutes);

// Backend API proxy - all /api/* requests go to backend
app.use('/api', backendProxy);

// Health check proxy - direct health checks to backend
app.use('/health', healthCheckProxy);

// Frontend proxy - all other requests go to frontend
app.use('/', frontendProxy);

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error in gateway', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred. Please try again later.',
    timestamp: new Date().toISOString(),
  });
});

// Handle 404 errors
app.use('*', (req: express.Request, res: express.Response) => {
  logger.warn('Route not found', {
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(404).json({
    error: 'Route not found',
    message: 'The requested resource was not found.',
    timestamp: new Date().toISOString(),
  });
});

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`);
  
  server.close(() => {
    logger.info('Gateway server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Start the server
const server = app.listen(config.gateway.port, config.gateway.host, () => {
  logger.info('KPI Gateway started', {
    port: config.gateway.port,
    host: config.gateway.host,
    environment: process.env.NODE_ENV || 'development',
    backend: config.services.backend,
    frontend: config.services.frontend,
  });

  console.log(`🚀 KPI Gateway running on http://${config.gateway.host}:${config.gateway.port}`);
  console.log(`📡 Backend proxy: ${config.services.backend}`);
  console.log(`🌐 Frontend proxy: ${config.services.frontend}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;