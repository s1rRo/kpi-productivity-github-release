import express from 'express';
import { prisma } from '../index';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validationSchemas, validateBusinessRules } from '../utils/validation';
import { DEFAULT_HABITS, HabitChanges } from '../types';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Helper function to log habit changes
async function logHabitHistory(habitId: string, action: 'created' | 'updated' | 'deleted', changes?: HabitChanges[]) {
  try {
    // Check if habitHistory table exists, if not skip logging
    const result = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' AND name='habit_history';`;
    if (Array.isArray(result) && result.length > 0) {
      await prisma.$executeRaw`
        INSERT INTO habit_history (id, habitId, action, changes, createdAt)
        VALUES (${generateId()}, ${habitId}, ${action}, ${JSON.stringify(changes || [])}, ${new Date().toISOString()})
      `;
    }
  } catch (error) {
    console.error('Failed to log habit history:', error);
  }
}

// Helper function to generate ID (simple implementation)
function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Helper function to check if habit has associated data
async function checkHabitHasData(habitId: string) {
  const [habitRecordsCount, skillTestsCount, skillProgressCount] = await Promise.all([
    prisma.habitRecord.count({ where: { habitId } }),
    prisma.skillTest.count({ where: { habitId } }),
    prisma.skillProgress.count({ where: { habitId } })
  ]);

  return {
    hasData: habitRecordsCount > 0 || skillTestsCount > 0 || skillProgressCount > 0,
    habitRecordsCount,
    skillTestsCount,
    skillProgressCount
  };
}

