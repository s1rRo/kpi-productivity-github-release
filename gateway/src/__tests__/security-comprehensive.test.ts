import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { SecurityTester } from '../scripts/securityTester';
import { SecurityValidator } from '../scripts/securityValidator';
import { SecurityMonitor } from '../scripts/securityMonitor';
import { AccessLogger } from '../services/accessLogger';
import { SecurityAuditor } from '../services/securityAuditor';
import { PortManager } from '../services/portManager';
import { ConnectionMonitor } from '../services/connectionMonitor';
import { FirewallManager } from '../services/firewallManager';

// Mock child_process for system commands
vi.mock('child_process', () => ({
  exec: vi.fn((command, callback) => {
    if (typeof callback === 'function') {
      // Mock different command responses
      if (command.includes('netstat') || command.includes('ss')) {
        callback(null, { stdout: 'tcp 0 0 127.0.0.1:30002 0.0.0.0:* LISTEN', stderr: '' } as any);
      } else if (command.includes('iptables') || command.includes('pfctl') || command.includes('netsh')) {
        callback(null, { stdout: 'success', stderr: '' } as any);
      } else if (command.includes('npm audit')) {
        callback(null, { 
          stdout: JSON.stringify({
            metadata: {
              vulnerabilities: { low: 0, moderate: 0, high: 0, critical: 0 }
            }
          }), 
          stderr: '' 
        } as any);
      } else {
        callback(null, { stdout: '', stderr: '' } as any);
      }
    }
    return {} as any;
  }),
}));

// Mock fs operations
vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(() => ''),
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  statSync: vi.fn(() => ({ size: 1000 })),
}));

