import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { analyticsService } from '../services/analyticsService';
import { exportService } from '../services/exportService';
import { teamAnalyticsService } from '../services/teamAnalyticsService';
import { principlesAnalyticsService } from '../services/principlesAnalyticsService';
import { goalInsightsService } from '../services/goalInsightsService';
import { cacheService } from '../services/cacheService';
import { ApiResponse } from '../types/index';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/analytics/report
 * Generate comprehensive analytics report
 * Query params: startDate, endDate, type (month|quarter|year)
 */
router.get('/report', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { startDate, endDate, type = 'month' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'startDate and endDate are required'
      } as ApiResponse);
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        error: 'Invalid dates',
        message: 'startDate and endDate must be valid dates'
      } as ApiResponse);
    }

    if (start > end) {
      return res.status(400).json({
        error: 'Invalid date range',
        message: 'startDate must be before endDate'
      } as ApiResponse);
    }

    const reportType = type as 'month' | 'quarter' | 'year';

    // Try to get from cache first
    const cacheResult = await cacheService.getCachedAnalyticsReport(
      userId, 
      reportType, 
      start, 
      end
    );

    if (cacheResult.hit && cacheResult.data) {
      res.setHeader('X-Cache', 'HIT');
      return res.json({
        data: cacheResult.data,
        message: 'Analytics report generated successfully (cached)'
      } as ApiResponse);
    }

    // Cache miss - generate report
    const report = await analyticsService.generateAnalyticsReport(
      userId, 
      start, 
      end, 
      reportType
    );

    // Cache the result
    await cacheService.cacheAnalyticsReport(userId, reportType, start, end, report);

    res.setHeader('X-Cache', 'MISS');
    res.json({
      data: report,
      message: 'Analytics report generated successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Analytics report error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate analytics report'
    } as ApiResponse);
  }
});

/**
 * GET /api/analytics/trends
 * Get trend analysis for habits
 * Query params: startDate, endDate, habitIds (optional, comma-separated)
 */
router.get('/trends', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'startDate and endDate are required'
      } as ApiResponse);
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    const report = await analyticsService.generateAnalyticsReport(
      userId, 
      start, 
      end, 
      'month'
    );

    res.json({
      data: {
        trends: report.trends,
        period: report.period,
        generatedAt: report.generatedAt
      },
      message: 'Trend analysis retrieved successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Trends analysis error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve trend analysis'
    } as ApiResponse);
  }
});

/**
 * GET /api/analytics/forecast
 * Get forecast data based on compound formulas
 * Query params: startDate, endDate, type (month|quarter|year)
 */
router.get('/forecast', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { startDate, endDate, type = 'month' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'startDate and endDate are required'
      } as ApiResponse);
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    const reportType = type as 'month' | 'quarter' | 'year';

    const report = await analyticsService.generateAnalyticsReport(
      userId, 
      start, 
      end, 
      reportType
    );

    res.json({
      data: {
        forecast: report.forecast,
        basedOnPeriod: report.period,
        generatedAt: report.generatedAt
      },
      message: 'Forecast data retrieved successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Forecast error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate forecast'
    } as ApiResponse);
  }
});

/**
 * GET /api/analytics/compare
 * Compare two periods (month-to-month, year-to-year)
 * Query params: currentStart, currentEnd, previousStart, previousEnd
 */
router.get('/compare', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { currentStart, currentEnd, previousStart, previousEnd } = req.query;

    if (!currentStart || !currentEnd || !previousStart || !previousEnd) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'All date parameters are required: currentStart, currentEnd, previousStart, previousEnd'
      } as ApiResponse);
    }

    const currentStartDate = new Date(currentStart as string);
    const currentEndDate = new Date(currentEnd as string);
    const previousStartDate = new Date(previousStart as string);
    const previousEndDate = new Date(previousEnd as string);

    // Validate dates
    const dates = [currentStartDate, currentEndDate, previousStartDate, previousEndDate];
    if (dates.some(date => isNaN(date.getTime()))) {
      return res.status(400).json({
        error: 'Invalid dates',
        message: 'All date parameters must be valid dates'
      } as ApiResponse);
    }

    const comparison = await analyticsService.comparePeriods(
      userId,
      currentStartDate,
      currentEndDate,
      previousStartDate,
      previousEndDate
    );

    res.json({
      data: comparison,
      message: 'Period comparison completed successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Period comparison error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to compare periods'
    } as ApiResponse);
  }
});

