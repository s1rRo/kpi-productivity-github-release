import { 
  DailyRecord, 
  HabitRecord, 
  Task, 
  Habit,
  EfficiencyCoefficients, 
  RevolutPillars, 
  KPICalculationData,
  TaskPriority,
  EisenhowerQuadrant 
} from '../types/index.js';
import { priorityManager } from './priorityManager.js';
import { productivityBooksService } from './productivityBooks.js';

/**
 * KPI Calculator Engine
 * Implements the core KPI calculation formula based on requirements 4.1-4.5 and 5.1-5.5
 * Formula: Base Score + Efficiency Coefficients + Priority Bonus + Revolut Score (capped at 150)
 */
export class KPICalculator {
  
  /**
   * Main KPI calculation method
   * @param habitRecords - Array of habit records for the day
   * @param tasks - Array of tasks for the day
   * @param habits - Array of habit definitions for reference
   * @param revolutPillars - Revolut scorecard data
   * @param streakData - Optional streak data for compound calculations
   * @returns Complete KPI calculation data
   */
  calculateDailyKPI(
    habitRecords: HabitRecord[],
    tasks: Task[],
    habits: Habit[],
    revolutPillars: RevolutPillars,
    streakData?: Map<string, number>
  ): KPICalculationData {
    const baseScore = this.calculateBaseScore(habitRecords, habits);
    const efficiencyCoefficients = this.calculateEfficiencyCoefficients(habitRecords, tasks, habits, streakData);
    const priorityBonus = this.calculatePriorityBonus(tasks, habits);
    const revolutScore = this.calculateRevolutScore(revolutPillars);
    
    const totalKPI = Math.min(
      baseScore + this.sumEfficiencyCoefficients(efficiencyCoefficients) + priorityBonus + revolutScore,
      150
    );

    return {
      baseScore,
      efficiencyCoefficients,
      priorityBonus,
      revolutScore,
      totalKPI
    };
  }

  /**
   * Calculate base score: (actual/target * 100, capped at 150%) averaged across habits
   * Requirement 4.1: Base score calculation
   */
  private calculateBaseScore(habitRecords: HabitRecord[], habits: Habit[]): number {
    if (habitRecords.length === 0) return 0;

    const habitMap = new Map(habits.map(h => [h.id, h]));
    let totalScore = 0;
    let validHabits = 0;

    for (const record of habitRecords) {
      const habit = habitMap.get(record.habitId);
      if (!habit) continue;

      // Adjust target for weekday-only habits
      const targetMinutes = this.getAdjustedTarget(habit, new Date());
      const percentage = Math.min((record.actualMinutes / targetMinutes) * 100, 150);
      
      totalScore += percentage;
      validHabits++;
    }

    return validHabits > 0 ? totalScore / validHabits : 0;
  }

  /**
   * Calculate all efficiency law coefficients
   * Requirements 5.1-5.5: 10+ laws of effectiveness with ±10-15 coefficients
   * Requirement 10.1-10.5: Integration of productivity book principles
   */
  private calculateEfficiencyCoefficients(
    habitRecords: HabitRecord[],
    tasks: Task[],
    habits: Habit[],
    streakData?: Map<string, number>
  ): EfficiencyCoefficients {
    const habitMap = new Map(habits.map(h => [h.id, h]));
    
    return {
      paretoLaw: this.paretoLaw(tasks, habits),
      parkinsonLaw: this.parkinsonLaw(tasks),
      diminishingReturns: this.diminishingReturns(habitRecords, habitMap),
      yerkesDodssonLaw: this.yerkesDodssonLaw(tasks),
      pomodoroTechnique: this.pomodoroTechnique(habitRecords),
      deepWork: this.deepWork(habitRecords, habitMap),
      timeBlocking: this.timeBlocking(tasks),
      habitStacking: this.habitStacking(habitRecords),
      compoundEffect: this.compoundEffect(habitRecords),
      focusBlocks: this.focusBlocks(tasks),
      // NEW: Productivity Books Integration
      productivityBooks: productivityBooksService.calculateProductivityBooksCoefficient(
        habitRecords, 
        tasks, 
        habits, 
        streakData
      )
    };
  }

