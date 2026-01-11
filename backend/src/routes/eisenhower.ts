import express from 'express';
import { prisma } from '../index.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { priorityManager } from '../services/priorityManager.js';
import { EisenhowerQuadrant, HabitCategory, TaskPriority } from '../types';
import { ApiResponse } from '../types/index.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/eisenhower/quadrants/:date
 * Get Eisenhower Matrix classification for a specific date
 */
router.get('/quadrants/:date', async (req: AuthRequest, res) => {
  try {
    const { date } = req.params;
    const userId = req.userId!;

    // Get daily record with tasks and habit records
    const dailyRecord = await prisma.dailyRecord.findFirst({
      where: {
        userId,
        date: new Date(date)
      },
      include: {
        tasks: true,
        habitRecords: {
          include: {
            habit: true
          }
        }
      }
    });

    if (!dailyRecord) {
      return res.status(404).json({
        error: 'No data found for this date',
        message: 'Create some tasks or habit records first'
      } as ApiResponse);
    }

    // Get all habits for context
    const habitsFromDb = await prisma.habit.findMany();
    const habits = habitsFromDb.map(habit => ({
      ...habit,
      category: habit.category as HabitCategory | undefined,
      eisenhowerQuadrant: habit.eisenhowerQuadrant as EisenhowerQuadrant | undefined
    }));

    // Classify tasks by Eisenhower Matrix
    const classification = priorityManager.classifyByEisenhowerMatrix(
      dailyRecord.tasks.map(task => ({
        ...task,
        priority: task.priority as TaskPriority,
        estimatedMinutes: task.estimatedMinutes ?? undefined,
        actualMinutes: task.actualMinutes ?? undefined
      })),
      habits
    );

    // Calculate time distribution
    const timeDistribution = priorityManager.analyzeTimeDistribution(
      dailyRecord.tasks.map(task => ({
        ...task,
        priority: task.priority as TaskPriority,
        estimatedMinutes: task.estimatedMinutes ?? undefined,
        actualMinutes: task.actualMinutes ?? undefined
      })),
      habits
    );

    // Calculate Q2 focus bonus
    const q2FocusBonus = priorityManager.calculateQ2FocusBonus(
      dailyRecord.tasks.map(task => ({
        ...task,
        priority: task.priority as TaskPriority,
        estimatedMinutes: task.estimatedMinutes ?? undefined,
        actualMinutes: task.actualMinutes ?? undefined
      })),
      habits
    );

    res.json({
      data: {
        date,
        classification,
        timeDistribution,
        q2FocusBonus,
        totalTasks: dailyRecord.tasks.length,
        completedTasks: dailyRecord.tasks.filter(t => t.completed).length
      },
      message: 'Eisenhower Matrix analysis completed'
    } as ApiResponse);

  } catch (error) {
    console.error('Eisenhower quadrants error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to analyze Eisenhower quadrants'
    } as ApiResponse);
  }
});

/**
 * GET /api/eisenhower/recommendations/:date
 * Get recommendations for time redistribution towards Q2
 */
router.get('/recommendations/:date', async (req: AuthRequest, res) => {
  try {
    const { date } = req.params;
    const userId = req.userId!;

    // Get daily record with tasks
    const dailyRecord = await prisma.dailyRecord.findFirst({
      where: {
        userId,
        date: new Date(date)
      },
      include: {
        tasks: true,
        habitRecords: {
          include: {
            habit: true
          }
        }
      }
    });

    if (!dailyRecord) {
      return res.status(404).json({
        error: 'No data found for this date',
        message: 'Create some tasks first to get recommendations'
      } as ApiResponse);
    }

    // Get all habits for context
    const habitsFromDb2 = await prisma.habit.findMany();
    const habits = habitsFromDb2.map(habit => ({
      ...habit,
      category: habit.category as HabitCategory | undefined,
      eisenhowerQuadrant: habit.eisenhowerQuadrant as EisenhowerQuadrant | undefined
    }));

    // Generate recommendations
    const recommendations = priorityManager.generateRecommendations(
      dailyRecord.tasks.map(task => ({
        ...task,
        priority: task.priority as TaskPriority,
        estimatedMinutes: task.estimatedMinutes ?? undefined,
        actualMinutes: task.actualMinutes ?? undefined
      })),
      habits
    );

    res.json({
      data: {
        date,
        ...recommendations,
        totalTasks: dailyRecord.tasks.length,
        completedTasks: dailyRecord.tasks.filter(t => t.completed).length
      },
      message: 'Recommendations generated successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Eisenhower recommendations error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate recommendations'
    } as ApiResponse);
  }
});

