import { Task, TaskPriority, EisenhowerQuadrant, Habit } from '../types/index.js';

/**
 * Priority Management Service
 * Implements task prioritization system with Eisenhower Matrix
 * Based on requirements 4.3, 6.1-6.5, and 8.1-8.5
 */
export class PriorityManager {

  /**
   * Calculate priority bonus for completed tasks
   * Requirement 4.3: +20 high priority, +10 medium priority
   */
  calculatePriorityBonus(tasks: Task[]): number {
    let bonus = 0;
    
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

    return bonus;
  }

  /**
   * Classify tasks by Eisenhower Matrix quadrants
   * Requirement 6.1: Q1-Q4 classification
   */
  classifyByEisenhowerMatrix(
    tasks: Task[],
    habits: Habit[]
  ): {
    Q1: Task[]; // Urgent + Important
    Q2: Task[]; // Important, Not Urgent
    Q3: Task[]; // Urgent, Not Important
    Q4: Task[]; // Neither Urgent nor Important
  } {
    const classification = {
      Q1: [] as Task[],
      Q2: [] as Task[],
      Q3: [] as Task[],
      Q4: [] as Task[]
    };

    for (const task of tasks) {
      const quadrant = this.determineTaskQuadrant(task, habits);
      classification[quadrant].push(task);
    }

    return classification;
  }

  /**
   * Determine which Eisenhower quadrant a task belongs to
   */
  private determineTaskQuadrant(task: Task, habits: Habit[]): EisenhowerQuadrant {
    // High priority tasks are typically urgent and important (Q1)
    if (task.priority === 'high') {
      return 'Q1';
    }

    // Medium priority tasks are usually important but not urgent (Q2)
    if (task.priority === 'medium') {
      return 'Q2';
    }

    // Low priority tasks are typically neither urgent nor important (Q4)
    // Unless they're urgent but not important (Q3)
    return 'Q4';
  }

  /**
   * Calculate Q2 focus bonus
   * Requirement 6.2: Bonus for focusing on Q2 (important, not urgent)
   */
  calculateQ2FocusBonus(tasks: Task[], habits: Habit[]): number {
    const classification = this.classifyByEisenhowerMatrix(tasks, habits);
    
    const totalTasks = tasks.length;
    const q2Tasks = classification.Q2.length;
    const completedQ2Tasks = classification.Q2.filter(t => t.completed).length;

    if (totalTasks === 0) return 0;

    // Bonus for having Q2 tasks
    const q2Ratio = q2Tasks / totalTasks;
    let bonus = 0;

    if (q2Ratio >= 0.6) {
      bonus += 15; // Excellent Q2 focus
    } else if (q2Ratio >= 0.4) {
      bonus += 10; // Good Q2 focus
    } else if (q2Ratio >= 0.2) {
      bonus += 5; // Some Q2 focus
    }

    // Additional bonus for completing Q2 tasks
    if (q2Tasks > 0) {
      const q2CompletionRate = completedQ2Tasks / q2Tasks;
      if (q2CompletionRate >= 0.8) {
        bonus += 10; // High Q2 completion
      } else if (q2CompletionRate >= 0.6) {
        bonus += 5; // Moderate Q2 completion
      }
    }

    return bonus;
  }

  /**
   * Analyze time distribution across quadrants
   * Requirement 6.4: Analytics for time distribution
   */
  analyzeTimeDistribution(tasks: Task[], habits: Habit[]): {
    Q1: { tasks: number; minutes: number; percentage: number };
    Q2: { tasks: number; minutes: number; percentage: number };
    Q3: { tasks: number; minutes: number; percentage: number };
    Q4: { tasks: number; minutes: number; percentage: number };
    totalMinutes: number;
  } {
    const classification = this.classifyByEisenhowerMatrix(tasks, habits);
    
    let totalMinutes = 0;
    const distribution = {
      Q1: { tasks: 0, minutes: 0, percentage: 0 },
      Q2: { tasks: 0, minutes: 0, percentage: 0 },
      Q3: { tasks: 0, minutes: 0, percentage: 0 },
      Q4: { tasks: 0, minutes: 0, percentage: 0 }
    };

    // Calculate time spent in each quadrant
    for (const [quadrant, quadrantTasks] of Object.entries(classification)) {
      const q = quadrant as EisenhowerQuadrant;
      distribution[q].tasks = quadrantTasks.length;
      
      for (const task of quadrantTasks) {
        const minutes = task.actualMinutes || task.estimatedMinutes || 0;
        distribution[q].minutes += minutes;
        totalMinutes += minutes;
      }
    }

    // Calculate percentages
    if (totalMinutes > 0) {
      for (const quadrant of ['Q1', 'Q2', 'Q3', 'Q4'] as EisenhowerQuadrant[]) {
        distribution[quadrant].percentage = (distribution[quadrant].minutes / totalMinutes) * 100;
      }
    }

    return {
      ...distribution,
      totalMinutes
    };
  }