  /**
   * Calculate priority bonus for tasks
   * Requirement 4.3: +20 high priority, +10 medium priority
   * Requirement 6.2: Additional Q2 focus bonus
   */
  private calculatePriorityBonus(tasks: Task[], habits: Habit[]): number {
    let bonus = 0;
    
    // Basic priority bonus
    for (const task of tasks) {
      if (task.completed) {
        switch (task.priority) {
          case 'high':
            bonus += 20;
            break;
          case 'medium':
            bonus += 10;
            break;
          case 'low':
            bonus += 0;
            break;
        }
      }
    }

    // Q2 focus bonus (Eisenhower Matrix)
    const q2FocusBonus = priorityManager.calculateQ2FocusBonus(tasks, habits);
    bonus += q2FocusBonus;

    // Strategic task bonus (relocation/business goals)
    const strategicBonus = priorityManager.calculateStrategicBonus(tasks);
    bonus += strategicBonus;

    return bonus;
  }

  /**
   * Calculate Revolut Scorecard
   * Requirement 4.4: 0.4 Deliverables + 0.3 Skills + 0.3 Culture
   */
  private calculateRevolutScore(pillars: RevolutPillars): number {
    return (pillars.deliverables * 0.4) + 
           (pillars.skills * 0.3) + 
           (pillars.culture * 0.3);
  }

  // ===== EFFICIENCY LAWS IMPLEMENTATION =====

  /**
   * Pareto Principle (80/20 Rule)
   * +10 for focusing on top 20% of high-priority tasks
   */
  private paretoLaw(tasks: Task[], habits: Habit[]): number {
    if (tasks.length === 0) return 0;
    
    const highPriorityTasks = tasks.filter(t => t.priority === 'high');
    const highPriorityFocus = highPriorityTasks.length / tasks.length;
    
    // Check if user focused on Q2 (important, not urgent) habits
    const habitMap = new Map(habits.map(h => [h.id, h]));
    const q2Focus = tasks.filter(t => {
      // Assuming tasks can be linked to habits or have quadrant classification
      return t.priority === 'high'; // Simplified - in real implementation, check quadrant
    }).length / tasks.length;
    
    return (highPriorityFocus >= 0.8 || q2Focus >= 0.6) ? 10 : 0;
  }

  /**
   * Parkinson's Law
   * +15 for completing faster than planned, -10 for taking longer
   */
  private parkinsonLaw(tasks: Task[]): number {
    let coefficient = 0;
    let evaluatedTasks = 0;

    for (const task of tasks) {
      if (task.completed && task.estimatedMinutes && task.actualMinutes) {
        const ratio = task.actualMinutes / task.estimatedMinutes;
        
        if (ratio < 0.9) {
          coefficient += 15; // Faster than planned
        } else if (ratio > 1.2) {
          coefficient -= 10; // Slower than planned
        }
        
        evaluatedTasks++;
      }
    }

    return evaluatedTasks > 0 ? coefficient / evaluatedTasks : 0;
  }

  /**
   * Law of Diminishing Returns
   * -15 for working more than 4 hours without break
   */
  private diminishingReturns(habitRecords: HabitRecord[], habitMap: Map<string, Habit>): number {
    for (const record of habitRecords) {
      const habit = habitMap.get(record.habitId);
      if (habit?.name === 'Работа' && record.actualMinutes > 240) {
        return -15;
      }
    }
    return 0;
  }

  /**
   * Yerkes-Dodson Law
   * +10 for timely completion of tasks
   */
  private yerkesDodssonLaw(tasks: Task[]): number {
    const completedOnTime = tasks.filter(t => 
      t.completed && 
      t.estimatedMinutes && 
      t.actualMinutes && 
      t.actualMinutes <= t.estimatedMinutes * 1.1
    ).length;
    
    const totalCompleted = tasks.filter(t => t.completed).length;
    
    if (totalCompleted === 0) return 0;
    
    const timelyRate = completedOnTime / totalCompleted;
    return timelyRate >= 0.8 ? 10 : 0;
  }

  /**
   * Pomodoro Technique
   * +10 for using focused work blocks
   */
  private pomodoroTechnique(habitRecords: HabitRecord[]): number {
    // Check if work was done in focused blocks (25-50 minute sessions)
    for (const record of habitRecords) {
      if (record.actualMinutes >= 25 && record.actualMinutes <= 50) {
        return 10;
      }
    }
    return 0;
  }

