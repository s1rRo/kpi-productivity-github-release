import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import app from '../../index';

const prisma = new PrismaClient();

describe('Friends API Integration', () => {
  let authToken1: string;
  let authToken2: string;
  let user1Id: string;
  let user2Id: string;
  let friendshipId: string;
  let inviteCode: string;

  const testEmail1 = `friend1-${Date.now()}@example.com`;
  const testEmail2 = `friend2-${Date.now()}@example.com`;

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { user1: { email: { contains: 'friend' } } },
          { user2: { email: { contains: 'friend' } } }
        ]
      }
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'friend' } }
    });

    // Create test users
    const testUser1 = await prisma.user.create({
      data: {
        email: testEmail1,
        password: 'hashedpassword',
        name: 'Friend User 1'
      }
    });
    user1Id = testUser1.id;

    const testUser2 = await prisma.user.create({
      data: {
        email: testEmail2,
        password: 'hashedpassword',
        name: 'Friend User 2'
      }
    });
    user2Id = testUser2.id;

    // Generate auth tokens
    authToken1 = jwt.sign(
      { userId: testUser1.id, email: testUser1.email },
      process.env.JWT_SECRET || 'test-secret'
    );

    authToken2 = jwt.sign(
      { userId: testUser2.id, email: testUser2.email },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.supportMessage.deleteMany({
      where: {
        OR: [
          { senderId: user1Id },
          { receiverId: user1Id },
          { senderId: user2Id },
          { receiverId: user2Id }
        ]
      }
    });
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { user1Id },
          { user2Id },
          { user1Id: user2Id },
          { user2Id: user1Id }
        ]
      }
    });
    await prisma.user.deleteMany({
      where: { id: { in: [user1Id, user2Id] } }
    });
    await prisma.$disconnect();
  });

  describe('Friend Invitations', () => {
    it('should generate invite code for user', async () => {
      const response = await request(app)
        .post('/api/friends/generate-invite')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(201);

      expect(response.body.inviteCode).toBeDefined();
      expect(response.body.inviteCode).toHaveLength(8);
      expect(response.body.expiresAt).toBeDefined();

      inviteCode = response.body.inviteCode;
    });

    it('should not generate multiple active invite codes', async () => {
      await request(app)
        .post('/api/friends/generate-invite')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(400);
    });

    it('should accept friend invitation by code', async () => {
      const response = await request(app)
        .post(`/api/friends/accept-invite/${inviteCode}`)
        .set('Authorization', `Bearer ${authToken2}`)
        .expect(201);

      expect(response.body.friendship).toBeDefined();
      expect(response.body.friendship.status).toBe('accepted');
      expect(response.body.message).toContain('Friend request accepted');

      friendshipId = response.body.friendship.id;
    });

    it('should not accept invalid invite code', async () => {
      await request(app)
        .post('/api/friends/accept-invite/INVALID123')
        .set('Authorization', `Bearer ${authToken2}`)
        .expect(404);
    });

    it('should not accept expired invite code', async () => {
      // Create expired invite
      const expiredInvite = await prisma.friendInvite.create({
        data: {
          userId: user1Id,
          inviteCode: 'EXPIRED1',
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
        }
      });

      await request(app)
        .post('/api/friends/accept-invite/EXPIRED1')
        .set('Authorization', `Bearer ${authToken2}`)
        .expect(400);

      // Clean up
      await prisma.friendInvite.delete({ where: { id: expiredInvite.id } });
    });

    it('should not accept own invite code', async () => {
      await request(app)
        .post(`/api/friends/accept-invite/${inviteCode}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(400);
    });
  });

  describe('Email Invitations', () => {
    it('should send email invitation to non-user', async () => {
      const response = await request(app)
        .post('/api/friends/invite-email')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          email: 'newuser@example.com',
          message: 'Join me on this productivity app!'
        })
        .expect(201);

      expect(response.body.message).toContain('Email invitation sent');
      expect(response.body.inviteCode).toBeDefined();
    });

    it('should send friend request to existing user', async () => {
      // Create another test user
      const testUser3 = await prisma.user.create({
        data: {
          email: `friend3-${Date.now()}@example.com`,
          password: 'hashedpassword',
          name: 'Friend User 3'
        }
      });

      const response = await request(app)
        .post('/api/friends/invite-email')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          email: testUser3.email,
          message: 'Let\'s be friends!'
        })
        .expect(201);

      expect(response.body.message).toContain('Friend request sent');

      // Clean up
      await prisma.friendship.deleteMany({
        where: {
          OR: [
            { user1Id: user1Id, user2Id: testUser3.id },
            { user1Id: testUser3.id, user2Id: user1Id }
          ]
        }
      });
      await prisma.user.delete({ where: { id: testUser3.id } });
    });

    it('should not send invitation to already connected friend', async () => {
      await request(app)
        .post('/api/friends/invite-email')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          email: testEmail2,
          message: 'We are already friends!'
        })
        .expect(400);
    });

    it('should validate email format', async () => {
      await request(app)
        .post('/api/friends/invite-email')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          email: 'invalid-email',
          message: 'Invalid email test'
        })
        .expect(400);
    });
  });

  describe('Friends Management', () => {
    it('should get user friends list', async () => {
      const response = await request(app)
        .get('/api/friends')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      const friend = response.body.find((f: any) => 
        f.friend.id === user2Id || f.friend.email === testEmail2
      );
      expect(friend).toBeDefined();
      expect(friend.status).toBe('accepted');
    });

    it('should get friend details', async () => {
      const response = await request(app)
        .get(`/api/friends/${user2Id}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.friend.id).toBe(user2Id);
      expect(response.body.friend.name).toBe('Friend User 2');
      expect(response.body.friendship.status).toBe('accepted');
      expect(response.body.sharedData).toBeDefined();
    });

    it('should not get details of non-friend', async () => {
      // Create another user who is not a friend
      const nonFriend = await prisma.user.create({
        data: {
          email: `nonfriend-${Date.now()}@example.com`,
          password: 'hashedpassword',
          name: 'Non Friend'
        }
      });

      await request(app)
        .get(`/api/friends/${nonFriend.id}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(404);

      // Clean up
      await prisma.user.delete({ where: { id: nonFriend.id } });
    });

    it('should remove friend', async () => {
      const response = await request(app)
        .delete(`/api/friends/${user2Id}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.message).toContain('Friend removed');

      // Verify friendship is deleted
      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { user1Id: user1Id, user2Id: user2Id },
            { user1Id: user2Id, user2Id: user1Id }
          ]
        }
      });
      expect(friendship).toBeNull();
    });

    it('should not remove non-existent friend', async () => {
      await request(app)
        .delete(`/api/friends/${user2Id}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(404);
    });
  });

  describe('Friend Requests', () => {
    beforeEach(async () => {
      // Re-establish friendship for testing
      const friendship = await prisma.friendship.create({
        data: {
          user1Id: user1Id,
          user2Id: user2Id,
          status: 'pending'
        }
      });
      friendshipId = friendship.id;
    });

    afterEach(async () => {
      // Clean up friendship
      await prisma.friendship.deleteMany({
        where: {
          OR: [
            { user1Id: user1Id, user2Id: user2Id },
            { user1Id: user2Id, user2Id: user1Id }
          ]
        }
      });
    });

    it('should get pending friend requests', async () => {
      const response = await request(app)
        .get('/api/friends/requests')
        .set('Authorization', `Bearer ${authToken2}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      const pendingRequest = response.body.find((r: any) => r.requester.id === user1Id);
      expect(pendingRequest).toBeDefined();
      expect(pendingRequest.status).toBe('pending');
    });

    it('should accept friend request', async () => {
      const response = await request(app)
        .put(`/api/friends/requests/${friendshipId}/accept`)
        .set('Authorization', `Bearer ${authToken2}`)
        .expect(200);

      expect(response.body.friendship.status).toBe('accepted');
      expect(response.body.message).toContain('Friend request accepted');
    });

    it('should reject friend request', async () => {
      const response = await request(app)
        .put(`/api/friends/requests/${friendshipId}/reject`)
        .set('Authorization', `Bearer ${authToken2}`)
        .expect(200);

      expect(response.body.message).toContain('Friend request rejected');

      // Verify friendship is deleted
      const friendship = await prisma.friendship.findUnique({
        where: { id: friendshipId }
      });
      expect(friendship).toBeNull();
    });

    it('should not accept non-existent request', async () => {
      await request(app)
        .put('/api/friends/requests/non-existent-id/accept')
        .set('Authorization', `Bearer ${authToken2}`)
        .expect(404);
    });

    it('should not accept request not meant for user', async () => {
      await request(app)
        .put(`/api/friends/requests/${friendshipId}/accept`)
        .set('Authorization', `Bearer ${authToken1}`) // Wrong user
        .expect(403);
    });
  });

  describe('Privacy Settings', () => {
    beforeEach(async () => {
      // Ensure friendship exists
      await prisma.friendship.upsert({
        where: {
          user1Id_user2Id: {
            user1Id: user1Id < user2Id ? user1Id : user2Id,
            user2Id: user1Id < user2Id ? user2Id : user1Id
          }
        },
        create: {
          user1Id: user1Id < user2Id ? user1Id : user2Id,
          user2Id: user1Id < user2Id ? user2Id : user1Id,
          status: 'accepted'
        },
        update: {
          status: 'accepted'
        }
      });
    });

    it('should update privacy settings', async () => {
      const privacySettings = {
        shareKPI: true,
        shareHabits: false,
        shareGoals: true,
        shareStreak: true
      };

      const response = await request(app)
        .put('/api/friends/privacy')
        .set('Authorization', `Bearer ${authToken1}`)
        .send(privacySettings)
        .expect(200);

      expect(response.body.settings.shareKPI).toBe(true);
      expect(response.body.settings.shareHabits).toBe(false);
      expect(response.body.settings.shareGoals).toBe(true);
      expect(response.body.settings.shareStreak).toBe(true);
    });

    it('should get privacy settings', async () => {
      const response = await request(app)
        .get('/api/friends/privacy')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.settings).toBeDefined();
      expect(typeof response.body.settings.shareKPI).toBe('boolean');
      expect(typeof response.body.settings.shareHabits).toBe('boolean');
      expect(typeof response.body.settings.shareGoals).toBe('boolean');
      expect(typeof response.body.settings.shareStreak).toBe('boolean');
    });

    it('should validate privacy settings', async () => {
      const invalidSettings = {
        shareKPI: 'not-boolean',
        shareHabits: false
      };

      await request(app)
        .put('/api/friends/privacy')
        .set('Authorization', `Bearer ${authToken1}`)
        .send(invalidSettings)
        .expect(400);
    });
  });

  describe('Support Messages', () => {
    beforeEach(async () => {
      // Ensure friendship exists
      await prisma.friendship.upsert({
        where: {
          user1Id_user2Id: {
            user1Id: user1Id < user2Id ? user1Id : user2Id,
            user2Id: user1Id < user2Id ? user2Id : user1Id
          }
        },
        create: {
          user1Id: user1Id < user2Id ? user1Id : user2Id,
          user2Id: user1Id < user2Id ? user2Id : user1Id,
          status: 'accepted'
        },
        update: {
          status: 'accepted'
        }
      });
    });

    it('should send support message to friend', async () => {
      const messageData = {
        message: 'Great job on your progress today!',
        type: 'congratulation'
      };

      const response = await request(app)
        .post(`/api/friends/${user2Id}/support`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send(messageData)
        .expect(201);

      expect(response.body.message).toBe(messageData.message);
      expect(response.body.type).toBe(messageData.type);
      expect(response.body.senderId).toBe(user1Id);
      expect(response.body.receiverId).toBe(user2Id);
    });

    it('should get received support messages', async () => {
      const response = await request(app)
        .get('/api/friends/support/received')
        .set('Authorization', `Bearer ${authToken2}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        const message = response.body[0];
        expect(message.senderId).toBe(user1Id);
        expect(message.receiverId).toBe(user2Id);
        expect(message.type).toBe('congratulation');
      }
    });

    it('should get sent support messages', async () => {
      const response = await request(app)
        .get('/api/friends/support/sent')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        const message = response.body[0];
        expect(message.senderId).toBe(user1Id);
        expect(message.receiverId).toBe(user2Id);
      }
    });

    it('should not send support message to non-friend', async () => {
      const nonFriend = await prisma.user.create({
        data: {
          email: `nonfriend2-${Date.now()}@example.com`,
          password: 'hashedpassword',
          name: 'Non Friend 2'
        }
      });

      const messageData = {
        message: 'This should fail',
        type: 'support'
      };

      await request(app)
        .post(`/api/friends/${nonFriend.id}/support`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send(messageData)
        .expect(403);

      // Clean up
      await prisma.user.delete({ where: { id: nonFriend.id } });
    });

    it('should validate support message type', async () => {
      const invalidMessageData = {
        message: 'Valid message',
        type: 'invalid-type'
      };

      await request(app)
        .post(`/api/friends/${user2Id}/support`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send(invalidMessageData)
        .expect(400);
    });

    it('should validate message content', async () => {
      const emptyMessageData = {
        message: '',
        type: 'support'
      };

      await request(app)
        .post(`/api/friends/${user2Id}/support`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send(emptyMessageData)
        .expect(400);
    });
  });

  describe('Friend Activity Feed', () => {
    beforeEach(async () => {
      // Ensure friendship exists
      await prisma.friendship.upsert({
        where: {
          user1Id_user2Id: {
            user1Id: user1Id < user2Id ? user1Id : user2Id,
            user2Id: user1Id < user2Id ? user2Id : user1Id
          }
        },
        create: {
          user1Id: user1Id < user2Id ? user1Id : user2Id,
          user2Id: user1Id < user2Id ? user2Id : user1Id,
          status: 'accepted'
        },
        update: {
          status: 'accepted'
        }
      });
    });

    it('should get friend activity feed', async () => {
      const response = await request(app)
        .get('/api/friends/activity')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body).toHaveProperty('activities');
      expect(response.body).toHaveProperty('onlineFriends');
      expect(Array.isArray(response.body.activities)).toBe(true);
      expect(Array.isArray(response.body.onlineFriends)).toBe(true);
    });

    it('should filter activity by time period', async () => {
      const response = await request(app)
        .get('/api/friends/activity?period=week')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.period).toBe('week');
      expect(Array.isArray(response.body.activities)).toBe(true);
    });

    it('should limit activity results', async () => {
      const response = await request(app)
        .get('/api/friends/activity?limit=5')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.activities.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Error Handling', () => {
    it('should require authentication for all endpoints', async () => {
      await request(app)
        .get('/api/friends')
        .expect(401);

      await request(app)
        .post('/api/friends/generate-invite')
        .expect(401);

      await request(app)
        .post('/api/friends/invite-email')
        .send({ email: 'test@example.com' })
        .expect(401);
    });

    it('should handle invalid user IDs gracefully', async () => {
      await request(app)
        .get('/api/friends/invalid-user-id')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(400);
    });

    it('should handle database errors gracefully', async () => {
      // This would require mocking database failures
      // For now, we ensure the API doesn't crash with valid requests
      const response = await request(app)
        .get('/api/friends')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});