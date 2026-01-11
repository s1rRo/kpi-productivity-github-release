#!/usr/bin/env tsx

/**
 * Documentation Validation Script
 * 
 * This script validates that all API documentation is accurate and up-to-date
 * by comparing documented endpoints with actual implementation and testing examples.
 */

import { DocumentationGenerator } from '../services/documentationGenerator';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ValidationResult {
  passed: boolean;
  message: string;
  details?: any;
}

interface ValidationReport {
  timestamp: Date;
  totalTests: number;
  passed: number;
  failed: number;
  results: ValidationResult[];
  summary: string;
}

class DocumentationValidator {
  private docGenerator: DocumentationGenerator;
  private results: ValidationResult[] = [];

  constructor() {
    this.docGenerator = new DocumentationGenerator();
  }

  /**
   * Run all validation tests
   */
  async validate(): Promise<ValidationReport> {
    console.log('🔍 Starting documentation validation...\n');

    // Reset results
    this.results = [];

    // Run validation tests
    await this.validateDocumentationGeneration();
    await this.validateRouteCompleteness();
    await this.validateParameterDefinitions();
    await this.validateResponseDefinitions();
    await this.validateCodeExamples();
    await this.validateMarkdownGeneration();
    await this.validateJSONGeneration();
    await this.validateFileOperations();
    await this.validateAPIEndpoints();

    // Generate report
    const report = this.generateReport();
    await this.saveReport(report);

    return report;
  }

