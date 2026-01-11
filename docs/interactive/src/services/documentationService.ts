import axios from 'axios';
import { APIDocumentation, DocumentationSection, DocumentationVersion, SearchResult } from '../types';

class DocumentationService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
  }

  async getAPIDocumentation(): Promise<APIDocumentation> {
    try {
      // Try to get documentation from the backend service
      const response = await axios.get(`${this.baseUrl}/api/documentation`);
      return response.data;
    } catch (error) {
      // Fallback to static documentation if backend is not available
      return this.getStaticAPIDocumentation();
    }
  }

  async getDocumentationSections(): Promise<DocumentationSection[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/documentation/sections`);
      return response.data;
    } catch (error) {
      // Fallback to static sections
      return this.getStaticDocumentationSections();
    }
  }

  async getVersions(): Promise<DocumentationVersion[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/documentation/versions`);
      return response.data;
    } catch (error) {
      // Fallback to static version info
      return [
        {
          version: '1.0.0',
          date: new Date(),
          changes: ['Initial documentation release'],
        }
      ];
    }
  }

  async searchDocumentation(query: string): Promise<SearchResult[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/documentation/search`, {
        params: { q: query }
      });
      return response.data;
    } catch (error) {
      // Fallback to client-side search
      return this.performClientSideSearch(query);
    }
  }

  private async getStaticAPIDocumentation(): Promise<APIDocumentation> {
    // This would typically load from a static JSON file or be embedded
    return {
      title: 'KPI Productivity API',
      version: '1.0.0',
      description: 'Comprehensive API documentation for the KPI Productivity application',
      baseUrl: 'http://localhost:3001',
      routes: [
        {
          method: 'POST',
          path: '/api/auth/register',
          description: 'Register a new user account',
          parameters: [
            {
              name: 'email',
              type: 'string',
              location: 'body',
              required: true,
              description: 'User email address',
              example: 'user@example.com'
            },
            {
              name: 'password',
              type: 'string',
              location: 'body',
              required: true,
              description: 'User password (minimum 6 characters)',
              example: 'password123'
            }
          ],
          responses: [
            {
              status: 201,
              description: 'User created successfully',
              example: {
                message: 'User created successfully',
                user: { id: 'user-id', email: 'user@example.com' },
                token: 'jwt-token'
              }
            }
          ],
          examples: [
            {
              language: 'javascript',
              code: `const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});`,
              description: 'JavaScript fetch example'
            }
          ],
          authentication: false,
          tags: ['authentication']
        },
        {
          method: 'POST',
          path: '/api/auth/login',
          description: 'Authenticate user and receive JWT token',
          parameters: [
            {
              name: 'email',
              type: 'string',
              location: 'body',
              required: true,
              description: 'User email address',
              example: 'user@example.com'
            },
            {
              name: 'password',
              type: 'string',
              location: 'body',
              required: true,
              description: 'User password',
              example: 'password123'
            }
          ],
          responses: [
            {
              status: 200,
              description: 'Login successful',
              example: {
                message: 'Login successful',
                user: { id: 'user-id', email: 'user@example.com' },
                token: 'jwt-token'
              }
            }
          ],
          examples: [
            {
              language: 'javascript',
              code: `const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});`,
              description: 'JavaScript fetch example'
            }
          ],
          authentication: false,
          tags: ['authentication']
        },
        {
          method: 'GET',
          path: '/api/habits',
          description: 'Get all habits for the authenticated user',
          parameters: [
            {
              name: 'Authorization',
              type: 'string',
              location: 'header',
              required: true,
              description: 'Bearer JWT token',
              example: 'Bearer jwt-token'
            }
          ],
          responses: [
            {
              status: 200,
              description: 'Habits retrieved successfully',
              example: {
                habits: [
                  {
                    id: 'habit-id',
                    name: 'Exercise',
                    targetMinutes: 60,
                    category: 'Health'
                  }
                ]
              }
            }
          ],
          examples: [
            {
              language: 'javascript',
              code: `const response = await fetch('/api/habits', {
  method: 'GET',
  headers: { 'Authorization': 'Bearer YOUR_JWT_TOKEN' }
});`,
              description: 'JavaScript fetch example'
            }
          ],
          authentication: true,
          tags: ['habits']
        }
      ],
      generatedAt: new Date()
    };
  }

  private async getStaticDocumentationSections(): Promise<DocumentationSection[]> {
    return [
      {
        id: 'authentication',
        title: 'Authentication',
        category: 'api',
        content: 'Authentication documentation content...',
        lastUpdated: new Date(),
        tags: ['auth', 'jwt', 'security']
      },
      {
        id: 'habits',
        title: 'Habits and Tracking',
        category: 'api',
        content: 'Habits API documentation content...',
        lastUpdated: new Date(),
        tags: ['habits', 'tracking', 'crud']
      },
      {
        id: 'sentry',
        title: 'Sentry Integration',
        category: 'monitoring',
        content: 'Sentry monitoring documentation content...',
        lastUpdated: new Date(),
        tags: ['sentry', 'monitoring', 'errors']
      },
      {
        id: 'redis',
        title: 'Redis Usage',
        category: 'monitoring',
        content: 'Redis monitoring and usage documentation...',
        lastUpdated: new Date(),
        tags: ['redis', 'cache', 'performance']
      }
    ];
  }

  private async performClientSideSearch(query: string): Promise<SearchResult[]> {
    // Simple client-side search implementation
    const sections = await this.getStaticDocumentationSections();
    const apiDocs = await this.getStaticAPIDocumentation();
    
    const results: SearchResult[] = [];
    
    // Search in documentation sections
    sections.forEach(section => {
      if (section.title.toLowerCase().includes(query.toLowerCase()) ||
          section.content.toLowerCase().includes(query.toLowerCase()) ||
          section.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))) {
        results.push({
          id: section.id,
          title: section.title,
          category: section.category,
          excerpt: section.content.substring(0, 200) + '...',
          url: `/${section.category}/${section.id}`,
          score: 1
        });
      }
    });
    
    // Search in API routes
    apiDocs.routes.forEach(route => {
      if (route.path.toLowerCase().includes(query.toLowerCase()) ||
          route.description?.toLowerCase().includes(query.toLowerCase()) ||
          route.tags?.some(tag => tag.toLowerCase().includes(query.toLowerCase()))) {
        results.push({
          id: `${route.method}-${route.path}`,
          title: `${route.method} ${route.path}`,
          category: 'api',
          excerpt: route.description || '',
          url: `/api/${route.tags?.[0] || 'general'}`,
          score: 1
        });
      }
    });
    
    return results.sort((a, b) => b.score - a.score);
  }
}

export const documentationService = new DocumentationService();