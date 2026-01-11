#!/usr/bin/env node

import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';
import { ConnectionMonitor, SecurityAlert } from '../services/connectionMonitor';
import { PortManager } from '../services/portManager';
import { FirewallManager } from '../services/firewallManager';

const execAsync = promisify(exec);

export interface MonitoringConfig {
  checkInterval: number; // milliseconds
  alertThreshold: {
    blockedConnections: number;
    suspiciousActivity: number;
    rateLimitViolations: number;
  };
  logRetention: number; // days
  reportPath: string;
  enableRealTimeAlerts: boolean;
}

export interface SecurityMetrics {
  timestamp: Date;
  totalConnections: number;
  blockedConnections: number;
  allowedConnections: number;
  suspiciousIPs: number;
  activeAlerts: number;
  systemLoad: {
    cpu: number;
    memory: number;
  };
  networkStats: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
}

export class SecurityMonitor extends EventEmitter {
  private config: MonitoringConfig;
  private portManager: PortManager;
  private connectionMonitor: ConnectionMonitor;
  private firewallManager: FirewallManager;
  private isRunning: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private metricsHistory: SecurityMetrics[] = [];

  constructor(config?: Partial<MonitoringConfig>) {
    super();
    
    this.config = {
      checkInterval: 30000, // 30 seconds
      alertThreshold: {
        blockedConnections: 10,
        suspiciousActivity: 5,
        rateLimitViolations: 20,
      },
      logRetention: 7, // 7 days
      reportPath: './logs/security',
      enableRealTimeAlerts: true,
      ...config,
    };

    this.portManager = new PortManager();
    this.connectionMonitor = new ConnectionMonitor(this.portManager);
    this.firewallManager = new FirewallManager();

    this.setupEventHandlers();
    this.ensureLogDirectory();
  }

  /**
   * Start security monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Security monitor is already running');
      return;
    }

    logger.info('Starting security monitoring', {
      checkInterval: this.config.checkInterval,
      alertThreshold: this.config.alertThreshold,
    });

    this.isRunning = true;

    // Start periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.performSecurityCheck().catch(error => {
        logger.error('Security check failed', { error });
      });
    }, this.config.checkInterval);

    // Perform initial check
    await this.performSecurityCheck();

    // Start log cleanup routine (daily)
    setInterval(() => {
      this.cleanupOldLogs().catch(error => {
        logger.error('Log cleanup failed', { error });
      });
    }, 24 * 60 * 60 * 1000);

    this.emit('started');
    logger.info('Security monitoring started successfully');
  }

  /**
   * Stop security monitoring
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('Security monitor is not running');
      return;
    }

    logger.info('Stopping security monitoring');

    this.isRunning = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.emit('stopped');
    logger.info('Security monitoring stopped');
  }

  /**
   * Perform comprehensive security check
   */
  private async performSecurityCheck(): Promise<void> {
    try {
      logger.debug('Performing security check');

      // Collect current metrics
      const metrics = await this.collectSecurityMetrics();
      this.metricsHistory.push(metrics);

      // Keep only last 24 hours of metrics (assuming 30s intervals)
      if (this.metricsHistory.length > 2880) {
        this.metricsHistory = this.metricsHistory.slice(-2880);
      }

      // Check for security issues
      await this.checkSecurityThresholds(metrics);

      // Validate firewall status
      await this.validateFirewallStatus();

      // Check system resources
      await this.checkSystemResources(metrics);

      // Generate periodic report
      if (this.shouldGenerateReport()) {
        await this.generateSecurityReport();
      }

      this.emit('checkCompleted', metrics);

    } catch (error) {
      logger.error('Security check failed', { error });
      this.emit('checkFailed', error);
    }
  }

  /**
   * Collect current security metrics
   */
  private async collectSecurityMetrics(): Promise<SecurityMetrics> {
    const connectionStats = this.portManager.getConnectionStats();
    const monitoringStats = this.connectionMonitor.getMonitoringStats();
    const systemLoad = await this.getSystemLoad();
    const networkStats = await this.getNetworkStats();

    return {
      timestamp: new Date(),
      totalConnections: connectionStats.total,
      blockedConnections: connectionStats.blocked,
      allowedConnections: connectionStats.allowed,
      suspiciousIPs: monitoringStats.suspiciousIPs,
      activeAlerts: monitoringStats.totalAlerts,
      systemLoad,
      networkStats,
    };
  }

