import { Router, Request, Response } from 'express';
import { PortManager } from '../services/portManager';
import { ConnectionMonitor } from '../services/connectionMonitor';
import { FirewallManager } from '../services/firewallManager';
import { AccessLogger } from '../services/accessLogger';
import { SecurityAuditor } from '../services/securityAuditor';
import { logger } from '../utils/logger';

const router = Router();

// Initialize services (these would be injected in a real application)
let portManager: PortManager;
let connectionMonitor: ConnectionMonitor;
let firewallManager: FirewallManager;
let accessLogger: AccessLogger;
let securityAuditor: SecurityAuditor;

export const initializeSecurityRoutes = (
  pm: PortManager,
  cm: ConnectionMonitor,
  fm: FirewallManager,
  al: AccessLogger,
  sa: SecurityAuditor
) => {
  portManager = pm;
  connectionMonitor = cm;
  firewallManager = fm;
  accessLogger = al;
  securityAuditor = sa;
};

// Get port status
router.get('/ports/status', async (req: Request, res: Response) => {
  try {
    const portStatus = await portManager.getPortStatus();
    res.json({
      ports: portStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get port status', { error });
    res.status(500).json({
      error: 'Failed to retrieve port status',
      timestamp: new Date().toISOString(),
    });
  }
});

// Get connection logs
router.get('/connections/log', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const connectionLog = portManager.getConnectionLog(limit);
    
    res.json({
      connections: connectionLog,
      total: connectionLog.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get connection log', { error });
    res.status(500).json({
      error: 'Failed to retrieve connection log',
      timestamp: new Date().toISOString(),
    });
  }
});

// Get connection statistics
router.get('/connections/stats', (req: Request, res: Response) => {
  try {
    const stats = portManager.getConnectionStats();
    res.json({
      ...stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get connection stats', { error });
    res.status(500).json({
      error: 'Failed to retrieve connection statistics',
      timestamp: new Date().toISOString(),
    });
  }
});

// Get security alerts
router.get('/alerts', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const severity = req.query.severity as string;
    
    let alerts;
    if (severity) {
      alerts = connectionMonitor.getAlertsBySeverity(severity as any);
    } else {
      alerts = connectionMonitor.getAlerts(limit);
    }
    
    res.json({
      alerts,
      total: alerts.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get security alerts', { error });
    res.status(500).json({
      error: 'Failed to retrieve security alerts',
      timestamp: new Date().toISOString(),
    });
  }
});

// Get monitoring statistics
router.get('/monitoring/stats', (req: Request, res: Response) => {
  try {
    const stats = connectionMonitor.getMonitoringStats();
    res.json({
      ...stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get monitoring stats', { error });
    res.status(500).json({
      error: 'Failed to retrieve monitoring statistics',
      timestamp: new Date().toISOString(),
    });
  }
});

// Get firewall status
router.get('/firewall/status', async (req: Request, res: Response) => {
  try {
    const status = await firewallManager.getFirewallStatus();
    res.json(status);
  } catch (error) {
    logger.error('Failed to get firewall status', { error });
    res.status(500).json({
      error: 'Failed to retrieve firewall status',
      timestamp: new Date().toISOString(),
    });
  }
});

// Validate firewall configuration
router.get('/firewall/validate', async (req: Request, res: Response) => {
  try {
    const validation = await firewallManager.validateConfiguration();
    res.json({
      ...validation,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to validate firewall', { error });
    res.status(500).json({
      error: 'Failed to validate firewall configuration',
      timestamp: new Date().toISOString(),
    });
  }
});

// Reconfigure firewall (POST request for security)
router.post('/firewall/configure', async (req: Request, res: Response) => {
  try {
    logger.info('Firewall reconfiguration requested', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    
    await firewallManager.configureSecureFirewall();
    
    res.json({
      success: true,
      message: 'Firewall reconfigured successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to reconfigure firewall', { error });
    res.status(500).json({
      error: 'Failed to reconfigure firewall',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Security dashboard endpoint
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const [portStatus, connectionStats, monitoringStats, firewallStatus] = await Promise.all([
      portManager.getPortStatus(),
      portManager.getConnectionStats(),
      connectionMonitor.getMonitoringStats(),
      firewallManager.getFirewallStatus(),
    ]);

    const recentAlerts = connectionMonitor.getAlerts(10);
    const accessStats = accessLogger.getStats();
    const auditEvents = securityAuditor.getAuditEvents(10);

    res.json({
      dashboard: {
        ports: portStatus,
        connections: connectionStats,
        monitoring: monitoringStats,
        firewall: {
          enabled: firewallStatus.enabled,
          platform: firewallStatus.platform,
          rulesCount: firewallStatus.rules.length,
        },
        access: {
          totalRequests: accessStats.totalRequests,
          blockedRequests: accessStats.blockedRequests,
          uniqueIPs: accessStats.uniqueIPs,
          threatDistribution: accessStats.threatLevelDistribution,
        },
        recentAlerts,
        recentAuditEvents: auditEvents,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get security dashboard', { error });
    res.status(500).json({
      error: 'Failed to retrieve security dashboard',
      timestamp: new Date().toISOString(),
    });
  }
});

// Access log endpoints
router.get('/access/logs', (req: Request, res: Response) => {
  try {
    const query = {
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      sourceIP: req.query.sourceIP as string,
      action: req.query.action as any,
      threatLevel: req.query.threatLevel as any,
      limit: parseInt(req.query.limit as string) || 100,
      offset: parseInt(req.query.offset as string) || 0,
    };

    const logs = accessLogger.queryLogs(query);
    
    res.json({
      logs,
      total: logs.length,
      query,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get access logs', { error });
    res.status(500).json({
      error: 'Failed to retrieve access logs',
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/access/stats', (req: Request, res: Response) => {
  try {
    const timeRange = req.query.startDate && req.query.endDate ? {
      start: new Date(req.query.startDate as string),
      end: new Date(req.query.endDate as string),
    } : undefined;

    const stats = accessLogger.getStats(timeRange);
    
    res.json({
      ...stats,
      timeRange,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get access stats', { error });
    res.status(500).json({
      error: 'Failed to retrieve access statistics',
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/access/report', (req: Request, res: Response) => {
  try {
    const timeRange = req.query.startDate && req.query.endDate ? {
      start: new Date(req.query.startDate as string),
      end: new Date(req.query.endDate as string),
    } : undefined;

    const report = accessLogger.generateSecurityReport(timeRange);
    
    res.json(report);
  } catch (error) {
    logger.error('Failed to generate access report', { error });
    res.status(500).json({
      error: 'Failed to generate access report',
      timestamp: new Date().toISOString(),
    });
  }
});

// Audit endpoints
router.get('/audit/events', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const type = req.query.type as string;
    const severity = req.query.severity as string;

    let events;
    if (type) {
      events = securityAuditor.getAuditEventsByType(type as any);
    } else if (severity) {
      events = securityAuditor.getAuditEventsBySeverity(severity as any);
    } else {
      events = securityAuditor.getAuditEvents(limit);
    }
    
    res.json({
      events,
      total: events.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get audit events', { error });
    res.status(500).json({
      error: 'Failed to retrieve audit events',
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/audit/compliance', async (req: Request, res: Response) => {
  try {
    const complianceChecks = await securityAuditor.performComplianceCheck();
    
    const summary = {
      totalChecks: complianceChecks.length,
      passed: complianceChecks.filter(c => c.status === 'PASS').length,
      failed: complianceChecks.filter(c => c.status === 'FAIL').length,
      warnings: complianceChecks.filter(c => c.status === 'WARNING').length,
      score: Math.round((complianceChecks.filter(c => c.status === 'PASS').length / complianceChecks.length) * 100),
    };
    
    res.json({
      summary,
      checks: complianceChecks,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to perform compliance check', { error });
    res.status(500).json({
      error: 'Failed to perform compliance check',
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/audit/report', async (req: Request, res: Response) => {
  try {
    const period = req.query.startDate && req.query.endDate ? {
      start: new Date(req.query.startDate as string),
      end: new Date(req.query.endDate as string),
    } : undefined;

    const report = await securityAuditor.generateAuditReport(period);
    
    res.json(report);
  } catch (error) {
    logger.error('Failed to generate audit report', { error });
    res.status(500).json({
      error: 'Failed to generate audit report',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;