  /**
   * Deep Work Principle
   * +15 for sustained focus without multitasking
   */
  private deepWork(habitRecords: HabitRecord[], habitMap: Map<string, Habit>): number {
    // Check for sustained work sessions
    const workRecord = habitRecords.find(r => {
      const habit = habitMap.get(r.habitId);
      return habit?.name === 'Работа';
    });
    
    if (workRecord && workRecord.actualMinutes >= 90) {
      return 15; // Deep work session
    }
    
    return 0;
  }

  /**
   * Time Blocking
   * +10 for planned vs actual time alignment
   */
  private timeBlocking(tasks: Task[]): number {
    const alignedTasks = tasks.filter(t => 
      t.completed && 
      t.estimatedMinutes && 
      t.actualMinutes &&
      Math.abs(t.actualMinutes - t.estimatedMinutes) <= t.estimatedMinutes * 0.2
    ).length;
    
    const totalTasks = tasks.filter(t => t.completed && t.estimatedMinutes).length;
    
    if (totalTasks === 0) return 0;
    
    return (alignedTasks / totalTasks) >= 0.7 ? 10 : 0;
  }

  /**
   * Habit Stacking
   * +10 for completing related habits in sequence
   */
  private habitStacking(habitRecords: HabitRecord[]): number {
    // Simplified: bonus for completing multiple habits
    const completedHabits = habitRecords.filter(r => r.actualMinutes > 0).length;
    return completedHabits >= 5 ? 10 : 0;
  }

  /**
   * Compound Effect (1% better)
   * +5 for consistency streaks
   */
  private compoundEffect(habitRecords: HabitRecord[]): number {
    // This would need streak data from database
    // For now, bonus for completing most habits
    const completionRate = habitRecords.filter(r => r.actualMinutes > 0).length / habitRecords.length;
    return completionRate >= 0.8 ? 5 : 0;
  }

  /**
   * Focus Blocks
   * +12 for maintaining focus without context switching
   */
  private focusBlocks(tasks: Task[]): number {
    // Check if tasks were completed in focused manner (no multitasking)
    const focusedTasks = tasks.filter(t => 
      t.completed && 
      t.actualMinutes && 
      t.actualMinutes >= 25
    ).length;
    
    return focusedTasks >= 2 ? 12 : 0;
  }

  // ===== UTILITY METHODS =====

  /**
   * Sum all efficiency coefficients
   */
  private sumEfficiencyCoefficients(coefficients: EfficiencyCoefficients): number {
    return Object.values(coefficients).reduce((sum, coeff) => sum + (coeff || 0), 0);
  }

  /**
   * Get adjusted target for weekday-only habits
   */
  private getAdjustedTarget(habit: Habit, date: Date): number {
    if (habit.isWeekdayOnly) {
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      // Work habit: 360 min weekdays, 180 min weekends
      if (habit.name === 'Работа') {
        return isWeekend ? 180 : 360;
      }
    }
    
    return habit.targetMinutes;
  }

  /**
   * Validate KPI calculation inputs
   */
  validateInputs(
    habitRecords: HabitRecord[],
    tasks: Task[],
    habits: Habit[],
    revolutPillars: RevolutPillars,
    streakData?: Map<string, number>
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate habit records
    if (!Array.isArray(habitRecords)) {
      errors.push('Habit records must be an array');
    }

    // Validate tasks
    if (!Array.isArray(tasks)) {
      errors.push('Tasks must be an array');
    }

    if (tasks.length > 5) {
      errors.push('Maximum 5 tasks allowed per day');
    }

    // Validate Revolut pillars
    if (revolutPillars.deliverables < 0 || revolutPillars.deliverables > 100) {
      errors.push('Deliverables must be between 0 and 100');
    }

    if (revolutPillars.skills < 0 || revolutPillars.skills > 100) {
      errors.push('Skills must be between 0 and 100');
    }

    if (revolutPillars.culture < 0 || revolutPillars.culture > 100) {
      errors.push('Culture must be between 0 and 100');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const kpiCalculator = new KPICalculator();