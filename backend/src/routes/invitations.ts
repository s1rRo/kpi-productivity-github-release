import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { InvitationService } from '../services/invitationService';
import { InviteCodeGenerator } from '../services/inviteCodeGenerator';

const router = express.Router();
const prisma = new PrismaClient();

// Get user's invite code
router.get('/my-code', authenticateToken, async (req: AuthRequest, res) => {
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

    res.json({ 
      data: { 
        inviteCode: user.inviteCode 
      } 
    });
  } catch (error) {
    console.error('Error getting user invite code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create friend invitation by email
router.post('/friends/email', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { email, message } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const result = await InvitationService.createFriendInvite({
      senderId: userId,
      email,
      message
    });

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.status(201).json({
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error creating friend invitation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create team invitation by email
router.post('/teams/:teamId/email', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    const { teamId } = req.params;
    const { email, message } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const result = await InvitationService.createTeamInvite({
      senderId: userId,
      teamId,
      email,
      message
    });

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.status(201).json({
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error creating team invitation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Validate friend invitation code
router.get('/friends/validate/:inviteCode', async (req, res) => {
  try {
    const { inviteCode } = req.params;

    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code is required' });
    }

    const validation = await InvitationService.validateFriendInvite(inviteCode);

    if (!validation.isValid) {
      return res.status(400).json({ error: validation.error });
    }

    // Return safe invite data (without sensitive info)
    const safeInviteData = {
      senderName: validation.invite?.sender?.name || validation.invite?.sender?.email,
      message: validation.invite?.message,
      expiresAt: validation.invite?.expiresAt
    };

    res.json({
      message: 'Invite code is valid',
      data: safeInviteData
    });
  } catch (error) {
    console.error('Error validating friend invite:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Validate team invitation code
router.get('/teams/validate/:inviteCode', async (req, res) => {
  try {
    const { inviteCode } = req.params;

    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code is required' });
    }

    const validation = await InvitationService.validateTeamInvite(inviteCode);

    if (!validation.isValid) {
      return res.status(400).json({ error: validation.error });
    }

    // Return safe invite data (without sensitive info)
    const safeInviteData = {
      teamName: validation.invite?.team?.name,
      message: validation.invite?.message,
      expiresAt: validation.invite?.expiresAt,
      currentMembers: validation.invite?.team?._count?.members,
      maxMembers: validation.invite?.team?.maxMembers
    };

    res.json({
      message: 'Invite code is valid',
      data: safeInviteData
    });
  } catch (error) {
    console.error('Error validating team invite:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Accept friend invitation
router.post('/friends/accept/:inviteCode', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    const { inviteCode } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code is required' });
    }

    const result = await InvitationService.processFriendInviteAcceptance(inviteCode, userId);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error accepting friend invitation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Accept team invitation
router.post('/teams/accept/:inviteCode', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    const { inviteCode } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code is required' });
    }

    const result = await InvitationService.processTeamInviteAcceptance(inviteCode, userId);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error accepting team invitation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's sent invitations
router.get('/sent', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const invites = await InvitationService.getUserSentInvites(userId);

    res.json({
      data: invites
    });
  } catch (error) {
    console.error('Error getting sent invitations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel friend invitation
router.delete('/friends/:inviteId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    const { inviteId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await InvitationService.cancelInvitation(inviteId, userId, 'friend');

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({ message: result.message });
  } catch (error) {
    console.error('Error cancelling friend invitation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel team invitation
router.delete('/teams/:inviteId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    const { inviteId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await InvitationService.cancelInvitation(inviteId, userId, 'team');

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({ message: result.message });
  } catch (error) {
    console.error('Error cancelling team invitation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resend invitation (friend)
router.post('/friends/:inviteId/resend', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    const { inviteId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get existing invite
    const existingInvite = await prisma.friendInvite.findUnique({
      where: { id: inviteId },
      include: {
        sender: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!existingInvite || existingInvite.senderId !== userId) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (existingInvite.status !== 'pending') {
      return res.status(400).json({ error: 'Can only resend pending invitations' });
    }

    // Create new invitation (cancel old one and create new)
    const result = await InvitationService.createFriendInvite({
      senderId: userId,
      email: existingInvite.email,
      message: existingInvite.message || undefined
    });

    if (result.success) {
      // Cancel old invitation
      await InvitationService.cancelInvitation(inviteId, userId, 'friend');
    }

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({
      message: 'Invitation resent successfully',
      data: result.data
    });
  } catch (error) {
    console.error('Error resending friend invitation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resend invitation (team)
router.post('/teams/:inviteId/resend', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    const { inviteId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get existing invite
    const existingInvite = await prisma.teamInvite.findUnique({
      where: { id: inviteId }
    });

    if (!existingInvite || existingInvite.senderId !== userId) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (existingInvite.status !== 'pending') {
      return res.status(400).json({ error: 'Can only resend pending invitations' });
    }

    // Create new invitation (cancel old one and create new)
    const result = await InvitationService.createTeamInvite({
      senderId: userId,
      teamId: existingInvite.teamId,
      email: existingInvite.email,
      message: existingInvite.message || undefined
    });

    if (result.success) {
      // Cancel old invitation
      await InvitationService.cancelInvitation(inviteId, userId, 'team');
    }

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({
      message: 'Invitation resent successfully',
      data: result.data
    });
  } catch (error) {
    console.error('Error resending team invitation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get invitation statistics
router.get('/stats', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [friendStats, teamStats] = await Promise.all([
      prisma.friendInvite.groupBy({
        by: ['status'],
        where: { senderId: userId },
        _count: { status: true }
      }),
      prisma.teamInvite.groupBy({
        by: ['status'],
        where: { senderId: userId },
        _count: { status: true }
      })
    ]);

    const stats = {
      friends: {
        pending: friendStats.find(s => s.status === 'pending')?._count.status || 0,
        accepted: friendStats.find(s => s.status === 'accepted')?._count.status || 0,
        expired: friendStats.find(s => s.status === 'expired')?._count.status || 0,
        total: friendStats.reduce((sum, s) => sum + s._count.status, 0)
      },
      teams: {
        pending: teamStats.find(s => s.status === 'pending')?._count.status || 0,
        accepted: teamStats.find(s => s.status === 'accepted')?._count.status || 0,
        expired: teamStats.find(s => s.status === 'expired')?._count.status || 0,
        total: teamStats.reduce((sum, s) => sum + s._count.status, 0)
      }
    };

    res.json({ data: stats });
  } catch (error) {
    console.error('Error getting invitation statistics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin endpoint to cleanup expired invitations
router.post('/cleanup', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // For now, allow any authenticated user to trigger cleanup
    // In production, this should be restricted to admin users or run as a cron job
    await InvitationService.cleanupExpiredInvites();

    res.json({ message: 'Expired invitations cleaned up successfully' });
  } catch (error) {
    console.error('Error cleaning up invitations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;