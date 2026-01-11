import { prisma } from '../index.js';
import { analyticsService } from './analyticsService.js';

/**
 * Team Analytics Service
 * Provides analytics and reporting for team activities and goal achievements
 * Requirements: 8.5 - Team analytics and moderation
 */

export interface TeamActivitySummary {
  teamId: string;
  teamName: string;
  period: {
    start: Date;
    end: Date;
  };
  memberCount: number;
  activeGoals: number;
  completedGoals: number;
  averageTeamKPI: number;
  totalTeamHours: number;
  topPerformers: TeamMemberPerformance[];
  goalProgress: TeamGoalAnalytics[];
  activityTrends: TeamActivityTrend[];
  memberEngagement: MemberEngagementMetrics[];
}

export interface TeamMemberPerformance {
  userId: string;
  userName: string;
  role: string;
  averageKPI: number;
  totalHours: number;
  goalCompletionRate: number;
  consistencyScore: number;
  rank: number;
  achievements: string[];
}

export interface TeamGoalAnalytics {
  goalId: string;
  title: string;
  targetValue: number;
  unit: string;
  startDate: Date;
  endDate: Date;
  overallProgress: number;
  memberProgress: {
    userId: string;
    userName: string;
    currentValue: number;
    percentage: number;
    rank: number;
  }[];
  completionTrend: {
    date: Date;
    totalProgress: number;
    memberCount: number;
  }[];
  insights: string[];
}

export interface TeamActivityTrend {
  date: Date;
  activeMembers: number;
  averageKPI: number;
  totalHours: number;
  goalsUpdated: number;
  newMembers: number;
}

export interface MemberEngagementMetrics {
  userId: string;
  userName: string;
  joinedAt: Date;
  lastActive: Date;
  daysActive: number;
  goalUpdatesCount: number;
  engagementScore: number; // 0-100
  status: 'highly_engaged' | 'moderately_engaged' | 'low_engagement' | 'inactive';
}

export interface TeamExportData {
  team: {
    id: string;
    name: string;
    description?: string;
    memberCount: number;
    createdAt: Date;
  };
  members: {
    userId: string;
    userName: string;
    email: string;
    role: string;
    joinedAt: Date;
    isActive: boolean;
  }[];
  goals: {
    id: string;
    title: string;
    description?: string;
    targetValue: number;
    unit: string;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
    progress: {
      userId: string;
      userName: string;
      currentValue: number;
      percentage: number;
      lastUpdated: Date;
    }[];
  }[];
  analytics: TeamActivitySummary;
  exportMetadata: {
    exportedAt: Date;
    exportedBy: string;
    period: {
      start: Date;
      end: Date;
    };
    format: string;
  };
}

export class TeamAnalyticsService {

