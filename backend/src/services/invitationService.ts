import { PrismaClient } from '@prisma/client';
import { InviteCodeGenerator } from './inviteCodeGenerator';
import { emailService, FriendInviteEmailData, TeamInviteEmailData } from './emailService';

const prisma = new PrismaClient();

export interface CreateFriendInviteData {
  senderId: string;
  email: string;
  message?: string;
}

export interface CreateTeamInviteData {
  senderId: string;
  teamId: string;
  email: string;
  message?: string;
}

export interface ProcessInviteResult {
  success: boolean;
  message: string;
  data?: any;
}

export interface InviteValidationResult {
  isValid: boolean;
  invite?: any;
  error?: string;
}

export class InvitationService {
  private static readonly INVITE_EXPIRY_DAYS = 7;
  private static readonly APP_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

  /**
   * Create a friend invitation
   */
  static async createFriendInvite(data: CreateFriendInviteData): Promise<ProcessInviteResult> {
    try {
      const { senderId, email, message } = data;

      // Validate sender exists
      const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { id: true, name: true, email: true }
      });

      if (!sender) {
        return {
          success: false,
          message: 'Sender not found'
        };
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        return {
          success: false,
          message: 'User already exists. Use invite code instead.'
        };
      }

      // Check if active invite already exists
      const existingInvite = await prisma.friendInvite.findFirst({
        where: {
          senderId,
          email,
          status: 'pending',
          expiresAt: {
            gt: new Date()
          }
        }
      });

      if (existingInvite) {
        return {
          success: false,
          message: 'Active invite already exists for this email'
        };
      }

      // Generate unique invite code
      const inviteCode = await InviteCodeGenerator.generateFriendInviteCode();

      // Set expiry date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.INVITE_EXPIRY_DAYS);

      // Create invite
      const invite = await prisma.friendInvite.create({
        data: {
          senderId,
          email,
          inviteCode,
          message,
          expiresAt,
          status: 'pending'
        }
      });

      // Send email if service is configured
      if (emailService.isReady()) {
        const emailData: FriendInviteEmailData = {
          senderName: sender.name || sender.email,
          senderEmail: sender.email,
          inviteCode,
          message,
          appUrl: this.APP_URL
        };

        const emailSent = await emailService.sendFriendInvitation(email, emailData);
        
        if (!emailSent) {
          console.warn(`Failed to send email invitation to ${email}`);
        }
      }

