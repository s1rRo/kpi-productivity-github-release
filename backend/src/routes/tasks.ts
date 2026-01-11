import express from 'express';
import { prisma } from '../index';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validationSchemas, validationMessages } from '../utils/validation';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get tasks for a daily record
router.get('/daily/:dailyRecordId', async (req: AuthRequest, res) => {
  try {
    const { dailyRecordId } = req.params;

    // Verify the daily record belongs to the user
    const dailyRecord = await prisma.dailyRecord.findFirst({
      where: {
        id: dailyRecordId,
        userId: req.userId!
      }
    });

    if (!dailyRecord) {
      return res.status(404).json({ error: 'Daily record not found' });
    }

    const tasks = await prisma.task.findMany({
      where: { dailyRecordId },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ]
    });

    res.json({ tasks });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get task by ID
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const task = await prisma.task.findFirst({
      where: {
        id,
        dailyRecord: {
          userId: req.userId!
        }
      },
      include: {
        dailyRecord: true
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ task });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create task
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = validationSchemas.task.create.parse(req.body);

    // Verify the daily record belongs to the user
    const dailyRecord = await prisma.dailyRecord.findFirst({
      where: {
        id: data.dailyRecordId,
        userId: req.userId!
      }
    });

    if (!dailyRecord) {
      return res.status(404).json({ error: 'Daily record not found' });
    }

    // Check if user already has 5 tasks for this day (requirement 8.1)
    const canAddTask = await validationSchemas.task.validateTaskLimit(data.dailyRecordId, prisma);
    
    if (!canAddTask) {
      return res.status(400).json({ 
        error: validationMessages.TASK_LIMIT_EXCEEDED,
        message: 'You can only have maximum 5 tasks per day to maintain focus'
      });
    }

    const task = await prisma.task.create({
      data
    });

    res.status(201).json({ task });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Invalid input', 
        details: error.errors 
      });
    }
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update task
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = validationSchemas.task.update.parse(req.body);

    // Verify the task belongs to the user
    const existingTask = await prisma.task.findFirst({
      where: {
        id,
        dailyRecord: {
          userId: req.userId!
        }
      }
    });

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = await prisma.task.update({
      where: { id },
      data
    });

    res.json({ task });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Invalid input', 
        details: error.errors 
      });
    }
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete task
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Verify the task belongs to the user
    const existingTask = await prisma.task.findFirst({
      where: {
        id,
        dailyRecord: {
          userId: req.userId!
        }
      }
    });

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await prisma.task.delete({
      where: { id }
    });

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get tasks by priority
router.get('/priority/:priority', async (req: AuthRequest, res) => {
  try {
    const { priority } = req.params;

    if (!['high', 'medium', 'low'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority. Must be high, medium, or low' });
    }

    const tasks = await prisma.task.findMany({
      where: {
        priority,
        dailyRecord: {
          userId: req.userId!
        }
      },
      include: {
        dailyRecord: {
          select: {
            date: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ tasks, priority });
  } catch (error) {
    console.error('Get tasks by priority error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get task statistics for a date range
router.get('/stats/:startDate/:endDate', async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = req.params;

    const tasks = await prisma.task.findMany({
      where: {
        dailyRecord: {
          userId: req.userId!,
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        }
      },
      include: {
        dailyRecord: {
          select: {
            date: true
          }
        }
      }
    });

    const stats = {
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.completed).length,
      completionRate: tasks.length > 0 ? (tasks.filter(t => t.completed).length / tasks.length) * 100 : 0,
      priorityBreakdown: {
        high: tasks.filter(t => t.priority === 'high').length,
        medium: tasks.filter(t => t.priority === 'medium').length,
        low: tasks.filter(t => t.priority === 'low').length
      },
      averageEstimatedMinutes: tasks.length > 0 ? 
        tasks.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0) / tasks.length : 0,
      averageActualMinutes: tasks.length > 0 ? 
        tasks.reduce((sum, t) => sum + (t.actualMinutes || 0), 0) / tasks.length : 0
    };

    res.json({ stats, dateRange: { startDate, endDate } });
  } catch (error) {
    console.error('Get task statistics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;