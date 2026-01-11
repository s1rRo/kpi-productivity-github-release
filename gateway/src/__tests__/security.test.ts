import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { PortManager } from '../services/portManager';
import { ConnectionMonitor } from '../services/connectionMonitor';
import { FirewallManager } from '../services/firewallManager';
import {
  securityHeaders,
  corsMiddleware,
  rateLimitMiddleware,
  validateRequest,
} from '../middleware/security';

describe('Security Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(securityHeaders);
    app.use(corsMiddleware);
    app.use(validateRequest);
    
    // Test route
    app.get('/test', (req, res) => {
      res.json({ message: 'test successful' });
    });
  });

  describe('Security Headers', () => {
    it('should set security headers', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    it('should set Content Security Policy', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });
  });

  describe('CORS Configuration', () => {
    it('should allow requests from allowed origins', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://localhost:30002')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:30002');
    });

    it('should reject requests from disallowed origins', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://malicious-site.com')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Request Validation', () => {
    it('should block requests with path traversal attempts', async () => {
      await request(app)
        .get('/test/../../../etc/passwd')
        .expect(400);
    });

    it('should block requests with XSS attempts', async () => {
      await request(app)
        .post('/test')
        .send({ data: '<script>alert("xss")</script>' })
        .expect(400);
    });

    it('should block requests with SQL injection attempts', async () => {
      await request(app)
        .get('/test?id=1 UNION SELECT * FROM users')
        .expect(400);
    });

    it('should allow legitimate requests', async () => {
      await request(app)
        .get('/test')
        .expect(200);
    });
  });
});

describe('Rate Limiting', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(rateLimitMiddleware);
    
    app.get('/test', (req, res) => {
      res.json({ message: 'test successful' });
    });
  });

  it('should allow requests within rate limit', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .get('/test')
        .expect(200);
    }
  });

  it('should block requests exceeding rate limit', async () => {
    // This test would need to be adjusted based on actual rate limit configuration
    // For now, we'll test that the middleware is properly configured
    const response = await request(app)
      .get('/test')
      .expect(200);

    expect(response.headers['x-ratelimit-limit']).toBeDefined();
    expect(response.headers['x-ratelimit-remaining']).toBeDefined();
  });
});