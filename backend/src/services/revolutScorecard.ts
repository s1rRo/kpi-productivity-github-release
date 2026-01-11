import { RevolutPillars, HabitRecord, Task, Habit } from '../types/index.js';
import { skillsManager } from './skillsManager.js';

/**
 * Revolut Scorecard Service
 * Implements the three-pillar system: Deliverables (40%) + Skills (30%) + Culture (30%)
 * Based on requirement 4.4
 */
export class RevolutScorecardService {

  /**
   * Calculate complete Revolut scorecard for a day
   * @param habitRecords - Habit performance data
   * @param tasks - Task completion data
   * @param habits - Habit definitions
   * @param skillLevelDeltas - Monthly skill level changes (optional)
   * @returns RevolutPillars with calculated scores
   */
  calculateDailyScorecard(
    habitRecords: HabitRecord[],
    tasks: Task[],
    habits: Habit[],
    skillLevelDeltas?: Map<string, number>
  ): RevolutPillars {
    const deliverables = this.calculateDeliverables(habitRecords, tasks, habits);
    const skills = this.calculateSkills(habitRecords, habits, skillLevelDeltas);
    const culture = this.calculateCulture(habitRecords, tasks, habits);

    return {
      deliverables,
      skills,
      culture
    };
  }

  /**
   * Deliverables Pillar (40% weight)
   * Measures actual output and completion rates
   */
  private calculateDeliverables(
    habitRecords: HabitRecord[],
    tasks: Task[],
    habits: Habit[]
  ): number {
    const habitMap = new Map(habits.map(h => [h.id, h]));
    
    // Calculate habit completion rate
    let habitScore = 0;
    let totalHabits = 0;

    for (const record of habitRecords) {
      const habit = habitMap.get(record.habitId);
      if (!habit) continue;

      const targetMinutes = this.getAdjustedTarget(habit, new Date());
      const completionRate = Math.min(record.actualMinutes / targetMinutes, 1.0);
      
      habitScore += completionRate * 100;
      totalHabits++;
    }

    const avgHabitCompletion = totalHabits > 0 ? habitScore / totalHabits : 0;

    // Calculate task completion rate
    const completedTasks = tasks.filter(t => t.completed).length;
    const taskCompletionRate = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 100;

    // Weight: 70% habits, 30% tasks (habits are core deliverables)
    return (avgHabitCompletion * 0.7) + (taskCompletionRate * 0.3);
  }

  /**
   * Skills Pillar (30% weight)
   * Measures learning progress and skill development
   */
  private calculateSkills(
    habitRecords: HabitRecord[],
    habits: Habit[],
    skillLevelDeltas?: Map<string, number>
  ): number {
    const habitMap = new Map(habits.map(h => [h.id, h]));
    
    // If we have monthly skill deltas, use them
    if (skillLevelDeltas && skillLevelDeltas.size > 0) {
      let totalDelta = 0;
      let skillHabits = 0;

      for (const [habitId, delta] of skillLevelDeltas) {
        const habit = habitMap.get(habitId);
        if (habit?.category === 'skills' || habit?.category === 'learning') {
          totalDelta += delta;
          skillHabits++;
        }
      }

      if (skillHabits > 0) {
        // Convert delta to percentage (assuming max skill level is 5)
        const avgDelta = totalDelta / skillHabits;
        return Math.max(0, Math.min(100, (avgDelta / 5) * 100 + 50)); // Normalize around 50%
      }
    }

    // Daily skills calculation based on learning habit performance
    let skillsScore = 0;
    let skillHabits = 0;

    for (const record of habitRecords) {
      const habit = habitMap.get(record.habitId);
      if (!habit) continue;

      // Focus on skill-building habits
      if (habit.category === 'skills' || habit.category === 'learning') {
        const targetMinutes = habit.targetMinutes;
        const completionRate = Math.min(record.actualMinutes / targetMinutes, 1.5); // Allow 150% max
        
        // Quality score bonus (if available)
        const qualityMultiplier = record.qualityScore ? record.qualityScore / 5 : 1;
        
        skillsScore += (completionRate * qualityMultiplier) * 100;
        skillHabits++;
      }
    }

    return skillHabits > 0 ? skillsScore / skillHabits : 50; // Default to 50% if no skill habits
  }

