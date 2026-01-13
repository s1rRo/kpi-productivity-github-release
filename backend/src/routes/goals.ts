import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { cacheService } from '../services/cacheService';
import QueryOptimizationService from '../services/queryOptimizationService';

const router = Router();
const prisma = new PrismaClient();

// Initialize query optimization service
const queryOptimizer = new QueryOptimizationService(prisma, {
  enableLogging: process.env.NODE_ENV === 'development',
  slowQueryThreshold: 1000,
  cacheResults: true
});

// Validation schemas
const createGoalSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  type: z.enum(['main', 'sub', 'task']),
  positionX: z.number().default(0),
  positionY: z.number().default(0),
  color: z.string().default('#3B82F6')
});

const updateGoalSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  type: z.enum(['main', 'sub', 'task']).optional(),
  status: z.enum(['active', 'completed', 'paused']).optional(),
  progress: z.number().min(0).max(100).optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  color: z.string().optional()
});

const createConnectionSchema = z.object({
  fromGoalId: z.string(),
  toGoalId: z.string(),
  connectionType: z.enum(['depends_on', 'enables', 'blocks']).default('depends_on')
});

const connectHabitSchema = z.object({
  habitId: z.string()
});

// GET /api/goals - Get all goals for user
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Try to get from cache first
    const cacheResult = await cacheService.getCachedGoalsData(userId);
    
    if (cacheResult.hit && cacheResult.data) {
      res.setHeader('X-Cache', 'HIT');
      return res.json({
        data: cacheResult.data
      });
    }

    // Cache miss - use optimized query
    const goalsData = await queryOptimizer.getOptimizedGoalsForUser(userId);

    // Cache the result
    await cacheService.cacheGoalsData(userId, goalsData);

    res.setHeader('X-Cache', 'MISS');
    res.json({
      data: goalsData
    });
  } catch (error) {
    console.error('Error fetching goals:', error);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

// POST /api/goals - Create new goal
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const validatedData = createGoalSchema.parse(req.body);

    const goal = await prisma.goal.create({
      data: {
        ...validatedData,
        userId
      },
      include: {
        fromConnections: true,
        toConnections: true,
        generatedHabits: {
          include: {
            habit: true
          }
        }
      }
    });

    // Invalidate cache
    await cacheService.invalidateUserCache(userId);

    res.status(201).json({ data: goal });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    console.error('Error creating goal:', error);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

// PUT /api/goals/:id - Update goal
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const goalId = req.params.id;
    const validatedData = updateGoalSchema.parse(req.body);

    // Check if goal belongs to user
    const existingGoal = await prisma.goal.findFirst({
      where: { id: goalId, userId }
    });

    if (!existingGoal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const goal = await prisma.goal.update({
      where: { id: goalId },
      data: validatedData,
      include: {
        fromConnections: true,
        toConnections: true,
        generatedHabits: {
          include: {
            habit: true
          }
        }
      }
    });

    // Invalidate cache
    await cacheService.invalidateUserCache(userId);

    res.json({ data: goal });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    console.error('Error updating goal:', error);
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

// DELETE /api/goals/:id - Delete goal
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const goalId = req.params.id;

    // Check if goal belongs to user
    const existingGoal = await prisma.goal.findFirst({
      where: { id: goalId, userId },
      include: {
        generatedHabits: {
          include: {
            habit: {
              include: {
                habitRecords: true
              }
            }
          }
        }
      }
    });

    if (!existingGoal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Check if goal has connected habits with data
    const hasHabitData = existingGoal.generatedHabits.some(
      gh => gh.habit.habitRecords.length > 0
    );

    if (hasHabitData) {
      return res.status(400).json({
        error: 'Cannot delete goal with connected habits that have tracking data',
        details: {
          connectedHabits: existingGoal.generatedHabits.map(gh => ({
            id: gh.habit.id,
            name: gh.habit.name,
            recordCount: gh.habit.habitRecords.length
          }))
        }
      });
    }

    // Delete goal (connections and goal-habits will be deleted by cascade)
    await prisma.goal.delete({
      where: { id: goalId }
    });

    // Invalidate cache
    await cacheService.invalidateUserCache(userId);

    res.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    console.error('Error deleting goal:', error);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

// POST /api/goals/:id/connections - Create connection between goals
router.post('/:id/connections', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const fromGoalId = req.params.id;
    const validatedData = createConnectionSchema.parse(req.body);

    // Verify both goals belong to user
    const goals = await prisma.goal.findMany({
      where: {
        id: { in: [fromGoalId, validatedData.toGoalId] },
        userId
      }
    });

    if (goals.length !== 2) {
      return res.status(404).json({ error: 'One or both goals not found' });
    }

    // Prevent self-connections
    if (fromGoalId === validatedData.toGoalId) {
      return res.status(400).json({ error: 'Cannot connect goal to itself' });
    }

    const connection = await prisma.goalConnection.create({
      data: {
        fromGoalId,
        toGoalId: validatedData.toGoalId,
        connectionType: validatedData.connectionType
      }
    });

    res.status(201).json({ data: connection });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    console.error('Error creating connection:', error);
    res.status(500).json({ error: 'Failed to create connection' });
  }
});

// DELETE /api/goals/:id/connections/:connectionId - Delete connection
router.delete('/:id/connections/:connectionId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const goalId = req.params.id;
    const connectionId = req.params.connectionId;

    // Verify connection exists and user owns the goal
    const connection = await prisma.goalConnection.findFirst({
      where: {
        id: connectionId,
        OR: [
          { fromGoalId: goalId },
          { toGoalId: goalId }
        ]
      },
      include: {
        fromGoal: true,
        toGoal: true
      }
    });

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Verify user owns both goals
    if (connection.fromGoal.userId !== userId || connection.toGoal.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await prisma.goalConnection.delete({
      where: { id: connectionId }
    });

    res.json({ message: 'Connection deleted successfully' });
  } catch (error) {
    console.error('Error deleting connection:', error);
    res.status(500).json({ error: 'Failed to delete connection' });
  }
});

