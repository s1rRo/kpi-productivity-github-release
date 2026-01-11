#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import { platform } from 'os';
import { logger } from '../utils/logger';
import { FirewallManager } from '../services/firewallManager';
import { PortManager } from '../services/portManager';

const execAsync = promisify(exec);

export interface SecurityValidationResult {
  valid: boolean;
  issues: string[];
  warnings: string[];
  recommendations: string[];
  platform: string;
  timestamp: Date;
}

export class SecurityValidator {
  private firewallManager: FirewallManager;
  private portManager: PortManager;
  private currentPlatform: string;

  constructor() {
    this.firewallManager = new FirewallManager();
    this.portManager = new PortManager();
    this.currentPlatform = platform();
  }

  /**
   * Run comprehensive security validation
   */
  async validateSecurity(): Promise<SecurityValidationResult> {
    const result: SecurityValidationResult = {
      valid: true,
      issues: [],
      warnings: [],
      recommendations: [],
      platform: this.currentPlatform,
      timestamp: new Date(),
    };

    logger.info('Starting comprehensive security validation');

    try {
      // Validate firewall configuration
      await this.validateFirewallConfiguration(result);

      // Validate port accessibility
      await this.validatePortAccessibility(result);

      // Validate network configuration
      await this.validateNetworkConfiguration(result);

      // Validate system security settings
      await this.validateSystemSecurity(result);

      // Check for security vulnerabilities
      await this.checkSecurityVulnerabilities(result);

      result.valid = result.issues.length === 0;

      logger.info('Security validation completed', {
        valid: result.valid,
        issuesCount: result.issues.length,
        warningsCount: result.warnings.length,
      });

    } catch (error) {
      logger.error('Security validation failed', { error });
      result.valid = false;
      result.issues.push(`Validation error: ${error}`);
    }

    return result;
  }

  /**
   * Validate firewall configuration
   */
  private async validateFirewallConfiguration(result: SecurityValidationResult): Promise<void> {
    logger.info('Validating firewall configuration');

    try {
      const firewallStatus = await this.firewallManager.validateConfiguration();
      
      if (!firewallStatus.valid) {
        result.issues.push(...firewallStatus.issues);
      }

      // Platform-specific firewall checks
      switch (this.currentPlatform) {
        case 'linux':
          await this.validateLinuxFirewall(result);
          break;
        case 'darwin':
          await this.validateMacOSFirewall(result);
          break;
        case 'win32':
          await this.validateWindowsFirewall(result);
          break;
        default:
          result.warnings.push(`Firewall validation not implemented for platform: ${this.currentPlatform}`);
      }

    } catch (error) {
      result.issues.push(`Firewall validation failed: ${error}`);
    }
  }

  /**
   * Validate Linux firewall (iptables)
   */
  private async validateLinuxFirewall(result: SecurityValidationResult): Promise<void> {
    try {
      // Check if iptables is available
      await execAsync('which iptables');

      // Check default policies
      const { stdout: policies } = await execAsync('sudo iptables -L | head -10');
      
      if (!policies.includes('DROP')) {
        result.issues.push('Default DROP policy not found in iptables');
      }

      // Check for localhost:30002 rule
      const { stdout: rules } = await execAsync('sudo iptables -L -n');
      
      if (!rules.includes('30002')) {
        result.issues.push('Port 30002 rule not found in iptables');
      }

      // Check if rules are persistent
      try {
        await execAsync('ls /etc/iptables/rules.v4');
        result.recommendations.push('iptables rules appear to be persistent');
      } catch {
        result.warnings.push('iptables rules may not be persistent across reboots');
        result.recommendations.push('Consider saving iptables rules with: sudo iptables-save > /etc/iptables/rules.v4');
      }

    } catch (error) {
      result.warnings.push('Cannot validate Linux firewall (may require sudo access)');
    }
  }

