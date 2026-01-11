import { HabitRecord, Habit } from '../types/index.js';

/**
 * Streak Tracking Service
 * Tracks habit streaks for compound 1% calculations from Atomic Habits
 * Supports requirement 10.1: Compound 1% principle integration
 */
export class StreakTracker {

  /**
   * Calculate current streaks for all habits based on recent records
   * This is a simplified implementation - in production, this would query the database
   * for historical data to calculate accurate streaks
   */
  calculateCurrentStreaks(
    recentHabitRecords: HabitRecord[][],  // Array of daily habit records (last 30 days)
    habits: Habit[]
  ): Map<string, number> {
    const streaks = new Map<string, number>();
    const habitMap = new Map(habits.map(h => [h.id, h]));

    // Initialize streaks for all habits
    for (const habit of habits) {
      streaks.set(habit.id, 0);
    }

    // Calculate streaks by going backwards through recent records
    for (const habit of habits) {
      let currentStreak = 0;
      
      // Go through recent records in reverse chronological order
      for (let dayIndex = recentHabitRecords.length - 1; dayIndex >= 0; dayIndex--) {
        const dayRecords = recentHabitRecords[dayIndex];
        const habitRecord = dayRecords.find(r => r.habitId === habit.id);
        
        if (habitRecord && this.isHabitCompleted(habitRecord, habit)) {
          currentStreak++;
        } else {
          // Streak broken
          break;
        }
      }
      
      streaks.set(habit.id, currentStreak);
    }

    return streaks;
  }

  /**
   * Determine if a habit was completed for the day
   * Uses different criteria based on habit type
   */
  private isHabitCompleted(record: HabitRecord, habit: Habit): boolean {
    // For most habits, completion means achieving at least 80% of target
    const completionThreshold = habit.targetMinutes * 0.8;
    
    // Special cases for specific habits
    switch (habit.name) {
      case 'Сон':
        // Sleep: at least 7 hours (420 minutes)
        return record.actualMinutes >= 420;
      
      case 'Спорт':
        // Exercise: at least 30 minutes
        return record.actualMinutes >= 30;
      
      case 'Чтение':
        // Reading: at least 15 minutes
        return record.actualMinutes >= 15;
      
      case 'Английский':
      case 'ИИ':
      case 'Аналитика':
        // Skills: at least 20 minutes
        return record.actualMinutes >= 20;
      
      case 'Блог в X':
      case 'Права':
        // Short habits: at least 10 minutes
        return record.actualMinutes >= 10;
      
      default:
        // Default: 80% of target
        return record.actualMinutes >= completionThreshold;
    }
  }

  /**
   * Get streak milestones and their bonuses
   * Based on habit formation research and Atomic Habits principles
   */
  getStreakMilestones(): { days: number; bonus: number; description: string }[] {
    return [
      { days: 7, bonus: 5, description: '1 week streak - Building momentum' },
      { days: 21, bonus: 10, description: '3 weeks streak - Habit formation' },
      { days: 30, bonus: 12, description: '1 month streak - Consistency established' },
      { days: 66, bonus: 15, description: '66 days streak - Habit automation' },
      { days: 100, bonus: 20, description: '100 days streak - Mastery level' },
      { days: 365, bonus: 25, description: '1 year streak - Lifestyle integration' }
    ];
  }

  /**
   * Calculate streak bonus for a specific habit
   */
  calculateStreakBonus(habitId: string, streakDays: number): number {
    const milestones = this.getStreakMilestones();
    let bonus = 0;

    for (const milestone of milestones) {
      if (streakDays >= milestone.days) {
        bonus = milestone.bonus;
      } else {
        break;
      }
    }

    return bonus;
  }

  /**
   * Get streak statistics for all habits
   */
  getStreakStatistics(streaks: Map<string, number>, habits: Habit[]): {
    totalActiveStreaks: number;
    longestStreak: { habitId: string; habitName: string; days: number };
    averageStreak: number;
    streakDistribution: { [key: string]: number };
  } {
    const habitMap = new Map(habits.map(h => [h.id, h]));
    const activeStreaks = Array.from(streaks.values()).filter(s => s > 0);
    
    let longestStreak = { habitId: '', habitName: '', days: 0 };
    
    for (const [habitId, days] of streaks) {
      if (days > longestStreak.days) {
        const habit = habitMap.get(habitId);
        longestStreak = {
          habitId,
          habitName: habit?.name || 'Unknown',
          days
        };
      }
    }

    const averageStreak = activeStreaks.length > 0 
      ? activeStreaks.reduce((sum, streak) => sum + streak, 0) / activeStreaks.length 
      : 0;

    // Distribution by streak length ranges
    const streakDistribution: { [key: string]: number } = {
      '0 days': 0,
      '1-7 days': 0,
      '8-21 days': 0,
      '22-66 days': 0,
      '67+ days': 0
    };

    for (const days of streaks.values()) {
      if (days === 0) streakDistribution['0 days']++;
      else if (days <= 7) streakDistribution['1-7 days']++;
      else if (days <= 21) streakDistribution['8-21 days']++;
      else if (days <= 66) streakDistribution['22-66 days']++;
      else streakDistribution['67+ days']++;
    }

    return {
      totalActiveStreaks: activeStreaks.length,
      longestStreak,
      averageStreak: Math.round(averageStreak * 10) / 10,
      streakDistribution
    };
  }

