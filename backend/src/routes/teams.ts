import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { AccessControlService } from '../services/accessControlService';

const router = express.Router();
const prisma = new PrismaClient();

// Get user's teams
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const teams = await prisma.team.findMany({
      where: {
        members: {
          some: {
            userId: userId,
            isActive: true
          }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          where: {
            isActive: true
          }
        },
        goals: {
          where: {
            isActive: true
          },
          include: {
            progress: true
          }
        },
        _count: {
          select: {
            members: {
              where: {
                isActive: true
              }
            }
          }
        }
      }
    });

    res.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Get specific team details
router.get('/:teamId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { teamId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
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

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          where: {
            isActive: true
          },
          orderBy: [
            { role: 'asc' }, // leaders first
            { joinedAt: 'asc' }
          ]
        },
        goals: {
          where: {
            isActive: true
          },
          include: {
            progress: {
              include: {
                teamGoal: true
              }
            }
          }
        }
      }
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json(team);
  } catch (error) {
    console.error('Error fetching team details:', error);
    res.status(500).json({ error: 'Failed to fetch team details' });
  }
});

// Create a new team
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { name, description, avatar, maxMembers = 99, isPublic = false } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    if (maxMembers > 99 || maxMembers < 1) {
      return res.status(400).json({ error: 'Team size must be between 1 and 99 members' });
    }

    const team = await prisma.team.create({
      data: {
        name: name.trim(),
        description: description?.trim(),
        avatar,
        maxMembers,
        isPublic,
        members: {
          create: {
            userId: userId,
            role: 'leader'
          }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    res.status(201).json(team);
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Update team settings (leader only)
router.put('/:teamId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { teamId } = req.params;
    const { name, description, avatar, maxMembers, isPublic } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if user has permission to manage team
    const hasPermission = await AccessControlService.hasTeamPermission(userId, teamId, 'canManageTeam');
    if (!hasPermission) {
      return res.status(403).json({ error: 'Only team leaders can update team settings' });
    }

    // Validate maxMembers if provided
    if (maxMembers !== undefined && (maxMembers > 99 || maxMembers < 1)) {
      return res.status(400).json({ error: 'Team size must be between 1 and 99 members' });
    }

    // Check if reducing maxMembers would exceed current member count
    if (maxMembers !== undefined) {
      const currentMemberCount = await prisma.teamMember.count({
        where: {
          teamId: teamId,
          isActive: true
        }
      });

      if (maxMembers < currentMemberCount) {
        return res.status(400).json({ 
          error: `Cannot reduce team size below current member count (${currentMemberCount})` 
        });
      }
    }

    const updatedTeam = await prisma.team.update({
      where: { id: teamId },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() }),
        ...(avatar !== undefined && { avatar }),
        ...(maxMembers !== undefined && { maxMembers }),
        ...(isPublic !== undefined && { isPublic })
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          where: {
            isActive: true
          }
        }
      }
    });

    // Log moderation action
    await AccessControlService.logModerationAction(
      teamId,
      userId,
      'update_team_settings',
      undefined,
      { name, description, avatar, maxMembers, isPublic }
    );

    res.json(updatedTeam);
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// Join team by invite code
router.post('/join/:inviteCode', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { inviteCode } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Find team by invite code
    const team = await prisma.team.findUnique({
      where: { inviteCode },
      include: {
        _count: {
          select: {
            members: {
              where: {
                isActive: true
              }
            }
          }
        }
      }
    });

    if (!team) {
      return res.status(404).json({ error: 'Invalid invite code' });
    }

    // Check if team is full
    if (team._count.members >= team.maxMembers) {
      return res.status(400).json({ error: 'Team is full' });
    }

    // Check if user is already a member
    const existingMembership = await prisma.teamMember.findFirst({
      where: {
        teamId: team.id,
        userId: userId
      }
    });

    if (existingMembership) {
      if (existingMembership.isActive) {
        return res.status(400).json({ error: 'You are already a member of this team' });
      } else {
        // Reactivate membership
        await prisma.teamMember.update({
          where: { id: existingMembership.id },
          data: { isActive: true, joinedAt: new Date() }
        });
      }
    } else {
      // Create new membership
      await prisma.teamMember.create({
        data: {
          teamId: team.id,
          userId: userId,
          role: 'member'
        }
      });
    }

    // Return updated team info
    const updatedTeam = await prisma.team.findUnique({
      where: { id: team.id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          where: {
            isActive: true
          }
        }
      }
    });

    res.json(updatedTeam);
  } catch (error) {
    console.error('Error joining team:', error);
    res.status(500).json({ error: 'Failed to join team' });
  }
});