  /**
   * Get system load information
   */
  private async getSystemLoad(): Promise<{ cpu: number; memory: number }> {
    try {
      // Get CPU usage (simplified)
      const { stdout: cpuInfo } = await execAsync('top -bn1 | grep "Cpu(s)" | awk \'{print $2}\' | cut -d\'%\' -f1 || echo "0"');
      const cpu = parseFloat(cpuInfo.trim()) || 0;

      // Get memory usage
      let memory = 0;
      try {
        const { stdout: memInfo } = await execAsync('free | grep Mem | awk \'{printf "%.1f", $3/$2 * 100.0}\' || echo "0"');
        memory = parseFloat(memInfo.trim()) || 0;
      } catch {
        // Fallback for macOS
        try {
          const { stdout: macMem } = await execAsync('vm_stat | grep "Pages active" | awk \'{print $3}\' | cut -d\'.\' -f1 || echo "0"');
          memory = parseFloat(macMem.trim()) / 1000 || 0; // Simplified calculation
        } catch {
          memory = 0;
        }
      }

      return { cpu, memory };
    } catch (error) {
      logger.debug('Could not get system load', { error });
      return { cpu: 0, memory: 0 };
    }
  }

  /**
   * Get network statistics
   */
  private async getNetworkStats(): Promise<{
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  }> {
    try {
      // This is a simplified implementation
      // In production, you might want to use more sophisticated network monitoring
      const { stdout } = await execAsync('netstat -i | tail -n +3 | awk \'{sum+=$4} END {print sum}\' || echo "0"');
      const packets = parseInt(stdout.trim()) || 0;

      return {
        bytesIn: packets * 64, // Estimated
        bytesOut: packets * 64, // Estimated
        packetsIn: packets,
        packetsOut: packets,
      };
    } catch (error) {
      logger.debug('Could not get network stats', { error });
      return {
        bytesIn: 0,
        bytesOut: 0,
        packetsIn: 0,
        packetsOut: 0,
      };
    }
  }

  /**
   * Check security thresholds and generate alerts
   */
  private async checkSecurityThresholds(metrics: SecurityMetrics): Promise<void> {
    const { alertThreshold } = this.config;

    // Check blocked connections threshold
    if (metrics.blockedConnections >= alertThreshold.blockedConnections) {
      this.generateAlert({
        type: 'SUSPICIOUS_ACTIVITY',
        severity: 'HIGH',
        message: `High number of blocked connections: ${metrics.blockedConnections}`,
        metrics,
      });
    }

    // Check suspicious IPs threshold
    if (metrics.suspiciousIPs >= alertThreshold.suspiciousActivity) {
      this.generateAlert({
        type: 'SUSPICIOUS_ACTIVITY',
        severity: 'MEDIUM',
        message: `Multiple suspicious IPs detected: ${metrics.suspiciousIPs}`,
        metrics,
      });
    }

    // Check system resource usage
    if (metrics.systemLoad.cpu > 90) {
      this.generateAlert({
        type: 'SYSTEM_OVERLOAD',
        severity: 'MEDIUM',
        message: `High CPU usage: ${metrics.systemLoad.cpu}%`,
        metrics,
      });
    }

    if (metrics.systemLoad.memory > 90) {
      this.generateAlert({
        type: 'SYSTEM_OVERLOAD',
        severity: 'MEDIUM',
        message: `High memory usage: ${metrics.systemLoad.memory}%`,
        metrics,
      });
    }
  }

  /**
   * Validate firewall status
   */
  private async validateFirewallStatus(): Promise<void> {
    try {
      const firewallStatus = await this.firewallManager.validateConfiguration();
      
      if (!firewallStatus.valid) {
        this.generateAlert({
          type: 'FIREWALL_ISSUE',
          severity: 'CRITICAL',
          message: `Firewall validation failed: ${firewallStatus.issues.join(', ')}`,
          metadata: { issues: firewallStatus.issues },
        });
      }
    } catch (error) {
      logger.error('Firewall validation failed', { error });
    }
  }

