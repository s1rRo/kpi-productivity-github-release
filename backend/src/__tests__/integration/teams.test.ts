import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import app from '../../index';

const prisma = new PrismaClient();

describe('Teams API', () => {
  let authToken: string;
  let userId: string;
  let teamId: string;
  const testEmail = `test-${Date.now()}@example.com`;

  beforeAll(async () => {
    // Clean up any existing test data first
    await prisma.user.deleteMany({
      where: { email: { contains: 'test' } }
    });

    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        email: testEmail,
        password: 'hashedpassword',
        name: 'Test User'
      }
    });
    userId = testUser.id;

    // Generate auth token
    authToken = jwt.sign(
      { userId: testUser.id, email: testUser.email },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  afterAll(async () => {
    // Clean up test data
    if (userId) {
      await prisma.teamGoalProgress.deleteMany({
        where: { 
          teamGoal: {
            teamId: teamId
          }
        }
      });
      await prisma.teamGoal.deleteMany({
        where: { teamId: teamId }
      });
      await prisma.teamMember.deleteMany({
        where: { userId }
      });
      await prisma.team.deleteMany({
        where: { id: teamId }
      });
      await prisma.user.deleteMany({
        where: { id: userId }
      });
    }
    await prisma.$disconnect();
  });

  describe('POST /api/teams', () => {
    it('should create a new team', async () => {
      const teamData = {
        name: 'Test Team',
        description: 'A test team',
        maxMembers: 50
      };

      const response = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .send(teamData)
        .expect(201);

      expect(response.body.name).toBe(teamData.name);
      expect(response.body.description).toBe(teamData.description);
      expect(response.body.maxMembers).toBe(teamData.maxMembers);
      expect(response.body.members).toHaveLength(1);
      expect(response.body.members[0].role).toBe('leader');
      expect(response.body.members[0].userId).toBe(userId);

      teamId = response.body.id;
    });

    it('should require authentication', async () => {
      const teamData = {
        name: 'Test Team 2',
        description: 'Another test team'
      };

      await request(app)
        .post('/api/teams')
        .send(teamData)
        .expect(401);
    });

    it('should validate team name', async () => {
      const teamData = {
        name: '',
        description: 'Team without name'
      };

      await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .send(teamData)
        .expect(400);
    });

    it('should validate max members limit', async () => {
      const teamData = {
        name: 'Invalid Team',
        maxMembers: 100 // Over the limit
      };

      await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .send(teamData)
        .expect(400);
    });
  });

  describe('GET /api/teams', () => {
    it('should get user teams', async () => {
      const response = await request(app)
        .get('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].name).toBe('Test Team');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/teams')
        .expect(401);
    });
  });

  describe('GET /api/teams/:teamId', () => {
    it('should get team details', async () => {
      const response = await request(app)
        .get(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(teamId);
      expect(response.body.name).toBe('Test Team');
      expect(response.body.members).toHaveLength(1);
    });

    it('should require team membership', async () => {
      // Create another user
      const otherEmail = `other-${Date.now()}@example.com`;
      const otherUser = await prisma.user.create({
        data: {
          email: otherEmail,
          password: 'hashedpassword',
          name: 'Other User'
        }
      });

      const otherToken = jwt.sign(
        { userId: otherUser.id, email: otherUser.email },
        process.env.JWT_SECRET || 'test-secret'
      );

      await request(app)
        .get(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      // Clean up
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  describe('PUT /api/teams/:teamId', () => {
    it('should update team settings (leader only)', async () => {
      const updateData = {
        name: 'Updated Test Team',
        description: 'Updated description',
        maxMembers: 75
      };

      const response = await request(app)
        .put(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);
      expect(response.body.description).toBe(updateData.description);
      expect(response.body.maxMembers).toBe(updateData.maxMembers);
    });

    it('should not allow reducing max members below current count', async () => {
      const updateData = {
        maxMembers: 0 // Below current member count
      };

      await request(app)
        .put(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);
    });
  });

  describe('POST /api/teams/join/:inviteCode', () => {
    it('should join team by invite code', async () => {
      // First get the team's invite code
      const teamResponse = await request(app)
        .get(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const inviteCode = teamResponse.body.inviteCode;

      // Create another user to join the team
      const newMemberEmail = `newmember-${Date.now()}@example.com`;
      const newUser = await prisma.user.create({
        data: {
          email: newMemberEmail,
          password: 'hashedpassword',
          name: 'New Member'
        }
      });

      const newUserToken = jwt.sign(
        { userId: newUser.id, email: newUser.email },
        process.env.JWT_SECRET || 'test-secret'
      );

      const response = await request(app)
        .post(`/api/teams/join/${inviteCode}`)
        .set('Authorization', `Bearer ${newUserToken}`)
        .expect(200);

      expect(response.body.members).toHaveLength(2);

      // Clean up
      await prisma.teamMember.deleteMany({ where: { userId: newUser.id } });
      await prisma.user.delete({ where: { id: newUser.id } });
    });

    it('should not join with invalid invite code', async () => {
      await request(app)
        .post('/api/teams/join/invalid-code')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /api/teams/:teamId/leaderboard', () => {
    it('should get team leaderboard', async () => {
      const response = await request(app)
        .get(`/api/teams/${teamId}/leaderboard`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.teamId).toBe(teamId);
      expect(Array.isArray(response.body.leaderboard)).toBe(true);
      expect(response.body.leaderboard[0].userId).toBe(userId);
      expect(response.body.summary).toBeDefined();
      expect(response.body.summary.totalMembers).toBeGreaterThan(0);
    });

    it('should filter leaderboard by period', async () => {
      const response = await request(app)
        .get(`/api/teams/${teamId}/leaderboard?period=month`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.period).toBe('month');
      expect(response.body.summary).toBeDefined();
    });
  });

  describe('Team Goals API', () => {
    let goalId: string;

    describe('POST /api/teams/:teamId/goals', () => {
      it('should create a team goal (leader only)', async () => {
        const goalData = {
          title: 'Test Goal',
          description: 'A test goal for the team',
          targetValue: 100,
          unit: 'points',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        };

        const response = await request(app)
          .post(`/api/teams/${teamId}/goals`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(goalData)
          .expect(201);

        expect(response.body.title).toBe(goalData.title);
        expect(response.body.description).toBe(goalData.description);
        expect(response.body.targetValue).toBe(goalData.targetValue);
        expect(response.body.unit).toBe(goalData.unit);
        expect(response.body.progress).toBeDefined();

        goalId = response.body.id;
      });

      it('should require leader or deputy role', async () => {
        // Create a regular member
        const memberEmail = `member-${Date.now()}@example.com`;
        const memberUser = await prisma.user.create({
          data: {
            email: memberEmail,
            password: 'hashedpassword',
            name: 'Member User'
          }
        });

        await prisma.teamMember.create({
          data: {
            teamId,
            userId: memberUser.id,
            role: 'member'
          }
        });

        const memberToken = jwt.sign(
          { userId: memberUser.id, email: memberUser.email },
          process.env.JWT_SECRET || 'test-secret'
        );

        const goalData = {
          title: 'Unauthorized Goal',
          targetValue: 50,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        };

        await request(app)
          .post(`/api/teams/${teamId}/goals`)
          .set('Authorization', `Bearer ${memberToken}`)
          .send(goalData)
          .expect(403);

        // Clean up
        await prisma.teamMember.deleteMany({ where: { userId: memberUser.id } });
        await prisma.user.delete({ where: { id: memberUser.id } });
      });

      it('should validate required fields', async () => {
        const invalidGoalData = {
          description: 'Goal without title'
        };

        await request(app)
          .post(`/api/teams/${teamId}/goals`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidGoalData)
          .expect(400);
      });
    });

    describe('PUT /api/teams/:teamId/goals/:goalId', () => {
      it('should update team goal (leader/deputy only)', async () => {
        const updateData = {
          title: 'Updated Test Goal',
          description: 'Updated description',
          targetValue: 150
        };

        const response = await request(app)
          .put(`/api/teams/${teamId}/goals/${goalId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.title).toBe(updateData.title);
        expect(response.body.description).toBe(updateData.description);
        expect(response.body.targetValue).toBe(updateData.targetValue);
      });
    });

    describe('PUT /api/teams/:teamId/goals/:goalId/progress/:userId', () => {
      it('should update member progress on goal', async () => {
        const progressData = {
          currentValue: 75
        };

        const response = await request(app)
          .put(`/api/teams/${teamId}/goals/${goalId}/progress/${userId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(progressData)
          .expect(200);

        expect(response.body.currentValue).toBe(progressData.currentValue);
        expect(response.body.percentage).toBe(50); // 75/150 * 100
      });

      it('should allow members to update their own progress', async () => {
        // Create a member user
        const selfUpdateEmail = `selfupdate-${Date.now()}@example.com`;
        const memberUser = await prisma.user.create({
          data: {
            email: selfUpdateEmail,
            password: 'hashedpassword',
            name: 'Self Update User'
          }
        });

        await prisma.teamMember.create({
          data: {
            teamId,
            userId: memberUser.id,
            role: 'member'
          }
        });

        const memberToken = jwt.sign(
          { userId: memberUser.id, email: memberUser.email },
          process.env.JWT_SECRET || 'test-secret'
        );

        const progressData = {
          currentValue: 50
        };

        await request(app)
          .put(`/api/teams/${teamId}/goals/${goalId}/progress/${memberUser.id}`)
          .set('Authorization', `Bearer ${memberToken}`)
          .send(progressData)
          .expect(200);

        // Clean up
        await prisma.teamGoalProgress.deleteMany({ where: { userId: memberUser.id } });
        await prisma.teamMember.deleteMany({ where: { userId: memberUser.id } });
        await prisma.user.delete({ where: { id: memberUser.id } });
      });

      it('should not allow members to update others progress', async () => {
        // Create two member users
        const member1Email = `member1-${Date.now()}@example.com`;
        const member2Email = `member2-${Date.now()}@example.com`;
        const member1 = await prisma.user.create({
          data: {
            email: member1Email,
            password: 'hashedpassword',
            name: 'Member 1'
          }
        });

        const member2 = await prisma.user.create({
          data: {
            email: member2Email,
            password: 'hashedpassword',
            name: 'Member 2'
          }
        });

        await prisma.teamMember.createMany({
          data: [
            { teamId, userId: member1.id, role: 'member' },
            { teamId, userId: member2.id, role: 'member' }
          ]
        });

        const member1Token = jwt.sign(
          { userId: member1.id, email: member1.email },
          process.env.JWT_SECRET || 'test-secret'
        );

        const progressData = {
          currentValue: 25
        };

        await request(app)
          .put(`/api/teams/${teamId}/goals/${goalId}/progress/${member2.id}`)
          .set('Authorization', `Bearer ${member1Token}`)
          .send(progressData)
          .expect(403);

        // Clean up
        await prisma.teamMember.deleteMany({ where: { userId: { in: [member1.id, member2.id] } } });
        await prisma.user.deleteMany({ where: { id: { in: [member1.id, member2.id] } } });
      });
    });

    describe('DELETE /api/teams/:teamId/goals/:goalId', () => {
      it('should delete team goal (leader only)', async () => {
        await request(app)
          .delete(`/api/teams/${teamId}/goals/${goalId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Verify goal is soft deleted (isActive = false)
        const goal = await prisma.teamGoal.findUnique({
          where: { id: goalId }
        });
        expect(goal?.isActive).toBe(false);
      });
    });

    afterAll(async () => {
      // Clean up goal-related data
      await prisma.teamGoalProgress.deleteMany({
        where: { teamGoalId: goalId }
      });
      await prisma.teamGoal.deleteMany({
        where: { teamId }
      });
    });
  });
});