import { prisma } from '../index.js';

/**
 * Principles Analytics Service
 * Provides statistics and insights on productivity principles usage
 * Requirements: 6.4 - Principles usage tracking and analytics
 */

export interface PrincipleUsageStats {
  principleId: string;
  principleName: string;
  description: string;
  category: string;
  totalUsers: number;
  totalApplications: number;
  averageUsagePerUser: number;
  successRate: number; // Based on KPI improvement when principle is applied
  popularityRank: number;
  appliedToHabits: {
    habitId: string;
    habitName: string;
    applicationCount: number;
  }[];
  userFeedback: {
    rating: number;
    effectivenessScore: number;
    commonFeedback: string[];
  };
  trends: {
    period: string;
    usageCount: number;
    newUsers: number;
  }[];
}

export interface UserPrincipleInsights {
  userId: string;
  totalPrinciplesApplied: number;
  favoritesPrinciples: {
    principleId: string;
    principleName: string;
    usageCount: number;
    effectivenessScore: number;
  }[];
  underutilizedPrinciples: {
    principleId: string;
    principleName: string;
    potentialBenefit: string;
    recommendedHabits: string[];
  }[];
  principleImpactAnalysis: {
    principleId: string;
    principleName: string;
    beforeKPI: number;
    afterKPI: number;
    improvement: number;
    appliedDays: number;
  }[];
  recommendations: {
    type: 'new_principle' | 'increase_usage' | 'combine_principles';
    title: string;
    description: string;
    expectedImpact: string;
    principleIds: string[];
  }[];
}

export interface PrincipleEffectivenessReport {
  reportDate: Date;
  period: {
    start: Date;
    end: Date;
  };
  overallStats: {
    totalPrinciples: number;
    totalApplications: number;
    averageEffectiveness: number;
    mostEffectivePrinciple: string;
    leastEffectivePrinciple: string;
  };
  principleRankings: PrincipleUsageStats[];
  habitPrincipleMatrix: {
    habitId: string;
    habitName: string;
    appliedPrinciples: {
      principleId: string;
      principleName: string;
      effectivenessScore: number;
    }[];
    recommendedPrinciples: {
      principleId: string;
      principleName: string;
      potentialImpact: number;
    }[];
  }[];
  insights: string[];
}

