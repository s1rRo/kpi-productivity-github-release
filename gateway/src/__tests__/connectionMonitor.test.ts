import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectionMonitor } from '../services/connectionMonitor';
import { PortManager } from '../services/portManager';

// Mock PortManager
vi.mock('../services/portManager');

describe('ConnectionMonitor', () => {
  let connectionMonitor: ConnectionMonitor;
  let mockPortManager: PortManager;

  beforeEach(() => {
    mockPortManager = new PortManager();
    vi.mocked(mockPortManager.isConnectionAllowed).mockReturnValue(true);
    vi.mocked(mockPortManager.logConnectionAttempt).mockImplementation(() => {});
    vi.mocked(mockPortManager.getConnectionLog).mockReturnValue([]);

    connectionMonitor = new ConnectionMonitor(mockPortManager);
    vi.clearAllMocks();
  });

  describe('Connection Monitoring', () => {
    it('should allow legitimate connections', () => {
      const result = connectionMonitor.monitorConnection('192.168.1.100', 30002, 'TCP');
      
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(mockPortManager.logConnectionAttempt).toHaveBeenCalledWith({
        sourceIP: '192.168.1.100',
        targetPort: 30002,
        protocol: 'TCP',
        action: 'ALLOWED',
        reason: undefined,
        userAgent: undefined,
      });
    });

    it('should block unauthorized connections', () => {
      vi.mocked(mockPortManager.isConnectionAllowed).mockReturnValue(false);
      
      const result = connectionMonitor.monitorConnection('192.168.1.100', 3001, 'TCP');
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Port 3001 not in allowed list');
      expect(mockPortManager.logConnectionAttempt).toHaveBeenCalledWith({
        sourceIP: '192.168.1.100',
        targetPort: 3001,
        protocol: 'TCP',
        action: 'BLOCKED',
        reason: 'Port 3001 not in allowed list',
        userAgent: undefined,
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should allow connections within rate limit', () => {
      // Make multiple requests within limit
      for (let i = 0; i < 10; i++) {
        const result = connectionMonitor.monitorConnection('192.168.1.100', 30002, 'TCP');
        expect(result.allowed).toBe(true);
      }
    });

    it('should block connections exceeding rate limit', () => {
      // Make many requests to exceed rate limit
      let blocked = false;
      for (let i = 0; i < 70; i++) {
        const result = connectionMonitor.monitorConnection('192.168.1.100', 30002, 'TCP');
        if (!result.allowed) {
          blocked = true;
          expect(result.reason).toContain('Rate limit exceeded');
          break;
        }
      }
      expect(blocked).toBe(true);
    });
  });

  describe('Suspicious Activity Detection', () => {
    it('should detect suspicious user agents', () => {
      const result = connectionMonitor.monitorConnection(
        '192.168.1.100',
        30002,
        'TCP',
        'nmap/7.80'
      );
      
      expect(result.allowed).toBe(true); // Connection allowed but alert created
      
      const alerts = connectionMonitor.getAlerts();
      expect(alerts.some(alert => 
        alert.type === 'SUSPICIOUS_ACTIVITY' && 
        alert.sourceIP === '192.168.1.100'
      )).toBe(true);
    });

    it('should detect port scanning attempts', () => {
      // Mock connection log to simulate port scanning
      const mockConnections = [
        { sourceIP: '192.168.1.100', targetPort: 80, timestamp: new Date() },
        { sourceIP: '192.168.1.100', targetPort: 443, timestamp: new Date() },
        { sourceIP: '192.168.1.100', targetPort: 22, timestamp: new Date() },
        { sourceIP: '192.168.1.100', targetPort: 21, timestamp: new Date() },
        { sourceIP: '192.168.1.100', targetPort: 25, timestamp: new Date() },
        { sourceIP: '192.168.1.100', targetPort: 53, timestamp: new Date() },
      ];
      
      vi.mocked(mockPortManager.getConnectionLog).mockReturnValue(mockConnections as any);
      
      connectionMonitor.monitorConnection('192.168.1.100', 30002, 'TCP');
      
      const alerts = connectionMonitor.getAlerts();
      expect(alerts.some(alert => 
        alert.type === 'PORT_SCAN_DETECTED' && 
        alert.sourceIP === '192.168.1.100'
      )).toBe(true);
    });
  });

  describe('Alert Management', () => {
    it('should create and retrieve alerts', () => {
      // Trigger an alert by using suspicious user agent
      connectionMonitor.monitorConnection('192.168.1.100', 30002, 'TCP', 'sqlmap/1.0');
      
      const alerts = connectionMonitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      
      const suspiciousAlert = alerts.find(alert => 
        alert.type === 'SUSPICIOUS_ACTIVITY'
      );
      expect(suspiciousAlert).toBeDefined();
      expect(suspiciousAlert?.sourceIP).toBe('192.168.1.100');
    });

    it('should filter alerts by severity', () => {
      // Create alerts of different severities
      connectionMonitor.monitorConnection('192.168.1.100', 30002, 'TCP', 'nmap/7.80');
      
      const mediumAlerts = connectionMonitor.getAlertsBySeverity('MEDIUM');
      expect(mediumAlerts.length).toBeGreaterThan(0);
      
      const highAlerts = connectionMonitor.getAlertsBySeverity('HIGH');
      expect(highAlerts.length).toBe(0); // No high severity alerts created yet
    });
  });

  describe('Monitoring Statistics', () => {
    it('should provide monitoring statistics', () => {
      // Create some activity
      connectionMonitor.monitorConnection('192.168.1.100', 30002, 'TCP', 'nmap/7.80');
      
      const stats = connectionMonitor.getMonitoringStats();
      
      expect(stats).toHaveProperty('totalAlerts');
      expect(stats).toHaveProperty('alertsBySeverity');
      expect(stats).toHaveProperty('suspiciousIPs');
      expect(stats).toHaveProperty('activeRateLimits');
      expect(stats).toHaveProperty('topAlertTypes');
      
      expect(stats.totalAlerts).toBeGreaterThan(0);
      expect(stats.suspiciousIPs).toBeGreaterThan(0);
    });
  });
});