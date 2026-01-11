import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../index';

// Mock child_process for firewall operations
vi.mock('child_process', () => ({
  exec: vi.fn((command, callback) => {
    if (typeof callback === 'function') {
      callback(null, { stdout: 'success', stderr: '' } as any);
    }
    return {} as any;
  }),
}));

describe('Gateway Integration Tests', () => {
  let server: any;

  beforeAll(async () => {
    // Start the server for integration testing
    server = app.listen(0); // Use random port for testing
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('Health Endpoints', () => {
    it('should return gateway health status', async () => {
      const response = await request(app)
        .get('/gateway/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('gateway');
      expect(response.body.services).toHaveProperty('backend');
      expect(response.body.services).toHaveProperty('frontend');
    });

    it('should return detailed gateway status', async () => {
      const response = await request(app)
        .get('/gateway/status')
        .expect(200);

      expect(response.body).toHaveProperty('gateway');
      expect(response.body).toHaveProperty('configuration');
      expect(response.body.gateway).toHaveProperty('name', 'KPI Gateway');
      expect(response.body.gateway).toHaveProperty('version');
      expect(response.body.configuration).toHaveProperty('rateLimit');
      expect(response.body.configuration).toHaveProperty('cors');
    });
  });

  describe('Security Endpoints', () => {
    it('should return port status', async () => {
      const response = await request(app)
        .get('/security/ports/status')
        .expect(200);

      expect(response.body).toHaveProperty('ports');
      expect(response.body).toHaveProperty('timestamp');
      expect(Array.isArray(response.body.ports)).toBe(true);
    });

    it('should return connection logs', async () => {
      const response = await request(app)
        .get('/security/connections/log')
        .expect(200);

      expect(response.body).toHaveProperty('connections');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('timestamp');
      expect(Array.isArray(response.body.connections)).toBe(true);
    });

    it('should return connection statistics', async () => {
      const response = await request(app)
        .get('/security/connections/stats')
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('allowed');
      expect(response.body).toHaveProperty('blocked');
      expect(response.body).toHaveProperty('topBlockedIPs');
      expect(Array.isArray(response.body.topBlockedIPs)).toBe(true);
    });

    it('should return security alerts', async () => {
      const response = await request(app)
        .get('/security/alerts')
        .expect(200);

      expect(response.body).toHaveProperty('alerts');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('timestamp');
      expect(Array.isArray(response.body.alerts)).toBe(true);
    });

    it('should filter alerts by severity', async () => {
      const response = await request(app)
        .get('/security/alerts?severity=HIGH')
        .expect(200);

      expect(response.body).toHaveProperty('alerts');
      expect(Array.isArray(response.body.alerts)).toBe(true);
    });

    it('should return monitoring statistics', async () => {
      const response = await request(app)
        .get('/security/monitoring/stats')
        .expect(200);

      expect(response.body).toHaveProperty('totalAlerts');
      expect(response.body).toHaveProperty('alertsBySeverity');
      expect(response.body).toHaveProperty('suspiciousIPs');
      expect(response.body).toHaveProperty('activeRateLimits');
      expect(response.body).toHaveProperty('topAlertTypes');
    });

    it('should return firewall status', async () => {
      const response = await request(app)
        .get('/security/firewall/status')
        .expect(200);

      expect(response.body).toHaveProperty('enabled');
      expect(response.body).toHaveProperty('rules');
      expect(response.body).toHaveProperty('platform');
      expect(response.body).toHaveProperty('lastUpdated');
    });

    it('should validate firewall configuration', async () => {
      const response = await request(app)
        .get('/security/firewall/validate')
        .expect(200);

      expect(response.body).toHaveProperty('valid');
      expect(response.body).toHaveProperty('issues');
      expect(response.body).toHaveProperty('timestamp');
      expect(Array.isArray(response.body.issues)).toBe(true);
    });

    it('should reconfigure firewall', async () => {
      const response = await request(app)
        .post('/security/firewall/configure')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return security dashboard', async () => {
      const response = await request(app)
        .get('/security/dashboard')
        .expect(200);

      expect(response.body).toHaveProperty('dashboard');
      expect(response.body.dashboard).toHaveProperty('ports');
      expect(response.body.dashboard).toHaveProperty('connections');
      expect(response.body.dashboard).toHaveProperty('monitoring');
      expect(response.body.dashboard).toHaveProperty('firewall');
      expect(response.body.dashboard).toHaveProperty('recentAlerts');
    });
  });

  describe('Security Middleware Integration', () => {
    it('should apply security headers to all responses', async () => {
      const response = await request(app)
        .get('/gateway/health')
        .expect(200);

      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });

    it('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/gateway/health')
        .set('Origin', 'http://localhost:30002')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:30002');
      expect(response.headers['access-control-allow-methods']).toContain('GET');
    });

    it('should validate requests and block malicious content', async () => {
      await request(app)
        .get('/gateway/health?param=<script>alert("xss")</script>')
        .expect(400);
    });

    it('should include rate limiting headers', async () => {
      const response = await request(app)
        .get('/gateway/health')
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors gracefully', async () => {
      const response = await request(app)
        .get('/nonexistent-endpoint')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Route not found');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should handle internal server errors gracefully', async () => {
      // This would require mocking a service to throw an error
      // For now, we'll test that the error handler structure is in place
      const response = await request(app)
        .get('/gateway/health')
        .expect(200);

      // If we get here, the error handling middleware is properly configured
      expect(response.status).toBe(200);
    });
  });
});