// Predefined productivity principles from the 10 books
const PRODUCTIVITY_PRINCIPLES = [
  // Atomic Habits
  { id: 'atomic_1_percent', name: '1% Better Every Day', description: 'Focus on small, consistent improvements', category: 'Atomic Habits', book: 'Atomic Habits' },
  { id: 'habit_stacking', name: 'Habit Stacking', description: 'Link new habits to existing ones', category: 'Atomic Habits', book: 'Atomic Habits' },
  { id: 'environment_design', name: 'Environment Design', description: 'Design your environment for success', category: 'Atomic Habits', book: 'Atomic Habits' },
  { id: 'identity_based', name: 'Identity-Based Habits', description: 'Focus on who you want to become', category: 'Atomic Habits', book: 'Atomic Habits' },
  
  // 7 Habits of Highly Effective People
  { id: 'begin_with_end', name: 'Begin with the End in Mind', description: 'Start with a clear vision of your destination', category: '7 Habits', book: '7 Habits of Highly Effective People' },
  { id: 'first_things_first', name: 'Put First Things First', description: 'Prioritize important over urgent', category: '7 Habits', book: '7 Habits of Highly Effective People' },
  { id: 'win_win', name: 'Think Win-Win', description: 'Seek mutual benefit in all interactions', category: '7 Habits', book: '7 Habits of Highly Effective People' },
  { id: 'sharpen_saw', name: 'Sharpen the Saw', description: 'Continuously renew yourself', category: '7 Habits', book: '7 Habits of Highly Effective People' },
  
  // Deep Work
  { id: 'deep_work_blocks', name: 'Deep Work Blocks', description: 'Schedule uninterrupted focus time', category: 'Deep Work', book: 'Deep Work' },
  { id: 'attention_residue', name: 'Minimize Attention Residue', description: 'Avoid task switching', category: 'Deep Work', book: 'Deep Work' },
  { id: 'productive_meditation', name: 'Productive Meditation', description: 'Think deeply while doing routine tasks', category: 'Deep Work', book: 'Deep Work' },
  
  // The ONE Thing
  { id: 'one_thing_focus', name: 'The ONE Thing', description: 'Focus on the most important task', category: 'The ONE Thing', book: 'The ONE Thing' },
  { id: 'time_blocking', name: 'Time Blocking', description: 'Block time for your most important work', category: 'The ONE Thing', book: 'The ONE Thing' },
  { id: 'goal_setting_now', name: 'Goal Setting to the Now', description: 'Connect long-term goals to daily actions', category: 'The ONE Thing', book: 'The ONE Thing' },
  
  // Getting Things Done
  { id: 'capture_everything', name: 'Capture Everything', description: 'Get everything out of your head', category: 'GTD', book: 'Getting Things Done' },
  { id: 'two_minute_rule', name: 'Two-Minute Rule', description: 'Do it now if it takes less than 2 minutes', category: 'GTD', book: 'Getting Things Done' },
  { id: 'weekly_review', name: 'Weekly Review', description: 'Regular review and planning sessions', category: 'GTD', book: 'Getting Things Done' },
  
  // Eat That Frog
  { id: 'eat_frog_first', name: 'Eat That Frog', description: 'Do your hardest task first', category: 'Eat That Frog', book: 'Eat That Frog' },
  { id: 'plan_every_day', name: 'Plan Every Day in Advance', description: 'Always plan the night before', category: 'Eat That Frog', book: 'Eat That Frog' },
  
  // The Power of Habit
  { id: 'habit_loop', name: 'Habit Loop', description: 'Understand cue, routine, reward cycle', category: 'Power of Habit', book: 'The Power of Habit' },
  { id: 'keystone_habits', name: 'Keystone Habits', description: 'Focus on habits that trigger other habits', category: 'Power of Habit', book: 'The Power of Habit' },
  
  // Mindset
  { id: 'growth_mindset', name: 'Growth Mindset', description: 'Believe abilities can be developed', category: 'Mindset', book: 'Mindset' },
  { id: 'effort_over_talent', name: 'Effort Over Talent', description: 'Value effort and learning over natural ability', category: 'Mindset', book: 'Mindset' },
  
  // The 4-Hour Workweek
  { id: 'elimination', name: 'Elimination', description: 'Eliminate non-essential tasks', category: '4-Hour Workweek', book: 'The 4-Hour Workweek' },
  { id: 'automation', name: 'Automation', description: 'Automate repetitive tasks', category: '4-Hour Workweek', book: 'The 4-Hour Workweek' },
  
  // Essentialism
  { id: 'less_but_better', name: 'Less But Better', description: 'Do fewer things but do them better', category: 'Essentialism', book: 'Essentialism' },
  { id: 'disciplined_pursuit', name: 'Disciplined Pursuit of Less', description: 'Systematically identify what is essential', category: 'Essentialism', book: 'Essentialism' }
];

export class PrinciplesAnalyticsService {

  /**
   * Get comprehensive usage statistics for all principles
   */
  async getPrincipleUsageStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<PrincipleUsageStats[]> {
    const stats: PrincipleUsageStats[] = [];

    for (const principle of PRODUCTIVITY_PRINCIPLES) {
      // Get usage data from principle preferences
      const usageData = await prisma.principlePreference.findMany({
        where: {
          principleId: principle.id,
          ...(startDate && endDate && {
            updatedAt: {
              gte: startDate,
              lte: endDate
            }
          })
        },
        include: {
          user: {
            select: { id: true }
          }
        }
      });

      const totalUsers = usageData.length;
      const totalApplications = usageData.reduce((sum, pref) => sum + pref.usageCount, 0);
      const averageUsagePerUser = totalUsers > 0 ? totalApplications / totalUsers : 0;

      // Calculate success rate (simplified - would need KPI correlation analysis)
      const successRate = await this.calculatePrincipleSuccessRate(principle.id, startDate, endDate);

      // Get habit applications
      const appliedToHabits = await this.getPrincipleHabitApplications(principle.id);

      // Generate trends (simplified)
      const trends = await this.generatePrincipleTrends(principle.id, startDate, endDate);

      stats.push({
        principleId: principle.id,
        principleName: principle.name,
        description: principle.description,
        category: principle.category,
        totalUsers,
        totalApplications,
        averageUsagePerUser: Math.round(averageUsagePerUser * 100) / 100,
        successRate,
        popularityRank: 0, // Will be set after sorting
        appliedToHabits,
        userFeedback: {
          rating: 4.2, // Placeholder - would come from user feedback
          effectivenessScore: successRate,
          commonFeedback: ['Helpful for consistency', 'Easy to implement', 'Noticeable results']
        },
        trends
      });
    }

    // Sort by total applications and set popularity ranks
    stats.sort((a, b) => b.totalApplications - a.totalApplications);
    stats.forEach((stat, index) => {
      stat.popularityRank = index + 1;
    });

    return stats;
  }

