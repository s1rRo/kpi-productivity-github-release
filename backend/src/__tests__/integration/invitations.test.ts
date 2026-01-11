import request from 'supertest';
import app from '../../index';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Invitations API', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Create a test user and get auth token
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test-invitations@example.com',
        password: 'password123',
        name: 'Test User'
      });

    authToken = userResponse.body.token;
    userId = userResponse.body.user.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.friendInvite.deleteMany({ where: { senderId: userId } });
    await prisma.teamInvite.deleteMany({ where: { senderId: userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  describe('GET /api/invitations/my-code', () => {
    it('should return user invite code', async () => {
      const response = await request(app)
        .get('/api/invitations/my-code')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('inviteCode');
      expect(typeof response.body.data.inviteCode).toBe('string');
      expect(response.body.data.inviteCode.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/invitations/friends/email', () => {
    it('should create friend invitation', async () => {
      const inviteData = {
        email: 'friend@example.com',
        message: 'Join me on KPI Productivity!'
      };

      const response = await request(app)
        .post('/api/invitations/friends/email')
        .set('Authorization', `Bearer ${authToken}`)
        .send(inviteData)
        .expect(201);

      expect(response.body.data).toHaveProperty('inviteCode');
      expect(response.body.data).toHaveProperty('expiresAt');
      expect(response.body.data).toHaveProperty('emailSent');
      expect(typeof response.body.data.inviteCode).toBe('string');
    });

    it('should reject invalid email', async () => {
      const inviteData = {
        email: 'invalid-email',
        message: 'Test message'
      };

      await request(app)
        .post('/api/invitations/friends/email')
        .set('Authorization', `Bearer ${authToken}`)
        .send(inviteData)
        .expect(400);
    });

    it('should reject existing user email', async () => {
      const inviteData = {
        email: 'test-invitations@example.com', // Same as test user
        message: 'Test message'
      };

      await request(app)
        .post('/api/invitations/friends/email')
        .set('Authorization', `Bearer ${authToken}`)
        .send(inviteData)
        .expect(400);
    });
  });

  describe('GET /api/invitations/friends/validate/:inviteCode', () => {
    let inviteCode: string;

    beforeAll(async () => {
      // Create a test invitation
      const response = await request(app)
        .post('/api/invitations/friends/email')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'validate-test@example.com',
          message: 'Test validation'
        });

      inviteCode = response.body.data.inviteCode;
    });

    it('should validate existing invite code', async () => {
      const response = await request(app)
        .get(`/api/invitations/friends/validate/${inviteCode}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('senderName');
      expect(response.body.data).toHaveProperty('message');
      expect(response.body.data).toHaveProperty('expiresAt');
    });

    it('should reject invalid invite code', async () => {
      await request(app)
        .get('/api/invitations/friends/validate/INVALID1')
        .expect(400);
    });

    it('should reject non-existent invite code', async () => {
      await request(app)
        .get('/api/invitations/friends/validate/ABCD1234')
        .expect(400);
    });
  });

  describe('GET /api/invitations/sent', () => {
    it('should return sent invitations', async () => {
      const response = await request(app)
        .get('/api/invitations/sent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('friendInvites');
      expect(response.body.data).toHaveProperty('teamInvites');
      expect(Array.isArray(response.body.data.friendInvites)).toBe(true);
      expect(Array.isArray(response.body.data.teamInvites)).toBe(true);
    });
  });

  describe('GET /api/invitations/stats', () => {
    it('should return invitation statistics', async () => {
      const response = await request(app)
        .get('/api/invitations/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('friends');
      expect(response.body.data).toHaveProperty('teams');
      expect(response.body.data.friends).toHaveProperty('pending');
      expect(response.body.data.friends).toHaveProperty('accepted');
      expect(response.body.data.friends).toHaveProperty('expired');
      expect(response.body.data.friends).toHaveProperty('total');
    });
  });

  describe('POST /api/invitations/cleanup', () => {
    it('should cleanup expired invitations', async () => {
      await request(app)
        .post('/api/invitations/cleanup')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });
});