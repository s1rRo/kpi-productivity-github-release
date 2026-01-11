import dotenv from 'dotenv';

dotenv.config();

export const config = {
  gateway: {
    port: parseInt(process.env.GATEWAY_PORT || '30002'),
    host: process.env.GATEWAY_HOST || 'localhost',
  },
  services: {
    backend: process.env.BACKEND_URL || 'http://localhost:3001',
    frontend: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  security: {
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    },
    cors: {
      origin: [`http://localhost:30002`],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    },
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    },
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};