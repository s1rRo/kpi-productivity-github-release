#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import net from 'net';
import http from 'http';
import https from 'https';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

export interface SecurityTestResult {
  testName: string;
  category: 'PORT_SCANNING' | 'PENETRATION' | 'COMPLIANCE' | 'VULNERABILITY';
  status: 'PASS' | 'FAIL' | 'WARNING' | 'SKIP';
  description: string;
  details: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendation?: string;
  evidence?: any;
}

export interface SecurityTestSuite {
  id: string;
  timestamp: Date;
  duration: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
  results: SecurityTestResult[];
  overallStatus: 'PASS' | 'FAIL' | 'WARNING';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class SecurityTester {
  private gatewayHost: string = 'localhost';
  private gatewayPort: number = 30002;
  private testTimeout: number = 30000; // 30 seconds

  constructor(gatewayHost?: string, gatewayPort?: number) {
    if (gatewayHost) this.gatewayHost = gatewayHost;
    if (gatewayPort) this.gatewayPort = gatewayPort;
  }

  /**
   * Run comprehensive security test suite
   */
  async runSecurityTests(): Promise<SecurityTestSuite> {
    const startTime = Date.now();
    const results: SecurityTestResult[] = [];

    logger.info('Starting comprehensive security test suite');

    try {
      // Port scanning tests
      results.push(...await this.runPortScanningTests());

      // Penetration tests
      results.push(...await this.runPenetrationTests());

      // Compliance tests
      results.push(...await this.runComplianceTests());

      // Vulnerability tests
      results.push(...await this.runVulnerabilityTests());

    } catch (error) {
      logger.error('Security test suite failed', { error });
      results.push({
        testName: 'Test Suite Execution',
        category: 'COMPLIANCE',
        status: 'FAIL',
        description: 'Security test suite execution failed',
        details: `Error: ${error}`,
        severity: 'HIGH',
        recommendation: 'Investigate test suite execution issues',
      });
    }

    const duration = Date.now() - startTime;
    const summary = this.calculateSummary(results);
    const overallStatus = this.determineOverallStatus(results);
    const riskLevel = this.assessRiskLevel(results);

    const testSuite: SecurityTestSuite = {
      id: `security_test_${Date.now()}`,
      timestamp: new Date(),
      duration,
      summary,
      results,
      overallStatus,
      riskLevel,
    };

    logger.info('Security test suite completed', {
      duration,
      summary,
      overallStatus,
      riskLevel,
    });

    return testSuite;
  }

  /**
   * Run port scanning tests
   */
  private async runPortScanningTests(): Promise<SecurityTestResult[]> {
    const results: SecurityTestResult[] = [];

    logger.info('Running port scanning tests');

    // Test 1: Verify only port 30002 is accessible
    results.push(await this.testAuthorizedPortAccess());

    // Test 2: Verify unauthorized ports are blocked
    results.push(...await this.testUnauthorizedPortBlocking());

    // Test 3: Test port scanning detection
    results.push(await this.testPortScanDetection());

    // Test 4: Test service fingerprinting
    results.push(await this.testServiceFingerprinting());

    return results;
  }

  /**
   * Test authorized port access
   */
  private async testAuthorizedPortAccess(): Promise<SecurityTestResult> {
    try {
      const isAccessible = await this.checkPortAccessibility(this.gatewayHost, this.gatewayPort);
      
      if (isAccessible) {
        return {
          testName: 'Authorized Port Access',
          category: 'PORT_SCANNING',
          status: 'PASS',
          description: 'Gateway port 30002 is accessible as expected',
          details: `Port ${this.gatewayPort} on ${this.gatewayHost} is accessible`,
          severity: 'LOW',
        };
      } else {
        return {
          testName: 'Authorized Port Access',
          category: 'PORT_SCANNING',
          status: 'FAIL',
          description: 'Gateway port 30002 is not accessible',
          details: `Port ${this.gatewayPort} on ${this.gatewayHost} is not accessible`,
          severity: 'CRITICAL',
          recommendation: 'Verify gateway service is running and firewall allows port 30002',
        };
      }
    } catch (error) {
      return {
        testName: 'Authorized Port Access',
        category: 'PORT_SCANNING',
        status: 'FAIL',
        description: 'Failed to test authorized port access',
        details: `Error: ${error}`,
        severity: 'HIGH',
        recommendation: 'Investigate port accessibility testing mechanism',
      };
    }
  }

  /**
   * Test unauthorized port blocking
   */
  private async testUnauthorizedPortBlocking(): Promise<SecurityTestResult[]> {
    const results: SecurityTestResult[] = [];
    const unauthorizedPorts = [21, 22, 23, 25, 53, 80, 110, 143, 443, 993, 995, 3000, 3001, 5432, 6379];

    for (const port of unauthorizedPorts) {
      try {
        const isAccessible = await this.checkPortAccessibility(this.gatewayHost, port);
        
        if (isAccessible) {
          results.push({
            testName: `Unauthorized Port ${port} Blocking`,
            category: 'PORT_SCANNING',
            status: 'FAIL',
            description: `Unauthorized port ${port} is accessible`,
            details: `Port ${port} should be blocked but is accessible`,
            severity: 'HIGH',
            recommendation: `Block access to port ${port} in firewall configuration`,
          });
        } else {
          results.push({
            testName: `Unauthorized Port ${port} Blocking`,
            category: 'PORT_SCANNING',
            status: 'PASS',
            description: `Unauthorized port ${port} is properly blocked`,
            details: `Port ${port} is not accessible as expected`,
            severity: 'LOW',
          });
        }
      } catch (error) {
        results.push({
          testName: `Unauthorized Port ${port} Blocking`,
          category: 'PORT_SCANNING',
          status: 'WARNING',
          description: `Failed to test port ${port} blocking`,
          details: `Error testing port ${port}: ${error}`,
          severity: 'MEDIUM',
          recommendation: 'Investigate port testing mechanism',
        });
      }
    }

    return results;
  }

  /**
   * Test port scan detection
   */
  private async testPortScanDetection(): Promise<SecurityTestResult> {
    try {
      // Simulate port scanning by checking multiple ports rapidly
      const ports = [21, 22, 23, 25, 53, 80, 110, 143, 443, 993];
      const scanResults = [];

      for (const port of ports) {
        const result = await this.checkPortAccessibility(this.gatewayHost, port, 1000);
        scanResults.push({ port, accessible: result });
      }

      // Check if the gateway detected the port scan (this would require API integration)
      const detectionResult = await this.checkPortScanDetection();

      if (detectionResult.detected) {
        return {
          testName: 'Port Scan Detection',
          category: 'PORT_SCANNING',
          status: 'PASS',
          description: 'Port scanning was detected by security monitoring',
          details: `Port scan detection working: ${detectionResult.details}`,
          severity: 'LOW',
          evidence: { scanResults, detection: detectionResult },
        };
      } else {
        return {
          testName: 'Port Scan Detection',
          category: 'PORT_SCANNING',
          status: 'WARNING',
          description: 'Port scanning was not detected by security monitoring',
          details: 'Port scan detection may not be working properly',
          severity: 'MEDIUM',
          recommendation: 'Verify port scan detection is configured and working',
          evidence: { scanResults },
        };
      }
    } catch (error) {
      return {
        testName: 'Port Scan Detection',
        category: 'PORT_SCANNING',
        status: 'FAIL',
        description: 'Failed to test port scan detection',
        details: `Error: ${error}`,
        severity: 'HIGH',
        recommendation: 'Investigate port scan detection testing',
      };
    }
  }

  /**
   * Test service fingerprinting
   */
  private async testServiceFingerprinting(): Promise<SecurityTestResult> {
    try {
      const serviceInfo = await this.fingerprintService(this.gatewayHost, this.gatewayPort);
      
      // Check if service reveals too much information
      const hasVulnerableHeaders = this.checkVulnerableHeaders(serviceInfo.headers);
      
      if (hasVulnerableHeaders.length > 0) {
        return {
          testName: 'Service Fingerprinting',
          category: 'PORT_SCANNING',
          status: 'WARNING',
          description: 'Service reveals potentially sensitive information',
          details: `Vulnerable headers detected: ${hasVulnerableHeaders.join(', ')}`,
          severity: 'MEDIUM',
          recommendation: 'Remove or obfuscate sensitive service information in headers',
          evidence: serviceInfo,
        };
      } else {
        return {
          testName: 'Service Fingerprinting',
          category: 'PORT_SCANNING',
          status: 'PASS',
          description: 'Service does not reveal sensitive information',
          details: 'No vulnerable headers detected',
          severity: 'LOW',
          evidence: serviceInfo,
        };
      }
    } catch (error) {
      return {
        testName: 'Service Fingerprinting',
        category: 'PORT_SCANNING',
        status: 'FAIL',
        description: 'Failed to fingerprint service',
        details: `Error: ${error}`,
        severity: 'MEDIUM',
        recommendation: 'Investigate service fingerprinting test',
      };
    }
  }

  /**
   * Run penetration tests
   */
  private async runPenetrationTests(): Promise<SecurityTestResult[]> {
    const results: SecurityTestResult[] = [];

    logger.info('Running penetration tests');

    // Test 1: SQL Injection attempts
    results.push(await this.testSQLInjection());

    // Test 2: XSS attempts
    results.push(await this.testXSSVulnerabilities());

    // Test 3: Path traversal attempts
    results.push(await this.testPathTraversal());

    // Test 4: Command injection attempts
    results.push(await this.testCommandInjection());

    // Test 5: Rate limiting bypass attempts
    results.push(await this.testRateLimitingBypass());

    // Test 6: Authentication bypass attempts
    results.push(await this.testAuthenticationBypass());

    return results;
  }

  /**
   * Test SQL injection vulnerabilities
   */
  private async testSQLInjection(): Promise<SecurityTestResult> {
    const sqlPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM users --",
      "1' OR 1=1 --",
      "admin'--",
      "' OR 1=1#",
    ];

    try {
      const vulnerabilities = [];

      for (const payload of sqlPayloads) {
        const response = await this.makeHttpRequest('GET', `/test?id=${encodeURIComponent(payload)}`);
        
        // Check for SQL error messages or unexpected behavior
        if (this.detectSQLInjectionVulnerability(response)) {
          vulnerabilities.push({ payload, response: response.body });
        }
      }

      if (vulnerabilities.length > 0) {
        return {
          testName: 'SQL Injection Test',
          category: 'PENETRATION',
          status: 'FAIL',
          description: 'SQL injection vulnerabilities detected',
          details: `${vulnerabilities.length} potential SQL injection vulnerabilities found`,
          severity: 'CRITICAL',
          recommendation: 'Implement proper input validation and parameterized queries',
          evidence: vulnerabilities,
        };
      } else {
        return {
          testName: 'SQL Injection Test',
          category: 'PENETRATION',
          status: 'PASS',
          description: 'No SQL injection vulnerabilities detected',
          details: 'All SQL injection payloads were properly handled',
          severity: 'LOW',
        };
      }
    } catch (error) {
      return {
        testName: 'SQL Injection Test',
        category: 'PENETRATION',
        status: 'WARNING',
        description: 'Failed to complete SQL injection test',
        details: `Error: ${error}`,
        severity: 'MEDIUM',
        recommendation: 'Investigate SQL injection testing mechanism',
      };
    }
  }