  /**
   * Predict streak continuation probability
   * Based on current streak length and habit difficulty
   */
  predictStreakContinuation(
    habitId: string, 
    currentStreak: number, 
    habit: Habit
  ): { probability: number; riskFactors: string[]; recommendations: string[] } {
    const riskFactors: string[] = [];
    const recommendations: string[] = [];
    let baseProbability = 0.7; // 70% base probability

    // Adjust based on streak length
    if (currentStreak >= 66) {
      baseProbability = 0.9; // High automation
    } else if (currentStreak >= 21) {
      baseProbability = 0.8; // Good formation
    } else if (currentStreak >= 7) {
      baseProbability = 0.75; // Building momentum
    } else if (currentStreak >= 3) {
      baseProbability = 0.6; // Early stage
    } else {
      baseProbability = 0.4; // Very early/struggling
      riskFactors.push('Very short streak - high risk of breaking');
      recommendations.push('Focus on making the habit as easy as possible');
    }

    // Adjust based on habit difficulty (skill level)
    if (habit.skillLevel <= 2) {
      baseProbability -= 0.1;
      riskFactors.push('Low skill level - challenging habit');
      recommendations.push('Consider breaking down into smaller steps');
    }

    // Adjust based on habit category
    if (habit.category === 'skills' || habit.category === 'learning') {
      baseProbability -= 0.05;
      riskFactors.push('Skill-building habits require more mental energy');
      recommendations.push('Schedule during your peak energy hours');
    }

    // Weekend risk for weekday-only habits
    if (habit.isWeekdayOnly) {
      riskFactors.push('Weekday-only habit - weekend disruption risk');
      recommendations.push('Plan weekend alternatives or maintenance activities');
    }

    // General recommendations based on streak length
    if (currentStreak < 21) {
      recommendations.push('Focus on consistency over intensity');
      recommendations.push('Use habit stacking to link with existing routines');
    } else if (currentStreak < 66) {
      recommendations.push('You\'re in the habit formation zone - stay consistent');
      recommendations.push('Start gradually increasing intensity or duration');
    } else {
      recommendations.push('Habit is well-established - consider optimization');
      recommendations.push('You can handle small variations without breaking the streak');
    }

    return {
      probability: Math.max(0.1, Math.min(0.95, baseProbability)),
      riskFactors,
      recommendations
    };
  }

  /**
   * Generate streak insights and recommendations
   */
  generateStreakInsights(
    streaks: Map<string, number>,
    habits: Habit[]
  ): {
    insights: string[];
    warnings: string[];
    achievements: string[];
    recommendations: string[];
  } {
    const insights: string[] = [];
    const warnings: string[] = [];
    const achievements: string[] = [];
    const recommendations: string[] = [];

    const habitMap = new Map(habits.map(h => [h.id, h]));
    const stats = this.getStreakStatistics(streaks, habits);

    // Achievements
    for (const [habitId, days] of streaks) {
      const habit = habitMap.get(habitId);
      if (!habit) continue;

      if (days >= 100) {
        achievements.push(`🏆 ${habit.name}: 100+ day streak! Mastery level achieved`);
      } else if (days >= 66) {
        achievements.push(`🎯 ${habit.name}: 66+ day streak! Habit is automated`);
      } else if (days >= 21) {
        achievements.push(`✨ ${habit.name}: 21+ day streak! Habit is forming`);
      } else if (days >= 7) {
        achievements.push(`🌱 ${habit.name}: 1 week streak! Building momentum`);
      }
    }

    // Warnings
    const strugglingHabits = Array.from(streaks.entries())
      .filter(([_, days]) => days < 3)
      .map(([habitId, _]) => habitMap.get(habitId)?.name)
      .filter(Boolean);

    if (strugglingHabits.length > 0) {
      warnings.push(`⚠️ Struggling habits: ${strugglingHabits.join(', ')}`);
      recommendations.push('Focus on making struggling habits easier to start');
    }

    // Insights
    if (stats.averageStreak > 14) {
      insights.push(`📈 Excellent consistency! Average streak: ${stats.averageStreak} days`);
    } else if (stats.averageStreak > 7) {
      insights.push(`📊 Good consistency! Average streak: ${stats.averageStreak} days`);
    } else {
      insights.push(`📉 Room for improvement. Average streak: ${stats.averageStreak} days`);
      recommendations.push('Focus on building consistency before intensity');
    }

    if (stats.totalActiveStreaks === habits.length) {
      insights.push('🎉 All habits have active streaks!');
    } else {
      const inactiveCount = habits.length - stats.totalActiveStreaks;
      insights.push(`${stats.totalActiveStreaks}/${habits.length} habits have active streaks`);
      if (inactiveCount > 0) {
        recommendations.push(`Restart ${inactiveCount} inactive habit${inactiveCount > 1 ? 's' : ''}`);
      }
    }

    return { insights, warnings, achievements, recommendations };
  }
}

// Export singleton instance
export const streakTracker = new StreakTracker();