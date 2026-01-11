import express from 'express';
import { kpiCalculator } from '../services/kpiCalculator';
import { revolutScorecardService } from '../services/revolutScorecard';
import { productivityBooksService } from '../services/productivityBooks';
import { streakTracker } from '../services/streakTracker';
import { authenticateToken } from '../middleware/auth';
import { 
  DailyRecord, 
  HabitRecord, 
  Task, 
  Habit, 
  RevolutPillars,
  ApiResponse,
  KPICalculationData 
} from '../types/index';

const router = express.Router();

// Test route without authentication for development
router.post('/productivity-books-test', async (req, res) => {
  try {
    const { habitRecords, tasks, habits, recentHabitRecords } = req.body;

    // Calculate streaks if recent data is provided
    let streakData: Map<string, number> | undefined;
    if (recentHabitRecords && Array.isArray(recentHabitRecords)) {
      streakData = streakTracker.calculateCurrentStreaks(recentHabitRecords, habits);
    }

    const breakdown = productivityBooksService.getProductivityBreakdown(
      habitRecords, 
      tasks, 
      habits, 
      streakData
    );

    const bookDescriptions = {
      atomicHabits: {
        title: 'Atomic Habits by James Clear',
        principles: ['Compound 1% improvement', 'Habit stacking', 'Environment design', 'Identity-based habits'],
        maxBonus: 25
      },
      sevenHabits: {
        title: '7 Habits of Highly Effective People by Stephen Covey',
        principles: ['Begin with end in mind', 'Put first things first (Q2 focus)', 'Think win-win', 'Sharpen the saw'],
        maxBonus: 30
      },
      deepWork: {
        title: 'Deep Work by Cal Newport',
        principles: ['Deep work sessions', 'Attention residue minimization', 'Productive meditation', 'Digital minimalism'],
        maxBonus: 25
      },
      oneThingPrinciple: {
        title: 'The ONE Thing by Gary Keller',
        principles: ['80/20 principle', 'Time blocking', 'Goal setting to the now', 'Domino effect'],
        maxBonus: 30
      },
      gettingThingsDone: {
        title: 'Getting Things Done by David Allen',
        principles: ['Capture everything', 'Clarify and organize', 'Review and engage'],
        maxBonus: 15
      },
      eatThatFrog: {
        title: 'Eat That Frog by Brian Tracy',
        principles: ['Do hardest task first', 'Plan every day in advance', 'Apply 80/20 to everything'],
        maxBonus: 15
      },
      powerOfHabit: {
        title: 'The Power of Habit by Charles Duhigg',
        principles: ['Habit loop consistency', 'Keystone habits', 'Small wins momentum'],
        maxBonus: 20
      },
      mindset: {
        title: 'Mindset by Carol Dweck',
        principles: ['Growth mindset', 'Effort over talent', 'Learning from challenges'],
        maxBonus: 20
      },
      fourHourWorkweek: {
        title: 'The 4-Hour Workweek by Tim Ferriss',
        principles: ['Elimination', 'Automation', 'Liberation (work-life balance)'],
        maxBonus: 15
      },
      essentialism: {
        title: 'Essentialism by Greg McKeown',
        principles: ['Less but better', 'Disciplined pursuit of less', 'Trade-offs'],
        maxBonus: 20
      }
    };

    res.json({
      data: {
        breakdown,
        bookDescriptions,
        totalMaxBonus: 50 // Capped total
      },
      message: 'Productivity books breakdown calculated successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Productivity books calculation error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to calculate productivity books breakdown'
    } as ApiResponse);
  }
});

// Apply authentication middleware to all routes below
router.use(authenticateToken);

/**
 * POST /api/kpi/calculate
 * Calculate KPI for a specific day with productivity books integration
 */
