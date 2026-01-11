import { 
  HabitRecord, 
  Task, 
  Habit, 
  DailyRecord,
  EfficiencyCoefficients 
} from '../types/index.js';

/**
 * Productivity Books Integration Service
 * Implements principles from 10 key productivity books into KPI calculations
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */
export class ProductivityBooksService {

  /**
   * Calculate compound 1% principle from "Atomic Habits" by James Clear
   * Requirement 10.1: Compound 1% improvement in streak calculations
   */
  calculateAtomicHabitsBonus(
    habitRecords: HabitRecord[],
    habits: Habit[],
    streakData?: Map<string, number>
  ): number {
    let bonus = 0;
    const habitMap = new Map(habits.map(h => [h.id, h]));

    // 1. Compound 1% - Streak bonus
    if (streakData) {
      for (const [habitId, streak] of streakData) {
        if (streak >= 7) bonus += 5;   // 1 week streak
        if (streak >= 21) bonus += 10; // 3 weeks (habit formation)
        if (streak >= 66) bonus += 15; // 66 days (habit automation)
      }
    }

    // 2. Habit Stacking - Bonus for completing related habits in sequence
    const completedHabits = habitRecords.filter(r => r.actualMinutes > 0);
    if (completedHabits.length >= 5) {
      bonus += 8; // Good habit stacking
    }

    // 3. Environment Design - Bonus for consistent timing/quality
    const consistentHabits = habitRecords.filter(r => 
      r.qualityScore && r.qualityScore >= 4
    ).length;
    
    if (consistentHabits >= 3) {
      bonus += 7; // Environment supports habits
    }

    // 4. Identity-based habits - Bonus for skill-building habits
    for (const record of habitRecords) {
      const habit = habitMap.get(record.habitId);
      if (habit?.category === 'skills' && record.actualMinutes > habit.targetMinutes) {
        bonus += 3; // Identity reinforcement
      }
    }

    return Math.min(bonus, 25); // Cap at 25 points
  }

  /**
   * Calculate "7 Habits of Highly Effective People" by Stephen Covey principles
   * Requirement 10.2: Q2 Matrix integration in prioritization
   */
  calculateSevenHabitsBonus(
    habitRecords: HabitRecord[],
    tasks: Task[],
    habits: Habit[]
  ): number {
    let bonus = 0;
    const habitMap = new Map(habits.map(h => [h.id, h]));

    // 1. Begin with the End in Mind - Strategic task completion
    const strategicTasks = tasks.filter(t => 
      t.completed && t.priority === 'high'
    ).length;
    bonus += strategicTasks * 3;

    // 2. Put First Things First - Q2 Focus
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

    if (totalTime > 0) {
      const q2Percentage = (q2Time / totalTime) * 100;
      if (q2Percentage >= 60) bonus += 15;      // Excellent Q2 focus
      else if (q2Percentage >= 50) bonus += 12; // Good Q2 focus
      else if (q2Percentage >= 40) bonus += 8;  // Moderate Q2 focus
    }

    // 3. Think Win-Win - Balanced life areas
    const categories = new Set(
      habitRecords
        .filter(r => r.actualMinutes > 0)
        .map(r => habitMap.get(r.habitId)?.category)
        .filter(Boolean)
    );
    
    if (categories.size >= 4) bonus += 10; // Balanced approach

    // 4. Sharpen the Saw - Self-renewal activities
    const renewalHabits = ['Сон', 'Спорт', 'Чтение', 'Отдых'];
    const renewalScore = habitRecords
      .filter(r => {
        const habit = habitMap.get(r.habitId);
        return habit && renewalHabits.includes(habit.name) && r.actualMinutes > 0;
      }).length;
    
    bonus += renewalScore * 2;

    return Math.min(bonus, 30); // Cap at 30 points
  }

