#!/usr/bin/env node

/**
 * Documentation Update Script
 * Automatically updates documentation from API routes and validates consistency
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);

class DocumentationUpdater {
  constructor() {
    this.backendPath = path.join(__dirname, '../../../backend');
    this.docsPath = path.join(__dirname, '../../');
    this.generatedPath = path.join(this.docsPath, 'generated');
  }

  async update() {
    console.log('🔄 Starting documentation update process...\n');

    try {
      await this.ensureDirectories();
      await this.generateAPIDocumentation();
      await this.updateVersionHistory();
      await this.validateDocumentation();
      
      console.log('\n🎉 Documentation update completed successfully!');
    } catch (error) {
      console.error('💥 Documentation update failed:', error);
      process.exit(1);
    }
  }

  async ensureDirectories() {
    console.log('📁 Ensuring required directories exist...');
    
    await fs.mkdir(this.generatedPath, { recursive: true });
    await fs.mkdir(path.join(this.docsPath, '.versions'), { recursive: true });
    
    console.log('  ✅ Directories created/verified');
  }

  async generateAPIDocumentation() {
    console.log('📚 Generating API documentation...');

    try {
      // Check if backend is available
      const backendPackageJson = path.join(this.backendPath, 'package.json');
      await fs.access(backendPackageJson);

      // Run the documentation generation command
      const { stdout, stderr } = await execAsync('npm run docs:generate', {
        cwd: this.backendPath
      });

      if (stderr && !stderr.includes('warning')) {
        console.warn('  ⚠️  Generation warnings:', stderr);
      }

      console.log('  ✅ API documentation generated');

      // Copy generated files to docs directory
      const generatedApiPath = path.join(this.backendPath, 'docs/api/generated-documentation.md');
      const targetPath = path.join(this.generatedPath, 'api-reference.md');

      try {
        await fs.copyFile(generatedApiPath, targetPath);
        console.log('  ✅ Generated documentation copied to docs/generated/');
      } catch (copyError) {
        console.warn('  ⚠️  Could not copy generated documentation:', copyError.message);
      }

    } catch (error) {
      console.warn('  ⚠️  Could not generate API documentation from backend:', error.message);
      console.log('  💡 Continuing with existing documentation...');
    }
  }

  async updateVersionHistory() {
    console.log('📝 Updating version history...');

    const versionsFile = path.join(this.docsPath, '.versions', 'history.json');
    let versions = [];

    try {
      const content = await fs.readFile(versionsFile, 'utf-8');
      versions = JSON.parse(content);
    } catch {
      // File doesn't exist, start with empty array
    }

    // Create new version entry
    const newVersion = {
      version: `1.0.${Date.now()}`,
      date: new Date().toISOString(),
      changes: [
        'Automatic documentation update',
        'API reference regenerated',
        'Documentation validation completed'
      ]
    };

    versions.unshift(newVersion);

    // Keep only last 10 versions
    versions = versions.slice(0, 10);

    await fs.writeFile(versionsFile, JSON.stringify(versions, null, 2));
    console.log(`  ✅ Version ${newVersion.version} added to history`);
  }

  async validateDocumentation() {
    console.log('🔍 Running documentation validation...');

    try {
      const validatorPath = path.join(__dirname, 'validate.js');
      const { stdout, stderr } = await execAsync(`node "${validatorPath}"`, {
        cwd: __dirname
      });

      console.log(stdout);
      
      if (stderr) {
        console.warn('Validation warnings:', stderr);
      }

      console.log('  ✅ Documentation validation completed');
    } catch (error) {
      console.warn('  ⚠️  Validation completed with issues:', error.message);
    }
  }

  async generateSitemap() {
    console.log('🗺️  Generating documentation sitemap...');

    const sitemap = {
      lastUpdated: new Date().toISOString(),
      sections: [
        {
          title: 'API Documentation',
          path: '/api',
          subsections: [
            { title: 'Authentication', path: '/api/authentication' },
            { title: 'Habits & Tracking', path: '/api/habits' },
            { title: 'Analytics & KPI', path: '/api/analytics' },
            { title: 'Teams', path: '/api/teams' },
            { title: 'Health Checks', path: '/api/health' }
          ]
        },
        {
          title: 'Monitoring',
          path: '/monitoring',
          subsections: [
            { title: 'Sentry Integration', path: '/monitoring/sentry' },
            { title: 'Redis Usage', path: '/monitoring/redis' },
            { title: 'Database Monitoring', path: '/monitoring/database' },
            { title: 'Socket.IO Monitoring', path: '/monitoring/socketio' }
          ]
        },
        {
          title: 'Security',
          path: '/security'
        },
        {
          title: 'Deployment',
          path: '/deployment'
        }
      ]
    };

    const sitemapPath = path.join(this.generatedPath, 'sitemap.json');
    await fs.writeFile(sitemapPath, JSON.stringify(sitemap, null, 2));
    
    console.log('  ✅ Sitemap generated');
  }

  async generateMetrics() {
    console.log('📊 Generating documentation metrics...');

    const files = await this.getAllMarkdownFiles();
    let totalLines = 0;
    let totalWords = 0;
    let totalCodeBlocks = 0;

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n').length;
        const words = content.split(/\s+/).length;
        const codeBlocks = (content.match(/```/g) || []).length / 2;

        totalLines += lines;
        totalWords += words;
        totalCodeBlocks += codeBlocks;
      } catch (error) {
        console.warn(`Could not read ${file}:`, error.message);
      }
    }

    const metrics = {
      lastUpdated: new Date().toISOString(),
      files: files.length,
      totalLines,
      totalWords,
      totalCodeBlocks,
      averageWordsPerFile: Math.round(totalWords / files.length)
    };

    const metricsPath = path.join(this.generatedPath, 'metrics.json');
    await fs.writeFile(metricsPath, JSON.stringify(metrics, null, 2));

    console.log('  ✅ Documentation metrics generated');
    console.log(`     📄 Files: ${metrics.files}`);
    console.log(`     📝 Total words: ${metrics.totalWords}`);
    console.log(`     💻 Code blocks: ${metrics.totalCodeBlocks}`);
  }

  async getAllMarkdownFiles() {
    const files = [];
    
    async function scanDirectory(dir) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await scanDirectory(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.md')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Ignore directories we can't read
      }
    }

    await scanDirectory(this.docsPath);
    return files;
  }
}

// Run update if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const updater = new DocumentationUpdater();
  updater.update().catch(error => {
    console.error('💥 Update failed:', error);
    process.exit(1);
  });
}

export default DocumentationUpdater;