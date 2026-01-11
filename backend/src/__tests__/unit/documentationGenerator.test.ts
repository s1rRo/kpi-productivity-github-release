import { DocumentationGenerator } from '../../services/documentationGenerator';
import fs from 'fs';
import path from 'path';

describe('DocumentationGenerator Unit Tests', () => {
  let docGenerator: DocumentationGenerator;

  beforeEach(() => {
    docGenerator = new DocumentationGenerator();
  });

  afterEach(() => {
    // Clean up test files
    const testFiles = [
      './test-output.md',
      './test-output.json',
      './docs/test/test-doc.md'
    ];
    
    testFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });

    // Clean up test directories
    const testDirs = ['./docs/test'];
    testDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe('Constructor', () => {
    it('should initialize with empty routes array', () => {
      const generator = new DocumentationGenerator();
      expect(generator).toBeInstanceOf(DocumentationGenerator);
    });
  });

  describe('Route Information Extraction', () => {
    it('should extract authentication routes correctly', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const authRoutes = documentation.routes.filter(route => 
        route.tags?.includes('authentication')
      );

      expect(authRoutes.length).toBe(3);

      const registerRoute = authRoutes.find(r => r.path === '/api/auth/register');
      expect(registerRoute).toBeDefined();
      expect(registerRoute?.method).toBe('POST');
      expect(registerRoute?.authentication).toBe(false);
      expect(registerRoute?.description).toContain('Register');

      const loginRoute = authRoutes.find(r => r.path === '/api/auth/login');
      expect(loginRoute).toBeDefined();
      expect(loginRoute?.method).toBe('POST');
      expect(loginRoute?.authentication).toBe(false);
      expect(loginRoute?.description).toContain('Authenticate');

      const meRoute = authRoutes.find(r => r.path === '/api/auth/me');
      expect(meRoute).toBeDefined();
      expect(meRoute?.method).toBe('GET');
      expect(meRoute?.authentication).toBe(true);
      expect(meRoute?.description).toContain('current authenticated user');
    });

    it('should extract habits routes correctly', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const habitsRoutes = documentation.routes.filter(route => 
        route.tags?.includes('habits')
      );

      expect(habitsRoutes.length).toBe(5);

      const methods = habitsRoutes.map(r => r.method);
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
      expect(methods).toContain('PUT');
      expect(methods).toContain('DELETE');

      // All habits routes should require authentication
      habitsRoutes.forEach(route => {
        expect(route.authentication).toBe(true);
      });
    });

    it('should extract analytics routes correctly', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const analyticsRoutes = documentation.routes.filter(route => 
        route.tags?.includes('analytics')
      );

      expect(analyticsRoutes.length).toBe(3);

      const reportRoute = analyticsRoutes.find(r => r.path === '/api/analytics/report');
      expect(reportRoute).toBeDefined();
      expect(reportRoute?.method).toBe('GET');
      expect(reportRoute?.authentication).toBe(true);

      const summaryRoute = analyticsRoutes.find(r => r.path === '/api/analytics/summary');
      expect(summaryRoute).toBeDefined();
      expect(summaryRoute?.method).toBe('GET');
      expect(summaryRoute?.authentication).toBe(true);

      const exportRoute = analyticsRoutes.find(r => r.path === '/api/analytics/export');
      expect(exportRoute).toBeDefined();
      expect(exportRoute?.method).toBe('POST');
      expect(exportRoute?.authentication).toBe(true);
    });

    it('should extract teams routes correctly', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const teamsRoutes = documentation.routes.filter(route => 
        route.tags?.includes('teams')
      );

      expect(teamsRoutes.length).toBe(2);

      const getTeamsRoute = teamsRoutes.find(r => r.method === 'GET');
      expect(getTeamsRoute).toBeDefined();
      expect(getTeamsRoute?.path).toBe('/api/teams');
      expect(getTeamsRoute?.authentication).toBe(true);

      const createTeamRoute = teamsRoutes.find(r => r.method === 'POST');
      expect(createTeamRoute).toBeDefined();
      expect(createTeamRoute?.path).toBe('/api/teams');
      expect(createTeamRoute?.authentication).toBe(true);
    });

    it('should extract health routes correctly', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const healthRoutes = documentation.routes.filter(route => 
        route.tags?.includes('health')
      );

      expect(healthRoutes.length).toBe(2);

      const basicHealthRoute = healthRoutes.find(r => r.path === '/api/health');
      expect(basicHealthRoute).toBeDefined();
      expect(basicHealthRoute?.method).toBe('GET');
      expect(basicHealthRoute?.authentication).toBe(false);

      const detailedHealthRoute = healthRoutes.find(r => r.path === '/api/health/detailed');
      expect(detailedHealthRoute).toBeDefined();
      expect(detailedHealthRoute?.method).toBe('GET');
      expect(detailedHealthRoute?.authentication).toBe(false);
    });
  });

  describe('Parameter Extraction', () => {
    it('should extract path parameters correctly', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const habitByIdRoute = documentation.routes.find(r => 
        r.method === 'GET' && r.path === '/api/habits/:id'
      );

      expect(habitByIdRoute).toBeDefined();
      expect(habitByIdRoute?.parameters).toBeInstanceOf(Array);
      
      const idParam = habitByIdRoute?.parameters?.find(p => p.name === 'id');
      expect(idParam).toBeDefined();
      expect(idParam?.type).toBe('string');
      expect(idParam?.location).toBe('path');
      expect(idParam?.required).toBe(true);
      expect(idParam?.description).toContain('Habit ID');
    });

    it('should extract query parameters correctly', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const analyticsReportRoute = documentation.routes.find(r => 
        r.method === 'GET' && r.path === '/api/analytics/report'
      );

      expect(analyticsReportRoute).toBeDefined();
      
      const startDateParam = analyticsReportRoute?.parameters?.find(p => p.name === 'startDate');
      expect(startDateParam).toBeDefined();
      expect(startDateParam?.type).toBe('string');
      expect(startDateParam?.location).toBe('query');
      expect(startDateParam?.required).toBe(true);

      const endDateParam = analyticsReportRoute?.parameters?.find(p => p.name === 'endDate');
      expect(endDateParam).toBeDefined();
      expect(endDateParam?.type).toBe('string');
      expect(endDateParam?.location).toBe('query');
      expect(endDateParam?.required).toBe(true);

      const typeParam = analyticsReportRoute?.parameters?.find(p => p.name === 'type');
      expect(typeParam).toBeDefined();
      expect(typeParam?.type).toBe('string');
      expect(typeParam?.location).toBe('query');
      expect(typeParam?.required).toBe(false);
    });

    it('should extract body parameters correctly', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const registerRoute = documentation.routes.find(r => 
        r.method === 'POST' && r.path === '/api/auth/register'
      );

      expect(registerRoute).toBeDefined();
      
      const emailParam = registerRoute?.parameters?.find(p => p.name === 'email');
      expect(emailParam).toBeDefined();
      expect(emailParam?.type).toBe('string');
      expect(emailParam?.location).toBe('body');
      expect(emailParam?.required).toBe(true);
      expect(emailParam?.example).toBe('user@example.com');

      const passwordParam = registerRoute?.parameters?.find(p => p.name === 'password');
      expect(passwordParam).toBeDefined();
      expect(passwordParam?.type).toBe('string');
      expect(passwordParam?.location).toBe('body');
      expect(passwordParam?.required).toBe(true);

      const nameParam = registerRoute?.parameters?.find(p => p.name === 'name');
      expect(nameParam).toBeDefined();
      expect(nameParam?.type).toBe('string');
      expect(nameParam?.location).toBe('body');
      expect(nameParam?.required).toBe(false);
    });

    it('should extract header parameters correctly', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const protectedRoutes = documentation.routes.filter(r => r.authentication === true);

      expect(protectedRoutes.length).toBeGreaterThan(0);

      protectedRoutes.forEach(route => {
        const authParam = route.parameters?.find(p => p.name === 'Authorization');
        expect(authParam).toBeDefined();
        expect(authParam?.type).toBe('string');
        expect(authParam?.location).toBe('header');
        expect(authParam?.required).toBe(true);
        expect(authParam?.description).toContain('Bearer JWT token');
      });
    });
  });

  describe('Response Information', () => {
    it('should include standard HTTP status codes', async () => {
      const documentation = await docGenerator.generateDocumentation();
      
      documentation.routes.forEach(route => {
        expect(route.responses).toBeInstanceOf(Array);
        expect(route.responses?.length).toBeGreaterThan(0);

        const statusCodes = route.responses?.map(r => r.status) || [];
        
        // Should include success status
        expect(statusCodes.some(code => code >= 200 && code < 300)).toBe(true);
        
        // Should include error statuses
        expect(statusCodes).toContain(400); // Bad Request
        expect(statusCodes).toContain(500); // Internal Server Error
        
        if (route.authentication) {
          expect(statusCodes).toContain(401); // Unauthorized
        }
      });
    });

    it('should provide meaningful response examples', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const loginRoute = documentation.routes.find(r => 
        r.method === 'POST' && r.path === '/api/auth/login'
      );

      expect(loginRoute).toBeDefined();
      
      const successResponse = loginRoute?.responses?.find(r => r.status === 200);
      expect(successResponse).toBeDefined();
      expect(successResponse?.example).toHaveProperty('message');
      expect(successResponse?.example).toHaveProperty('user');
      expect(successResponse?.example).toHaveProperty('token');
      expect(successResponse?.example.user).toHaveProperty('id');
      expect(successResponse?.example.user).toHaveProperty('email');

      const errorResponse = loginRoute?.responses?.find(r => r.status === 401);
      expect(errorResponse).toBeDefined();
      expect(errorResponse?.example).toHaveProperty('error');
      expect(errorResponse?.example.error).toBe('Invalid credentials');
    });
  });

  describe('Code Examples Generation', () => {
    it('should generate JavaScript examples for all routes', async () => {
      const documentation = await docGenerator.generateDocumentation();
      
      documentation.routes.forEach(route => {
        const jsExample = route.examples?.find(ex => ex.language === 'javascript');
        expect(jsExample).toBeDefined();
        expect(jsExample?.code).toContain('fetch(');
        expect(jsExample?.code).toContain('await');
        expect(jsExample?.code).toContain(route.path);
        expect(jsExample?.code).toContain(`method: '${route.method}'`);
        expect(jsExample?.description).toContain('JavaScript');
      });
    });

    it('should generate cURL examples for all routes', async () => {
      const documentation = await docGenerator.generateDocumentation();
      
      documentation.routes.forEach(route => {
        const curlExample = route.examples?.find(ex => ex.language === 'bash');
        expect(curlExample).toBeDefined();
        expect(curlExample?.code).toContain('curl');
        expect(curlExample?.code).toContain(`-X ${route.method}`);
        expect(curlExample?.code).toContain(route.path);
        expect(curlExample?.description).toContain('cURL');
      });
    });

    it('should include authentication headers in protected route examples', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const protectedRoutes = documentation.routes.filter(r => r.authentication === true);

      protectedRoutes.forEach(route => {
        const jsExample = route.examples?.find(ex => ex.language === 'javascript');
        expect(jsExample?.code).toContain('Authorization');
        expect(jsExample?.code).toContain('Bearer YOUR_JWT_TOKEN');

        const curlExample = route.examples?.find(ex => ex.language === 'bash');
        expect(curlExample?.code).toContain('Authorization: Bearer YOUR_JWT_TOKEN');
      });
    });

    it('should include request body in POST/PUT examples', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const bodyRoutes = documentation.routes.filter(r => 
        ['POST', 'PUT', 'PATCH'].includes(r.method)
      );

      bodyRoutes.forEach(route => {
        const jsExample = route.examples?.find(ex => ex.language === 'javascript');
        expect(jsExample?.code).toContain('body: JSON.stringify');

        const curlExample = route.examples?.find(ex => ex.language === 'bash');
        expect(curlExample?.code).toContain("-d '");
      });
    });
  });

  describe('Markdown Generation', () => {
    it('should generate valid markdown structure', async () => {
      const markdown = await docGenerator.generateMarkdownDocumentation();

      // Check main title
      expect(markdown).toContain('# KPI Productivity API');
      
      // Check metadata
      expect(markdown).toContain('**Version:**');
      expect(markdown).toContain('**Base URL:**');
      expect(markdown).toContain('**Generated:**');

      // Check section headers
      expect(markdown).toContain('## Authentication');
      expect(markdown).toContain('## Habits');
      expect(markdown).toContain('## Analytics');
      expect(markdown).toContain('## Teams');
      expect(markdown).toContain('## Health');

      // Check route documentation
      expect(markdown).toContain('### POST /api/auth/login');
      expect(markdown).toContain('### GET /api/habits');
      
      // Check subsections
      expect(markdown).toContain('**Parameters:**');
      expect(markdown).toContain('**Responses:**');
      expect(markdown).toContain('**Examples:**');
      expect(markdown).toContain('**Authentication:** Required');

      // Check code blocks
      expect(markdown).toContain('```javascript');
      expect(markdown).toContain('```bash');
      expect(markdown).toContain('```json');
    });

    it('should properly escape markdown special characters', async () => {
      const markdown = await docGenerator.generateMarkdownDocumentation();
      
      // Should not have unescaped special characters that break markdown
      const lines = markdown.split('\n');
      lines.forEach(line => {
        // Check for common markdown issues
        if (line.includes('*') && !line.includes('**') && !line.includes('```')) {
          // Single asterisks should be in code blocks or escaped
          expect(line).toMatch(/`.*\*.*`|\\*/);
        }
      });
    });

    it('should organize routes by tags correctly', async () => {
      const markdown = await docGenerator.generateMarkdownDocumentation();
      
      // Authentication section should come before habits
      const authIndex = markdown.indexOf('## Authentication');
      const habitsIndex = markdown.indexOf('## Habits');
      const analyticsIndex = markdown.indexOf('## Analytics');
      
      expect(authIndex).toBeGreaterThan(-1);
      expect(habitsIndex).toBeGreaterThan(-1);
      expect(analyticsIndex).toBeGreaterThan(-1);
      
      // Check that routes are in their correct sections
      const authSection = markdown.substring(authIndex, habitsIndex);
      expect(authSection).toContain('### POST /api/auth/register');
      expect(authSection).toContain('### POST /api/auth/login');
      expect(authSection).toContain('### GET /api/auth/me');
    });
  });

  describe('JSON Generation', () => {
    it('should generate valid JSON', async () => {
      const jsonString = await docGenerator.generateJSONDocumentation();
      
      expect(() => JSON.parse(jsonString)).not.toThrow();
      
      const parsed = JSON.parse(jsonString);
      expect(parsed).toHaveProperty('title');
      expect(parsed).toHaveProperty('version');
      expect(parsed).toHaveProperty('description');
      expect(parsed).toHaveProperty('baseUrl');
      expect(parsed).toHaveProperty('routes');
      expect(parsed).toHaveProperty('generatedAt');
    });

    it('should match the structure of generateDocumentation', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const jsonString = await docGenerator.generateJSONDocumentation();
      const parsedJson = JSON.parse(jsonString);

      expect(parsedJson.title).toBe(documentation.title);
      expect(parsedJson.version).toBe(documentation.version);
      expect(parsedJson.description).toBe(documentation.description);
      expect(parsedJson.baseUrl).toBe(documentation.baseUrl);
      expect(parsedJson.routes.length).toBe(documentation.routes.length);
      
      // Check that all routes are present
      documentation.routes.forEach((route, index) => {
        expect(parsedJson.routes[index].method).toBe(route.method);
        expect(parsedJson.routes[index].path).toBe(route.path);
        expect(parsedJson.routes[index].description).toBe(route.description);
      });
    });
  });

  describe('File Operations', () => {
    it('should save documentation to specified file', async () => {
      const outputPath = './test-output.md';
      
      await docGenerator.saveDocumentation(outputPath);
      
      expect(fs.existsSync(outputPath)).toBe(true);
      
      const content = fs.readFileSync(outputPath, 'utf8');
      expect(content).toContain('# KPI Productivity API');
      expect(content.length).toBeGreaterThan(1000);
    });

    it('should create directories if they do not exist', async () => {
      const outputPath = './docs/test/test-doc.md';
      
      await docGenerator.saveDocumentation(outputPath);
      
      expect(fs.existsSync('./docs/test')).toBe(true);
      expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('should overwrite existing files', async () => {
      const outputPath = './test-output.md';
      
      // Create initial file
      fs.writeFileSync(outputPath, 'initial content', 'utf8');
      expect(fs.readFileSync(outputPath, 'utf8')).toBe('initial content');
      
      // Save documentation
      await docGenerator.saveDocumentation(outputPath);
      
      const content = fs.readFileSync(outputPath, 'utf8');
      expect(content).not.toBe('initial content');
      expect(content).toContain('# KPI Productivity API');
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      const invalidPath = '/invalid/path/that/cannot/be/created/doc.md';
      
      await expect(docGenerator.saveDocumentation(invalidPath)).rejects.toThrow();
    });

    it('should handle empty routes gracefully', async () => {
      // Create a generator with no routes (mock the getKnownRoutes method)
      const emptyGenerator = new DocumentationGenerator();
      (emptyGenerator as any).getKnownRoutes = jest.fn().mockReturnValue([]);
      
      const documentation = await emptyGenerator.generateDocumentation();
      
      expect(documentation.routes).toHaveLength(0);
      expect(documentation.title).toBe('KPI Productivity API');
      expect(documentation.version).toBe('1.0.0');
    });
  });

  describe('Documentation Completeness', () => {
    it('should ensure all routes have required properties', async () => {
      const documentation = await docGenerator.generateDocumentation();
      
      documentation.routes.forEach(route => {
        expect(route).toHaveProperty('method');
        expect(route).toHaveProperty('path');
        expect(route).toHaveProperty('description');
        expect(route).toHaveProperty('parameters');
        expect(route).toHaveProperty('responses');
        expect(route).toHaveProperty('examples');
        expect(route).toHaveProperty('authentication');
        expect(route).toHaveProperty('tags');
        
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

    it('should ensure all routes have at least one example', async () => {
      const documentation = await docGenerator.generateDocumentation();
      
      documentation.routes.forEach(route => {
        expect(route.examples?.length).toBeGreaterThan(0);
        
        const hasJsExample = route.examples?.some(ex => ex.language === 'javascript');
        const hasCurlExample = route.examples?.some(ex => ex.language === 'bash');
        
        expect(hasJsExample).toBe(true);
        expect(hasCurlExample).toBe(true);
      });
    });

    it('should ensure all routes have at least one response', async () => {
      const documentation = await docGenerator.generateDocumentation();
      
      documentation.routes.forEach(route => {
        expect(route.responses?.length).toBeGreaterThan(0);
        
        // Should have at least one success response
        const hasSuccessResponse = route.responses?.some(r => r.status >= 200 && r.status < 300);
        expect(hasSuccessResponse).toBe(true);
        
        // Should have at least one error response
        const hasErrorResponse = route.responses?.some(r => r.status >= 400);
        expect(hasErrorResponse).toBe(true);
      });
    });
  });
});