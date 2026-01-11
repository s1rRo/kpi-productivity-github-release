import express from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';

interface RouteInfo {
  method: string;
  path: string;
  description?: string;
  parameters?: Parameter[];
  responses?: ResponseInfo[];
  examples?: CodeExample[];
  authentication?: boolean;
  tags?: string[];
}

interface Parameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  location: 'path' | 'query' | 'body' | 'header';
  required: boolean;
  description?: string;
  example?: any;
}

interface ResponseInfo {
  status: number;
  description: string;
  schema?: any;
  example?: any;
}

interface CodeExample {
  language: string;
  code: string;
  description: string;
}

interface APIDocumentation {
  title: string;
  version: string;
  description: string;
  baseUrl: string;
  routes: RouteInfo[];
  generatedAt: Date;
}

class DocumentationGenerator {
  private routes: RouteInfo[] = [];
  private routeFiles: string[] = [];

  constructor() {
    this.scanRouteFiles();
  }

  /**
   * Scan the routes directory to find all route files
   */
  private scanRouteFiles(): void {
    const routesDir = path.join(__dirname, '../routes');
    try {
      const files = fs.readdirSync(routesDir);
      this.routeFiles = files
        .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
        .map(file => path.join(routesDir, file));
    } catch (error) {
      console.error('Error scanning route files:', error);
    }
  }

  /**
   * Extract route information from Express router
   */
  private extractRouteInfo(router: express.Router, basePath: string = ''): RouteInfo[] {
    const routes: RouteInfo[] = [];
    
    // This is a simplified extraction - in a real implementation,
    // you'd need to traverse the router stack more thoroughly
    if (router.stack) {
      router.stack.forEach((layer: any) => {
        if (layer.route) {
          const route = layer.route;
          const methods = Object.keys(route.methods);
          
          methods.forEach(method => {
            routes.push({
              method: method.toUpperCase(),
              path: basePath + route.path,
              description: this.extractDescription(route),
              parameters: this.extractParameters(route),
              responses: this.extractResponses(route),
              examples: this.generateExamples(method, basePath + route.path),
              authentication: this.requiresAuthentication(route),
              tags: this.extractTags(basePath)
            });
          });
        }
      });
    }

    return routes;
  }

  /**
   * Extract description from route comments or metadata
   */
  private extractDescription(route: any): string {
    // Look for JSDoc comments or metadata
    // This is a simplified implementation
    return route.description || 'No description available';
  }

  /**
   * Extract parameters from route definition
   */
  private extractParameters(route: any): Parameter[] {
    const parameters: Parameter[] = [];
    
    // Extract path parameters
    if (route.path.includes(':')) {
      const pathParams = route.path.match(/:(\w+)/g);
      if (pathParams) {
        pathParams.forEach((param: string) => {
          const paramName = param.substring(1);
          parameters.push({
            name: paramName,
            type: 'string',
            location: 'path',
            required: true,
            description: `Path parameter: ${paramName}`
          });
        });
      }
    }

    return parameters;
  }

  /**
   * Extract response information
   */
  private extractResponses(route: any): ResponseInfo[] {
    return [
      {
        status: 200,
        description: 'Success',
        example: { message: 'Operation completed successfully' }
      },
      {
        status: 400,
        description: 'Bad Request',
        example: { error: 'Invalid input parameters' }
      },
      {
        status: 401,
        description: 'Unauthorized',
        example: { error: 'Authentication required' }
      },
      {
        status: 500,
        description: 'Internal Server Error',
        example: { error: 'Internal server error' }
      }
    ];
  }

  /**
   * Generate code examples for endpoints
   */
  private generateExamples(method: string, path: string): CodeExample[] {
    const examples: CodeExample[] = [];

    // JavaScript/Fetch example
    examples.push({
      language: 'javascript',
      code: this.generateJavaScriptExample(method, path),
      description: 'JavaScript fetch example'
    });

    // cURL example
    examples.push({
      language: 'bash',
      code: this.generateCurlExample(method, path),
      description: 'cURL command example'
    });

    return examples;
  }

