#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { platform } from 'os';
import { logger } from '../utils/logger';
import { FirewallManager } from '../services/firewallManager';
import { SecurityValidator } from './securityValidator';

const execAsync = promisify(exec);

export interface ServiceConfig {
  serviceName: string;
  description: string;
  autoStart: boolean;
  restartOnFailure: boolean;
  checkInterval: number; // seconds
  maxRestarts: number;
}

export class SecurityService {
  private config: ServiceConfig;
  private firewallManager: FirewallManager;
  private validator: SecurityValidator;
  private currentPlatform: string;
  private isRunning: boolean = false;
  private checkInterval?: NodeJS.Timeout;

  constructor(config?: Partial<ServiceConfig>) {
    this.config = {
      serviceName: 'kpi-security-service',
      description: 'KPI Productivity Security Service',
      autoStart: true,
      restartOnFailure: true,
      checkInterval: 300, // 5 minutes
      maxRestarts: 3,
      ...config,
    };

    this.firewallManager = new FirewallManager();
    this.validator = new SecurityValidator();
    this.currentPlatform = platform();
  }

  /**
   * Install the security service
   */
  async install(): Promise<void> {
    logger.info('Installing security service', {
      platform: this.currentPlatform,
      serviceName: this.config.serviceName,
    });

    try {
      switch (this.currentPlatform) {
        case 'linux':
          await this.installLinuxService();
          break;
        case 'darwin':
          await this.installMacOSService();
          break;
        case 'win32':
          await this.installWindowsService();
          break;
        default:
          throw new Error(`Service installation not supported for platform: ${this.currentPlatform}`);
      }

      logger.info('Security service installed successfully');
    } catch (error) {
      logger.error('Failed to install security service', { error });
      throw error;
    }
  }

  /**
   * Install Linux systemd service
   */
  private async installLinuxService(): Promise<void> {
    const serviceContent = `[Unit]
Description=${this.config.description}
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/node ${__filename} run
ExecReload=/bin/kill -HUP $MAINPID
Restart=${this.config.restartOnFailure ? 'always' : 'no'}
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${this.config.serviceName}

[Install]
WantedBy=multi-user.target
`;

    const servicePath = `/etc/systemd/system/${this.config.serviceName}.service`;
    
    try {
      writeFileSync(servicePath, serviceContent);
      
      // Reload systemd and enable service
      await execAsync('sudo systemctl daemon-reload');
      
      if (this.config.autoStart) {
        await execAsync(`sudo systemctl enable ${this.config.serviceName}`);
      }
      
      logger.info('Linux systemd service installed', { servicePath });
    } catch (error) {
      logger.error('Failed to install Linux service', { error });
      throw error;
    }
  }

