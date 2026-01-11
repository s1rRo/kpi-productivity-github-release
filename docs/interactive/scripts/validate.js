#!/usr/bin/env node

/**
 * Documentation Validation Script
 * Validates documentation consistency, links, and format
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DocumentationValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.docsPath = path.join(__dirname, '../../');
  }

  async validate() {
    console.log('🔍 Starting documentation validation...\n');

    await this.validateStructure();
    await this.validateContent();
    await this.validateLinks();
    await this.validateExamples();

    this.printResults();
    
    // Exit with error code if there are errors
    if (this.errors.length > 0) {
      process.exit(1);
    }
  }

  async validateStructure() {
    console.log('📁 Validating documentation structure...');

    const requiredFiles = [
      'API.md',
      'DEPLOYMENT.md',
      'MONITORING.md',
      'USER_GUIDE.md'
    ];

    const requiredDirs = [
      'api',
      'monitoring',
      'service-integration'
    ];

    // Check required files
    for (const file of requiredFiles) {
      const filePath = path.join(this.docsPath, file);
      try {
        await fs.access(filePath);
        console.log(`  ✅ ${file} exists`);
      } catch {
        this.errors.push(`Missing required file: ${file}`);
        console.log(`  ❌ ${file} missing`);
      }
    }

    // Check required directories
    for (const dir of requiredDirs) {
      const dirPath = path.join(this.docsPath, dir);
      try {
        const stat = await fs.stat(dirPath);
        if (stat.isDirectory()) {
          console.log(`  ✅ ${dir}/ directory exists`);
        } else {
          this.errors.push(`${dir} exists but is not a directory`);
        }
      } catch {
        this.errors.push(`Missing required directory: ${dir}/`);
        console.log(`  ❌ ${dir}/ directory missing`);
      }
    }
  }

  async validateContent() {
    console.log('\n📝 Validating content format...');

    const files = await this.getAllMarkdownFiles();

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const relativePath = path.relative(this.docsPath, file);

        // Check for title
        if (!content.match(/^#\s+.+$/m)) {
          this.warnings.push(`${relativePath}: Missing main title (# Title)`);
        }

        // Check for empty content
        if (content.trim().length < 100) {
          this.warnings.push(`${relativePath}: Content seems too short (< 100 characters)`);
        }

        // Check for code blocks without language
        const codeBlocks = content.match(/```\n/g);
        if (codeBlocks) {
          this.warnings.push(`${relativePath}: Found ${codeBlocks.length} code block(s) without language specification`);
        }

        console.log(`  ✅ ${relativePath} validated`);
      } catch (error) {
        this.errors.push(`Failed to read ${file}: ${error.message}`);
      }
    }
  }

  async validateLinks() {
    console.log('\n🔗 Validating internal links...');

    const files = await this.getAllMarkdownFiles();

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const relativePath = path.relative(this.docsPath, file);

        // Find all markdown links
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let match;

        while ((match = linkRegex.exec(content)) !== null) {
          const linkText = match[1];
          const linkUrl = match[2];

          // Check internal links (starting with / or relative paths)
          if (linkUrl.startsWith('/') || (!linkUrl.startsWith('http') && !linkUrl.startsWith('#'))) {
            // For now, just warn about internal links
            this.warnings.push(`${relativePath}: Internal link found - verify manually: [${linkText}](${linkUrl})`);
          }

          // Check for broken external links (basic check)
          if (linkUrl.startsWith('http')) {
            // Could implement HTTP check here, but for now just log
            console.log(`  🌐 External link in ${relativePath}: ${linkUrl}`);
          }
        }
      } catch (error) {
        this.errors.push(`Failed to validate links in ${file}: ${error.message}`);
      }
    }
  }

  async validateExamples() {
    console.log('\n💻 Validating code examples...');

    const files = await this.getAllMarkdownFiles();

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const relativePath = path.relative(this.docsPath, file);

        // Find code blocks
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        let match;
        let exampleCount = 0;

        while ((match = codeBlockRegex.exec(content)) !== null) {
          const language = match[1];
          const code = match[2];
          exampleCount++;

          if (language === 'javascript' || language === 'js') {
            // Basic JavaScript syntax validation
            if (code.includes('await') && !code.includes('async')) {
              this.warnings.push(`${relativePath}: JavaScript example may be missing 'async' keyword`);
            }
          }

          if (language === 'bash' || language === 'sh') {
            // Check for potentially dangerous commands
            const dangerousCommands = ['rm -rf', 'sudo rm', 'format', 'del /f'];
            for (const cmd of dangerousCommands) {
              if (code.includes(cmd)) {
                this.warnings.push(`${relativePath}: Bash example contains potentially dangerous command: ${cmd}`);
              }
            }
          }

          if (language === 'json') {
            // Validate JSON syntax
            try {
              JSON.parse(code);
            } catch {
              this.errors.push(`${relativePath}: Invalid JSON in code example`);
            }
          }
        }

        if (exampleCount > 0) {
          console.log(`  ✅ ${relativePath}: ${exampleCount} code example(s) validated`);
        }
      } catch (error) {
        this.errors.push(`Failed to validate examples in ${file}: ${error.message}`);
      }
    }
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

  printResults() {
    console.log('\n📊 Validation Results:');
    console.log('='.repeat(50));

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('🎉 All documentation validation checks passed!');
      return;
    }

    if (this.errors.length > 0) {
      console.log(`\n❌ Errors (${this.errors.length}):`);
      this.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    if (this.warnings.length > 0) {
      console.log(`\n⚠️  Warnings (${this.warnings.length}):`);
      this.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning}`);
      });
    }

    console.log('\n📈 Summary:');
    console.log(`  Errors: ${this.errors.length}`);
    console.log(`  Warnings: ${this.warnings.length}`);
    
    if (this.errors.length > 0) {
      console.log('\n💡 Please fix the errors above before proceeding.');
    } else {
      console.log('\n✅ No critical errors found. Review warnings if needed.');
    }
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new DocumentationValidator();
  validator.validate().catch(error => {
    console.error('💥 Validation failed:', error);
    process.exit(1);
  });
}

export default DocumentationValidator;