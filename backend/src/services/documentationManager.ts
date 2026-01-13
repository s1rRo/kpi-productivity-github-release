import fs from 'fs/promises';
import path from 'path';
import { DocumentationGenerator } from './documentationGenerator';
import Fuse from 'fuse.js';

interface DocumentationSection {
  id: string;
  title: string;
  category: 'api' | 'monitoring' | 'security' | 'deployment';
  content: string;
  lastUpdated: Date;
  tags: string[];
  filePath?: string;
}

interface DocumentationVersion {
  version: string;
  date: Date;
  changes: string[];
  deprecated?: string[];
}

interface SearchResult {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  url: string;
  score: number;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  lastValidated: Date;
}

interface ValidationError {
  type: 'missing_file' | 'invalid_format' | 'broken_link' | 'outdated_content';
  message: string;
  file?: string;
  line?: number;
}

interface ValidationWarning {
  type: 'outdated_example' | 'missing_tag' | 'inconsistent_format';
  message: string;
  file?: string;
  suggestion?: string;
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'error';
  lastUpdate: Date;
  sectionsCount: number;
  versionsCount: number;
  issues: string[];
}

export class DocumentationManager {
  private docGenerator: DocumentationGenerator;
  private docsPath: string;
  private versionsPath: string;
  private searchIndex: Fuse<DocumentationSection> | null = null;

  constructor() {
    this.docGenerator = new DocumentationGenerator();
    this.docsPath = path.join(process.cwd(), '../docs');
    this.versionsPath = path.join(this.docsPath, '.versions');
    this.initializeSearchIndex();
  }

  /**
   * Initialize search index for fast searching
   */
  private async initializeSearchIndex(): Promise<void> {
    try {
      const sections = await this.getAllSections();
      const fuseOptions = {
        keys: [
          { name: 'title', weight: 0.4 },
          { name: 'content', weight: 0.3 },
          { name: 'tags', weight: 0.2 },
          { name: 'category', weight: 0.1 }
        ],
        threshold: 0.3,
        includeScore: true,
        includeMatches: true
      };
      
      this.searchIndex = new Fuse(sections, fuseOptions);
    } catch (error) {
      console.error('Failed to initialize search index:', error);
    }
  }

  /**
   * Get all documentation sections
   */
  async getAllSections(): Promise<DocumentationSection[]> {
    const sections: DocumentationSection[] = [];

    try {
      // Read API documentation sections
      const apiPath = path.join(this.docsPath, 'api');
      const apiFiles = await this.readDirectoryFiles(apiPath, 'api');
      sections.push(...apiFiles);

      // Read monitoring documentation sections
      const monitoringPath = path.join(this.docsPath, 'monitoring');
      const monitoringFiles = await this.readDirectoryFiles(monitoringPath, 'monitoring');
      sections.push(...monitoringFiles);

      // Read service integration documentation
      const servicePath = path.join(this.docsPath, 'service-integration');
      const serviceFiles = await this.readDirectoryFiles(servicePath, 'deployment');
      sections.push(...serviceFiles);

      // Add main documentation files
      const mainFiles = [
        { file: 'API.md', category: 'api' as const, title: 'API Overview' },
        { file: 'MONITORING.md', category: 'monitoring' as const, title: 'Monitoring Overview' },
        { file: 'DEPLOYMENT.md', category: 'deployment' as const, title: 'Deployment Guide' },
        { file: 'USER_GUIDE.md', category: 'api' as const, title: 'User Guide' }
      ];

      for (const mainFile of mainFiles) {
        const filePath = path.join(this.docsPath, mainFile.file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const stats = await fs.stat(filePath);
          
          sections.push({
            id: mainFile.file.replace('.md', '').toLowerCase(),
            title: mainFile.title,
            category: mainFile.category,
            content,
            lastUpdated: stats.mtime,
            tags: this.extractTags(content),
            filePath
          });
        } catch (error) {
          console.warn(`Could not read ${mainFile.file}:`, error);
        }
      }

    } catch (error) {
      console.error('Error reading documentation sections:', error);
    }

    return sections;
  }

