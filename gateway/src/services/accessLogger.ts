import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';

export interface AccessLogEntry {
  id: string;
  timestamp: Date;
  sourceIP: string;
  targetPort: number;
  protocol: string;
  method?: string;
  path?: string;
  userAgent?: string;
  action: 'ALLOWED' | 'BLOCKED' | 'RATE_LIMITED';
  reason?: string;
  responseCode?: number;
  responseTime?: number;
  bytesTransferred?: number;
  sessionId?: string;
  userId?: string;
  geoLocation?: {
    country?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  metadata?: Record<string, any>;
}

export interface AccessLogQuery {
  startDate?: Date;
  endDate?: Date;
  sourceIP?: string;
  action?: 'ALLOWED' | 'BLOCKED' | 'RATE_LIMITED';
  threatLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  limit?: number;
  offset?: number;
}

export interface AccessLogStats {
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  rateLimitedRequests: number;
  uniqueIPs: number;
  topIPs: Array<{ ip: string; count: number; threatLevel: string }>;
  topPaths: Array<{ path: string; count: number }>;
  threatLevelDistribution: Record<string, number>;
  hourlyDistribution: Record<string, number>;
  responseCodeDistribution: Record<string, number>;
  averageResponseTime: number;
  totalBytesTransferred: number;
}

export class AccessLogger {
  private logPath: string;
  private maxLogSize: number;
  private rotationCount: number;
  private logBuffer: AccessLogEntry[] = [];
  private bufferSize: number = 100;
  private flushInterval: NodeJS.Timeout;

  constructor(
    logPath: string = './logs/access',
    maxLogSize: number = 100 * 1024 * 1024, // 100MB
    rotationCount: number = 10
  ) {
    this.logPath = logPath;
    this.maxLogSize = maxLogSize;
    this.rotationCount = rotationCount;

    this.ensureLogDirectory();
    
    // Flush buffer every 10 seconds
    this.flushInterval = setInterval(() => {
      this.flushBuffer();
    }, 10000);

    // Handle process termination
    process.on('SIGTERM', () => this.flushBuffer());
    process.on('SIGINT', () => this.flushBuffer());
  }

  /**
   * Log an access attempt
   */
  logAccess(entry: Omit<AccessLogEntry, 'id' | 'timestamp' | 'threatLevel'>): void {
    const logEntry: AccessLogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      threatLevel: this.calculateThreatLevel(entry),
      ...entry,
    };

    // Add to buffer
    this.logBuffer.push(logEntry);

    // Flush buffer if it's full
    if (this.logBuffer.length >= this.bufferSize) {
      this.flushBuffer();
    }

    // Log high-threat entries immediately to console
    if (logEntry.threatLevel === 'HIGH' || logEntry.threatLevel === 'CRITICAL') {
      logger.warn('High-threat access attempt', logEntry);
    }
  }

  /**
   * Calculate threat level based on entry characteristics
   */
  private calculateThreatLevel(entry: Omit<AccessLogEntry, 'id' | 'timestamp' | 'threatLevel'>): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    let score = 0;

    // Action-based scoring
    if (entry.action === 'BLOCKED') score += 3;
    if (entry.action === 'RATE_LIMITED') score += 2;

    // Response code-based scoring
    if (entry.responseCode && entry.responseCode >= 400) score += 1;
    if (entry.responseCode && entry.responseCode >= 500) score += 2;

    // User agent-based scoring
    if (entry.userAgent) {
      const suspiciousPatterns = [
        /bot/i, /crawler/i, /spider/i, /scraper/i,
        /nmap/i, /masscan/i, /sqlmap/i, /nikto/i,
        /curl/i, /wget/i, /python-requests/i
      ];
      
      if (suspiciousPatterns.some(pattern => pattern.test(entry.userAgent!))) {
        score += 2;
      }
    }

    // Path-based scoring
    if (entry.path) {
      const suspiciousPaths = [
        /admin/i, /wp-admin/i, /phpmyadmin/i,
        /\.php$/i, /\.asp$/i, /\.jsp$/i,
        /\/etc\/passwd/i, /\/proc\//i,
        /\.\./i, // Path traversal
      ];
      
      if (suspiciousPaths.some(pattern => pattern.test(entry.path!))) {
        score += 3;
      }
    }