// Update member role (leader/deputy only)
router.put('/:teamId/members/:memberId/role', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { teamId, memberId } = req.params;
    const { role } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!['leader', 'deputy', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be leader, deputy, or member' });
    }

    // Get target member info
    const targetMember = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!targetMember || targetMember.teamId !== teamId) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Check permissions using access control service
    const canManage = await AccessControlService.canManageTeamMember(
      userId, 
      targetMember.userId, 
      teamId, 
      'changeRole'
    );

    if (!canManage.allowed) {
      return res.status(403).json({ error: canManage.reason });
    }

    // Additional check for assigning leader role - only leaders can do this
    if (role === 'leader') {
      const hasLeaderPermission = await AccessControlService.hasTeamPermission(userId, teamId, 'canManageTeam');
      if (!hasLeaderPermission) {
        return res.status(403).json({ error: 'Only team leaders can assign leader role' });
      }
    }

    // Update member role
    const updatedMember = await prisma.teamMember.update({
      where: { id: memberId },
      data: { role },
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

    // Log moderation action
    await AccessControlService.logModerationAction(
      teamId,
      userId,
      'change_member_role',
      targetMember.userId,
      { oldRole: targetMember.role, newRole: role }
    );

    res.json(updatedMember);
  } catch (error) {
    console.error('Error updating member role:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

// Remove member from team (leader/deputy only)
router.delete('/:teamId/members/:memberId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { teamId, memberId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get member to be removed
    const memberToRemove = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!memberToRemove || memberToRemove.teamId !== teamId) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Check permissions using access control service
    const canManage = await AccessControlService.canManageTeamMember(
      userId, 
      memberToRemove.userId, 
      teamId, 
      'remove'
    );

    if (!canManage.allowed) {
      return res.status(403).json({ error: canManage.reason });
    }

    // Deactivate membership instead of deleting to preserve history
    await prisma.teamMember.update({
      where: { id: memberId },
      data: { isActive: false }
    });

    // Log moderation action
    await AccessControlService.logModerationAction(
      teamId,
      userId,
      'remove_member',
      memberToRemove.userId,
      { memberRole: memberToRemove.role }
    );

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Leave team
router.post('/:teamId/leave', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { teamId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const membership = await prisma.teamMember.findFirst({
      where: {
        teamId: teamId,
        userId: userId,
        isActive: true
      }
    });

    if (!membership) {
      return res.status(404).json({ error: 'You are not a member of this team' });
    }

    // Check if user is the last leader
    if (membership.role === 'leader') {
      const leaderCount = await prisma.teamMember.count({
        where: {
          teamId: teamId,
          role: 'leader',
          isActive: true
        }
      });

      if (leaderCount <= 1) {
        return res.status(400).json({ 
          error: 'Cannot leave team as the last leader. Please assign another leader first.' 
        });
      }
    }

    // Deactivate membership
    await prisma.teamMember.update({
      where: { id: membership.id },
      data: { isActive: false }
    });

    res.json({ message: 'Left team successfully' });
  } catch (error) {
    console.error('Error leaving team:', error);
    res.status(500).json({ error: 'Failed to leave team' });
  }
});

// Create team goal (leader/deputy only)
router.post('/:teamId/goals', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { teamId } = req.params;
    const { title, description, targetValue, unit = 'points', startDate, endDate } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if user has permission to create goals
    const hasPermission = await AccessControlService.hasTeamPermission(userId, teamId, 'canCreateGoals');
    if (!hasPermission) {
      return res.status(403).json({ error: 'Only team leaders and deputies can create goals' });
    }

    if (!title || !targetValue || !startDate || !endDate) {
      return res.status(400).json({ error: 'Title, target value, start date, and end date are required' });
    }

    const teamGoal = await prisma.teamGoal.create({
      data: {
        teamId,
        title: title.trim(),
        description: description?.trim(),
        targetValue: parseInt(targetValue),
        unit,
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      },
      include: {
        progress: true
      }
    });

    // Initialize progress for all team members
    const teamMembers = await prisma.teamMember.findMany({
      where: {
        teamId: teamId,
        isActive: true
      }
    });

    await Promise.all(
      teamMembers.map(member =>
        prisma.teamGoalProgress.create({
          data: {
            teamGoalId: teamGoal.id,
            userId: member.userId,
            currentValue: 0,
            percentage: 0
          }
        })
      )
    );

    // Log moderation action
    await AccessControlService.logModerationAction(
      teamId,
      userId,
      'create_team_goal',
      undefined,
      { goalTitle: title, targetValue, unit }
    );

    // Return goal with initialized progress
    const goalWithProgress = await prisma.teamGoal.findUnique({
      where: { id: teamGoal.id },
      include: {
        progress: true
      }
    });

    res.status(201).json(goalWithProgress);
  } catch (error) {
    console.error('Error creating team goal:', error);
    res.status(500).json({ error: 'Failed to create team goal' });
  }
});