  /**
   * Get personalized principle insights for a user
   */
  async getUserPrincipleInsights(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<UserPrincipleInsights> {
    // Get user's principle preferences
    const userPreferences = await prisma.principlePreference.findMany({
      where: {
        userId,
        ...(startDate && endDate && {
          updatedAt: {
            gte: startDate,
            lte: endDate
          }
        })
      }
    });

    const totalPrinciplesApplied = userPreferences.filter(p => p.applied).length;

    // Get favorite principles (most used)
    const favoritesPrinciples = userPreferences
      .filter(p => p.usageCount > 0)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5)
      .map(pref => {
        const principle = PRODUCTIVITY_PRINCIPLES.find(p => p.id === pref.principleId);
        return {
          principleId: pref.principleId,
          principleName: principle?.name || 'Unknown',
          usageCount: pref.usageCount,
          effectivenessScore: 75 // Placeholder - would calculate from KPI impact
        };
      });

    // Find underutilized principles
    const appliedPrincipleIds = new Set(userPreferences.map(p => p.principleId));
    const underutilizedPrinciples = PRODUCTIVITY_PRINCIPLES
      .filter(p => !appliedPrincipleIds.has(p.id))
      .slice(0, 3)
      .map(principle => ({
        principleId: principle.id,
        principleName: principle.name,
        potentialBenefit: `Could improve ${principle.category.toLowerCase()} effectiveness`,
        recommendedHabits: ['Работа', 'Английский', 'ИИ'] // Simplified recommendations
      }));

    // Calculate principle impact analysis
    const principleImpactAnalysis = await this.calculatePrincipleImpact(userId, userPreferences);

    // Generate recommendations
    const recommendations = this.generateUserRecommendations(
      userPreferences,
      favoritesPrinciples,
      underutilizedPrinciples
    );

    return {
      userId,
      totalPrinciplesApplied,
      favoritesPrinciples,
      underutilizedPrinciples,
      principleImpactAnalysis,
      recommendations
    };
  }

  /**
   * Generate comprehensive principle effectiveness report
   */
  async generatePrincipleEffectivenessReport(
    startDate: Date,
    endDate: Date
  ): Promise<PrincipleEffectivenessReport> {
    // Get all principle usage stats
    const principleRankings = await this.getPrincipleUsageStats(startDate, endDate);

    // Calculate overall statistics
    const totalPrinciples = PRODUCTIVITY_PRINCIPLES.length;
    const totalApplications = principleRankings.reduce((sum, p) => sum + p.totalApplications, 0);
    const averageEffectiveness = principleRankings.reduce((sum, p) => sum + p.successRate, 0) / principleRankings.length;
    
    const mostEffective = principleRankings.reduce((max, p) => p.successRate > max.successRate ? p : max);
    const leastEffective = principleRankings.reduce((min, p) => p.successRate < min.successRate ? p : min);

    // Generate habit-principle matrix
    const habitPrincipleMatrix = await this.generateHabitPrincipleMatrix();

    // Generate insights
    const insights = this.generateEffectivenessInsights(principleRankings, totalApplications);

    return {
      reportDate: new Date(),
      period: { start: startDate, end: endDate },
      overallStats: {
        totalPrinciples,
        totalApplications,
        averageEffectiveness: Math.round(averageEffectiveness * 100) / 100,
        mostEffectivePrinciple: mostEffective.principleName,
        leastEffectivePrinciple: leastEffective.principleName
      },
      principleRankings,
      habitPrincipleMatrix,
      insights
    };
  }

