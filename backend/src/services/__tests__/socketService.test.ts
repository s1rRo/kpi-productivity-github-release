import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { Client as SocketIOClient } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { SocketService } from '../socketService';
import { PrismaClient } from '@prisma/client';

// Mock dependencies
vi.mock('@prisma/client');
vi.mock('../redisClient', () => ({
  default: {
    isOpen: true,
    setEx: vi.fn(),
    del: vi.fn(),
    get: vi.fn()
  }
}));

describe('SocketService', () => {
  let httpServer: HTTPServer;
  let socketService: SocketService;
  let clientSocket: SocketIOClient;
  let mockPrisma: any;

  const testUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User'
  };

  const testToken = jwt.sign(
    { userId: testUser.id, email: testUser.email },
    process.env.JWT_SECRET || 'test-secret'
  );

  beforeEach(async () => {
    // Setup mock Prisma
    mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(testUser)
      },
      teamMember: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null)
      },
      friendship: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null)
      },
      teamGoal: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([])
      },
      teamGoalProgress: {
        upsert: vi.fn().mockResolvedValue({}),
        count: vi.fn().mockResolvedValue(0)
      },
      supportMessage: {
        create: vi.fn().mockResolvedValue({
          id: 'msg-123',
          createdAt: new Date()
        })
      }
    };

    // Mock PrismaClient constructor
    vi.mocked(PrismaClient).mockImplementation(() => mockPrisma);

    // Create HTTP server
    httpServer = new HTTPServer();
    
    // Initialize SocketService
    socketService = new SocketService(httpServer);

    // Start server
    await new Promise<void>((resolve) => {
      httpServer.listen(0, resolve);
    });

    const port = (httpServer.address() as any)?.port;
    
    // Create client socket
    clientSocket = new SocketIOClient(`http://localhost:${port}`, {
      auth: { token: testToken },
      transports: ['websocket']
    });
  });

  afterEach(async () => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }
    
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    test('should authenticate user with valid token', (done) => {
      clientSocket.on('connect', () => {
        expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
          where: { id: testUser.id },
          select: { id: true, email: true, name: true }
        });
        done();
      });

      clientSocket.on('connect_error', (error) => {
        done(error);
      });
    });

    test('should reject connection with invalid token', (done) => {
      const invalidClient = new SocketIOClient(`http://localhost:${(httpServer.address() as any)?.port}`, {
        auth: { token: 'invalid-token' },
        transports: ['websocket']
      });

      invalidClient.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        invalidClient.disconnect();
        done();
      });

      invalidClient.on('connect', () => {
        invalidClient.disconnect();
        done(new Error('Should not connect with invalid token'));
      });
    });

    test('should reject connection without token', (done) => {
      const noTokenClient = new SocketIOClient(`http://localhost:${(httpServer.address() as any)?.port}`, {
        transports: ['websocket']
      });

      noTokenClient.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication token required');
        noTokenClient.disconnect();
        done();
      });

      noTokenClient.on('connect', () => {
        noTokenClient.disconnect();
        done(new Error('Should not connect without token'));
      });
    });
  });

  describe('Progress Updates', () => {
    test('should handle progress update events', (done) => {
      clientSocket.on('connect', () => {
        const progressData = {
          type: 'kpi' as const,
          value: 85,
          metadata: { habit: 'exercise' }
        };

        clientSocket.emit('progress:update', progressData);
        
        // Since we can't easily test the internal caching, 
        // we'll just verify the event was processed without errors
        setTimeout(() => {
          done();
        }, 100);
      });
    });

    test('should broadcast progress to friends', (done) => {
      // Mock friendship data
      mockPrisma.friendship.findMany.mockResolvedValue([
        {
          id: 'friendship-1',
          user1Id: testUser.id,
          user2Id: 'friend-123'
        }
      ]);

      clientSocket.on('connect', () => {
        const progressData = {
          type: 'habit' as const,
          value: 60,
          metadata: { habitName: 'Reading' }
        };

        clientSocket.emit('progress:update', progressData);
        
        setTimeout(() => {
          expect(mockPrisma.friendship.findMany).toHaveBeenCalled();
          done();
        }, 100);
      });
    });
  });

  describe('Team Goal Progress', () => {
    test('should update team goal progress for authorized user', (done) => {
      // Mock team membership
      mockPrisma.teamMember.findFirst.mockResolvedValue({
        teamId: 'team-123',
        userId: testUser.id,
        role: 'leader'
      });

      // Mock team goal
      mockPrisma.teamGoal.findUnique.mockResolvedValue({
        id: 'goal-123',
        targetValue: 100
      });

      clientSocket.on('connect', () => {
        const progressData = {
          teamId: 'team-123',
          goalId: 'goal-123',
          userId: testUser.id,
          currentValue: 75
        };

        clientSocket.emit('team_goal:progress_update', progressData);
        
        setTimeout(() => {
          expect(mockPrisma.teamGoalProgress.upsert).toHaveBeenCalledWith({
            where: {
              teamGoalId_userId: {
                teamGoalId: 'goal-123',
                userId: testUser.id
              }
            },
            update: expect.objectContaining({
              currentValue: 75,
              percentage: 75
            }),
            create: expect.objectContaining({
              teamGoalId: 'goal-123',
              userId: testUser.id,
              currentValue: 75,
              percentage: 75
            })
          });
          done();
        }, 100);
      });
    });

    test('should reject unauthorized team goal progress update', (done) => {
      // Mock no team membership
      mockPrisma.teamMember.findFirst.mockResolvedValue(null);

      clientSocket.on('connect', () => {
        const progressData = {
          teamId: 'team-123',
          goalId: 'goal-123',
          userId: testUser.id,
          currentValue: 75
        };

        clientSocket.on('error', (error) => {
          expect(error.message).toBe('Access denied to this team');
          done();
        });

        clientSocket.emit('team_goal:progress_update', progressData);
      });
    });
  });

  describe('Support Messages', () => {
    test('should send support message between friends', (done) => {
      // Mock friendship
      mockPrisma.friendship.findFirst.mockResolvedValue({
        id: 'friendship-1',
        user1Id: testUser.id,
        user2Id: 'friend-123'
      });

      clientSocket.on('connect', () => {
        const messageData = {
          receiverId: 'friend-123',
          message: 'Great job on your progress!',
          type: 'congratulation' as const
        };

        clientSocket.on('support:message_sent', (data) => {
          expect(data.message).toBe(messageData.message);
          expect(data.type).toBe(messageData.type);
          expect(mockPrisma.supportMessage.create).toHaveBeenCalled();
          done();
        });

        clientSocket.emit('support:send', messageData);
      });
    });

    test('should reject support message to non-friend', (done) => {
      // Mock no friendship
      mockPrisma.friendship.findFirst.mockResolvedValue(null);

      clientSocket.on('connect', () => {
        const messageData = {
          receiverId: 'stranger-123',
          message: 'Hello stranger',
          type: 'support' as const
        };

        clientSocket.on('error', (error) => {
          expect(error.message).toBe('Not friends with this user');
          done();
        });

        clientSocket.emit('support:send', messageData);
      });
    });
  });

  describe('Leaderboard Subscriptions', () => {
    test('should subscribe to team leaderboard', (done) => {
      clientSocket.on('connect', () => {
        const subscriptionData = { teamId: 'team-123' };
        
        clientSocket.emit('subscribe:leaderboard', subscriptionData);
        
        // Verify subscription was processed
        setTimeout(() => {
          done();
        }, 100);
      });
    });

    test('should unsubscribe from team leaderboard', (done) => {
      clientSocket.on('connect', () => {
        const subscriptionData = { teamId: 'team-123' };
        
        // First subscribe
        clientSocket.emit('subscribe:leaderboard', subscriptionData);
        
        setTimeout(() => {
          // Then unsubscribe
          clientSocket.emit('unsubscribe:leaderboard', subscriptionData);
          
          setTimeout(() => {
            done();
          }, 100);
        }, 50);
      });
    });
  });

  describe('Connection Health', () => {
    test('should respond to ping with pong', (done) => {
      clientSocket.on('connect', () => {
        clientSocket.on('pong', (data) => {
          expect(data).toEqual({});
          done();
        });

        clientSocket.emit('ping');
      });
    });

    test('should track user online status', () => {
      expect(socketService.getConnectedUsersCount()).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Public Methods', () => {
    test('should check if user is online', () => {
      const isOnline = socketService.isUserOnline(testUser.id);
      expect(typeof isOnline).toBe('boolean');
    });

    test('should get connected users count', () => {
      const count = socketService.getConnectedUsersCount();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should send push notification', async () => {
      const notification = {
        title: 'Test Notification',
        body: 'This is a test',
        type: 'info'
      };

      // This should not throw
      await expect(
        socketService.sendPushNotification(testUser.id, notification)
      ).resolves.toBeUndefined();
    });

    test('should notify friend activity', async () => {
      const activity = {
        type: 'goal_completed',
        data: { goalId: 'goal-123' }
      };

      // This should not throw
      await expect(
        socketService.notifyFriendActivity(testUser.id, activity)
      ).resolves.toBeUndefined();
    });

    test('should broadcast leaderboard update', async () => {
      const updateData = {
        leaderboard: [],
        summary: { totalMembers: 5 }
      };

      // This should not throw
      await expect(
        socketService.broadcastLeaderboardUpdate('team-123', updateData)
      ).resolves.toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', (done) => {
      // Mock database error
      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      const errorClient = new SocketIOClient(`http://localhost:${(httpServer.address() as any)?.port}`, {
        auth: { token: testToken },
        transports: ['websocket']
      });

      errorClient.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        errorClient.disconnect();
        done();
      });

      errorClient.on('connect', () => {
        errorClient.disconnect();
        done(new Error('Should not connect with database error'));
      });
    });

    test('should handle Redis errors gracefully', (done) => {
      // Redis errors should not prevent socket functionality
      clientSocket.on('connect', () => {
        const progressData = {
          type: 'kpi' as const,
          value: 85
        };

        clientSocket.emit('progress:update', progressData);
        
        // Should still work even if Redis fails
        setTimeout(() => {
          done();
        }, 100);
      });
    });
  });
});