// POST /api/goals/:id/habits - Connect habit to goal
router.post('/:id/habits', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const goalId = req.params.id;
    const validatedData = connectHabitSchema.parse(req.body);

    // Verify goal belongs to user
    const goal = await prisma.goal.findFirst({
      where: { id: goalId, userId }
    });

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Verify habit exists (habits are global, not user-specific in current schema)
    const habit = await prisma.habit.findUnique({
      where: { id: validatedData.habitId }
    });

    if (!habit) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    const goalHabit = await prisma.goalHabit.create({
      data: {
        goalId,
        habitId: validatedData.habitId
      },
      include: {
        habit: true
      }
    });

    res.status(201).json({ data: goalHabit });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    console.error('Error connecting habit to goal:', error);
    res.status(500).json({ error: 'Failed to connect habit to goal' });
  }
});

// DELETE /api/goals/:id/habits/:habitId - Disconnect habit from goal
router.delete('/:id/habits/:habitId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const goalId = req.params.id;
    const habitId = req.params.habitId;

    // Verify goal belongs to user
    const goal = await prisma.goal.findFirst({
      where: { id: goalId, userId }
    });

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const goalHabit = await prisma.goalHabit.findFirst({
      where: { goalId, habitId }
    });

    if (!goalHabit) {
      return res.status(404).json({ error: 'Habit connection not found' });
    }

    await prisma.goalHabit.delete({
      where: { id: goalHabit.id }
    });

    res.json({ message: 'Habit disconnected from goal successfully' });
  } catch (error) {
    console.error('Error disconnecting habit from goal:', error);
    res.status(500).json({ error: 'Failed to disconnect habit from goal' });
  }
});

