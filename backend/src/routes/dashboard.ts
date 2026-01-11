import express from 'express';
import { prisma } from '../index';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { cacheService } from '../services/cacheService';
import QueryOptimizationService from '../services/queryOptimizationService';
import { 
  ApiResponse,
  YearData,
  MonthSummary,
  HabitSummary
} from '../types/index';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/dashboard/year/:year
 * Get yearly overview data for the dashboard
 */
router.get('/year/:year', async (req: AuthRequest, res) => {
  try {
    const { year } = req.params;
    const userId = req.userId!;
    const yearNum = parseInt(year);

    if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2030) {
      return res.status(400).json({
        error: 'Invalid year',
        message: 'Year must be between 2020 and 2030'
      } as ApiResponse);
    }

    // Initialize query optimization service
    const queryOptimizer = new QueryOptimizationService(prisma, {
      enableLogging: process.env.NODE_ENV === 'development',
      slowQueryThreshold: 1000,
      cacheResults: true
    });

    // Try to get from cache first
    const cacheResult = await cacheService.getCachedDashboardData(userId, 'year', yearNum);
    
    if (cacheResult.hit && cacheResult.data) {
      res.setHeader('X-Cache', 'HIT');
      return res.json({
        data: cacheResult.data,
        message: 'Year data retrieved successfully (cached)'
      } as ApiResponse<YearData>);
    }

    // Cache miss - use optimized query
    const yearData = await queryOptimizer.getOptimizedDashboardData(userId, yearNum);

    // Cache the result
    await cacheService.cacheDashboardData(userId, 'year', yearNum, undefined, yearData);

    res.setHeader('X-Cache', 'MISS');
    res.json({
      data: yearData,
      message: 'Year data retrieved successfully'
    } as ApiResponse<YearData>);

  } catch (error) {
    console.error('Year data retrieval error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve year data'
    } as ApiResponse);
  }
});

/**
 * GET /api/dashboard/month/:year/:month
 * Get detailed monthly data
 */
router.get('/month/:year/:month', async (req: AuthRequest, res) => {
  try {
    const { year, month } = req.params;
    const userId = req.userId!;
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        error: 'Invalid date',
        message: 'Year and month must be valid numbers'
      } as ApiResponse);
    }

    // Initialize query optimization service
    const queryOptimizer = new QueryOptimizationService(prisma, {
      enableLogging: process.env.NODE_ENV === 'development',
      slowQueryThreshold: 1000,
      cacheResults: true
    });

    // Try to get from cache first
    const cacheResult = await cacheService.getCachedDashboardData(userId, 'month', yearNum, monthNum);
    
    if (cacheResult.hit && cacheResult.data) {
      res.setHeader('X-Cache', 'HIT');
      
      // Get all habits for the user (this is lightweight and changes infrequently)
      const habits = await prisma.habit.findMany({
        orderBy: { name: 'asc' }
      });

      return res.json({
        data: {
          ...cacheResult.data,
          habits
        },
        message: 'Month data retrieved successfully (cached)'
      } as ApiResponse);
    }

    // Cache miss - use optimized query
    const monthData = await queryOptimizer.getOptimizedDashboardData(userId, yearNum, monthNum);

    // Get all habits for the user
    const habits = await prisma.habit.findMany({
      orderBy: { name: 'asc' }
    });

    const result = {
      ...monthData,
      habits
    };

    // Cache the result (without habits to keep cache size smaller)
    await cacheService.cacheDashboardData(userId, 'month', yearNum, monthNum, monthData);

    res.setHeader('X-Cache', 'MISS');
    res.json({
      data: result,
      message: 'Month data retrieved successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Month data retrieval error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve month data'
    } as ApiResponse);
  }
});

export default router;