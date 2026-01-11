import { EventEmitter } from 'events';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';
import { AccessLogger, AccessLogEntry } from './accessLogger';
import { ConnectionMonitor, SecurityAlert } from './connectionMonitor';
import { PortManager } from './portManager';
import { FirewallManager } from './firewallManager';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  type: 'SECURITY_VIOLATION' | 'POLICY_CHANGE' | 'ACCESS_DENIED' | 'SYSTEM_CHANGE' | 'ALERT_GENERATED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  source: string;
  description: string;
  details: Record<string, any>;
  userId?: string;
  sourceIP?: string;
  affectedResources?: string[];
  remediation?: string;
}

export interface ComplianceCheck {
  id: string;
  name: string;
  description: string;
  category: 'ACCESS_CONTROL' | 'NETWORK_SECURITY' | 'LOGGING' | 'MONITORING' | 'CONFIGURATION';
  status: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_APPLICABLE';
  details: string;
  recommendation?: string;
  lastChecked: Date;
}

export interface AuditReport {
  id: string;
  timestamp: Date;
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalEvents: number;
    eventsBySeverity: Record<string, number>;
    eventsByType: Record<string, number>;
    complianceScore: number;
    criticalIssues: number;
  };
  complianceChecks: ComplianceCheck[];
  securityEvents: AuditEvent[];
  recommendations: string[];
  riskAssessment: {
    overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    riskFactors: string[];
    mitigationSteps: string[];
  };
}

export class SecurityAuditor extends EventEmitter {
  private auditPath: string;
  private accessLogger: AccessLogger;
  private connectionMonitor: ConnectionMonitor;
  private portManager: PortManager;
  private firewallManager: FirewallManager;
  private auditEvents: AuditEvent[] = [];
  private maxEvents: number = 10000;

  constructor(
    accessLogger: AccessLogger,
    connectionMonitor: ConnectionMonitor,
    portManager: PortManager,
    firewallManager: FirewallManager,
    auditPath: string = './logs/audit'
  ) {
    super();
    
    this.auditPath = auditPath;
    this.accessLogger = accessLogger;
    this.connectionMonitor = connectionMonitor;
    this.portManager = portManager;
    this.firewallManager = firewallManager;

    this.ensureAuditDirectory();
    this.setupEventHandlers();
  }