// Update team goal (leader/deputy only)
router.put('/:teamId/goals/:goalId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { teamId, goalId } = req.params;
    const { title, description, targetValue, unit, startDate, endDate, isActive } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if user has permission to update goals
    const hasPermission = await AccessControlService.hasTeamPermission(userId, teamId, 'canUpdateGoals');
    if (!hasPermission) {
      return res.status(403).json({ error: 'Only team leaders and deputies can update goals' });
    }

    const updatedGoal = await prisma.teamGoal.update({
      where: { id: goalId },
      data: {
        ...(title && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() }),
        ...(targetValue !== undefined && { targetValue: parseInt(targetValue) }),
        ...(unit && { unit }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(isActive !== undefined && { isActive })
      },
      include: {
        progress: true
      }
    });

    // Recalculate percentages if target value changed
    if (targetValue !== undefined) {
      await Promise.all(
        updatedGoal.progress.map(progress =>
          prisma.teamGoalProgress.update({
            where: { id: progress.id },
            data: {
              percentage: Math.min((progress.currentValue / parseInt(targetValue)) * 100, 100)
            }
          })
        )
      );
    }

    // Log moderation action
    await AccessControlService.logModerationAction(
      teamId,
      userId,
      'update_team_goal',
      undefined,
      { goalId, updates: { title, description, targetValue, unit, startDate, endDate, isActive } }
    );

    res.json(updatedGoal);
  } catch (error) {
    console.error('Error updating team goal:', error);
    res.status(500).json({ error: 'Failed to update team goal' });
  }
});

  // Update member progress on team goal