// POST /api/goals/:id/generate-habits - Generate habits from goal
router.post('/:id/generate-habits', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const goalId = req.params.id;

    // Verify goal belongs to user
    const goal = await prisma.goal.findFirst({
      where: { id: goalId, userId }
    });

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Generate habit suggestions based on goal title and type
    const suggestions = generateHabitSuggestions(goal);

    res.json({ data: suggestions });
  } catch (error) {
    console.error('Error generating habit suggestions:', error);
    res.status(500).json({ error: 'Failed to generate habit suggestions' });
  }
});

// POST /api/goals/:id/create-habits - Create habits from suggestions
router.post('/:id/create-habits', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const goalId = req.params.id;
    const { selectedHabits } = req.body;

    if (!Array.isArray(selectedHabits) || selectedHabits.length === 0) {
      return res.status(400).json({ error: 'No habits selected' });
    }

    // Verify goal belongs to user
    const goal = await prisma.goal.findFirst({
      where: { id: goalId, userId }
    });

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const createdHabits = [];
    const goalHabits = [];

    // Create habits and connect them to the goal
    for (const habitData of selectedHabits) {
      // Create the habit
      const habit = await prisma.habit.create({
        data: {
          name: habitData.name,
          targetMinutes: habitData.targetMinutes,
          category: habitData.category,
          skillLevel: habitData.skillLevel,
          eisenhowerQuadrant: habitData.eisenhowerQuadrant
        }
      });

      createdHabits.push(habit);

      // Connect habit to goal
      const goalHabit = await prisma.goalHabit.create({
        data: {
          goalId,
          habitId: habit.id
        },
        include: {
          habit: true
        }
      });

      goalHabits.push(goalHabit);
    }

    res.status(201).json({ 
      data: {
        createdHabits,
        goalHabits,
        message: `Successfully created ${createdHabits.length} habits and connected them to goal "${goal.title}"`
      }
    });
  } catch (error) {
    console.error('Error creating habits from goal:', error);
    res.status(500).json({ error: 'Failed to create habits from goal' });
  }
});

