import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { PortManager, ConnectionAttempt } from './portManager';

export interface SecurityAlert {
  id: string;
  type: 'SUSPICIOUS_ACTIVITY' | 'RATE_LIMIT_EXCEEDED' | 'UNAUTHORIZED_ACCESS' | 'PORT_SCAN_DETECTED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  sourceIP: string;
  description: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class ConnectionMonitor extends EventEmitter {
  private portManager: PortManager;
  private alerts: SecurityAlert[] = [];
  private suspiciousIPs: Map<string, { count: number; lastSeen: Date }> = new Map();
  private rateLimitTracker: Map<string, { requests: number; windowStart: Date }> = new Map();

  constructor(portManager: PortManager) {
    super();
    this.portManager = portManager;
    this.startMonitoring();
  }

  /**
   * Monitor a connection attempt
   */
  monitorConnection(
    sourceIP: string,
    targetPort: number,
    protocol: string = 'TCP',
    userAgent?: string
  ): { allowed: boolean; reason?: string } {
    const timestamp = new Date();

    // Check if connection should be allowed
    const allowed = this.portManager.isConnectionAllowed(sourceIP, targetPort);
    let reason: string | undefined;

    if (!allowed) {
      reason = `Port ${targetPort} not in allowed list`;
      this.handleBlockedConnection(sourceIP, targetPort, reason);
    } else {
      // Check for rate limiting
      const rateLimitResult = this.checkRateLimit(sourceIP);
      if (!rateLimitResult.allowed) {
        reason = rateLimitResult.reason;
        this.handleBlockedConnection(sourceIP, targetPort, reason);
        return { allowed: false, reason };
      }

      // Check for suspicious patterns
      this.checkSuspiciousActivity(sourceIP, targetPort, userAgent);
    }

    // Log the connection attempt
    this.portManager.logConnectionAttempt({
      sourceIP,
      targetPort,
      protocol,
      action: allowed ? 'ALLOWED' : 'BLOCKED',
      reason,
      userAgent,
    });

    return { allowed, reason };
  }

  /**
   * Check rate limiting for an IP
   */
  private checkRateLimit(sourceIP: string): { allowed: boolean; reason?: string } {
    const now = new Date();
    const windowMs = 60000; // 1 minute window
    const maxRequests = 60; // Max 60 requests per minute per IP

    const tracker = this.rateLimitTracker.get(sourceIP);

    if (!tracker) {
      this.rateLimitTracker.set(sourceIP, {
        requests: 1,
        windowStart: now,
      });
      return { allowed: true };
    }

    // Reset window if expired
    if (now.getTime() - tracker.windowStart.getTime() > windowMs) {
      this.rateLimitTracker.set(sourceIP, {
        requests: 1,
        windowStart: now,
      });
      return { allowed: true };
    }

    // Increment request count
    tracker.requests++;

    if (tracker.requests > maxRequests) {
      this.createAlert({
        type: 'RATE_LIMIT_EXCEEDED',
        severity: 'MEDIUM',
        sourceIP,
        description: `IP ${sourceIP} exceeded rate limit: ${tracker.requests} requests in window`,
        metadata: {
          requests: tracker.requests,
          windowStart: tracker.windowStart,
          maxRequests,
        },
      });

      return {
        allowed: false,
        reason: `Rate limit exceeded: ${tracker.requests}/${maxRequests} requests per minute`,
      };
    }

    return { allowed: true };
  }

  /**
   * Check for suspicious activity patterns
   */
  private checkSuspiciousActivity(sourceIP: string, targetPort: number, userAgent?: string): void {
    const suspicious = this.suspiciousIPs.get(sourceIP) || { count: 0, lastSeen: new Date() };
    
    // Update suspicious activity tracking
    suspicious.count++;
    suspicious.lastSeen = new Date();
    this.suspiciousIPs.set(sourceIP, suspicious);

    // Check for port scanning (multiple different ports from same IP)
    const recentConnections = this.portManager.getConnectionLog(100)
      .filter(c => c.sourceIP === sourceIP && 
                   new Date().getTime() - c.timestamp.getTime() < 300000); // Last 5 minutes

    const uniquePorts = new Set(recentConnections.map(c => c.targetPort));
    
    if (uniquePorts.size > 5) {
      this.createAlert({
        type: 'PORT_SCAN_DETECTED',
        severity: 'HIGH',
        sourceIP,
        description: `Potential port scan detected from ${sourceIP}: ${uniquePorts.size} different ports accessed`,
        metadata: {
          ports: Array.from(uniquePorts),
          connectionCount: recentConnections.length,
          timeWindow: '5 minutes',
        },
      });
    }

    // Check for suspicious user agents
    if (userAgent && this.isSuspiciousUserAgent(userAgent)) {
      this.createAlert({
        type: 'SUSPICIOUS_ACTIVITY',
        severity: 'MEDIUM',
        sourceIP,
        description: `Suspicious user agent detected from ${sourceIP}`,
        metadata: {
          userAgent,
          targetPort,
        },
      });
    }

    // Clean up old suspicious IP entries (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    for (const [ip, data] of this.suspiciousIPs.entries()) {
      if (data.lastSeen < oneHourAgo) {
        this.suspiciousIPs.delete(ip);
      }
    }
  }