router.put('/:teamId/goals/:goalId/progress/:userId', authenticateToken, async (req, res) => {
  try {
    const requestUserId = req.user?.userId;
    const { teamId, goalId, userId } = req.params;
    const { currentValue } = req.body;

    if (!requestUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if user has permission (leader, deputy, or updating own progress)
    const membership = await prisma.teamMember.findFirst({
      where: {
        teamId: teamId,
        userId: requestUserId,
        isActive: true
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Access denied to this team' });
    }

    const canUpdate = membership.role === 'leader' || 
                     membership.role === 'deputy' || 
                     requestUserId === userId;

    if (!canUpdate) {
      return res.status(403).json({ error: 'You can only update your own progress or be a team leader/deputy' });
    }

    // Get the team goal to calculate percentage
    const teamGoal = await prisma.teamGoal.findUnique({
      where: { id: goalId }
    });

    if (!teamGoal) {
      return res.status(404).json({ error: 'Team goal not found' });
    }

    const percentage = Math.min((currentValue / teamGoal.targetValue) * 100, 100);

    const updatedProgress = await prisma.teamGoalProgress.upsert({
      where: {
        teamGoalId_userId: {
          teamGoalId: goalId,
          userId: userId
        }
      },
      update: {
        currentValue: parseInt(currentValue),
        percentage,
        lastUpdated: new Date()
      },
      create: {
        teamGoalId: goalId,
        userId: userId,
        currentValue: parseInt(currentValue),
        percentage,
        lastUpdated: new Date()
      }
    });

    // Broadcast real-time update to team members
    try {
      const { socketService } = await import('../index');
      if (socketService) {
        const leaderboardData = await getTeamLeaderboard(teamId);
        await socketService.broadcastLeaderboardUpdate(teamId, {
          goalId,
          updatedProgress,
          leaderboard: leaderboardData,
          updatedBy: {
            userId: requestUserId,
            userName: req.user?.name || req.user?.email
          }
        });
      }
    } catch (error) {
      console.error('Error broadcasting leaderboard update:', error);
      // Don't fail the request if real-time update fails
    }

    res.json(updatedProgress);
  } catch (error) {
    console.error('Error updating goal progress:', error);
    res.status(500).json({ error: 'Failed to update goal progress' });
  }
});

// Helper function to get team leaderboard
async function getTeamLeaderboard(teamId: string) {
  try {
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

    // Get team members
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

// Get team leaderboard with filtering
router.get('/:teamId/leaderboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { teamId } = req.params;
    const { period = 'all', startDate, endDate } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
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

    // Build date filter for goals
    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case 'day':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        dateFilter = {
          startDate: { lte: today },
          endDate: { gte: today }
        };
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        dateFilter = {
          OR: [
            {
              startDate: { lte: weekEnd },
              endDate: { gte: weekStart }
            }
          ]
        };
        break;
      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        dateFilter = {
          OR: [
            {
              startDate: { lte: monthEnd },
              endDate: { gte: monthStart }
            }
          ]
        };
        break;
      case 'custom':
        if (startDate && endDate) {
          dateFilter = {
            OR: [
              {
                startDate: { lte: new Date(endDate as string) },
                endDate: { gte: new Date(startDate as string) }
              }
            ]
          };
        }
        break;
      default:
        // 'all' - no date filter
        break;
    }

    // Get team goals with date filtering
    const teamGoals = await prisma.teamGoal.findMany({
      where: {
        teamId: teamId,
        isActive: true,
        ...dateFilter
      },
      include: {
        progress: {
          include: {
            teamGoal: true
          }
        }
      }
    });

    // Get team members with their progress
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

    // Calculate leaderboard with achievements
    const leaderboard = members.map(member => {
      const memberProgress = teamGoals.flatMap(goal => 
        goal.progress.filter(p => p.userId === member.userId)
      );

      const totalPercentage = memberProgress.length > 0 
        ? memberProgress.reduce((sum, p) => sum + p.percentage, 0) / memberProgress.length
        : 0;

      // Calculate achievements/badges
      const achievements = [];
      
      // Perfect completion badge
      if (memberProgress.some(p => p.percentage >= 100)) {
        achievements.push({
          id: 'perfect_completion',
          title: 'Perfect Score',
          description: 'Achieved 100% completion on a goal',
          icon: '🏆',
          color: 'gold'
        });
      }

      // Consistent performer badge
      if (memberProgress.length >= 3 && memberProgress.every(p => p.percentage >= 80)) {
        achievements.push({
          id: 'consistent_performer',
          title: 'Consistent Performer',
          description: 'Maintained 80%+ completion across all goals',
          icon: '⭐',
          color: 'blue'
        });
      }

      // Top performer badge
      const avgPercentage = totalPercentage;
      if (avgPercentage >= 90) {
        achievements.push({
          id: 'top_performer',
          title: 'Top Performer',
          description: 'Achieved 90%+ average completion',
          icon: '🥇',
          color: 'gold'
        });
      } else if (avgPercentage >= 75) {
        achievements.push({
          id: 'high_performer',
          title: 'High Performer',
          description: 'Achieved 75%+ average completion',
          icon: '🥈',
          color: 'silver'
        });
      } else if (avgPercentage >= 60) {
        achievements.push({
          id: 'good_performer',
          title: 'Good Performer',
          description: 'Achieved 60%+ average completion',
          icon: '🥉',
          color: 'bronze'
        });
      }

      return {
        userId: member.userId,
        name: member.user.name || member.user.email,
        role: member.role,
        totalPercentage: Math.round(totalPercentage * 100) / 100,
        goalProgress: memberProgress,
        achievements,
        rank: 0 // Will be set after sorting
      };
    }).sort((a, b) => b.totalPercentage - a.totalPercentage);

    // Set ranks
    leaderboard.forEach((member, index) => {
      member.rank = index + 1;
    });

    res.json({
      teamId,
      period,
      goals: teamGoals,
      leaderboard,
      summary: {
        totalMembers: leaderboard.length,
        averageCompletion: leaderboard.length > 0 
          ? leaderboard.reduce((sum, m) => sum + m.totalPercentage, 0) / leaderboard.length 
          : 0,
        topPerformer: leaderboard[0] || null,
        totalGoals: teamGoals.length,
        activeGoals: teamGoals.filter(g => g.isActive).length
      }
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Delete team goal (leader only)
router.delete('/:teamId/goals/:goalId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { teamId, goalId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if user has permission to delete goals (leaders only)
    const hasPermission = await AccessControlService.hasTeamPermission(userId, teamId, 'canDeleteGoals');
    if (!hasPermission) {
      return res.status(403).json({ error: 'Only team leaders can delete goals' });
    }

    // Get goal info for logging
    const goal = await prisma.teamGoal.findUnique({
      where: { id: goalId },
      select: { title: true }
    });

    // Soft delete by setting isActive to false
    await prisma.teamGoal.update({
      where: { id: goalId },
      data: { isActive: false }
    });

    // Log moderation action
    await AccessControlService.logModerationAction(
      teamId,
      userId,
      'delete_team_goal',
      undefined,
      { goalId, goalTitle: goal?.title }
    );

    res.json({ message: 'Team goal deleted successfully' });
  } catch (error) {
    console.error('Error deleting team goal:', error);
    res.status(500).json({ error: 'Failed to delete team goal' });
  }
});

export default router;

// Get team permissions for current user
router.get('/:teamId/permissions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { teamId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const permissions = await AccessControlService.getTeamPermissions(userId, teamId);
    if (!permissions) {
      return res.status(403).json({ error: 'Access denied to this team' });
    }

    res.json({ data: permissions });
  } catch (error) {
    console.error('Error getting team permissions:', error);
    res.status(500).json({ error: 'Failed to get team permissions' });
  }
});

// Get team moderation dashboard (leaders and deputies only)
router.get('/:teamId/moderation', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { teamId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const moderationPermissions = await AccessControlService.getTeamModerationPermissions(userId, teamId);
    if (!moderationPermissions || !moderationPermissions.canModerateContent) {
      return res.status(403).json({ error: 'Access denied to moderation features' });
    }

    // Get team analytics and member activity
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                createdAt: true
              }
            }
          },
          where: { isActive: true },
          orderBy: { joinedAt: 'desc' }
        },
        goals: {
          where: { isActive: true },
          include: {
            progress: {
              include: {
                teamGoal: true
              }
            }
          }
        }
      }
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Calculate team statistics
    const totalMembers = team.members.length;
    const activeGoals = team.goals.length;
    const recentJoins = team.members.filter(m => {
      const joinDate = new Date(m.joinedAt);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return joinDate > weekAgo;
    }).length;

    // Calculate average team performance
    const allProgress = team.goals.flatMap(goal => goal.progress);
    const averagePerformance = allProgress.length > 0 
      ? allProgress.reduce((sum, p) => sum + p.percentage, 0) / allProgress.length 
      : 0;

    const moderationData = {
      team: {
        id: team.id,
        name: team.name,
        totalMembers,
        activeGoals,
        recentJoins,
        averagePerformance: Math.round(averagePerformance * 100) / 100
      },
      members: team.members.map(member => ({
        id: member.id,
        userId: member.userId,
        name: member.user.name || member.user.email,
        email: member.user.email,
        role: member.role,
        joinedAt: member.joinedAt,
        isActive: member.isActive
      })),
      permissions: moderationPermissions
    };

    res.json({ data: moderationData });
  } catch (error) {
    console.error('Error getting team moderation data:', error);
    res.status(500).json({ error: 'Failed to get team moderation data' });
  }
});