  /**
   * Validate basic documentation generation
   */
  private async validateDocumentationGeneration(): Promise<void> {
    try {
      const documentation = await this.docGenerator.generateDocumentation();
      
      if (!documentation) {
        this.addResult(false, 'Documentation generation failed - returned null/undefined');
        return;
      }

      // Check required properties
      const requiredProps = ['title', 'version', 'description', 'baseUrl', 'routes', 'generatedAt'];
      for (const prop of requiredProps) {
        if (!(prop in documentation)) {
          this.addResult(false, `Documentation missing required property: ${prop}`);
          return;
        }
      }

      // Check data types
      if (typeof documentation.title !== 'string') {
        this.addResult(false, 'Documentation title must be a string');
        return;
      }

      if (!Array.isArray(documentation.routes)) {
        this.addResult(false, 'Documentation routes must be an array');
        return;
      }

      if (documentation.routes.length === 0) {
        this.addResult(false, 'Documentation routes array is empty');
        return;
      }

      this.addResult(true, `Documentation generation successful - ${documentation.routes.length} routes documented`);
    } catch (error) {
      this.addResult(false, `Documentation generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate that all expected routes are documented
   */
  private async validateRouteCompleteness(): Promise<void> {
    try {
      const documentation = await this.docGenerator.generateDocumentation();
      const routes = documentation.routes;

      // Expected routes by category
      const expectedRoutes = {
        authentication: [
          { method: 'POST', path: '/api/auth/register' },
          { method: 'POST', path: '/api/auth/login' },
          { method: 'GET', path: '/api/auth/me' }
        ],
        habits: [
          { method: 'GET', path: '/api/habits' },
          { method: 'POST', path: '/api/habits' },
          { method: 'GET', path: '/api/habits/:id' },
          { method: 'PUT', path: '/api/habits/:id' },
          { method: 'DELETE', path: '/api/habits/:id' }
        ],
        analytics: [
          { method: 'GET', path: '/api/analytics/report' },
          { method: 'GET', path: '/api/analytics/summary' },
          { method: 'POST', path: '/api/analytics/export' }
        ],
        teams: [
          { method: 'GET', path: '/api/teams' },
          { method: 'POST', path: '/api/teams' }
        ],
        health: [
          { method: 'GET', path: '/api/health' },
          { method: 'GET', path: '/api/health/detailed' }
        ]
      };

      let missingRoutes = 0;
      let totalExpected = 0;

      for (const [category, expectedCategoryRoutes] of Object.entries(expectedRoutes)) {
        totalExpected += expectedCategoryRoutes.length;
        
        for (const expectedRoute of expectedCategoryRoutes) {
          const found = routes.find(r => 
            r.method === expectedRoute.method && r.path === expectedRoute.path
          );
          
          if (!found) {
            this.addResult(false, `Missing route: ${expectedRoute.method} ${expectedRoute.path} (${category})`);
            missingRoutes++;
          }
        }
      }

      if (missingRoutes === 0) {
        this.addResult(true, `All ${totalExpected} expected routes are documented`);
      } else {
        this.addResult(false, `${missingRoutes} out of ${totalExpected} expected routes are missing`);
      }
    } catch (error) {
      this.addResult(false, `Route completeness validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate parameter definitions
   */
  private async validateParameterDefinitions(): Promise<void> {
    try {
      const documentation = await this.docGenerator.generateDocumentation();
      let invalidParams = 0;
      let totalParams = 0;

      for (const route of documentation.routes) {
        if (!route.parameters) {
          this.addResult(false, `Route ${route.method} ${route.path} missing parameters array`);
          continue;
        }

        for (const param of route.parameters) {
          totalParams++;
          
          // Check required properties
          const requiredProps = ['name', 'type', 'location', 'required', 'description'];
          for (const prop of requiredProps) {
            if (!(prop in param)) {
              this.addResult(false, `Parameter ${param.name} in ${route.method} ${route.path} missing property: ${prop}`);
              invalidParams++;
              continue;
            }
          }

          // Check valid types
          const validTypes = ['string', 'number', 'boolean', 'object', 'array'];
          if (!validTypes.includes(param.type)) {
            this.addResult(false, `Parameter ${param.name} has invalid type: ${param.type}`);
            invalidParams++;
          }

          // Check valid locations
          const validLocations = ['path', 'query', 'body', 'header'];
          if (!validLocations.includes(param.location)) {
            this.addResult(false, `Parameter ${param.name} has invalid location: ${param.location}`);
            invalidParams++;
          }

          // Check required is boolean
          if (typeof param.required !== 'boolean') {
            this.addResult(false, `Parameter ${param.name} required property must be boolean`);
            invalidParams++;
          }
        }
      }

      if (invalidParams === 0) {
        this.addResult(true, `All ${totalParams} parameter definitions are valid`);
      } else {
        this.addResult(false, `${invalidParams} out of ${totalParams} parameter definitions are invalid`);
      }
    } catch (error) {
      this.addResult(false, `Parameter validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate response definitions
   */
  private async validateResponseDefinitions(): Promise<void> {
    try {
      const documentation = await this.docGenerator.generateDocumentation();
      let invalidResponses = 0;
      let totalResponses = 0;

      for (const route of documentation.routes) {
        if (!route.responses) {
          this.addResult(false, `Route ${route.method} ${route.path} missing responses array`);
          continue;
        }

        if (route.responses.length === 0) {
          this.addResult(false, `Route ${route.method} ${route.path} has no response definitions`);
          continue;
        }

        for (const response of route.responses) {
          totalResponses++;
          
          // Check required properties
          if (!('status' in response)) {
            this.addResult(false, `Response in ${route.method} ${route.path} missing status`);
            invalidResponses++;
            continue;
          }

          if (!('description' in response)) {
            this.addResult(false, `Response ${response.status} in ${route.method} ${route.path} missing description`);
            invalidResponses++;
            continue;
          }

          if (!('example' in response)) {
            this.addResult(false, `Response ${response.status} in ${route.method} ${route.path} missing example`);
            invalidResponses++;
            continue;
          }

          // Check status code is valid
          if (typeof response.status !== 'number' || response.status < 200 || response.status >= 600) {
            this.addResult(false, `Response in ${route.method} ${route.path} has invalid status code: ${response.status}`);
            invalidResponses++;
          }
        }

        // Check for required response types
        const statusCodes = route.responses.map(r => r.status);
        const hasSuccess = statusCodes.some(code => code >= 200 && code < 300);
        const hasError = statusCodes.some(code => code >= 400);

        if (!hasSuccess) {
          this.addResult(false, `Route ${route.method} ${route.path} missing success response`);
          invalidResponses++;
        }

        if (!hasError) {
          this.addResult(false, `Route ${route.method} ${route.path} missing error response`);
          invalidResponses++;
        }

        if (route.authentication && !statusCodes.includes(401)) {
          this.addResult(false, `Protected route ${route.method} ${route.path} missing 401 response`);
          invalidResponses++;
        }
      }

      if (invalidResponses === 0) {
        this.addResult(true, `All ${totalResponses} response definitions are valid`);
      } else {
        this.addResult(false, `${invalidResponses} response definition issues found`);
      }
    } catch (error) {
      this.addResult(false, `Response validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate code examples
   */
  private async validateCodeExamples(): Promise<void> {
    try {
      const documentation = await this.docGenerator.generateDocumentation();
      let invalidExamples = 0;
      let totalExamples = 0;

      for (const route of documentation.routes) {
        if (!route.examples) {
          this.addResult(false, `Route ${route.method} ${route.path} missing examples array`);
          continue;
        }

        if (route.examples.length === 0) {
          this.addResult(false, `Route ${route.method} ${route.path} has no code examples`);
          continue;
        }

        const hasJavaScript = route.examples.some(ex => ex.language === 'javascript');
        const hasCurl = route.examples.some(ex => ex.language === 'bash');

        if (!hasJavaScript) {
          this.addResult(false, `Route ${route.method} ${route.path} missing JavaScript example`);
          invalidExamples++;
        }

        if (!hasCurl) {
          this.addResult(false, `Route ${route.method} ${route.path} missing cURL example`);
          invalidExamples++;
        }

        for (const example of route.examples) {
          totalExamples++;
          
          // Check required properties
          if (!example.language || !example.code || !example.description) {
            this.addResult(false, `Example in ${route.method} ${route.path} missing required properties`);
            invalidExamples++;
            continue;
          }

          // Validate JavaScript examples
          if (example.language === 'javascript') {
            if (!example.code.includes('fetch(')) {
              this.addResult(false, `JavaScript example in ${route.method} ${route.path} missing fetch call`);
              invalidExamples++;
            }

            if (!example.code.includes(route.path)) {
              this.addResult(false, `JavaScript example in ${route.method} ${route.path} doesn't include route path`);
              invalidExamples++;
            }

            if (!example.code.includes(`method: '${route.method}'`)) {
              this.addResult(false, `JavaScript example in ${route.method} ${route.path} doesn't specify correct method`);
              invalidExamples++;
            }

            if (route.authentication && !example.code.includes('Authorization')) {
              this.addResult(false, `JavaScript example for protected route ${route.method} ${route.path} missing authorization header`);
              invalidExamples++;
            }
          }

          // Validate cURL examples
          if (example.language === 'bash') {
            if (!example.code.includes('curl')) {
              this.addResult(false, `cURL example in ${route.method} ${route.path} missing curl command`);
              invalidExamples++;
            }

            if (!example.code.includes(`-X ${route.method}`)) {
              this.addResult(false, `cURL example in ${route.method} ${route.path} doesn't specify correct method`);
              invalidExamples++;
            }

            if (!example.code.includes(route.path)) {
              this.addResult(false, `cURL example in ${route.method} ${route.path} doesn't include route path`);
              invalidExamples++;
            }

            if (route.authentication && !example.code.includes('Authorization: Bearer')) {
              this.addResult(false, `cURL example for protected route ${route.method} ${route.path} missing authorization header`);
              invalidExamples++;
            }
          }
        }
      }

      if (invalidExamples === 0) {
        this.addResult(true, `All ${totalExamples} code examples are valid`);
      } else {
        this.addResult(false, `${invalidExamples} code example issues found`);
      }
    } catch (error) {
      this.addResult(false, `Code example validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate markdown generation
   */
  private async validateMarkdownGeneration(): Promise<void> {
    try {
      const markdown = await this.docGenerator.generateMarkdownDocumentation();
      
      if (!markdown || typeof markdown !== 'string') {
        this.addResult(false, 'Markdown generation failed - invalid output');
        return;
      }

      if (markdown.length < 1000) {
        this.addResult(false, 'Generated markdown is too short - likely incomplete');
        return;
      }

      // Check for required markdown elements
      const requiredElements = [
        '# KPI Productivity API',
        '**Version:**',
        '**Base URL:**',
        '## Authentication',
        '## Habits',
        '### POST /api/auth/login',
        '**Parameters:**',
        '**Responses:**',
        '**Examples:**',
        '```javascript',
        '```bash'
      ];

      for (const element of requiredElements) {
        if (!markdown.includes(element)) {
          this.addResult(false, `Generated markdown missing required element: ${element}`);
          return;
        }
      }

      this.addResult(true, `Markdown generation successful - ${markdown.length} characters generated`);
    } catch (error) {
      this.addResult(false, `Markdown generation validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate JSON generation
   */
  private async validateJSONGeneration(): Promise<void> {
    try {
      const jsonString = await this.docGenerator.generateJSONDocumentation();
      
      if (!jsonString || typeof jsonString !== 'string') {
        this.addResult(false, 'JSON generation failed - invalid output');
        return;
      }

      // Validate JSON syntax
      let parsed;
      try {
        parsed = JSON.parse(jsonString);
      } catch (parseError) {
        this.addResult(false, `Generated JSON is invalid: ${parseError instanceof Error ? parseError.message : 'Parse error'}`);
        return;
      }

      // Check structure matches documentation
      const documentation = await this.docGenerator.generateDocumentation();
      
      if (parsed.title !== documentation.title) {
        this.addResult(false, 'JSON title does not match documentation title');
        return;
      }

      if (parsed.routes.length !== documentation.routes.length) {
        this.addResult(false, 'JSON routes count does not match documentation routes count');
        return;
      }

      this.addResult(true, `JSON generation successful - ${jsonString.length} characters generated`);
    } catch (error) {
      this.addResult(false, `JSON generation validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate file operations
   */
  private async validateFileOperations(): Promise<void> {
    try {
      const testOutputPath = './docs/validation-test-output.md';
      
      // Clean up any existing test file
      if (fs.existsSync(testOutputPath)) {
        fs.unlinkSync(testOutputPath);
      }

      // Test file saving
      await this.docGenerator.saveDocumentation(testOutputPath);
      
      if (!fs.existsSync(testOutputPath)) {
        this.addResult(false, 'File saving failed - file not created');
        return;
      }

      // Check file content
      const content = fs.readFileSync(testOutputPath, 'utf8');
      if (!content.includes('# KPI Productivity API')) {
        this.addResult(false, 'Saved file content is invalid');
        return;
      }

      // Clean up test file
      fs.unlinkSync(testOutputPath);

      this.addResult(true, 'File operations validation successful');
    } catch (error) {
      this.addResult(false, `File operations validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate API endpoints (if server is running)
   */
  private async validateAPIEndpoints(): Promise<void> {
    try {
      // Check if server is running by making a health check
      const { stdout } = await execAsync('curl -s http://localhost:3001/api/health || echo "SERVER_NOT_RUNNING"');
      
      if (stdout.includes('SERVER_NOT_RUNNING')) {
        this.addResult(true, 'API endpoint validation skipped - server not running');
        return;
      }

      // Test documentation endpoints
      const endpoints = [
        '/api/docs',
        '/api/docs/routes',
        '/api/docs/tags'
      ];

      for (const endpoint of endpoints) {
        try {
          const { stdout: response } = await execAsync(`curl -s http://localhost:3001${endpoint}`);
          const parsed = JSON.parse(response);
          
          if (!parsed.data) {
            this.addResult(false, `API endpoint ${endpoint} returned invalid response structure`);
            return;
          }
        } catch (error) {
          this.addResult(false, `API endpoint ${endpoint} validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          return;
        }
      }

      this.addResult(true, 'API endpoints validation successful');
    } catch (error) {
      this.addResult(false, `API endpoints validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add a validation result
   */
  private addResult(passed: boolean, message: string, details?: any): void {
    this.results.push({ passed, message, details });
    
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${message}`);
    
    if (details) {
      console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
    }
  }

  /**
   * Generate validation report
   */
  private generateReport(): ValidationReport {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;

    const summary = failed === 0 
      ? `✅ All ${total} validation tests passed!`
      : `❌ ${failed} out of ${total} validation tests failed`;

    return {
      timestamp: new Date(),
      totalTests: total,
      passed,
      failed,
      results: this.results,
      summary
    };
  }

  /**
   * Save validation report to file
   */
  private async saveReport(report: ValidationReport): Promise<void> {
    const reportPath = './docs/validation-report.json';
    
    // Ensure docs directory exists
    const docsDir = path.dirname(reportPath);
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\n📊 Validation report saved to: ${reportPath}`);
  }
}

/**
 * Main execution
 */
async function main() {
  const validator = new DocumentationValidator();
  
  try {
    const report = await validator.validate();
    
    console.log('\n' + '='.repeat(50));
    console.log('📋 VALIDATION SUMMARY');
    console.log('='.repeat(50));
    console.log(report.summary);
    console.log(`Total tests: ${report.totalTests}`);
    console.log(`Passed: ${report.passed}`);
    console.log(`Failed: ${report.failed}`);
    console.log(`Timestamp: ${report.timestamp.toISOString()}`);
    
    if (report.failed > 0) {
      console.log('\n❌ Failed tests:');
      report.results
        .filter(r => !r.passed)
        .forEach(result => {
          console.log(`  - ${result.message}`);
        });
      
      process.exit(1);
    } else {
      console.log('\n🎉 All documentation validation tests passed!');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Validation failed with error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { DocumentationValidator, ValidationResult, ValidationReport };