// Helper function to generate habit suggestions
function generateHabitSuggestions(goal: any) {
  const suggestions = [];
  const title = goal.title.toLowerCase();
  const description = (goal.description || '').toLowerCase();
  const combinedText = `${title} ${description}`;

  // Enhanced pattern matching with more comprehensive suggestions
  const patterns = [
    // Language learning patterns
    {
      keywords: ['english', 'английский', 'язык', 'language', 'ielts', 'toefl'],
      suggestions: [
        {
          name: `Изучение английского для "${goal.title}"`,
          targetMinutes: 45,
          category: 'skills',
          skillLevel: 2,
          eisenhowerQuadrant: 'Q2'
        },
        {
          name: `Практика разговорного английского`,
          targetMinutes: 30,
          category: 'skills',
          skillLevel: 2,
          eisenhowerQuadrant: 'Q2'
        }
      ]
    },
    
    // Health and fitness patterns
    {
      keywords: ['fitness', 'спорт', 'health', 'здоровье', 'тренировка', 'gym', 'зал', 'бег', 'running'],
      suggestions: [
        {
          name: `Тренировки для "${goal.title}"`,
          targetMinutes: 60,
          category: 'health',
          skillLevel: 3,
          eisenhowerQuadrant: 'Q2'
        },
        {
          name: `Кардио для "${goal.title}"`,
          targetMinutes: 30,
          category: 'health',
          skillLevel: 3,
          eisenhowerQuadrant: 'Q2'
        }
      ]
    },
    
    // Learning and education patterns
    {
      keywords: ['read', 'чтение', 'книг', 'learn', 'изучение', 'курс', 'course', 'education'],
      suggestions: [
        {
          name: `Чтение для "${goal.title}"`,
          targetMinutes: 45,
          category: 'learning',
          skillLevel: 3,
          eisenhowerQuadrant: 'Q2'
        },
        {
          name: `Изучение материалов по "${goal.title}"`,
          targetMinutes: 60,
          category: 'learning',
          skillLevel: 3,
          eisenhowerQuadrant: 'Q2'
        }
      ]
    },
    
    // Career and work patterns
    {
      keywords: ['work', 'career', 'работа', 'карьера', 'проект', 'project', 'бизнес', 'business'],
      suggestions: [
        {
          name: `Работа над "${goal.title}"`,
          targetMinutes: 120,
          category: 'career',
          skillLevel: 4,
          eisenhowerQuadrant: goal.type === 'main' ? 'Q1' : 'Q2'
        },
        {
          name: `Планирование "${goal.title}"`,
          targetMinutes: 30,
          category: 'career',
          skillLevel: 4,
          eisenhowerQuadrant: 'Q2'
        }
      ]
    },
    
    // Technology and AI patterns
    {
      keywords: ['ai', 'ии', 'artificial', 'intelligence', 'tech', 'технологии', 'programming', 'программирование'],
      suggestions: [
        {
          name: `Изучение ИИ для "${goal.title}"`,
          targetMinutes: 60,
          category: 'skills',
          skillLevel: 1,
          eisenhowerQuadrant: 'Q2'
        },
        {
          name: `Практика с ИИ инструментами`,
          targetMinutes: 45,
          category: 'skills',
          skillLevel: 1,
          eisenhowerQuadrant: 'Q2'
        }
      ]
    },
    
    // Content creation patterns
    {
      keywords: ['blog', 'блог', 'content', 'контент', 'writing', 'писать', 'social', 'соцсети'],
      suggestions: [
        {
          name: `Создание контента для "${goal.title}"`,
          targetMinutes: 45,
          category: 'content',
          skillLevel: 2,
          eisenhowerQuadrant: 'Q2'
        },
        {
          name: `Планирование контента`,
          targetMinutes: 30,
          category: 'content',
          skillLevel: 2,
          eisenhowerQuadrant: 'Q2'
        }
      ]
    },
    
    // Analytics and data patterns
    {
      keywords: ['analytics', 'аналитика', 'data', 'данные', 'analysis', 'анализ', 'metrics', 'метрики'],
      suggestions: [
        {
          name: `Анализ данных для "${goal.title}"`,
          targetMinutes: 60,
          category: 'skills',
          skillLevel: 3,
          eisenhowerQuadrant: 'Q2'
        },
        {
          name: `Изучение аналитики`,
          targetMinutes: 45,
          category: 'skills',
          skillLevel: 3,
          eisenhowerQuadrant: 'Q2'
        }
      ]
    }
  ];

  // Find matching patterns and add suggestions
  for (const pattern of patterns) {
    const hasMatch = pattern.keywords.some(keyword => combinedText.includes(keyword));
    if (hasMatch) {
      suggestions.push(...pattern.suggestions);
    }
  }

  // Goal type specific suggestions
  if (goal.type === 'main') {
    suggestions.push({
      name: `Стратегическое планирование "${goal.title}"`,
      targetMinutes: 60,
      category: 'career',
      skillLevel: 4,
      eisenhowerQuadrant: 'Q2'
    });
  } else if (goal.type === 'task') {
    suggestions.push({
      name: `Выполнение задачи "${goal.title}"`,
      targetMinutes: 90,
      category: 'career',
      skillLevel: 3,
      eisenhowerQuadrant: 'Q1'
    });
  }

  // Default suggestion if no specific patterns found
  if (suggestions.length === 0) {
    suggestions.push({
      name: `Работа над "${goal.title}"`,
      targetMinutes: 60,
      category: 'skills',
      skillLevel: 3,
      eisenhowerQuadrant: 'Q2'
    });
  }

  // Remove duplicates and limit to 5 suggestions
  const uniqueSuggestions = suggestions.filter((suggestion, index, self) => 
    index === self.findIndex(s => s.name === suggestion.name)
  ).slice(0, 5);

  return uniqueSuggestions;
}