// Moderate team member (leaders and deputies only)
router.post('/:teamId/moderate/:memberId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { teamId, memberId } = req.params;
    const { action, reason } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const hasPermission = await AccessControlService.hasTeamPermission(userId, teamId, 'canModerateContent');
    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions for moderation' });
    }

    // Get target member
    const targetMember = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!targetMember || targetMember.teamId !== teamId) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    let result;
    switch (action) {
      case 'warn':
        // For now, just log the warning. In a full implementation, you might store warnings
        await AccessControlService.logModerationAction(
          teamId,
          userId,
          'warn_member',
          targetMember.userId,
          { reason }
        );
        result = { message: 'Warning issued to member' };
        break;

      case 'remove':
        const canRemove = await AccessControlService.canManageTeamMember(
          userId, 
          targetMember.userId, 
          teamId, 
          'remove'
        );

        if (!canRemove.allowed) {
          return res.status(403).json({ error: canRemove.reason });
        }

        await prisma.teamMember.update({
          where: { id: memberId },
          data: { isActive: false }
        });

        await AccessControlService.logModerationAction(
          teamId,
          userId,
          'moderate_remove_member',
          targetMember.userId,
          { reason }
        );

        result = { message: 'Member removed from team' };
        break;

      default:
        return res.status(400).json({ error: 'Invalid moderation action' });
    }

    res.json(result);
  } catch (error) {
    console.error('Error moderating team member:', error);
    res.status(500).json({ error: 'Failed to moderate team member' });
  }
});