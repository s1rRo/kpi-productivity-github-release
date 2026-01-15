import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import redisClient from './redisClient';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

export class SocketService {
  private io: SocketIOServer;
  private prisma: PrismaClient;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId

  constructor(server: HTTPServer) {
    this.prisma = new PrismaClient();
    
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? ['https://your-frontend-domain.com'] 
          : ['http://localhost:3000', 'http://localhost:5173'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        if (!process.env.JWT_SECRET) {
          console.error('CRITICAL: JWT_SECRET environment variable is not set');
          return next(new Error('Server configuration error'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
        
        // Get user details from database
        const user = await this.prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, email: true, name: true }
        });

        if (!user) {
          return next(new Error('User not found'));
        }

        socket.userId = user.id;
        socket.user = {
          id: user.id,
          email: user.email,
          name: user.name || undefined
        };
        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`✅ User ${socket.user?.email} connected (${socket.id})`);
      
      if (socket.userId) {
        this.connectedUsers.set(socket.userId, socket.id);
        this.handleUserOnline(socket.userId);
      }

      // Join user to their personal room
      socket.join(`user:${socket.userId}`);

      // Join user to their teams' rooms
      this.joinUserTeams(socket);

      // Join user to their friends' activity room
      this.joinFriendsRoom(socket);

      // Handle leaderboard subscription
      socket.on('subscribe:leaderboard', (data: { teamId: string }) => {
        socket.join(`leaderboard:${data.teamId}`);
        console.log(`User ${socket.userId} subscribed to leaderboard for team ${data.teamId}`);
      });

      // Handle leaderboard unsubscription
      socket.on('unsubscribe:leaderboard', (data: { teamId: string }) => {
        socket.leave(`leaderboard:${data.teamId}`);
        console.log(`User ${socket.userId} unsubscribed from leaderboard for team ${data.teamId}`);
      });

      // Handle friend activity subscription
      socket.on('subscribe:friend_activity', () => {
        socket.join(`friends:${socket.userId}`);
        console.log(`User ${socket.userId} subscribed to friend activity`);
      });

      // Handle progress updates
      socket.on('progress:update', async (data: { 
        type: 'kpi' | 'goal' | 'habit';
        value: number;
        metadata?: any;
      }) => {
        await this.handleProgressUpdate(socket, data);
      });

      // Handle team goal progress updates
      socket.on('team_goal:progress_update', async (data: {
        teamId: string;
        goalId: string;
        userId: string;
        currentValue: number;
      }) => {
        await this.handleTeamGoalProgressUpdate(socket, data);
      });

      // Handle support messages
      socket.on('support:send', async (data: {
        receiverId: string;
        message: string;
        type: 'support' | 'congratulation' | 'motivation';
      }) => {
        await this.handleSupportMessage(socket, data);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`❌ User ${socket.user?.email} disconnected (${socket.id})`);
        
        if (socket.userId) {
          this.connectedUsers.delete(socket.userId);
          this.handleUserOffline(socket.userId);
        }
      });