    // Reason-based scoring
    if (entry.reason) {
      if (entry.reason.includes('port scan')) score += 4;
      if (entry.reason.includes('brute force')) score += 3;
      if (entry.reason.includes('injection')) score += 4;
    }

    // Convert score to threat level
    if (score >= 6) return 'CRITICAL';
    if (score >= 4) return 'HIGH';
    if (score >= 2) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Flush log buffer to file
   */
  private flushBuffer(): void {
    if (this.logBuffer.length === 0) return;

    try {
      const logFile = join(this.logPath, 'access.jsonl');
      const logLines = this.logBuffer.map(entry => JSON.stringify(entry)).join('\n') + '\n';

      // Check if log rotation is needed
      if (existsSync(logFile)) {
        const stats = require('fs').statSync(logFile);
        if (stats.size + Buffer.byteLength(logLines) > this.maxLogSize) {
          this.rotateLog();
        }
      }

      // Append to log file
      writeFileSync(logFile, logLines, { flag: 'a' });

      logger.debug(`Flushed ${this.logBuffer.length} access log entries`);
      this.logBuffer = [];

    } catch (error) {
      logger.error('Failed to flush access log buffer', { error });
    }
  }

  /**
   * Rotate log files
   */
  private rotateLog(): void {
    try {
      const logFile = join(this.logPath, 'access.jsonl');
      
      // Rotate existing files
      for (let i = this.rotationCount - 1; i >= 1; i--) {
        const oldFile = join(this.logPath, `access.jsonl.${i}`);
        const newFile = join(this.logPath, `access.jsonl.${i + 1}`);
        
        if (existsSync(oldFile)) {
          require('fs').renameSync(oldFile, newFile);
        }
      }

      // Move current log to .1
      if (existsSync(logFile)) {
        require('fs').renameSync(logFile, join(this.logPath, 'access.jsonl.1'));
      }

      logger.info('Access log rotated');

    } catch (error) {
      logger.error('Failed to rotate access log', { error });
    }
  }

  /**
   * Query access logs
   */
  queryLogs(query: AccessLogQuery = {}): AccessLogEntry[] {
    const results: AccessLogEntry[] = [];
    const logFile = join(this.logPath, 'access.jsonl');

    try {
      if (!existsSync(logFile)) {
        return results;
      }

      const logContent = readFileSync(logFile, 'utf-8');
      const lines = logContent.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const entry: AccessLogEntry = JSON.parse(line);
          
          // Apply filters
          if (query.startDate && new Date(entry.timestamp) < query.startDate) continue;
          if (query.endDate && new Date(entry.timestamp) > query.endDate) continue;
          if (query.sourceIP && entry.sourceIP !== query.sourceIP) continue;
          if (query.action && entry.action !== query.action) continue;
          if (query.threatLevel && entry.threatLevel !== query.threatLevel) continue;

          results.push(entry);
        } catch (parseError) {
          logger.debug('Failed to parse log line', { line, parseError });
        }
      }

      // Apply pagination
      const offset = query.offset || 0;
      const limit = query.limit || 1000;
      
