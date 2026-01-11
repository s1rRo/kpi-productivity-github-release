import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { productivityBooksService } from '../services/productivityBooks.js';
import { prisma } from '../index.js';
import { ApiResponse } from '../types/index.js';

const router = express.Router();

/**
 * GET /api/principles
 * Get all available productivity principles with user preferences
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      } as ApiResponse);
    }

    const principles = [
      {
        id: 'atomicHabits',
        title: 'Atomic Habits',
        description: 'Compound 1% ежедневного улучшения',
        detailedDescription: 'Система создания хороших привычек и избавления от плохих через маленькие изменения, которые приводят к большим результатам.',
        coefficient: 'до +25',
        maxBonus: 25,
        book: 'Atomic Habits',
        author: 'James Clear',
        principles: ['Compound 1% improvement', 'Habit stacking', 'Environment design', 'Identity-based habits'],
        category: 'habits'
      },
      {
        id: 'sevenHabits',
        title: '7 Навыков высокоэффективных людей',
        description: 'Принципы личной и межличностной эффективности',
        detailedDescription: 'Фокус на квадранте Q2 (важно, но не срочно) для достижения долгосрочного успеха.',
        coefficient: 'до +30',
        maxBonus: 30,
        book: '7 Habits of Highly Effective People',
        author: 'Stephen Covey',
        principles: ['Begin with end in mind', 'Put first things first (Q2 focus)', 'Think win-win', 'Sharpen the saw'],
        category: 'planning'
      },
      {
        id: 'deepWork',
        title: 'Deep Work',
        description: 'Глубокая работа без отвлечений',
        detailedDescription: 'Способность фокусироваться без отвлечений на когнитивно сложной задаче.',
        coefficient: 'до +25',
        maxBonus: 25,
        book: 'Deep Work',
        author: 'Cal Newport',
        principles: ['Deep work sessions', 'Attention residue minimization', 'Productive meditation', 'Digital minimalism'],
        category: 'focus'
      },
      {
        id: 'oneThingPrinciple',
        title: 'The ONE Thing',
        description: 'Принцип 80/20 и фокус на главном',
        detailedDescription: 'Фокусировка на одной самой важной задаче, которая сделает все остальное проще или ненужным.',
        coefficient: 'до +30',
        maxBonus: 30,
        book: 'The ONE Thing',
        author: 'Gary Keller',
        principles: ['80/20 principle', 'Time blocking', 'Goal setting to the now', 'Domino effect'],
        category: 'efficiency'
      },
      {
        id: 'gettingThingsDone',
        title: 'Getting Things Done',
        description: 'Система организации задач и проектов',
        detailedDescription: 'Методология продуктивности, основанная на принципе освобождения ума от необходимости помнить задачи.',
        coefficient: 'до +15',
        maxBonus: 15,
        book: 'Getting Things Done',
        author: 'David Allen',
        principles: ['Capture everything', 'Clarify and organize', 'Review and engage'],
        category: 'planning'
      },
      {
        id: 'eatThatFrog',
        title: 'Eat That Frog',
        description: 'Выполнение самой сложной задачи первой',
        detailedDescription: 'Принцип выполнения самой важной и сложной задачи в начале дня.',
        coefficient: 'до +15',
        maxBonus: 15,
        book: 'Eat That Frog',
        author: 'Brian Tracy',
        principles: ['Do hardest task first', 'Plan every day in advance', 'Apply 80/20 to everything'],
        category: 'efficiency'
      },
      {
        id: 'powerOfHabit',
        title: 'The Power of Habit',
        description: 'Наука о формировании привычек',
        detailedDescription: 'Понимание петли привычки: сигнал, рутина, награда.',
        coefficient: 'до +20',
        maxBonus: 20,
        book: 'The Power of Habit',
        author: 'Charles Duhigg',
        principles: ['Habit loop consistency', 'Keystone habits', 'Small wins momentum'],
        category: 'habits'
      },
      {
        id: 'mindset',
        title: 'Mindset',
        description: 'Психология успеха',
        detailedDescription: 'Развитие установки на рост вместо фиксированной установки.',
        coefficient: 'до +20',
        maxBonus: 20,
        book: 'Mindset',
        author: 'Carol Dweck',
        principles: ['Growth mindset', 'Effort over talent', 'Learning from challenges'],
        category: 'mindset'
      },
      {
        id: 'fourHourWorkweek',
        title: '4-Hour Workweek',
        description: 'Автоматизация и оптимизация работы',
        detailedDescription: 'Принципы устранения, автоматизации и освобождения для достижения баланса работы и жизни.',
        coefficient: 'до +15',
        maxBonus: 15,
        book: 'The 4-Hour Workweek',
        author: 'Tim Ferriss',
        principles: ['Elimination', 'Automation', 'Liberation (work-life balance)'],
        category: 'efficiency'
      },
      {
        id: 'essentialism',
        title: 'Essentialism',
        description: 'Дисциплинированное стремление к меньшему',
        detailedDescription: 'Систематический подход к определению того, что действительно важно.',
        coefficient: 'до +20',
        maxBonus: 20,
        book: 'Essentialism',
        author: 'Greg McKeown',
        principles: ['Less but better', 'Disciplined pursuit of less', 'Trade-offs'],
        category: 'planning'
      }
    ];

    // Get user preferences
    const preferences = await prisma.principlePreference.findMany({
      where: { userId }
    });

    // Merge principles with user preferences
    const principlesWithPreferences = principles.map(principle => {
      const userPref = preferences.find(p => p.principleId === principle.id);
      return {
        ...principle,
        applied: userPref?.applied || false,
        appliedToHabits: userPref?.appliedToHabits ? JSON.parse(userPref.appliedToHabits) : [],
        usageCount: userPref?.usageCount || 0
      };
    });

    res.json({
      data: principlesWithPreferences,
      message: 'Principles retrieved successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Error retrieving principles:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve principles'
    } as ApiResponse);
  }
});

/**
 * GET /api/principles/breakdown
 * Get current productivity breakdown for today
 */
