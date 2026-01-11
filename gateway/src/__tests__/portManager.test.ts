import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PortManager } from '../services/portManager';

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

describe('PortManager', () => {
  let portManager: PortManager;

  beforeEach(() => {
    portManager = new PortManager();
    vi.clearAllMocks();
  });

  describe('Connection Logging', () => {
    it('should log connection attempts', () => {
      const attempt = {
        sourceIP: '192.168.1.100',
        targetPort: 30002,
        protocol: 'TCP',
        action: 'ALLOWED' as const,
      };

      portManager.logConnectionAttempt(attempt);
      const log = portManager.getConnectionLog(1);

      expect(log).toHaveLength(1);
      expect(log[0]).toMatchObject(attempt);
      expect(log[0].id).toBeDefined();
      expect(log[0].timestamp).toBeInstanceOf(Date);
    });

    it('should limit connection log size', () => {
      // Add more than 1000 entries
      for (let i = 0; i < 1100; i++) {
        portManager.logConnectionAttempt({
          sourceIP: `192.168.1.${i % 255}`,
          targetPort: 30002,
          protocol: 'TCP',
          action: 'ALLOWED',
        });
      }

      const log = portManager.getConnectionLog();
      expect(log.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Connection Statistics', () => {
    beforeEach(() => {
      // Add some test data
      portManager.logConnectionAttempt({
        sourceIP: '192.168.1.100',
        targetPort: 30002,
        protocol: 'TCP',
        action: 'ALLOWED',
      });

      portManager.logConnectionAttempt({
        sourceIP: '192.168.1.101',
        targetPort: 3001,
        protocol: 'TCP',
        action: 'BLOCKED',
      });

      portManager.logConnectionAttempt({
        sourceIP: '192.168.1.101',
        targetPort: 3000,
        protocol: 'TCP',
        action: 'BLOCKED',
      });
    });

    it('should calculate connection statistics', () => {
      const stats = portManager.getConnectionStats();

      expect(stats.total).toBe(3);
      expect(stats.allowed).toBe(1);
      expect(stats.blocked).toBe(2);
      expect(stats.topBlockedIPs).toHaveLength(1);
      expect(stats.topBlockedIPs[0]).toEqual({
        ip: '192.168.1.101',
        count: 2,
      });
    });
  });

  describe('Connection Authorization', () => {
    it('should allow connections to port 30002', () => {
      const allowed = portManager.isConnectionAllowed('192.168.1.100', 30002);
      expect(allowed).toBe(true);
    });

    it('should block connections to other ports', () => {
      const allowed = portManager.isConnectionAllowed('192.168.1.100', 3001);
      expect(allowed).toBe(false);
    });
  });

  describe('Log Cleanup', () => {
    it('should clear old logs', () => {
      // Add an old entry
      const oldAttempt = {
        sourceIP: '192.168.1.100',
        targetPort: 30002,
        protocol: 'TCP',
        action: 'ALLOWED' as const,
      };

      portManager.logConnectionAttempt(oldAttempt);

      // Manually set timestamp to be old
      const log = portManager.getConnectionLog();
      if (log.length > 0) {
        log[0].timestamp = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      }

      portManager.clearOldLogs(24); // Clear logs older than 24 hours

      const remainingLog = portManager.getConnectionLog();
      expect(remainingLog.length).toBe(0);
    });
  });
});