router.post('/calculate', async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { habitRecords, tasks, habits, revolutPillars, recentHabitRecords } = req.body;

    // Calculate streaks if recent data is provided
    let streakData: Map<string, number> | undefined;
    if (recentHabitRecords && Array.isArray(recentHabitRecords)) {
      streakData = streakTracker.calculateCurrentStreaks(recentHabitRecords, habits);
    }

    // Validate inputs
    const validation = kpiCalculator.validateInputs(habitRecords, tasks, habits, revolutPillars, streakData);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid input data',
        details: validation.errors
      } as ApiResponse);
    }

    // Calculate KPI with productivity books integration
    const kpiData = kpiCalculator.calculateDailyKPI(habitRecords, tasks, habits, revolutPillars, streakData);

    // Add productivity books breakdown
    const productivityBreakdown = productivityBooksService.getProductivityBreakdown(
      habitRecords, 
      tasks, 
      habits, 
      streakData
    );

    // Notify friends about KPI update (real-time)
    if (userId && kpiData.totalKPI > 0) {
      try {
        const { socketService } = await import('../index');
        if (socketService) {
          await socketService.notifyFriendActivity(userId, {
            type: 'kpi_update',
            data: {
              kpi: kpiData.totalKPI,
              date: new Date(),
              habits: habitRecords.length,
              tasks: tasks.length
            }
          });
        }
      } catch (error) {
        console.error('Error notifying friends about KPI update:', error);
        // Don't fail the request if real-time notification fails
      }
    }

    res.json({
      data: {
        ...kpiData,
        productivityBreakdown,
        streakData: streakData ? Object.fromEntries(streakData) : undefined
      },
      message: 'KPI calculated successfully with productivity books integration'
    } as ApiResponse<KPICalculationData>);

  } catch (error) {
    console.error('KPI calculation error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to calculate KPI'
    } as ApiResponse);
  }
});

/**
 * POST /api/kpi/revolut-scorecard
 * Calculate Revolut scorecard for a day
 */
router.post('/revolut-scorecard', async (req, res) => {
  try {
    const { habitRecords, tasks, habits, skillLevelDeltas } = req.body;

    // Convert skillLevelDeltas from object to Map if provided
    const deltaMap = skillLevelDeltas ? 
      new Map(Object.entries(skillLevelDeltas).map(([k, v]) => [k, Number(v)])) : 
      undefined;

    const scorecard = revolutScorecardService.calculateDailyScorecard(
      habitRecords,
      tasks,
      habits,
      deltaMap
    );

    res.json({
      data: scorecard,
      message: 'Revolut scorecard calculated successfully'
    } as ApiResponse<RevolutPillars>);

  } catch (error) {
    console.error('Revolut scorecard calculation error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to calculate Revolut scorecard'
    } as ApiResponse);
  }
});

/**
 * POST /api/kpi/efficiency-breakdown
 * Get detailed breakdown of efficiency coefficients including productivity books
 */
router.post('/efficiency-breakdown', async (req, res) => {
  try {
    const { habitRecords, tasks, habits, recentHabitRecords } = req.body;

    // Calculate streaks if recent data is provided
    let streakData: Map<string, number> | undefined;
    if (recentHabitRecords && Array.isArray(recentHabitRecords)) {
      streakData = streakTracker.calculateCurrentStreaks(recentHabitRecords, habits);
    }

    // Calculate just the efficiency coefficients for detailed analysis
    const kpiData = kpiCalculator.calculateDailyKPI(
      habitRecords, 
      tasks, 
      habits, 
      { deliverables: 0, skills: 0, culture: 0 }, // Zero out Revolut for pure efficiency analysis
      streakData
    );

    // Get productivity books breakdown
    const productivityBreakdown = productivityBooksService.getProductivityBreakdown(
      habitRecords, 
      tasks, 
      habits, 
      streakData
    );

    // Return detailed breakdown
    const breakdown = {
      efficiencyCoefficients: kpiData.efficiencyCoefficients,
      totalEfficiencyBonus: Object.values(kpiData.efficiencyCoefficients).reduce((sum, coeff) => sum + (coeff || 0), 0),
      productivityBreakdown,
      explanations: {
        paretoLaw: 'Pareto Principle (80/20): +10 for focusing on high-priority tasks',
        parkinsonLaw: 'Parkinson\'s Law: +15 faster than planned, -10 slower than planned',
        diminishingReturns: 'Diminishing Returns: -15 for working >4 hours without break',
        yerkesDodssonLaw: 'Yerkes-Dodson Law: +10 for timely task completion',
        pomodoroTechnique: 'Pomodoro Technique: +10 for focused work blocks (25-50 min)',
        deepWork: 'Deep Work: +15 for sustained focus sessions (90+ min)',
        timeBlocking: 'Time Blocking: +10 for planned vs actual time alignment',
        habitStacking: 'Habit Stacking: +10 for completing multiple habits',
        compoundEffect: 'Compound Effect: +5 for consistency (80%+ completion)',
        focusBlocks: 'Focus Blocks: +12 for maintaining focus without context switching',
        productivityBooks: 'Productivity Books Integration: Principles from 10 key books (max +50)'
      }
    };

    res.json({
      data: breakdown,
      message: 'Efficiency breakdown calculated successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Efficiency breakdown error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to calculate efficiency breakdown'
    } as ApiResponse);
  }
});

