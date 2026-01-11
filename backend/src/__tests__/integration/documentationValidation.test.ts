import request from 'supertest';
import { app } from '../../index';
import { DocumentationGenerator } from '../../services/documentationGenerator';
import jwt from 'jsonwebtoken';

describe('Documentation Examples Validation', () => {
  let docGenerator: DocumentationGenerator;
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    docGenerator = new DocumentationGenerator();
    
    // Create a test user for authentication
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'doctest@example.com',
        password: 'testpass123',
        name: 'Doc Test User'
      });

    if (registerResponse.status === 201) {
      testUser = registerResponse.body.user;
      authToken = registerResponse.body.token;
    } else {
      // User might already exist, try to login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'doctest@example.com',
          password: 'testpass123'
        });
      
      if (loginResponse.status === 200) {
        testUser = loginResponse.body.user;
        authToken = loginResponse.body.token;
      }
    }
  });

  describe('Authentication Endpoints Validation', () => {
    it('should validate register endpoint example', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const registerRoute = documentation.routes.find(r => 
        r.method === 'POST' && r.path === '/api/auth/register'
      );

      expect(registerRoute).toBeDefined();

      // Test with valid data (similar to documentation example)
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'password123',
          name: 'New User'
        });

      // Should succeed or fail with user already exists
      expect([201, 400]).toContain(response.status);
      
      if (response.status === 201) {
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('token');
        expect(response.body.user).toHaveProperty('id');
        expect(response.body.user).toHaveProperty('email', 'newuser@example.com');
        expect(response.body.user).toHaveProperty('name', 'New User');
      }
    });

    it('should validate login endpoint example', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const loginRoute = documentation.routes.find(r => 
        r.method === 'POST' && r.path === '/api/auth/login'
      );

      expect(loginRoute).toBeDefined();

      // Test with valid credentials
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'doctest@example.com',
          password: 'testpass123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('email', 'doctest@example.com');

      // Test with invalid credentials
      const invalidResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'doctest@example.com',
          password: 'wrongpassword'
        });

      expect(invalidResponse.status).toBe(401);
      expect(invalidResponse.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should validate me endpoint example', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const meRoute = documentation.routes.find(r => 
        r.method === 'GET' && r.path === '/api/auth/me'
      );

      expect(meRoute).toBeDefined();

      // Test with valid token
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email', 'doctest@example.com');

      // Test without token
      const unauthorizedResponse = await request(app)
        .get('/api/auth/me');

      expect(unauthorizedResponse.status).toBe(401);
      expect(unauthorizedResponse.body).toHaveProperty('error', 'Unauthorized');
    });
  });

  describe('Habits Endpoints Validation', () => {
    let testHabitId: string;

    it('should validate get habits endpoint example', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const getHabitsRoute = documentation.routes.find(r => 
        r.method === 'GET' && r.path === '/api/habits'
      );

      expect(getHabitsRoute).toBeDefined();

      const response = await request(app)
        .get('/api/habits')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('habits');
      expect(Array.isArray(response.body.habits)).toBe(true);
    });

    it('should validate create habit endpoint example', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const createHabitRoute = documentation.routes.find(r => 
        r.method === 'POST' && r.path === '/api/habits'
      );

      expect(createHabitRoute).toBeDefined();

      const response = await request(app)
        .post('/api/habits')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Morning Exercise',
          targetMinutes: 60,
          category: 'Health',
          skillLevel: 'Beginner',
          eisenhowerQuadrant: 'Q2',
          isWeekdayOnly: false
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('habit');
      expect(response.body).toHaveProperty('message');
      expect(response.body.habit).toHaveProperty('id');
      expect(response.body.habit).toHaveProperty('name', 'Morning Exercise');
      expect(response.body.habit).toHaveProperty('targetMinutes', 60);
      expect(response.body.habit).toHaveProperty('category', 'Health');

      testHabitId = response.body.habit.id;
    });

    it('should validate get habit by id endpoint example', async () => {
      if (!testHabitId) {
        // Create a habit first
        const createResponse = await request(app)
          .post('/api/habits')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Test Habit',
            targetMinutes: 30,
            category: 'Test'
          });
        testHabitId = createResponse.body.habit.id;
      }

      const documentation = await docGenerator.generateDocumentation();
      const getHabitRoute = documentation.routes.find(r => 
        r.method === 'GET' && r.path === '/api/habits/:id'
      );

      expect(getHabitRoute).toBeDefined();

      const response = await request(app)
        .get(`/api/habits/${testHabitId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('habit');
      expect(response.body.habit).toHaveProperty('id', testHabitId);

      // Test with includeHistory parameter
      const responseWithHistory = await request(app)
        .get(`/api/habits/${testHabitId}?includeHistory=true`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(responseWithHistory.status).toBe(200);
      expect(responseWithHistory.body.habit).toHaveProperty('habitHistory');
    });

    it('should validate update habit endpoint example', async () => {
      if (!testHabitId) {
        const createResponse = await request(app)
          .post('/api/habits')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Test Habit',
            targetMinutes: 30,
            category: 'Test'
          });
        testHabitId = createResponse.body.habit.id;
      }

      const documentation = await docGenerator.generateDocumentation();
      const updateHabitRoute = documentation.routes.find(r => 
        r.method === 'PUT' && r.path === '/api/habits/:id'
      );

      expect(updateHabitRoute).toBeDefined();

      const response = await request(app)
        .put(`/api/habits/${testHabitId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Evening Exercise',
          targetMinutes: 90
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('habit');
      expect(response.body).toHaveProperty('message');
      expect(response.body.habit).toHaveProperty('name', 'Evening Exercise');
      expect(response.body.habit).toHaveProperty('targetMinutes', 90);
    });

    it('should validate delete habit endpoint example', async () => {
      // Create a habit to delete
      const createResponse = await request(app)
        .post('/api/habits')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Habit to Delete',
          targetMinutes: 15,
          category: 'Test'
        });

      const habitToDeleteId = createResponse.body.habit.id;

      const documentation = await docGenerator.generateDocumentation();
      const deleteHabitRoute = documentation.routes.find(r => 
        r.method === 'DELETE' && r.path === '/api/habits/:id'
      );

      expect(deleteHabitRoute).toBeDefined();

      const response = await request(app)
        .delete(`/api/habits/${habitToDeleteId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');

      // Verify habit is deleted
      const getResponse = await request(app)
        .get(`/api/habits/${habitToDeleteId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.status).toBe(404);
    });
  });

  describe('Analytics Endpoints Validation', () => {
    it('should validate analytics report endpoint example', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const reportRoute = documentation.routes.find(r => 
        r.method === 'GET' && r.path === '/api/analytics/report'
      );

      expect(reportRoute).toBeDefined();

      const response = await request(app)
        .get('/api/analytics/report?startDate=2024-01-01&endDate=2024-01-31&type=month')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message');
      expect(response.body.data).toHaveProperty('period');
      expect(response.body.data).toHaveProperty('summary');

      // Test missing parameters
      const badResponse = await request(app)
        .get('/api/analytics/report')
        .set('Authorization', `Bearer ${authToken}`);

      expect(badResponse.status).toBe(400);
      expect(badResponse.body).toHaveProperty('error');
    });

    it('should validate analytics summary endpoint example', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const summaryRoute = documentation.routes.find(r => 
        r.method === 'GET' && r.path === '/api/analytics/summary'
      );

      expect(summaryRoute).toBeDefined();

      const response = await request(app)
        .get('/api/analytics/summary?days=30')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message');
      expect(response.body.data).toHaveProperty('period');
      expect(response.body.data).toHaveProperty('averageKPI');
    });

    it('should validate analytics export endpoint example', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const exportRoute = documentation.routes.find(r => 
        r.method === 'POST' && r.path === '/api/analytics/export'
      );

      expect(exportRoute).toBeDefined();

      const response = await request(app)
        .post('/api/analytics/export')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'json',
          dateRange: {
            start: '2024-01-01',
            end: '2024-01-31'
          },
          includeHabits: true,
          includeAnalytics: true
        });

      expect(response.status).toBe(200);
      // Response should be a file download
      expect(response.headers['content-type']).toContain('application/json');
    });
  });

  describe('Teams Endpoints Validation', () => {
    let testTeamId: string;

    it('should validate get teams endpoint example', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const getTeamsRoute = documentation.routes.find(r => 
        r.method === 'GET' && r.path === '/api/teams'
      );

      expect(getTeamsRoute).toBeDefined();

      const response = await request(app)
        .get('/api/teams')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should validate create team endpoint example', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const createTeamRoute = documentation.routes.find(r => 
        r.method === 'POST' && r.path === '/api/teams'
      );

      expect(createTeamRoute).toBeDefined();

      const response = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Development Team',
          description: 'Software development team'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', 'Development Team');
      expect(response.body).toHaveProperty('description', 'Software development team');

      testTeamId = response.body.id;
    });
  });

  describe('Health Endpoints Validation', () => {
    it('should validate basic health endpoint example', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const healthRoute = documentation.routes.find(r => 
        r.method === 'GET' && r.path === '/api/health'
      );

      expect(healthRoute).toBeDefined();

      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    it('should validate detailed health endpoint example', async () => {
      const documentation = await docGenerator.generateDocumentation();
      const detailedHealthRoute = documentation.routes.find(r => 
        r.method === 'GET' && r.path === '/api/health/detailed'
      );

      expect(detailedHealthRoute).toBeDefined();

      const response = await request(app)
        .get('/api/health/detailed');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');
    });
  });

  describe('Error Response Validation', () => {
    it('should validate 401 unauthorized responses', async () => {
      const protectedEndpoints = [
        { method: 'get', path: '/api/habits' },
        { method: 'post', path: '/api/habits' },
        { method: 'get', path: '/api/analytics/summary' },
        { method: 'get', path: '/api/teams' }
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(app)[endpoint.method as keyof typeof request](endpoint.path);
        
        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error');
      }
    });

    it('should validate 400 bad request responses', async () => {
      // Test invalid registration data
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: '123' // too short
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate 404 not found responses', async () => {
      const response = await request(app)
        .get('/api/habits/nonexistent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Parameter Validation', () => {
    it('should validate required parameters are enforced', async () => {
      // Test missing required body parameters
      const response = await request(app)
        .post('/api/habits')
        .set('Authorization', `Bearer ${authToken}`)
        .send({}); // Missing required fields

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate query parameters work correctly', async () => {
      // Test analytics report with query parameters
      const response = await request(app)
        .get('/api/analytics/report?startDate=2024-01-01&endDate=2024-01-31')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.period).toHaveProperty('start');
      expect(response.body.data.period).toHaveProperty('end');
    });

    it('should validate path parameters work correctly', async () => {
      // Create a habit first
      const createResponse = await request(app)
        .post('/api/habits')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Path Test Habit',
          targetMinutes: 30,
          category: 'Test'
        });

      const habitId = createResponse.body.habit.id;

      // Test path parameter
      const response = await request(app)
        .get(`/api/habits/${habitId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.habit).toHaveProperty('id', habitId);
    });
  });

  describe('Response Format Validation', () => {
    it('should validate response formats match documentation', async () => {
      const documentation = await docGenerator.generateDocumentation();
      
      // Test login response format
      const loginRoute = documentation.routes.find(r => 
        r.method === 'POST' && r.path === '/api/auth/login'
      );
      const successResponse = loginRoute?.responses?.find(r => r.status === 200);
      
      const actualResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'doctest@example.com',
          password: 'testpass123'
        });

      expect(actualResponse.status).toBe(200);
      
      // Validate response structure matches documentation
      const expectedKeys = Object.keys(successResponse?.example || {});
      expectedKeys.forEach(key => {
        expect(actualResponse.body).toHaveProperty(key);
      });
    });

    it('should validate error response formats match documentation', async () => {
      const documentation = await docGenerator.generateDocumentation();
      
      // Test login error response format
      const loginRoute = documentation.routes.find(r => 
        r.method === 'POST' && r.path === '/api/auth/login'
      );
      const errorResponse = loginRoute?.responses?.find(r => r.status === 401);
      
      const actualResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'doctest@example.com',
          password: 'wrongpassword'
        });

      expect(actualResponse.status).toBe(401);
      expect(actualResponse.body).toHaveProperty('error');
      expect(actualResponse.body.error).toBe(errorResponse?.example.error);
    });
  });

  describe('Code Examples Syntax Validation', () => {
    it('should validate JavaScript examples have correct syntax', async () => {
      const documentation = await docGenerator.generateDocumentation();
      
      documentation.routes.forEach(route => {
        const jsExample = route.examples?.find(ex => ex.language === 'javascript');
        expect(jsExample).toBeDefined();
        
        // Basic syntax checks
        expect(jsExample?.code).toMatch(/const\s+\w+\s*=/); // Variable declaration
        expect(jsExample?.code).toMatch(/await\s+fetch\(/); // Async/await
        expect(jsExample?.code).toMatch(/\{[\s\S]*\}/); // Object literal
        
        // No obvious syntax errors
        expect(jsExample?.code).not.toContain('undefined');
        expect(jsExample?.code).not.toContain('null');
        expect(jsExample?.code).not.toMatch(/\{\s*\}/); // Empty objects in examples
      });
    });

    it('should validate cURL examples have correct syntax', async () => {
      const documentation = await docGenerator.generateDocumentation();
      
      documentation.routes.forEach(route => {
        const curlExample = route.examples?.find(ex => ex.language === 'bash');
        expect(curlExample).toBeDefined();
        
        // Basic cURL syntax checks
        expect(curlExample?.code).toMatch(/^curl\s/); // Starts with curl
        expect(curlExample?.code).toMatch(/-X\s+(GET|POST|PUT|DELETE)/); // HTTP method
        expect(curlExample?.code).toMatch(/http:\/\/localhost:3001/); // Base URL
        
        // Headers should be properly formatted
        const headerMatches = curlExample?.code.match(/-H\s+"[^"]+"/g);
        if (headerMatches) {
          headerMatches.forEach(header => {
            expect(header).toMatch(/-H\s+"[^"]+:\s*[^"]+"/); // Header format
          });
        }
      });
    });
  });
});