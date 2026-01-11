import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

export interface PortStatus {
  port: number;
  host: string;
  status: 'open' | 'closed' | 'filtered';
  service?: string;
}

export interface ConnectionAttempt {
  id: string;
  timestamp: Date;
  sourceIP: string;
  targetPort: number;
  protocol: string;
  action: 'ALLOWED' | 'BLOCKED';
  reason?: string;
  userAgent?: string;
}

export class PortManager {
  private connectionLog: ConnectionAttempt[] = [];
  private allowedPorts: number[] = [30002];
  private allowedHosts: string[] = ['localhost', '127.0.0.1'];

  constructor() {
    this.startConnectionMonitoring();
  }

  /**
   * Get the current status of all monitored ports
   */
  async getPortStatus(): Promise<PortStatus[]> {
    const portStatuses: PortStatus[] = [];

    for (const port of this.allowedPorts) {
      try {
        const status = await this.checkPortStatus(port);
        portStatuses.push(status);
      } catch (error) {
        logger.error(`Failed to check port ${port} status`, { error, port });
        portStatuses.push({
          port,
          host: 'localhost',
          status: 'closed',
        });
      }
    }

    return portStatuses;
  }

  /**
   * Check if a specific port is open
   */
  private async checkPortStatus(port: number, host: string = 'localhost'): Promise<PortStatus> {
    try {
      // Use netstat to check if port is listening
      const { stdout } = await execAsync(`netstat -an | grep :${port}`);
      
      if (stdout.includes(`${host}:${port}`) || stdout.includes(`127.0.0.1:${port}`)) {
        return {
          port,
          host,
          status: 'open',
          service: 'kpi-gateway',
        };
      }
      
      return {
        port,
        host,
        status: 'closed',
      };
    } catch (error) {
      logger.debug(`Port ${port} check failed`, { error, port, host });
      return {
        port,
        host,
        status: 'closed',
      };
    }
  }

  /**
   * Log a connection attempt
   */
  logConnectionAttempt(attempt: Omit<ConnectionAttempt, 'id' | 'timestamp'>): void {
    const connectionAttempt: ConnectionAttempt = {
      id: this.generateId(),
      timestamp: new Date(),
      ...attempt,
    };

    this.connectionLog.push(connectionAttempt);

    // Keep only last 1000 connection attempts
    if (this.connectionLog.length > 1000) {
      this.connectionLog = this.connectionLog.slice(-1000);
    }

    logger.info('Connection attempt logged', connectionAttempt);
  }

  /**
   * Get recent connection attempts
   */
  getConnectionLog(limit: number = 100): ConnectionAttempt[] {
    return this.connectionLog.slice(-limit);
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    total: number;
    allowed: number;
    blocked: number;
    recentBlocked: number;
    topBlockedIPs: Array<{ ip: string; count: number }>;
  } {
    const total = this.connectionLog.length;
    const allowed = this.connectionLog.filter(c => c.action === 'ALLOWED').length;
    const blocked = this.connectionLog.filter(c => c.action === 'BLOCKED').length;
    
    // Recent blocked (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentBlocked = this.connectionLog.filter(
      c => c.action === 'BLOCKED' && c.timestamp > oneHourAgo
    ).length;

    // Top blocked IPs
    const blockedByIP = this.connectionLog
      .filter(c => c.action === 'BLOCKED')
      .reduce((acc, c) => {
        acc[c.sourceIP] = (acc[c.sourceIP] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const topBlockedIPs = Object.entries(blockedByIP)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }));

    return {
      total,
      allowed,
      blocked,
      recentBlocked,
      topBlockedIPs,
    };
  }

  /**
   * Check if a connection should be allowed
   */
  isConnectionAllowed(sourceIP: string, targetPort: number): boolean {
    // Only allow connections to port 30002
    if (!this.allowedPorts.includes(targetPort)) {
      return false;
    }

    // For now, allow all IPs to connect to the gateway port
    // In production, you might want to add IP whitelisting
    return true;
  }

  /**
   * Start monitoring connections (placeholder for actual implementation)
   */
  private startConnectionMonitoring(): void {
    // This would typically integrate with system-level monitoring
    // For now, we'll rely on the Express middleware to log connections
    logger.info('Connection monitoring started');
  }

  /**
   * Generate a unique ID for connection attempts
   */
  private generateId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear old connection logs
   */
  clearOldLogs(olderThanHours: number = 24): void {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const originalLength = this.connectionLog.length;
    
    this.connectionLog = this.connectionLog.filter(c => c.timestamp > cutoffTime);
    
    const removedCount = originalLength - this.connectionLog.length;
    if (removedCount > 0) {
      logger.info(`Cleared ${removedCount} old connection log entries`);
    }
  }
}