describe('Comprehensive Security Testing Suite', () => {
  let securityTester: SecurityTester;
  let securityValidator: SecurityValidator;
  let securityMonitor: SecurityMonitor;
  let accessLogger: AccessLogger;
  let securityAuditor: SecurityAuditor;
  let portManager: PortManager;
  let connectionMonitor: ConnectionMonitor;
  let firewallManager: FirewallManager;

  beforeAll(() => {
    // Initialize all security components
    portManager = new PortManager();
    connectionMonitor = new ConnectionMonitor(portManager);
    firewallManager = new FirewallManager();
    accessLogger = new AccessLogger('./test-logs/access');
    securityAuditor = new SecurityAuditor(
      accessLogger,
      connectionMonitor,
      portManager,
      firewallManager,
      './test-logs/audit'
    );
    securityValidator = new SecurityValidator();
    securityMonitor = new SecurityMonitor();
    securityTester = new SecurityTester('localhost', 30002);
  });

  afterAll(() => {
    // Clean up
    if (securityMonitor) {
      securityMonitor.stop();
    }
    if (accessLogger) {
      accessLogger.destroy();
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Port Scanning Security Tests', () => {
    it('should verify only authorized port 30002 is accessible', async () => {
      // Test port manager authorization logic
      expect(portManager.isConnectionAllowed('127.0.0.1', 30002)).toBe(true);
      expect(portManager.isConnectionAllowed('127.0.0.1', 3000)).toBe(false);
      expect(portManager.isConnectionAllowed('127.0.0.1', 3001)).toBe(false);
      expect(portManager.isConnectionAllowed('127.0.0.1', 80)).toBe(false);
      expect(portManager.isConnectionAllowed('127.0.0.1', 443)).toBe(false);
    });

    it('should detect port scanning attempts', () => {
      const scannerIP = '192.168.1.100';
      const ports = [21, 22, 23, 25, 53, 80, 110, 143, 443, 993, 995];
      
      // Simulate port scanning by logging connections to multiple ports
      ports.forEach(port => {
        portManager.logConnectionAttempt({
          sourceIP: scannerIP,
          targetPort: port,
          protocol: 'TCP',
          action: 'BLOCKED',
        });
      });

      // Monitor a connection which should trigger port scan detection
      const result = connectionMonitor.monitorConnection(scannerIP, 30002, 'TCP');
      expect(result.allowed).toBe(true);

      // Check that port scanning was detected
      const alerts = connectionMonitor.getAlerts();
      const portScanAlert = alerts.find(alert => 
        alert.type === 'PORT_SCAN_DETECTED' && alert.sourceIP === scannerIP
      );
      
      expect(portScanAlert).toBeDefined();
      if (portScanAlert) {
        expect(portScanAlert.severity).toBe('HIGH');
      }
    });

    it('should log all connection attempts', () => {
      const testIP = '192.168.1.200';
      
      // Log some connection attempts
      portManager.logConnectionAttempt({
        sourceIP: testIP,
        targetPort: 30002,
        protocol: 'TCP',
        action: 'ALLOWED',
      });

      portManager.logConnectionAttempt({
        sourceIP: testIP,
        targetPort: 3001,
        protocol: 'TCP',
        action: 'BLOCKED',
      });

      const connectionLog = portManager.getConnectionLog();
      const testConnections = connectionLog.filter(conn => conn.sourceIP === testIP);
      
      expect(testConnections.length).toBeGreaterThanOrEqual(2);
      expect(testConnections.some(conn => conn.action === 'ALLOWED')).toBe(true);
      expect(testConnections.some(conn => conn.action === 'BLOCKED')).toBe(true);
    });

    it('should provide accurate connection statistics', () => {
      // Generate some test data
      const testIPs = ['192.168.1.100', '192.168.1.101', '192.168.1.102'];
      
      testIPs.forEach((ip, index) => {
        portManager.logConnectionAttempt({
          sourceIP: ip,
          targetPort: 30002,
          protocol: 'TCP',
          action: index % 2 === 0 ? 'ALLOWED' : 'BLOCKED',
        });
      });

      const stats = portManager.getConnectionStats();
      
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('allowed');
      expect(stats).toHaveProperty('blocked');
      expect(stats).toHaveProperty('topBlockedIPs');
      expect(Array.isArray(stats.topBlockedIPs)).toBe(true);
      expect(stats.total).toBeGreaterThan(0);
    });
  });

  describe('Firewall Security Tests', () => {
    it('should configure firewall rules successfully', async () => {
      await expect(firewallManager.configureSecureFirewall()).resolves.not.toThrow();
    });

    it('should validate firewall configuration', async () => {
      const validation = await firewallManager.validateConfiguration();
      
      expect(validation).toHaveProperty('valid');
      expect(validation).toHaveProperty('issues');
      expect(Array.isArray(validation.issues)).toBe(true);
    });

    it('should return proper firewall status', async () => {
      const status = await firewallManager.getFirewallStatus();
      
      expect(status).toHaveProperty('enabled');
      expect(status).toHaveProperty('rules');
      expect(status).toHaveProperty('platform');
      expect(status).toHaveProperty('lastUpdated');
      expect(Array.isArray(status.rules)).toBe(true);
    });

    it('should handle firewall reset operations safely', async () => {
      await expect(firewallManager.resetFirewall()).resolves.not.toThrow();
    });
  });

  describe('Access Logging and Monitoring Tests', () => {
    it('should log access attempts with proper threat assessment', () => {
      const testCases = [
        {
          entry: {
            sourceIP: '192.168.1.100',
            targetPort: 30002,
            protocol: 'TCP',
            method: 'GET',
            path: '/api/users',
            userAgent: 'Mozilla/5.0',
            action: 'ALLOWED' as const,
            responseCode: 200,
          },
          expectedThreatLevel: 'LOW',
        },
        {
          entry: {
            sourceIP: '192.168.1.101',
            targetPort: 30002,
            protocol: 'TCP',
            method: 'GET',
            path: '/admin/users',
            userAgent: 'nmap/7.80',
            action: 'BLOCKED' as const,
            responseCode: 403,
          },
          expectedThreatLevel: 'HIGH',
        },
        {
          entry: {
            sourceIP: '192.168.1.102',
            targetPort: 30002,
            protocol: 'TCP',
            method: 'POST',
            path: '/api/login',
            userAgent: 'sqlmap/1.0',
            action: 'BLOCKED' as const,
            responseCode: 400,
            reason: 'SQL injection attempt detected',
          },
          expectedThreatLevel: 'CRITICAL',
        },
      ];

      testCases.forEach(testCase => {
        accessLogger.logAccess(testCase.entry);
      });

      const logs = accessLogger.queryLogs({ limit: 10 });
      const recentLogs = logs.slice(-testCases.length);
      
      expect(recentLogs.length).toBe(testCases.length);
      
      recentLogs.forEach((log, index) => {
        expect(log.threatLevel).toBe(testCases[index].expectedThreatLevel);
      });
    });

    it('should generate comprehensive access statistics', () => {
      // Generate test data
      const testData = [
        { sourceIP: '192.168.1.100', action: 'ALLOWED' as const, responseCode: 200 },
        { sourceIP: '192.168.1.100', action: 'ALLOWED' as const, responseCode: 200 },
        { sourceIP: '192.168.1.101', action: 'BLOCKED' as const, responseCode: 403 },
        { sourceIP: '192.168.1.102', action: 'RATE_LIMITED' as const, responseCode: 429 },
      ];

      testData.forEach(data => {
        accessLogger.logAccess({
          sourceIP: data.sourceIP,
          targetPort: 30002,
          protocol: 'TCP',
          method: 'GET',
          path: '/test',
          action: data.action,
          responseCode: data.responseCode,
        });
      });

      const stats = accessLogger.getStats();
      
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('allowedRequests');
      expect(stats).toHaveProperty('blockedRequests');
      expect(stats).toHaveProperty('rateLimitedRequests');
      expect(stats).toHaveProperty('uniqueIPs');
      expect(stats).toHaveProperty('topIPs');
      expect(stats).toHaveProperty('threatLevelDistribution');
      
      expect(stats.totalRequests).toBeGreaterThan(0);
      expect(stats.uniqueIPs).toBeGreaterThan(0);
      expect(Array.isArray(stats.topIPs)).toBe(true);
    });

    it('should generate security reports with recommendations', () => {
      // Generate test data with various threat levels
      const testEntries = [
        { action: 'ALLOWED' as const, responseCode: 200, userAgent: 'Mozilla/5.0' },
        { action: 'BLOCKED' as const, responseCode: 403, userAgent: 'nmap/7.80' },
        { action: 'BLOCKED' as const, responseCode: 403, userAgent: 'sqlmap/1.0' },
        { action: 'RATE_LIMITED' as const, responseCode: 429, userAgent: 'curl/7.68.0' },
      ];

      testEntries.forEach((entry, index) => {
        accessLogger.logAccess({
          sourceIP: `192.168.1.${100 + index}`,
          targetPort: 30002,
          protocol: 'TCP',
          method: 'GET',
          path: '/test',
          userAgent: entry.userAgent,
          action: entry.action,
          responseCode: entry.responseCode,
        });
      });

      const report = accessLogger.generateSecurityReport();
      
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('threats');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('timestamp');
      
      expect(Array.isArray(report.threats)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Security Auditing Tests', () => {
    it('should log audit events with proper categorization', () => {
      const testEvents = [
        {
          type: 'SECURITY_VIOLATION' as const,
          severity: 'HIGH' as const,
          source: 'TestSystem',
          description: 'Unauthorized access attempt',
          details: { sourceIP: '192.168.1.100', path: '/admin' },
        },
        {
          type: 'POLICY_CHANGE' as const,
          severity: 'MEDIUM' as const,
          source: 'TestSystem',
          description: 'Firewall rules updated',
          details: { rulesCount: 5 },
        },
        {
          type: 'ALERT_GENERATED' as const,
          severity: 'LOW' as const,
          source: 'TestSystem',
          description: 'Rate limit warning',
          details: { threshold: 100 },
        },
      ];

      testEvents.forEach(event => {
        securityAuditor.logAuditEvent(event);
      });

      const auditEvents = securityAuditor.getAuditEvents();
      const recentEvents = auditEvents.slice(-testEvents.length);
      
      expect(recentEvents.length).toBe(testEvents.length);
      
      recentEvents.forEach((event, index) => {
        expect(event.type).toBe(testEvents[index].type);
        expect(event.severity).toBe(testEvents[index].severity);
        expect(event.source).toBe(testEvents[index].source);
      });
    });

    it('should perform comprehensive compliance checks', async () => {
      const complianceChecks = await securityAuditor.performComplianceCheck();
      
      expect(Array.isArray(complianceChecks)).toBe(true);
      expect(complianceChecks.length).toBeGreaterThan(0);
      
      // Verify all checks have required properties
      complianceChecks.forEach(check => {
        expect(check).toHaveProperty('id');
        expect(check).toHaveProperty('name');
        expect(check).toHaveProperty('description');
        expect(check).toHaveProperty('category');
        expect(check).toHaveProperty('status');
        expect(check).toHaveProperty('details');
        expect(check).toHaveProperty('lastChecked');
        
        expect(['PASS', 'FAIL', 'WARNING', 'NOT_APPLICABLE']).toContain(check.status);
        expect(['ACCESS_CONTROL', 'NETWORK_SECURITY', 'LOGGING', 'MONITORING', 'CONFIGURATION']).toContain(check.category);
      });
    });

    it('should generate comprehensive audit reports', async () => {
      // Generate some audit events
      securityAuditor.logAuditEvent({
        type: 'SECURITY_VIOLATION',
        severity: 'HIGH',
        source: 'TestSystem',
        description: 'Test security violation',
        details: { test: true },
      });

      const report = await securityAuditor.generateAuditReport();
      
      expect(report).toHaveProperty('id');
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('period');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('complianceChecks');
      expect(report).toHaveProperty('securityEvents');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('riskAssessment');
      
      // Verify summary structure
      expect(report.summary).toHaveProperty('totalEvents');
      expect(report.summary).toHaveProperty('eventsBySeverity');
      expect(report.summary).toHaveProperty('eventsByType');
      expect(report.summary).toHaveProperty('complianceScore');
      expect(report.summary).toHaveProperty('criticalIssues');
      
      // Verify risk assessment structure
      expect(report.riskAssessment).toHaveProperty('overallRisk');
      expect(report.riskAssessment).toHaveProperty('riskFactors');
      expect(report.riskAssessment).toHaveProperty('mitigationSteps');
      
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(report.riskAssessment.overallRisk);
      expect(Array.isArray(report.riskAssessment.riskFactors)).toBe(true);
      expect(Array.isArray(report.riskAssessment.mitigationSteps)).toBe(true);
    });

    it('should filter audit events by type and severity', () => {
      // Generate test events
      const testEvents = [
        { type: 'SECURITY_VIOLATION' as const, severity: 'HIGH' as const },
        { type: 'SECURITY_VIOLATION' as const, severity: 'MEDIUM' as const },
        { type: 'POLICY_CHANGE' as const, severity: 'LOW' as const },
        { type: 'ALERT_GENERATED' as const, severity: 'HIGH' as const },
      ];

      testEvents.forEach(event => {
        securityAuditor.logAuditEvent({
          type: event.type,
          severity: event.severity,
          source: 'TestSystem',
          description: 'Test event',
          details: {},
        });
      });

      // Test filtering by type
      const securityViolations = securityAuditor.getAuditEventsByType('SECURITY_VIOLATION');
      expect(securityViolations.length).toBeGreaterThanOrEqual(2);
      securityViolations.forEach(event => {
        expect(event.type).toBe('SECURITY_VIOLATION');
      });

      // Test filtering by severity
      const highSeverityEvents = securityAuditor.getAuditEventsBySeverity('HIGH');
      expect(highSeverityEvents.length).toBeGreaterThanOrEqual(2);
      highSeverityEvents.forEach(event => {
        expect(event.severity).toBe('HIGH');
      });
    });
  });

  describe('Security Validation Tests', () => {
    it('should perform comprehensive security validation', async () => {
      const validationResult = await securityValidator.validateSecurity();
      
      expect(validationResult).toHaveProperty('valid');
      expect(validationResult).toHaveProperty('issues');
      expect(validationResult).toHaveProperty('warnings');
      expect(validationResult).toHaveProperty('recommendations');
      expect(validationResult).toHaveProperty('platform');
      expect(validationResult).toHaveProperty('timestamp');
      
      expect(typeof validationResult.valid).toBe('boolean');
      expect(Array.isArray(validationResult.issues)).toBe(true);
      expect(Array.isArray(validationResult.warnings)).toBe(true);
      expect(Array.isArray(validationResult.recommendations)).toBe(true);
    });

    it('should generate detailed validation reports', async () => {
      const validationResult = await securityValidator.validateSecurity();
      const report = securityValidator.generateReport(validationResult);
      
      expect(typeof report).toBe('string');
      expect(report).toContain('SECURITY VALIDATION REPORT');
      expect(report).toContain('Platform:');
      expect(report).toContain('Overall Status:');
      
      if (validationResult.issues.length > 0) {
        expect(report).toContain('CRITICAL ISSUES:');
      }
      
      if (validationResult.warnings.length > 0) {
        expect(report).toContain('WARNINGS:');
      }
      
      if (validationResult.recommendations.length > 0) {
        expect(report).toContain('RECOMMENDATIONS:');
      }
    });
  });

  describe('Security Monitoring Tests', () => {
    it('should start and stop monitoring successfully', async () => {
      const monitor = new SecurityMonitor({
        checkInterval: 1000, // 1 second for testing
        enableRealTimeAlerts: false, // Disable for testing
      });

      await expect(monitor.start()).resolves.not.toThrow();
      
      const status = monitor.getStatus();
      expect(status.isRunning).toBe(true);
      
      monitor.stop();
      expect(monitor.getStatus().isRunning).toBe(false);
    });

    it('should collect security metrics', async () => {
      const monitor = new SecurityMonitor({
        checkInterval: 5000,
        enableRealTimeAlerts: false,
      });

      // Start monitoring briefly to collect some metrics
      await monitor.start();
      
      // Wait a moment for metrics collection
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const status = monitor.getStatus();
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('config');
      expect(status).toHaveProperty('metricsCount');
      
      monitor.stop();
    });
  });

  describe('Integration Security Tests', () => {
    it('should handle rate limiting properly', () => {
      const testIP = '192.168.1.200';
      let rateLimitExceeded = false;
      
      // Simulate many rapid connections
      for (let i = 0; i < 70; i++) {
        const result = connectionMonitor.monitorConnection(testIP, 30002, 'TCP');
        if (!result.allowed && result.reason?.includes('Rate limit exceeded')) {
          rateLimitExceeded = true;
          break;
        }
      }
      
      expect(rateLimitExceeded).toBe(true);
    });

    it('should detect suspicious user agents', () => {
      const suspiciousUserAgents = [
        'nmap/7.80',
        'sqlmap/1.0',
        'nikto/2.1.6',
        'dirb/2.22',
        'gobuster/3.0'
      ];

      suspiciousUserAgents.forEach(userAgent => {
        const result = connectionMonitor.monitorConnection(
          '192.168.1.100',
          30002,
          'TCP',
          userAgent
        );
        
        // Connection should be allowed but alert should be created
        expect(result.allowed).toBe(true);
      });

      // Check that suspicious activity alerts were created
      const alerts = connectionMonitor.getAlerts();
      const suspiciousAlerts = alerts.filter(alert => 
        alert.type === 'SUSPICIOUS_ACTIVITY'
      );
      
      expect(suspiciousAlerts.length).toBeGreaterThan(0);
    });

    it('should maintain security during concurrent operations', async () => {
      const promises = [];
      const testIPs = Array.from({ length: 10 }, (_, i) => `192.168.1.${100 + i}`);
      
      // Simulate concurrent connection monitoring
      for (const ip of testIPs) {
        promises.push(
          Promise.resolve(connectionMonitor.monitorConnection(ip, 30002, 'TCP'))
        );
      }

      const results = await Promise.all(promises);
      
      // All connections should be processed
      expect(results.length).toBe(testIPs.length);
      results.forEach(result => {
        expect(result).toHaveProperty('allowed');
        expect(typeof result.allowed).toBe('boolean');
      });
    });

    it('should integrate all security components properly', async () => {
      const testIP = '192.168.1.300';
      
      // Test connection monitoring
      const connectionResult = connectionMonitor.monitorConnection(testIP, 30002, 'TCP');
      expect(connectionResult.allowed).toBe(true);
      
      // Test access logging
      accessLogger.logAccess({
        sourceIP: testIP,
        targetPort: 30002,
        protocol: 'TCP',
        method: 'GET',
        path: '/test',
        action: 'ALLOWED',
        responseCode: 200,
      });
      
      // Test audit logging
      securityAuditor.logAuditEvent({
        type: 'ACCESS_DENIED',
        severity: 'MEDIUM',
        source: 'IntegrationTest',
        description: 'Test audit event',
        details: { sourceIP: testIP },
        sourceIP: testIP,
      });
      
      // Verify all components have recorded the activity
      const connectionLog = portManager.getConnectionLog();
      const accessStats = accessLogger.getStats();
      const auditEvents = securityAuditor.getAuditEvents();
      
      expect(connectionLog.length).toBeGreaterThan(0);
      expect(accessStats.totalRequests).toBeGreaterThan(0);
      expect(auditEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Resilience Tests', () => {
    it('should handle service failures gracefully', async () => {
      // Test that components continue to function even with errors
      const invalidIP = 'invalid-ip';
      
      // This should not throw an error
      expect(() => {
        connectionMonitor.monitorConnection(invalidIP, 30002, 'TCP');
      }).not.toThrow();
      
      // Access logger should handle invalid data gracefully
      expect(() => {
        accessLogger.logAccess({
          sourceIP: invalidIP,
          targetPort: 30002,
          protocol: 'TCP',
          method: 'GET',
          path: '/test',
          action: 'ALLOWED',
          responseCode: 200,
        });
      }).not.toThrow();
    });

    it('should maintain data integrity under stress', () => {
      const stressTestData = Array.from({ length: 1000 }, (_, i) => ({
        sourceIP: `192.168.${Math.floor(i / 255)}.${i % 255}`,
        targetPort: 30002,
        protocol: 'TCP',
        method: 'GET',
        path: `/test/${i}`,
        action: i % 3 === 0 ? 'BLOCKED' as const : 'ALLOWED' as const,
        responseCode: i % 3 === 0 ? 403 : 200,
      }));

      // Log all test data
      stressTestData.forEach(data => {
        accessLogger.logAccess(data);
      });

      // Verify data integrity
      const stats = accessLogger.getStats();
      expect(stats.totalRequests).toBeGreaterThanOrEqual(stressTestData.length);
      
      const logs = accessLogger.queryLogs({ limit: stressTestData.length });
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should recover from temporary failures', async () => {
      // Test firewall manager recovery
      const firewallManager = new FirewallManager();
      
      // This should not throw even if system commands fail
      await expect(firewallManager.validateConfiguration()).resolves.not.toThrow();
      
      // Test security validator recovery
      const validator = new SecurityValidator();
      await expect(validator.validateSecurity()).resolves.not.toThrow();
    });
  });
});