// PUT /api/goals/:id/sync-progress - Synchronize progress between goal and connected habits
router.put('/:id/sync-progress', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const goalId = req.params.id;

    // Verify goal belongs to user
    const goal = await prisma.goal.findFirst({
      where: { id: goalId, userId },
      include: {
        generatedHabits: {
          include: {
            habit: {
              include: {
                habitRecords: {
                  where: {
                    createdAt: {
                      gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    if (goal.generatedHabits.length === 0) {
      return res.status(400).json({ error: 'No habits connected to this goal' });
    }

    // Calculate progress based on connected habits
    let totalProgress = 0;
    let habitCount = 0;

    for (const goalHabit of goal.generatedHabits) {
      const habit = goalHabit.habit;
      const records = habit.habitRecords;

      if (records.length > 0) {
        // Calculate completion rate for this habit over the last 30 days
        const totalDays = 30;
        const completedDays = records.filter(record => 
          record.actualMinutes >= habit.targetMinutes * 0.8 // 80% completion threshold
        ).length;
        
        const habitProgress = Math.min((completedDays / totalDays) * 100, 100);
        totalProgress += habitProgress;
        habitCount++;
      }
    }

    // Calculate average progress
    const averageProgress = habitCount > 0 ? Math.round(totalProgress / habitCount) : goal.progress;

    // Update goal progress
    const updatedGoal = await prisma.goal.update({
      where: { id: goalId },
      data: { 
        progress: averageProgress,
        updatedAt: new Date()
      },
      include: {
        fromConnections: true,
        toConnections: true,
        generatedHabits: {
          include: {
            habit: true
          }
        }
      }
    });

    res.json({ 
      data: {
        goal: updatedGoal,
        previousProgress: goal.progress,
        newProgress: averageProgress,
        progressChange: averageProgress - goal.progress,
        habitCount,
        message: `Goal progress updated from ${goal.progress}% to ${averageProgress}%`
      }
    });
  } catch (error) {
    console.error('Error synchronizing goal progress:', error);
    res.status(500).json({ error: 'Failed to synchronize goal progress' });
  }
});

// GET /api/goals/:id/progress-analysis - Get detailed progress analysis
router.get('/:id/progress-analysis', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const goalId = req.params.id;
    const days = parseInt(req.query.days as string) || 30;

    // Verify goal belongs to user
    const goal = await prisma.goal.findFirst({
      where: { id: goalId, userId },
      include: {
        generatedHabits: {
          include: {
            habit: {
              include: {
                habitRecords: {
                  where: {
                    createdAt: {
                      gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
                    }
                  },
                  orderBy: { createdAt: 'desc' }
                }
              }
            }
          }
        }
      }
    });

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const analysis = {
      goal: {
        id: goal.id,
        title: goal.title,
        currentProgress: goal.progress,
        type: goal.type,
        status: goal.status
      },
      period: {
        days,
        startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        endDate: new Date()
      },
      habitAnalysis: [] as any[],
      overallMetrics: {
        totalHabits: goal.generatedHabits.length,
        activeHabits: 0,
        averageCompletion: 0,
        totalMinutes: 0,
        consistencyScore: 0
      },
      recommendations: [] as string[]
    };

    let totalCompletion = 0;
    let totalMinutes = 0;
    let activeHabits = 0;

    // Analyze each connected habit
    for (const goalHabit of goal.generatedHabits) {
      const habit = goalHabit.habit;
      const records = habit.habitRecords;

      if (records.length > 0) {
        activeHabits++;
        
        const completedDays = records.filter(record => 
          record.actualMinutes >= habit.targetMinutes * 0.8
        ).length;
        
        const completionRate = (completedDays / days) * 100;
        const habitTotalMinutes = records.reduce((sum, record) => sum + record.actualMinutes, 0);
        const averageMinutes = habitTotalMinutes / records.length;
        
        totalCompletion += completionRate;
        totalMinutes += habitTotalMinutes;

        analysis.habitAnalysis.push({
          habitId: habit.id,
          habitName: habit.name,
          targetMinutes: habit.targetMinutes,
          completionRate: Math.round(completionRate),
          totalMinutes: habitTotalMinutes,
          averageMinutes: Math.round(averageMinutes),
          recordCount: records.length,
          trend: records.length >= 7 ? calculateTrend(records.slice(0, 7)) : 'insufficient_data'
        });
      } else {
        analysis.habitAnalysis.push({
          habitId: habit.id,
          habitName: habit.name,
          targetMinutes: habit.targetMinutes,
          completionRate: 0,
          totalMinutes: 0,
          averageMinutes: 0,
          recordCount: 0,
          trend: 'no_data'
        });
      }
    }

    // Calculate overall metrics
    analysis.overallMetrics.activeHabits = activeHabits;
    analysis.overallMetrics.averageCompletion = activeHabits > 0 ? Math.round(totalCompletion / activeHabits) : 0;
    analysis.overallMetrics.totalMinutes = totalMinutes;
    analysis.overallMetrics.consistencyScore = calculateConsistencyScore(goal.generatedHabits);

    // Generate recommendations
    analysis.recommendations = generateProgressRecommendations(analysis);

    res.json({ data: analysis });
  } catch (error) {
    console.error('Error getting progress analysis:', error);
    res.status(500).json({ error: 'Failed to get progress analysis' });
  }
});

// Helper function to calculate trend
function calculateTrend(records: any[]): 'improving' | 'declining' | 'stable' {
  if (records.length < 3) return 'stable';
  
  const recent = records.slice(0, Math.ceil(records.length / 2));
  const older = records.slice(Math.ceil(records.length / 2));
  
  const recentAvg = recent.reduce((sum, r) => sum + r.actualMinutes, 0) / recent.length;
  const olderAvg = older.reduce((sum, r) => sum + r.actualMinutes, 0) / older.length;
  
  const change = ((recentAvg - olderAvg) / olderAvg) * 100;
  
  if (change > 10) return 'improving';
  if (change < -10) return 'declining';
  return 'stable';
}

// Helper function to calculate consistency score
function calculateConsistencyScore(goalHabits: any[]): number {
  if (goalHabits.length === 0) return 0;
  
  let totalConsistency = 0;
  let habitCount = 0;
  
  for (const goalHabit of goalHabits) {
    const records = goalHabit.habit.habitRecords;
    if (records.length > 0) {
      // Calculate consistency based on regularity of records
      const consistency = Math.min((records.length / 30) * 100, 100);
      totalConsistency += consistency;
      habitCount++;
    }
  }
  
  return habitCount > 0 ? Math.round(totalConsistency / habitCount) : 0;
}

// Helper function to generate recommendations
function generateProgressRecommendations(analysis: any): string[] {
  const recommendations = [];
  
  if (analysis.overallMetrics.averageCompletion < 50) {
    recommendations.push('Рассмотрите возможность снижения целевого времени для привычек, чтобы повысить выполнимость');
  }
  
  if (analysis.overallMetrics.consistencyScore < 60) {
    recommendations.push('Сосредоточьтесь на регулярности выполнения привычек, а не на продолжительности');
  }
  
  const decliningHabits = analysis.habitAnalysis.filter((h: any) => h.trend === 'declining');
  if (decliningHabits.length > 0) {
    recommendations.push(`Обратите внимание на снижающиеся привычки: ${decliningHabits.map((h: any) => h.habitName).join(', ')}`);
  }
  
  if (analysis.overallMetrics.activeHabits < analysis.overallMetrics.totalHabits) {
    recommendations.push('Некоторые привычки не отслеживаются. Начните с малого и постепенно добавляйте новые');
  }
  
  return recommendations;
}

export default router;