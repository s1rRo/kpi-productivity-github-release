import express from 'express';
import { prisma } from '../index';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validationSchemas } from '../utils/validation';
import { ExceptionHandler } from '../services/exceptionHandler';
import { ExceptionType } from '../types';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * Get all available exception types
 * Requirement: 9.3 - Predefined exception types
 */
router.get('/types', async (req: AuthRequest, res) => {
  try {
    const exceptionTypes = ExceptionHandler.getAllExceptionTypes();
    res.json({ 
      data: exceptionTypes,
      message: 'Exception types retrieved successfully'
    });
  } catch (error) {
    console.error('Get exception types error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Mark a day as exception
 * Requirements: 9.1, 9.5 - Mark days as exceptions with comments
 */
router.post('/mark', async (req: AuthRequest, res) => {
  try {
    const { date, exceptionType, exceptionNote } = req.body;

    // Validate input
    if (!date || !exceptionType) {
      return res.status(400).json({ 
        error: 'Date and exception type are required' 
      });
    }

    // Validate exception type
    const typeInfo = ExceptionHandler.getExceptionTypeInfo(exceptionType as ExceptionType);
    if (!typeInfo) {
      return res.status(400).json({ 
        error: 'Invalid exception type' 
      });
    }

    // Validate exception note
    if (exceptionNote) {
      const noteValidation = ExceptionHandler.validateExceptionNote(exceptionNote);
      if (!noteValidation.isValid) {
        return res.status(400).json({ 
          error: noteValidation.error 
        });
      }
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ 
        error: 'Invalid date format' 
      });
    }

    // Create or update daily record with exception
    const dailyRecord = await prisma.dailyRecord.upsert({
      where: {
        userId_date: {
          userId: req.userId!,
          date: parsedDate
        }
      },
      update: {
        exceptionType,
        exceptionNote: exceptionNote || null
      },
      create: {
        userId: req.userId!,
        date: parsedDate,
        exceptionType,
        exceptionNote: exceptionNote || null
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

    res.status(201).json({ 
      data: dailyRecord,
      message: `Day marked as ${typeInfo.label} exception`
    });
  } catch (error: any) {
    console.error('Mark exception error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Remove exception from a day
 * Requirement: 9.1 - Ability to manage exceptions
 */
router.delete('/remove/:date', async (req: AuthRequest, res) => {
  try {
    const { date } = req.params;
    const parsedDate = new Date(date);

    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ 
        error: 'Invalid date format' 
      });
    }

    // Update daily record to remove exception
    const dailyRecord = await prisma.dailyRecord.update({
      where: {
        userId_date: {
          userId: req.userId!,
          date: parsedDate
        }
      },
      data: {
        exceptionType: null,
        exceptionNote: null
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

    res.json({ 
      data: dailyRecord,
      message: 'Exception removed from day'
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ 
        error: 'Daily record not found' 
      });
    }
    console.error('Remove exception error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get exceptions for a date range
 * Requirement: 9.4 - Display exception days in calendar
 */
router.get('/range', async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Start date and end date are required' 
      });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ 
        error: 'Invalid date format' 
      });
    }

    if (start > end) {
      return res.status(400).json({ 
        error: 'Start date must be before or equal to end date' 
      });
    }

    const exceptionRecords = await prisma.dailyRecord.findMany({
      where: {
        userId: req.userId!,
        date: {
          gte: start,
          lte: end
        },
        exceptionType: {
          not: null
        }
      },
      select: {
        date: true,
        exceptionType: true,
        exceptionNote: true
      },
      orderBy: {
        date: 'asc'
      }
    });

    // Format exceptions with display information
    const formattedExceptions = exceptionRecords.map(record => {
      const typeInfo = ExceptionHandler.getExceptionTypeInfo(record.exceptionType as ExceptionType);
      return {
        date: record.date,
        exceptionType: record.exceptionType,
        exceptionNote: record.exceptionNote,
        typeInfo,
        displayText: ExceptionHandler.formatExceptionDisplay(
          record.exceptionType as ExceptionType, 
          record.exceptionNote || undefined
        ),
        calendarColor: ExceptionHandler.getCalendarColor(record.exceptionType as ExceptionType)
      };
    });

    res.json({ 
      data: formattedExceptions,
      message: 'Exception days retrieved successfully'
    });
  } catch (error) {
    console.error('Get exceptions range error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get exception statistics for a period
 * Requirement: 9.2 - Exclude exceptions from calculations
 */
router.get('/stats/:year/:month', async (req: AuthRequest, res) => {
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
      select: {
        date: true,
        exceptionType: true,
        exceptionNote: true,
        totalKpi: true
      },
      orderBy: {
        date: 'asc'
      }
    });

    // Generate exception report
    const report = ExceptionHandler.generateExceptionReport(
      dailyRecords.map(r => ({
        date: r.date,
        exceptionType: r.exceptionType as ExceptionType | null,
        exceptionNote: r.exceptionNote,
        totalKpi: r.totalKpi
      })),
      startDate,
      endDate
    );

    res.json({ 
      data: report,
      message: 'Exception statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Get exception stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get yearly exception overview
 */
router.get('/stats/:year', async (req: AuthRequest, res) => {
  try {
    const { year } = req.params;
    const startDate = new Date(parseInt(year), 0, 1);
    const endDate = new Date(parseInt(year), 11, 31);

    const dailyRecords = await prisma.dailyRecord.findMany({
      where: {
        userId: req.userId!,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        date: true,
        exceptionType: true,
        exceptionNote: true,
        totalKpi: true
      },
      orderBy: {
        date: 'asc'
      }
    });

    // Generate yearly exception report
    const report = ExceptionHandler.generateExceptionReport(
      dailyRecords.map(r => ({
        date: r.date,
        exceptionType: r.exceptionType as ExceptionType | null,
        exceptionNote: r.exceptionNote,
        totalKpi: r.totalKpi
      })),
      startDate,
      endDate
    );

    // Group by month for detailed breakdown
    const monthlyBreakdown = [];
    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(parseInt(year), month, 1);
      const monthEnd = new Date(parseInt(year), month + 1, 0);
      
      const monthRecords = dailyRecords.filter(r => 
        r.date >= monthStart && r.date <= monthEnd
      );

      const monthReport = ExceptionHandler.generateExceptionReport(
        monthRecords.map(r => ({
          date: r.date,
          exceptionType: r.exceptionType as ExceptionType | null,
          exceptionNote: r.exceptionNote,
          totalKpi: r.totalKpi
        })),
        monthStart,
        monthEnd
      );

      monthlyBreakdown.push({
        month: month + 1,
        ...monthReport
      });
    }

    res.json({ 
      data: {
        yearly: report,
        monthly: monthlyBreakdown
      },
      message: 'Yearly exception statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Get yearly exception stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;