  /**
   * Calculate "Deep Work" by Cal Newport principles
   * Requirement 10.3: Deep Work principles for focus blocks
   */
  calculateDeepWorkBonus(
    habitRecords: HabitRecord[],
    tasks: Task[],
    habits: Habit[]
  ): number {
    let bonus = 0;
    const habitMap = new Map(habits.map(h => [h.id, h]));

    // 1. Deep Work Sessions - Sustained focus without interruption
    const workRecord = habitRecords.find(r => {
      const habit = habitMap.get(r.habitId);
      return habit?.name === 'Работа';
    });

    if (workRecord) {
      if (workRecord.actualMinutes >= 90) bonus += 15;      // 90+ min deep work
      else if (workRecord.actualMinutes >= 60) bonus += 10; // 60+ min focused work
      else if (workRecord.actualMinutes >= 45) bonus += 5;  // 45+ min work block
    }

    // 2. Attention Residue Minimization - Single-tasking
    const focusedTasks = tasks.filter(t => 
      t.completed && 
      t.actualMinutes && 
      t.actualMinutes >= 25 // Minimum focus block
    ).length;

    if (focusedTasks >= 3) bonus += 12; // Multiple deep work blocks
    else if (focusedTasks >= 2) bonus += 8;
    else if (focusedTasks >= 1) bonus += 4;

    // 3. Productive Meditation - Learning while doing routine tasks
    const learningHabits = habitRecords.filter(r => {
      const habit = habitMap.get(r.habitId);
      return habit?.category === 'learning' && r.actualMinutes > 0;
    }).length;

    bonus += learningHabits * 3;

    // 4. Digital Minimalism - Quality over quantity in tasks
    const highQualityWork = habitRecords.filter(r => 
      r.qualityScore && r.qualityScore >= 4
    ).length;

    if (highQualityWork >= 3) bonus += 8;

    return Math.min(bonus, 25); // Cap at 25 points
  }

  /**
   * Calculate "The ONE Thing" by Gary Keller principles
   * Requirement 10.4: 80/20 rule integration in coefficients
   */
  calculateOneThingBonus(
    habitRecords: HabitRecord[],
    tasks: Task[],
    habits: Habit[]
  ): number {
    let bonus = 0;
    const habitMap = new Map(habits.map(h => [h.id, h]));

    // 1. The 80/20 Principle - Focus on high-impact activities
    const highPriorityTasks = tasks.filter(t => t.priority === 'high').length;
    const totalTasks = tasks.length;

    if (totalTasks > 0) {
      const highPriorityRatio = highPriorityTasks / totalTasks;
      if (highPriorityRatio >= 0.8) bonus += 15;      // Excellent focus
      else if (highPriorityRatio >= 0.6) bonus += 12; // Good focus
      else if (highPriorityRatio >= 0.4) bonus += 8;  // Moderate focus
    }

    // 2. Time Blocking - Dedicated time for most important work
    const mostImportantHabits = ['Работа', 'Английский', 'ИИ'];
    let focusedTime = 0;

    for (const record of habitRecords) {
      const habit = habitMap.get(record.habitId);
      if (habit && mostImportantHabits.includes(habit.name)) {
        focusedTime += record.actualMinutes;
      }
    }

    if (focusedTime >= 180) bonus += 12; // 3+ hours on key activities
    else if (focusedTime >= 120) bonus += 8;  // 2+ hours
    else if (focusedTime >= 60) bonus += 4;   // 1+ hour

    // 3. Goal Setting to the Now - Alignment with long-term goals
    const strategicHabits = habitRecords.filter(r => {
      const habit = habitMap.get(r.habitId);
      return habit?.eisenhowerQuadrant === 'Q2' && r.actualMinutes > 0;
    }).length;

    bonus += strategicHabits * 2;

    // 4. The Domino Effect - Small actions leading to big results
    const completionRate = habitRecords.filter(r => r.actualMinutes > 0).length / habitRecords.length;
    if (completionRate >= 0.8) bonus += 10;

    return Math.min(bonus, 30); // Cap at 30 points
  }

  /**
   * Calculate "Getting Things Done" by David Allen principles
   */
  calculateGTDBonus(tasks: Task[]): number {
    let bonus = 0;

    // 1. Capture Everything - Having all tasks recorded
    if (tasks.length >= 3) bonus += 5; // Good task capture

    // 2. Clarify and Organize - Clear task definitions
    const clarifiedTasks = tasks.filter(t => 
      t.estimatedMinutes && t.estimatedMinutes > 0
    ).length;
    
    bonus += clarifiedTasks * 2;

    // 3. Review and Engage - Task completion
    const completedTasks = tasks.filter(t => t.completed).length;
    const completionRate = tasks.length > 0 ? completedTasks / tasks.length : 0;
    
    if (completionRate >= 0.8) bonus += 10;
    else if (completionRate >= 0.6) bonus += 7;
    else if (completionRate >= 0.4) bonus += 4;

    return Math.min(bonus, 15);
  }

