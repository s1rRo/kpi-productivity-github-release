import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { TeamAnalyticsService } from '../teamAnalyticsService';
import { PrismaClient } from '@prisma/client';

// Mock dependencies
vi.mock('../../index.js', () => ({
  prisma: {
    team: {
      findUnique: vi.fn()
    },
    teamMember: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    teamGoalProgress: {
      count: vi.fn(),
      upsert: vi.fn()
    },
    user: {
      findUnique: vi.fn()
    }
  }
}));

vi.mock('../analyticsService.js', () => ({
  analyticsService: {
    generateAnalyticsReport: vi.fn()
  }
}));

describe('TeamAnalyticsService', () => {
  let service: TeamAnalyticsService;
  let mockPrisma: any;

  const testTeam = {
    id: 'team-123',
    name: 'Test Team',
    description: 'A test team',
    createdAt: new Date(),
    members: [
      {
        userId: 'user-1',
        role: 'leader',
        joinedAt: new Date(),
        isActive: true,
        user: {
          id: 'user-1',
          name: 'Team Leader',
          email: 'leader@example.com'
        }
      },
      {
        userId: 'user-2',
        role: 'member',
        joinedAt: new Date(),
        isActive: true,
        user: {
          id: 'user-2',
          name: 'Team Member',
          email: 'member@example.com'
        }
      }
    ],
    goals: [
      {
        id: 'goal-1',
        title: 'Complete Project',
        targetValue: 100,
        unit: 'points',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
        progress: [
          {
            userId: 'user-1',
            currentValue: 80,
            percentage: 80,
            lastUpdated: new Date()
          },
          {
            userId: 'user-2',
            currentValue: 60,
            percentage: 60,
            lastUpdated: new Date()
          }
        ]
      }
    ]
  };

  const mockAnalyticsReport = {
    summary: {
      averageKPI: 85,
      totalHours: 120,
      completedDays: 25,
      totalDays: 30
    },
    trends: [
      {
        trend: 'improving',
        trendPercentage: 20
      }
    ]
  };

  beforeEach(() => {
    service = new TeamAnalyticsService();
    
    // Setup mock implementations
    const { prisma } = require('../../index.js');
    mockPrisma = prisma;
    
    const { analyticsService } = require('../analyticsService.js');
    analyticsService.generateAnalyticsReport.mockResolvedValue(mockAnalyticsReport);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateTeamActivitySummary', () => {
    test('should generate comprehensive team analytics', async () => {
      // Mock team access verification
      mockPrisma.teamMember.findFirst.mockResolvedValue({
        teamId: 'team-123',
        userId: 'user-1',
        role: 'leader'
      });

      // Mock team data
      mockPrisma.team.findUnique.mockResolvedValue(testTeam);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const result = await service.generateTeamActivitySummary(
        'team-123',
        startDate,
        endDate,
        'user-1'
      );

      expect(result).toMatchObject({
        teamId: 'team-123',
        teamName: 'Test Team',
        period: { start: startDate, end: endDate },
        memberCount: 2,
        activeGoals: 1,
        completedGoals: 0,
        averageTeamKPI: expect.any(Number),
        totalTeamHours: expect.any(Number),
        topPerformers: expect.any(Array),
        goalProgress: expect.any(Array),
        activityTrends: expect.any(Array),
        memberEngagement: expect.any(Array)
      });

      expect(result.topPerformers).toHaveLength(2);
      expect(result.goalProgress).toHaveLength(1);
      expect(result.topPerformers[0].rank).toBe(1);
    });

    test('should reject unauthorized access', async () => {
      // Mock no team access
      mockPrisma.teamMember.findFirst.mockResolvedValue(null);

      await expect(
        service.generateTeamActivitySummary(
          'team-123',
          new Date(),
          new Date(),
          'unauthorized-user'
        )
      ).rejects.toThrow('Access denied to team analytics');
    });

    test('should handle team not found', async () => {
      // Mock team access but team not found
      mockPrisma.teamMember.findFirst.mockResolvedValue({
        teamId: 'team-123',
        userId: 'user-1',
        role: 'member'
      });
      mockPrisma.team.findUnique.mockResolvedValue(null);

      await expect(
        service.generateTeamActivitySummary(
          'team-123',
          new Date(),
          new Date(),
          'user-1'
        )
      ).rejects.toThrow('Team not found');
    });

    test('should calculate correct team metrics', async () => {
      mockPrisma.teamMember.findFirst.mockResolvedValue({
        teamId: 'team-123',
        userId: 'user-1',
        role: 'leader'
      });
      mockPrisma.team.findUnique.mockResolvedValue(testTeam);

      const result = await service.generateTeamActivitySummary(
        'team-123',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        'user-1'
      );

      // Average KPI should be calculated from member reports
      expect(result.averageTeamKPI).toBe(85);
      
      // Total hours should be sum of all members
      expect(result.totalTeamHours).toBe(240); // 120 * 2 members
      
      // Should identify completed goals (100% progress)
      expect(result.completedGoals).toBe(0); // No goals at 100%
    });

    test('should handle analytics service errors gracefully', async () => {
      mockPrisma.teamMember.findFirst.mockResolvedValue({
        teamId: 'team-123',
        userId: 'user-1',
        role: 'leader'
      });
      mockPrisma.team.findUnique.mockResolvedValue(testTeam);

      // Mock analytics service error for one member
      const { analyticsService } = require('../analyticsService.js');
      analyticsService.generateAnalyticsReport
        .mockResolvedValueOnce(mockAnalyticsReport) // First member succeeds
        .mockRejectedValueOnce(new Error('Analytics error')); // Second member fails

      const result = await service.generateTeamActivitySummary(
        'team-123',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        'user-1'
      );

      // Should still return results with default values for failed member
      expect(result.topPerformers).toHaveLength(2);
      expect(result.topPerformers[1].averageKPI).toBe(0); // Default value for failed analytics
    });
  });

  describe('exportTeamData', () => {
    test('should export team data as JSON', async () => {
      // Mock team access with leader role
      mockPrisma.teamMember.findFirst.mockResolvedValue({
        teamId: 'team-123',
        userId: 'user-1',
        role: 'leader'
      });
      mockPrisma.team.findUnique.mockResolvedValue(testTeam);

      const result = await service.exportTeamData(
        'team-123',
        'user-1',
        'json',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result.contentType).toBe('application/json');
      expect(result.filename).toMatch(/team-test-team-export-.*\.json/);
      
      const exportData = JSON.parse(result.data);
      expect(exportData).toHaveProperty('team');
      expect(exportData).toHaveProperty('members');
      expect(exportData).toHaveProperty('goals');
      expect(exportData).toHaveProperty('analytics');
      expect(exportData).toHaveProperty('exportMetadata');
    });

    test('should export team data as CSV', async () => {
      mockPrisma.teamMember.findFirst.mockResolvedValue({
        teamId: 'team-123',
        userId: 'user-1',
        role: 'leader'
      });
      mockPrisma.team.findUnique.mockResolvedValue(testTeam);

      const result = await service.exportTeamData(
        'team-123',
        'user-1',
        'csv',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result.contentType).toBe('text/csv');
      expect(result.filename).toMatch(/team-test-team-export-.*\.csv/);
      expect(result.data).toContain('TEAM SUMMARY');
      expect(result.data).toContain('TEAM MEMBERS');
      expect(result.data).toContain('MEMBER PERFORMANCE');
      expect(result.data).toContain('TEAM GOALS');
    });

    test('should reject export for non-leader/deputy', async () => {
      // Mock regular member access
      mockPrisma.teamMember.findFirst.mockResolvedValue({
        teamId: 'team-123',
        userId: 'user-2',
        role: 'member'
      });

      await expect(
        service.exportTeamData(
          'team-123',
          'user-2',
          'json',
          new Date(),
          new Date()
        )
      ).rejects.toThrow('Only team leaders and deputies can export team data');
    });

    test('should allow deputy to export', async () => {
      mockPrisma.teamMember.findFirst.mockResolvedValue({
        teamId: 'team-123',
        userId: 'user-2',
        role: 'deputy'
      });
      mockPrisma.team.findUnique.mockResolvedValue(testTeam);

      const result = await service.exportTeamData(
        'team-123',
        'user-2',
        'json',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result.contentType).toBe('application/json');
    });
  });

  describe('Member Performance Calculation', () => {
    test('should calculate member achievements correctly', async () => {
      mockPrisma.teamMember.findFirst.mockResolvedValue({
        teamId: 'team-123',
        userId: 'user-1',
        role: 'leader'
      });
      mockPrisma.team.findUnique.mockResolvedValue(testTeam);

      // Mock high-performing analytics report
      const { analyticsService } = require('../analyticsService.js');
      analyticsService.generateAnalyticsReport.mockResolvedValue({
        summary: {
          averageKPI: 105, // High performer
          totalHours: 150, // Dedicated worker
          completedDays: 28,
          totalDays: 30 // Consistent tracker (93%)
        },
        trends: [
          {
            trend: 'improving',
            trendPercentage: 20 // Rapid improver
          }
        ]
      });

      const result = await service.generateTeamActivitySummary(
        'team-123',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        'user-1'
      );

      const topPerformer = result.topPerformers[0];
      expect(topPerformer.achievements).toContain('High Performer');
      expect(topPerformer.achievements).toContain('Consistent Tracker');
      expect(topPerformer.achievements).toContain('Rapid Improver');
      expect(topPerformer.achievements).toContain('Dedicated Worker');
    });

    test('should rank members correctly by KPI', async () => {
      mockPrisma.teamMember.findFirst.mockResolvedValue({
        teamId: 'team-123',
        userId: 'user-1',
        role: 'leader'
      });
      mockPrisma.team.findUnique.mockResolvedValue(testTeam);

      const { analyticsService } = require('../analyticsService.js');
      analyticsService.generateAnalyticsReport
        .mockResolvedValueOnce({
          summary: { averageKPI: 90, totalHours: 100, completedDays: 25, totalDays: 30 },
          trends: []
        })
        .mockResolvedValueOnce({
          summary: { averageKPI: 95, totalHours: 110, completedDays: 27, totalDays: 30 },
          trends: []
        });

      const result = await service.generateTeamActivitySummary(
        'team-123',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        'user-1'
      );

      expect(result.topPerformers[0].rank).toBe(1);
      expect(result.topPerformers[1].rank).toBe(2);
      expect(result.topPerformers[0].averageKPI).toBeGreaterThan(result.topPerformers[1].averageKPI);
    });
  });

  describe('Goal Analytics', () => {
    test('should analyze goal progress correctly', async () => {
      mockPrisma.teamMember.findFirst.mockResolvedValue({
        teamId: 'team-123',
        userId: 'user-1',
        role: 'leader'
      });
      mockPrisma.team.findUnique.mockResolvedValue(testTeam);

      const result = await service.generateTeamActivitySummary(
        'team-123',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        'user-1'
      );

      const goalAnalytics = result.goalProgress[0];
      expect(goalAnalytics.goalId).toBe('goal-1');
      expect(goalAnalytics.overallProgress).toBe(70); // (80 + 60) / 2
      expect(goalAnalytics.memberProgress).toHaveLength(2);
      expect(goalAnalytics.memberProgress[0].rank).toBe(1); // Highest percentage first
      expect(goalAnalytics.insights).toContain('Good progress on this goal. Keep up the momentum.');
    });

    test('should generate appropriate goal insights', async () => {
      mockPrisma.teamMember.findFirst.mockResolvedValue({
        teamId: 'team-123',
        userId: 'user-1',
        role: 'leader'
      });

      // Test nearly complete goal
      const nearCompleteTeam = {
        ...testTeam,
        goals: [{
          ...testTeam.goals[0],
          progress: [
            { userId: 'user-1', currentValue: 95, percentage: 95, lastUpdated: new Date() },
            { userId: 'user-2', currentValue: 90, percentage: 90, lastUpdated: new Date() }
          ]
        }]
      };
      mockPrisma.team.findUnique.mockResolvedValue(nearCompleteTeam);

      const result = await service.generateTeamActivitySummary(
        'team-123',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        'user-1'
      );

      expect(result.goalProgress[0].insights).toContain('Goal is nearly complete! Great team effort.');
    });

    test('should identify performance gaps', async () => {
      mockPrisma.teamMember.findFirst.mockResolvedValue({
        teamId: 'team-123',
        userId: 'user-1',
        role: 'leader'
      });

      // Test large performance gap
      const gapTeam = {
        ...testTeam,
        goals: [{
          ...testTeam.goals[0],
          progress: [
            { userId: 'user-1', currentValue: 90, percentage: 90, lastUpdated: new Date() },
            { userId: 'user-2', currentValue: 20, percentage: 20, lastUpdated: new Date() }
          ]
        }]
      };
      mockPrisma.team.findUnique.mockResolvedValue(gapTeam);

      const result = await service.generateTeamActivitySummary(
        'team-123',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        'user-1'
      );

      expect(result.goalProgress[0].insights).toContain('Large performance gap between members. Consider peer support.');
    });
  });

  describe('Member Engagement', () => {
    test('should calculate engagement scores correctly', async () => {
      mockPrisma.teamMember.findFirst.mockResolvedValue({
        teamId: 'team-123',
        userId: 'user-1',
        role: 'leader'
      });
      mockPrisma.team.findUnique.mockResolvedValue(testTeam);
      mockPrisma.teamGoalProgress.count.mockResolvedValue(15); // High activity

      const result = await service.generateTeamActivitySummary(
        'team-123',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        'user-1'
      );

      const engagement = result.memberEngagement[0];
      expect(engagement.engagementScore).toBeGreaterThan(0);
      expect(['highly_engaged', 'moderately_engaged', 'low_engagement', 'inactive']).toContain(engagement.status);
    });

    test('should assign correct engagement status', async () => {
      mockPrisma.teamMember.findFirst.mockResolvedValue({
        teamId: 'team-123',
        userId: 'user-1',
        role: 'leader'
      });
      mockPrisma.team.findUnique.mockResolvedValue(testTeam);
      
      // Mock high activity for first member, low for second
      mockPrisma.teamGoalProgress.count
        .mockResolvedValueOnce(25) // High activity
        .mockResolvedValueOnce(2); // Low activity

      const result = await service.generateTeamActivitySummary(
        'team-123',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        'user-1'
      );

      // Should be sorted by engagement score
      expect(result.memberEngagement[0].engagementScore).toBeGreaterThan(result.memberEngagement[1].engagementScore);
    });
  });

  describe('CSV Export Utilities', () => {
    test('should escape CSV values correctly', async () => {
      mockPrisma.teamMember.findFirst.mockResolvedValue({
        teamId: 'team-123',
        userId: 'user-1',
        role: 'leader'
      });

      const teamWithSpecialChars = {
        ...testTeam,
        name: 'Team "Special" Name, with commas',
        members: [{
          ...testTeam.members[0],
          user: {
            ...testTeam.members[0].user,
            name: 'User, with "quotes" and\nnewlines'
          }
        }]
      };
      mockPrisma.team.findUnique.mockResolvedValue(teamWithSpecialChars);

      const result = await service.exportTeamData(
        'team-123',
        'user-1',
        'csv',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      // Should properly escape special characters
      expect(result.data).toContain('"Team ""Special"" Name, with commas"');
      expect(result.data).toContain('"User, with ""quotes"" and\nnewlines"');
    });
  });

  describe('Error Handling', () => {
    test('should handle missing team gracefully', async () => {
      mockPrisma.teamMember.findFirst.mockResolvedValue({
        teamId: 'team-123',
        userId: 'user-1',
        role: 'leader'
      });
      mockPrisma.team.findUnique.mockResolvedValue(null);

      await expect(
        service.generateTeamActivitySummary(
          'team-123',
          new Date(),
          new Date(),
          'user-1'
        )
      ).rejects.toThrow('Team not found');
    });

    test('should handle database errors in export', async () => {
      mockPrisma.teamMember.findFirst.mockResolvedValue({
        teamId: 'team-123',
        userId: 'user-1',
        role: 'leader'
      });
      mockPrisma.team.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(
        service.exportTeamData(
          'team-123',
          'user-1',
          'json',
          new Date(),
          new Date()
        )
      ).rejects.toThrow('Database error');
    });
  });
});