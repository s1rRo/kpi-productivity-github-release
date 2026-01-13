import request from 'supertest';
import { app } from '../../index';
import { DocumentationGenerator } from '../../services/documentationGenerator';
import fs from 'fs';
import path from 'path';

describe('Documentation System Integration Tests', () => {
  let docGenerator: DocumentationGenerator;

  beforeAll(() => {
    docGenerator = new DocumentationGenerator();
  });

  afterAll(async () => {
    // Clean up any generated test files
    const testOutputDir = './docs/test-output';
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  describe('Documentation Generator Service', () => {
    describe('generateDocumentation()', () => {
      it('should generate complete API documentation', async () => {
        const documentation = await docGenerator.generateDocumentation();

        expect(documentation).toBeDefined();
        expect(documentation.title).toBe('KPI Productivity API');
        expect(documentation.version).toBe('1.0.0');
        expect(documentation.description).toContain('Comprehensive API documentation');
        expect(documentation.baseUrl).toBe('http://localhost:3001');
        expect(documentation.routes).toBeInstanceOf(Array);
        expect(documentation.routes.length).toBeGreaterThan(0);
        expect(documentation.generatedAt).toBeInstanceOf(Date);
      });

      it('should include all major route categories', async () => {
        const documentation = await docGenerator.generateDocumentation();
        const tags = new Set(documentation.routes.flatMap(route => route.tags || []));

        expect(tags).toContain('authentication');
        expect(tags).toContain('habits');
        expect(tags).toContain('analytics');
        expect(tags).toContain('teams');
        expect(tags).toContain('health');
      });

      it('should include proper route information', async () => {
        const documentation = await docGenerator.generateDocumentation();
        const authRoutes = documentation.routes.filter(route => 
          route.tags?.includes('authentication')
        );

        expect(authRoutes.length).toBeGreaterThan(0);

        const loginRoute = authRoutes.find(route => 
          route.method === 'POST' && route.path === '/api/auth/login'
        );

        expect(loginRoute).toBeDefined();
        expect(loginRoute?.description).toContain('Authenticate user');
        expect(loginRoute?.parameters).toBeInstanceOf(Array);
        expect(loginRoute?.responses).toBeInstanceOf(Array);
        expect(loginRoute?.examples).toBeInstanceOf(Array);
        expect(loginRoute?.authentication).toBe(false);
      });

      it('should include proper parameter definitions', async () => {
        const documentation = await docGenerator.generateDocumentation();
        const registerRoute = documentation.routes.find(route => 
          route.method === 'POST' && route.path === '/api/auth/register'
        );

        expect(registerRoute).toBeDefined();
        expect(registerRoute?.parameters).toBeInstanceOf(Array);
        expect(registerRoute?.parameters?.length).toBeGreaterThan(0);

        const emailParam = registerRoute?.parameters?.find(p => p.name === 'email');
        expect(emailParam).toBeDefined();
        expect(emailParam?.type).toBe('string');
        expect(emailParam?.location).toBe('body');
        expect(emailParam?.required).toBe(true);
        expect(emailParam?.description).toContain('email');
        expect(emailParam?.example).toBeDefined();
      });

      it('should include proper response definitions', async () => {
        const documentation = await docGenerator.generateDocumentation();
        const loginRoute = documentation.routes.find(route => 
          route.method === 'POST' && route.path === '/api/auth/login'
        );

        expect(loginRoute?.responses).toBeInstanceOf(Array);
        expect(loginRoute?.responses?.length).toBeGreaterThan(0);

        const successResponse = loginRoute?.responses?.find(r => r.status === 200);
        expect(successResponse).toBeDefined();
        expect(successResponse?.description).toContain('Login successful');
        expect(successResponse?.example).toBeDefined();
        expect(successResponse?.example).toHaveProperty('message');
        expect(successResponse?.example).toHaveProperty('user');
        expect(successResponse?.example).toHaveProperty('token');

        const errorResponse = loginRoute?.responses?.find(r => r.status === 401);
        expect(errorResponse).toBeDefined();
        expect(errorResponse?.description).toContain('Invalid credentials');
        expect(errorResponse?.example).toHaveProperty('error');
      });

      it('should include code examples for all routes', async () => {
        const documentation = await docGenerator.generateDocumentation();
        
        documentation.routes.forEach(route => {
          expect(route.examples).toBeInstanceOf(Array);
          expect(route.examples?.length).toBeGreaterThan(0);

          const jsExample = route.examples?.find(ex => ex.language === 'javascript');
          expect(jsExample).toBeDefined();
          expect(jsExample?.code).toContain('fetch');
          expect(jsExample?.code).toContain(route.path);
          expect(jsExample?.code).toContain(route.method);
          expect(jsExample?.description).toContain('JavaScript');

          const curlExample = route.examples?.find(ex => ex.language === 'bash');
          expect(curlExample).toBeDefined();
          expect(curlExample?.code).toContain('curl');
          expect(curlExample?.code).toContain(route.method);
          expect(curlExample?.code).toContain(route.path);
          expect(curlExample?.description).toContain('cURL');
        });
      });

      it('should properly identify authenticated routes', async () => {
        const documentation = await docGenerator.generateDocumentation();
        
        const authRoutes = documentation.routes.filter(route => 
          route.path.startsWith('/api/auth')
        );
        const protectedRoutes = documentation.routes.filter(route => 
          route.path.startsWith('/api/habits') || 
          route.path.startsWith('/api/analytics') ||
          route.path.startsWith('/api/teams')
        );

        // Auth routes should not require authentication (except /api/auth/me)
        authRoutes.forEach(route => {
          if (route.path === '/api/auth/me') {
            expect(route.authentication).toBe(true);
          } else {
            expect(route.authentication).toBe(false);
          }
        });

        // Protected routes should require authentication
        protectedRoutes.forEach(route => {
          expect(route.authentication).toBe(true);
        });
      });
    });

    describe('generateMarkdownDocumentation()', () => {
      it('should generate valid markdown documentation', async () => {
        const markdown = await docGenerator.generateMarkdownDocumentation();

        expect(markdown).toBeDefined();
        expect(typeof markdown).toBe('string');
        expect(markdown.length).toBeGreaterThan(0);

        // Check for markdown structure
        expect(markdown).toContain('# KPI Productivity API');
        expect(markdown).toContain('**Version:**');
        expect(markdown).toContain('**Base URL:**');
        expect(markdown).toContain('**Generated:**');

        // Check for route sections
        expect(markdown).toContain('## Authentication');
        expect(markdown).toContain('## Habits');
        expect(markdown).toContain('## Analytics');
        expect(markdown).toContain('## Teams');
        expect(markdown).toContain('## Health');

        // Check for route documentation
        expect(markdown).toContain('### POST /api/auth/login');
        expect(markdown).toContain('### GET /api/habits');
        expect(markdown).toContain('**Parameters:**');
        expect(markdown).toContain('**Responses:**');
        expect(markdown).toContain('**Examples:**');

        // Check for code blocks
        expect(markdown).toContain('```javascript');
        expect(markdown).toContain('```bash');
        expect(markdown).toContain('```json');
      });

      it('should include all route information in markdown', async () => {
        const markdown = await docGenerator.generateMarkdownDocumentation();
        const documentation = await docGenerator.generateDocumentation();

        // Verify all routes are documented
        documentation.routes.forEach(route => {
          expect(markdown).toContain(`### ${route.method} ${route.path}`);
          expect(markdown).toContain(route.description || '');
          
          if (route.authentication) {
            expect(markdown).toContain('**Authentication:** Required');
          }
        });
      });
    });

    describe('generateJSONDocumentation()', () => {
      it('should generate valid JSON documentation', async () => {
        const jsonString = await docGenerator.generateJSONDocumentation();
        
        expect(jsonString).toBeDefined();
        expect(typeof jsonString).toBe('string');

        // Should be valid JSON
        const parsed = JSON.parse(jsonString);
        expect(parsed).toBeDefined();
        expect(parsed.title).toBe('KPI Productivity API');
        expect(parsed.routes).toBeInstanceOf(Array);
      });

      it('should match the structure of generateDocumentation()', async () => {
        const documentation = await docGenerator.generateDocumentation();
        const jsonString = await docGenerator.generateJSONDocumentation();
        const parsedJson = JSON.parse(jsonString);

        expect(parsedJson.title).toBe(documentation.title);
        expect(parsedJson.version).toBe(documentation.version);
        expect(parsedJson.description).toBe(documentation.description);
        expect(parsedJson.baseUrl).toBe(documentation.baseUrl);
        expect(parsedJson.routes.length).toBe(documentation.routes.length);
      });
    });

    describe('saveDocumentation()', () => {
      it('should save markdown documentation to file', async () => {
        const outputPath = './docs/test-output/test-documentation.md';
        
        await docGenerator.saveDocumentation(outputPath);

        expect(fs.existsSync(outputPath)).toBe(true);
        
        const content = fs.readFileSync(outputPath, 'utf8');
        expect(content).toContain('# KPI Productivity API');
        expect(content).toContain('## Authentication');
        expect(content.length).toBeGreaterThan(1000);
      });

      it('should create directories if they do not exist', async () => {
        const outputPath = './docs/test-output/nested/deep/test-documentation.md';
        
        await docGenerator.saveDocumentation(outputPath);

        expect(fs.existsSync(outputPath)).toBe(true);
        expect(fs.existsSync('./docs/test-output/nested/deep')).toBe(true);
      });
    });
  });

  describe('Documentation API Endpoints', () => {
    describe('GET /api/docs', () => {
      it('should return JSON documentation by default', async () => {
        const response = await request(app)
          .get('/api/docs')
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('message');
        expect(response.body.data).toHaveProperty('title', 'KPI Productivity API');
        expect(response.body.data).toHaveProperty('routes');
        expect(response.body.data.routes).toBeInstanceOf(Array);
        expect(response.body.data.routes.length).toBeGreaterThan(0);
      });

      it('should return markdown documentation when format=markdown', async () => {
        const response = await request(app)
          .get('/api/docs?format=markdown')
          .expect(200);

        expect(response.headers['content-type']).toContain('text/markdown');
        expect(response.text).toContain('# KPI Productivity API');
        expect(response.text).toContain('## Authentication');
        expect(response.text).toContain('### POST /api/auth/login');
      });

      it('should handle errors gracefully', async () => {
        // Mock the documentation generator to throw an error
        const originalMethod = DocumentationGenerator.prototype.generateDocumentation;
        DocumentationGenerator.prototype.generateDocumentation = jest.fn().mockRejectedValue(new Error('Test error'));

        const response = await request(app)
          .get('/api/docs')
          .expect(500);

        expect(response.body).toHaveProperty('error', 'Internal server error');
        expect(response.body).toHaveProperty('message', 'Failed to generate documentation');

        // Restore original method
        DocumentationGenerator.prototype.generateDocumentation = originalMethod;
      });
    });

    describe('GET /api/docs/routes', () => {
      it('should return list of all routes', async () => {
        const response = await request(app)
          .get('/api/docs/routes')
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('routes');
        expect(response.body.data).toHaveProperty('total');
        expect(response.body.data).toHaveProperty('byMethod');
        expect(response.body.data).toHaveProperty('byTag');

        expect(response.body.data.routes).toBeInstanceOf(Array);
        expect(response.body.data.total).toBeGreaterThan(0);
        expect(response.body.data.byMethod).toHaveProperty('GET');
        expect(response.body.data.byMethod).toHaveProperty('POST');
        expect(response.body.data.byTag).toHaveProperty('authentication');
        expect(response.body.data.byTag).toHaveProperty('habits');
      });

      it('should include route summary information', async () => {
        const response = await request(app)
          .get('/api/docs/routes')
          .expect(200);

        const routes = response.body.data.routes;
        expect(routes.length).toBeGreaterThan(0);

        routes.forEach((route: any) => {
          expect(route).toHaveProperty('method');
          expect(route).toHaveProperty('path');
          expect(route).toHaveProperty('description');
          expect(route).toHaveProperty('authentication');
          expect(route).toHaveProperty('tags');
          expect(['GET', 'POST', 'PUT', 'DELETE']).toContain(route.method);
        });
      });
    });

    describe('GET /api/docs/route/:method/*', () => {
      it('should return specific route documentation', async () => {
        const response = await request(app)
          .get('/api/docs/route/POST/api/auth/login')
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('method', 'POST');
        expect(response.body.data).toHaveProperty('path', '/api/auth/login');
        expect(response.body.data).toHaveProperty('description');
        expect(response.body.data).toHaveProperty('parameters');
        expect(response.body.data).toHaveProperty('responses');
        expect(response.body.data).toHaveProperty('examples');
        expect(response.body.data).toHaveProperty('authentication', false);
        expect(response.body.data).toHaveProperty('tags');
      });

      it('should handle complex paths with parameters', async () => {
        const response = await request(app)
          .get('/api/docs/route/GET/api/habits/:id')
          .expect(200);

        expect(response.body.data).toHaveProperty('method', 'GET');
        expect(response.body.data).toHaveProperty('path', '/api/habits/:id');
        expect(response.body.data.parameters).toBeInstanceOf(Array);
        
        const idParam = response.body.data.parameters.find((p: any) => p.name === 'id');
        expect(idParam).toBeDefined();
        expect(idParam.location).toBe('path');
        expect(idParam.required).toBe(true);
      });

      it('should return 404 for non-existent routes', async () => {
        const response = await request(app)
          .get('/api/docs/route/GET/api/nonexistent')
          .expect(404);

        expect(response.body).toHaveProperty('error', 'Route not found');
        expect(response.body.message).toContain('Route GET /api/nonexistent not found');
      });
    });

    describe('GET /api/docs/tags', () => {
      it('should return documentation grouped by tags', async () => {
        const response = await request(app)
          .get('/api/docs/tags')
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('authentication');
        expect(response.body.data).toHaveProperty('habits');
        expect(response.body.data).toHaveProperty('analytics');
        expect(response.body.data).toHaveProperty('teams');
        expect(response.body.data).toHaveProperty('health');

        // Each tag should contain an array of routes
        Object.values(response.body.data).forEach((routes: any) => {
          expect(routes).toBeInstanceOf(Array);
          expect(routes.length).toBeGreaterThan(0);
        });
      });

      it('should group routes correctly by tags', async () => {
        const response = await request(app)
          .get('/api/docs/tags')
          .expect(200);

        const authRoutes = response.body.data.authentication;
        expect(authRoutes).toBeInstanceOf(Array);
        
        const loginRoute = authRoutes.find((route: any) => 
          route.method === 'POST' && route.path === '/api/auth/login'
        );
        expect(loginRoute).toBeDefined();

        const habitsRoutes = response.body.data.habits;
        expect(habitsRoutes).toBeInstanceOf(Array);
        
        const getHabitsRoute = habitsRoutes.find((route: any) => 
          route.method === 'GET' && route.path === '/api/habits'
        );
        expect(getHabitsRoute).toBeDefined();
      });
    });

    describe('POST /api/docs/generate', () => {
      it('should generate both markdown and JSON files by default', async () => {
        const response = await request(app)
          .post('/api/docs/generate')
          .send({
            outputDir: './docs/test-output'
          })
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('generated');
        expect(response.body.data).toHaveProperty('errors');
        expect(response.body.data.generated).toContain('markdown');
        expect(response.body.data.generated).toContain('json');
        expect(response.body.data.issues).toHaveLength(0);

        // Verify files were created
        expect(fs.existsSync('./docs/test-output/api-documentation.md')).toBe(true);
        expect(fs.existsSync('./docs/test-output/api-documentation.json')).toBe(true);
      });

      it('should generate only markdown when format=markdown', async () => {
        const response = await request(app)
          .post('/api/docs/generate')
          .send({
            format: 'markdown',
            outputDir: './docs/test-output/markdown-only'
          })
          .expect(200);

        expect(response.body.data.generated).toContain('markdown');
        expect(response.body.data.generated).not.toContain('json');
        expect(fs.existsSync('./docs/test-output/markdown-only/api-documentation.md')).toBe(true);
        expect(fs.existsSync('./docs/test-output/markdown-only/api-documentation.json')).toBe(false);
      });

      it('should generate only JSON when format=json', async () => {
        const response = await request(app)
          .post('/api/docs/generate')
          .send({
            format: 'json',
            outputDir: './docs/test-output/json-only'
          })
          .expect(200);

        expect(response.body.data.generated).toContain('json');
        expect(response.body.data.generated).not.toContain('markdown');
        expect(fs.existsSync('./docs/test-output/json-only/api-documentation.json')).toBe(true);
        expect(fs.existsSync('./docs/test-output/json-only/api-documentation.md')).toBe(false);
      });

      it('should handle file system errors gracefully', async () => {
        const response = await request(app)
          .post('/api/docs/generate')
          .send({
            outputDir: '/invalid/path/that/cannot/be/created'
          })
          .expect(200);

        expect(response.body.data.issues.length).toBeGreaterThan(0);
        expect(response.body.data.issues[0]).toHaveProperty('format');
        expect(response.body.data.issues[0]).toHaveProperty('error');
      });
    });
  });

  describe('Documentation Content Validation', () => {
    it('should validate all authentication endpoints are documented', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const authRoutes = documentation.routes.filter(route => 
        route.tags?.includes('authentication')
      );

      const expectedAuthRoutes = [
        { method: 'POST', path: '/api/auth/register' },
        { method: 'POST', path: '/api/auth/login' },
        { method: 'GET', path: '/api/auth/me' }
      ];

      expectedAuthRoutes.forEach(expectedRoute => {
        const foundRoute = authRoutes.find(route => 
          route.method === expectedRoute.method && route.path === expectedRoute.path
        );
        expect(foundRoute).toBeDefined();
      });
    });

    it('should validate all habits endpoints are documented', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const habitsRoutes = documentation.routes.filter(route => 
        route.tags?.includes('habits')
      );

      const expectedHabitsRoutes = [
        { method: 'GET', path: '/api/habits' },
        { method: 'POST', path: '/api/habits' },
        { method: 'GET', path: '/api/habits/:id' },
        { method: 'PUT', path: '/api/habits/:id' },
        { method: 'DELETE', path: '/api/habits/:id' }
      ];

      expectedHabitsRoutes.forEach(expectedRoute => {
        const foundRoute = habitsRoutes.find(route => 
          route.method === expectedRoute.method && route.path === expectedRoute.path
        );
        expect(foundRoute).toBeDefined();
      });
    });

    it('should validate all analytics endpoints are documented', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const analyticsRoutes = documentation.routes.filter(route => 
        route.tags?.includes('analytics')
      );

      const expectedAnalyticsRoutes = [
        { method: 'GET', path: '/api/analytics/report' },
        { method: 'GET', path: '/api/analytics/summary' },
        { method: 'POST', path: '/api/analytics/export' }
      ];

      expectedAnalyticsRoutes.forEach(expectedRoute => {
        const foundRoute = analyticsRoutes.find(route => 
          route.method === expectedRoute.method && route.path === expectedRoute.path
        );
        expect(foundRoute).toBeDefined();
      });
    });

    it('should validate all teams endpoints are documented', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const teamsRoutes = documentation.routes.filter(route => 
        route.tags?.includes('teams')
      );

      const expectedTeamsRoutes = [
        { method: 'GET', path: '/api/teams' },
        { method: 'POST', path: '/api/teams' }
      ];

      expectedTeamsRoutes.forEach(expectedRoute => {
        const foundRoute = teamsRoutes.find(route => 
          route.method === expectedRoute.method && route.path === expectedRoute.path
        );
        expect(foundRoute).toBeDefined();
      });
    });

    it('should validate all health endpoints are documented', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const healthRoutes = documentation.routes.filter(route => 
        route.tags?.includes('health')
      );

      const expectedHealthRoutes = [
        { method: 'GET', path: '/api/health' },
        { method: 'GET', path: '/api/health/detailed' }
      ];

      expectedHealthRoutes.forEach(expectedRoute => {
        const foundRoute = healthRoutes.find(route => 
          route.method === expectedRoute.method && route.path === expectedRoute.path
        );
        expect(foundRoute).toBeDefined();
      });
    });
  });

  describe('Documentation Examples Validation', () => {
    it('should validate JavaScript examples are syntactically correct', async () => {
      const documentation = await docGenerator.generateDocumentation();
      
      documentation.routes.forEach(route => {
        const jsExample = route.examples?.find(ex => ex.language === 'javascript');
        expect(jsExample).toBeDefined();
        
        // Basic syntax validation
        expect(jsExample?.code).toContain('fetch(');
        expect(jsExample?.code).toContain('await');
        expect(jsExample?.code).toContain(route.path);
        expect(jsExample?.code).toContain(`method: '${route.method}'`);
        
        if (route.authentication) {
          expect(jsExample?.code).toContain('Authorization');
          expect(jsExample?.code).toContain('Bearer');
        }
        
        if (['POST', 'PUT', 'PATCH'].includes(route.method)) {
          expect(jsExample?.code).toContain('body: JSON.stringify');
        }
      });
    });

    it('should validate cURL examples are properly formatted', async () => {
      const documentation = await docGenerator.generateDocumentation();
      
      documentation.routes.forEach(route => {
        const curlExample = route.examples?.find(ex => ex.language === 'bash');
        expect(curlExample).toBeDefined();
        
        // Basic cURL validation
        expect(curlExample?.code).toContain('curl');
        expect(curlExample?.code).toContain(`-X ${route.method}`);
        expect(curlExample?.code).toContain(route.path);
        expect(curlExample?.code).toContain('Content-Type: application/json');
        
        if (route.authentication) {
          expect(curlExample?.code).toContain('Authorization: Bearer');
        }
        
        if (['POST', 'PUT', 'PATCH'].includes(route.method)) {
          expect(curlExample?.code).toContain("-d '");
        }
      });
    });

    it('should validate response examples match expected structure', async () => {
      const documentation = await docGenerator.generateDocumentation();
      
      documentation.routes.forEach(route => {
        route.responses?.forEach(response => {
          expect(response.example).toBeDefined();
          
          if (response.status >= 200 && response.status < 300) {
            // Success responses should have meaningful data
            expect(response.example).toBeDefined();
            
            if (route.path.includes('auth')) {
              if (response.status === 200 || response.status === 201) {
                expect(response.example).toHaveProperty('message');
                if (route.path === '/api/auth/login' || route.path === '/api/auth/register') {
                  expect(response.example).toHaveProperty('token');
                  expect(response.example).toHaveProperty('user');
                }
              }
            }
          } else {
            // Error responses should have error property
            expect(response.example).toHaveProperty('error');
          }
        });
      });
    });
  });

  describe('Documentation Consistency', () => {
    it('should ensure all routes have consistent structure', async () => {
      const documentation = await docGenerator.generateDocumentation();
      
      documentation.routes.forEach(route => {
        // Required properties
        expect(route).toHaveProperty('method');
        expect(route).toHaveProperty('path');
        expect(route).toHaveProperty('description');
        expect(route).toHaveProperty('parameters');
        expect(route).toHaveProperty('responses');
        expect(route).toHaveProperty('examples');
        expect(route).toHaveProperty('authentication');
        expect(route).toHaveProperty('tags');
        
        // Type validation
        expect(typeof route.method).toBe('string');
        expect(typeof route.path).toBe('string');
        expect(typeof route.description).toBe('string');
        expect(typeof route.authentication).toBe('boolean');
        expect(Array.isArray(route.parameters)).toBe(true);
        expect(Array.isArray(route.responses)).toBe(true);
        expect(Array.isArray(route.examples)).toBe(true);
        expect(Array.isArray(route.tags)).toBe(true);
      });
    });

    it('should ensure parameter definitions are complete', async () => {
      const documentation = await docGenerator.generateDocumentation();
      
      documentation.routes.forEach(route => {
        route.parameters?.forEach(param => {
          expect(param).toHaveProperty('name');
          expect(param).toHaveProperty('type');
          expect(param).toHaveProperty('location');
          expect(param).toHaveProperty('required');
          expect(param).toHaveProperty('description');
          
          expect(typeof param.name).toBe('string');
          expect(['string', 'number', 'boolean', 'object', 'array']).toContain(param.type);
          expect(['path', 'query', 'body', 'header']).toContain(param.location);
          expect(typeof param.required).toBe('boolean');
          expect(typeof param.description).toBe('string');
        });
      });
    });

    it('should ensure response definitions are complete', async () => {
      const documentation = await docGenerator.generateDocumentation();
      
      documentation.routes.forEach(route => {
        route.responses?.forEach(response => {
          expect(response).toHaveProperty('status');
          expect(response).toHaveProperty('description');
          expect(response).toHaveProperty('example');
          
          expect(typeof response.status).toBe('number');
          expect(response.status).toBeGreaterThanOrEqual(200);
          expect(response.status).toBeLessThan(600);
          expect(typeof response.description).toBe('string');
          expect(response.example).toBeDefined();
        });
      });
    });
  });

  describe('Performance Tests', () => {
    it('should generate documentation within reasonable time', async () => {
      const startTime = Date.now();
      await docGenerator.generateDocumentation();
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle multiple concurrent documentation requests', async () => {
      const promises = Array(5).fill(null).map(() => 
        request(app).get('/api/docs')
      );
      
      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('routes');
      });
    });
  });
});