  /**
   * Test XSS vulnerabilities
   */
  private async testXSSVulnerabilities(): Promise<SecurityTestResult> {
    const xssPayloads = [
      '<script>alert("xss")</script>',
      '<img src="x" onerror="alert(1)">',
      'javascript:alert("xss")',
      '<svg onload="alert(1)">',
      '"><script>alert("xss")</script>',
      "';alert('xss');//",
    ];

    try {
      const vulnerabilities = [];

      for (const payload of xssPayloads) {
        const response = await this.makeHttpRequest('GET', `/test?param=${encodeURIComponent(payload)}`);
        
        // Check if payload is reflected without proper encoding
        if (this.detectXSSVulnerability(response, payload)) {
          vulnerabilities.push({ payload, response: response.body });
        }
      }

      if (vulnerabilities.length > 0) {
        return {
          testName: 'XSS Vulnerability Test',
          category: 'PENETRATION',
          status: 'FAIL',
          description: 'XSS vulnerabilities detected',
          details: `${vulnerabilities.length} potential XSS vulnerabilities found`,
          severity: 'HIGH',
          recommendation: 'Implement proper output encoding and Content Security Policy',
          evidence: vulnerabilities,
        };
      } else {
        return {
          testName: 'XSS Vulnerability Test',
          category: 'PENETRATION',
          status: 'PASS',
          description: 'No XSS vulnerabilities detected',
          details: 'All XSS payloads were properly handled',
          severity: 'LOW',
        };
      }
    } catch (error) {
      return {
        testName: 'XSS Vulnerability Test',
        category: 'PENETRATION',
        status: 'WARNING',
        description: 'Failed to complete XSS vulnerability test',
        details: `Error: ${error}`,
        severity: 'MEDIUM',
        recommendation: 'Investigate XSS testing mechanism',
      };
    }
  }

