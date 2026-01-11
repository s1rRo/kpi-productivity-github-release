import { prisma } from '../index.js';
import { analyticsService } from './analyticsService.js';

/**
 * Goal Insights Service
 * Provides personalized insights based on goal graph analysis
 * Requirements: Personal insights based on goal graph
 */

export interface GoalGraphInsights {
  userId: string;
  generatedAt: Date;
  goalNetworkAnalysis: {
    totalGoals: number;
    activeGoals: number;
    completedGoals: number;
    goalTypes: {
      main: number;
      sub: number;
      task: number;
    };
    connectionDensity: number; // How interconnected the goals are
    criticalPath: GoalPathAnalysis[];
    bottleneckGoals: BottleneckGoal[];
  };
  progressInsights: {
    overallProgress: number;
    progressDistribution: {
      notStarted: number;
      inProgress: number;
      nearCompletion: number;
      completed: number;
    };
    stagnantGoals: StagnantGoal[];
    rapidProgressGoals: RapidProgressGoal[];
    goalMomentum: number; // Rate of progress change
  };
  habitGoalAlignment: {
    alignedHabits: AlignedHabit[];
    missingHabits: MissingHabit[];
    overAllocatedHabits: OverAllocatedHabit[];
    alignmentScore: number; // 0-100
  };
  strategicRecommendations: {
    priorityAdjustments: PriorityRecommendation[];
    goalRestructuring: RestructuringRecommendation[];
    habitOptimization: HabitOptimizationRecommendation[];
    timeAllocation: TimeAllocationRecommendation[];
  };
  predictiveAnalysis: {
    goalCompletionForecast: GoalCompletionForecast[];
    riskAssessment: GoalRiskAssessment[];
    opportunityIdentification: OpportunityIdentification[];
  };
}

export interface GoalPathAnalysis {
  pathId: string;
  goals: {
    goalId: string;
    title: string;
    progress: number;
    estimatedCompletionDays: number;
  }[];
  totalEstimatedDays: number;
  criticalityScore: number; // How important this path is
  blockers: string[];
  recommendations: string[];
}

export interface BottleneckGoal {
  goalId: string;
  title: string;
  progress: number;
  dependentGoals: number;
  impactScore: number;
  recommendations: string[];
}

export interface StagnantGoal {
  goalId: string;
  title: string;
  progress: number;
  daysSinceLastUpdate: number;
  potentialCauses: string[];
  actionItems: string[];
}

export interface RapidProgressGoal {
  goalId: string;
  title: string;
  progress: number;
  progressRate: number; // % per day
  estimatedCompletion: Date;
  successFactors: string[];
}

export interface AlignedHabit {
  habitId: string;
  habitName: string;
  goalIds: string[];
  alignmentStrength: number; // 0-100
  contribution: number; // How much this habit contributes to goal progress
}

export interface MissingHabit {
  recommendedHabitName: string;
  goalIds: string[];
  potentialImpact: number;
  description: string;
  targetMinutes: number;
}

export interface OverAllocatedHabit {
  habitId: string;
  habitName: string;
  currentMinutes: number;
  optimalMinutes: number;
  excessMinutes: number;
  reallocationSuggestions: string[];
}

export interface PriorityRecommendation {
  type: 'increase' | 'decrease' | 'maintain';
  goalId: string;
  goalTitle: string;
  currentPriority: number;
  recommendedPriority: number;
  reasoning: string;
  expectedImpact: string;
}

export interface RestructuringRecommendation {
  type: 'merge' | 'split' | 'reorder' | 'add_connection';
  goalIds: string[];
  description: string;
  benefits: string[];
  implementation: string[];
}

export interface HabitOptimizationRecommendation {
  habitId: string;
  habitName: string;
  currentAllocation: number;
  recommendedAllocation: number;
  affectedGoals: string[];
  reasoning: string;
  expectedOutcome: string;
}

export interface TimeAllocationRecommendation {
  goalId: string;
  goalTitle: string;
  currentTimeAllocation: number; // minutes per day
  recommendedTimeAllocation: number;
  source: 'reduce_other_goals' | 'increase_efficiency' | 'add_new_habits';
  implementation: string;
}

export interface GoalCompletionForecast {
  goalId: string;
  goalTitle: string;
  currentProgress: number;
  forecastedCompletionDate: Date;
  confidence: number; // 0-100
  assumptions: string[];
  riskFactors: string[];
}

