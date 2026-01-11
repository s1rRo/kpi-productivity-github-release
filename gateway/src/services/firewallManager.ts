import { exec } from 'child_process';
import { promisify } from 'util';
import { platform } from 'os';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

export interface FirewallRule {
  id: string;
  action: 'ALLOW' | 'DENY';
  port: number;
  host: string;
  protocol: 'TCP' | 'UDP';
  priority: number;
  description?: string;
}

export interface FirewallStatus {
  enabled: boolean;
  rules: FirewallRule[];
  platform: string;
  lastUpdated: Date;
}

export class FirewallManager {
  private currentPlatform: string;
  private rules: FirewallRule[] = [];

  constructor() {
    this.currentPlatform = platform();
    logger.info(`Firewall manager initialized for platform: ${this.currentPlatform}`);
  }

  /**
   * Configure firewall to block all ports except localhost:30002
   */
  async configureSecureFirewall(): Promise<void> {
    try {
      logger.info('Configuring secure firewall rules');

      switch (this.currentPlatform) {
        case 'linux':
          await this.configureLinuxFirewall();
          break;
        case 'darwin':
          await this.configureMacOSFirewall();
          break;
        case 'win32':
          await this.configureWindowsFirewall();
          break;
        default:
          logger.warn(`Firewall configuration not supported for platform: ${this.currentPlatform}`);
          throw new Error(`Unsupported platform: ${this.currentPlatform}`);
      }

      logger.info('Firewall configuration completed successfully');
    } catch (error) {
      logger.error('Failed to configure firewall', { error, platform: this.currentPlatform });
      throw error;
    }
  }

  /**
   * Configure Linux firewall using iptables
   */
  private async configureLinuxFirewall(): Promise<void> {
    const commands = [
      // Flush existing rules
      'sudo iptables -F',
      'sudo iptables -X',
      'sudo iptables -t nat -F',
      'sudo iptables -t nat -X',
      
      // Set default policies
      'sudo iptables -P INPUT DROP',
      'sudo iptables -P FORWARD DROP',
      'sudo iptables -P OUTPUT ACCEPT',
      
      // Allow loopback traffic
      'sudo iptables -A INPUT -i lo -j ACCEPT',
      'sudo iptables -A OUTPUT -o lo -j ACCEPT',
      
      // Allow established and related connections
      'sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT',
      
      // Allow localhost:30002
      'sudo iptables -A INPUT -p tcp --dport 30002 -s 127.0.0.1 -j ACCEPT',
      'sudo iptables -A INPUT -p tcp --dport 30002 -s ::1 -j ACCEPT',
      
      // Log dropped packets (optional)
      'sudo iptables -A INPUT -j LOG --log-prefix "DROPPED: " --log-level 4',
      
      // Save rules (Ubuntu/Debian)
      'sudo iptables-save > /etc/iptables/rules.v4 || true',
    ];

    for (const command of commands) {
      try {
        await execAsync(command);
        logger.debug(`Executed: ${command}`);
      } catch (error) {
        logger.warn(`Command failed (may be expected): ${command}`, { error });
      }
    }

    this.rules = [
      {
        id: 'linux-allow-lo',
        action: 'ALLOW',
        port: 0,
        host: 'localhost',
        protocol: 'TCP',
        priority: 1,
        description: 'Allow loopback traffic',
      },
      {
        id: 'linux-allow-30002',
        action: 'ALLOW',
        port: 30002,
        host: 'localhost',
        protocol: 'TCP',
        priority: 2,
        description: 'Allow KPI Gateway on localhost:30002',
      },
      {
        id: 'linux-deny-all',
        action: 'DENY',
        port: 0,
        host: '*',
        protocol: 'TCP',
        priority: 999,
        description: 'Deny all other traffic',
      },
    ];
  }

  /**
   * Configure macOS firewall using pfctl
   */
  private async configureMacOSFirewall(): Promise<void> {
    const pfRules = `
# Block all incoming traffic by default
block all

# Allow loopback traffic
pass on lo0

# Allow localhost:30002 for KPI Gateway
pass in on lo0 proto tcp from 127.0.0.1 to 127.0.0.1 port 30002
pass in on lo0 proto tcp from ::1 to ::1 port 30002

# Allow established connections
pass out keep state
pass in proto tcp from any to any port 30002 keep state

# Log blocked connections
block log all
`;

    try {
      // Write rules to temporary file
      await execAsync(`echo '${pfRules}' > /tmp/kpi-pf.rules`);
      
      // Load rules (requires sudo)
      await execAsync('sudo pfctl -f /tmp/kpi-pf.rules');
      
      // Enable pfctl
      await execAsync('sudo pfctl -e');
      
      logger.info('macOS firewall configured with pfctl');
    } catch (error) {
      logger.warn('Failed to configure macOS firewall (may require manual setup)', { error });
      // Don't throw error as pfctl might not be available or require different permissions
    }

    this.rules = [
      {
        id: 'macos-allow-lo',
        action: 'ALLOW',
        port: 0,
        host: 'localhost',
        protocol: 'TCP',
        priority: 1,
        description: 'Allow loopback traffic',
      },
      {
        id: 'macos-allow-30002',
        action: 'ALLOW',
        port: 30002,
        host: 'localhost',
        protocol: 'TCP',
        priority: 2,
        description: 'Allow KPI Gateway on localhost:30002',
      },
      {
        id: 'macos-deny-all',
        action: 'DENY',
        port: 0,
        host: '*',
        protocol: 'TCP',
        priority: 999,
        description: 'Deny all other traffic',
      },
    ];
  }