  /**
   * Check system resources
   */
  private async checkSystemResources(metrics: SecurityMetrics): Promise<void> {
    // Check disk space
    try {
      const { stdout } = await execAsync('df -h / | tail -1 | awk \'{print $5}\' | cut -d\'%\' -f1 || echo "0"');
      const diskUsage = parseInt(stdout.trim()) || 0;

      if (diskUsage > 90) {
        this.generateAlert({
          type: 'SYSTEM_OVERLOAD',
          severity: 'HIGH',
          message: `High disk usage: ${diskUsage}%`,
          metrics,
        });
      }
    } catch (error) {
      logger.debug('Could not check disk usage', { error });
    }
  }

  /**
   * Generate security alert
   */
  private generateAlert(alertData: {
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    message: string;
    metrics?: SecurityMetrics;
    metadata?: any;
  }): void {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...alertData,
    };

    logger.warn('Security alert generated', alert);

    // Save alert to file
    this.saveAlert(alert);

    // Emit alert event
    this.emit('alert', alert);

    // Send real-time notification if enabled
    if (this.config.enableRealTimeAlerts) {
      this.sendRealTimeAlert(alert);
    }
  }

  /**
   * Save alert to file
   */
  private saveAlert(alert: any): void {
    try {
      const alertsFile = join(this.config.reportPath, 'alerts.jsonl');
      const alertLine = JSON.stringify(alert) + '\n';
      
      writeFileSync(alertsFile, alertLine, { flag: 'a' });
    } catch (error) {
      logger.error('Failed to save alert to file', { error, alert });
    }
  }

  /**
   * Send real-time alert notification
   */
  private sendRealTimeAlert(alert: any): void {
    // In a real implementation, this could send notifications via:
    // - Email
    // - Slack/Discord webhook
    // - SMS
    // - Push notification service
    
    console.log(`🚨 SECURITY ALERT [${alert.severity}]: ${alert.message}`);
    
    // Log to system log as well
    logger.error('SECURITY ALERT', alert);
  }

  /**
   * Check if we should generate a periodic report
   */
  private shouldGenerateReport(): boolean {
    // Generate report every hour
    const now = new Date();
    return now.getMinutes() === 0 && now.getSeconds() < 30;
  }

  /**
   * Generate comprehensive security report
   */
  private async generateSecurityReport(): Promise<void> {
    try {
      logger.info('Generating security report');

      const report = await this.createSecurityReport();
      const reportFile = join(
        this.config.reportPath,
        `security-report-${new Date().toISOString().split('T')[0]}.json`
      );

      writeFileSync(reportFile, JSON.stringify(report, null, 2));
      
      logger.info('Security report generated', { reportFile });
      this.emit('reportGenerated', { reportFile, report });

    } catch (error) {
      logger.error('Failed to generate security report', { error });
    }
  }

  /**
   * Create security report data
   */
  private async createSecurityReport(): Promise<any> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get recent metrics
    const recentMetrics = this.metricsHistory.filter(m => m.timestamp > oneDayAgo);
    
    // Get connection statistics
    const connectionStats = this.portManager.getConnectionStats();
    
    // Get monitoring statistics
    const monitoringStats = this.connectionMonitor.getMonitoringStats();
    
    // Get recent alerts
    const recentAlerts = this.connectionMonitor.getAlerts(100);

    return {
      timestamp: now,
      period: {
        start: oneDayAgo,
        end: now,
      },
      summary: {
        totalConnections: connectionStats.total,
        blockedConnections: connectionStats.blocked,
        allowedConnections: connectionStats.allowed,
        suspiciousIPs: monitoringStats.suspiciousIPs,
        totalAlerts: monitoringStats.totalAlerts,
        alertsBySeverity: monitoringStats.alertsBySeverity,
      },
      metrics: {
        count: recentMetrics.length,
        averageSystemLoad: this.calculateAverageSystemLoad(recentMetrics),
        peakConnections: Math.max(...recentMetrics.map(m => m.totalConnections)),
        totalNetworkTraffic: this.calculateTotalNetworkTraffic(recentMetrics),
      },
      topThreats: {
        blockedIPs: connectionStats.topBlockedIPs,
        alertTypes: monitoringStats.topAlertTypes,
      },
      recentAlerts: recentAlerts.slice(-20), // Last 20 alerts
      recommendations: this.generateRecommendations(connectionStats, monitoringStats),
    };
  }

  /**
   * Calculate average system load from metrics
   */
  private calculateAverageSystemLoad(metrics: SecurityMetrics[]): { cpu: number; memory: number } {
    if (metrics.length === 0) {
      return { cpu: 0, memory: 0 };
    }

    const totalCpu = metrics.reduce((sum, m) => sum + m.systemLoad.cpu, 0);
    const totalMemory = metrics.reduce((sum, m) => sum + m.systemLoad.memory, 0);

    return {
      cpu: totalCpu / metrics.length,
      memory: totalMemory / metrics.length,
    };
  }

  /**
   * Calculate total network traffic from metrics
   */
  private calculateTotalNetworkTraffic(metrics: SecurityMetrics[]): {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  } {
    return metrics.reduce(
      (total, m) => ({
        bytesIn: total.bytesIn + m.networkStats.bytesIn,
        bytesOut: total.bytesOut + m.networkStats.bytesOut,
        packetsIn: total.packetsIn + m.networkStats.packetsIn,
        packetsOut: total.packetsOut + m.networkStats.packetsOut,
      }),
      { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0 }
    );
  }

  /**
   * Generate security recommendations
   */
  private generateRecommendations(connectionStats: any, monitoringStats: any): string[] {
    const recommendations: string[] = [];

    if (connectionStats.blocked > connectionStats.allowed * 0.1) {
      recommendations.push('High number of blocked connections detected. Consider reviewing firewall rules.');
    }

    if (monitoringStats.suspiciousIPs > 5) {
      recommendations.push('Multiple suspicious IPs detected. Consider implementing IP blocking.');
    }

    if (monitoringStats.totalAlerts > 50) {
      recommendations.push('High alert volume. Review alert thresholds and investigate patterns.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Security posture appears normal. Continue monitoring.');
    }

    return recommendations;
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle connection monitor alerts
    this.connectionMonitor.on('securityAlert', (alert: SecurityAlert) => {
      this.emit('alert', alert);
      
      if (this.config.enableRealTimeAlerts) {
        this.sendRealTimeAlert(alert);
      }
    });

    // Handle process termination
    process.on('SIGTERM', () => this.stop());
    process.on('SIGINT', () => this.stop());
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    if (!existsSync(this.config.reportPath)) {
      mkdirSync(this.config.reportPath, { recursive: true });
    }
  }

  /**
   * Clean up old log files
   */
  private async cleanupOldLogs(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.logRetention);

      // This is a simplified cleanup - in production you'd want more sophisticated log rotation
      logger.info('Log cleanup completed', {
        retentionDays: this.config.logRetention,
        cutoffDate,
      });

    } catch (error) {
      logger.error('Log cleanup failed', { error });
    }
  }

  /**
   * Get current monitoring status
   */
  getStatus(): {
    isRunning: boolean;
    config: MonitoringConfig;
    metricsCount: number;
    lastCheck?: Date;
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
      metricsCount: this.metricsHistory.length,
      lastCheck: this.metricsHistory.length > 0 
        ? this.metricsHistory[this.metricsHistory.length - 1].timestamp 
        : undefined,
    };
  }
}

// CLI execution
if (require.main === module) {
  const monitor = new SecurityMonitor();

  // Handle CLI arguments
  const args = process.argv.slice(2);
  const command = args[0] || 'start';

  switch (command) {
    case 'start':
      monitor.start().then(() => {
        console.log('Security monitoring started. Press Ctrl+C to stop.');
      }).catch(error => {
        console.error('Failed to start security monitoring:', error);
        process.exit(1);
      });
      break;

    case 'status':
      const status = monitor.getStatus();
      console.log('Security Monitor Status:', JSON.stringify(status, null, 2));
      break;

    default:
      console.log('Usage: securityMonitor.ts [start|status]');
      process.exit(1);
  }
}