  /**
   * Read files from a directory and convert to documentation sections
   */
  private async readDirectoryFiles(
    dirPath: string, 
    category: DocumentationSection['category']
  ): Promise<DocumentationSection[]> {
    const sections: DocumentationSection[] = [];

    try {
      const files = await fs.readdir(dirPath);
      
      for (const file of files) {
        if (file.endsWith('.md')) {
          const filePath = path.join(dirPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const stats = await fs.stat(filePath);
          
          sections.push({
            id: file.replace('.md', '').toLowerCase(),
            title: this.extractTitle(content) || file.replace('.md', ''),
            category,
            content,
            lastUpdated: stats.mtime,
            tags: this.extractTags(content),
            filePath
          });
        }
      }
    } catch (error) {
      console.warn(`Could not read directory ${dirPath}:`, error);
    }

    return sections;
  }

  /**
   * Extract title from markdown content
   */
  private extractTitle(content: string): string | null {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    return titleMatch ? titleMatch[1].trim() : null;
  }

  /**
   * Extract tags from markdown content
   */
  private extractTags(content: string): string[] {
    const tags: string[] = [];
    
    // Extract from common keywords
    const keywords = [
      'authentication', 'jwt', 'token', 'login', 'register',
      'habits', 'tracking', 'analytics', 'kpi', 'dashboard',
      'sentry', 'monitoring', 'redis', 'database', 'health',
      'security', 'firewall', 'ssl', 'https', 'cors',
      'deployment', 'docker', 'nginx', 'production'
    ];

    const lowerContent = content.toLowerCase();
    keywords.forEach(keyword => {
      if (lowerContent.includes(keyword)) {
        tags.push(keyword);
      }
    });

    // Extract from code blocks (API endpoints)
    const apiMatches = content.match(/\/api\/[\w\/]+/g);
    if (apiMatches) {
      apiMatches.forEach(match => {
        const parts = match.split('/');
        if (parts.length > 2) {
          tags.push(parts[2]); // Add the main API category
        }
      });
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Get documentation sections by category
   */
  async getSectionsByCategory(category: DocumentationSection['category']): Promise<DocumentationSection[]> {
    const allSections = await this.getAllSections();
    return allSections.filter(section => section.category === category);
  }

  /**
   * Search documentation content
   */
  async searchDocumentation(query: string): Promise<SearchResult[]> {
    if (!this.searchIndex) {
      await this.initializeSearchIndex();
    }

    if (!this.searchIndex) {
      return [];
    }

    const results = this.searchIndex.search(query);
    
    return results.map(result => ({
      id: result.item.id,
      title: result.item.title,
      category: result.item.category,
      excerpt: this.createExcerpt(result.item.content, query),
      url: this.generateUrl(result.item.category, result.item.id),
      score: 1 - (result.score || 0)
    }));
  }

  /**
   * Create excerpt from content highlighting search terms
   */
  private createExcerpt(content: string, query: string, maxLength: number = 200): string {
    const queryWords = query.toLowerCase().split(/\s+/);
    const sentences = content.split(/[.!?]+/);
    
    // Find sentence containing query terms
    let bestSentence = '';
    let maxMatches = 0;
    
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      const matches = queryWords.filter(word => lowerSentence.includes(word)).length;
      
      if (matches > maxMatches) {
        maxMatches = matches;
        bestSentence = sentence.trim();
      }
    }
    
    if (bestSentence.length > maxLength) {
      return bestSentence.substring(0, maxLength) + '...';
    }
    
    return bestSentence || content.substring(0, maxLength) + '...';
  }

  /**
   * Generate URL for documentation section
   */
  private generateUrl(category: string, id: string): string {
    return `/${category}/${id}`;
  }

  /**
   * Get version history
   */
  async getVersionHistory(): Promise<DocumentationVersion[]> {
    try {
      const versionsFile = path.join(this.versionsPath, 'history.json');
      const content = await fs.readFile(versionsFile, 'utf-8');
      const versions = JSON.parse(content);
      
      return versions.map((v: any) => ({
        ...v,
        date: new Date(v.date)
      }));
    } catch (error) {
      // Return default version if no history exists
      return [{
        version: '1.0.0',
        date: new Date(),
        changes: ['Initial documentation release']
      }];
    }
  }

  /**
   * Create new version entry
   */
  async createVersion(version: string, changes: string[], deprecated?: string[]): Promise<void> {
    try {
      await fs.mkdir(this.versionsPath, { recursive: true });
      
      const versions = await this.getVersionHistory();
      const newVersion: DocumentationVersion = {
        version,
        date: new Date(),
        changes,
        deprecated
      };
      
      versions.unshift(newVersion);
      
      const versionsFile = path.join(this.versionsPath, 'history.json');
      await fs.writeFile(versionsFile, JSON.stringify(versions, null, 2));
    } catch (error) {
      console.error('Error creating version:', error);
      throw error;
    }
  }

  /**
   * Regenerate all documentation
   */
  async regenerateDocumentation(): Promise<void> {
    try {
      // Regenerate API documentation
      const apiDocs = await this.docGenerator.generateDocumentation();
      const apiDocsPath = path.join(this.docsPath, 'generated', 'api.json');
      await fs.mkdir(path.dirname(apiDocsPath), { recursive: true });
      await fs.writeFile(apiDocsPath, JSON.stringify(apiDocs, null, 2));

      // Regenerate markdown documentation
      const markdownDocs = await this.docGenerator.generateMarkdownDocumentation();
      const markdownPath = path.join(this.docsPath, 'generated', 'api.md');
      await fs.writeFile(markdownPath, markdownDocs);

      // Refresh search index
      await this.initializeSearchIndex();

      // Create version entry
      await this.createVersion(
        `1.0.${Date.now()}`,
        ['Automatic documentation regeneration'],
        []
      );

      console.log('Documentation regenerated successfully');
    } catch (error) {
      console.error('Error regenerating documentation:', error);
      throw error;
    }
  }

  /**
   * Validate documentation consistency
   */
  async validateDocumentation(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      const sections = await this.getAllSections();

      // Check for missing files
      const expectedFiles = [
        'API.md', 'MONITORING.md', 'DEPLOYMENT.md', 'USER_GUIDE.md'
      ];

      for (const file of expectedFiles) {
        const filePath = path.join(this.docsPath, file);
        try {
          await fs.access(filePath);
        } catch {
          errors.push({
            type: 'missing_file',
            message: `Required file ${file} is missing`,
            file
          });
        }
      }

      // Validate each section
      for (const section of sections) {
        // Check for empty content
        if (!section.content.trim()) {
          errors.push({
            type: 'invalid_format',
            message: `Section ${section.title} has empty content`,
            file: section.filePath
          });
        }

        // Check for missing title
        if (!this.extractTitle(section.content)) {
          warnings.push({
            type: 'inconsistent_format',
            message: `Section ${section.id} is missing a title`,
            file: section.filePath,
            suggestion: 'Add a # Title at the beginning of the file'
          });
        }

        // Check for outdated content (older than 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        if (section.lastUpdated < thirtyDaysAgo) {
          warnings.push({
            type: 'outdated_content',
            message: `Section ${section.title} hasn't been updated in over 30 days`,
            file: section.filePath,
            suggestion: 'Review and update content if necessary'
          });
        }

        // Check for broken internal links
        const linkMatches = section.content.match(/\[([^\]]+)\]\(([^)]+)\)/g);
        if (linkMatches) {
          for (const link of linkMatches) {
            const urlMatch = link.match(/\(([^)]+)\)/);
            if (urlMatch && urlMatch[1].startsWith('/')) {
              // Internal link - could validate if it exists
              // For now, just warn about relative links
              warnings.push({
                type: 'missing_tag',
                message: `Internal link found in ${section.title}: ${link}`,
                file: section.filePath,
                suggestion: 'Verify that internal links are working correctly'
              });
            }
          }
        }
      }

    } catch (error) {
      errors.push({
        type: 'invalid_format',
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      lastValidated: new Date()
    };
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const issues: string[] = [];
    let status: SystemHealth['status'] = 'healthy';

    try {
      const sections = await this.getAllSections();
      const versions = await this.getVersionHistory();
      const validation = await this.validateDocumentation();

      // Check for critical issues
      if (validation.issues.length > 0) {
        status = 'error';
        issues.push(`${validation.issues.length} validation errors found`);
      }

      // Check for warnings
      if (validation.warnings.length > 5) {
        if (status !== 'error') status = 'warning';
        issues.push(`${validation.warnings.length} validation warnings found`);
      }

      // Check if search index is working
      if (!this.searchIndex) {
        if (status !== 'error') status = 'warning';
        issues.push('Search index not initialized');
      }

      // Check for recent updates
      const lastUpdate = sections.reduce((latest, section) => 
        section.lastUpdated > latest ? section.lastUpdated : latest, 
        new Date(0)
      );

      return {
        status,
        lastUpdate,
        sectionsCount: sections.length,
        versionsCount: versions.length,
        issues
      };

    } catch (error) {
      return {
        status: 'error',
        lastUpdate: new Date(),
        sectionsCount: 0,
        versionsCount: 0,
        issues: [`System health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Schedule automatic documentation updates
   */
  scheduleAutomaticUpdates(): void {
    // Run validation every hour
    setInterval(async () => {
      try {
        const validation = await this.validateDocumentation();
        if (!validation.isValid) {
          console.warn('Documentation validation failed:', validation.issues);
        }
      } catch (error) {
        console.error('Scheduled validation failed:', error);
      }
    }, 60 * 60 * 1000); // 1 hour

    // Refresh search index every 6 hours
    setInterval(async () => {
      try {
        await this.initializeSearchIndex();
        console.log('Search index refreshed');
      } catch (error) {
        console.error('Search index refresh failed:', error);
      }
    }, 6 * 60 * 60 * 1000); // 6 hours

    console.log('Documentation automatic updates scheduled');
  }
}

export { DocumentationManager, DocumentationSection, DocumentationVersion, SearchResult, ValidationResult };