/**
 * GET /api/eisenhower/analytics/:startDate/:endDate
 * Get time distribution analytics across date range
 */
router.get('/analytics/:startDate/:endDate', async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = req.params;
    const userId = req.userId!;

    // Get daily records in date range
    const dailyRecords = await prisma.dailyRecord.findMany({
      where: {
        userId,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      },
      include: {
        tasks: true,
        habitRecords: {
          include: {
            habit: true
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    if (dailyRecords.length === 0) {
      return res.json({
        data: {
          dateRange: { startDate, endDate },
          dailyAnalytics: [],
          averageDistribution: {
            Q1: { tasks: 0, minutes: 0, percentage: 0 },
            Q2: { tasks: 0, minutes: 0, percentage: 0 },
            Q3: { tasks: 0, minutes: 0, percentage: 0 },
            Q4: { tasks: 0, minutes: 0, percentage: 0 },
            totalMinutes: 0
          },
          trends: {
            q2FocusImprovement: 0,
            averageQ2Focus: 0,
            bestQ2Day: null,
            worstQ2Day: null
          }
        },
        message: 'No data found for the specified date range'
      } as ApiResponse);
    }

    // Get all habits for context
    const habitsFromDb3 = await prisma.habit.findMany();
    const habits = habitsFromDb3.map(habit => ({
      ...habit,
      category: habit.category as HabitCategory | undefined,
      eisenhowerQuadrant: habit.eisenhowerQuadrant as EisenhowerQuadrant | undefined
    }));

    // Analyze each day
    const dailyAnalytics = dailyRecords.map(record => {
      const tasksWithTypes = record.tasks.map(task => ({
        ...task,
        priority: task.priority as TaskPriority,
        estimatedMinutes: task.estimatedMinutes ?? undefined,
        actualMinutes: task.actualMinutes ?? undefined
      }));
      
      const timeDistribution = priorityManager.analyzeTimeDistribution(
        tasksWithTypes,
        habits
      );
      
      const recommendations = priorityManager.generateRecommendations(
        tasksWithTypes,
        habits
      );

      return {
        date: record.date.toISOString().split('T')[0],
        timeDistribution,
        q2Focus: recommendations.currentQ2Focus,
        totalTasks: record.tasks.length,
        completedTasks: record.tasks.filter(t => t.completed).length,
        q2FocusBonus: priorityManager.calculateQ2FocusBonus(tasksWithTypes, habits)
      };
    });

    // Calculate average distribution
    const totalDays = dailyAnalytics.length;
    const averageDistribution = {
      Q1: { tasks: 0, minutes: 0, percentage: 0 },
      Q2: { tasks: 0, minutes: 0, percentage: 0 },
      Q3: { tasks: 0, minutes: 0, percentage: 0 },
      Q4: { tasks: 0, minutes: 0, percentage: 0 },
      totalMinutes: 0
    };

    // Sum up all distributions
    dailyAnalytics.forEach(day => {
      Object.keys(averageDistribution).forEach(quadrant => {
        if (quadrant !== 'totalMinutes') {
          const q = quadrant as 'Q1' | 'Q2' | 'Q3' | 'Q4';
          averageDistribution[q].tasks += day.timeDistribution[q].tasks;
          averageDistribution[q].minutes += day.timeDistribution[q].minutes;
        }
      });
      averageDistribution.totalMinutes += day.timeDistribution.totalMinutes;
    });

    // Calculate averages
    Object.keys(averageDistribution).forEach(quadrant => {
      if (quadrant !== 'totalMinutes') {
        const q = quadrant as 'Q1' | 'Q2' | 'Q3' | 'Q4';
        averageDistribution[q].tasks = Math.round(averageDistribution[q].tasks / totalDays);
        averageDistribution[q].minutes = Math.round(averageDistribution[q].minutes / totalDays);
        averageDistribution[q].percentage = averageDistribution.totalMinutes > 0 ? 
          (averageDistribution[q].minutes / averageDistribution.totalMinutes) * 100 : 0;
      }
    });
    averageDistribution.totalMinutes = Math.round(averageDistribution.totalMinutes / totalDays);

    // Calculate trends
    const q2Focuses = dailyAnalytics.map(d => d.q2Focus);
    const averageQ2Focus = q2Focuses.reduce((sum, focus) => sum + focus, 0) / q2Focuses.length;
    
    const bestQ2Day = dailyAnalytics.reduce((best, current) => 
      current.q2Focus > best.q2Focus ? current : best
    );
    
    const worstQ2Day = dailyAnalytics.reduce((worst, current) => 
      current.q2Focus < worst.q2Focus ? current : worst
    );

    const q2FocusImprovement = q2Focuses.length > 1 ? 
      q2Focuses[q2Focuses.length - 1] - q2Focuses[0] : 0;

    res.json({
      data: {
        dateRange: { startDate, endDate },
        dailyAnalytics,
        averageDistribution,
        trends: {
          q2FocusImprovement,
          averageQ2Focus: Math.round(averageQ2Focus * 100) / 100,
          bestQ2Day: {
            date: bestQ2Day.date,
            q2Focus: bestQ2Day.q2Focus
          },
          worstQ2Day: {
            date: worstQ2Day.date,
            q2Focus: worstQ2Day.q2Focus
          }
        }
      },
      message: 'Analytics calculated successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Eisenhower analytics error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to calculate analytics'
    } as ApiResponse);
  }
});

/**
 * PUT /api/eisenhower/habit/:habitId/quadrant
 * Update habit's Eisenhower quadrant classification
 */
router.put('/habit/:habitId/quadrant', async (req: AuthRequest, res) => {
  try {
    const { habitId } = req.params;
    const { eisenhowerQuadrant } = req.body;

    // Validate quadrant
    if (!['Q1', 'Q2', 'Q3', 'Q4'].includes(eisenhowerQuadrant)) {
      return res.status(400).json({
        error: 'Invalid quadrant',
        message: 'Quadrant must be Q1, Q2, Q3, or Q4'
      } as ApiResponse);
    }

    // Update habit
    const habit = await prisma.habit.update({
      where: { id: habitId },
      data: { eisenhowerQuadrant }
    });

    res.json({
      data: habit,
      message: 'Habit quadrant updated successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Update habit quadrant error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update habit quadrant'
    } as ApiResponse);
  }
});

/**
 * GET /api/eisenhower/quadrant-info
 * Get information about Eisenhower Matrix quadrants
 */
router.get('/quadrant-info', (req, res) => {
  const quadrantInfo = {
    Q1: {
      name: 'Срочно и Важно',
      description: 'Кризисы, проблемы, дедлайны',
      color: '#ef4444', // red-500
      strategy: 'Делать немедленно',
      examples: ['Срочные проекты', 'Кризисы', 'Проблемы с дедлайнами'],
      idealPercentage: '20-25%'
    },
    Q2: {
      name: 'Важно, Не срочно',
      description: 'Планирование, развитие, профилактика',
      color: '#22c55e', // green-500
      strategy: 'Планировать и делать',
      examples: ['Обучение', 'Планирование', 'Здоровье', 'Отношения'],
      idealPercentage: '60-65%'
    },
    Q3: {
      name: 'Срочно, Не важно',
      description: 'Прерывания, некоторые звонки, почта',
      color: '#f59e0b', // amber-500
      strategy: 'Делегировать',
      examples: ['Некоторые звонки', 'Прерывания', 'Некоторая почта'],
      idealPercentage: '10-15%'
    },
    Q4: {
      name: 'Не срочно, Не важно',
      description: 'Пустая трата времени, развлечения',
      color: '#6b7280', // gray-500
      strategy: 'Исключить',
      examples: ['Бесцельный интернет', 'Телевизор', 'Пустые разговоры'],
      idealPercentage: '0-5%'
    }
  };

  const principles = [
    'Фокусируйтесь на Q2 для долгосрочного успеха',
    'Минимизируйте Q1 через лучшее планирование',
    'Делегируйте или исключайте Q3 задачи',
    'Полностью исключите Q4 активности',
    'Цель: 60%+ времени в Q2 квадранте'
  ];

  res.json({
    data: {
      quadrants: quadrantInfo,
      principles,
      source: 'Stephen Covey - 7 Habits of Highly Effective People'
    },
    message: 'Quadrant information retrieved successfully'
  } as ApiResponse);
});

export default router;