import request from 'supertest';
import app from '../../index';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Goals Integration', () => {
  let authToken: string;
  let userId: string;
  let goalId: string;

  beforeAll(async () => {
    // Create a test user and get auth token
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test-goals@example.com',
        password: 'testpassword123',
        name: 'Test User'
      });

    authToken = userResponse.body.token;
    userId = userResponse.body.user.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (userId) {
      await prisma.goalHabit.deleteMany({ where: { goal: { userId } } });
      await prisma.goalConnection.deleteMany({ where: { fromGoal: { userId } } });
      await prisma.goal.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
    await prisma.$disconnect();
  });

  describe('Goal Creation and Management', () => {
    it('should create a new goal', async () => {
      const response = await request(app)
        .post('/api/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Goal',
          description: 'A test goal for integration testing',
          type: 'main',
          positionX: 100,
          positionY: 200,
          color: '#FF5733'
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.title).toBe('Test Goal');
      expect(response.body.data.type).toBe('main');
      
      goalId = response.body.data.id;
    });

    it('should generate habit suggestions from goal', async () => {
      const response = await request(app)
        .post(`/api/goals/${goalId}/generate-habits`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      // Check that suggestions have required properties
      const suggestion = response.body.data[0];
      expect(suggestion).toHaveProperty('name');
      expect(suggestion).toHaveProperty('targetMinutes');
      expect(suggestion).toHaveProperty('category');
      expect(suggestion).toHaveProperty('skillLevel');
    });

    it('should create habits from goal suggestions', async () => {
      // First get suggestions
      const suggestionsResponse = await request(app)
        .post(`/api/goals/${goalId}/generate-habits`)
        .set('Authorization', `Bearer ${authToken}`);

      const suggestions = suggestionsResponse.body.data;
      const selectedHabits = suggestions.slice(0, 2); // Select first 2 suggestions

      const response = await request(app)
        .post(`/api/goals/${goalId}/create-habits`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ selectedHabits });

      expect(response.status).toBe(201);
      expect(response.body.data.createdHabits).toHaveLength(2);
      expect(response.body.data.goalHabits).toHaveLength(2);
      expect(response.body.data.message).toContain('Successfully created 2 habits');
    });

    it('should sync progress between goal and habits', async () => {
      const response = await request(app)
        .put(`/api/goals/${goalId}/sync-progress`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('goal');
      expect(response.body.data).toHaveProperty('previousProgress');
      expect(response.body.data).toHaveProperty('newProgress');
      expect(response.body.data).toHaveProperty('habitCount');
    });

    it('should get progress analysis for goal', async () => {
      const response = await request(app)
        .get(`/api/goals/${goalId}/progress-analysis?days=30`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('goal');
      expect(response.body.data).toHaveProperty('habitAnalysis');
      expect(response.body.data).toHaveProperty('overallMetrics');
      expect(response.body.data).toHaveProperty('recommendations');
      
      expect(response.body.data.overallMetrics).toHaveProperty('totalHabits');
      expect(response.body.data.overallMetrics).toHaveProperty('averageCompletion');
    });

    it('should prevent deletion of goal with connected habits', async () => {
      const response = await request(app)
        .delete(`/api/goals/${goalId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Cannot delete goal with connected habits');
      expect(response.body.details).toHaveProperty('connectedHabits');
    });

    it('should connect and disconnect habits manually', async () => {
      // Create a new habit first
      const habitResponse = await request(app)
        .post('/api/habits')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Manual Test Habit',
          targetMinutes: 60,
          category: 'skills',
          skillLevel: 3
        });

      const habitId = habitResponse.body.habit.id;

      // Connect habit to goal
      const connectResponse = await request(app)
        .post(`/api/goals/${goalId}/habits`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ habitId });

      expect(connectResponse.status).toBe(201);
      expect(connectResponse.body.data.habitId).toBe(habitId);

      // Disconnect habit from goal
      const disconnectResponse = await request(app)
        .delete(`/api/goals/${goalId}/habits/${habitId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(disconnectResponse.status).toBe(200);
      expect(disconnectResponse.body.message).toContain('disconnected');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent goal', async () => {
      const response = await request(app)
        .post('/api/goals/non-existent-id/generate-habits')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Goal not found');
    });

    it('should validate habit creation input', async () => {
      const response = await request(app)
        .post(`/api/goals/${goalId}/create-habits`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ selectedHabits: [] });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No habits selected');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post(`/api/goals/${goalId}/generate-habits`);

      expect(response.status).toBe(401);
    });
  });
});