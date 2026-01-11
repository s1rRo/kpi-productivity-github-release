import { Router } from 'express';
import { prisma } from '../index';
import { redisUtils } from '../services/redisClient';

const router = Router();

// Basic health check
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: 'unknown',
        redis: 'unknown'
      }
    };

    // Check database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      health.services.database = 'healthy';
    } catch (error) {
      health.services.database = 'unhealthy';
      health.status = 'degraded';
    }

    // Check Redis connection
    try {
      const redisHealthy = await redisUtils.healthCheck();
      health.services.redis = redisHealthy ? 'healthy' : 'unhealthy';
      if (!redisHealthy && process.env.REDIS_REQUIRED === 'true') {
        health.status = 'degraded';
      }
    } catch (error) {
      health.services.redis = 'unhealthy';
      if (process.env.REDIS_REQUIRED === 'true') {
        health.status = 'degraded';
      }
    }

    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// Database health check
router.get('/health/database', async (req, res) => {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - start;

    res.json({
      status: 'healthy',
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: 'Database connection failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Redis health check
router.get('/health/redis', async (req, res) => {
  try {
    const start = Date.now();
    const healthy = await redisUtils.healthCheck();
    const responseTime = Date.now() - start;

    if (healthy) {
      res.json({
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'unhealthy',
        error: 'Redis connection failed',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: 'Redis health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Detailed system info (for staging/development only)
router.get('/health/detailed', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }

  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Database stats
    let dbStats = null;
    try {
      const userCount = await prisma.user.count();
      const habitCount = await prisma.habit.count();
      const dailyRecordCount = await prisma.dailyRecord.count();
      
      dbStats = {
        users: userCount,
        habits: habitCount,
        dailyRecords: dailyRecordCount
      };
    } catch (error) {
      dbStats = { error: 'Failed to fetch database stats' };
    }

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime(),
        memory: {
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        }
      },
      database: dbStats,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT,
        redisRequired: process.env.REDIS_REQUIRED
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: 'Failed to fetch detailed health info',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;