  /**
   * Culture Pillar (30% weight)
   * Measures alignment with productivity principles and values
   */
  private calculateCulture(
    habitRecords: HabitRecord[],
    tasks: Task[],
    habits: Habit[]
  ): number {
    let cultureScore = 0;
    let factors = 0;

    // Factor 1: Q2 Focus (Important, Not Urgent) - Stephen Covey principle
    const q2Score = this.calculateQ2Focus(habitRecords, habits);
    cultureScore += q2Score;
    factors++;

    // Factor 2: Balance across life areas
    const balanceScore = this.calculateLifeBalance(habitRecords, habits);
    cultureScore += balanceScore;
    factors++;

    // Factor 3: Consistency and discipline
    const consistencyScore = this.calculateConsistency(habitRecords);
    cultureScore += consistencyScore;
    factors++;

    // Factor 4: Growth mindset (attempting challenging tasks)
    const growthScore = this.calculateGrowthMindset(tasks, habitRecords, habits);
    cultureScore += growthScore;
    factors++;

    // Factor 5: Compound thinking (small daily improvements)
    const compoundScore = this.calculateCompoundThinking(habitRecords, habits);
    cultureScore += compoundScore;
    factors++;

    return factors > 0 ? cultureScore / factors : 50;
  }

  /**
   * Calculate focus on Q2 activities (Important, Not Urgent)
   */
  private calculateQ2Focus(habitRecords: HabitRecord[], habits: Habit[]): number {
    const habitMap = new Map(habits.map(h => [h.id, h]));
    
    let q2Time = 0;
    let totalTime = 0;

    for (const record of habitRecords) {
      const habit = habitMap.get(record.habitId);
      if (!habit) continue;

      totalTime += record.actualMinutes;
      
      if (habit.eisenhowerQuadrant === 'Q2') {
        q2Time += record.actualMinutes;
      }
    }

    if (totalTime === 0) return 50;
    
    const q2Percentage = (q2Time / totalTime) * 100;
    
    // Optimal Q2 focus is around 60-70%
    if (q2Percentage >= 60 && q2Percentage <= 70) return 100;
    if (q2Percentage >= 50 && q2Percentage < 80) return 80;
    if (q2Percentage >= 40 && q2Percentage < 90) return 60;
    
    return 40;
  }

  /**
   * Calculate balance across different life areas
   */
  private calculateLifeBalance(habitRecords: HabitRecord[], habits: Habit[]): number {
    const habitMap = new Map(habits.map(h => [h.id, h]));
    const categoryTime = new Map<string, number>();

    for (const record of habitRecords) {
      const habit = habitMap.get(record.habitId);
      if (!habit) continue;

      const category = habit.category || 'other';
      categoryTime.set(category, (categoryTime.get(category) || 0) + record.actualMinutes);
    }

    // Check if multiple categories are represented
    const activeCategories = Array.from(categoryTime.keys()).filter(cat => 
      (categoryTime.get(cat) || 0) > 0
    );

    // Ideal balance: health, skills, career, learning all represented
    const idealCategories = ['health', 'skills', 'career', 'learning'];
    const balancedCategories = activeCategories.filter(cat => 
      idealCategories.includes(cat)
    ).length;

    return (balancedCategories / idealCategories.length) * 100;
  }

  /**
   * Calculate consistency and discipline score
   */
  private calculateConsistency(habitRecords: HabitRecord[]): number {
    if (habitRecords.length === 0) return 0;

    const completedHabits = habitRecords.filter(r => r.actualMinutes > 0).length;
    const completionRate = completedHabits / habitRecords.length;

    // High consistency = high culture score
    return completionRate * 100;
  }