  /**
   * Configure Windows firewall using netsh
   */
  private async configureWindowsFirewall(): Promise<void> {
    const commands = [
      // Enable Windows Firewall
      'netsh advfirewall set allprofiles state on',
      
      // Block all inbound connections by default
      'netsh advfirewall set allprofiles firewallpolicy blockinbound,allowoutbound',
      
      // Allow localhost:30002
      'netsh advfirewall firewall add rule name="KPI Gateway" dir=in action=allow protocol=TCP localport=30002 localip=127.0.0.1',
      
      // Remove any existing rules that might conflict
      'netsh advfirewall firewall delete rule name="KPI Gateway" || echo "No existing rule to delete"',
      'netsh advfirewall firewall add rule name="KPI Gateway" dir=in action=allow protocol=TCP localport=30002 localip=127.0.0.1',
    ];

    for (const command of commands) {
      try {
        await execAsync(command);
        logger.debug(`Executed: ${command}`);
      } catch (error) {
        logger.warn(`Windows firewall command failed: ${command}`, { error });
      }
    }

    this.rules = [
      {
        id: 'windows-allow-30002',
        action: 'ALLOW',
        port: 30002,
        host: 'localhost',
        protocol: 'TCP',
        priority: 1,
        description: 'Allow KPI Gateway on localhost:30002',
      },
      {
        id: 'windows-deny-all',
        action: 'DENY',
        port: 0,
        host: '*',
        protocol: 'TCP',
        priority: 999,
        description: 'Block all other inbound traffic',
      },
    ];
  }

  /**
   * Get current firewall status
   */
  async getFirewallStatus(): Promise<FirewallStatus> {
    return {
      enabled: true,
      rules: this.rules,
      platform: this.currentPlatform,
      lastUpdated: new Date(),
    };
  }

  /**
   * Validate firewall configuration
   */
  async validateConfiguration(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // Check if port 30002 is accessible locally
      const { stdout } = await execAsync('netstat -an | grep :30002 || ss -an | grep :30002 || echo "not found"');
      
      if (!stdout.includes('30002')) {
        issues.push('Port 30002 is not listening');
      }

      // Platform-specific validation
      switch (this.currentPlatform) {
        case 'linux':
          await this.validateLinuxFirewall(issues);
          break;
        case 'darwin':
          await this.validateMacOSFirewall(issues);
          break;
        case 'win32':
          await this.validateWindowsFirewall(issues);
          break;
      }

      return {
        valid: issues.length === 0,
        issues,
      };
    } catch (error) {
      logger.error('Firewall validation failed', { error });
      return {
        valid: false,
        issues: [`Validation error: ${error}`],
      };
    }
  }

  private async validateLinuxFirewall(issues: string[]): Promise<void> {
    try {
      const { stdout } = await execAsync('sudo iptables -L -n');
      
      if (!stdout.includes('DROP')) {
        issues.push('Default DROP policy not found in iptables');
      }
      
      if (!stdout.includes('30002')) {
        issues.push('Port 30002 rule not found in iptables');
      }
    } catch (error) {
      issues.push('Cannot access iptables (may require sudo)');
    }
  }

  private async validateMacOSFirewall(issues: string[]): Promise<void> {
    try {
      const { stdout } = await execAsync('sudo pfctl -s rules');
      
      if (!stdout.includes('30002')) {
        issues.push('Port 30002 rule not found in pfctl');
      }
    } catch (error) {
      issues.push('Cannot access pfctl (may require sudo or manual configuration)');
    }
  }

  private async validateWindowsFirewall(issues: string[]): Promise<void> {
    try {
      const { stdout } = await execAsync('netsh advfirewall firewall show rule name="KPI Gateway"');
      
      if (!stdout.includes('KPI Gateway')) {
        issues.push('KPI Gateway firewall rule not found');
      }
    } catch (error) {
      issues.push('Cannot access Windows firewall settings');
    }
  }

  /**
   * Reset firewall to default state (use with caution)
   */
  async resetFirewall(): Promise<void> {
    logger.warn('Resetting firewall to default state');

    try {
      switch (this.currentPlatform) {
        case 'linux':
          await execAsync('sudo iptables -F && sudo iptables -X && sudo iptables -P INPUT ACCEPT && sudo iptables -P FORWARD ACCEPT && sudo iptables -P OUTPUT ACCEPT');
          break;
        case 'darwin':
          await execAsync('sudo pfctl -d');
          break;
        case 'win32':
          await execAsync('netsh advfirewall reset');
          break;
      }

      this.rules = [];
      logger.info('Firewall reset completed');
    } catch (error) {
      logger.error('Failed to reset firewall', { error });
      throw error;
    }
  }
}