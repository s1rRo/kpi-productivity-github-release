import express from 'express';
import { prisma } from '../index';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validationSchemas, validateBusinessRules, dateRangeValidationSchema } from '../utils/validation';
import { ExceptionHandler } from '../services/exceptionHandler';
import { ExceptionType } from '../types';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get daily records for a date range
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = req.query;

    const where: any = {
      userId: req.userId!
    };

    if (startDate && endDate) {
      const dateRange = dateRangeValidationSchema.parse({ startDate, endDate });
      where.date = {
        gte: dateRange.startDate,
        lte: dateRange.endDate
      };
    }

    const dailyRecords = await prisma.dailyRecord.findMany({
      where,
      include: {
        habitRecords: {
          include: {
            habit: true
          }
        },
        tasks: true
      },
      orderBy: { date: 'desc' }
    });

    res.json({ dailyRecords });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Invalid date range', 
        details: error.issues 
      });
    }
    console.error('Get daily records error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get daily record by date
router.get('/:date', async (req: AuthRequest, res) => {
  try {
    const { date } = req.params;

    const dailyRecord = await prisma.dailyRecord.findUnique({
      where: {
        userId_date: {
          userId: req.userId!,
          date: new Date(date)
        }
      },
      include: {
        habitRecords: {
          include: {
            habit: true
          }
        },
        tasks: true
      }
    });

    if (!dailyRecord) {
      return res.status(404).json({ error: 'Daily record not found' });
    }

    res.json({ dailyRecord });
  } catch (error) {
    console.error('Get daily record error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create or update daily record
router.post('/', async (req: AuthRequest, res) => {
  try {
    const validatedData = validationSchemas.dailyRecord.create.parse(req.body);
    const { date, exceptionType, exceptionNote, habitRecords } = validatedData;

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Create or update daily record
      const dailyRecord = await tx.dailyRecord.upsert({
        where: {
          userId_date: {
            userId: req.userId!,
            date
          }
        },
        update: {
          exceptionType,
          exceptionNote
        },
        create: {
          userId: req.userId!,
          date,
          exceptionType,
          exceptionNote
        }
      });

      // If habit records are provided, update them
      if (habitRecords && habitRecords.length > 0) {
        // Validate efficiency coefficients for each habit record
        for (const hr of habitRecords) {
          if (hr.efficiencyCoefficients && 
              !validateBusinessRules.validateEfficiencyCoefficients(hr.efficiencyCoefficients)) {
            throw new Error('Efficiency coefficients must be between -15 and 15');
          }
        }

        // Delete existing habit records for this day
        await tx.habitRecord.deleteMany({
          where: { dailyRecordId: dailyRecord.id }
        });

        // Create new habit records
        await tx.habitRecord.createMany({
          data: habitRecords.map(hr => ({
            dailyRecordId: dailyRecord.id,
            habitId: hr.habitId,
            actualMinutes: hr.actualMinutes,
            qualityScore: hr.qualityScore,
            efficiencyCoefficients: hr.efficiencyCoefficients
          }))
        });
      }

      // Return the complete daily record
      return await tx.dailyRecord.findUnique({
        where: { id: dailyRecord.id },
        include: {
          habitRecords: {
            include: {
              habit: true
            }
          },
          tasks: true
        }
      });
    });

    res.status(201).json({ dailyRecord: result });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Invalid input', 
        details: error.issues 
      });
    }
    if (error.message.includes('Efficiency coefficients')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Create daily record error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update daily record
router.put('/:date', async (req: AuthRequest, res) => {
  try {
    const { date } = req.params;
    const data = validationSchemas.dailyRecord.update.parse(req.body);

    const dailyRecord = await prisma.dailyRecord.update({
      where: {
        userId_date: {
          userId: req.userId!,
          date: new Date(date)
        }
      },
      data: {
        exceptionType: data.exceptionType,
        exceptionNote: data.exceptionNote,
        totalKpi: data.totalKpi ? validateBusinessRules.validateKPIBounds(data.totalKpi) : undefined
      },
      include: {
        habitRecords: {
          include: {
            habit: true
          }
        },
        tasks: true
      }
    });

    res.json({ dailyRecord });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Invalid input', 
        details: error.issues 
      });
    }
    console.error('Update daily record error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete daily record
router.delete('/:date', async (req: AuthRequest, res) => {
  try {
    const { date } = req.params;

    await prisma.dailyRecord.delete({
      where: {
        userId_date: {
          userId: req.userId!,
          date: new Date(date)
        }
      }
    });

    res.json({ message: 'Daily record deleted successfully' });
  } catch (error) {
    console.error('Delete daily record error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get monthly summary
router.get('/summary/month/:year/:month', async (req: AuthRequest, res) => {
  try {
    const { year, month } = req.params;
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0);

    const dailyRecords = await prisma.dailyRecord.findMany({
      where: {
        userId: req.userId!,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        habitRecords: {
          include: {
            habit: true
          }
        },
        tasks: true
      }
    });

    // Use ExceptionHandler to calculate statistics excluding exception days (requirement 9.2)
    const monthSummary = ExceptionHandler.calculateStatsExcludingExceptions(
      dailyRecords.map(record => ({
        ...record,
        exceptionType: record.exceptionType as ExceptionType | null
      })),
      (validRecords) => {
        const totalDays = validRecords.length;
        const totalKPI = validRecords.reduce((sum, record) => sum + (record.totalKpi || 0), 0);
        const averageKPI = totalDays > 0 ? totalKPI / totalDays : 0;
        
        const totalHours = validRecords.reduce((sum, record) => {
          const dayMinutes = record.habitRecords.reduce((daySum, hr) => daySum + hr.actualMinutes, 0);
          return sum + (dayMinutes / 60);
        }, 0);

        // Calculate habit breakdown
        const habitBreakdown = validRecords.reduce((acc: any, record) => {
          record.habitRecords.forEach(hr => {
            if (!acc[hr.habitId]) {
              acc[hr.habitId] = {
                habitId: hr.habitId,
                habitName: hr.habit.name,
                totalMinutes: 0,
                recordCount: 0,
                qualitySum: 0,
                qualityCount: 0
              };
            }
            acc[hr.habitId].totalMinutes += hr.actualMinutes;
            acc[hr.habitId].recordCount += 1;
            if (hr.qualityScore) {
              acc[hr.habitId].qualitySum += hr.qualityScore;
              acc[hr.habitId].qualityCount += 1;
            }
          });
          return acc;
        }, {});

        const habitSummaries = Object.values(habitBreakdown).map((hb: any) => ({
          habitId: hb.habitId,
          habitName: hb.habitName,
          totalMinutes: hb.totalMinutes,
          averageMinutes: totalDays > 0 ? hb.totalMinutes / totalDays : 0,
          completionRate: totalDays > 0 ? (hb.recordCount / totalDays) * 100 : 0,
          averageQuality: hb.qualityCount > 0 ? hb.qualitySum / hb.qualityCount : undefined
        }));

        return {
          month: parseInt(month),
          year: parseInt(year),
          averageKPI: Math.round(averageKPI * 100) / 100,
          totalHours: Math.round(totalHours * 100) / 100,
          completedDays: totalDays,
          habitBreakdown: habitSummaries,
          // Include exception information
          exceptionDays: dailyRecords.length - totalDays,
          exceptionSummary: ExceptionHandler.getExceptionSummary(
            dailyRecords.map(r => ({ 
              exceptionType: r.exceptionType as any, 
              date: r.date 
            }))
          )
        };
      }
    );

    res.json({ monthSummary });
  } catch (error) {
    console.error('Get monthly summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;