  /**
   * Generate comprehensive team activity analytics
   */
  async generateTeamActivitySummary(
    teamId: string,
    startDate: Date,
    endDate: Date,
    requestUserId: string
  ): Promise<TeamActivitySummary> {
    // Verify user has access to team
    const membership = await this.verifyTeamAccess(teamId, requestUserId);
    if (!membership) {
      throw new Error('Access denied to team analytics');
    }

    // Get team basic info
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          where: { isActive: true },
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        goals: {
          where: { isActive: true },
          include: {
            progress: true
          }
        }
      }
    });

    if (!team) {
      throw new Error('Team not found');
    }

    // Calculate member performance
    const memberPerformance = await this.calculateMemberPerformance(
      team.members,
      startDate,
      endDate
    );

    // Analyze team goals
    const goalAnalytics = await this.analyzeTeamGoals(team.goals, startDate, endDate);

    // Calculate activity trends
    const activityTrends = await this.calculateActivityTrends(teamId, startDate, endDate);

    // Calculate member engagement
    const memberEngagement = await this.calculateMemberEngagement(team.members, startDate, endDate);

    // Calculate team-wide metrics
    const averageTeamKPI = memberPerformance.length > 0
      ? memberPerformance.reduce((sum, m) => sum + m.averageKPI, 0) / memberPerformance.length
      : 0;

    const totalTeamHours = memberPerformance.reduce((sum, m) => sum + m.totalHours, 0);

    const completedGoals = team.goals.filter(goal => {
      const avgProgress = goal.progress.length > 0
        ? goal.progress.reduce((sum, p) => sum + p.percentage, 0) / goal.progress.length
        : 0;
      return avgProgress >= 100;
    }).length;

    return {
      teamId: team.id,
      teamName: team.name,
      period: { start: startDate, end: endDate },
      memberCount: team.members.length,
      activeGoals: team.goals.length,
      completedGoals,
      averageTeamKPI: Math.round(averageTeamKPI * 100) / 100,
      totalTeamHours: Math.round(totalTeamHours * 100) / 100,
      topPerformers: memberPerformance.slice(0, 5),
      goalProgress: goalAnalytics,
      activityTrends,
      memberEngagement
    };
  }

  /**
   * Calculate individual member performance within team context
   */
  private async calculateMemberPerformance(
    members: any[],
    startDate: Date,
    endDate: Date
  ): Promise<TeamMemberPerformance[]> {
    const performances: TeamMemberPerformance[] = [];

    for (const member of members) {
      try {
        // Get member's personal analytics
        const memberReport = await analyticsService.generateAnalyticsReport(
          member.userId,
          startDate,
          endDate,
          'month'
        );

        // Calculate goal completion rate (team goals)
        const goalCompletionRate = 0; // Will be calculated based on team goal progress

        // Calculate consistency score based on daily activity
        const consistencyScore = memberReport.summary.completedDays / memberReport.summary.totalDays * 100;

        // Generate achievements
        const achievements = this.generateMemberAchievements(memberReport);

        performances.push({
          userId: member.userId,
          userName: member.user.name || member.user.email,
          role: member.role,
          averageKPI: memberReport.summary.averageKPI,
          totalHours: memberReport.summary.totalHours,
          goalCompletionRate,
          consistencyScore: Math.round(consistencyScore * 100) / 100,
          rank: 0, // Will be set after sorting
          achievements
        });
      } catch (error) {
        console.error(`Error calculating performance for member ${member.userId}:`, error);
        // Add member with default values if analytics fail
        performances.push({
          userId: member.userId,
          userName: member.user.name || member.user.email,
          role: member.role,
          averageKPI: 0,
          totalHours: 0,
          goalCompletionRate: 0,
          consistencyScore: 0,
          rank: 0,
          achievements: []
        });
      }
    }

    // Sort by average KPI and set ranks
    performances.sort((a, b) => b.averageKPI - a.averageKPI);
    performances.forEach((perf, index) => {
      perf.rank = index + 1;
    });

    return performances;
  }

  /**
   * Analyze team goals progress and trends
   */
  private async analyzeTeamGoals(
    goals: any[],
    startDate: Date,
    endDate: Date
  ): Promise<TeamGoalAnalytics[]> {
    const goalAnalytics: TeamGoalAnalytics[] = [];

    for (const goal of goals) {
      // Calculate overall progress
      const overallProgress = goal.progress.length > 0
        ? goal.progress.reduce((sum: number, p: any) => sum + p.percentage, 0) / goal.progress.length
        : 0;

      // Sort member progress by percentage
      const memberProgress = goal.progress
        .map((p: any, index: number) => ({
          userId: p.userId,
          userName: `Member ${index + 1}`, // Would need to join with user data
          currentValue: p.currentValue,
          percentage: p.percentage,
          rank: 0
        }))
        .sort((a: any, b: any) => b.percentage - a.percentage)
        .map((p: any, index: number) => ({ ...p, rank: index + 1 }));

      // Generate completion trend (simplified - would need historical data)
      const completionTrend = [{
        date: new Date(),
        totalProgress: overallProgress,
        memberCount: goal.progress.length
      }];

      // Generate insights
      const insights = this.generateGoalInsights(goal, overallProgress, memberProgress);

      goalAnalytics.push({
        goalId: goal.id,
        title: goal.title,
        targetValue: goal.targetValue,
        unit: goal.unit,
        startDate: goal.startDate,
        endDate: goal.endDate,
        overallProgress: Math.round(overallProgress * 100) / 100,
        memberProgress,
        completionTrend,
        insights
      });
    }

    return goalAnalytics;
  }

  /**
   * Calculate team activity trends over time
   */
  private async calculateActivityTrends(
    teamId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TeamActivityTrend[]> {
    // This would require historical tracking of team activities
    // For now, return a simplified trend
    const trends: TeamActivityTrend[] = [];
    
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    for (let i = 0; i <= daysDiff; i += 7) { // Weekly trends
      const trendDate = new Date(startDate);
      trendDate.setDate(startDate.getDate() + i);
      
      trends.push({
        date: trendDate,
        activeMembers: 0, // Would calculate from actual activity data
        averageKPI: 0,
        totalHours: 0,
        goalsUpdated: 0,
        newMembers: 0
      });
    }

    return trends;
  }

  /**
   * Calculate member engagement metrics
   */
  private async calculateMemberEngagement(
    members: any[],
    startDate: Date,
    endDate: Date
  ): Promise<MemberEngagementMetrics[]> {
    const engagement: MemberEngagementMetrics[] = [];

    for (const member of members) {
      // Calculate engagement score based on various factors
      const daysSinceJoined = Math.ceil((new Date().getTime() - member.joinedAt.getTime()) / (1000 * 60 * 60 * 24));
      const daysActive = Math.min(daysSinceJoined, 30); // Simplified calculation
      
      // Get goal updates count (simplified)
      const goalUpdatesCount = await prisma.teamGoalProgress.count({
        where: {
          userId: member.userId,
          lastUpdated: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      // Calculate engagement score
      let engagementScore = 0;
      if (daysActive > 0) {
        engagementScore += Math.min((goalUpdatesCount / daysActive) * 50, 50); // Activity frequency
        engagementScore += Math.min(daysActive / 30 * 30, 30); // Consistency
        engagementScore += member.role === 'leader' ? 20 : member.role === 'deputy' ? 10 : 0; // Role bonus
      }

      // Determine engagement status
      let status: MemberEngagementMetrics['status'];
      if (engagementScore >= 80) status = 'highly_engaged';
      else if (engagementScore >= 60) status = 'moderately_engaged';
      else if (engagementScore >= 30) status = 'low_engagement';
      else status = 'inactive';

      engagement.push({
        userId: member.userId,
        userName: member.user.name || member.user.email,
        joinedAt: member.joinedAt,
        lastActive: new Date(), // Would track actual last activity
        daysActive,
        goalUpdatesCount,
        engagementScore: Math.round(engagementScore),
        status
      });
    }

    return engagement.sort((a, b) => b.engagementScore - a.engagementScore);
  }

  /**
   * Generate member achievements based on performance
   */
  private generateMemberAchievements(memberReport: any): string[] {
    const achievements: string[] = [];

    if (memberReport.summary.averageKPI >= 100) {
      achievements.push('High Performer');
    }

    if (memberReport.summary.completedDays / memberReport.summary.totalDays >= 0.9) {
      achievements.push('Consistent Tracker');
    }

    if (memberReport.trends.some((t: any) => t.trend === 'improving' && t.trendPercentage > 15)) {
      achievements.push('Rapid Improver');
    }

    if (memberReport.summary.totalHours >= 100) {
      achievements.push('Dedicated Worker');
    }

    return achievements;
  }

  /**
   * Generate insights for team goals
   */
  private generateGoalInsights(goal: any, overallProgress: number, memberProgress: any[]): string[] {
    const insights: string[] = [];

    if (overallProgress >= 90) {
      insights.push('Goal is nearly complete! Great team effort.');
    } else if (overallProgress >= 70) {
      insights.push('Good progress on this goal. Keep up the momentum.');
    } else if (overallProgress < 30) {
      insights.push('This goal needs more attention. Consider team discussion.');
    }

    if (memberProgress.length > 0) {
      const topPerformer = memberProgress[0];
      const bottomPerformer = memberProgress[memberProgress.length - 1];
      
      if (topPerformer.percentage - bottomPerformer.percentage > 50) {
        insights.push('Large performance gap between members. Consider peer support.');
      }
    }

    const daysRemaining = Math.ceil((goal.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (daysRemaining < 7 && overallProgress < 80) {
      insights.push('Goal deadline approaching with low completion. Urgent action needed.');
    }

    return insights;
  }

  /**
   * Export team data in specified format
   */
  async exportTeamData(
    teamId: string,
    requestUserId: string,
    format: 'json' | 'csv',
    startDate: Date,
    endDate: Date
  ): Promise<{ data: string; filename: string; contentType: string }> {
    // Verify user has permission to export team data
    const membership = await this.verifyTeamAccess(teamId, requestUserId);
    if (!membership || (membership.role !== 'leader' && membership.role !== 'deputy')) {
      throw new Error('Only team leaders and deputies can export team data');
    }

    // Gather team data
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          where: { isActive: true },
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        goals: {
          where: { isActive: true },
          include: {
            progress: true
          }
        }
      }
    });

    if (!team) {
      throw new Error('Team not found');
    }

    // Get analytics
    const analytics = await this.generateTeamActivitySummary(teamId, startDate, endDate, requestUserId);

    // Prepare export data
    const exportData: TeamExportData = {
      team: {
        id: team.id,
        name: team.name,
        description: team.description || undefined,
        memberCount: team.members.length,
        createdAt: team.createdAt
      },
      members: team.members.map(member => ({
        userId: member.userId,
        userName: member.user.name || member.user.email,
        email: member.user.email,
        role: member.role,
        joinedAt: member.joinedAt,
        isActive: member.isActive
      })),
      goals: team.goals.map(goal => ({
        id: goal.id,
        title: goal.title,
        description: goal.description || undefined,
        targetValue: goal.targetValue,
        unit: goal.unit,
        startDate: goal.startDate,
        endDate: goal.endDate,
        isActive: goal.isActive,
        progress: goal.progress.map(p => ({
          userId: p.userId,
          userName: team.members.find(m => m.userId === p.userId)?.user.name || 'Unknown',
          currentValue: p.currentValue,
          percentage: p.percentage,
          lastUpdated: p.lastUpdated
        }))
      })),
      analytics,
      exportMetadata: {
        exportedAt: new Date(),
        exportedBy: requestUserId,
        period: { start: startDate, end: endDate },
        format
      }
    };

    if (format === 'json') {
      return this.exportTeamAsJSON(exportData, team.name, startDate, endDate);
    } else {
      return this.exportTeamAsCSV(exportData, team.name, startDate, endDate);
    }
  }

  /**
   * Export team data as JSON
   */
  private exportTeamAsJSON(
    exportData: TeamExportData,
    teamName: string,
    startDate: Date,
    endDate: Date
  ): { data: string; filename: string; contentType: string } {
    const jsonData = JSON.stringify(exportData, null, 2);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    const filename = `team-${teamName.replace(/\s+/g, '-').toLowerCase()}-export-${startStr}-to-${endStr}.json`;

    return {
      data: jsonData,
      filename,
      contentType: 'application/json'
    };
  }

  /**
   * Export team data as CSV
   */
  private exportTeamAsCSV(
    exportData: TeamExportData,
    teamName: string,
    startDate: Date,
    endDate: Date
  ): { data: string; filename: string; contentType: string } {
    let csvData = '';

    // Header
    csvData += `Team Analytics Export: ${exportData.team.name}\n`;
    csvData += `Export Date: ${exportData.exportMetadata.exportedAt.toISOString()}\n`;
    csvData += `Period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}\n\n`;

    // Team Summary
    csvData += 'TEAM SUMMARY\n';
    csvData += `Name: ${exportData.team.name}\n`;
    csvData += `Members: ${exportData.team.memberCount}\n`;
    csvData += `Active Goals: ${exportData.analytics.activeGoals}\n`;
    csvData += `Completed Goals: ${exportData.analytics.completedGoals}\n`;
    csvData += `Average Team KPI: ${exportData.analytics.averageTeamKPI}\n`;
    csvData += `Total Team Hours: ${exportData.analytics.totalTeamHours}\n\n`;

    // Members
    csvData += 'TEAM MEMBERS\n';
    csvData += 'Name,Email,Role,Joined Date,Status\n';
    exportData.members.forEach(member => {
      csvData += `${this.escapeCsvValue(member.userName)},${member.email},${member.role},${member.joinedAt.toISOString().split('T')[0]},${member.isActive ? 'Active' : 'Inactive'}\n`;
    });
    csvData += '\n';

    // Member Performance
    csvData += 'MEMBER PERFORMANCE\n';
    csvData += 'Name,Role,Average KPI,Total Hours,Consistency Score,Rank\n';
    exportData.analytics.topPerformers.forEach(perf => {
      csvData += `${this.escapeCsvValue(perf.userName)},${perf.role},${perf.averageKPI},${perf.totalHours},${perf.consistencyScore}%,${perf.rank}\n`;
    });
    csvData += '\n';

    // Goals
    csvData += 'TEAM GOALS\n';
    csvData += 'Title,Target Value,Unit,Start Date,End Date,Overall Progress,Status\n';
    exportData.goals.forEach(goal => {
      const goalAnalytics = exportData.analytics.goalProgress.find(g => g.goalId === goal.id);
      csvData += `${this.escapeCsvValue(goal.title)},${goal.targetValue},${goal.unit},${goal.startDate.toISOString().split('T')[0]},${goal.endDate.toISOString().split('T')[0]},${goalAnalytics?.overallProgress || 0}%,${goal.isActive ? 'Active' : 'Inactive'}\n`;
    });
    csvData += '\n';

    // Goal Progress Details
    csvData += 'GOAL PROGRESS DETAILS\n';
    csvData += 'Goal Title,Member Name,Current Value,Percentage,Last Updated\n';
    exportData.goals.forEach(goal => {
      goal.progress.forEach(progress => {
        csvData += `${this.escapeCsvValue(goal.title)},${this.escapeCsvValue(progress.userName)},${progress.currentValue},${progress.percentage}%,${progress.lastUpdated.toISOString().split('T')[0]}\n`;
      });
    });

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    const filename = `team-${teamName.replace(/\s+/g, '-').toLowerCase()}-export-${startStr}-to-${endStr}.csv`;

    return {
      data: csvData,
      filename,
      contentType: 'text/csv'
    };
  }

  /**
   * Escape CSV values
   */
  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Verify user has access to team
   */
  private async verifyTeamAccess(teamId: string, userId: string) {
    return await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
        isActive: true
      }
    });
  }
}

// Export singleton instance
export const teamAnalyticsService = new TeamAnalyticsService();