/**
 * GET /api/kpi/laws
 * Get information about all efficiency laws including productivity books
 */
router.get('/laws', (req, res) => {
  const laws = [
    {
      name: 'Pareto Principle (80/20 Rule)',
      description: 'Focus on the 20% of tasks that produce 80% of results',
      coefficient: '+10',
      trigger: 'High-priority task focus ≥80% or Q2 focus ≥60%',
      source: 'Vilfredo Pareto'
    },
    {
      name: 'Parkinson\'s Law',
      description: 'Work expands to fill the time available',
      coefficient: '+15 / -10',
      trigger: 'Completing tasks faster/slower than estimated',
      source: 'Cyril Northcote Parkinson'
    },
    {
      name: 'Law of Diminishing Returns',
      description: 'Productivity decreases after optimal work duration',
      coefficient: '-15',
      trigger: 'Working >4 hours without break',
      source: 'Economic theory'
    },
    {
      name: 'Yerkes-Dodson Law',
      description: 'Optimal performance occurs at moderate stress levels',
      coefficient: '+10',
      trigger: 'Timely completion of tasks (within 110% of estimate)',
      source: 'Robert Yerkes & John Dodson'
    },
    {
      name: 'Pomodoro Technique',
      description: 'Work in focused 25-minute intervals',
      coefficient: '+10',
      trigger: 'Work sessions between 25-50 minutes',
      source: 'Francesco Cirillo'
    },
    {
      name: 'Deep Work Principle',
      description: 'Sustained focus produces higher quality output',
      coefficient: '+15',
      trigger: 'Focused work sessions ≥90 minutes',
      source: 'Cal Newport'
    },
    {
      name: 'Time Blocking',
      description: 'Planned time allocation improves efficiency',
      coefficient: '+10',
      trigger: 'Actual time within 20% of planned time',
      source: 'Productivity methodology'
    },
    {
      name: 'Habit Stacking',
      description: 'Linking habits creates powerful routines',
      coefficient: '+10',
      trigger: 'Completing 5+ habits in a day',
      source: 'James Clear (Atomic Habits)'
    },
    {
      name: 'Compound Effect',
      description: 'Small daily improvements create exponential results',
      coefficient: '+5',
      trigger: 'Consistency rate ≥80%',
      source: 'Darren Hardy'
    },
    {
      name: 'Focus Blocks',
      description: 'Avoiding context switching maintains mental clarity',
      coefficient: '+12',
      trigger: 'Completing 2+ focused tasks (≥25 min each)',
      source: 'Attention research'
    },
    {
      name: 'Productivity Books Integration',
      description: 'Comprehensive integration of 10 key productivity books',
      coefficient: 'Up to +50',
      trigger: 'Various principles from Atomic Habits, 7 Habits, Deep Work, The ONE Thing, GTD, Eat That Frog, Power of Habit, Mindset, 4-Hour Workweek, Essentialism',
      source: 'Multiple productivity experts'
    }
  ];

  res.json({
    data: laws,
    message: 'Efficiency laws retrieved successfully'
  } as ApiResponse);
});

/**
 * POST /api/kpi/monthly-skills
 * Calculate monthly skill progression
 */
router.post('/monthly-skills', async (req, res) => {
  try {
    const { startOfMonthSkills, endOfMonthSkills } = req.body;

    // Convert objects to Maps
    const startMap = new Map(Object.entries(startOfMonthSkills).map(([k, v]) => [k, Number(v)]));
    const endMap = new Map(Object.entries(endOfMonthSkills).map(([k, v]) => [k, Number(v)]));

    const progression = revolutScorecardService.calculateMonthlySkillProgression(startMap, endMap);

    // Convert Map back to object for JSON response
    const progressionObj = Object.fromEntries(progression);

    res.json({
      data: progressionObj,
      message: 'Monthly skill progression calculated successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Monthly skills calculation error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to calculate monthly skill progression'
    } as ApiResponse);
  }
});

/**
 * POST /api/kpi/productivity-books
 * Get detailed breakdown of productivity book principles
 */