  /**
   * Calculate "Eat That Frog" by Brian Tracy principles
   */
  calculateEatThatFrogBonus(tasks: Task[]): number {
    let bonus = 0;

    // 1. Do the hardest task first
    const highPriorityCompleted = tasks.filter(t => 
      t.completed && t.priority === 'high'
    ).length;
    
    bonus += highPriorityCompleted * 5;

    // 2. Plan every day in advance
    const plannedTasks = tasks.filter(t => 
      t.estimatedMinutes && t.estimatedMinutes > 0
    ).length;
    
    if (plannedTasks === tasks.length && tasks.length > 0) bonus += 8;

    // 3. Apply 80/20 to everything
    if (tasks.length > 0) {
      const highPriorityRatio = tasks.filter(t => t.priority === 'high').length / tasks.length;
      if (highPriorityRatio >= 0.2) bonus += 6; // Following 80/20 rule
    }

    return Math.min(bonus, 15);
  }

  /**
   * Calculate "The Power of Habit" by Charles Duhigg principles
   */
  calculatePowerOfHabitBonus(habitRecords: HabitRecord[], habits: Habit[]): number {
    let bonus = 0;
    const habitMap = new Map(habits.map(h => [h.id, h]));

    // 1. Habit Loop - Consistent execution
    const consistentHabits = habitRecords.filter(r => {
      const habit = habitMap.get(r.habitId);
      return habit && r.actualMinutes >= habit.targetMinutes * 0.8;
    }).length;

    bonus += consistentHabits * 2;

    // 2. Keystone Habits - High-impact habits that trigger others
    const keystoneHabits = ['Сон', 'Спорт', 'Работа'];
    const keystoneScore = habitRecords.filter(r => {
      const habit = habitMap.get(r.habitId);
      return habit && keystoneHabits.includes(habit.name) && r.actualMinutes > 0;
    }).length;

    bonus += keystoneScore * 3;

    // 3. Small Wins - Completing easier habits builds momentum
    const smallWins = habitRecords.filter(r => r.actualMinutes > 0).length;
    if (smallWins >= 7) bonus += 10;
    else if (smallWins >= 5) bonus += 7;
    else if (smallWins >= 3) bonus += 4;

    return Math.min(bonus, 20);
  }

  /**
   * Calculate "Mindset" by Carol Dweck principles
   */
  calculateMindsetBonus(habitRecords: HabitRecord[], habits: Habit[]): number {
    let bonus = 0;
    const habitMap = new Map(habits.map(h => [h.id, h]));

    // 1. Growth Mindset - Exceeding targets in learning
    for (const record of habitRecords) {
      const habit = habitMap.get(record.habitId);
      if (habit?.category === 'skills' || habit?.category === 'learning') {
        if (record.actualMinutes > habit.targetMinutes) {
          bonus += 5; // Growth mindset in action
        }
      }
    }

    // 2. Effort over Talent - Consistent practice
    const practiceHabits = ['Английский', 'ИИ', 'Аналитика', 'Права'];
    const practiceScore = habitRecords.filter(r => {
      const habit = habitMap.get(r.habitId);
      return habit && practiceHabits.includes(habit.name) && r.actualMinutes > 0;
    }).length;

    bonus += practiceScore * 3;

    // 3. Learning from Challenges
    const challengingHabits = habitRecords.filter(r => {
      const habit = habitMap.get(r.habitId);
      return habit && habit.skillLevel <= 2 && r.actualMinutes > 0; // Working on weak areas
    }).length;

    bonus += challengingHabits * 4;

    return Math.min(bonus, 20);
  }

  /**
   * Calculate "The 4-Hour Workweek" by Tim Ferriss principles
   */
  calculateFourHourWorkweekBonus(
    habitRecords: HabitRecord[],
    tasks: Task[],
    habits: Habit[]
  ): number {
    let bonus = 0;
    const habitMap = new Map(habits.map(h => [h.id, h]));

    // 1. Elimination - Focusing on essential tasks only
    if (tasks.length <= 3) bonus += 8; // Focused task list

    // 2. Automation - Efficient execution
    const efficientTasks = tasks.filter(t => 
      t.completed && 
      t.estimatedMinutes && 
      t.actualMinutes && 
      t.actualMinutes <= t.estimatedMinutes
    ).length;

    bonus += efficientTasks * 3;

    // 3. Liberation - Work-life balance
    const workRecord = habitRecords.find(r => {
      const habit = habitMap.get(r.habitId);
      return habit?.name === 'Работа';
    });

    const restRecord = habitRecords.find(r => {
      const habit = habitMap.get(r.habitId);
      return habit?.name === 'Отдых';
    });

    if (workRecord && restRecord && restRecord.actualMinutes >= 120) {
      bonus += 10; // Good work-life balance
    }

    return Math.min(bonus, 15);
  }

