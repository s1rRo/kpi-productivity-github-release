import { Router, Request, Response } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';

const router = Router();

// Gateway health check endpoint
router.get('/gateway/health', async (req: Request, res: Response) => {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        gateway: {
          status: 'healthy',
          port: config.gateway.port,
          host: config.gateway.host,
        },
        backend: {
          url: config.services.backend,
          status: 'unknown', // Will be checked by proxy
        },
        frontend: {
          url: config.services.frontend,
          status: 'unknown', // Will be checked by proxy
        },
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };

    logger.info('Gateway health check requested', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json(healthStatus);
  } catch (error) {
    logger.error('Gateway health check failed', { error });
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Internal server error',
    });
  }
});

// Gateway status endpoint with more detailed information
router.get('/gateway/status', async (req: Request, res: Response) => {
  try {
    const status = {
      gateway: {
        name: 'KPI Gateway',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        port: config.gateway.port,
        host: config.gateway.host,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid,
      },
      configuration: {
        rateLimit: {
          windowMs: config.security.rateLimit.windowMs,
          maxRequests: config.security.rateLimit.max,
        },
        cors: {
          origins: config.security.cors.origin,
        },
        services: {
          backend: config.services.backend,
          frontend: config.services.frontend,
        },
      },
      timestamp: new Date().toISOString(),
    };

    res.json(status);
  } catch (error) {
    logger.error('Gateway status check failed', { error });
    res.status(500).json({
      error: 'Failed to retrieve gateway status',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;