import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { Request, Response } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';

// Backend API proxy configuration
export const backendProxy = createProxyMiddleware({
  target: config.services.backend,
  changeOrigin: true,
  secure: false,
  timeout: 30000,
  proxyTimeout: 30000,
  pathRewrite: {
    '^/api': '', // Remove /api prefix when forwarding to backend
  },
  onError: (err: Error, req: Request, res: Response) => {
    logger.error('Backend proxy error', {
      error: err.message,
      path: req.path,
      method: req.method,
      target: config.services.backend,
    });
    
    res.status(502).json({
      error: 'Backend service unavailable',
      message: 'The backend service is currently unavailable. Please try again later.',
    });
  },
  onProxyReq: (proxyReq, req) => {
    logger.debug('Proxying request to backend', {
      method: req.method,
      path: req.path,
      target: config.services.backend,
    });
  },
  onProxyRes: (proxyRes, req) => {
    logger.debug('Backend response received', {
      statusCode: proxyRes.statusCode,
      path: req.path,
      method: req.method,
    });
  },
} as Options);

// Frontend proxy configuration
export const frontendProxy = createProxyMiddleware({
  target: config.services.frontend,
  changeOrigin: true,
  secure: false,
  timeout: 30000,
  proxyTimeout: 30000,
  ws: true, // Enable WebSocket proxying for hot reload
  onError: (err: Error, req: Request, res: Response) => {
    logger.error('Frontend proxy error', {
      error: err.message,
      path: req.path,
      method: req.method,
      target: config.services.frontend,
    });
    
    res.status(502).json({
      error: 'Frontend service unavailable',
      message: 'The frontend service is currently unavailable. Please try again later.',
    });
  },
  onProxyReq: (proxyReq, req) => {
    logger.debug('Proxying request to frontend', {
      method: req.method,
      path: req.path,
      target: config.services.frontend,
    });
  },
  onProxyRes: (proxyRes, req) => {
    logger.debug('Frontend response received', {
      statusCode: proxyRes.statusCode,
      path: req.path,
      method: req.method,
    });
  },
} as Options);

// Health check proxy for backend
export const healthCheckProxy = createProxyMiddleware({
  target: config.services.backend,
  changeOrigin: true,
  secure: false,
  timeout: 5000,
  pathRewrite: {
    '^/health': '/health',
  },
  onError: (err: Error, req: Request, res: Response) => {
    logger.error('Health check proxy error', {
      error: err.message,
      target: config.services.backend,
    });
    
    res.status(503).json({
      status: 'unhealthy',
      error: 'Backend health check failed',
      timestamp: new Date().toISOString(),
    });
  },
} as Options);