  /**
   * Calculate "Essentialism" by Greg McKeown principles
   */
  calculateEssentialismBonus(
    habitRecords: HabitRecord[],
    tasks: Task[],
    habits: Habit[]
  ): number {
    let bonus = 0;

    // 1. Less but Better - Quality over quantity
    const highQualityWork = habitRecords.filter(r => 
      r.qualityScore && r.qualityScore >= 4
    ).length;

    bonus += highQualityWork * 3;

    // 2. The Disciplined Pursuit of Less - Focused task list
    if (tasks.length <= 3 && tasks.filter(t => t.completed).length >= 2) {
      bonus += 12; // Excellent focus
    } else if (tasks.length <= 5 && tasks.filter(t => t.completed).length >= 3) {
      bonus += 8; // Good focus
    }

    // 3. Trade-offs - Saying no to non-essential
    const essentialHabits = habitRecords.filter(r => {
      const habit = habits.find(h => h.id === r.habitId);
      return habit?.eisenhowerQuadrant === 'Q2' && r.actualMinutes > 0;
    }).length;

    bonus += essentialHabits * 2;

    return Math.min(bonus, 20);
  }

  /**
   * Main method to calculate all productivity book bonuses
   * Integrates all 10 book principles into a single coefficient
   */
  calculateProductivityBooksCoefficient(
    habitRecords: HabitRecord[],
    tasks: Task[],
    habits: Habit[],
    streakData?: Map<string, number>
  ): number {
    let totalBonus = 0;

    // Core 4 books (higher weight)
    totalBonus += this.calculateAtomicHabitsBonus(habitRecords, habits, streakData) * 1.2;
    totalBonus += this.calculateSevenHabitsBonus(habitRecords, tasks, habits) * 1.2;
    totalBonus += this.calculateDeepWorkBonus(habitRecords, tasks, habits) * 1.2;
    totalBonus += this.calculateOneThingBonus(habitRecords, tasks, habits) * 1.2;

    // Supporting 6 books (standard weight)
    totalBonus += this.calculateGTDBonus(tasks);
    totalBonus += this.calculateEatThatFrogBonus(tasks);
    totalBonus += this.calculatePowerOfHabitBonus(habitRecords, habits);
    totalBonus += this.calculateMindsetBonus(habitRecords, habits);
    totalBonus += this.calculateFourHourWorkweekBonus(habitRecords, tasks, habits);
    totalBonus += this.calculateEssentialismBonus(habitRecords, tasks, habits);

    // Cap total bonus to prevent inflation
    return Math.min(totalBonus, 50);
  }

  /**
   * Get detailed breakdown of productivity principles applied
   */
  getProductivityBreakdown(
    habitRecords: HabitRecord[],
    tasks: Task[],
    habits: Habit[],
    streakData?: Map<string, number>
  ): {
    atomicHabits: number;
    sevenHabits: number;
    deepWork: number;
    oneThingPrinciple: number;
    gettingThingsDone: number;
    eatThatFrog: number;
    powerOfHabit: number;
    mindset: number;
    fourHourWorkweek: number;
    essentialism: number;
    total: number;
  } {
    const breakdown = {
      atomicHabits: this.calculateAtomicHabitsBonus(habitRecords, habits, streakData),
      sevenHabits: this.calculateSevenHabitsBonus(habitRecords, tasks, habits),
      deepWork: this.calculateDeepWorkBonus(habitRecords, tasks, habits),
      oneThingPrinciple: this.calculateOneThingBonus(habitRecords, tasks, habits),
      gettingThingsDone: this.calculateGTDBonus(tasks),
      eatThatFrog: this.calculateEatThatFrogBonus(tasks),
      powerOfHabit: this.calculatePowerOfHabitBonus(habitRecords, habits),
      mindset: this.calculateMindsetBonus(habitRecords, habits),
      fourHourWorkweek: this.calculateFourHourWorkweekBonus(habitRecords, tasks, habits),
      essentialism: this.calculateEssentialismBonus(habitRecords, tasks, habits),
      total: 0
    };

    breakdown.total = this.calculateProductivityBooksCoefficient(
      habitRecords, 
      tasks, 
      habits, 
      streakData
    );

    return breakdown;
  }
}

// Export singleton instance
export const productivityBooksService = new ProductivityBooksService();