  /**
   * Check if user agent is suspicious
   */
  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /nmap/i,
      /masscan/i,
      /zmap/i,
      /sqlmap/i,
      /nikto/i,
      /dirb/i,
      /gobuster/i,
      /curl.*bot/i,
      /python-requests/i,
      /wget/i,
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Handle blocked connection
   */
  private handleBlockedConnection(sourceIP: string, targetPort: number, reason: string): void {
    logger.warn('Connection blocked', {
      sourceIP,
      targetPort,
      reason,
      timestamp: new Date().toISOString(),
    });

    // Create alert for unauthorized access attempts
    this.createAlert({
      type: 'UNAUTHORIZED_ACCESS',
      severity: 'MEDIUM',
      sourceIP,
      description: `Unauthorized access attempt to port ${targetPort}: ${reason}`,
      metadata: {
        targetPort,
        reason,
      },
    });
  }

  /**
   * Create a security alert
   */
  private createAlert(alertData: Omit<SecurityAlert, 'id' | 'timestamp'>): void {
    const alert: SecurityAlert = {
      id: this.generateAlertId(),
      timestamp: new Date(),
      ...alertData,
    };

    this.alerts.push(alert);

    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    logger.warn('Security alert created', alert);
    this.emit('securityAlert', alert);
  }

  /**
   * Get recent security alerts
   */
  getAlerts(limit: number = 50): SecurityAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: SecurityAlert['severity']): SecurityAlert[] {
    return this.alerts.filter(alert => alert.severity === severity);
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(): {
    totalAlerts: number;
    alertsBySeverity: Record<string, number>;
    suspiciousIPs: number;
    activeRateLimits: number;
    topAlertTypes: Array<{ type: string; count: number }>;
  } {
    const alertsBySeverity = this.alerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const alertsByType = this.alerts.reduce((acc, alert) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topAlertTypes = Object.entries(alertsByType)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    return {
      totalAlerts: this.alerts.length,
      alertsBySeverity,
      suspiciousIPs: this.suspiciousIPs.size,
      activeRateLimits: this.rateLimitTracker.size,
      topAlertTypes,
    };
  }

  /**
   * Start monitoring processes
   */
  private startMonitoring(): void {
    // Clean up old data every hour
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000);

    // Clean up rate limit tracker every 5 minutes
    setInterval(() => {
      this.cleanupRateLimitTracker();
    }, 5 * 60 * 1000);

    logger.info('Connection monitoring started');
  }

  /**
   * Clean up old monitoring data
   */
  private cleanupOldData(): void {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Clean up old alerts
    const originalAlertCount = this.alerts.length;
    this.alerts = this.alerts.filter(alert => alert.timestamp > twentyFourHoursAgo);
    
    if (originalAlertCount > this.alerts.length) {
      logger.info(`Cleaned up ${originalAlertCount - this.alerts.length} old alerts`);
    }
  }

  /**
   * Clean up expired rate limit trackers
   */
  private cleanupRateLimitTracker(): void {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    for (const [ip, tracker] of this.rateLimitTracker.entries()) {
      if (tracker.windowStart < fiveMinutesAgo) {
        this.rateLimitTracker.delete(ip);
      }
    }
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}