      // Handle ping/pong for connection health
      socket.on('ping', () => {
        socket.emit('pong', {});
      });
    });
  }

  private async joinUserTeams(socket: AuthenticatedSocket) {
    if (!socket.userId) return;

    try {
      const userTeams = await this.prisma.teamMember.findMany({
        where: {
          userId: socket.userId,
          isActive: true
        },
        select: {
          teamId: true
        }
      });

      userTeams.forEach(team => {
        socket.join(`team:${team.teamId}`);
        socket.join(`leaderboard:${team.teamId}`);
      });

      console.log(`User ${socket.userId} joined ${userTeams.length} team rooms`);
    } catch (error) {
      console.error('Error joining user teams:', error);
    }
  }

  private async joinFriendsRoom(socket: AuthenticatedSocket) {
    if (!socket.userId) return;

    try {
      const friendships = await this.prisma.friendship.findMany({
        where: {
          OR: [
            { user1Id: socket.userId },
            { user2Id: socket.userId }
          ]
        }
      });

      // Join friends activity room
      socket.join(`friends:${socket.userId}`);

      // Notify friends that user is online
      friendships.forEach(friendship => {
        const friendId = friendship.user1Id === socket.userId ? friendship.user2Id : friendship.user1Id;
        this.io.to(`friends:${friendId}`).emit('friend:online', {
          userId: socket.userId,
          userName: socket.user?.name || socket.user?.email,
          timestamp: new Date()
        });
      });

      console.log(`User ${socket.userId} joined friends activity room`);
    } catch (error) {
      console.error('Error joining friends room:', error);
    }
  }

  private async handleProgressUpdate(socket: AuthenticatedSocket, data: {
    type: 'kpi' | 'goal' | 'habit';
    value: number;
    metadata?: any;
  }) {
    if (!socket.userId) return;

    try {
      // Cache the progress update in Redis
      await this.cacheProgressUpdate(socket.userId, data);

      // Notify friends about the progress update
      const friendships = await this.prisma.friendship.findMany({
        where: {
          OR: [
            { user1Id: socket.userId },
            { user2Id: socket.userId }
          ]
        }
      });

      const progressNotification = {
        userId: socket.userId,
        userName: socket.user?.name || socket.user?.email,
        type: data.type,
        value: data.value,
        metadata: data.metadata,
        timestamp: new Date()
      };

      friendships.forEach(friendship => {
        const friendId = friendship.user1Id === socket.userId ? friendship.user2Id : friendship.user1Id;
        this.io.to(`friends:${friendId}`).emit('friend:progress_update', progressNotification);
      });

      console.log(`Progress update from user ${socket.userId}: ${data.type} = ${data.value}`);
    } catch (error) {
      console.error('Error handling progress update:', error);
    }
  }

  private async handleTeamGoalProgressUpdate(socket: AuthenticatedSocket, data: {
    teamId: string;
    goalId: string;
    userId: string;
    currentValue: number;
  }) {
    if (!socket.userId) return;

    try {
      // Verify user has permission to update this progress
      const membership = await this.prisma.teamMember.findFirst({
        where: {
          teamId: data.teamId,
          userId: socket.userId,
          isActive: true
        }
      });

      if (!membership) {
        socket.emit('error', { message: 'Access denied to this team' });
        return;
      }

      const canUpdate = membership.role === 'leader' || 
                       membership.role === 'deputy' || 
                       socket.userId === data.userId;

      if (!canUpdate) {
        socket.emit('error', { message: 'You can only update your own progress or be a team leader/deputy' });
        return;
      }

      // Get the team goal to calculate percentage
      const teamGoal = await this.prisma.teamGoal.findUnique({
        where: { id: data.goalId }
      });

      if (!teamGoal) {
        socket.emit('error', { message: 'Team goal not found' });
        return;
      }

      const percentage = Math.min((data.currentValue / teamGoal.targetValue) * 100, 100);

      // Update progress in database
      const updatedProgress = await this.prisma.teamGoalProgress.upsert({
        where: {
          teamGoalId_userId: {
            teamGoalId: data.goalId,
            userId: data.userId
          }
        },
        update: {
          currentValue: data.currentValue,
          percentage,
          lastUpdated: new Date()
        },
        create: {
          teamGoalId: data.goalId,
          userId: data.userId,
          currentValue: data.currentValue,
          percentage,
          lastUpdated: new Date()
        }
      });

      // Get updated leaderboard data
      const leaderboardData = await this.getTeamLeaderboard(data.teamId);

      // Broadcast updated leaderboard to all team members
      this.io.to(`leaderboard:${data.teamId}`).emit('leaderboard:update', {
        teamId: data.teamId,
        goalId: data.goalId,
        updatedProgress,
        leaderboard: leaderboardData,
        updatedBy: {
          userId: socket.userId,
          userName: socket.user?.name || socket.user?.email
        },
        timestamp: new Date()
      });

      console.log(`Team goal progress updated: Team ${data.teamId}, Goal ${data.goalId}, User ${data.userId}, Value ${data.currentValue}`);
    } catch (error) {
      console.error('Error handling team goal progress update:', error);
      socket.emit('error', { message: 'Failed to update team goal progress' });
    }
  }

  private async handleSupportMessage(socket: AuthenticatedSocket, data: {
    receiverId: string;
    message: string;
    type: 'support' | 'congratulation' | 'motivation';
  }) {
    if (!socket.userId) return;

    try {
      // Verify friendship exists
      const friendship = await this.prisma.friendship.findFirst({
        where: {
          OR: [
            { user1Id: socket.userId, user2Id: data.receiverId },
            { user1Id: data.receiverId, user2Id: socket.userId }
          ]
        }
      });

      if (!friendship) {
        socket.emit('error', { message: 'Not friends with this user' });
        return;
      }

      // Create support message in database
      const supportMessage = await this.prisma.supportMessage.create({
        data: {
          senderId: socket.userId,
          receiverId: data.receiverId,
          message: data.message,
          type: data.type
        }
      });

      // Send real-time notification to receiver
      this.io.to(`user:${data.receiverId}`).emit('support:message_received', {
        id: supportMessage.id,
        senderId: socket.userId,
        senderName: socket.user?.name || socket.user?.email,
        message: data.message,
        type: data.type,
        timestamp: supportMessage.createdAt
      });

      // Confirm to sender
      socket.emit('support:message_sent', {
        id: supportMessage.id,
        receiverId: data.receiverId,
        message: data.message,
        type: data.type,
        timestamp: supportMessage.createdAt
      });

      console.log(`Support message sent from ${socket.userId} to ${data.receiverId}: ${data.type}`);
    } catch (error) {
      console.error('Error handling support message:', error);
      socket.emit('error', { message: 'Failed to send support message' });
    }
  }

  private async getTeamLeaderboard(teamId: string) {
    try {
      // Get team goals with progress
      const teamGoals = await this.prisma.teamGoal.findMany({
        where: {
          teamId: teamId,
          isActive: true
        },
        include: {
          progress: true
        }
      });

      // Get team members
      const members = await this.prisma.teamMember.findMany({
        where: {
          teamId: teamId,
          isActive: true
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      // Calculate leaderboard
      const leaderboard = members.map(member => {
        const memberProgress = teamGoals.flatMap(goal => 
          goal.progress.filter(p => p.userId === member.userId)
        );

        const totalPercentage = memberProgress.length > 0 
          ? memberProgress.reduce((sum, p) => sum + p.percentage, 0) / memberProgress.length
          : 0;

        return {
          userId: member.userId,
          name: member.user.name || member.user.email,
          role: member.role,
          totalPercentage: Math.round(totalPercentage * 100) / 100,
          goalProgress: memberProgress,
          rank: 0
        };
      }).sort((a, b) => b.totalPercentage - a.totalPercentage);

      // Set ranks
      leaderboard.forEach((member, index) => {
        member.rank = index + 1;
      });

      return leaderboard;
    } catch (error) {
      console.error('Error getting team leaderboard:', error);
      return [];
    }
  }

  private async cacheProgressUpdate(userId: string, data: any) {
    try {
      if (redisClient.isOpen) {
        const key = `progress:${userId}:${data.type}`;
        await redisClient.setEx(key, 3600, JSON.stringify({
          ...data,
          timestamp: new Date(),
          userId
        }));
      }
    } catch (error) {
      console.error('Error caching progress update:', error);
      // Don't throw - app should work without Redis
    }
  }

  private async handleUserOnline(userId: string) {
    try {
      if (redisClient.isOpen) {
        await redisClient.setEx(`online:${userId}`, 300, 'true'); // 5 minutes TTL
      }
    } catch (error) {
      console.error('Error setting user online status:', error);
    }
  }

  private async handleUserOffline(userId: string) {
    try {
      if (redisClient.isOpen) {
        await redisClient.del(`online:${userId}`);
      }
    } catch (error) {
      console.error('Error removing user online status:', error);
    }
  }

  // Public methods for external use
  public async notifyFriendActivity(userId: string, activity: {
    type: string;
    data: any;
  }) {
    try {
      const friendships = await this.prisma.friendship.findMany({
        where: {
          OR: [
            { user1Id: userId },
            { user2Id: userId }
          ]
        }
      });

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true }
      });

      friendships.forEach(friendship => {
        const friendId = friendship.user1Id === userId ? friendship.user2Id : friendship.user1Id;
        this.io.to(`friends:${friendId}`).emit('friend:activity', {
          userId,
          userName: user?.name || user?.email,
          activity,
          timestamp: new Date()
        });
      });
    } catch (error) {
      console.error('Error notifying friend activity:', error);
    }
  }

  public async broadcastLeaderboardUpdate(teamId: string, data: any) {
    this.io.to(`leaderboard:${teamId}`).emit('leaderboard:update', {
      teamId,
      ...data,
      timestamp: new Date()
    });
  }

  public async sendPushNotification(userId: string, notification: {
    title: string;
    body: string;
    type: string;
    data?: any;
  }) {
    // Send real-time notification
    this.io.to(`user:${userId}`).emit('notification:push', {
      ...notification,
      timestamp: new Date()
    });

    // TODO: Implement actual push notifications (FCM, APNS, etc.)
    console.log(`Push notification sent to user ${userId}: ${notification.title}`);
  }

  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  public async getOnlineStatus(userId: string): Promise<boolean> {
    try {
      if (redisClient.isOpen) {
        const status = await redisClient.get(`online:${userId}`);
        return status === 'true';
      }
      return this.isUserOnline(userId);
    } catch (error) {
      console.error('Error getting online status:', error);
      return false;
    }
  }
}

export default SocketService;