      return results.slice(offset, offset + limit);

    } catch (error) {
      logger.error('Failed to query access logs', { error, query });
      return results;
    }
  }

  /**
   * Get access log statistics
   */
  getStats(timeRange?: { start: Date; end: Date }): AccessLogStats {
    const logs = this.queryLogs({
      startDate: timeRange?.start,
      endDate: timeRange?.end,
      limit: 10000, // Limit for performance
    });

    const stats: AccessLogStats = {
      totalRequests: logs.length,
      allowedRequests: 0,
      blockedRequests: 0,
      rateLimitedRequests: 0,
      uniqueIPs: 0,
      topIPs: [],
      topPaths: [],
      threatLevelDistribution: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
      hourlyDistribution: {},
      responseCodeDistribution: {},
      averageResponseTime: 0,
      totalBytesTransferred: 0,
    };

    if (logs.length === 0) return stats;

    const ipCounts: Record<string, { count: number; threatLevel: string }> = {};
    const pathCounts: Record<string, number> = {};
    const responseCodes: Record<string, number> = {};
    const hourlyData: Record<string, number> = {};
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    for (const log of logs) {
      // Action counts
      if (log.action === 'ALLOWED') stats.allowedRequests++;
      else if (log.action === 'BLOCKED') stats.blockedRequests++;
      else if (log.action === 'RATE_LIMITED') stats.rateLimitedRequests++;

      // IP tracking
      if (!ipCounts[log.sourceIP]) {
        ipCounts[log.sourceIP] = { count: 0, threatLevel: log.threatLevel };
      }
      ipCounts[log.sourceIP].count++;
      
      // Update threat level if higher
      const currentLevel = ipCounts[log.sourceIP].threatLevel;
      const newLevel = log.threatLevel;
      const levels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      if (levels.indexOf(newLevel) > levels.indexOf(currentLevel)) {
        ipCounts[log.sourceIP].threatLevel = newLevel;
      }

      // Path tracking
      if (log.path) {
        pathCounts[log.path] = (pathCounts[log.path] || 0) + 1;
      }

      // Threat level distribution
      stats.threatLevelDistribution[log.threatLevel]++;

      // Hourly distribution
      const hour = new Date(log.timestamp).getHours().toString();
      hourlyData[hour] = (hourlyData[hour] || 0) + 1;

      // Response code distribution
      if (log.responseCode) {
        const code = log.responseCode.toString();
        responseCodes[code] = (responseCodes[code] || 0) + 1;
      }

      // Response time
      if (log.responseTime) {
        totalResponseTime += log.responseTime;
        responseTimeCount++;
      }

      // Bytes transferred
      if (log.bytesTransferred) {
        stats.totalBytesTransferred += log.bytesTransferred;
      }
    }

    // Calculate derived stats
    stats.uniqueIPs = Object.keys(ipCounts).length;
    stats.averageResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;

    // Top IPs
    stats.topIPs = Object.entries(ipCounts)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10)
      .map(([ip, data]) => ({ ip, count: data.count, threatLevel: data.threatLevel }));

    // Top paths
    stats.topPaths = Object.entries(pathCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));

    // Hourly distribution
    stats.hourlyDistribution = hourlyData;

    // Response code distribution
    stats.responseCodeDistribution = responseCodes;

    return stats;
  }

  /**
   * Generate security report
   */
  generateSecurityReport(timeRange?: { start: Date; end: Date }): {
    summary: AccessLogStats;
    threats: AccessLogEntry[];
    recommendations: string[];
    timestamp: Date;
  } {
    const stats = this.getStats(timeRange);
    
    // Get high-threat entries
    const threats = this.queryLogs({
      startDate: timeRange?.start,
      endDate: timeRange?.end,
      threatLevel: 'HIGH',
      limit: 100,
    }).concat(
      this.queryLogs({
        startDate: timeRange?.start,
        endDate: timeRange?.end,
        threatLevel: 'CRITICAL',
        limit: 100,
      })
    );

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (stats.blockedRequests > stats.allowedRequests * 0.1) {
      recommendations.push('High number of blocked requests detected. Review firewall rules and consider IP blocking.');
    }
    
    if (stats.threatLevelDistribution.HIGH + stats.threatLevelDistribution.CRITICAL > 10) {
      recommendations.push('Multiple high-threat activities detected. Implement additional security measures.');
    }
    
    if (stats.uniqueIPs > 1000) {
      recommendations.push('High number of unique IPs. Consider implementing rate limiting per IP.');
    }
    
    if (stats.averageResponseTime > 5000) {
      recommendations.push('High average response time detected. Check for potential DoS attacks.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Security posture appears normal. Continue monitoring.');
    }

    return {
      summary: stats,
      threats,
      recommendations,
      timestamp: new Date(),
    };
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    if (!existsSync(this.logPath)) {
      mkdirSync(this.logPath, { recursive: true });
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `access_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushBuffer();
  }
}