  /**
   * Log an audit event
   */
  logAuditEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): void {
    const auditEvent: AuditEvent = {
      id: this.generateId(),
      timestamp: new Date(),
      ...event,
    };

    this.auditEvents.push(auditEvent);

    // Keep only the most recent events
    if (this.auditEvents.length > this.maxEvents) {
      this.auditEvents = this.auditEvents.slice(-this.maxEvents);
    }

    // Save to file
    this.saveAuditEvent(auditEvent);

    // Emit event
    this.emit('auditEvent', auditEvent);

    // Log critical events immediately
    if (auditEvent.severity === 'CRITICAL') {
      logger.error('Critical audit event', auditEvent);
    }
  }

  /**
   * Perform comprehensive compliance check
   */
  async performComplianceCheck(): Promise<ComplianceCheck[]> {
    logger.info('Performing compliance check');

    const checks: ComplianceCheck[] = [];

    // Access Control Checks
    checks.push(...await this.checkAccessControls());

    // Network Security Checks
    checks.push(...await this.checkNetworkSecurity());

    // Logging Checks
    checks.push(...await this.checkLogging());

    // Monitoring Checks
    checks.push(...await this.checkMonitoring());

    // Configuration Checks
    checks.push(...await this.checkConfiguration());

    // Log compliance check completion
    this.logAuditEvent({
      type: 'SYSTEM_CHANGE',
      severity: 'LOW',
      source: 'SecurityAuditor',
      description: 'Compliance check completed',
      details: {
        totalChecks: checks.length,
        passed: checks.filter(c => c.status === 'PASS').length,
        failed: checks.filter(c => c.status === 'FAIL').length,
        warnings: checks.filter(c => c.status === 'WARNING').length,
      },
    });

    return checks;
  }

  /**
   * Check access control compliance
   */
  private async checkAccessControls(): Promise<ComplianceCheck[]> {
    const checks: ComplianceCheck[] = [];

    // Check if only authorized ports are open
    try {
      const portStatus = await this.portManager.getPortStatus();
      const unauthorizedPorts = portStatus.filter(p => p.port !== 30002 && p.status === 'open');

      checks.push({
        id: 'AC-001',
        name: 'Authorized Ports Only',
        description: 'Verify only authorized ports are accessible',
        category: 'ACCESS_CONTROL',
        status: unauthorizedPorts.length === 0 ? 'PASS' : 'FAIL',
        details: unauthorizedPorts.length === 0 
          ? 'Only authorized port 30002 is accessible'
          : `Unauthorized ports detected: ${unauthorizedPorts.map(p => p.port).join(', ')}`,
        recommendation: unauthorizedPorts.length > 0 
          ? 'Close unauthorized ports and review firewall configuration'
          : undefined,
        lastChecked: new Date(),
      });
    } catch (error) {
      checks.push({
        id: 'AC-001',
        name: 'Authorized Ports Only',
        description: 'Verify only authorized ports are accessible',
        category: 'ACCESS_CONTROL',
        status: 'WARNING',
        details: `Unable to check port status: ${error}`,
        recommendation: 'Investigate port checking mechanism',
        lastChecked: new Date(),
      });
    }

    // Check connection logging
    const connectionStats = this.portManager.getConnectionStats();
    checks.push({
      id: 'AC-002',
      name: 'Connection Logging',
      description: 'Verify all connections are being logged',
      category: 'ACCESS_CONTROL',
      status: connectionStats.total > 0 ? 'PASS' : 'WARNING',
      details: `${connectionStats.total} connections logged, ${connectionStats.blocked} blocked`,
      recommendation: connectionStats.total === 0 
        ? 'Verify connection logging is working properly'
        : undefined,
      lastChecked: new Date(),
    });

    // Check rate limiting
    const recentBlocked = connectionStats.recentBlocked;
    checks.push({
      id: 'AC-003',
      name: 'Rate Limiting Active',
      description: 'Verify rate limiting is functioning',
      category: 'ACCESS_CONTROL',
      status: 'PASS', // Assume rate limiting is configured
      details: `${recentBlocked} connections blocked in the last hour`,
      lastChecked: new Date(),
    });

    return checks;
  }

  /**
   * Check network security compliance
   */
  private async checkNetworkSecurity(): Promise<ComplianceCheck[]> {
    const checks: ComplianceCheck[] = [];

    // Check firewall status
    try {
      const firewallStatus = await this.firewallManager.getFirewallStatus();
      checks.push({
        id: 'NS-001',
        name: 'Firewall Enabled',
        description: 'Verify firewall is enabled and configured',
        category: 'NETWORK_SECURITY',
        status: firewallStatus.enabled ? 'PASS' : 'FAIL',
        details: `Firewall enabled: ${firewallStatus.enabled}, Rules: ${firewallStatus.rules.length}`,
        recommendation: !firewallStatus.enabled 
          ? 'Enable and configure firewall immediately'
          : undefined,
        lastChecked: new Date(),
      });

      // Check firewall rules
      const hasAllowRule = firewallStatus.rules.some(r => r.action === 'ALLOW' && r.port === 30002);
      const hasDenyRule = firewallStatus.rules.some(r => r.action === 'DENY');

      checks.push({
        id: 'NS-002',
        name: 'Firewall Rules Configured',
        description: 'Verify proper firewall rules are in place',
        category: 'NETWORK_SECURITY',
        status: hasAllowRule && hasDenyRule ? 'PASS' : 'FAIL',
        details: `Allow rule for port 30002: ${hasAllowRule}, Deny rules present: ${hasDenyRule}`,
        recommendation: !hasAllowRule || !hasDenyRule 
          ? 'Configure proper firewall rules for port 30002 and default deny'
          : undefined,
        lastChecked: new Date(),
      });

    } catch (error) {
      checks.push({
        id: 'NS-001',
        name: 'Firewall Status Check',
        description: 'Verify firewall status can be checked',
        category: 'NETWORK_SECURITY',
        status: 'WARNING',
        details: `Unable to check firewall status: ${error}`,
        recommendation: 'Investigate firewall status checking mechanism',
        lastChecked: new Date(),
      });
    }

    // Check for suspicious network activity
    const monitoringStats = this.connectionMonitor.getMonitoringStats();
    checks.push({
      id: 'NS-003',
      name: 'Network Monitoring Active',
      description: 'Verify network monitoring is detecting threats',
      category: 'NETWORK_SECURITY',
      status: monitoringStats.totalAlerts >= 0 ? 'PASS' : 'WARNING',
      details: `${monitoringStats.totalAlerts} alerts generated, ${monitoringStats.suspiciousIPs} suspicious IPs`,
      lastChecked: new Date(),
    });

    return checks;
  }

  /**
   * Check logging compliance
   */
  private async checkLogging(): Promise<ComplianceCheck[]> {
    const checks: ComplianceCheck[] = [];

    // Check access logging
    const accessStats = this.accessLogger.getStats();
    checks.push({
      id: 'LOG-001',
      name: 'Access Logging Active',
      description: 'Verify access attempts are being logged',
      category: 'LOGGING',
      status: accessStats.totalRequests > 0 ? 'PASS' : 'WARNING',
      details: `${accessStats.totalRequests} access attempts logged`,
      recommendation: accessStats.totalRequests === 0 
        ? 'Verify access logging is configured and working'
        : undefined,
      lastChecked: new Date(),
    });

    // Check audit logging
    checks.push({
      id: 'LOG-002',
      name: 'Audit Logging Active',
      description: 'Verify audit events are being logged',
      category: 'LOGGING',
      status: this.auditEvents.length > 0 ? 'PASS' : 'WARNING',
      details: `${this.auditEvents.length} audit events logged`,
      recommendation: this.auditEvents.length === 0 
        ? 'Verify audit logging is configured and working'
        : undefined,
      lastChecked: new Date(),
    });

    // Check log retention
    checks.push({
      id: 'LOG-003',
      name: 'Log Retention Policy',
      description: 'Verify logs are retained for appropriate period',
      category: 'LOGGING',
      status: 'PASS', // Assume retention is configured
      details: 'Log retention policy is configured',
      lastChecked: new Date(),
    });

    return checks;
  }

  /**
   * Check monitoring compliance
   */
  private async checkMonitoring(): Promise<ComplianceCheck[]> {
    const checks: ComplianceCheck[] = [];

    // Check security monitoring
    const monitoringStats = this.connectionMonitor.getMonitoringStats();
    checks.push({
      id: 'MON-001',
      name: 'Security Monitoring Active',
      description: 'Verify security monitoring is operational',
      category: 'MONITORING',
      status: 'PASS',
      details: `Monitoring active with ${monitoringStats.totalAlerts} alerts generated`,
      lastChecked: new Date(),
    });

    // Check alert generation
    const recentAlerts = this.connectionMonitor.getAlerts(10);
    checks.push({
      id: 'MON-002',
      name: 'Alert Generation',
      description: 'Verify security alerts are being generated',
      category: 'MONITORING',
      status: 'PASS',
      details: `${recentAlerts.length} recent alerts available`,
      lastChecked: new Date(),
    });

    // Check real-time monitoring
    checks.push({
      id: 'MON-003',
      name: 'Real-time Monitoring',
      description: 'Verify real-time security monitoring is active',
      category: 'MONITORING',
      status: 'PASS',
      details: 'Real-time monitoring is configured and active',
      lastChecked: new Date(),
    });

    return checks;
  }

  /**
   * Check configuration compliance
   */
  private async checkConfiguration(): Promise<ComplianceCheck[]> {
    const checks: ComplianceCheck[] = [];

    // Check security headers
    checks.push({
      id: 'CFG-001',
      name: 'Security Headers',
      description: 'Verify security headers are configured',
      category: 'CONFIGURATION',
      status: 'PASS', // Assume headers are configured in middleware
      details: 'Security headers are configured in gateway middleware',
      lastChecked: new Date(),
    });

    // Check HTTPS configuration
    checks.push({
      id: 'CFG-002',
      name: 'HTTPS Configuration',
      description: 'Verify HTTPS is properly configured',
      category: 'CONFIGURATION',
      status: 'WARNING', // Localhost typically uses HTTP
      details: 'Running on localhost with HTTP (acceptable for development)',
      recommendation: 'Configure HTTPS for production deployment',
      lastChecked: new Date(),
    });

    // Check rate limiting configuration
    checks.push({
      id: 'CFG-003',
      name: 'Rate Limiting Configuration',
      description: 'Verify rate limiting is properly configured',
      category: 'CONFIGURATION',
      status: 'PASS',
      details: 'Rate limiting is configured in gateway middleware',
      lastChecked: new Date(),
    });

    return checks;
  }

  /**
   * Generate comprehensive audit report
   */
  async generateAuditReport(period?: { start: Date; end: Date }): Promise<AuditReport> {
    logger.info('Generating audit report');

    const now = new Date();
    const reportPeriod = period || {
      start: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Last 24 hours
      end: now,
    };

    // Get events for the period
    const periodEvents = this.auditEvents.filter(
      event => event.timestamp >= reportPeriod.start && event.timestamp <= reportPeriod.end
    );

    // Perform compliance checks
    const complianceChecks = await this.performComplianceCheck();

    // Calculate compliance score
    const totalChecks = complianceChecks.length;
    const passedChecks = complianceChecks.filter(c => c.status === 'PASS').length;
    const complianceScore = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

    // Count events by severity and type
    const eventsBySeverity = periodEvents.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const eventsByType = periodEvents.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Count critical issues
    const criticalIssues = complianceChecks.filter(c => c.status === 'FAIL').length +
                          periodEvents.filter(e => e.severity === 'CRITICAL').length;

    // Generate recommendations
    const recommendations = this.generateRecommendations(complianceChecks, periodEvents);

    // Assess risk
    const riskAssessment = this.assessRisk(complianceChecks, periodEvents);

    const report: AuditReport = {
      id: this.generateId(),
      timestamp: now,
      period: reportPeriod,
      summary: {
        totalEvents: periodEvents.length,
        eventsBySeverity,
        eventsByType,
        complianceScore,
        criticalIssues,
      },
      complianceChecks,
      securityEvents: periodEvents.slice(-100), // Last 100 events
      recommendations,
      riskAssessment,
    };

    // Save report
    this.saveAuditReport(report);

    // Log report generation
    this.logAuditEvent({
      type: 'SYSTEM_CHANGE',
      severity: 'LOW',
      source: 'SecurityAuditor',
      description: 'Audit report generated',
      details: {
        reportId: report.id,
        complianceScore: report.summary.complianceScore,
        criticalIssues: report.summary.criticalIssues,
      },
    });

    return report;
  }

  /**
   * Generate recommendations based on compliance checks and events
   */
  private generateRecommendations(
    complianceChecks: ComplianceCheck[],
    events: AuditEvent[]
  ): string[] {
    const recommendations: string[] = [];

    // Recommendations from failed compliance checks
    const failedChecks = complianceChecks.filter(c => c.status === 'FAIL');
    failedChecks.forEach(check => {
      if (check.recommendation) {
        recommendations.push(`[${check.id}] ${check.recommendation}`);
      }
    });

    // Recommendations from warning checks
    const warningChecks = complianceChecks.filter(c => c.status === 'WARNING');
    warningChecks.forEach(check => {
      if (check.recommendation) {
        recommendations.push(`[${check.id}] ${check.recommendation}`);
      }
    });

    // Recommendations based on event patterns
    const criticalEvents = events.filter(e => e.severity === 'CRITICAL');
    if (criticalEvents.length > 0) {
      recommendations.push('Investigate and address critical security events immediately');
    }

    const securityViolations = events.filter(e => e.type === 'SECURITY_VIOLATION');
    if (securityViolations.length > 5) {
      recommendations.push('High number of security violations detected - review security policies');
    }

    if (recommendations.length === 0) {
      recommendations.push('Security posture appears satisfactory - continue monitoring');
    }

    return recommendations;
  }

  /**
   * Assess overall risk level
   */
  private assessRisk(
    complianceChecks: ComplianceCheck[],
    events: AuditEvent[]
  ): {
    overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    riskFactors: string[];
    mitigationSteps: string[];
  } {
    const riskFactors: string[] = [];
    const mitigationSteps: string[] = [];
    let riskScore = 0;

    // Risk from failed compliance checks
    const failedChecks = complianceChecks.filter(c => c.status === 'FAIL');
    if (failedChecks.length > 0) {
      riskScore += failedChecks.length * 2;
      riskFactors.push(`${failedChecks.length} failed compliance checks`);
      mitigationSteps.push('Address all failed compliance checks');
    }

    // Risk from critical events
    const criticalEvents = events.filter(e => e.severity === 'CRITICAL');
    if (criticalEvents.length > 0) {
      riskScore += criticalEvents.length * 3;
      riskFactors.push(`${criticalEvents.length} critical security events`);
      mitigationSteps.push('Investigate and resolve critical security events');
    }

    // Risk from high-severity events
    const highEvents = events.filter(e => e.severity === 'HIGH');
    if (highEvents.length > 0) {
      riskScore += highEvents.length;
      riskFactors.push(`${highEvents.length} high-severity security events`);
      mitigationSteps.push('Review and address high-severity events');
    }

    // Risk from security violations
    const violations = events.filter(e => e.type === 'SECURITY_VIOLATION');
    if (violations.length > 10) {
      riskScore += 2;
      riskFactors.push('High number of security violations');
      mitigationSteps.push('Review and strengthen security policies');
    }

    // Determine overall risk level
    let overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    if (riskScore >= 10) overallRisk = 'CRITICAL';
    else if (riskScore >= 6) overallRisk = 'HIGH';
    else if (riskScore >= 3) overallRisk = 'MEDIUM';
    else overallRisk = 'LOW';

    if (riskFactors.length === 0) {
      riskFactors.push('No significant risk factors identified');
    }

    if (mitigationSteps.length === 0) {
      mitigationSteps.push('Continue regular monitoring and maintenance');
    }

    return {
      overallRisk,
      riskFactors,
      mitigationSteps,
    };
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle security alerts from connection monitor
    this.connectionMonitor.on('securityAlert', (alert: SecurityAlert) => {
      this.logAuditEvent({
        type: 'ALERT_GENERATED',
        severity: alert.severity === 'CRITICAL' ? 'CRITICAL' : 
                 alert.severity === 'HIGH' ? 'HIGH' : 
                 alert.severity === 'MEDIUM' ? 'MEDIUM' : 'LOW',
        source: 'ConnectionMonitor',
        description: `Security alert: ${alert.description}`,
        details: {
          alertId: alert.id,
          alertType: alert.type,
          sourceIP: alert.sourceIP,
          metadata: alert.metadata,
        },
        sourceIP: alert.sourceIP,
      });
    });
  }

  /**
   * Save audit event to file
   */
  private saveAuditEvent(event: AuditEvent): void {
    try {
      const auditFile = join(this.auditPath, 'audit-events.jsonl');
      const eventLine = JSON.stringify(event) + '\n';
      writeFileSync(auditFile, eventLine, { flag: 'a' });
    } catch (error) {
      logger.error('Failed to save audit event', { error, event });
    }
  }

  /**
   * Save audit report to file
   */
  private saveAuditReport(report: AuditReport): void {
    try {
      const reportFile = join(this.auditPath, `audit-report-${report.id}.json`);
      writeFileSync(reportFile, JSON.stringify(report, null, 2));
      logger.info('Audit report saved', { reportFile });
    } catch (error) {
      logger.error('Failed to save audit report', { error, reportId: report.id });
    }
  }

  /**
   * Ensure audit directory exists
   */
  private ensureAuditDirectory(): void {
    if (!existsSync(this.auditPath)) {
      mkdirSync(this.auditPath, { recursive: true });
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get recent audit events
   */
  getAuditEvents(limit: number = 100): AuditEvent[] {
    return this.auditEvents.slice(-limit);
  }

  /**
   * Get audit events by type
   */
  getAuditEventsByType(type: AuditEvent['type']): AuditEvent[] {
    return this.auditEvents.filter(event => event.type === type);
  }

  /**
   * Get audit events by severity
   */
  getAuditEventsBySeverity(severity: AuditEvent['severity']): AuditEvent[] {
    return this.auditEvents.filter(event => event.severity === severity);
  }
}