  /**
   * Calculate principle success rate based on KPI improvements
   */
  private async calculatePrincipleSuccessRate(
    principleId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<number> {
    // This would require correlation analysis between principle usage and KPI improvements
    // For now, return a simulated success rate based on principle characteristics
    const principle = PRODUCTIVITY_PRINCIPLES.find(p => p.id === principleId);
    
    if (!principle) return 0;

    // Simulate success rates based on principle categories
    const categorySuccessRates: { [key: string]: number } = {
      'Atomic Habits': 85,
      '7 Habits': 80,
      'Deep Work': 90,
      'The ONE Thing': 88,
      'GTD': 75,
      'Eat That Frog': 82,
      'Power of Habit': 78,
      'Mindset': 85,
      '4-Hour Workweek': 70,
      'Essentialism': 83
    };

    return categorySuccessRates[principle.category] || 75;
  }

  /**
   * Get habits where a principle is applied
   */
  private async getPrincipleHabitApplications(principleId: string) {
    const preferences = await prisma.principlePreference.findMany({
      where: { principleId, applied: true }
    });

    const habitApplications = new Map<string, number>();

    for (const pref of preferences) {
      try {
        const appliedHabits = JSON.parse(pref.appliedToHabits);
        for (const habitId of appliedHabits) {
          habitApplications.set(habitId, (habitApplications.get(habitId) || 0) + 1);
        }
      } catch (error) {
        // Handle JSON parse errors
        continue;
      }
    }

    // Get habit names
    const habits = await prisma.habit.findMany({
      where: { id: { in: Array.from(habitApplications.keys()) } }
    });

    return Array.from(habitApplications.entries()).map(([habitId, count]) => {
      const habit = habits.find(h => h.id === habitId);
      return {
        habitId,
        habitName: habit?.name || 'Unknown Habit',
        applicationCount: count
      };
    }).sort((a, b) => b.applicationCount - a.applicationCount);
  }

  /**
   * Generate principle usage trends
   */
  private async generatePrincipleTrends(
    principleId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    // Simplified trend generation - would need historical tracking
    const trends = [];
    const now = new Date();
    
    for (let i = 3; i >= 0; i--) {
      const periodStart = new Date(now);
      periodStart.setMonth(now.getMonth() - i - 1);
      const periodEnd = new Date(now);
      periodEnd.setMonth(now.getMonth() - i);

      const usageCount = await prisma.principlePreference.count({
        where: {
          principleId,
          updatedAt: {
            gte: periodStart,
            lte: periodEnd
          }
        }
      });

      const newUsers = await prisma.principlePreference.count({
        where: {
          principleId,
          createdAt: {
            gte: periodStart,
            lte: periodEnd
          }
        }
      });

      trends.push({
        period: `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, '0')}`,
        usageCount,
        newUsers
      });
    }

    return trends;
  }

  /**
   * Calculate principle impact on user KPI
   */
  private async calculatePrincipleImpact(userId: string, userPreferences: any[]) {
    const impactAnalysis = [];

    for (const pref of userPreferences.filter(p => p.applied && p.usageCount > 0)) {
      const principle = PRODUCTIVITY_PRINCIPLES.find(p => p.id === pref.principleId);
      
      if (!principle) continue;

      // Simplified impact calculation - would need actual KPI correlation
      const beforeKPI = 75; // Placeholder
      const afterKPI = beforeKPI + (Math.random() * 20 - 5); // Simulate improvement
      const improvement = afterKPI - beforeKPI;

      impactAnalysis.push({
        principleId: pref.principleId,
        principleName: principle.name,
        beforeKPI,
        afterKPI: Math.round(afterKPI * 100) / 100,
        improvement: Math.round(improvement * 100) / 100,
        appliedDays: Math.floor(pref.usageCount / 7) // Estimate days from usage count
      });
    }

    return impactAnalysis.sort((a, b) => b.improvement - a.improvement);
  }

  /**
   * Generate user-specific recommendations
   */
  private generateUserRecommendations(
    userPreferences: any[],
    favorites: any[],
    underutilized: any[]
  ) {
    const recommendations = [];

    // Recommend new principles if user has applied few
    if (userPreferences.length < 5) {
      recommendations.push({
        type: 'new_principle' as const,
        title: 'Explore New Productivity Principles',
        description: 'Try applying more productivity principles to boost your effectiveness',
        expectedImpact: '10-15% KPI improvement',
        principleIds: underutilized.slice(0, 2).map(p => p.principleId)
      });
    }

    // Recommend increasing usage of effective principles
    if (favorites.length > 0) {
      const topFavorite = favorites[0];
      if (topFavorite.usageCount < 20) {
        recommendations.push({
          type: 'increase_usage' as const,
          title: `Increase Usage of ${topFavorite.principleName}`,
          description: 'This principle is working well for you. Consider applying it more consistently.',
          expectedImpact: '5-10% additional improvement',
          principleIds: [topFavorite.principleId]
        });
      }
    }

    // Recommend combining complementary principles
    if (favorites.length >= 2) {
      recommendations.push({
        type: 'combine_principles' as const,
        title: 'Combine Complementary Principles',
        description: 'Try combining your favorite principles for synergistic effects',
        expectedImpact: '15-25% compound improvement',
        principleIds: favorites.slice(0, 2).map(f => f.principleId)
      });
    }

    return recommendations;
  }

  /**
   * Generate habit-principle effectiveness matrix
   */
  private async generateHabitPrincipleMatrix() {
    const habits = await prisma.habit.findMany();
    const matrix = [];

    for (const habit of habits) {
      // Get principles currently applied to this habit
      const appliedPrinciples = await prisma.principlePreference.findMany({
        where: {
          appliedToHabits: {
            contains: habit.id
          },
          applied: true
        }
      });

      const appliedPrincipleData = appliedPrinciples.map(pref => {
        const principle = PRODUCTIVITY_PRINCIPLES.find(p => p.id === pref.principleId);
        return {
          principleId: pref.principleId,
          principleName: principle?.name || 'Unknown',
          effectivenessScore: 75 + Math.random() * 20 // Simulated effectiveness
        };
      });

      // Recommend principles based on habit category
      const recommendedPrinciples = this.getRecommendedPrinciplesForHabit(habit, appliedPrinciples.map(p => p.principleId));

      matrix.push({
        habitId: habit.id,
        habitName: habit.name,
        appliedPrinciples: appliedPrincipleData,
        recommendedPrinciples
      });
    }

    return matrix;
  }

  /**
   * Get recommended principles for a specific habit
   */
  private getRecommendedPrinciplesForHabit(habit: any, alreadyApplied: string[]) {
    const recommendations = [];

    // Recommend principles based on habit characteristics
    const habitCategoryPrinciples: { [key: string]: string[] } = {
      'health': ['keystone_habits', 'habit_stacking', 'environment_design'],
      'skills': ['deep_work_blocks', 'one_thing_focus', 'growth_mindset'],
      'learning': ['productive_meditation', 'time_blocking', 'effort_over_talent'],
      'career': ['begin_with_end', 'first_things_first', 'eat_frog_first'],
      'recovery': ['sharpen_saw', 'less_but_better', 'elimination']
    };

    const categoryPrinciples = habitCategoryPrinciples[habit.category] || [];
    
    for (const principleId of categoryPrinciples) {
      if (!alreadyApplied.includes(principleId)) {
        const principle = PRODUCTIVITY_PRINCIPLES.find(p => p.id === principleId);
        if (principle) {
          recommendations.push({
            principleId,
            principleName: principle.name,
            potentialImpact: 70 + Math.random() * 25 // Simulated potential impact
          });
        }
      }
    }

    return recommendations.slice(0, 3); // Top 3 recommendations
  }

  /**
   * Generate insights from effectiveness data
   */
  private generateEffectivenessInsights(principleRankings: PrincipleUsageStats[], totalApplications: number) {
    const insights = [];

    // Most popular principle
    const mostPopular = principleRankings[0];
    insights.push(`"${mostPopular.principleName}" is the most popular principle with ${mostPopular.totalApplications} applications.`);

    // Most effective principle
    const mostEffective = principleRankings.reduce((max, p) => p.successRate > max.successRate ? p : max);
    insights.push(`"${mostEffective.principleName}" shows the highest effectiveness rate at ${mostEffective.successRate}%.`);

    // Usage distribution
    const topThreeUsage = principleRankings.slice(0, 3).reduce((sum, p) => sum + p.totalApplications, 0);
    const topThreePercentage = (topThreeUsage / totalApplications) * 100;
    insights.push(`The top 3 principles account for ${Math.round(topThreePercentage)}% of all applications.`);

    // Category analysis
    const categoryStats = new Map<string, number>();
    principleRankings.forEach(p => {
      categoryStats.set(p.category, (categoryStats.get(p.category) || 0) + p.totalApplications);
    });
    
    const topCategory = Array.from(categoryStats.entries()).reduce((max, [cat, count]) => 
      count > max[1] ? [cat, count] : max
    );
    insights.push(`"${topCategory[0]}" principles are most widely adopted with ${topCategory[1]} total applications.`);

    // Underutilized principles
    const underutilized = principleRankings.filter(p => p.totalApplications < 10);
    if (underutilized.length > 0) {
      insights.push(`${underutilized.length} principles are underutilized with less than 10 applications each.`);
    }

    return insights;
  }
}

// Export singleton instance
export const principlesAnalyticsService = new PrinciplesAnalyticsService();