  /**
   * Validate macOS firewall (pfctl)
   */
  private async validateMacOSFirewall(result: SecurityValidationResult): Promise<void> {
    try {
      // Check if pfctl is available
      await execAsync('which pfctl');

      // Check if pfctl is enabled
      const { stdout: status } = await execAsync('sudo pfctl -s info');
      
      if (!status.includes('Status: Enabled')) {
        result.issues.push('pfctl firewall is not enabled');
      }

      // Check for port 30002 rules
      const { stdout: rules } = await execAsync('sudo pfctl -s rules');
      
      if (!rules.includes('30002')) {
        result.warnings.push('Port 30002 rule not found in pfctl (may be configured differently)');
      }

    } catch (error) {
      result.warnings.push('Cannot validate macOS firewall (may require sudo access or manual configuration)');
      result.recommendations.push('Consider manually configuring pfctl or using built-in macOS firewall');
    }
  }

  /**
   * Validate Windows firewall
   */
  private async validateWindowsFirewall(result: SecurityValidationResult): Promise<void> {
    try {
      // Check Windows Firewall status
      const { stdout: status } = await execAsync('netsh advfirewall show allprofiles state');
      
      if (!status.includes('ON')) {
        result.issues.push('Windows Firewall is not enabled on all profiles');
      }

      // Check for KPI Gateway rule
      const { stdout: rules } = await execAsync('netsh advfirewall firewall show rule name="KPI Gateway"');
      
      if (!rules.includes('KPI Gateway')) {
        result.issues.push('KPI Gateway firewall rule not found');
      }

    } catch (error) {
      result.warnings.push('Cannot validate Windows firewall (may require administrator privileges)');
    }
  }

  /**
   * Validate port accessibility
   */
  private async validatePortAccessibility(result: SecurityValidationResult): Promise<void> {
    logger.info('Validating port accessibility');

    try {
      const portStatuses = await this.portManager.getPortStatus();
      
      // Check if port 30002 is open
      const gatewayPort = portStatuses.find(p => p.port === 30002);
      
      if (!gatewayPort || gatewayPort.status !== 'open') {
        result.issues.push('Gateway port 30002 is not accessible');
      }

      // Check for unauthorized open ports
      await this.checkUnauthorizedPorts(result);

    } catch (error) {
      result.issues.push(`Port accessibility validation failed: ${error}`);
    }
  }

  /**
   * Check for unauthorized open ports
   */
  private async checkUnauthorizedPorts(result: SecurityValidationResult): Promise<void> {
    try {
      // Get list of listening ports
      const { stdout } = await execAsync('netstat -an | grep LISTEN || ss -ln | grep LISTEN');
      
      const lines = stdout.split('\n').filter(line => line.trim());
      const openPorts: number[] = [];

      for (const line of lines) {
        const match = line.match(/:(\d+)\s/);
        if (match) {
          const port = parseInt(match[1], 10);
          if (port > 1024) { // Focus on non-system ports
            openPorts.push(port);
          }
        }
      }

      // Check for unexpected open ports
      const allowedPorts = [30002, 3000, 3001]; // Gateway, frontend, backend
      const unauthorizedPorts = openPorts.filter(port => !allowedPorts.includes(port));

      if (unauthorizedPorts.length > 0) {
        result.warnings.push(`Unexpected open ports detected: ${unauthorizedPorts.join(', ')}`);
        result.recommendations.push('Review and close unnecessary open ports');
      }

    } catch (error) {
      result.warnings.push('Could not check for unauthorized ports');
    }
  }

  /**
   * Validate network configuration
   */
  private async validateNetworkConfiguration(result: SecurityValidationResult): Promise<void> {
    logger.info('Validating network configuration');

    try {
      // Check if services are bound to localhost only
      await this.checkServiceBinding(result);

      // Check network interfaces
      await this.checkNetworkInterfaces(result);

    } catch (error) {
      result.warnings.push(`Network configuration validation failed: ${error}`);
    }
  }