router.post('/productivity-books', async (req, res) => {
  try {
    const { habitRecords, tasks, habits, recentHabitRecords } = req.body;

    // Calculate streaks if recent data is provided
    let streakData: Map<string, number> | undefined;
    if (recentHabitRecords && Array.isArray(recentHabitRecords)) {
      streakData = streakTracker.calculateCurrentStreaks(recentHabitRecords, habits);
    }

    const breakdown = productivityBooksService.getProductivityBreakdown(
      habitRecords, 
      tasks, 
      habits, 
      streakData
    );

    const bookDescriptions = {
      atomicHabits: {
        title: 'Atomic Habits by James Clear',
        principles: ['Compound 1% improvement', 'Habit stacking', 'Environment design', 'Identity-based habits'],
        maxBonus: 25
      },
      sevenHabits: {
        title: '7 Habits of Highly Effective People by Stephen Covey',
        principles: ['Begin with end in mind', 'Put first things first (Q2 focus)', 'Think win-win', 'Sharpen the saw'],
        maxBonus: 30
      },
      deepWork: {
        title: 'Deep Work by Cal Newport',
        principles: ['Deep work sessions', 'Attention residue minimization', 'Productive meditation', 'Digital minimalism'],
        maxBonus: 25
      },
      oneThingPrinciple: {
        title: 'The ONE Thing by Gary Keller',
        principles: ['80/20 principle', 'Time blocking', 'Goal setting to the now', 'Domino effect'],
        maxBonus: 30
      },
      gettingThingsDone: {
        title: 'Getting Things Done by David Allen',
        principles: ['Capture everything', 'Clarify and organize', 'Review and engage'],
        maxBonus: 15
      },
      eatThatFrog: {
        title: 'Eat That Frog by Brian Tracy',
        principles: ['Do hardest task first', 'Plan every day in advance', 'Apply 80/20 to everything'],
        maxBonus: 15
      },
      powerOfHabit: {
        title: 'The Power of Habit by Charles Duhigg',
        principles: ['Habit loop consistency', 'Keystone habits', 'Small wins momentum'],
        maxBonus: 20
      },
      mindset: {
        title: 'Mindset by Carol Dweck',
        principles: ['Growth mindset', 'Effort over talent', 'Learning from challenges'],
        maxBonus: 20
      },
      fourHourWorkweek: {
        title: 'The 4-Hour Workweek by Tim Ferriss',
        principles: ['Elimination', 'Automation', 'Liberation (work-life balance)'],
        maxBonus: 15
      },
      essentialism: {
        title: 'Essentialism by Greg McKeown',
        principles: ['Less but better', 'Disciplined pursuit of less', 'Trade-offs'],
        maxBonus: 20
      }
    };

    res.json({
      data: {
        breakdown,
        bookDescriptions,
        totalMaxBonus: 50 // Capped total
      },
      message: 'Productivity books breakdown calculated successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Productivity books calculation error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to calculate productivity books breakdown'
    } as ApiResponse);
  }
});

/**
 * POST /api/kpi/streaks
 * Calculate and analyze habit streaks
 */
router.post('/streaks', async (req, res) => {
  try {
    const { recentHabitRecords, habits } = req.body;

    if (!recentHabitRecords || !Array.isArray(recentHabitRecords)) {
      return res.status(400).json({
        error: 'Invalid input data',
        message: 'recentHabitRecords must be an array of daily habit records'
      } as ApiResponse);
    }

    const streaks = streakTracker.calculateCurrentStreaks(recentHabitRecords, habits);
    const statistics = streakTracker.getStreakStatistics(streaks, habits);
    const insights = streakTracker.generateStreakInsights(streaks, habits);
    const milestones = streakTracker.getStreakMilestones();

    // Convert Map to object for JSON response
    const streaksObj = Object.fromEntries(streaks);

    // Add predictions for each habit
    const predictions: { [habitId: string]: any } = {};
    for (const [habitId, streakDays] of streaks) {
      const habit = habits.find((h: Habit) => h.id === habitId);
      if (habit) {
        predictions[habitId] = streakTracker.predictStreakContinuation(habitId, streakDays, habit);
      }
    }

    res.json({
      data: {
        streaks: streaksObj,
        statistics,
        insights,
        predictions,
        milestones
      },
      message: 'Streak analysis completed successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Streak calculation error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to calculate streak analysis'
    } as ApiResponse);
  }
});

export default router;