  /**
   * Install macOS launchd service
   */
  private async installMacOSService(): Promise<void> {
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.kpi.${this.config.serviceName}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>${__filename}</string>
        <string>run</string>
    </array>
    <key>RunAtLoad</key>
    <${this.config.autoStart ? 'true' : 'false'}/>
    <key>KeepAlive</key>
    <${this.config.restartOnFailure ? 'true' : 'false'}/>
    <key>StandardOutPath</key>
    <string>/var/log/${this.config.serviceName}.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/${this.config.serviceName}.error.log</string>
    <key>UserName</key>
    <string>root</string>
</dict>
</plist>
`;

    const plistPath = `/Library/LaunchDaemons/com.kpi.${this.config.serviceName}.plist`;
    
    try {
      writeFileSync(plistPath, plistContent);
      
      // Set proper permissions
      await execAsync(`sudo chown root:wheel ${plistPath}`);
      await execAsync(`sudo chmod 644 ${plistPath}`);
      
      if (this.config.autoStart) {
        await execAsync(`sudo launchctl load ${plistPath}`);
      }
      
      logger.info('macOS launchd service installed', { plistPath });
    } catch (error) {
      logger.error('Failed to install macOS service', { error });
      throw error;
    }
  }

  /**
   * Install Windows service
   */
  private async installWindowsService(): Promise<void> {
    // For Windows, we'll create a simple batch script and use sc command
    const batchContent = `@echo off
cd /d "${process.cwd()}"
node "${__filename}" run
`;

    const batchPath = `C:\\Program Files\\${this.config.serviceName}\\service.bat`;
    
    try {
      // Create service directory
      await execAsync(`mkdir "C:\\Program Files\\${this.config.serviceName}" 2>nul || echo Directory exists`);
      
      writeFileSync(batchPath, batchContent);
      
      // Create Windows service
      const scCommand = `sc create ${this.config.serviceName} binPath= "${batchPath}" DisplayName= "${this.config.description}" start= ${this.config.autoStart ? 'auto' : 'demand'}`;
      
      await execAsync(scCommand);
      
      logger.info('Windows service installed', { serviceName: this.config.serviceName });
    } catch (error) {
      logger.error('Failed to install Windows service', { error });
      throw error;
    }
  }

  /**
   * Uninstall the security service
   */
  async uninstall(): Promise<void> {
    logger.info('Uninstalling security service', {
      platform: this.currentPlatform,
      serviceName: this.config.serviceName,
    });

    try {
      // Stop service first
      await this.stop();

      switch (this.currentPlatform) {
        case 'linux':
          await this.uninstallLinuxService();
          break;
        case 'darwin':
          await this.uninstallMacOSService();
          break;
        case 'win32':
          await this.uninstallWindowsService();
          break;
        default:
          throw new Error(`Service uninstallation not supported for platform: ${this.currentPlatform}`);
      }

      logger.info('Security service uninstalled successfully');
    } catch (error) {
      logger.error('Failed to uninstall security service', { error });
      throw error;
    }
  }

  /**
   * Uninstall Linux systemd service
   */
  private async uninstallLinuxService(): Promise<void> {
    try {
      await execAsync(`sudo systemctl disable ${this.config.serviceName}`);
      await execAsync(`sudo rm -f /etc/systemd/system/${this.config.serviceName}.service`);
      await execAsync('sudo systemctl daemon-reload');
      
      logger.info('Linux systemd service uninstalled');
    } catch (error) {
      logger.warn('Error during Linux service uninstall (may be expected)', { error });
    }
  }

  /**
   * Uninstall macOS launchd service
   */
  private async uninstallMacOSService(): Promise<void> {
    const plistPath = `/Library/LaunchDaemons/com.kpi.${this.config.serviceName}.plist`;
    
    try {
      await execAsync(`sudo launchctl unload ${plistPath}`);
      await execAsync(`sudo rm -f ${plistPath}`);
      
      logger.info('macOS launchd service uninstalled');
    } catch (error) {
      logger.warn('Error during macOS service uninstall (may be expected)', { error });
    }
  }

  /**
   * Uninstall Windows service
   */
  private async uninstallWindowsService(): Promise<void> {
    try {
      await execAsync(`sc delete ${this.config.serviceName}`);
      await execAsync(`rmdir /s /q "C:\\Program Files\\${this.config.serviceName}"`);
      
      logger.info('Windows service uninstalled');
    } catch (error) {
      logger.warn('Error during Windows service uninstall (may be expected)', { error });
    }
  }

  /**
   * Start the security service
   */
  async start(): Promise<void> {
    logger.info('Starting security service');

    try {
      switch (this.currentPlatform) {
        case 'linux':
          await execAsync(`sudo systemctl start ${this.config.serviceName}`);
          break;
        case 'darwin':
          await execAsync(`sudo launchctl load /Library/LaunchDaemons/com.kpi.${this.config.serviceName}.plist`);
          break;
        case 'win32':
          await execAsync(`sc start ${this.config.serviceName}`);
          break;
        default:
          // Fallback to direct execution
          await this.runService();
          return;
      }

      logger.info('Security service started');
    } catch (error) {
      logger.error('Failed to start security service', { error });
      throw error;
    }
  }

  /**
   * Stop the security service
   */
  async stop(): Promise<void> {
    logger.info('Stopping security service');

    try {
      switch (this.currentPlatform) {
        case 'linux':
          await execAsync(`sudo systemctl stop ${this.config.serviceName}`);
          break;
        case 'darwin':
          await execAsync(`sudo launchctl unload /Library/LaunchDaemons/com.kpi.${this.config.serviceName}.plist`);
          break;
        case 'win32':
          await execAsync(`sc stop ${this.config.serviceName}`);
          break;
        default:
          this.isRunning = false;
          if (this.checkInterval) {
            clearInterval(this.checkInterval);
          }
          return;
      }

      logger.info('Security service stopped');
    } catch (error) {
      logger.warn('Error stopping security service (may be expected)', { error });
    }
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<{
    installed: boolean;
    running: boolean;
    enabled: boolean;
    platform: string;
  }> {
    const status = {
      installed: false,
      running: false,
      enabled: false,
      platform: this.currentPlatform,
    };

    try {
      switch (this.currentPlatform) {
        case 'linux':
          await this.getLinuxServiceStatus(status);
          break;
        case 'darwin':
          await this.getMacOSServiceStatus(status);
          break;
        case 'win32':
          await this.getWindowsServiceStatus(status);
          break;
      }
    } catch (error) {
      logger.debug('Error getting service status', { error });
    }

    return status;
  }

  /**
   * Get Linux service status
   */
  private async getLinuxServiceStatus(status: any): Promise<void> {
    try {
      // Check if service file exists
      status.installed = existsSync(`/etc/systemd/system/${this.config.serviceName}.service`);

      if (status.installed) {
        // Check if service is running
        const { stdout: activeStatus } = await execAsync(`systemctl is-active ${this.config.serviceName}`);
        status.running = activeStatus.trim() === 'active';

        // Check if service is enabled
        const { stdout: enabledStatus } = await execAsync(`systemctl is-enabled ${this.config.serviceName}`);
        status.enabled = enabledStatus.trim() === 'enabled';
      }
    } catch (error) {
      logger.debug('Error checking Linux service status', { error });
    }
  }

  /**
   * Get macOS service status
   */
  private async getMacOSServiceStatus(status: any): Promise<void> {
    try {
      const plistPath = `/Library/LaunchDaemons/com.kpi.${this.config.serviceName}.plist`;
      status.installed = existsSync(plistPath);

      if (status.installed) {
        // Check if service is loaded/running
        const { stdout } = await execAsync('sudo launchctl list');
        status.running = stdout.includes(`com.kpi.${this.config.serviceName}`);
        status.enabled = status.running; // In launchd, loaded generally means enabled
      }
    } catch (error) {
      logger.debug('Error checking macOS service status', { error });
    }
  }

  /**
   * Get Windows service status
   */
  private async getWindowsServiceStatus(status: any): Promise<void> {
    try {
      const { stdout } = await execAsync(`sc query ${this.config.serviceName}`);
      
      status.installed = !stdout.includes('does not exist');
      
      if (status.installed) {
        status.running = stdout.includes('RUNNING');
        status.enabled = stdout.includes('AUTO_START') || stdout.includes('DEMAND_START');
      }
    } catch (error) {
      logger.debug('Error checking Windows service status', { error });
    }
  }

  /**
   * Run the security service (main service loop)
   */
  async runService(): Promise<void> {
    logger.info('Security service starting main loop', {
      checkInterval: this.config.checkInterval,
    });

    this.isRunning = true;

    // Initial firewall configuration
    try {
      await this.firewallManager.configureSecureFirewall();
      logger.info('Initial firewall configuration completed');
    } catch (error) {
      logger.error('Initial firewall configuration failed', { error });
    }

    // Start periodic security checks
    this.checkInterval = setInterval(async () => {
      try {
        await this.performSecurityMaintenance();
      } catch (error) {
        logger.error('Security maintenance failed', { error });
      }
    }, this.config.checkInterval * 1000);

    // Handle graceful shutdown
    const shutdown = () => {
      logger.info('Security service shutting down');
      this.isRunning = false;
      
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
      }
      
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // Keep the service running
    while (this.isRunning) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * Perform periodic security maintenance
   */
  private async performSecurityMaintenance(): Promise<void> {
    logger.debug('Performing security maintenance');

    try {
      // Validate firewall configuration
      const validationResult = await this.validator.validateSecurity();
      
      if (!validationResult.valid) {
        logger.warn('Security validation failed, attempting to fix', {
          issues: validationResult.issues,
        });

        // Attempt to reconfigure firewall
        try {
          await this.firewallManager.configureSecureFirewall();
          logger.info('Firewall reconfiguration completed');
        } catch (error) {
          logger.error('Firewall reconfiguration failed', { error });
        }
      }

      // Log maintenance completion
      logger.debug('Security maintenance completed', {
        valid: validationResult.valid,
        issuesCount: validationResult.issues.length,
        warningsCount: validationResult.warnings.length,
      });

    } catch (error) {
      logger.error('Security maintenance error', { error });
    }
  }
}

// CLI execution
if (require.main === module) {
  const service = new SecurityService();
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  const executeCommand = async () => {
    try {
      switch (command) {
        case 'install':
          await service.install();
          console.log('Security service installed successfully');
          break;

        case 'uninstall':
          await service.uninstall();
          console.log('Security service uninstalled successfully');
          break;

        case 'start':
          await service.start();
          console.log('Security service started successfully');
          break;

        case 'stop':
          await service.stop();
          console.log('Security service stopped successfully');
          break;

        case 'status':
          const status = await service.getStatus();
          console.log('Security Service Status:');
          console.log(`  Platform: ${status.platform}`);
          console.log(`  Installed: ${status.installed ? '✅' : '❌'}`);
          console.log(`  Running: ${status.running ? '✅' : '❌'}`);
          console.log(`  Enabled: ${status.enabled ? '✅' : '❌'}`);
          break;

        case 'run':
          // This is called by the system service
          await service.runService();
          break;

        case 'help':
        default:
          console.log('KPI Security Service');
          console.log('');
          console.log('Usage: securityService.ts <command>');
          console.log('');
          console.log('Commands:');
          console.log('  install   - Install the security service');
          console.log('  uninstall - Uninstall the security service');
          console.log('  start     - Start the security service');
          console.log('  stop      - Stop the security service');
          console.log('  status    - Show service status');
          console.log('  run       - Run the service (used by system service)');
          console.log('  help      - Show this help message');
          break;
      }
    } catch (error) {
      console.error(`Command '${command}' failed:`, error);
      process.exit(1);
    }
  };

  executeCommand();
}