      return {
        success: true,
        message: 'Friend invitation created successfully',
        data: {
          inviteCode,
          expiresAt,
          emailSent: emailService.isReady()
        }
      };
    } catch (error) {
      console.error('Error creating friend invite:', error);
      return {
        success: false,
        message: 'Failed to create friend invitation'
      };
    }
  }

  /**
   * Create a team invitation
   */
  static async createTeamInvite(data: CreateTeamInviteData): Promise<ProcessInviteResult> {
    try {
      const { senderId, teamId, email, message } = data;

      // Validate sender is team leader or deputy
      const membership = await prisma.teamMember.findFirst({
        where: {
          teamId,
          userId: senderId,
          role: { in: ['leader', 'deputy'] },
          isActive: true
        },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          },
          team: {
            select: { id: true, name: true, maxMembers: true }
          }
        }
      });

      if (!membership) {
        return {
          success: false,
          message: 'Only team leaders and deputies can send invitations'
        };
      }

      // Check team capacity
      const currentMemberCount = await prisma.teamMember.count({
        where: {
          teamId,
          isActive: true
        }
      });

      if (currentMemberCount >= membership.team.maxMembers) {
        return {
          success: false,
          message: 'Team is at maximum capacity'
        };
      }

      // Check if user already exists and is a member
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        const existingMembership = await prisma.teamMember.findFirst({
          where: {
            teamId,
            userId: existingUser.id,
            isActive: true
          }
        });

        if (existingMembership) {
          return {
            success: false,
            message: 'User is already a member of this team'
          };
        }
      }

      // Check if active invite already exists
      const existingInvite = await prisma.teamInvite.findFirst({
        where: {
          teamId,
          email,
          status: 'pending',
          expiresAt: {
            gt: new Date()
          }
        }
      });

      if (existingInvite) {
        return {
          success: false,
          message: 'Active invite already exists for this email'
        };
      }

      // Generate unique invite code
      const inviteCode = await InviteCodeGenerator.generateTeamInviteCodeForInvites();

      // Set expiry date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.INVITE_EXPIRY_DAYS);

      // Create invite
      const invite = await prisma.teamInvite.create({
        data: {
          teamId,
          senderId,
          email,
          inviteCode,
          message,
          expiresAt,
          status: 'pending'
        }
      });

      // Send email if service is configured
      if (emailService.isReady()) {
        const emailData: TeamInviteEmailData = {
          senderName: membership.user.name || membership.user.email,
          teamName: membership.team.name,
          inviteCode,
          message,
          appUrl: this.APP_URL
        };

        const emailSent = await emailService.sendTeamInvitation(email, emailData);
        
        if (!emailSent) {
          console.warn(`Failed to send team email invitation to ${email}`);
        }
      }

      return {
        success: true,
        message: 'Team invitation created successfully',
        data: {
          inviteCode,
          expiresAt,
          teamName: membership.team.name,
          emailSent: emailService.isReady()
        }
      };
    } catch (error) {
      console.error('Error creating team invite:', error);
      return {
        success: false,
        message: 'Failed to create team invitation'
      };
    }
  }

  /**
   * Validate friend invitation code
   */
  static async validateFriendInvite(inviteCode: string): Promise<InviteValidationResult> {
    try {
      // Validate code format
      if (!InviteCodeGenerator.validateCodeFormat(inviteCode)) {
        return {
          isValid: false,
          error: 'Invalid invite code format'
        };
      }

      // Find invite
      const invite = await prisma.friendInvite.findUnique({
        where: { inviteCode },
        include: {
          sender: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      if (!invite) {
        return {
          isValid: false,
          error: 'Invite code not found'
        };
      }

      // Check if expired
      if (invite.expiresAt < new Date()) {
        return {
          isValid: false,
          error: 'Invite code has expired'
        };
      }

      // Check status
      if (invite.status !== 'pending') {
        return {
          isValid: false,
          error: 'Invite code is no longer valid'
        };
      }

      return {
        isValid: true,
        invite
      };
    } catch (error) {
      console.error('Error validating friend invite:', error);
      return {
        isValid: false,
        error: 'Failed to validate invite code'
      };
    }
  }

  /**
   * Validate team invitation code
   */
  static async validateTeamInvite(inviteCode: string): Promise<InviteValidationResult> {
    try {
      // Validate code format
      if (!InviteCodeGenerator.validateCodeFormat(inviteCode)) {
        return {
          isValid: false,
          error: 'Invalid invite code format'
        };
      }

      // Find invite
      const invite = await prisma.teamInvite.findUnique({
        where: { inviteCode },
        include: {
          team: {
            select: { 
              id: true, 
              name: true, 
              maxMembers: true,
              _count: {
                select: {
                  members: {
                    where: { isActive: true }
                  }
                }
              }
            }
          }
        }
      });

      if (!invite) {
        return {
          isValid: false,
          error: 'Invite code not found'
        };
      }

      // Check if expired
      if (invite.expiresAt < new Date()) {
        return {
          isValid: false,
          error: 'Invite code has expired'
        };
      }

      // Check status
      if (invite.status !== 'pending') {
        return {
          isValid: false,
          error: 'Invite code is no longer valid'
        };
      }

      // Check team capacity
      if (invite.team._count.members >= invite.team.maxMembers) {
        return {
          isValid: false,
          error: 'Team is at maximum capacity'
        };
      }

      return {
        isValid: true,
        invite
      };
    } catch (error) {
      console.error('Error validating team invite:', error);
      return {
        isValid: false,
        error: 'Failed to validate invite code'
      };
    }
  }

  /**
   * Process friend invitation acceptance
   */
  static async processFriendInviteAcceptance(
    inviteCode: string, 
    userId: string
  ): Promise<ProcessInviteResult> {
    try {
      // Validate invite
      const validation = await this.validateFriendInvite(inviteCode);
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.error || 'Invalid invite'
        };
      }

      const invite = validation.invite!;

      // Check if user is trying to accept their own invite
      if (invite.senderId === userId) {
        return {
          success: false,
          message: 'Cannot accept your own invitation'
        };
      }

      // Check if friendship already exists
      const existingFriendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { user1Id: userId, user2Id: invite.senderId },
            { user1Id: invite.senderId, user2Id: userId }
          ]
        }
      });

      if (existingFriendship) {
        return {
          success: false,
          message: 'You are already friends with this user'
        };
      }

      // Process acceptance in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Update invite status
        await tx.friendInvite.update({
          where: { id: invite.id },
          data: { status: 'accepted' }
        });

        // Create friendship (ensure user1Id < user2Id for consistency)
        const user1Id = userId < invite.senderId ? userId : invite.senderId;
        const user2Id = userId < invite.senderId ? invite.senderId : userId;

        const friendship = await tx.friendship.create({
          data: {
            user1Id,
            user2Id
          }
        });

        return friendship;
      });

      return {
        success: true,
        message: 'Friend invitation accepted successfully',
        data: {
          friendshipId: result.id,
          friendName: invite.sender.name || invite.sender.email
        }
      };
    } catch (error) {
      console.error('Error processing friend invite acceptance:', error);
      return {
        success: false,
        message: 'Failed to process friend invitation'
      };
    }
  }

  /**
   * Process team invitation acceptance
   */
  static async processTeamInviteAcceptance(
    inviteCode: string, 
    userId: string
  ): Promise<ProcessInviteResult> {
    try {
      // Validate invite
      const validation = await this.validateTeamInvite(inviteCode);
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.error || 'Invalid invite'
        };
      }

      const invite = validation.invite!;

      // Check if user is already a member
      const existingMembership = await prisma.teamMember.findFirst({
        where: {
          teamId: invite.teamId,
          userId,
          isActive: true
        }
      });

      if (existingMembership) {
        return {
          success: false,
          message: 'You are already a member of this team'
        };
      }

      // Process acceptance in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Update invite status
        await tx.teamInvite.update({
          where: { id: invite.id },
          data: { status: 'accepted' }
        });

        // Check for inactive membership to reactivate
        const inactiveMembership = await tx.teamMember.findFirst({
          where: {
            teamId: invite.teamId,
            userId,
            isActive: false
          }
        });

        let membership;
        if (inactiveMembership) {
          // Reactivate membership
          membership = await tx.teamMember.update({
            where: { id: inactiveMembership.id },
            data: { 
              isActive: true, 
              joinedAt: new Date() 
            }
          });
        } else {
          // Create new membership
          membership = await tx.teamMember.create({
            data: {
              teamId: invite.teamId,
              userId,
              role: 'member'
            }
          });
        }

        return membership;
      });

      return {
        success: true,
        message: 'Team invitation accepted successfully',
        data: {
          membershipId: result.id,
          teamName: invite.team.name
        }
      };
    } catch (error) {
      console.error('Error processing team invite acceptance:', error);
      return {
        success: false,
        message: 'Failed to process team invitation'
      };
    }
  }

  /**
   * Get user's sent invitations
   */
  static async getUserSentInvites(userId: string) {
    try {
      const [friendInvites, teamInvites] = await Promise.all([
        prisma.friendInvite.findMany({
          where: { senderId: userId },
          orderBy: { createdAt: 'desc' },
          take: 50
        }),
        prisma.teamInvite.findMany({
          where: { senderId: userId },
          include: {
            team: {
              select: { id: true, name: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        })
      ]);

      return {
        friendInvites,
        teamInvites
      };
    } catch (error) {
      console.error('Error getting user sent invites:', error);
      throw error;
    }
  }

  /**
   * Cancel/expire invitation
   */
  static async cancelInvitation(
    inviteId: string, 
    userId: string, 
    type: 'friend' | 'team'
  ): Promise<ProcessInviteResult> {
    try {
      if (type === 'friend') {
        const invite = await prisma.friendInvite.findUnique({
          where: { id: inviteId }
        });

        if (!invite || invite.senderId !== userId) {
          return {
            success: false,
            message: 'Invitation not found or access denied'
          };
        }

        await prisma.friendInvite.update({
          where: { id: inviteId },
          data: { status: 'expired' }
        });
      } else {
        const invite = await prisma.teamInvite.findUnique({
          where: { id: inviteId }
        });

        if (!invite || invite.senderId !== userId) {
          return {
            success: false,
            message: 'Invitation not found or access denied'
          };
        }

        await prisma.teamInvite.update({
          where: { id: inviteId },
          data: { status: 'expired' }
        });
      }

      return {
        success: true,
        message: 'Invitation cancelled successfully'
      };
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      return {
        success: false,
        message: 'Failed to cancel invitation'
      };
    }
  }

  /**
   * Clean up expired invitations (should be run periodically)
   */
  static async cleanupExpiredInvites(): Promise<void> {
    try {
      const now = new Date();
      
      await Promise.all([
        prisma.friendInvite.updateMany({
          where: {
            status: 'pending',
            expiresAt: { lt: now }
          },
          data: { status: 'expired' }
        }),
        prisma.teamInvite.updateMany({
          where: {
            status: 'pending',
            expiresAt: { lt: now }
          },
          data: { status: 'expired' }
        })
      ]);

      console.log('Expired invitations cleaned up successfully');
    } catch (error) {
      console.error('Error cleaning up expired invites:', error);
    }
  }
}