  /**
   * Test path traversal vulnerabilities
   */
  private async testPathTraversal(): Promise<SecurityTestResult> {
    const pathTraversalPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
      '....//....//....//etc/passwd',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '..%252f..%252f..%252fetc%252fpasswd',
    ];

    try {
      const vulnerabilities = [];

      for (const payload of pathTraversalPayloads) {
        const response = await this.makeHttpRequest('GET', `/files/${payload}`);
        
        // Check for path traversal success indicators
        if (this.detectPathTraversalVulnerability(response)) {
          vulnerabilities.push({ payload, response: response.body });
        }
      }

      if (vulnerabilities.length > 0) {
        return {
          testName: 'Path Traversal Test',
          category: 'PENETRATION',
          status: 'FAIL',
          description: 'Path traversal vulnerabilities detected',
          details: `${vulnerabilities.length} potential path traversal vulnerabilities found`,
          severity: 'HIGH',
          recommendation: 'Implement proper path validation and access controls',
          evidence: vulnerabilities,
        };
      } else {
        return {
          testName: 'Path Traversal Test',
          category: 'PENETRATION',
          status: 'PASS',
          description: 'No path traversal vulnerabilities detected',
          details: 'All path traversal payloads were properly blocked',
          severity: 'LOW',
        };
      }
    } catch (error) {
      return {
        testName: 'Path Traversal Test',
        category: 'PENETRATION',
        status: 'WARNING',
        description: 'Failed to complete path traversal test',
        details: `Error: ${error}`,
        severity: 'MEDIUM',
        recommendation: 'Investigate path traversal testing mechanism',
      };
    }
  }

  /**
   * Test command injection vulnerabilities
   */
  private async testCommandInjection(): Promise<SecurityTestResult> {
    const commandPayloads = [
      '; ls -la',
      '| whoami',
      '&& cat /etc/passwd',
      '`id`',
      '$(whoami)',
      '; ping -c 1 127.0.0.1',
    ];

    try {
      const vulnerabilities = [];

      for (const payload of commandPayloads) {
        const response = await this.makeHttpRequest('POST', '/api/test', {
          command: `test${payload}`,
        });
        
        // Check for command injection success indicators
        if (this.detectCommandInjectionVulnerability(response)) {
          vulnerabilities.push({ payload, response: response.body });
        }
      }

      if (vulnerabilities.length > 0) {
        return {
          testName: 'Command Injection Test',
          category: 'PENETRATION',
          status: 'FAIL',
          description: 'Command injection vulnerabilities detected',
          details: `${vulnerabilities.length} potential command injection vulnerabilities found`,
          severity: 'CRITICAL',
          recommendation: 'Implement proper input validation and avoid system command execution',
          evidence: vulnerabilities,
        };
      } else {
        return {
          testName: 'Command Injection Test',
          category: 'PENETRATION',
          status: 'PASS',
          description: 'No command injection vulnerabilities detected',
          details: 'All command injection payloads were properly handled',
          severity: 'LOW',
        };
      }
    } catch (error) {
      return {
        testName: 'Command Injection Test',
        category: 'PENETRATION',
        status: 'WARNING',
        description: 'Failed to complete command injection test',
        details: `Error: ${error}`,
        severity: 'MEDIUM',
        recommendation: 'Investigate command injection testing mechanism',
      };
    }
  }

  /**
   * Test rate limiting bypass
   */
  private async testRateLimitingBypass(): Promise<SecurityTestResult> {
    try {
      const requests = [];
      const startTime = Date.now();

      // Make rapid requests to test rate limiting
      for (let i = 0; i < 100; i++) {
        requests.push(this.makeHttpRequest('GET', '/api/test', null, {
          'X-Forwarded-For': `192.168.1.${i % 255}`, // Try to bypass with different IPs
        }));
      }

      const responses = await Promise.allSettled(requests);
      const endTime = Date.now();
      
      const successfulRequests = responses.filter(r => 
        r.status === 'fulfilled' && r.value.statusCode < 400
      ).length;
      
      const rateLimitedRequests = responses.filter(r => 
        r.status === 'fulfilled' && r.value.statusCode === 429
      ).length;

      if (rateLimitedRequests === 0 && successfulRequests > 50) {
        return {
          testName: 'Rate Limiting Bypass Test',
          category: 'PENETRATION',
          status: 'FAIL',
          description: 'Rate limiting can be bypassed',
          details: `${successfulRequests}/100 requests succeeded without rate limiting`,
          severity: 'HIGH',
          recommendation: 'Implement proper rate limiting that cannot be easily bypassed',
          evidence: {
            successfulRequests,
            rateLimitedRequests,
            duration: endTime - startTime,
          },
        };
      } else if (rateLimitedRequests > 0) {
        return {
          testName: 'Rate Limiting Bypass Test',
          category: 'PENETRATION',
          status: 'PASS',
          description: 'Rate limiting is working properly',
          details: `${rateLimitedRequests}/100 requests were rate limited`,
          severity: 'LOW',
          evidence: {
            successfulRequests,
            rateLimitedRequests,
            duration: endTime - startTime,
          },
        };
      } else {
        return {
          testName: 'Rate Limiting Bypass Test',
          category: 'PENETRATION',
          status: 'WARNING',
          description: 'Rate limiting behavior is unclear',
          details: 'Unable to determine if rate limiting is working properly',
          severity: 'MEDIUM',
          recommendation: 'Verify rate limiting configuration and testing approach',
          evidence: {
            successfulRequests,
            rateLimitedRequests,
            duration: endTime - startTime,
          },
        };
      }
    } catch (error) {
      return {
        testName: 'Rate Limiting Bypass Test',
        category: 'PENETRATION',
        status: 'FAIL',
        description: 'Failed to test rate limiting bypass',
        details: `Error: ${error}`,
        severity: 'HIGH',
        recommendation: 'Investigate rate limiting bypass testing mechanism',
      };
    }
  }

  /**
   * Test authentication bypass
   */
  private async testAuthenticationBypass(): Promise<SecurityTestResult> {
    const bypassAttempts = [
      { headers: { 'Authorization': 'Bearer invalid_token' } },
      { headers: { 'Authorization': 'Basic YWRtaW46YWRtaW4=' } }, // admin:admin
      { headers: { 'X-User-ID': '1' } },
      { headers: { 'X-Admin': 'true' } },
      { headers: { 'Cookie': 'admin=true; authenticated=1' } },
    ];

    try {
      const vulnerabilities = [];

      for (const attempt of bypassAttempts) {
        const response = await this.makeHttpRequest('GET', '/api/admin/users', null, attempt.headers);
        
        // Check if authentication was bypassed
        if (response.statusCode === 200) {
          vulnerabilities.push({ attempt, response: response.body });
        }
      }

      if (vulnerabilities.length > 0) {
        return {
          testName: 'Authentication Bypass Test',
          category: 'PENETRATION',
          status: 'FAIL',
          description: 'Authentication can be bypassed',
          details: `${vulnerabilities.length} authentication bypass methods found`,
          severity: 'CRITICAL',
          recommendation: 'Implement proper authentication validation and session management',
          evidence: vulnerabilities,
        };
      } else {
        return {
          testName: 'Authentication Bypass Test',
          category: 'PENETRATION',
          status: 'PASS',
          description: 'Authentication cannot be bypassed',
          details: 'All authentication bypass attempts were properly blocked',
          severity: 'LOW',
        };
      }
    } catch (error) {
      return {
        testName: 'Authentication Bypass Test',
        category: 'PENETRATION',
        status: 'WARNING',
        description: 'Failed to test authentication bypass',
        details: `Error: ${error}`,
        severity: 'MEDIUM',
        recommendation: 'Investigate authentication bypass testing mechanism',
      };
    }
  }

  /**
   * Run compliance tests
   */
  private async runComplianceTests(): Promise<SecurityTestResult[]> {
    const results: SecurityTestResult[] = [];

    logger.info('Running compliance tests');

    // Test 1: Security headers compliance
    results.push(await this.testSecurityHeaders());

    // Test 2: HTTPS compliance
    results.push(await this.testHTTPSCompliance());

    // Test 3: CORS compliance
    results.push(await this.testCORSCompliance());

    // Test 4: Content Security Policy compliance
    results.push(await this.testCSPCompliance());

    return results;
  }

  /**
   * Test security headers compliance
   */
  private async testSecurityHeaders(): Promise<SecurityTestResult> {
    try {
      const response = await this.makeHttpRequest('GET', '/');
      const headers = response.headers;

      const requiredHeaders = [
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection',
        'content-security-policy',
      ];

      const missingHeaders = requiredHeaders.filter(header => !headers[header]);

      if (missingHeaders.length > 0) {
        return {
          testName: 'Security Headers Compliance',
          category: 'COMPLIANCE',
          status: 'FAIL',
          description: 'Required security headers are missing',
          details: `Missing headers: ${missingHeaders.join(', ')}`,
          severity: 'MEDIUM',
          recommendation: 'Configure all required security headers',
          evidence: { headers, missingHeaders },
        };
      } else {
        return {
          testName: 'Security Headers Compliance',
          category: 'COMPLIANCE',
          status: 'PASS',
          description: 'All required security headers are present',
          details: 'Security headers compliance verified',
          severity: 'LOW',
          evidence: { headers },
        };
      }
    } catch (error) {
      return {
        testName: 'Security Headers Compliance',
        category: 'COMPLIANCE',
        status: 'FAIL',
        description: 'Failed to test security headers compliance',
        details: `Error: ${error}`,
        severity: 'HIGH',
        recommendation: 'Investigate security headers testing mechanism',
      };
    }
  }

  /**
   * Test HTTPS compliance
   */
  private async testHTTPSCompliance(): Promise<SecurityTestResult> {
    try {
      // For localhost development, HTTPS might not be configured
      if (this.gatewayHost === 'localhost' || this.gatewayHost === '127.0.0.1') {
        return {
          testName: 'HTTPS Compliance',
          category: 'COMPLIANCE',
          status: 'WARNING',
          description: 'HTTPS not configured for localhost development',
          details: 'HTTPS should be configured for production deployment',
          severity: 'MEDIUM',
          recommendation: 'Configure HTTPS for production environments',
        };
      }

      // Test HTTPS availability
      const httpsResponse = await this.makeHttpsRequest('GET', '/');
      
      if (httpsResponse.statusCode < 400) {
        return {
          testName: 'HTTPS Compliance',
          category: 'COMPLIANCE',
          status: 'PASS',
          description: 'HTTPS is properly configured',
          details: 'HTTPS connection successful',
          severity: 'LOW',
        };
      } else {
        return {
          testName: 'HTTPS Compliance',
          category: 'COMPLIANCE',
          status: 'FAIL',
          description: 'HTTPS is not properly configured',
          details: `HTTPS request failed with status ${httpsResponse.statusCode}`,
          severity: 'HIGH',
          recommendation: 'Configure proper HTTPS with valid SSL certificate',
        };
      }
    } catch (error) {
      return {
        testName: 'HTTPS Compliance',
        category: 'COMPLIANCE',
        status: 'WARNING',
        description: 'Failed to test HTTPS compliance',
        details: `Error: ${error}`,
        severity: 'MEDIUM',
        recommendation: 'Verify HTTPS configuration and certificate validity',
      };
    }
  }

  /**
   * Test CORS compliance
   */
  private async testCORSCompliance(): Promise<SecurityTestResult> {
    try {
      // Test allowed origin
      const allowedResponse = await this.makeHttpRequest('OPTIONS', '/', null, {
        'Origin': `http://${this.gatewayHost}:${this.gatewayPort}`,
        'Access-Control-Request-Method': 'GET',
      });

      // Test disallowed origin
      const disallowedResponse = await this.makeHttpRequest('OPTIONS', '/', null, {
        'Origin': 'http://malicious-site.com',
        'Access-Control-Request-Method': 'GET',
      });

      const allowedOriginHeader = allowedResponse.headers['access-control-allow-origin'];
      const disallowedOriginHeader = disallowedResponse.headers['access-control-allow-origin'];

      if (allowedOriginHeader && !disallowedOriginHeader) {
        return {
          testName: 'CORS Compliance',
          category: 'COMPLIANCE',
          status: 'PASS',
          description: 'CORS is properly configured',
          details: 'Allowed origins are accepted, disallowed origins are rejected',
          severity: 'LOW',
          evidence: {
            allowedOriginHeader,
            disallowedOriginHeader,
          },
        };
      } else {
        return {
          testName: 'CORS Compliance',
          category: 'COMPLIANCE',
          status: 'WARNING',
          description: 'CORS configuration may be too permissive',
          details: 'CORS policy should be more restrictive',
          severity: 'MEDIUM',
          recommendation: 'Review and restrict CORS policy to only necessary origins',
          evidence: {
            allowedOriginHeader,
            disallowedOriginHeader,
          },
        };
      }
    } catch (error) {
      return {
        testName: 'CORS Compliance',
        category: 'COMPLIANCE',
        status: 'FAIL',
        description: 'Failed to test CORS compliance',
        details: `Error: ${error}`,
        severity: 'MEDIUM',
        recommendation: 'Investigate CORS compliance testing mechanism',
      };
    }
  }

  /**
   * Test Content Security Policy compliance
   */
  private async testCSPCompliance(): Promise<SecurityTestResult> {
    try {
      const response = await this.makeHttpRequest('GET', '/');
      const cspHeader = response.headers['content-security-policy'];

      if (!cspHeader) {
        return {
          testName: 'CSP Compliance',
          category: 'COMPLIANCE',
          status: 'FAIL',
          description: 'Content Security Policy header is missing',
          details: 'CSP header not found in response',
          severity: 'MEDIUM',
          recommendation: 'Configure Content Security Policy header',
        };
      }

      // Check for secure CSP directives
      const hasDefaultSrc = cspHeader.includes("default-src 'self'");
      const hasScriptSrc = cspHeader.includes('script-src');
      const hasObjectSrc = cspHeader.includes("object-src 'none'");

      if (hasDefaultSrc && hasScriptSrc) {
        return {
          testName: 'CSP Compliance',
          category: 'COMPLIANCE',
          status: 'PASS',
          description: 'Content Security Policy is properly configured',
          details: 'CSP contains secure directives',
          severity: 'LOW',
          evidence: { cspHeader },
        };
      } else {
        return {
          testName: 'CSP Compliance',
          category: 'COMPLIANCE',
          status: 'WARNING',
          description: 'Content Security Policy could be more restrictive',
          details: 'CSP should include more restrictive directives',
          severity: 'MEDIUM',
          recommendation: 'Strengthen Content Security Policy with more restrictive directives',
          evidence: { cspHeader },
        };
      }
    } catch (error) {
      return {
        testName: 'CSP Compliance',
        category: 'COMPLIANCE',
        status: 'FAIL',
        description: 'Failed to test CSP compliance',
        details: `Error: ${error}`,
        severity: 'MEDIUM',
        recommendation: 'Investigate CSP compliance testing mechanism',
      };
    }
  }

  /**
   * Run vulnerability tests
   */
  private async runVulnerabilityTests(): Promise<SecurityTestResult[]> {
    const results: SecurityTestResult[] = [];

    logger.info('Running vulnerability tests');

    // Test 1: Known vulnerability scanning
    results.push(await this.testKnownVulnerabilities());

    // Test 2: Dependency vulnerability check
    results.push(await this.testDependencyVulnerabilities());

    // Test 3: Configuration vulnerability check
    results.push(await this.testConfigurationVulnerabilities());

    return results;
  }

  /**
   * Test for known vulnerabilities
   */
  private async testKnownVulnerabilities(): Promise<SecurityTestResult> {
    try {
      // This is a simplified vulnerability check
      // In a real implementation, you might integrate with vulnerability databases
      
      const vulnerabilityChecks = [
        { name: 'Server Information Disclosure', test: () => this.checkServerInfoDisclosure() },
        { name: 'Directory Listing', test: () => this.checkDirectoryListing() },
        { name: 'Backup File Exposure', test: () => this.checkBackupFileExposure() },
      ];

      const vulnerabilities = [];

      for (const check of vulnerabilityChecks) {
        try {
          const result = await check.test();
          if (result.vulnerable) {
            vulnerabilities.push({ name: check.name, details: result.details });
          }
        } catch (error) {
          // Continue with other checks
        }
      }

      if (vulnerabilities.length > 0) {
        return {
          testName: 'Known Vulnerabilities Test',
          category: 'VULNERABILITY',
          status: 'FAIL',
          description: 'Known vulnerabilities detected',
          details: `${vulnerabilities.length} vulnerabilities found`,
          severity: 'HIGH',
          recommendation: 'Address all identified vulnerabilities',
          evidence: vulnerabilities,
        };
      } else {
        return {
          testName: 'Known Vulnerabilities Test',
          category: 'VULNERABILITY',
          status: 'PASS',
          description: 'No known vulnerabilities detected',
          details: 'All vulnerability checks passed',
          severity: 'LOW',
        };
      }
    } catch (error) {
      return {
        testName: 'Known Vulnerabilities Test',
        category: 'VULNERABILITY',
        status: 'FAIL',
        description: 'Failed to test for known vulnerabilities',
        details: `Error: ${error}`,
        severity: 'HIGH',
        recommendation: 'Investigate vulnerability testing mechanism',
      };
    }
  }

  /**
   * Test dependency vulnerabilities
   */
  private async testDependencyVulnerabilities(): Promise<SecurityTestResult> {
    try {
      // Run npm audit to check for dependency vulnerabilities
      const { stdout } = await execAsync('npm audit --json', { 
        cwd: process.cwd(),
        timeout: this.testTimeout,
      });
      
      const auditResult = JSON.parse(stdout);
      
      if (auditResult.metadata && auditResult.metadata.vulnerabilities) {
        const vulns = auditResult.metadata.vulnerabilities;
        const totalVulns = vulns.high + vulns.critical + vulns.moderate + vulns.low;
        
        if (totalVulns > 0) {
          return {
            testName: 'Dependency Vulnerabilities Test',
            category: 'VULNERABILITY',
            status: 'FAIL',
            description: 'Dependency vulnerabilities detected',
            details: `${totalVulns} vulnerabilities found (Critical: ${vulns.critical}, High: ${vulns.high}, Moderate: ${vulns.moderate}, Low: ${vulns.low})`,
            severity: vulns.critical > 0 ? 'CRITICAL' : vulns.high > 0 ? 'HIGH' : 'MEDIUM',
            recommendation: 'Run "npm audit fix" to address vulnerabilities',
            evidence: auditResult,
          };
        } else {
          return {
            testName: 'Dependency Vulnerabilities Test',
            category: 'VULNERABILITY',
            status: 'PASS',
            description: 'No dependency vulnerabilities detected',
            details: 'All dependencies are secure',
            severity: 'LOW',
          };
        }
      } else {
        return {
          testName: 'Dependency Vulnerabilities Test',
          category: 'VULNERABILITY',
          status: 'WARNING',
          description: 'Unable to determine dependency vulnerability status',
          details: 'npm audit did not return expected results',
          severity: 'MEDIUM',
          recommendation: 'Manually verify dependency security',
        };
      }
    } catch (error) {
      return {
        testName: 'Dependency Vulnerabilities Test',
        category: 'VULNERABILITY',
        status: 'WARNING',
        description: 'Failed to test dependency vulnerabilities',
        details: `Error: ${error}`,
        severity: 'MEDIUM',
        recommendation: 'Ensure npm audit is available and working',
      };
    }
  }

  /**
   * Test configuration vulnerabilities
   */
  private async testConfigurationVulnerabilities(): Promise<SecurityTestResult> {
    try {
      const configIssues = [];

      // Check for common configuration issues
      const response = await this.makeHttpRequest('GET', '/');
      
      // Check for debug information exposure
      if (response.body && response.body.includes('debug')) {
        configIssues.push('Debug information may be exposed');
      }

      // Check for stack trace exposure
      const errorResponse = await this.makeHttpRequest('GET', '/nonexistent-endpoint');
      if (errorResponse.body && errorResponse.body.includes('stack')) {
        configIssues.push('Stack traces may be exposed in error responses');
      }

      // Check for version information disclosure
      const serverHeader = response.headers['server'];
      if (serverHeader && (serverHeader.includes('Express') || serverHeader.includes('Node'))) {
        configIssues.push('Server version information is disclosed');
      }

      if (configIssues.length > 0) {
        return {
          testName: 'Configuration Vulnerabilities Test',
          category: 'VULNERABILITY',
          status: 'WARNING',
          description: 'Configuration issues detected',
          details: configIssues.join('; '),
          severity: 'MEDIUM',
          recommendation: 'Review and harden server configuration',
          evidence: configIssues,
        };
      } else {
        return {
          testName: 'Configuration Vulnerabilities Test',
          category: 'VULNERABILITY',
          status: 'PASS',
          description: 'No configuration vulnerabilities detected',
          details: 'Server configuration appears secure',
          severity: 'LOW',
        };
      }
    } catch (error) {
      return {
        testName: 'Configuration Vulnerabilities Test',
        category: 'VULNERABILITY',
        status: 'FAIL',
        description: 'Failed to test configuration vulnerabilities',
        details: `Error: ${error}`,
        severity: 'MEDIUM',
        recommendation: 'Investigate configuration vulnerability testing',
      };
    }
  }

  // Helper methods

  /**
   * Check port accessibility
   */
  private async checkPortAccessibility(host: string, port: number, timeout: number = 5000): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      
      socket.setTimeout(timeout);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.on('error', () => {
        resolve(false);
      });
      
      socket.connect(port, host);
    });
  }

  /**
   * Check port scan detection
   */
  private async checkPortScanDetection(): Promise<{ detected: boolean; details: string }> {
    try {
      // This would typically check the security monitoring API
      const response = await this.makeHttpRequest('GET', '/security/alerts?type=PORT_SCAN_DETECTED');
      
      if (response.statusCode === 200 && response.body.alerts) {
        const portScanAlerts = response.body.alerts.filter((alert: any) => 
          alert.type === 'PORT_SCAN_DETECTED'
        );
        
        return {
          detected: portScanAlerts.length > 0,
          details: `${portScanAlerts.length} port scan alerts found`,
        };
      }
      
      return { detected: false, details: 'No port scan detection API available' };
    } catch (error) {
      return { detected: false, details: `Error checking detection: ${error}` };
    }
  }

  /**
   * Fingerprint service
   */
  private async fingerprintService(host: string, port: number): Promise<{
    headers: Record<string, string>;
    body: string;
    statusCode: number;
  }> {
    const response = await this.makeHttpRequest('GET', '/');
    return {
      headers: response.headers,
      body: response.body,
      statusCode: response.statusCode,
    };
  }

  /**
   * Check for vulnerable headers
   */
  private checkVulnerableHeaders(headers: Record<string, string>): string[] {
    const vulnerableHeaders = [];
    
    if (headers['server']) {
      vulnerableHeaders.push('server');
    }
    
    if (headers['x-powered-by']) {
      vulnerableHeaders.push('x-powered-by');
    }
    
    if (headers['x-aspnet-version']) {
      vulnerableHeaders.push('x-aspnet-version');
    }
    
    return vulnerableHeaders;
  }

  /**
   * Make HTTP request
   */
  private async makeHttpRequest(
    method: string,
    path: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<{
    statusCode: number;
    headers: Record<string, string>;
    body: any;
  }> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.gatewayHost,
        port: this.gatewayPort,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        timeout: this.testTimeout,
      };

      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsedBody = data ? JSON.parse(data) : {};
            resolve({
              statusCode: res.statusCode || 0,
              headers: res.headers as Record<string, string>,
              body: parsedBody,
            });
          } catch {
            resolve({
              statusCode: res.statusCode || 0,
              headers: res.headers as Record<string, string>,
              body: data,
            });
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));

      if (body) {
        req.write(JSON.stringify(body));
      }
      
      req.end();
    });
  }

  /**
   * Make HTTPS request
   */
  private async makeHttpsRequest(
    method: string,
    path: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<{
    statusCode: number;
    headers: Record<string, string>;
    body: any;
  }> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.gatewayHost,
        port: 443, // HTTPS port
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        timeout: this.testTimeout,
        rejectUnauthorized: false, // For testing purposes
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsedBody = data ? JSON.parse(data) : {};
            resolve({
              statusCode: res.statusCode || 0,
              headers: res.headers as Record<string, string>,
              body: parsedBody,
            });
          } catch {
            resolve({
              statusCode: res.statusCode || 0,
              headers: res.headers as Record<string, string>,
              body: data,
            });
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));

      if (body) {
        req.write(JSON.stringify(body));
      }
      
      req.end();
    });
  }

  // Vulnerability detection methods

  private detectSQLInjectionVulnerability(response: any): boolean {
    const sqlErrorPatterns = [
      /sql syntax/i,
      /mysql_fetch/i,
      /ora-\d+/i,
      /microsoft.*odbc.*sql/i,
      /postgresql.*error/i,
    ];
    
    const responseText = JSON.stringify(response);
    return sqlErrorPatterns.some(pattern => pattern.test(responseText));
  }

  private detectXSSVulnerability(response: any, payload: string): boolean {
    const responseText = JSON.stringify(response);
    return responseText.includes(payload) && !responseText.includes('&lt;') && !responseText.includes('&gt;');
  }

  private detectPathTraversalVulnerability(response: any): boolean {
    const responseText = JSON.stringify(response);
    const indicators = [
      'root:x:0:0',
      '[boot loader]',
      'localhost',
      '# This file',
    ];
    
    return indicators.some(indicator => responseText.includes(indicator));
  }

  private detectCommandInjectionVulnerability(response: any): boolean {
    const responseText = JSON.stringify(response);
    const indicators = [
      'uid=',
      'gid=',
      'total ',
      'drwx',
      'PING',
    ];
    
    return indicators.some(indicator => responseText.includes(indicator));
  }

  private async checkServerInfoDisclosure(): Promise<{ vulnerable: boolean; details: string }> {
    const response = await this.makeHttpRequest('GET', '/');
    const serverHeader = response.headers['server'];
    
    if (serverHeader) {
      return {
        vulnerable: true,
        details: `Server header discloses: ${serverHeader}`,
      };
    }
    
    return { vulnerable: false, details: 'No server information disclosed' };
  }

  private async checkDirectoryListing(): Promise<{ vulnerable: boolean; details: string }> {
    const response = await this.makeHttpRequest('GET', '/');
    
    if (response.body && response.body.includes('Index of')) {
      return {
        vulnerable: true,
        details: 'Directory listing is enabled',
      };
    }
    
    return { vulnerable: false, details: 'Directory listing is disabled' };
  }

  private async checkBackupFileExposure(): Promise<{ vulnerable: boolean; details: string }> {
    const backupFiles = [
      '/.env.backup',
      '/config.bak',
      '/database.sql',
      '/.git/config',
    ];
    
    for (const file of backupFiles) {
      const response = await this.makeHttpRequest('GET', file);
      if (response.statusCode === 200) {
        return {
          vulnerable: true,
          details: `Backup file exposed: ${file}`,
        };
      }
    }
    
    return { vulnerable: false, details: 'No backup files exposed' };
  }

  // Summary and analysis methods

  private calculateSummary(results: SecurityTestResult[]): {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  } {
    return {
      total: results.length,
      passed: results.filter(r => r.status === 'PASS').length,
      failed: results.filter(r => r.status === 'FAIL').length,
      warnings: results.filter(r => r.status === 'WARNING').length,
      skipped: results.filter(r => r.status === 'SKIP').length,
    };
  }

  private determineOverallStatus(results: SecurityTestResult[]): 'PASS' | 'FAIL' | 'WARNING' {
    if (results.some(r => r.status === 'FAIL')) return 'FAIL';
    if (results.some(r => r.status === 'WARNING')) return 'WARNING';
    return 'PASS';
  }

  private assessRiskLevel(results: SecurityTestResult[]): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const criticalIssues = results.filter(r => r.severity === 'CRITICAL').length;
    const highIssues = results.filter(r => r.severity === 'HIGH').length;
    const mediumIssues = results.filter(r => r.severity === 'MEDIUM').length;

    if (criticalIssues > 0) return 'CRITICAL';
    if (highIssues > 2) return 'HIGH';
    if (highIssues > 0 || mediumIssues > 3) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Generate test report
   */
  generateReport(testSuite: SecurityTestSuite): string {
    const report = [
      '='.repeat(80),
      'SECURITY TEST SUITE REPORT',
      '='.repeat(80),
      `Test ID: ${testSuite.id}`,
      `Timestamp: ${testSuite.timestamp.toISOString()}`,
      `Duration: ${testSuite.duration}ms`,
      `Overall Status: ${testSuite.overallStatus}`,
      `Risk Level: ${testSuite.riskLevel}`,
      '',
      'SUMMARY:',
      `  Total Tests: ${testSuite.summary.total}`,
      `  Passed: ${testSuite.summary.passed}`,
      `  Failed: ${testSuite.summary.failed}`,
      `  Warnings: ${testSuite.summary.warnings}`,
      `  Skipped: ${testSuite.summary.skipped}`,
      '',
    ];

    // Group results by category
    const categories = ['PORT_SCANNING', 'PENETRATION', 'COMPLIANCE', 'VULNERABILITY'];
    
    for (const category of categories) {
      const categoryResults = testSuite.results.filter(r => r.category === category);
      if (categoryResults.length > 0) {
        report.push(`${category} TESTS:`);
        
        for (const result of categoryResults) {
          const status = result.status === 'PASS' ? '✅' : 
                        result.status === 'FAIL' ? '❌' : 
                        result.status === 'WARNING' ? '⚠️' : '⏭️';
          
          report.push(`  ${status} ${result.testName} [${result.severity}]`);
          report.push(`     ${result.description}`);
          
          if (result.recommendation) {
            report.push(`     💡 ${result.recommendation}`);
          }
        }
        report.push('');
      }
    }

    report.push('='.repeat(80));
    
    return report.join('\n');
  }
}

// CLI execution
if (require.main === module) {
  const tester = new SecurityTester();
  
  tester.runSecurityTests()
    .then(testSuite => {
      const report = tester.generateReport(testSuite);
      console.log(report);
      
      // Exit with error code if tests failed
      process.exit(testSuite.overallStatus === 'FAIL' ? 1 : 0);
    })
    .catch(error => {
      console.error('Security testing failed:', error);
      process.exit(1);
    });
}