export interface GoalRiskAssessment {
  goalId: string;
  goalTitle: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: {
    factor: string;
    impact: number; // 0-100
    likelihood: number; // 0-100
    mitigation: string;
  }[];
  overallRiskScore: number;
}

export interface OpportunityIdentification {
  type: 'quick_win' | 'high_impact' | 'synergy' | 'efficiency';
  title: string;
  description: string;
  goalIds: string[];
  potentialBenefit: string;
  effortRequired: 'low' | 'medium' | 'high';
  timeframe: string;
  actionSteps: string[];
}

export class GoalInsightsService {

  /**
   * Generate comprehensive goal-based insights for a user
   */
  async generateGoalInsights(userId: string): Promise<GoalGraphInsights> {
    // Get user's goals with connections and habits
    const goals = await prisma.goal.findMany({
      where: { userId },
      include: {
        fromConnections: {
          include: {
            toGoal: true
          }
        },
        toConnections: {
          include: {
            fromGoal: true
          }
        },
        generatedHabits: {
          include: {
            habit: true
          }
        }
      }
    });

    if (goals.length === 0) {
      return this.generateEmptyInsights(userId);
    }

    // Analyze goal network structure
    const goalNetworkAnalysis = this.analyzeGoalNetwork(goals);

    // Analyze progress patterns
    const progressInsights = await this.analyzeProgressPatterns(goals, userId);

    // Analyze habit-goal alignment
    const habitGoalAlignment = await this.analyzeHabitGoalAlignment(goals, userId);

    // Generate strategic recommendations
    const strategicRecommendations = this.generateStrategicRecommendations(
      goals,
      goalNetworkAnalysis,
      progressInsights,
      habitGoalAlignment
    );

    // Generate predictive analysis
    const predictiveAnalysis = await this.generatePredictiveAnalysis(goals, userId);

    return {
      userId,
      generatedAt: new Date(),
      goalNetworkAnalysis,
      progressInsights,
      habitGoalAlignment,
      strategicRecommendations,
      predictiveAnalysis
    };
  }

  /**
   * Analyze the structure and connectivity of the goal network
   */
  private analyzeGoalNetwork(goals: any[]): GoalGraphInsights['goalNetworkAnalysis'] {
    const totalGoals = goals.length;
    const activeGoals = goals.filter(g => g.status === 'active').length;
    const completedGoals = goals.filter(g => g.status === 'completed').length;

    const goalTypes = {
      main: goals.filter(g => g.type === 'main').length,
      sub: goals.filter(g => g.type === 'sub').length,
      task: goals.filter(g => g.type === 'task').length
    };

    // Calculate connection density
    const totalConnections = goals.reduce((sum, goal) => sum + goal.fromConnections.length, 0);
    const maxPossibleConnections = totalGoals * (totalGoals - 1);
    const connectionDensity = maxPossibleConnections > 0 ? (totalConnections / maxPossibleConnections) * 100 : 0;

    // Identify critical paths
    const criticalPath = this.identifyCriticalPaths(goals);

    // Identify bottleneck goals
    const bottleneckGoals = this.identifyBottleneckGoals(goals);

    return {
      totalGoals,
      activeGoals,
      completedGoals,
      goalTypes,
      connectionDensity: Math.round(connectionDensity * 100) / 100,
      criticalPath,
      bottleneckGoals
    };
  }

  /**
   * Analyze progress patterns across goals
   */
  private async analyzeProgressPatterns(goals: any[], userId: string): Promise<GoalGraphInsights['progressInsights']> {
    const overallProgress = goals.length > 0 
      ? goals.reduce((sum, g) => sum + g.progress, 0) / goals.length 
      : 0;

    const progressDistribution = {
      notStarted: goals.filter(g => g.progress === 0).length,
      inProgress: goals.filter(g => g.progress > 0 && g.progress < 80).length,
      nearCompletion: goals.filter(g => g.progress >= 80 && g.progress < 100).length,
      completed: goals.filter(g => g.progress === 100).length
    };

    // Identify stagnant goals (simplified - would need historical progress data)
    const stagnantGoals: StagnantGoal[] = goals
      .filter(g => g.progress > 0 && g.progress < 100)
      .map(goal => ({
        goalId: goal.id,
        title: goal.title,
        progress: goal.progress,
        daysSinceLastUpdate: Math.floor(Math.random() * 30), // Simulated
        potentialCauses: this.identifyStagnationCauses(goal),
        actionItems: this.generateStagnationActionItems(goal)
      }))
      .filter(g => g.daysSinceLastUpdate > 7)
      .slice(0, 5);

    // Identify rapid progress goals
    const rapidProgressGoals: RapidProgressGoal[] = goals
      .filter(g => g.progress > 20 && g.progress < 100)
      .map(goal => ({
        goalId: goal.id,
        title: goal.title,
        progress: goal.progress,
        progressRate: Math.random() * 5 + 1, // Simulated progress rate
        estimatedCompletion: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000),
        successFactors: this.identifySuccessFactors(goal)
      }))
      .filter(g => g.progressRate > 3)
      .slice(0, 3);

