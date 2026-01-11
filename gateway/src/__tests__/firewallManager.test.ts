import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FirewallManager } from '../services/firewallManager';
import { exec } from 'child_process';

// Mock child_process and os
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('os', () => ({
  platform: vi.fn(),
}));

describe('FirewallManager', () => {
  let firewallManager: FirewallManager;
  const mockExec = vi.mocked(exec);

  beforeEach(() => {
    vi.clearAllMocks();
    // Default to Linux platform for testing
    vi.mocked(require('os').platform).mockReturnValue('linux');
    firewallManager = new FirewallManager();
  });

  describe('Initialization', () => {
    it('should initialize with correct platform', () => {
      expect(require('os').platform).toHaveBeenCalled();
    });
  });

  describe('Linux Firewall Configuration', () => {
    beforeEach(() => {
      vi.mocked(require('os').platform).mockReturnValue('linux');
      firewallManager = new FirewallManager();
    });

    it('should configure Linux firewall rules', async () => {
      // Mock successful command execution
      mockExec.mockImplementation((command, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'success', stderr: '' } as any);
        }
        return {} as any;
      });

      await firewallManager.configureSecureFirewall();

      // Verify that iptables commands were called
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('iptables'),
        expect.any(Function)
      );
    });

    it('should handle Linux firewall configuration errors gracefully', async () => {
      // Mock command failure
      mockExec.mockImplementation((command, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Command failed'), { stdout: '', stderr: 'error' } as any);
        }
        return {} as any;
      });

      // Should not throw error, but log warnings
      await expect(firewallManager.configureSecureFirewall()).resolves.not.toThrow();
    });
  });

  describe('macOS Firewall Configuration', () => {
    beforeEach(() => {
      vi.mocked(require('os').platform).mockReturnValue('darwin');
      firewallManager = new FirewallManager();
    });

    it('should configure macOS firewall rules', async () => {
      // Mock successful command execution
      mockExec.mockImplementation((command, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'success', stderr: '' } as any);
        }
        return {} as any;
      });

      await firewallManager.configureSecureFirewall();

      // Verify that pfctl commands were called
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('pfctl'),
        expect.any(Function)
      );
    });
  });

  describe('Windows Firewall Configuration', () => {
    beforeEach(() => {
      vi.mocked(require('os').platform).mockReturnValue('win32');
      firewallManager = new FirewallManager();
    });

    it('should configure Windows firewall rules', async () => {
      // Mock successful command execution
      mockExec.mockImplementation((command, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'success', stderr: '' } as any);
        }
        return {} as any;
      });

      await firewallManager.configureSecureFirewall();

      // Verify that netsh commands were called
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('netsh'),
        expect.any(Function)
      );
    });
  });

  describe('Unsupported Platform', () => {
    beforeEach(() => {
      vi.mocked(require('os').platform).mockReturnValue('freebsd');
      firewallManager = new FirewallManager();
    });

    it('should throw error for unsupported platform', async () => {
      await expect(firewallManager.configureSecureFirewall()).rejects.toThrow(
        'Unsupported platform: freebsd'
      );
    });
  });

  describe('Firewall Status', () => {
    it('should return firewall status', async () => {
      const status = await firewallManager.getFirewallStatus();

      expect(status).toHaveProperty('enabled');
      expect(status).toHaveProperty('rules');
      expect(status).toHaveProperty('platform');
      expect(status).toHaveProperty('lastUpdated');
      expect(status.enabled).toBe(true);
      expect(Array.isArray(status.rules)).toBe(true);
    });
  });

  describe('Firewall Validation', () => {
    it('should validate firewall configuration', async () => {
      // Mock netstat command
      mockExec.mockImplementation((command, callback) => {
        if (typeof callback === 'function') {
          if (command.includes('netstat') || command.includes('ss')) {
            callback(null, { stdout: 'tcp 0 0 127.0.0.1:30002 0.0.0.0:* LISTEN', stderr: '' } as any);
          } else if (command.includes('iptables')) {
            callback(null, { stdout: 'Chain INPUT (policy DROP)\ntarget prot opt source destination\nACCEPT tcp -- 127.0.0.1 0.0.0.0/0 tcp dpt:30002', stderr: '' } as any);
          } else {
            callback(null, { stdout: 'success', stderr: '' } as any);
          }
        }
        return {} as any;
      });

      const validation = await firewallManager.validateConfiguration();

      expect(validation).toHaveProperty('valid');
      expect(validation).toHaveProperty('issues');
      expect(Array.isArray(validation.issues)).toBe(true);
    });

    it('should detect validation issues', async () => {
      // Mock commands to return empty results
      mockExec.mockImplementation((command, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: '', stderr: '' } as any);
        }
        return {} as any;
      });

      const validation = await firewallManager.validateConfiguration();

      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });
  });

  describe('Firewall Reset', () => {
    it('should reset firewall configuration', async () => {
      // Mock successful command execution
      mockExec.mockImplementation((command, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'success', stderr: '' } as any);
        }
        return {} as any;
      });

      await firewallManager.resetFirewall();

      // Verify that reset commands were called
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('iptables -F'),
        expect.any(Function)
      );
    });

    it('should handle reset errors', async () => {
      // Mock command failure
      mockExec.mockImplementation((command, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Reset failed'), { stdout: '', stderr: 'error' } as any);
        }
        return {} as any;
      });

      await expect(firewallManager.resetFirewall()).rejects.toThrow('Reset failed');
    });
  });
});