/**
 * GET /api/analytics/recommendations
 * Get personalized recommendations
 * Query params: startDate, endDate
 */
router.get('/recommendations', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'startDate and endDate are required'
      } as ApiResponse);
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    const report = await analyticsService.generateAnalyticsReport(
      userId, 
      start, 
      end, 
      'month'
    );

    res.json({
      data: {
        recommendations: report.recommendations,
        basedOnPeriod: report.period,
        generatedAt: report.generatedAt
      },
      message: 'Recommendations generated successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate recommendations'
    } as ApiResponse);
  }
});

/**
 * GET /api/analytics/export/stats
 * Get export statistics for the user
 */
router.get('/export/stats', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    
    const stats = await exportService.getExportStats(userId);

    res.json({
      data: stats,
      message: 'Export statistics retrieved successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Export stats error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve export statistics'
    } as ApiResponse);
  }
});

/**
 * POST /api/analytics/export
 * Export user data in JSON or CSV format
 * Body: { format, dateRange: { start, end }, includeHabits?, includeTasks?, includeSkillTests?, includeAnalytics? }
 */
router.post('/export', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { 
      format = 'json', 
      dateRange, 
      includeHabits = true, 
      includeTasks = true, 
      includeSkillTests = false, 
      includeAnalytics = true 
    } = req.body;

    if (!dateRange || !dateRange.start || !dateRange.end) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'dateRange with start and end dates is required'
      } as ApiResponse);
    }

    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({
        error: 'Invalid format',
        message: 'Format must be either "json" or "csv"'
      } as ApiResponse);
    }

    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        error: 'Invalid dates',
        message: 'Start and end dates must be valid dates'
      } as ApiResponse);
    }

    const exportOptions = {
      format: format as 'json' | 'csv',
      dateRange: { start: startDate, end: endDate },
      includeHabits,
      includeTasks,
      includeSkillTests,
      includeAnalytics
    };

    const exportResult = await exportService.exportUserData(userId, exportOptions);

    // Set appropriate headers for file download
    res.setHeader('Content-Type', exportResult.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
    
    res.send(exportResult.data);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to export data'
    } as ApiResponse);
  }
});

/**
 * GET /api/analytics/summary
 * Get quick analytics summary for dashboard
 * Query params: days (optional, defaults to 30)
 */
router.get('/summary', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const days = parseInt(req.query.days as string) || 30;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const report = await analyticsService.generateAnalyticsReport(
      userId, 
      startDate, 
      endDate, 
      'month'
    );

    // Create a simplified summary
    const summary = {
      period: `Last ${days} days`,
      averageKPI: report.summary.averageKPI,
      totalHours: report.summary.totalHours,
      completedDays: report.summary.completedDays,
      completionRate: Math.round((report.summary.completedDays / days) * 100),
      topHabits: report.summary.topHabits.slice(0, 3),
      keyTrends: report.trends.slice(0, 3).map(t => ({
        habit: t.habitName,
        trend: t.trend,
        percentage: t.trendPercentage
      })),
      topRecommendation: report.recommendations[0] || null,
      forecast: {
        nextMonth: report.forecast.predictedKPI,
        confidence: report.forecast.confidence
      }
    };

    res.json({
      data: summary,
      message: 'Analytics summary retrieved successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Analytics summary error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve analytics summary'
    } as ApiResponse);
  }
});

/**
 * GET /api/analytics/team/:teamId/activity
 * Get team activity analytics
 * Query params: startDate, endDate
 */