  /**
   * Check if services are properly bound to localhost
   */
  private async checkServiceBinding(result: SecurityValidationResult): Promise<void> {
    try {
      const { stdout } = await execAsync('netstat -an | grep :30002 || ss -an | grep :30002');
      
      if (stdout.includes('0.0.0.0:30002') || stdout.includes('*:30002')) {
        result.issues.push('Gateway is bound to all interfaces instead of localhost only');
      } else if (stdout.includes('127.0.0.1:30002')) {
        result.recommendations.push('Gateway is properly bound to localhost');
      }

    } catch (error) {
      result.warnings.push('Could not verify service binding');
    }
  }

  /**
   * Check network interfaces
   */
  private async checkNetworkInterfaces(result: SecurityValidationResult): Promise<void> {
    try {
      let command = 'ifconfig';
      
      // Use ip command on Linux if available
      if (this.currentPlatform === 'linux') {
        try {
          await execAsync('which ip');
          command = 'ip addr show';
        } catch {
          // Fall back to ifconfig
        }
      }

      const { stdout } = await execAsync(command);
      
      // Check for suspicious network interfaces
      if (stdout.includes('docker') || stdout.includes('veth')) {
        result.warnings.push('Docker or virtual network interfaces detected');
        result.recommendations.push('Ensure Docker containers are properly secured');
      }

    } catch (error) {
      result.warnings.push('Could not check network interfaces');
    }
  }

  /**
   * Validate system security settings
   */
  private async validateSystemSecurity(result: SecurityValidationResult): Promise<void> {
    logger.info('Validating system security settings');

    try {
      // Check system-specific security settings
      switch (this.currentPlatform) {
        case 'linux':
          await this.validateLinuxSecurity(result);
          break;
        case 'darwin':
          await this.validateMacOSSecurity(result);
          break;
        case 'win32':
          await this.validateWindowsSecurity(result);
          break;
      }

    } catch (error) {
      result.warnings.push(`System security validation failed: ${error}`);
    }
  }

  /**
   * Validate Linux system security
   */
  private async validateLinuxSecurity(result: SecurityValidationResult): Promise<void> {
    try {
      // Check if SELinux is enabled (if available)
      try {
        const { stdout } = await execAsync('getenforce');
        if (stdout.trim() === 'Disabled') {
          result.warnings.push('SELinux is disabled');
          result.recommendations.push('Consider enabling SELinux for additional security');
        }
      } catch {
        // SELinux not available, skip
      }

      // Check for fail2ban (if available)
      try {
        await execAsync('which fail2ban-client');
        result.recommendations.push('fail2ban is available for additional protection');
      } catch {
        result.recommendations.push('Consider installing fail2ban for intrusion prevention');
      }

    } catch (error) {
      result.warnings.push('Could not validate Linux security settings');
    }
  }

  /**
   * Validate macOS system security
   */
  private async validateMacOSSecurity(result: SecurityValidationResult): Promise<void> {
    try {
      // Check System Integrity Protection (SIP)
      try {
        const { stdout } = await execAsync('csrutil status');
        if (stdout.includes('disabled')) {
          result.warnings.push('System Integrity Protection (SIP) is disabled');
          result.recommendations.push('Consider enabling SIP for additional security');
        }
      } catch {
        result.warnings.push('Could not check System Integrity Protection status');
      }

      // Check Gatekeeper status
      try {
        const { stdout } = await execAsync('spctl --status');
        if (stdout.includes('disabled')) {
          result.warnings.push('Gatekeeper is disabled');
          result.recommendations.push('Consider enabling Gatekeeper for application security');
        }
      } catch {
        result.warnings.push('Could not check Gatekeeper status');
      }

    } catch (error) {
      result.warnings.push('Could not validate macOS security settings');
    }
  }

  /**
   * Validate Windows system security
   */
  private async validateWindowsSecurity(result: SecurityValidationResult): Promise<void> {
    try {
      // Check Windows Defender status
      try {
        const { stdout } = await execAsync('powershell "Get-MpComputerStatus | Select-Object AntivirusEnabled"');
        if (stdout.includes('False')) {
          result.warnings.push('Windows Defender antivirus is disabled');
          result.recommendations.push('Ensure antivirus protection is enabled');
        }
      } catch {
        result.warnings.push('Could not check Windows Defender status');
      }

    } catch (error) {
      result.warnings.push('Could not validate Windows security settings');
    }
  }

