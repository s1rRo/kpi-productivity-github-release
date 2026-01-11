import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface TeamPermissions {
  canManageTeam: boolean;
  canManageMembers: boolean;
  canCreateGoals: boolean;
  canUpdateGoals: boolean;
  canDeleteGoals: boolean;
  canViewAnalytics: boolean;
  canModerateContent: boolean;
  canInviteMembers: boolean;
  canRemoveMembers: boolean;
  canAssignRoles: boolean;
}

export interface FriendPermissions {
  canViewProgress: boolean;
  canViewGoals: boolean;
  canViewAchievements: boolean;
  canSendMessages: boolean;
}

export interface UserPrivacySettings {
  showProgress: boolean;
  showGoals: boolean;
  showAchievements: boolean;
  allowFriendRequests: boolean;
  allowTeamInvites: boolean;
  showOnlineStatus: boolean;
}

export class AccessControlService {
  /**
   * Get team permissions for a user
   */
  static async getTeamPermissions(userId: string, teamId: string): Promise<TeamPermissions | null> {
    try {
      const membership = await prisma.teamMember.findFirst({
        where: {
          teamId,
          userId,
          isActive: true
        }
      });

      if (!membership) {
        return null;
      }

      return this.getPermissionsByRole(membership.role);
    } catch (error) {
      console.error('Error getting team permissions:', error);
      return null;
    }
  }

  /**
   * Get permissions based on team role
   */
  static getPermissionsByRole(role: string): TeamPermissions {
    switch (role) {
      case 'leader':
        return {
          canManageTeam: true,
          canManageMembers: true,
          canCreateGoals: true,
          canUpdateGoals: true,
          canDeleteGoals: true,
          canViewAnalytics: true,
          canModerateContent: true,
          canInviteMembers: true,
          canRemoveMembers: true,
          canAssignRoles: true
        };
      
      case 'deputy':
        return {
          canManageTeam: false, // Cannot change team settings
          canManageMembers: true,
          canCreateGoals: true,
          canUpdateGoals: true,
          canDeleteGoals: false, // Cannot delete goals
          canViewAnalytics: true,
          canModerateContent: true,
          canInviteMembers: true,
          canRemoveMembers: true,
          canAssignRoles: false // Cannot assign leader role
        };
      
      case 'member':
      default:
        return {
          canManageTeam: false,
          canManageMembers: false,
          canCreateGoals: false,
          canUpdateGoals: false,
          canDeleteGoals: false,
          canViewAnalytics: false,
          canModerateContent: false,
          canInviteMembers: false,
          canRemoveMembers: false,
          canAssignRoles: false
        };
    }
  }

  /**
   * Check if user has specific team permission
   */
  static async hasTeamPermission(
    userId: string, 
    teamId: string, 
    permission: keyof TeamPermissions
  ): Promise<boolean> {
    const permissions = await this.getTeamPermissions(userId, teamId);
    return permissions ? permissions[permission] : false;
  }