    // Calculate goal momentum (simplified)
    const goalMomentum = rapidProgressGoals.length > stagnantGoals.length ? 75 : 
                        rapidProgressGoals.length === stagnantGoals.length ? 50 : 25;

    return {
      overallProgress: Math.round(overallProgress * 100) / 100,
      progressDistribution,
      stagnantGoals,
      rapidProgressGoals,
      goalMomentum
    };
  }

  /**
   * Analyze alignment between habits and goals
   */
  private async analyzeHabitGoalAlignment(goals: any[], userId: string): Promise<GoalGraphInsights['habitGoalAlignment']> {
    // Get user's habits
    const userHabits = await prisma.habit.findMany();

    // Get user's daily records to understand habit usage
    const recentRecords = await prisma.dailyRecord.findMany({
      where: {
        userId,
        date: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      include: {
        habitRecords: true
      }
    });

    // Calculate aligned habits
    const alignedHabits: AlignedHabit[] = [];
    for (const goal of goals) {
      for (const goalHabit of goal.generatedHabits) {
        const habit = goalHabit.habit;
        const alignmentStrength = this.calculateAlignmentStrength(goal, habit, recentRecords);
        const contribution = this.calculateHabitContribution(goal, habit, recentRecords);

        const existingAlignment = alignedHabits.find(ah => ah.habitId === habit.id);
        if (existingAlignment) {
          existingAlignment.goalIds.push(goal.id);
          existingAlignment.alignmentStrength = Math.max(existingAlignment.alignmentStrength, alignmentStrength);
          existingAlignment.contribution += contribution;
        } else {
          alignedHabits.push({
            habitId: habit.id,
            habitName: habit.name,
            goalIds: [goal.id],
            alignmentStrength,
            contribution
          });
        }
      }
    }

    // Identify missing habits
    const missingHabits = this.identifyMissingHabits(goals, alignedHabits);

    // Identify over-allocated habits
    const overAllocatedHabits = this.identifyOverAllocatedHabits(alignedHabits, recentRecords);

    // Calculate alignment score
    const alignmentScore = this.calculateOverallAlignmentScore(goals, alignedHabits, missingHabits);

    return {
      alignedHabits: alignedHabits.sort((a, b) => b.alignmentStrength - a.alignmentStrength),
      missingHabits,
      overAllocatedHabits,
      alignmentScore
    };
  }

  /**
   * Generate strategic recommendations based on analysis
   */
  private generateStrategicRecommendations(
    goals: any[],
    networkAnalysis: any,
    progressInsights: any,
    habitAlignment: any
  ): GoalGraphInsights['strategicRecommendations'] {
    const priorityAdjustments = this.generatePriorityRecommendations(goals, progressInsights);
    const goalRestructuring = this.generateRestructuringRecommendations(goals, networkAnalysis);
    const habitOptimization = this.generateHabitOptimizationRecommendations(habitAlignment);
    const timeAllocation = this.generateTimeAllocationRecommendations(goals, habitAlignment);

    return {
      priorityAdjustments,
      goalRestructuring,
      habitOptimization,
      timeAllocation
    };
  }

  /**
   * Generate predictive analysis for goals
   */
  private async generatePredictiveAnalysis(goals: any[], userId: string): Promise<GoalGraphInsights['predictiveAnalysis']> {
    const goalCompletionForecast = this.generateCompletionForecasts(goals);
    const riskAssessment = this.generateRiskAssessments(goals);
    const opportunityIdentification = this.identifyOpportunities(goals);

    return {
      goalCompletionForecast,
      riskAssessment,
      opportunityIdentification
    };
  }

  // Helper methods for analysis

  private identifyCriticalPaths(goals: any[]): GoalPathAnalysis[] {
    // Simplified critical path analysis
    const mainGoals = goals.filter(g => g.type === 'main' && g.status === 'active');
    
    return mainGoals.slice(0, 3).map(goal => ({
      pathId: `path_${goal.id}`,
      goals: [{
        goalId: goal.id,
        title: goal.title,
        progress: goal.progress,
        estimatedCompletionDays: Math.ceil((100 - goal.progress) / 2) // Simplified estimation
      }],
      totalEstimatedDays: Math.ceil((100 - goal.progress) / 2),
      criticalityScore: goal.type === 'main' ? 90 : 70,
      blockers: goal.progress < 10 ? ['Low initial progress', 'Needs habit alignment'] : [],
      recommendations: ['Focus daily effort', 'Track progress weekly', 'Adjust habits if needed']
    }));
  }

  private identifyBottleneckGoals(goals: any[]): BottleneckGoal[] {
    return goals
      .filter(g => g.fromConnections.length > 2) // Goals with many dependencies
      .slice(0, 3)
      .map(goal => ({
        goalId: goal.id,
        title: goal.title,
        progress: goal.progress,
        dependentGoals: goal.fromConnections.length,
        impactScore: goal.fromConnections.length * 20,
        recommendations: [
          'Prioritize this goal to unblock others',
          'Consider breaking into smaller tasks',
          'Allocate more daily time'
        ]
      }));
  }

  private identifyStagnationCauses(goal: any): string[] {
    const causes = [];
    
    if (goal.progress < 20) causes.push('Lack of initial momentum');
    if (goal.generatedHabits.length === 0) causes.push('No supporting habits');
    if (goal.type === 'main') causes.push('Goal too broad, needs breakdown');
    
    return causes;
  }

  private generateStagnationActionItems(goal: any): string[] {
    return [
      'Review and update goal definition',
      'Create or adjust supporting habits',
      'Set smaller milestone targets',
      'Schedule dedicated time blocks'
    ];
  }

  private identifySuccessFactors(goal: any): string[] {
    const factors = [];
    
    if (goal.generatedHabits.length > 0) factors.push('Strong habit support');
    if (goal.progress > 50) factors.push('Good momentum');
    if (goal.type === 'task') factors.push('Clear, actionable scope');
    
    return factors;
  }

  private calculateAlignmentStrength(goal: any, habit: any, recentRecords: any[]): number {
    // Simplified alignment calculation
    const habitUsage = recentRecords.reduce((sum, record) => {
      const habitRecord = record.habitRecords.find((hr: any) => hr.habitId === habit.id);
      return sum + (habitRecord ? habitRecord.actualMinutes : 0);
    }, 0);

    return Math.min((habitUsage / (habit.targetMinutes * recentRecords.length)) * 100, 100);
  }

  private calculateHabitContribution(goal: any, habit: any, recentRecords: any[]): number {
    // Simplified contribution calculation based on habit category and goal type
    const categoryContributions: { [key: string]: number } = {
      'skills': 80,
      'learning': 70,
      'career': 85,
      'health': 60
    };

    return categoryContributions[habit.category] || 50;
  }

  private identifyMissingHabits(goals: any[], alignedHabits: AlignedHabit[]): MissingHabit[] {
    const missingHabits: MissingHabit[] = [];
    
    // Check for goals without supporting habits
    for (const goal of goals) {
      if (goal.generatedHabits.length === 0 && goal.status === 'active') {
        missingHabits.push({
          recommendedHabitName: `${goal.title} Practice`,
          goalIds: [goal.id],
          potentialImpact: 75,
          description: `Create a daily habit to support progress on "${goal.title}"`,
          targetMinutes: 30
        });
      }
    }

    return missingHabits.slice(0, 3);
  }

  private identifyOverAllocatedHabits(alignedHabits: AlignedHabit[], recentRecords: any[]): OverAllocatedHabit[] {
    // Simplified over-allocation detection
    return alignedHabits
      .filter(ah => ah.contribution > 100) // Habits contributing to too many goals
      .slice(0, 2)
      .map(ah => ({
        habitId: ah.habitId,
        habitName: ah.habitName,
        currentMinutes: 60, // Simplified
        optimalMinutes: 45,
        excessMinutes: 15,
        reallocationSuggestions: ['Reduce frequency', 'Split into focused sessions']
      }));
  }

  private calculateOverallAlignmentScore(goals: any[], alignedHabits: AlignedHabit[], missingHabits: MissingHabit[]): number {
    const activeGoals = goals.filter(g => g.status === 'active').length;
    const supportedGoals = alignedHabits.reduce((sum, ah) => sum + ah.goalIds.length, 0);
    
    if (activeGoals === 0) return 100;
    
    const baseScore = (supportedGoals / activeGoals) * 100;
    const penalty = missingHabits.length * 10;
    
    return Math.max(0, Math.min(100, baseScore - penalty));
  }

  private generatePriorityRecommendations(goals: any[], progressInsights: any): PriorityRecommendation[] {
    const recommendations: PriorityRecommendation[] = [];

    // Recommend increasing priority for stagnant important goals
    for (const stagnantGoal of progressInsights.stagnantGoals.slice(0, 2)) {
      const goal = goals.find(g => g.id === stagnantGoal.goalId);
      if (goal && goal.type === 'main') {
        recommendations.push({
          type: 'increase',
          goalId: goal.id,
          goalTitle: goal.title,
          currentPriority: 50, // Simplified
          recommendedPriority: 80,
          reasoning: 'This important goal has been stagnant and needs more focus',
          expectedImpact: 'Resume progress within 1-2 weeks'
        });
      }
    }

    return recommendations;
  }

  private generateRestructuringRecommendations(goals: any[], networkAnalysis: any): RestructuringRecommendation[] {
    const recommendations: RestructuringRecommendation[] = [];

    // Recommend splitting large goals with low progress
    const largeStagnantGoals = goals.filter(g => 
      g.type === 'main' && g.progress < 20 && g.fromConnections.length < 2
    );

    for (const goal of largeStagnantGoals.slice(0, 2)) {
      recommendations.push({
        type: 'split',
        goalIds: [goal.id],
        description: `Break "${goal.title}" into smaller, actionable sub-goals`,
        benefits: ['Clearer progress tracking', 'Better motivation', 'Easier habit alignment'],
        implementation: ['Identify 3-5 key milestones', 'Create sub-goals for each', 'Connect with specific habits']
      });
    }

    return recommendations;
  }

  private generateHabitOptimizationRecommendations(habitAlignment: any): HabitOptimizationRecommendation[] {
    const recommendations: HabitOptimizationRecommendation[] = [];

    // Recommend optimizing under-performing aligned habits
    const underPerformingHabits = habitAlignment.alignedHabits.filter((ah: any) => ah.alignmentStrength < 60);

    for (const habit of underPerformingHabits.slice(0, 2)) {
      recommendations.push({
        habitId: habit.habitId,
        habitName: habit.habitName,
        currentAllocation: 30, // Simplified
        recommendedAllocation: 45,
        affectedGoals: habit.goalIds,
        reasoning: 'This habit is underutilized relative to its goal importance',
        expectedOutcome: 'Improved goal progress and better habit consistency'
      });
    }

    return recommendations;
  }

  private generateTimeAllocationRecommendations(goals: any[], habitAlignment: any): TimeAllocationRecommendation[] {
    const recommendations: TimeAllocationRecommendation[] = [];

    // Recommend time reallocation for high-priority goals
    const highPriorityGoals = goals.filter(g => g.type === 'main' && g.status === 'active').slice(0, 2);

    for (const goal of highPriorityGoals) {
      recommendations.push({
        goalId: goal.id,
        goalTitle: goal.title,
        currentTimeAllocation: 30, // Simplified
        recommendedTimeAllocation: 45,
        source: 'increase_efficiency',
        implementation: 'Use time-blocking and eliminate low-value activities'
      });
    }

    return recommendations;
  }

  private generateCompletionForecasts(goals: any[]): GoalCompletionForecast[] {
    return goals
      .filter(g => g.status === 'active' && g.progress > 0)
      .slice(0, 5)
      .map(goal => {
        const remainingProgress = 100 - goal.progress;
        const estimatedDays = Math.ceil(remainingProgress / 2); // Simplified: 2% progress per day
        const forecastDate = new Date(Date.now() + estimatedDays * 24 * 60 * 60 * 1000);

        return {
          goalId: goal.id,
          goalTitle: goal.title,
          currentProgress: goal.progress,
          forecastedCompletionDate: forecastDate,
          confidence: goal.progress > 50 ? 80 : 60,
          assumptions: ['Current progress rate continues', 'No major obstacles'],
          riskFactors: goal.progress < 30 ? ['Low current progress', 'Potential motivation loss'] : []
        };
      });
  }

  private generateRiskAssessments(goals: any[]): GoalRiskAssessment[] {
    return goals
      .filter(g => g.status === 'active')
      .slice(0, 3)
      .map(goal => {
        const riskLevel = goal.progress < 20 ? 'high' : goal.progress < 50 ? 'medium' : 'low';
        const riskScore = goal.progress < 20 ? 80 : goal.progress < 50 ? 50 : 20;

        return {
          goalId: goal.id,
          goalTitle: goal.title,
          riskLevel: riskLevel as any,
          riskFactors: [
            {
              factor: 'Low progress rate',
              impact: goal.progress < 20 ? 80 : 40,
              likelihood: goal.progress < 20 ? 70 : 30,
              mitigation: 'Increase daily time allocation and create supporting habits'
            }
          ],
          overallRiskScore: riskScore
        };
      });
  }

  private identifyOpportunities(goals: any[]): OpportunityIdentification[] {
    const opportunities: OpportunityIdentification[] = [];

    // Quick win opportunities
    const nearCompletionGoals = goals.filter(g => g.progress >= 80 && g.progress < 100);
    if (nearCompletionGoals.length > 0) {
      opportunities.push({
        type: 'quick_win',
        title: 'Complete Near-Finished Goals',
        description: 'Focus on goals that are almost complete for quick wins',
        goalIds: nearCompletionGoals.slice(0, 2).map(g => g.id),
        potentialBenefit: 'Boost motivation and clear goal backlog',
        effortRequired: 'low',
        timeframe: '1-2 weeks',
        actionSteps: ['Identify final requirements', 'Schedule focused sessions', 'Complete and celebrate']
      });
    }

    // High impact opportunities
    const mainGoals = goals.filter(g => g.type === 'main' && g.status === 'active');
    if (mainGoals.length > 0) {
      opportunities.push({
        type: 'high_impact',
        title: 'Accelerate Main Goals',
        description: 'Focus extra effort on your most important goals',
        goalIds: mainGoals.slice(0, 1).map(g => g.id),
        potentialBenefit: 'Significant progress on life priorities',
        effortRequired: 'medium',
        timeframe: '1-3 months',
        actionSteps: ['Increase daily time allocation', 'Create supporting habits', 'Track progress weekly']
      });
    }

    return opportunities;
  }

  private generateEmptyInsights(userId: string): GoalGraphInsights {
    return {
      userId,
      generatedAt: new Date(),
      goalNetworkAnalysis: {
        totalGoals: 0,
        activeGoals: 0,
        completedGoals: 0,
        goalTypes: { main: 0, sub: 0, task: 0 },
        connectionDensity: 0,
        criticalPath: [],
        bottleneckGoals: []
      },
      progressInsights: {
        overallProgress: 0,
        progressDistribution: { notStarted: 0, inProgress: 0, nearCompletion: 0, completed: 0 },
        stagnantGoals: [],
        rapidProgressGoals: [],
        goalMomentum: 0
      },
      habitGoalAlignment: {
        alignedHabits: [],
        missingHabits: [],
        overAllocatedHabits: [],
        alignmentScore: 0
      },
      strategicRecommendations: {
        priorityAdjustments: [],
        goalRestructuring: [{
          type: 'add_connection',
          goalIds: [],
          description: 'Start by creating your first goals to get personalized insights',
          benefits: ['Clear direction', 'Progress tracking', 'Habit alignment'],
          implementation: ['Define 2-3 main life goals', 'Break them into actionable sub-goals', 'Connect with daily habits']
        }],
        habitOptimization: [],
        timeAllocation: []
      },
      predictiveAnalysis: {
        goalCompletionForecast: [],
        riskAssessment: [],
        opportunityIdentification: [{
          type: 'quick_win',
          title: 'Set Up Your Goal System',
          description: 'Create your first goals to unlock powerful insights and recommendations',
          goalIds: [],
          potentialBenefit: 'Clear direction and progress tracking',
          effortRequired: 'low',
          timeframe: '30 minutes',
          actionSteps: ['Go to Goals page', 'Create 2-3 main goals', 'Add supporting sub-goals', 'Connect with habits']
        }]
      }
    };
  }
}

// Export singleton instance
export const goalInsightsService = new GoalInsightsService();