  /**
   * Check for common security vulnerabilities
   */
  private async checkSecurityVulnerabilities(result: SecurityValidationResult): Promise<void> {
    logger.info('Checking for security vulnerabilities');

    try {
      // Check for default passwords or weak configurations
      await this.checkWeakConfigurations(result);

      // Check for outdated dependencies (if package.json exists)
      await this.checkOutdatedDependencies(result);

    } catch (error) {
      result.warnings.push(`Vulnerability check failed: ${error}`);
    }
  }

  /**
   * Check for weak configurations
   */
  private async checkWeakConfigurations(result: SecurityValidationResult): Promise<void> {
    // Check environment variables for sensitive data
    const sensitiveEnvVars = ['PASSWORD', 'SECRET', 'KEY', 'TOKEN'];
    
    for (const envVar of sensitiveEnvVars) {
      if (process.env[envVar] && (
        process.env[envVar] === 'password' ||
        process.env[envVar] === 'secret' ||
        process.env[envVar] === '123456' ||
        process.env[envVar]!.length < 8
      )) {
        result.warnings.push(`Weak ${envVar} detected in environment variables`);
        result.recommendations.push(`Use strong, unique values for ${envVar}`);
      }
    }
  }

  /**
   * Check for outdated dependencies
   */
  private async checkOutdatedDependencies(result: SecurityValidationResult): Promise<void> {
    try {
      // Check if npm audit is available
      await execAsync('which npm');
      
      const { stdout } = await execAsync('npm audit --json', { cwd: process.cwd() });
      const auditResult = JSON.parse(stdout);
      
      if (auditResult.metadata && auditResult.metadata.vulnerabilities) {
        const vulns = auditResult.metadata.vulnerabilities;
        const total = vulns.high + vulns.critical + vulns.moderate + vulns.low;
        
        if (total > 0) {
          result.warnings.push(`${total} npm security vulnerabilities found`);
          result.recommendations.push('Run "npm audit fix" to address vulnerabilities');
        }
      }

    } catch (error) {
      // npm audit might not be available or might fail, don't treat as error
      result.recommendations.push('Consider running npm audit to check for vulnerabilities');
    }
  }

  /**
   * Generate security report
   */
  generateReport(validationResult: SecurityValidationResult): string {
    const report = [
      '='.repeat(60),
      'SECURITY VALIDATION REPORT',
      '='.repeat(60),
      `Platform: ${validationResult.platform}`,
      `Timestamp: ${validationResult.timestamp.toISOString()}`,
      `Overall Status: ${validationResult.valid ? '✅ PASSED' : '❌ FAILED'}`,
      '',
    ];

    if (validationResult.issues.length > 0) {
      report.push('🚨 CRITICAL ISSUES:');
      validationResult.issues.forEach((issue, index) => {
        report.push(`  ${index + 1}. ${issue}`);
      });
      report.push('');
    }

    if (validationResult.warnings.length > 0) {
      report.push('⚠️  WARNINGS:');
      validationResult.warnings.forEach((warning, index) => {
        report.push(`  ${index + 1}. ${warning}`);
      });
      report.push('');
    }

    if (validationResult.recommendations.length > 0) {
      report.push('💡 RECOMMENDATIONS:');
      validationResult.recommendations.forEach((rec, index) => {
        report.push(`  ${index + 1}. ${rec}`);
      });
      report.push('');
    }

    report.push('='.repeat(60));
    
    return report.join('\n');
  }
}

// CLI execution
if (require.main === module) {
  const validator = new SecurityValidator();
  
  validator.validateSecurity()
    .then(result => {
      const report = validator.generateReport(result);
      console.log(report);
      
      // Exit with error code if validation failed
      process.exit(result.valid ? 0 : 1);
    })
    .catch(error => {
      console.error('Security validation failed:', error);
      process.exit(1);
    });
}