  /**
   * Generate JavaScript fetch example
   */
  private generateJavaScriptExample(method: string, path: string): string {
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);
    
    let code = `const response = await fetch('http://localhost:3001${path}', {\n`;
    code += `  method: '${method}',\n`;
    code += `  headers: {\n`;
    code += `    'Content-Type': 'application/json',\n`;
    code += `    'Authorization': 'Bearer YOUR_JWT_TOKEN'\n`;
    code += `  }`;
    
    if (hasBody) {
      code += `,\n  body: JSON.stringify({\n    // Request body data\n  })`;
    }
    
    code += `\n});\n\n`;
    code += `const data = await response.json();\n`;
    code += `console.log(data);`;

    return code;
  }

  /**
   * Generate cURL example
   */
  private generateCurlExample(method: string, path: string): string {
    let code = `curl -X ${method} \\\n`;
    code += `  -H "Content-Type: application/json" \\\n`;
    code += `  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\\n`;
    
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      code += `  -d '{"key": "value"}' \\\n`;
    }
    
    code += `  http://localhost:3001${path}`;

    return code;
  }

  /**
   * Check if route requires authentication
   */
  private requiresAuthentication(route: any): boolean {
    // Check if authenticateToken middleware is used
    // This is a simplified check
    return route.stack?.some((layer: any) => 
      layer.name === 'authenticateToken' || 
      layer.handle?.name === 'authenticateToken'
    ) || false;
  }

  /**
   * Extract tags from route path for categorization
   */
  private extractTags(basePath: string): string[] {
    const pathSegments = basePath.split('/').filter(segment => segment);
    return pathSegments.length > 0 ? [pathSegments[0]] : ['general'];
  }

  /**
   * Generate comprehensive API documentation
   */
  public async generateDocumentation(): Promise<APIDocumentation> {
    const routes: RouteInfo[] = [];

    // Manually define routes based on known route files
    const routeDefinitions = this.getKnownRoutes();
    routes.push(...routeDefinitions);

    return {
      title: 'KPI Productivity API',
      version: '1.0.0',
      description: 'Comprehensive API documentation for the KPI Productivity application',
      baseUrl: 'http://localhost:3001',
      routes: routes.sort((a, b) => a.path.localeCompare(b.path)),
      generatedAt: new Date()
    };
  }

  /**
   * Get known routes from the application
   */
  private getKnownRoutes(): RouteInfo[] {
    return [
      ...this.getAuthenticationRoutes(),
      ...this.getHabitsRoutes(),
      ...this.getAnalyticsRoutes(),
      ...this.getTeamsRoutes(),
      ...this.getHealthRoutes()
    ];
  }

  /**
   * Authentication routes
   */
  private getAuthenticationRoutes(): RouteInfo[] {
    return [
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
          },
          {
            name: 'name',
            type: 'string',
            location: 'body',
            required: false,
            description: 'User display name',
            example: 'John Doe'
          }
        ],
        responses: [
          {
            status: 201,
            description: 'User created successfully',
            example: {
              message: 'User created successfully',
              user: {
                id: 'user-id',
                email: 'user@example.com',
                name: 'John Doe',
                createdAt: '2024-01-01T00:00:00.000Z'
              },
              token: 'jwt-token'
            }
          },
          {
            status: 400,
            description: 'User already exists or invalid input',
            example: { error: 'User already exists' }
          }
        ],
        examples: [
          {
            language: 'javascript',
            code: `const response = await fetch('http://localhost:3001/api/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123',
    name: 'John Doe'
  })
});

const data = await response.json();
console.log(data);`,
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
              user: {
                id: 'user-id',
                email: 'user@example.com',
                name: 'John Doe',
                createdAt: '2024-01-01T00:00:00.000Z'
              },
              token: 'jwt-token'
            }
          },
          {
            status: 401,
            description: 'Invalid credentials',
            example: { error: 'Invalid credentials' }
          }
        ],
        examples: [
          {
            language: 'javascript',
            code: `const response = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const data = await response.json();
console.log(data);`,
            description: 'JavaScript fetch example'
          }
        ],
        authentication: false,
        tags: ['authentication']
      },
      {
        method: 'GET',
        path: '/api/auth/me',
        description: 'Get current authenticated user information',
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
            description: 'User information retrieved successfully',
            example: {
              user: {
                id: 'user-id',
                email: 'user@example.com',
                name: 'John Doe',
                createdAt: '2024-01-01T00:00:00.000Z'
              }
            }
          },
          {
            status: 401,
            description: 'Unauthorized - invalid or missing token',
            example: { error: 'Unauthorized' }
          },
          {
            status: 404,
            description: 'User not found',
            example: { error: 'User not found' }
          }
        ],
        examples: [
          {
            language: 'javascript',
            code: `const response = await fetch('http://localhost:3001/api/auth/me', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  }
});

const data = await response.json();
console.log(data);`,
            description: 'JavaScript fetch example'
          }
        ],
        authentication: true,
        tags: ['authentication']
      }
    ];
  }

  /**
   * Habits routes
   */
  private getHabitsRoutes(): RouteInfo[] {
    return [
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
                  category: 'Health',
                  skillLevel: 'Beginner',
                  eisenhowerQuadrant: 'Q2',
                  isWeekdayOnly: false,
                  createdAt: '2024-01-01T00:00:00.000Z'
                }
              ]
            }
          }
        ],
        examples: [
          {
            language: 'javascript',
            code: `const response = await fetch('http://localhost:3001/api/habits', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  }
});

const data = await response.json();
console.log(data.habits);`,
            description: 'JavaScript fetch example'
          }
        ],
        authentication: true,
        tags: ['habits']
      },
      {
        method: 'POST',
        path: '/api/habits',
        description: 'Create a new habit',
        parameters: [
          {
            name: 'Authorization',
            type: 'string',
            location: 'header',
            required: true,
            description: 'Bearer JWT token',
            example: 'Bearer jwt-token'
          },
          {
            name: 'name',
            type: 'string',
            location: 'body',
            required: true,
            description: 'Habit name',
            example: 'Morning Exercise'
          },
          {
            name: 'targetMinutes',
            type: 'number',
            location: 'body',
            required: true,
            description: 'Target minutes per day',
            example: 60
          },
          {
            name: 'category',
            type: 'string',
            location: 'body',
            required: true,
            description: 'Habit category',
            example: 'Health'
          },
          {
            name: 'skillLevel',
            type: 'string',
            location: 'body',
            required: false,
            description: 'Skill level (Beginner, Intermediate, Advanced)',
            example: 'Beginner'
          },
          {
            name: 'eisenhowerQuadrant',
            type: 'string',
            location: 'body',
            required: false,
            description: 'Eisenhower matrix quadrant (Q1, Q2, Q3, Q4)',
            example: 'Q2'
          },
          {
            name: 'isWeekdayOnly',
            type: 'boolean',
            location: 'body',
            required: false,
            description: 'Whether habit applies only to weekdays',
            example: false
          }
        ],
        responses: [
          {
            status: 201,
            description: 'Habit created successfully',
            example: {
              habit: {
                id: 'habit-id',
                name: 'Morning Exercise',
                targetMinutes: 60,
                category: 'Health',
                skillLevel: 'Beginner',
                eisenhowerQuadrant: 'Q2',
                isWeekdayOnly: false,
                createdAt: '2024-01-01T00:00:00.000Z'
              },
              message: 'Habit created successfully'
            }
          },
          {
            status: 400,
            description: 'Invalid input parameters',
            example: { error: 'Invalid input', details: [] }
          }
        ],
        examples: [
          {
            language: 'javascript',
            code: `const response = await fetch('http://localhost:3001/api/habits', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  },
  body: JSON.stringify({
    name: 'Morning Exercise',
    targetMinutes: 60,
    category: 'Health',
    skillLevel: 'Beginner',
    eisenhowerQuadrant: 'Q2',
    isWeekdayOnly: false
  })
});

const data = await response.json();
console.log(data);`,
            description: 'JavaScript fetch example'
          }
        ],
        authentication: true,
        tags: ['habits']
      },
      {
        method: 'GET',
        path: '/api/habits/:id',
        description: 'Get a specific habit by ID with optional history',
        parameters: [
          {
            name: 'Authorization',
            type: 'string',
            location: 'header',
            required: true,
            description: 'Bearer JWT token',
            example: 'Bearer jwt-token'
          },
          {
            name: 'id',
            type: 'string',
            location: 'path',
            required: true,
            description: 'Habit ID',
            example: 'habit-id'
          },
          {
            name: 'includeHistory',
            type: 'boolean',
            location: 'query',
            required: false,
            description: 'Include habit change history',
            example: true
          }
        ],
        responses: [
          {
            status: 200,
            description: 'Habit retrieved successfully',
            example: {
              habit: {
                id: 'habit-id',
                name: 'Exercise',
                targetMinutes: 60,
                category: 'Health',
                habitHistory: []
              }
            }
          },
          {
            status: 404,
            description: 'Habit not found',
            example: { error: 'Habit not found' }
          }
        ],
        examples: [
          {
            language: 'javascript',
            code: `const response = await fetch('http://localhost:3001/api/habits/habit-id?includeHistory=true', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  }
});

const data = await response.json();
console.log(data.habit);`,
            description: 'JavaScript fetch example'
          }
        ],
        authentication: true,
        tags: ['habits']
      },
      {
        method: 'PUT',
        path: '/api/habits/:id',
        description: 'Update an existing habit',
        parameters: [
          {
            name: 'Authorization',
            type: 'string',
            location: 'header',
            required: true,
            description: 'Bearer JWT token',
            example: 'Bearer jwt-token'
          },
          {
            name: 'id',
            type: 'string',
            location: 'path',
            required: true,
            description: 'Habit ID',
            example: 'habit-id'
          },
          {
            name: 'name',
            type: 'string',
            location: 'body',
            required: false,
            description: 'Updated habit name',
            example: 'Evening Exercise'
          },
          {
            name: 'targetMinutes',
            type: 'number',
            location: 'body',
            required: false,
            description: 'Updated target minutes per day',
            example: 90
          }
        ],
        responses: [
          {
            status: 200,
            description: 'Habit updated successfully',
            example: {
              habit: {
                id: 'habit-id',
                name: 'Evening Exercise',
                targetMinutes: 90
              },
              message: 'Habit updated successfully',
              changes: 2
            }
          },
          {
            status: 404,
            description: 'Habit not found',
            example: { error: 'Habit not found' }
          }
        ],
        examples: [
          {
            language: 'javascript',
            code: `const response = await fetch('http://localhost:3001/api/habits/habit-id', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  },
  body: JSON.stringify({
    name: 'Evening Exercise',
    targetMinutes: 90
  })
});

const data = await response.json();
console.log(data);`,
            description: 'JavaScript fetch example'
          }
        ],
        authentication: true,
        tags: ['habits']
      },
      {
        method: 'DELETE',
        path: '/api/habits/:id',
        description: 'Delete a habit (with optional force delete)',
        parameters: [
          {
            name: 'Authorization',
            type: 'string',
            location: 'header',
            required: true,
            description: 'Bearer JWT token',
            example: 'Bearer jwt-token'
          },
          {
            name: 'id',
            type: 'string',
            location: 'path',
            required: true,
            description: 'Habit ID',
            example: 'habit-id'
          },
          {
            name: 'force',
            type: 'boolean',
            location: 'query',
            required: false,
            description: 'Force delete even if habit has associated data',
            example: true
          }
        ],
        responses: [
          {
            status: 200,
            description: 'Habit deleted successfully',
            example: {
              message: 'Habit deleted successfully',
              deletedData: null
            }
          },
          {
            status: 400,
            description: 'Cannot delete habit with associated data',
            example: {
              error: 'Cannot delete habit with associated data',
              message: 'Use force=true query parameter to delete anyway'
            }
          },
          {
            status: 404,
            description: 'Habit not found',
            example: { error: 'Habit not found' }
          }
        ],
        examples: [
          {
            language: 'javascript',
            code: `const response = await fetch('http://localhost:3001/api/habits/habit-id?force=true', {
  method: 'DELETE',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  }
});

const data = await response.json();
console.log(data);`,
            description: 'JavaScript fetch example'
          }
        ],
        authentication: true,
        tags: ['habits']
      }
    ];
  }

  /**
   * Analytics routes
   */
  private getAnalyticsRoutes(): RouteInfo[] {
    return [
      {
        method: 'GET',
        path: '/api/analytics/report',
        description: 'Generate comprehensive analytics report',
        parameters: [
          {
            name: 'Authorization',
            type: 'string',
            location: 'header',
            required: true,
            description: 'Bearer JWT token',
            example: 'Bearer jwt-token'
          },
          {
            name: 'startDate',
            type: 'string',
            location: 'query',
            required: true,
            description: 'Start date for the report (ISO format)',
            example: '2024-01-01'
          },
          {
            name: 'endDate',
            type: 'string',
            location: 'query',
            required: true,
            description: 'End date for the report (ISO format)',
            example: '2024-01-31'
          },
          {
            name: 'type',
            type: 'string',
            location: 'query',
            required: false,
            description: 'Report type (month, quarter, year)',
            example: 'month'
          }
        ],
        responses: [
          {
            status: 200,
            description: 'Analytics report generated successfully',
            example: {
              data: {
                period: { start: '2024-01-01', end: '2024-01-31' },
                summary: {
                  averageKPI: 85.5,
                  totalHours: 120,
                  completedDays: 25
                },
                trends: [],
                forecast: { predictedKPI: 87.2 },
                recommendations: []
              },
              message: 'Analytics report generated successfully'
            }
          },
          {
            status: 400,
            description: 'Missing or invalid parameters',
            example: { error: 'Missing parameters', message: 'startDate and endDate are required' }
          }
        ],
        examples: [
          {
            language: 'javascript',
            code: `const response = await fetch('http://localhost:3001/api/analytics/report?startDate=2024-01-01&endDate=2024-01-31&type=month', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  }
});

const data = await response.json();
console.log(data.data);`,
            description: 'JavaScript fetch example'
          }
        ],
        authentication: true,
        tags: ['analytics']
      },
      {
        method: 'GET',
        path: '/api/analytics/summary',
        description: 'Get quick analytics summary for dashboard',
        parameters: [
          {
            name: 'Authorization',
            type: 'string',
            location: 'header',
            required: true,
            description: 'Bearer JWT token',
            example: 'Bearer jwt-token'
          },
          {
            name: 'days',
            type: 'number',
            location: 'query',
            required: false,
            description: 'Number of days to include (default: 30)',
            example: 30
          }
        ],
        responses: [
          {
            status: 200,
            description: 'Analytics summary retrieved successfully',
            example: {
              data: {
                period: 'Last 30 days',
                averageKPI: 85.5,
                totalHours: 120,
                completedDays: 25,
                completionRate: 83,
                topHabits: [],
                keyTrends: [],
                forecast: { nextMonth: 87.2, confidence: 0.85 }
              },
              message: 'Analytics summary retrieved successfully'
            }
          }
        ],
        examples: [
          {
            language: 'javascript',
            code: `const response = await fetch('http://localhost:3001/api/analytics/summary?days=30', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  }
});

const data = await response.json();
console.log(data.data);`,
            description: 'JavaScript fetch example'
          }
        ],
        authentication: true,
        tags: ['analytics']
      },
      {
        method: 'POST',
        path: '/api/analytics/export',
        description: 'Export user data in JSON or CSV format',
        parameters: [
          {
            name: 'Authorization',
            type: 'string',
            location: 'header',
            required: true,
            description: 'Bearer JWT token',
            example: 'Bearer jwt-token'
          },
          {
            name: 'format',
            type: 'string',
            location: 'body',
            required: false,
            description: 'Export format (json or csv)',
            example: 'json'
          },
          {
            name: 'dateRange',
            type: 'object',
            location: 'body',
            required: true,
            description: 'Date range for export',
            example: { start: '2024-01-01', end: '2024-01-31' }
          },
          {
            name: 'includeHabits',
            type: 'boolean',
            location: 'body',
            required: false,
            description: 'Include habits data',
            example: true
          },
          {
            name: 'includeAnalytics',
            type: 'boolean',
            location: 'body',
            required: false,
            description: 'Include analytics data',
            example: true
          }
        ],
        responses: [
          {
            status: 200,
            description: 'Data exported successfully (file download)',
            example: 'Binary file data'
          },
          {
            status: 400,
            description: 'Invalid parameters',
            example: { error: 'Missing parameters', message: 'dateRange with start and end dates is required' }
          }
        ],
        examples: [
          {
            language: 'javascript',
            code: `const response = await fetch('http://localhost:3001/api/analytics/export', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  },
  body: JSON.stringify({
    format: 'json',
    dateRange: {
      start: '2024-01-01',
      end: '2024-01-31'
    },
    includeHabits: true,
    includeAnalytics: true
  })
});

// Handle file download
const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'export.json';
a.click();`,
            description: 'JavaScript fetch example'
          }
        ],
        authentication: true,
        tags: ['analytics']
      }
    ];
  }

  /**
   * Teams routes
   */
  private getTeamsRoutes(): RouteInfo[] {
    return [
      {
        method: 'GET',
        path: '/api/teams',
        description: 'Get all teams for the authenticated user',
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
            description: 'Teams retrieved successfully',
            example: {
              teams: [
                {
                  id: 'team-id',
                  name: 'Development Team',
                  description: 'Software development team',
                  createdAt: '2024-01-01T00:00:00.000Z'
                }
              ]
            }
          }
        ],
        examples: [
          {
            language: 'javascript',
            code: `const response = await fetch('http://localhost:3001/api/teams', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  }
});

const data = await response.json();
console.log(data.teams);`,
            description: 'JavaScript fetch example'
          }
        ],
        authentication: true,
        tags: ['teams']
      },
      {
        method: 'POST',
        path: '/api/teams',
        description: 'Create a new team',
        parameters: [
          {
            name: 'Authorization',
            type: 'string',
            location: 'header',
            required: true,
            description: 'Bearer JWT token',
            example: 'Bearer jwt-token'
          },
          {
            name: 'name',
            type: 'string',
            location: 'body',
            required: true,
            description: 'Team name',
            example: 'Development Team'
          },
          {
            name: 'description',
            type: 'string',
            location: 'body',
            required: false,
            description: 'Team description',
            example: 'Software development team'
          }
        ],
        responses: [
          {
            status: 201,
            description: 'Team created successfully',
            example: {
              team: {
                id: 'team-id',
                name: 'Development Team',
                description: 'Software development team',
                createdAt: '2024-01-01T00:00:00.000Z'
              },
              message: 'Team created successfully'
            }
          }
        ],
        examples: [
          {
            language: 'javascript',
            code: `const response = await fetch('http://localhost:3001/api/teams', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  },
  body: JSON.stringify({
    name: 'Development Team',
    description: 'Software development team'
  })
});

const data = await response.json();
console.log(data);`,
            description: 'JavaScript fetch example'
          }
        ],
        authentication: true,
        tags: ['teams']
      }
    ];
  }

  /**
   * Health check routes
   */
  private getHealthRoutes(): RouteInfo[] {
    return [
      {
        method: 'GET',
        path: '/api/health',
        description: 'Basic health check endpoint',
        parameters: [],
        responses: [
          {
            status: 200,
            description: 'Service is healthy',
            example: {
              status: 'healthy',
              timestamp: '2024-01-01T00:00:00.000Z',
              uptime: 3600
            }
          }
        ],
        examples: [
          {
            language: 'javascript',
            code: `const response = await fetch('http://localhost:3001/api/health', {
  method: 'GET'
});

const data = await response.json();
console.log(data);`,
            description: 'JavaScript fetch example'
          }
        ],
        authentication: false,
        tags: ['health']
      },
      {
        method: 'GET',
        path: '/api/health/detailed',
        description: 'Detailed health check with database and Redis status',
        parameters: [],
        responses: [
          {
            status: 200,
            description: 'Detailed health status',
            example: {
              status: 'healthy',
              timestamp: '2024-01-01T00:00:00.000Z',
              services: {
                database: { status: 'healthy', responseTime: 15 },
                redis: { status: 'healthy', responseTime: 5 }
              }
            }
          }
        ],
        examples: [
          {
            language: 'javascript',
            code: `const response = await fetch('http://localhost:3001/api/health/detailed', {
  method: 'GET'
});

const data = await response.json();
console.log(data);`,
            description: 'JavaScript fetch example'
          }
        ],
        authentication: false,
        tags: ['health']
      }
    ];
  }

  /**
   * Generate markdown documentation
   */
  public async generateMarkdownDocumentation(): Promise<string> {
    const documentation = await this.generateDocumentation();
    let markdown = `# ${documentation.title}\n\n`;
    markdown += `${documentation.description}\n\n`;
    markdown += `**Version:** ${documentation.version}\n`;
    markdown += `**Base URL:** ${documentation.baseUrl}\n`;
    markdown += `**Generated:** ${documentation.generatedAt.toISOString()}\n\n`;

    // Group routes by tags
    const routesByTag = documentation.routes.reduce((acc, route) => {
      const tag = route.tags?.[0] || 'general';
      if (!acc[tag]) {
        acc[tag] = [];
      }
      acc[tag].push(route);
      return acc;
    }, {} as Record<string, RouteInfo[]>);

    // Generate documentation for each tag
    Object.entries(routesByTag).forEach(([tag, routes]) => {
      markdown += `## ${tag.charAt(0).toUpperCase() + tag.slice(1)}\n\n`;
      
      routes.forEach(route => {
        markdown += `### ${route.method} ${route.path}\n\n`;
        markdown += `${route.description}\n\n`;
        
        if (route.authentication) {
          markdown += `**Authentication:** Required\n\n`;
        }

        // Parameters
        if (route.parameters && route.parameters.length > 0) {
          markdown += `**Parameters:**\n\n`;
          route.parameters.forEach(param => {
            markdown += `- **${param.name}** (${param.type}, ${param.location})`;
            if (param.required) markdown += ` *required*`;
            markdown += `\n  ${param.description}\n`;
            if (param.example) {
              markdown += `  Example: \`${JSON.stringify(param.example)}\`\n`;
            }
            markdown += `\n`;
          });
        }

        // Responses
        if (route.responses && route.responses.length > 0) {
          markdown += `**Responses:**\n\n`;
          route.responses.forEach(response => {
            markdown += `- **${response.status}**: ${response.description}\n`;
            if (response.example) {
              markdown += `  \`\`\`json\n  ${JSON.stringify(response.example, null, 2)}\n  \`\`\`\n`;
            }
            markdown += `\n`;
          });
        }

        // Examples
        if (route.examples && route.examples.length > 0) {
          markdown += `**Examples:**\n\n`;
          route.examples.forEach(example => {
            markdown += `${example.description}:\n\n`;
            markdown += `\`\`\`${example.language}\n${example.code}\n\`\`\`\n\n`;
          });
        }

        markdown += `---\n\n`;
      });
    });

    return markdown;
  }

  /**
   * Save documentation to file
   */
  public async saveDocumentation(outputPath: string): Promise<void> {
    const markdown = await this.generateMarkdownDocumentation();
    
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, markdown, 'utf8');
  }

  /**
   * Generate JSON documentation
   */
  public async generateJSONDocumentation(): Promise<string> {
    const documentation = await this.generateDocumentation();
    return JSON.stringify(documentation, null, 2);
  }
}

export { DocumentationGenerator, RouteInfo, Parameter, ResponseInfo, CodeExample, APIDocumentation };