import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { 
  SendFriendRequestData, 
  SendEmailInviteData, 
  AcceptFriendRequestData,
  SendSupportMessageData,
  UpdatePrivacySettingsData,
  UserPrivacySettings,
  FriendProgress
} from '../types';
import { AccessControlService } from '../services/accessControlService';

const router = express.Router();
const prisma = new PrismaClient();

// Get user's invite code
router.get('/invite-code', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { inviteCode: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ data: { inviteCode: user.inviteCode } });
  } catch (error) {
    console.error('Error getting invite code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send friend request by invite code
router.post('/request', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { inviteCode, message }: SendFriendRequestData = req.body;

    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code is required' });
    }

    // Find user by invite code
    const receiver = await prisma.user.findUnique({
      where: { inviteCode }
    });

    if (!receiver) {
      return res.status(404).json({ error: 'User not found with this invite code' });
    }

    if (receiver.id === userId) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    // Check if receiver allows friend requests
    const canReceiveFriendRequest = await AccessControlService.canSendFriendRequest(userId, receiver.id);
    if (!canReceiveFriendRequest) {
      return res.status(403).json({ error: 'User has disabled friend requests' });
    }

    // Check if friendship already exists
    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { user1Id: userId, user2Id: receiver.id },
          { user1Id: receiver.id, user2Id: userId }
        ]
      }
    });

    if (existingFriendship) {
      return res.status(400).json({ error: 'You are already friends' });
    }

    // Check if request already exists
    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: receiver.id },
          { senderId: receiver.id, receiverId: userId }
        ]
      }
    });

    if (existingRequest) {
      return res.status(400).json({ error: 'Friend request already exists' });
    }

    // Create friend request
    const friendRequest = await prisma.friendRequest.create({
      data: {
        senderId: userId,
        receiverId: receiver.id,
        message,
        status: 'pending'
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true }
        },
        receiver: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.status(201).json({ 
      data: friendRequest,
      message: 'Friend request sent successfully' 
    });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send email invite
router.post('/invite', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { email, message }: SendEmailInviteData = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists. Use invite code instead.' });
    }

    // Check if invite already exists and is not expired
    const existingInvite = await prisma.friendInvite.findFirst({
      where: {
        senderId: userId,
        email,
        status: 'pending',
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (existingInvite) {
      return res.status(400).json({ error: 'Invite already sent to this email' });
    }

    // Create invite (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await prisma.friendInvite.create({
      data: {
        senderId: userId,
        email,
        message,
        expiresAt,
        status: 'pending'
      }
    });

    // TODO: Send email with invite link
    // For now, just return the invite code
    res.status(201).json({ 
      data: { inviteCode: invite.inviteCode },
      message: 'Invite sent successfully' 
    });
  } catch (error) {
    console.error('Error sending email invite:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pending friend requests
router.get('/requests', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const requests = await prisma.friendRequest.findMany({
      where: {
        receiverId: userId,
        status: 'pending'
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ data: requests });
  } catch (error) {
    console.error('Error getting friend requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Accept friend request
router.post('/accept', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { requestId }: AcceptFriendRequestData = req.body;

    if (!requestId) {
      return res.status(400).json({ error: 'Request ID is required' });
    }

    // Find and validate request
    const request = await prisma.friendRequest.findUnique({
      where: { id: requestId }
    });

    if (!request) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    if (request.receiverId !== userId) {
      return res.status(403).json({ error: 'Not authorized to accept this request' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request is no longer pending' });
    }

    // Create friendship and update request status
    await prisma.$transaction(async (tx) => {
      // Update request status
      await tx.friendRequest.update({
        where: { id: requestId },
        data: { status: 'accepted' }
      });

      // Create friendship (ensure user1Id < user2Id for consistency)
      const user1Id = request.senderId < request.receiverId ? request.senderId : request.receiverId;
      const user2Id = request.senderId < request.receiverId ? request.receiverId : request.senderId;

      await tx.friendship.create({
        data: {
          user1Id,
          user2Id
        }
      });
    });

    res.json({ message: 'Friend request accepted successfully' });
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reject friend request
router.post('/reject', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({ error: 'Request ID is required' });
    }

    const request = await prisma.friendRequest.findUnique({
      where: { id: requestId }
    });

    if (!request) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    if (request.receiverId !== userId) {
      return res.status(403).json({ error: 'Not authorized to reject this request' });
    }

    await prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: 'rejected' }
    });

    res.json({ message: 'Friend request rejected' });
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get friends list
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId }
        ]
      },
      include: {
        user1: {
          select: { id: true, name: true, email: true, inviteCode: true }
        },
        user2: {
          select: { id: true, name: true, email: true, inviteCode: true }
        }
      }
    });

    // Map to get friend data
    const friends = friendships.map(friendship => ({
      ...friendship,
      friend: friendship.user1Id === userId ? friendship.user2 : friendship.user1
    }));

    res.json({ data: friends });
  } catch (error) {
    console.error('Error getting friends:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get friend's progress
router.get('/:friendId/progress', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { friendId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check friend permissions using access control service
    const friendPermissions = await AccessControlService.getFriendPermissions(userId, friendId);
    if (!friendPermissions) {
      return res.status(403).json({ error: 'Not friends with this user' });
    }

    if (!friendPermissions.canViewProgress) {
      return res.status(403).json({ error: 'Friend has disabled progress sharing' });
    }

    // Get friend info
    const friend = await prisma.user.findUnique({
      where: { id: friendId },
      select: { 
        id: true, 
        name: true, 
        email: true
      }
    });

    if (!friend) {
      return res.status(404).json({ error: 'Friend not found' });
    }

    // Get recent daily records for KPI calculation
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentRecords = await prisma.dailyRecord.findMany({
      where: {
        userId: friendId,
        date: {
          gte: thirtyDaysAgo
        }
      },
      orderBy: { date: 'desc' },
      take: 30
    });

    // Calculate progress metrics
    const currentKPI = recentRecords[0]?.totalKpi || 0;
    const weeklyRecords = recentRecords.slice(0, 7);
    const weeklyAverage = weeklyRecords.length > 0 
      ? weeklyRecords.reduce((sum, record) => sum + (record.totalKpi || 0), 0) / weeklyRecords.length 
      : 0;
    const monthlyAverage = recentRecords.length > 0 
      ? recentRecords.reduce((sum, record) => sum + (record.totalKpi || 0), 0) / recentRecords.length 
      : 0;

    // Calculate streak (consecutive days with KPI > 0)
    let streak = 0;
    for (const record of recentRecords) {
      if (record.totalKpi && record.totalKpi > 0) {
        streak++;
      } else {
        break;
      }
    }

    const progress: FriendProgress = {
      userId: friendId,
      userName: friend.name || 'Unknown',
      currentKPI,
      weeklyAverage,
      monthlyAverage,
      streak,
      lastActive: recentRecords[0]?.date || new Date()
    };

    // Add goals if privacy allows
    if (friendPermissions.canViewGoals) {
      const goals = await prisma.goal.findMany({
        where: { 
          userId: friendId,
          status: 'active'
        },
        select: {
          id: true,
          title: true,
          description: true,
          progress: true,
          type: true
        }
      });
      progress.goals = goals;
    }

    res.json({ data: progress });
  } catch (error) {
    console.error('Error getting friend progress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send support message
router.post('/message', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { receiverId, message, type }: SendSupportMessageData = req.body;

    if (!receiverId || !message) {
      return res.status(400).json({ error: 'Receiver ID and message are required' });
    }

    // Verify friendship
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { user1Id: userId, user2Id: receiverId },
          { user1Id: receiverId, user2Id: userId }
        ]
      }
    });

    if (!friendship) {
      return res.status(403).json({ error: 'Not friends with this user' });
    }

    const supportMessage = await prisma.supportMessage.create({
      data: {
        senderId: userId,
        receiverId,
        message,
        type: type || 'support'
      }
    });

    // Send real-time notification
    try {
      const { socketService } = await import('../index');
      if (socketService) {
        const sender = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true }
        });

        await socketService.sendPushNotification(receiverId, {
          title: `New ${type || 'support'} message`,
          body: `${sender?.name || sender?.email}: ${message}`,
          type: 'support_message',
          data: {
            messageId: supportMessage.id,
            senderId: userId,
            type: type || 'support'
          }
        });
      }
    } catch (error) {
      console.error('Error sending real-time notification:', error);
      // Don't fail the request if real-time notification fails
    }

    res.status(201).json({ 
      data: supportMessage,
      message: 'Support message sent successfully' 
    });
  } catch (error) {
    console.error('Error sending support message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get support messages
router.get('/messages', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const messages = await prisma.supportMessage.findMany({
      where: { receiverId: userId },
      include: {
        sender: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json({ data: messages });
  } catch (error) {
    console.error('Error getting support messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update privacy settings
router.put('/privacy', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const updates: UpdatePrivacySettingsData = req.body;

    const newSettings = await AccessControlService.updateUserPrivacySettings(userId, updates);
    if (!newSettings) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      data: newSettings,
      message: 'Privacy settings updated successfully' 
    });
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user's privacy settings
router.get('/privacy', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const settings = await AccessControlService.getUserPrivacySettings(userId);
    if (!settings) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ data: settings });
  } catch (error) {
    console.error('Error getting privacy settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove friend
router.delete('/:friendId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { friendId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { user1Id: userId, user2Id: friendId },
          { user1Id: friendId, user2Id: userId }
        ]
      }
    });

    if (!friendship) {
      return res.status(404).json({ error: 'Friendship not found' });
    }

    await prisma.friendship.delete({
      where: { id: friendship.id }
    });

    res.json({ message: 'Friend removed successfully' });
  } catch (error) {
    console.error('Error removing friend:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;