router.get('/breakdown', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      } as ApiResponse);
    }

    // Get today's data
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // For now, return empty breakdown since we need actual habit records
    // In a real implementation, you would fetch today's habit records and tasks
    const breakdown = productivityBooksService.getProductivityBreakdown(
      [], // habitRecords
      [], // tasks
      [], // habits
      new Map() // streakData
    );

    res.json({
      data: breakdown,
      message: 'Productivity breakdown retrieved successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Error retrieving productivity breakdown:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve productivity breakdown'
    } as ApiResponse);
  }
});

/**
 * POST /api/principles/usage
 * Track principle usage and update preferences
 */
router.post('/usage', authenticateToken, async (req, res) => {
  try {
    const { principleId, action, appliedToHabits } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      } as ApiResponse);
    }

    if (!principleId || !action) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Principle ID and action are required'
      } as ApiResponse);
    }

    // Find or create principle preference
    let preference = await prisma.principlePreference.findUnique({
      where: {
        userId_principleId: {
          userId,
          principleId
        }
      }
    });

    if (!preference) {
      preference = await prisma.principlePreference.create({
        data: {
          userId,
          principleId,
          applied: action === 'apply',
          appliedToHabits: JSON.stringify(appliedToHabits || []),
          usageCount: action === 'apply' ? 1 : 0
        }
      });
    } else {
      preference = await prisma.principlePreference.update({
        where: { id: preference.id },
        data: {
          applied: action === 'apply',
          appliedToHabits: JSON.stringify(appliedToHabits || []),
          usageCount: action === 'apply' ? preference.usageCount + 1 : preference.usageCount,
          updatedAt: new Date()
        }
      });
    }

    res.json({
      data: {
        principleId,
        action,
        applied: preference.applied,
        appliedToHabits: JSON.parse(preference.appliedToHabits),
        usageCount: preference.usageCount,
        timestamp: new Date()
      },
      message: 'Principle usage tracked successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Error tracking principle usage:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to track principle usage'
    } as ApiResponse);
  }
});

/**
 * PUT /api/principles/:principleId
 * Update principle preferences
 */
router.put('/:principleId', authenticateToken, async (req, res) => {
  try {
    const { principleId } = req.params;
    const { applied, appliedToHabits } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      } as ApiResponse);
    }

    // Find or create principle preference
    let preference = await prisma.principlePreference.findUnique({
      where: {
        userId_principleId: {
          userId,
          principleId
        }
      }
    });

    if (!preference) {
      preference = await prisma.principlePreference.create({
        data: {
          userId,
          principleId,
          applied: applied || false,
          appliedToHabits: JSON.stringify(appliedToHabits || []),
          usageCount: applied ? 1 : 0
        }
      });
    } else {
      preference = await prisma.principlePreference.update({
        where: { id: preference.id },
        data: {
          applied: applied !== undefined ? applied : preference.applied,
          appliedToHabits: appliedToHabits !== undefined ? JSON.stringify(appliedToHabits) : preference.appliedToHabits,
          usageCount: applied && !preference.applied ? preference.usageCount + 1 : preference.usageCount,
          updatedAt: new Date()
        }
      });
    }

    res.json({
      data: {
        id: preference.id,
        principleId: preference.principleId,
        applied: preference.applied,
        appliedToHabits: JSON.parse(preference.appliedToHabits),
        usageCount: preference.usageCount
      },
      message: 'Principle preference updated successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Error updating principle preference:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update principle preference'
    } as ApiResponse);
  }
});

export default router;