// Get all habits
router.get('/', async (req: AuthRequest, res) => {
  try {
    const habits = await prisma.habit.findMany({
      orderBy: { createdAt: 'asc' }
    });

    res.json({ habits });
  } catch (error) {
    console.error('Get habits error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get habit by ID with history
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const includeHistory = req.query.includeHistory === 'true';

    const habit = await prisma.habit.findUnique({
      where: { id }
    });

    if (!habit) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    let habitWithHistory: any = { ...habit, habitHistory: [] };

    // Get history if requested
    if (includeHistory) {
      try {
        const historyResult = await prisma.$queryRaw`
          SELECT * FROM habit_history 
          WHERE habitId = ${id} 
          ORDER BY createdAt DESC 
          LIMIT 50
        `;
        
        if (Array.isArray(historyResult)) {
          habitWithHistory.habitHistory = historyResult.map((entry: any) => ({
            ...entry,
            changes: JSON.parse(entry.changes || '[]')
          }));
        }
      } catch (error) {
        console.error('Failed to fetch habit history:', error);
        // Continue without history if table doesn't exist
      }
    }

    res.json({ habit: habitWithHistory });
  } catch (error) {
    console.error('Get habit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create habit
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = validationSchemas.habit.create.parse(req.body);

    const habit = await prisma.habit.create({
      data
    });

    // Log creation
    await logHabitHistory(habit.id, 'created', [
      { field: 'name', oldValue: null, newValue: habit.name },
      { field: 'targetMinutes', oldValue: null, newValue: habit.targetMinutes },
      { field: 'category', oldValue: null, newValue: habit.category },
      { field: 'skillLevel', oldValue: null, newValue: habit.skillLevel },
      { field: 'eisenhowerQuadrant', oldValue: null, newValue: habit.eisenhowerQuadrant },
      { field: 'isWeekdayOnly', oldValue: null, newValue: habit.isWeekdayOnly }
    ]);

    res.status(201).json({ 
      habit,
      message: 'Habit created successfully'
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Invalid input', 
        details: error.errors 
      });
    }
    console.error('Create habit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update habit
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = validationSchemas.habit.update.parse(req.body);

    // Get current habit for comparison
    const currentHabit = await prisma.habit.findUnique({
      where: { id }
    });

    if (!currentHabit) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    // Validate business rules for specific habits
    if (data.name === 'Работа' && data.targetMinutes) {
      const today = new Date();
      const adjustedTarget = validateBusinessRules.validateWorkHabit(today, data.targetMinutes);
      data.targetMinutes = adjustedTarget;
    }

    const habit = await prisma.habit.update({
      where: { id },
      data
    });

    // Track changes for history
    const changes: HabitChanges[] = [];
    Object.keys(data).forEach(key => {
      const oldValue = (currentHabit as any)[key];
      const newValue = (data as any)[key];
      if (oldValue !== newValue) {
        changes.push({
          field: key,
          oldValue,
          newValue
        });
      }
    });

    // Log changes if any
    if (changes.length > 0) {
      await logHabitHistory(habit.id, 'updated', changes);
    }

    res.json({ 
      habit,
      message: 'Habit updated successfully',
      changes: changes.length
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Invalid input', 
        details: error.errors 
      });
    }
    console.error('Update habit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if habit can be deleted (has associated data)
router.get('/:id/deletion-check', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const habit = await prisma.habit.findUnique({
      where: { id }
    });

    if (!habit) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    const dataCheck = await checkHabitHasData(id);

    res.json({
      habit: { id: habit.id, name: habit.name },
      canDelete: !dataCheck.hasData,
      warnings: dataCheck.hasData ? {
        message: 'This habit has associated data that will be permanently deleted',
        details: {
          habitRecords: dataCheck.habitRecordsCount,
          skillTests: dataCheck.skillTestsCount,
          skillProgress: dataCheck.skillProgressCount
        }
      } : null
    });
  } catch (error) {
    console.error('Deletion check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete habit
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const forceDelete = req.query.force === 'true';

    const habit = await prisma.habit.findUnique({
      where: { id }
    });

    if (!habit) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    // Check for associated data
    const dataCheck = await checkHabitHasData(id);

    if (dataCheck.hasData && !forceDelete) {
      return res.status(400).json({
        error: 'Cannot delete habit with associated data',
        message: 'Use force=true query parameter to delete anyway',
        warnings: {
          habitRecords: dataCheck.habitRecordsCount,
          skillTests: dataCheck.skillTestsCount,
          skillProgress: dataCheck.skillProgressCount
        }
      });
    }

    // Log deletion before deleting
    await logHabitHistory(habit.id, 'deleted', [
      { field: 'name', oldValue: habit.name, newValue: null },
      { field: 'targetMinutes', oldValue: habit.targetMinutes, newValue: null },
      { field: 'category', oldValue: habit.category, newValue: null }
    ]);

    await prisma.habit.delete({
      where: { id }
    });

    res.json({ 
      message: 'Habit deleted successfully',
      deletedData: dataCheck.hasData ? {
        habitRecords: dataCheck.habitRecordsCount,
        skillTests: dataCheck.skillTestsCount,
        skillProgress: dataCheck.skillProgressCount
      } : null
    });
  } catch (error) {
    console.error('Delete habit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get habit history
router.get('/:id/history', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const habit = await prisma.habit.findUnique({
      where: { id },
      select: { id: true, name: true }
    });

    if (!habit) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    try {
      // Get history with pagination
      const historyResult = await prisma.$queryRaw`
        SELECT * FROM habit_history 
        WHERE habitId = ${id} 
        ORDER BY createdAt DESC 
        LIMIT ${limit} OFFSET ${skip}
      `;

      const totalResult = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM habit_history 
        WHERE habitId = ${id}
      ` as any[];

      const history = Array.isArray(historyResult) ? historyResult : [];
      const total = Array.isArray(totalResult) && totalResult[0] ? (totalResult[0] as any).count : 0;

      // Parse changes JSON
      const parsedHistory = history.map((entry: any) => ({
        ...entry,
        changes: JSON.parse(entry.changes || '[]')
      }));

      res.json({
        habit,
        history: parsedHistory,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Failed to fetch habit history:', error);
      // Return empty history if table doesn't exist
      res.json({
        habit,
        history: [],
        pagination: {
          page: 1,
          limit,
          total: 0,
          totalPages: 0
        }
      });
    }
  } catch (error) {
    console.error('Get habit history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Initialize default habits (requirement 3.1-3.5)
router.post('/initialize-defaults', async (req: AuthRequest, res) => {
  try {
    // Check if habits already exist
    const existingHabits = await prisma.habit.count();
    
    if (existingHabits > 0) {
      return res.status(400).json({ 
        error: 'Default habits already initialized',
        message: 'Use this endpoint only for initial setup'
      });
    }

    const habits = await prisma.habit.createMany({
      data: DEFAULT_HABITS as any
    });

    res.json({ 
      message: 'Default habits initialized successfully', 
      count: habits.count,
      habits: DEFAULT_HABITS.map(h => h.name)
    });
  } catch (error) {
    console.error('Initialize habits error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get habits by category
router.get('/category/:category', async (req: AuthRequest, res) => {
  try {
    const { category } = req.params;

    const habits = await prisma.habit.findMany({
      where: { category },
      orderBy: { name: 'asc' }
    });

    res.json({ habits, category });
  } catch (error) {
    console.error('Get habits by category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get habits by Eisenhower quadrant
router.get('/quadrant/:quadrant', async (req: AuthRequest, res) => {
  try {
    const { quadrant } = req.params;

    if (!['Q1', 'Q2', 'Q3', 'Q4'].includes(quadrant)) {
      return res.status(400).json({ error: 'Invalid quadrant. Must be Q1, Q2, Q3, or Q4' });
    }

    const habits = await prisma.habit.findMany({
      where: { eisenhowerQuadrant: quadrant },
      orderBy: { name: 'asc' }
    });

    res.json({ habits, quadrant });
  } catch (error) {
    console.error('Get habits by quadrant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;