  /**
   * Calculate growth mindset score
   */
  private calculateGrowthMindset(tasks: Task[], habitRecords: HabitRecord[], habits: Habit[]): number {
    let growthScore = 50; // Base score

    // Bonus for attempting challenging tasks (high priority)
    const challengingTasks = tasks.filter(t => t.priority === 'high').length;
    if (challengingTasks > 0) growthScore += 20;

    // Bonus for exceeding targets in skill-building habits
    const habitMap = new Map(habits.map(h => [h.id, h]));
    
    for (const record of habitRecords) {
      const habit = habitMap.get(record.habitId);
      if (!habit) continue;

      if ((habit.category === 'skills' || habit.category === 'learning') && 
          record.actualMinutes > habit.targetMinutes) {
        growthScore += 10;
        break; // Only count once per day
      }
    }

    return Math.min(growthScore, 100);
  }

  /**
   * Calculate compound thinking score (small daily improvements)
   */
  private calculateCompoundThinking(habitRecords: HabitRecord[], habits: Habit[]): number {
    const habitMap = new Map(habits.map(h => [h.id, h]));
    
    // Look for small but consistent improvements
    let compoundScore = 0;
    let evaluatedHabits = 0;

    for (const record of habitRecords) {
      const habit = habitMap.get(record.habitId);
      if (!habit) continue;

      const completionRate = record.actualMinutes / habit.targetMinutes;
      
      // Reward 100-110% completion (sustainable improvement)
      if (completionRate >= 1.0 && completionRate <= 1.1) {
        compoundScore += 100;
      } else if (completionRate >= 0.9 && completionRate < 1.0) {
        compoundScore += 80;
      } else if (completionRate >= 0.8 && completionRate < 0.9) {
        compoundScore += 60;
      } else {
        compoundScore += 40;
      }
      
      evaluatedHabits++;
    }

    return evaluatedHabits > 0 ? compoundScore / evaluatedHabits : 50;
  }

  /**
   * Get adjusted target for weekday-only habits
   */
  private getAdjustedTarget(habit: Habit, date: Date): number {
    if (habit.isWeekdayOnly) {
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      if (habit.name === 'Работа') {
        return isWeekend ? 180 : 360;
      }
    }
    
    return habit.targetMinutes;
  }

  /**
   * Calculate monthly skill progression
   * This would typically be called monthly with historical data
   */
  calculateMonthlySkillProgression(
    startOfMonthSkills: Map<string, number>,
    endOfMonthSkills: Map<string, number>
  ): Map<string, number> {
    const deltas = new Map<string, number>();

    for (const [habitId, startLevel] of startOfMonthSkills) {
      const endLevel = endOfMonthSkills.get(habitId) || startLevel;
      deltas.set(habitId, endLevel - startLevel);
    }

    return deltas;
  }

  /**
   * Calculate monthly Revolut scorecard using skills manager
   */
  async calculateMonthlyScorecard(
    userId: string,
    month: number,
    year: number
  ): Promise<{ score: number; pillars: RevolutPillars }> {
    // Get skills pillar score from skills manager
    const skillsScore = await skillsManager.calculateSkillsPillarScore(userId, month, year);
    
    // For now, use placeholder values for deliverables and culture
    // These would be calculated from actual monthly data
    const deliverables = 75; // Placeholder
    const culture = 80; // Placeholder
    
    const pillars: RevolutPillars = {
      deliverables,
      skills: skillsScore,
      culture
    };

    const score = (pillars.deliverables * 0.4) + 
                  (pillars.skills * 0.3) + 
                  (pillars.culture * 0.3);

    return { score, pillars };
  }
}

// Export singleton instance
export const revolutScorecardService = new RevolutScorecardService();