  /**
   * Get friend permissions based on privacy settings
   */
  static async getFriendPermissions(userId: string, friendId: string): Promise<FriendPermissions | null> {
    try {
      // Verify friendship exists
      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { user1Id: userId, user2Id: friendId },
            { user1Id: friendId, user2Id: userId }
          ]
        }
      });

      if (!friendship) {
        return null;
      }

      // Get friend's privacy settings
      const friend = await prisma.user.findUnique({
        where: { id: friendId },
        select: { privacySettings: true }
      });

      if (!friend) {
        return null;
      }

      const privacySettings: UserPrivacySettings = JSON.parse(friend.privacySettings);

      return {
        canViewProgress: privacySettings.showProgress,
        canViewGoals: privacySettings.showGoals,
        canViewAchievements: privacySettings.showAchievements,
        canSendMessages: true // Always allowed for friends
      };
    } catch (error) {
      console.error('Error getting friend permissions:', error);
      return null;
    }
  }

  /**
   * Check if user can perform action on team member
   */
  static async canManageTeamMember(
    actorId: string, 
    targetId: string, 
    teamId: string, 
    action: 'remove' | 'changeRole' | 'invite'
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      // Get actor's membership and permissions
      const actorMembership = await prisma.teamMember.findFirst({
        where: {
          teamId,
          userId: actorId,
          isActive: true
        }
      });

      if (!actorMembership) {
        return { allowed: false, reason: 'Not a team member' };
      }

      const actorPermissions = this.getPermissionsByRole(actorMembership.role);

      // Check basic permission for the action
      switch (action) {
        case 'remove':
          if (!actorPermissions.canRemoveMembers) {
            return { allowed: false, reason: 'Insufficient permissions to remove members' };
          }
          break;
        case 'changeRole':
          if (!actorPermissions.canAssignRoles) {
            return { allowed: false, reason: 'Insufficient permissions to change roles' };
          }
          break;
        case 'invite':
          if (!actorPermissions.canInviteMembers) {
            return { allowed: false, reason: 'Insufficient permissions to invite members' };
          }
          break;
      }

      // For remove and changeRole actions, check target member
      if (action === 'remove' || action === 'changeRole') {
        const targetMembership = await prisma.teamMember.findFirst({
          where: {
            teamId,
            userId: targetId,
            isActive: true
          }
        });

        if (!targetMembership) {
          return { allowed: false, reason: 'Target user is not a team member' };
        }

        // Cannot perform actions on yourself
        if (actorId === targetId) {
          return { allowed: false, reason: 'Cannot perform this action on yourself' };
        }

        // Role hierarchy checks
        if (targetMembership.role === 'leader') {
          if (actorMembership.role !== 'leader') {
            return { allowed: false, reason: 'Cannot manage team leaders' };
          }
          
          // Check if this is the last leader
          if (action === 'remove' || action === 'changeRole') {
            const leaderCount = await prisma.teamMember.count({
              where: {
                teamId,
                role: 'leader',
                isActive: true
              }
            });

            if (leaderCount <= 1) {
              return { allowed: false, reason: 'Cannot remove or demote the last team leader' };
            }
          }
        }

        // Deputies can only manage members, not other deputies or leaders
        if (actorMembership.role === 'deputy' && targetMembership.role !== 'member') {
          return { allowed: false, reason: 'Deputies can only manage regular members' };
        }
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error checking team member management permission:', error);
      return { allowed: false, reason: 'Internal error' };
    }
  }

  /**
   * Get user's privacy settings
   */
  static async getUserPrivacySettings(userId: string): Promise<UserPrivacySettings | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { privacySettings: true }
      });

      if (!user) {
        return null;
      }

      return JSON.parse(user.privacySettings);
    } catch (error) {
      console.error('Error getting user privacy settings:', error);
      return null;
    }
  }

  /**
   * Update user's privacy settings
   */
  static async updateUserPrivacySettings(
    userId: string, 
    updates: Partial<UserPrivacySettings>
  ): Promise<UserPrivacySettings | null> {
    try {
      const currentSettings = await this.getUserPrivacySettings(userId);
      if (!currentSettings) {
        return null;
      }

      const newSettings: UserPrivacySettings = {
        ...currentSettings,
        ...updates
      };

      await prisma.user.update({
        where: { id: userId },
        data: {
          privacySettings: JSON.stringify(newSettings)
        }
      });

      return newSettings;
    } catch (error) {
      console.error('Error updating user privacy settings:', error);
      return null;
    }
  }

  /**
   * Check if user can send friend request
   */
  static async canSendFriendRequest(senderId: string, receiverId: string): Promise<boolean> {
    try {
      const receiverSettings = await this.getUserPrivacySettings(receiverId);
      return receiverSettings ? receiverSettings.allowFriendRequests : true;
    } catch (error) {
      console.error('Error checking friend request permission:', error);
      return false;
    }
  }

  /**
   * Check if user can receive team invites
   */
  static async canReceiveTeamInvite(userId: string): Promise<boolean> {
    try {
      const userSettings = await this.getUserPrivacySettings(userId);
      return userSettings ? userSettings.allowTeamInvites : true;
    } catch (error) {
      console.error('Error checking team invite permission:', error);
      return false;
    }
  }

  /**
   * Get team moderation permissions
   */
  static async getTeamModerationPermissions(userId: string, teamId: string) {
    try {
      const permissions = await this.getTeamPermissions(userId, teamId);
      if (!permissions) {
        return null;
      }

      return {
        canModerateContent: permissions.canModerateContent,
        canRemoveMembers: permissions.canRemoveMembers,
        canViewAnalytics: permissions.canViewAnalytics,
        canManageTeam: permissions.canManageTeam
      };
    } catch (error) {
      console.error('Error getting team moderation permissions:', error);
      return null;
    }
  }

  /**
   * Log moderation action
   */
  static async logModerationAction(
    teamId: string,
    moderatorId: string,
    action: string,
    targetId?: string,
    details?: any
  ): Promise<void> {
    try {
      // For now, just log to console. In production, you might want to store this in a database
      console.log('Moderation Action:', {
        teamId,
        moderatorId,
        action,
        targetId,
        details,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error logging moderation action:', error);
    }
  }
}