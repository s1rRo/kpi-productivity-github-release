import { prisma } from '../index.js';
import { 
  MonthSummary, 
  HabitSummary, 
  YearData,
  DailyRecord,
  HabitRecord,
  Task,
  Habit
} from '../types/index.js';

/**
 * Analytics Service for KPI Productivity 2026
 * Implements detailed analytics, forecasting, and recommendations
 * Requirements: 1.4, 4.5
 */

export interface TrendAnalysis {
  habitId: string;
  habitName: string;
  trend: 'improving' | 'declining' | 'stable';
  trendPercentage: number;
  averageMinutes: number;
  consistency: number; // 0-100%
  recommendation: string;
}

export interface PeriodComparison {
  current: {
    period: string;
    averageKPI: number;
    totalHours: number;
    completionRate: number;
  };
  previous: {
    period: string;
    averageKPI: number;
    totalHours: number;
    completionRate: number;
  };
  changes: {
    kpiChange: number;
    hoursChange: number;
    completionRateChange: number;
  };
  insights: string[];
}

export interface ForecastData {
  period: string;
  predictedKPI: number;
  predictedHours: number;
  confidence: number; // 0-100%
  basedOnDays: number;
  compoundGrowthRate: number;
}

export interface PersonalizedRecommendation {
  type: 'habit_focus' | 'time_optimization' | 'priority_adjustment' | 'skill_development';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionItems: string[];
  expectedImpact: string;
  habitIds?: string[];
}

export interface AnalyticsReport {
  userId: string;
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
    type: 'month' | 'quarter' | 'year';
  };
  summary: {
    averageKPI: number;
    totalHours: number;
    completedDays: number;
    totalDays: number;
    topHabits: HabitSummary[];
    improvementAreas: string[];
  };
  trends: TrendAnalysis[];
  forecast: ForecastData;
  recommendations: PersonalizedRecommendation[];
}

export class AnalyticsService {
  