  /**
   * Generate recommendations for time redistribution
   * Requirement 6.5: Recommendations for Q2 focus
   */
  generateRecommendations(tasks: Task[], habits: Habit[]): {
    recommendations: string[];
    currentQ2Focus: number;
    targetQ2Focus: number;
    actionItems: string[];
  } {
    const distribution = this.analyzeTimeDistribution(tasks, habits);
    const recommendations: string[] = [];
    const actionItems: string[] = [];

    const currentQ2Focus = distribution.Q2.percentage;
    const targetQ2Focus = 60; // Ideal Q2 focus percentage

    // Analyze current distribution
    if (currentQ2Focus < 40) {
      recommendations.push('🎯 Increase focus on Q2 activities (Important, Not Urgent)');
      actionItems.push('Schedule more time for skill development and learning');
      actionItems.push('Plan strategic activities that prevent future Q1 crises');
    }

    if (distribution.Q1.percentage > 40) {
      recommendations.push('🚨 Reduce Q1 activities by better planning and prevention');
      actionItems.push('Identify root causes of urgent tasks');
      actionItems.push('Implement preventive measures to avoid future crises');
    }

    if (distribution.Q3.percentage > 20) {
      recommendations.push('⚡ Minimize Q3 activities (Urgent but not Important)');
      actionItems.push('Delegate or eliminate interruptions and distractions');
      actionItems.push('Set boundaries to protect focused work time');
    }

    if (distribution.Q4.percentage > 15) {
      recommendations.push('🗑️ Eliminate Q4 activities (Neither Urgent nor Important)');
      actionItems.push('Review and remove time-wasting activities');
      actionItems.push('Replace low-value tasks with Q2 activities');
    }

    // Positive reinforcement
    if (currentQ2Focus >= 50) {
      recommendations.push('✅ Excellent Q2 focus! Keep prioritizing important activities');
    }

    if (distribution.Q1.percentage < 30 && currentQ2Focus > 40) {
      recommendations.push('🎉 Great balance between proactive (Q2) and reactive (Q1) work');
    }

    return {
      recommendations,
      currentQ2Focus,
      targetQ2Focus,
      actionItems
    };
  }

  /**
   * Validate task limits
   * Requirement 8.1: Maximum 5 tasks per day
   */
  validateTaskLimits(tasks: Task[]): { isValid: boolean; message?: string } {
    if (tasks.length > 5) {
      return {
        isValid: false,
        message: 'Maximum 5 tasks allowed per day to maintain focus and avoid overwhelm'
      };
    }

    return { isValid: true };
  }

  /**
   * Sort tasks by priority and strategic importance
   * Requirement 8.4: Display tasks in priority order
   */
  sortTasksByPriority(tasks: Task[], habits: Habit[]): Task[] {
    const classification = this.classifyByEisenhowerMatrix(tasks, habits);
    
    // Priority order: Q1 (urgent+important), Q2 (important), Q3 (urgent), Q4 (neither)
    const sortedTasks: Task[] = [];
    
    // Add Q1 tasks first (high priority)
    sortedTasks.push(...classification.Q1.sort((a, b) => 
      this.getPriorityWeight(a.priority) - this.getPriorityWeight(b.priority)
    ));
    
    // Add Q2 tasks second (medium priority, strategic)
    sortedTasks.push(...classification.Q2.sort((a, b) => 
      this.getPriorityWeight(a.priority) - this.getPriorityWeight(b.priority)
    ));
    
    // Add Q3 tasks third (urgent but not important)
    sortedTasks.push(...classification.Q3.sort((a, b) => 
      this.getPriorityWeight(a.priority) - this.getPriorityWeight(b.priority)
    ));
    
    // Add Q4 tasks last (low priority)
    sortedTasks.push(...classification.Q4.sort((a, b) => 
      this.getPriorityWeight(a.priority) - this.getPriorityWeight(b.priority)
    ));

    return sortedTasks;
  }

  /**
   * Get numeric weight for priority sorting
   */
  private getPriorityWeight(priority: TaskPriority): number {
    switch (priority) {
      case 'high': return 1;
      case 'medium': return 2;
      case 'low': return 3;
      default: return 4;
    }
  }

  /**
   * Calculate strategic task bonus
   * Additional bonus for tasks related to relocation/business goals
   */
  calculateStrategicBonus(tasks: Task[]): number {
    // Keywords that indicate strategic importance for relocation/business
    const strategicKeywords = [
      'переезд', 'relocation', 'visa', 'business', 'бизнес', 
      'english', 'английский', 'networking', 'portfolio', 
      'skills', 'навыки', 'learning', 'обучение'
    ];

    let strategicBonus = 0;

    for (const task of tasks) {
      if (task.completed && task.priority === 'high') {
        const isStrategic = strategicKeywords.some(keyword => 
          task.title.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (isStrategic) {
          strategicBonus += 10; // Additional bonus for strategic high-priority tasks
        }
      }
    }

    return strategicBonus;
  }
}

// Export singleton instance
export const priorityManager = new PriorityManager();