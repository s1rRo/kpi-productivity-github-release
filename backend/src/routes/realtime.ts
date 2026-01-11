import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import redisClient from '../services/redisClient';

const router = express.Router();
const prisma = new PrismaClient();

// Get online status of friends
router.get('/friends/online', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId }
        ]
      },
      include: {
        user1: {
          select: { id: true, name: true, email: true }
        },
        user2: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    const friends = friendships.map(friendship => ({
      ...friendship,
      friend: friendship.user1Id === userId ? friendship.user2 : friendship.user1
    }));

    // Check online status for each friend
    const onlineStatuses = await Promise.all(
      friends.map(async (friendship) => {
        const friendId = friendship.friend.id;
        let isOnline = false;

        try {
          if (redisClient.isOpen) {
            const status = await redisClient.get(`online:${friendId}`);
            isOnline = status === 'true';
          }
        } catch (error) {
          console.error('Error checking online status:', error);
        }

        return {
          userId: friendId,
          name: friendship.friend.name || friendship.friend.email,
          isOnline,
          lastSeen: isOnline ? new Date() : null // TODO: Store actual last seen time
        };
      })
    );

    res.json({ data: onlineStatuses });
  } catch (error) {
    console.error('Error getting friends online status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent friend activities
router.get('/friends/activities', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    // Get user's friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId }
        ]
      }
    });

    const friendIds = friendships.map(friendship => 
      friendship.user1Id === userId ? friendship.user2Id : friendship.user1Id
    );

    if (friendIds.length === 0) {
      return res.json({ data: [] });
    }

    // Get recent activities from Redis cache
    const activities = [];
    
    try {
      if (redisClient.isOpen) {
        for (const friendId of friendIds) {
          const keys = await redisClient.keys(`progress:${friendId}:*`);
          
          for (const key of keys) {
            const data = await redisClient.get(key);
            if (data) {
              const activity = JSON.parse(data);
              activities.push(activity);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error getting cached activities:', error);
    }

    // Sort by timestamp and limit
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const paginatedActivities = activities.slice(offset, offset + limit);

    // Get user names for activities
    const activitiesWithNames = await Promise.all(
      paginatedActivities.map(async (activity) => {
        const user = await prisma.user.findUnique({
          where: { id: activity.userId },
          select: { name: true, email: true }
        });

        return {
          ...activity,
          userName: user?.name || user?.email || 'Unknown'
        };
      })
    );

    res.json({ 
      data: activitiesWithNames,
      pagination: {
        limit,
        offset,
        total: activities.length,
        hasMore: offset + limit < activities.length
      }
    });
  } catch (error) {
    console.error('Error getting friend activities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get team leaderboard with real-time data
router.get('/teams/:teamId/leaderboard/live', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { teamId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is a member of this team
    const membership = await prisma.teamMember.findFirst({
      where: {
        teamId: teamId,
        userId: userId,
        isActive: true
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Access denied to this team' });
    }

    // Get team goals with progress
    const teamGoals = await prisma.teamGoal.findMany({
      where: {
        teamId: teamId,
        isActive: true
      },
      include: {
        progress: true
      }
    });

    // Get team members with online status
    const members = await prisma.teamMember.findMany({
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

    // Calculate leaderboard with online status
    const leaderboard = await Promise.all(
      members.map(async (member) => {
        const memberProgress = teamGoals.flatMap(goal => 
          goal.progress.filter(p => p.userId === member.userId)
        );

        const totalPercentage = memberProgress.length > 0 
          ? memberProgress.reduce((sum, p) => sum + p.percentage, 0) / memberProgress.length
          : 0;

        // Check online status
        let isOnline = false;
        try {
          if (redisClient.isOpen) {
            const status = await redisClient.get(`online:${member.userId}`);
            isOnline = status === 'true';
          }
        } catch (error) {
          console.error('Error checking online status:', error);
        }

        return {
          userId: member.userId,
          name: member.user.name || member.user.email,
          role: member.role,
          totalPercentage: Math.round(totalPercentage * 100) / 100,
          goalProgress: memberProgress,
          isOnline,
          rank: 0
        };
      })
    );

    // Sort and set ranks
    leaderboard.sort((a, b) => b.totalPercentage - a.totalPercentage);
    leaderboard.forEach((member, index) => {
      member.rank = index + 1;
    });

    res.json({
      data: {
        teamId,
        leaderboard,
        goals: teamGoals,
        lastUpdated: new Date(),
        onlineMembers: leaderboard.filter(m => m.isOnline).length,
        totalMembers: leaderboard.length
      }
    });
  } catch (error) {
    console.error('Error getting live leaderboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send push notification (for testing)
router.post('/notifications/push', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { receiverId, title, body, type, data } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!receiverId || !title || !body) {
      return res.status(400).json({ error: 'Receiver ID, title, and body are required' });
    }

    // Verify friendship or team membership for permission to send notifications
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { user1Id: userId, user2Id: receiverId },
          { user1Id: receiverId, user2Id: userId }
        ]
      }
    });

    if (!friendship) {
      // Check if they're in the same team
      const senderTeams = await prisma.teamMember.findMany({
        where: { userId: userId, isActive: true },
        select: { teamId: true }
      });

      const receiverTeams = await prisma.teamMember.findMany({
        where: { userId: receiverId, isActive: true },
        select: { teamId: true }
      });

      const commonTeams = senderTeams.filter(st => 
        receiverTeams.some(rt => rt.teamId === st.teamId)
      );

      if (commonTeams.length === 0) {
        return res.status(403).json({ error: 'Not authorized to send notifications to this user' });
      }
    }

    // Import socketService dynamically to avoid circular dependency
    const { socketService } = await import('../index');
    
    if (socketService) {
      await socketService.sendPushNotification(receiverId, {
        title,
        body,
        type: type || 'general',
        data
      });
    }

    res.json({ message: 'Push notification sent successfully' });
  } catch (error) {
    console.error('Error sending push notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get real-time statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Import socketService dynamically
    const { socketService } = await import('../index');
    
    const stats = {
      connectedUsers: socketService?.getConnectedUsersCount() || 0,
      userOnline: socketService?.isUserOnline(userId) || false,
      redisConnected: redisClient.isOpen,
      timestamp: new Date()
    };

    // Get additional stats from Redis if available
    if (redisClient.isOpen) {
      try {
        const onlineKeys = await redisClient.keys('online:*');
        stats.connectedUsers = Math.max(stats.connectedUsers, onlineKeys.length);
      } catch (error) {
        console.error('Error getting Redis stats:', error);
      }
    }

    res.json({ data: stats });
  } catch (error) {
    console.error('Error getting real-time stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;