router.get('/team/:teamId/activity', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { teamId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'startDate and endDate are required'
      } as ApiResponse);
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        error: 'Invalid dates',
        message: 'startDate and endDate must be valid dates'
      } as ApiResponse);
    }

    const teamActivity = await teamAnalyticsService.generateTeamActivitySummary(
      teamId,
      start,
      end,
      userId
    );

    res.json({
      data: teamActivity,
      message: 'Team activity analytics retrieved successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Team analytics error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to retrieve team analytics'
    } as ApiResponse);
  }
});

/**
 * POST /api/analytics/team/:teamId/export
 * Export team data
 * Body: { format, startDate, endDate }
 */
router.post('/team/:teamId/export', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { teamId } = req.params;
    const { format = 'json', startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'startDate and endDate are required'
      } as ApiResponse);
    }

    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({
        error: 'Invalid format',
        message: 'Format must be either "json" or "csv"'
      } as ApiResponse);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        error: 'Invalid dates',
        message: 'Start and end dates must be valid dates'
      } as ApiResponse);
    }

    const exportResult = await teamAnalyticsService.exportTeamData(
      teamId,
      userId,
      format as 'json' | 'csv',
      start,
      end
    );

    // Set appropriate headers for file download
    res.setHeader('Content-Type', exportResult.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
    
    res.send(exportResult.data);

  } catch (error) {
    console.error('Team export error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to export team data'
    } as ApiResponse);
  }
});

/**
 * GET /api/analytics/principles/usage
 * Get principles usage statistics
 * Query params: startDate, endDate (optional)
 */
router.get('/principles/usage', async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = req.query;

    let start: Date | undefined;
    let end: Date | undefined;

    if (startDate && endDate) {
      start = new Date(startDate as string);
      end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          error: 'Invalid dates',
          message: 'startDate and endDate must be valid dates'
        } as ApiResponse);
      }
    }

    const principleStats = await principlesAnalyticsService.getPrincipleUsageStats(start, end);

    res.json({
      data: principleStats,
      message: 'Principles usage statistics retrieved successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Principles analytics error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve principles analytics'
    } as ApiResponse);
  }
});

/**
 * GET /api/analytics/principles/user-insights
 * Get personalized principle insights for current user
 * Query params: startDate, endDate (optional)
 */
router.get('/principles/user-insights', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { startDate, endDate } = req.query;

    let start: Date | undefined;
    let end: Date | undefined;

    if (startDate && endDate) {
      start = new Date(startDate as string);
      end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          error: 'Invalid dates',
          message: 'startDate and endDate must be valid dates'
        } as ApiResponse);
      }
    }

    const userInsights = await principlesAnalyticsService.getUserPrincipleInsights(userId, start, end);

    res.json({
      data: userInsights,
      message: 'User principle insights retrieved successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('User principle insights error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve user principle insights'
    } as ApiResponse);
  }
});

/**
 * GET /api/analytics/principles/effectiveness-report
 * Get comprehensive principle effectiveness report
 * Query params: startDate, endDate
 */
router.get('/principles/effectiveness-report', async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'startDate and endDate are required'
      } as ApiResponse);
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        error: 'Invalid dates',
        message: 'startDate and endDate must be valid dates'
      } as ApiResponse);
    }

    const effectivenessReport = await principlesAnalyticsService.generatePrincipleEffectivenessReport(start, end);

    res.json({
      data: effectivenessReport,
      message: 'Principle effectiveness report generated successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Principle effectiveness report error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate principle effectiveness report'
    } as ApiResponse);
  }
});

/**
 * GET /api/analytics/goals/insights
 * Get personalized goal-based insights
 */
router.get('/goals/insights', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const goalInsights = await goalInsightsService.generateGoalInsights(userId);

    res.json({
      data: goalInsights,
      message: 'Goal insights generated successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Goal insights error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate goal insights'
    } as ApiResponse);
  }
});

export default router;