  /**
   * Generate comprehensive analytics report for a user
   */
  async generateAnalyticsReport(
    userId: string, 
    startDate: Date, 
    endDate: Date,
    reportType: 'month' | 'quarter' | 'year' = 'month'
  ): Promise<AnalyticsReport> {
    
    // Get all daily records for the period
    const dailyRecords = await prisma.dailyRecord.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate
        },
        exceptionType: null // Exclude exception days
      },
      include: {
        habitRecords: {
          include: {
            habit: true
          }
        },
        tasks: true
      },
      orderBy: {
        date: 'asc'
      }
    });

    // Get all habits for the user
    const habits = await prisma.habit.findMany({
      orderBy: { name: 'asc' }
    }) as any[];

    // Calculate summary statistics
    const summary = this.calculateSummaryStats(dailyRecords, startDate, endDate);
    
    // Analyze trends for each habit
    const trends = await this.analyzeTrends(userId, dailyRecords, habits);
    
    // Generate forecast
    const forecast = this.generateForecast(dailyRecords, reportType);
    
    // Generate personalized recommendations
    const recommendations = this.generateRecommendations(dailyRecords, trends, habits);

    return {
      userId,
      generatedAt: new Date(),
      period: {
        start: startDate,
        end: endDate,
        type: reportType
      },
      summary,
      trends,
      forecast,
      recommendations
    };
  }

  /**
   * Calculate summary statistics for the period
   */
  private calculateSummaryStats(
    dailyRecords: any[], 
    startDate: Date, 
    endDate: Date
  ) {
    const validRecords = dailyRecords.filter(r => r.totalKpi !== null);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // Calculate averages
    const averageKPI = validRecords.length > 0 
      ? validRecords.reduce((sum, r) => sum + r.totalKpi, 0) / validRecords.length 
      : 0;
    
    const totalHours = dailyRecords.reduce((total, record) => {
      return total + record.habitRecords.reduce((sum: number, hr: any) => sum + hr.actualMinutes, 0);
    }, 0) / 60;

    // Calculate habit summaries
    const habitMap = new Map<string, { 
      habitId: string, 
      habitName: string, 
      totalMinutes: number, 
      count: number,
      qualityScores: number[]
    }>();

    dailyRecords.forEach(record => {
      record.habitRecords.forEach((hr: any) => {
        const key = hr.habitId;
        if (!habitMap.has(key)) {
          habitMap.set(key, {
            habitId: hr.habitId,
            habitName: hr.habit.name,
            totalMinutes: 0,
            count: 0,
            qualityScores: []
          });
        }
        const habit = habitMap.get(key)!;
        habit.totalMinutes += hr.actualMinutes;
        habit.count += 1;
        if (hr.qualityScore) {
          habit.qualityScores.push(hr.qualityScore);
        }
      });
    });

    const topHabits: HabitSummary[] = Array.from(habitMap.values())
      .map(habit => ({
        habitId: habit.habitId,
        habitName: habit.habitName,
        totalMinutes: habit.totalMinutes,
        averageMinutes: habit.totalMinutes / habit.count,
        completionRate: (habit.count / validRecords.length) * 100,
        averageQuality: habit.qualityScores.length > 0 
          ? habit.qualityScores.reduce((sum, q) => sum + q, 0) / habit.qualityScores.length 
          : undefined
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes)
      .slice(0, 5);

    // Identify improvement areas
    const improvementAreas = topHabits
      .filter(h => h.completionRate < 70)
      .map(h => h.habitName);

    return {
      averageKPI: Math.round(averageKPI * 100) / 100,
      totalHours: Math.round(totalHours * 100) / 100,
      completedDays: validRecords.length,
      totalDays,
      topHabits,
      improvementAreas
    };
  }

  /**
   * Analyze trends for each habit
   */
  private async analyzeTrends(
    userId: string, 
    dailyRecords: any[], 
    habits: Habit[]
  ): Promise<TrendAnalysis[]> {
    const trends: TrendAnalysis[] = [];

    for (const habit of habits) {
      const habitRecords = dailyRecords.flatMap(dr => 
        dr.habitRecords.filter((hr: any) => hr.habitId === habit.id)
      );

      if (habitRecords.length < 7) continue; // Need at least a week of data

      // Calculate trend using linear regression on daily averages
      const dailyAverages = this.calculateDailyAverages(habitRecords);
      const trendData = this.calculateTrend(dailyAverages);
      
      // Calculate consistency (how often the habit was performed)
      const consistency = (habitRecords.length / dailyRecords.length) * 100;
      
      // Generate recommendation based on trend and consistency
      const recommendation = this.generateHabitRecommendation(
        habit, 
        trendData.trend, 
        trendData.percentage, 
        consistency
      );

      trends.push({
        habitId: habit.id,
        habitName: habit.name,
        trend: trendData.trend,
        trendPercentage: trendData.percentage,
        averageMinutes: habitRecords.reduce((sum: number, hr: any) => sum + hr.actualMinutes, 0) / habitRecords.length,
        consistency: Math.round(consistency * 100) / 100,
        recommendation
      });
    }

    return trends.sort((a, b) => b.trendPercentage - a.trendPercentage);
  }

  /**
   * Calculate daily averages for trend analysis
   */
  private calculateDailyAverages(habitRecords: any[]): number[] {
    const dailyMap = new Map<string, number[]>();
    
    habitRecords.forEach((hr: any) => {
      const date = new Date(hr.createdAt).toDateString();
      if (!dailyMap.has(date)) {
        dailyMap.set(date, []);
      }
      dailyMap.get(date)!.push(hr.actualMinutes);
    });

    return Array.from(dailyMap.values()).map(minutes => 
      minutes.reduce((sum, m) => sum + m, 0) / minutes.length
    );
  }

  /**
   * Calculate trend using simple linear regression
   */
  private calculateTrend(values: number[]): { trend: 'improving' | 'declining' | 'stable', percentage: number } {
    if (values.length < 2) return { trend: 'stable', percentage: 0 };

    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const avgY = sumY / n;
    
    const percentage = Math.abs((slope / avgY) * 100);

    if (Math.abs(slope) < 0.1) {
      return { trend: 'stable', percentage: 0 };
    }

    return {
      trend: slope > 0 ? 'improving' : 'declining',
      percentage: Math.round(percentage * 100) / 100
    };
  }

  /**
   * Generate habit-specific recommendation
   */
  private generateHabitRecommendation(
    habit: Habit, 
    trend: 'improving' | 'declining' | 'stable', 
    trendPercentage: number, 
    consistency: number
  ): string {
    if (consistency < 50) {
      return `Focus on consistency for ${habit.name}. Try habit stacking or reducing the target to build momentum.`;
    }

    if (trend === 'declining' && trendPercentage > 10) {
      return `${habit.name} is declining by ${trendPercentage}%. Consider reviewing your approach or adjusting the target.`;
    }

    if (trend === 'improving' && trendPercentage > 15) {
      return `Great progress on ${habit.name}! Consider gradually increasing the target to maintain growth.`;
    }

    if (trend === 'stable' && consistency > 80) {
      return `${habit.name} is stable with good consistency. Consider optimizing quality or efficiency.`;
    }

    return `Continue current approach for ${habit.name}. Monitor for changes in the coming weeks.`;
  }

  /**
   * Generate forecast based on compound growth
   */
  private generateForecast(
    dailyRecords: any[], 
    reportType: 'month' | 'quarter' | 'year'
  ): ForecastData {
    const validRecords = dailyRecords.filter(r => r.totalKpi !== null);
    
    if (validRecords.length < 7) {
      return {
        period: 'next_' + reportType,
        predictedKPI: 0,
        predictedHours: 0,
        confidence: 0,
        basedOnDays: validRecords.length,
        compoundGrowthRate: 0
      };
    }

    // Calculate current averages
    const currentKPI = validRecords.reduce((sum, r) => sum + r.totalKpi, 0) / validRecords.length;
    const currentHours = dailyRecords.reduce((total, record) => {
      return total + record.habitRecords.reduce((sum: number, hr: any) => sum + hr.actualMinutes, 0);
    }, 0) / 60 / validRecords.length;

    // Calculate compound growth rate based on recent trend
    const recentRecords = validRecords.slice(-14); // Last 2 weeks
    const earlyRecords = validRecords.slice(0, 14); // First 2 weeks
    
    const recentAvg = recentRecords.reduce((sum, r) => sum + r.totalKpi, 0) / recentRecords.length;
    const earlyAvg = earlyRecords.reduce((sum, r) => sum + r.totalKpi, 0) / earlyRecords.length;
    
    const growthRate = earlyAvg > 0 ? (recentAvg - earlyAvg) / earlyAvg : 0;
    const dailyGrowthRate = Math.max(0.001, Math.min(0.02, growthRate / 14)); // Cap between 0.1% and 2% daily

    // Forecast periods
    const forecastDays = reportType === 'month' ? 30 : reportType === 'quarter' ? 90 : 365;
    
    const predictedKPI = currentKPI * Math.pow(1 + dailyGrowthRate, forecastDays);
    const predictedHours = currentHours * Math.pow(1 + dailyGrowthRate * 0.5, forecastDays); // Hours grow slower

    // Calculate confidence based on data consistency
    const confidence = Math.min(100, (validRecords.length / 30) * 100); // Full confidence with 30+ days

    return {
      period: 'next_' + reportType,
      predictedKPI: Math.round(predictedKPI * 100) / 100,
      predictedHours: Math.round(predictedHours * 100) / 100,
      confidence: Math.round(confidence),
      basedOnDays: validRecords.length,
      compoundGrowthRate: Math.round(dailyGrowthRate * 10000) / 100 // Convert to percentage
    };
  }

  /**
   * Generate personalized recommendations
   */
  private generateRecommendations(
    dailyRecords: any[], 
    trends: TrendAnalysis[], 
    habits: Habit[]
  ): PersonalizedRecommendation[] {
    const recommendations: PersonalizedRecommendation[] = [];

    // Analyze overall performance
    const validRecords = dailyRecords.filter(r => r.totalKpi !== null);
    const averageKPI = validRecords.length > 0 
      ? validRecords.reduce((sum, r) => sum + r.totalKpi, 0) / validRecords.length 
      : 0;

    // 1. Habit Focus Recommendations
    const decliningHabits = trends.filter(t => t.trend === 'declining' && t.trendPercentage > 10);
    if (decliningHabits.length > 0) {
      recommendations.push({
        type: 'habit_focus',
        priority: 'high',
        title: 'Address Declining Habits',
        description: `${decliningHabits.length} habits are showing declining trends. Focus on these to prevent further drops.`,
        actionItems: decliningHabits.map(h => `Review and adjust approach for ${h.habitName}`),
        expectedImpact: 'Prevent 10-20% KPI decline',
        habitIds: decliningHabits.map(h => h.habitId)
      });
    }

    // 2. Time Optimization Recommendations
    const lowConsistencyHabits = trends.filter(t => t.consistency < 60);
    if (lowConsistencyHabits.length > 0) {
      recommendations.push({
        type: 'time_optimization',
        priority: 'medium',
        title: 'Improve Habit Consistency',
        description: 'Several habits have low consistency rates. Consider time blocking or habit stacking.',
        actionItems: [
          'Use time blocking for low-consistency habits',
          'Try habit stacking to link habits together',
          'Reduce targets temporarily to build momentum'
        ],
        expectedImpact: 'Increase overall consistency by 15-25%',
        habitIds: lowConsistencyHabits.map(h => h.habitId)
      });
    }

    // 3. Priority Adjustment Recommendations
    if (averageKPI < 80) {
      const q2Habits = habits.filter(h => h.eisenhowerQuadrant === 'Q2');
      recommendations.push({
        type: 'priority_adjustment',
        priority: 'high',
        title: 'Focus on Q2 Activities',
        description: 'Your KPI is below optimal. Increase focus on important but not urgent activities (Q2).',
        actionItems: [
          'Allocate more time to Q2 habits (important, not urgent)',
          'Reduce time spent on Q3/Q4 activities',
          'Set specific Q2 goals for the next week'
        ],
        expectedImpact: 'Potential 15-30% KPI improvement',
        habitIds: q2Habits.map(h => h.id)
      });
    }

    // 4. Skill Development Recommendations
    const skillHabits = habits.filter(h => h.category === 'skills' && h.skillLevel < 4);
    if (skillHabits.length > 0) {
      recommendations.push({
        type: 'skill_development',
        priority: 'medium',
        title: 'Accelerate Skill Development',
        description: 'You have skills below level 4. Focus on these for career advancement.',
        actionItems: [
          'Take monthly skill assessments',
          'Increase practice time for low-level skills',
          'Find mentors or courses for skill development'
        ],
        expectedImpact: 'Improve skills pillar by 20-40%',
        habitIds: skillHabits.map(h => h.id)
      });
    }

    // Sort by priority
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return recommendations.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
  }

  /**
   * Compare two periods (month-to-month, year-to-year)
   */
  async comparePeriods(
    userId: string,
    currentStart: Date,
    currentEnd: Date,
    previousStart: Date,
    previousEnd: Date
  ): Promise<PeriodComparison> {
    
    // Get data for both periods
    const [currentRecords, previousRecords] = await Promise.all([
      prisma.dailyRecord.findMany({
        where: {
          userId,
          date: { gte: currentStart, lte: currentEnd },
          exceptionType: null
        },
        include: { habitRecords: true }
      }),
      prisma.dailyRecord.findMany({
        where: {
          userId,
          date: { gte: previousStart, lte: previousEnd },
          exceptionType: null
        },
        include: { habitRecords: true }
      })
    ]);

    // Calculate metrics for both periods
    const currentMetrics = this.calculatePeriodMetrics(currentRecords, currentStart, currentEnd);
    const previousMetrics = this.calculatePeriodMetrics(previousRecords, previousStart, previousEnd);

    // Calculate changes
    const kpiChange = currentMetrics.averageKPI - previousMetrics.averageKPI;
    const hoursChange = currentMetrics.totalHours - previousMetrics.totalHours;
    const completionRateChange = currentMetrics.completionRate - previousMetrics.completionRate;

    // Generate insights
    const insights = this.generateComparisonInsights(
      kpiChange, 
      hoursChange, 
      completionRateChange
    );

    return {
      current: {
        period: `${currentStart.toISOString().split('T')[0]} to ${currentEnd.toISOString().split('T')[0]}`,
        ...currentMetrics
      },
      previous: {
        period: `${previousStart.toISOString().split('T')[0]} to ${previousEnd.toISOString().split('T')[0]}`,
        ...previousMetrics
      },
      changes: {
        kpiChange: Math.round(kpiChange * 100) / 100,
        hoursChange: Math.round(hoursChange * 100) / 100,
        completionRateChange: Math.round(completionRateChange * 100) / 100
      },
      insights
    };
  }

  /**
   * Calculate metrics for a period
   */
  private calculatePeriodMetrics(records: any[], startDate: Date, endDate: Date) {
    const validRecords = records.filter(r => r.totalKpi !== null);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    const averageKPI = validRecords.length > 0 
      ? validRecords.reduce((sum, r) => sum + r.totalKpi, 0) / validRecords.length 
      : 0;
    
    const totalHours = records.reduce((total, record) => {
      return total + record.habitRecords.reduce((sum: number, hr: any) => sum + hr.actualMinutes, 0);
    }, 0) / 60;

    const completionRate = (validRecords.length / totalDays) * 100;

    return {
      averageKPI: Math.round(averageKPI * 100) / 100,
      totalHours: Math.round(totalHours * 100) / 100,
      completionRate: Math.round(completionRate * 100) / 100
    };
  }

  /**
   * Generate insights from period comparison
   */
  private generateComparisonInsights(
    kpiChange: number, 
    hoursChange: number, 
    completionRateChange: number
  ): string[] {
    const insights: string[] = [];

    if (kpiChange > 5) {
      insights.push(`Excellent KPI improvement of ${kpiChange.toFixed(1)} points! Keep up the momentum.`);
    } else if (kpiChange < -5) {
      insights.push(`KPI declined by ${Math.abs(kpiChange).toFixed(1)} points. Review recent changes and adjust strategy.`);
    } else {
      insights.push('KPI remained relatively stable. Consider optimizing for breakthrough improvements.');
    }

    if (hoursChange > 10) {
      insights.push(`Significant increase in activity hours (+${hoursChange.toFixed(1)}h). Ensure this is sustainable.`);
    } else if (hoursChange < -10) {
      insights.push(`Activity hours decreased by ${Math.abs(hoursChange).toFixed(1)}h. Focus on consistency.`);
    }

    if (completionRateChange > 10) {
      insights.push(`Great improvement in completion rate (+${completionRateChange.toFixed(1)}%). Consistency is key to success.`);
    } else if (completionRateChange < -10) {
      insights.push(`Completion rate dropped by ${Math.abs(completionRateChange).toFixed(1)}%. Consider reducing targets temporarily.`);
    }

    if (insights.length === 0) {
      insights.push('Performance metrics are stable. Look for opportunities to optimize quality and efficiency.');
    }

    return insights;
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();