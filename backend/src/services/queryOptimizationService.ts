import { PrismaClient } from '@prisma/client';

export interface QueryOptimizationOptions {
  enableLogging?: boolean;
  slowQueryThreshold?: number; // milliseconds
  cacheResults?: boolean;
}

class QueryOptimizationService {
  private prisma: PrismaClient;
  private options: QueryOptimizationOptions;
  private queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  constructor(prisma: PrismaClient, options: QueryOptimizationOptions = {}) {
    this.prisma = prisma;
    this.options = {
      enableLogging: true,
      slowQueryThreshold: 1000, // 1 second
      cacheResults: false,
      ...options
    };
  }

  /**
   * Optimized query for getting user goals with all relations
   */
  async getOptimizedGoalsForUser(userId: string) {
    const cacheKey = `goals:${userId}`;
    
    // Check cache first
    if (this.options.cacheResults) {
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;
    }

    const startTime = Date.now();

    try {
      // Single optimized query with all necessary includes
      const [goals, connections] = await Promise.all([
        this.prisma.goal.findMany({
          where: { userId },
          include: {
            fromConnections: {
              select: {
                id: true,
                toGoalId: true,
                connectionType: true
              }
            },
            toConnections: {
              select: {
                id: true,
                fromGoalId: true,
                connectionType: true
              }
            },
            generatedHabits: {
              select: {
                id: true,
                habitId: true,
                habit: {
                  select: {
                    id: true,
                    name: true,
                    targetMinutes: true,
                    category: true
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        
        // Separate query for connections to avoid N+1
        this.prisma.goalConnection.findMany({
          where: {
            OR: [
              { fromGoal: { userId } },
              { toGoal: { userId } }
            ]
          },
          select: {
            id: true,
            fromGoalId: true,
            toGoalId: true,
            connectionType: true
          }
        })
      ]);

      const result = {
        goals,
        connections,
        viewport: { x: 0, y: 0, zoom: 1 }
      };

      // Cache the result
      if (this.options.cacheResults) {
        this.setCache(cacheKey, result, 600000); // 10 minutes
      }

      this.logQueryPerformance('getOptimizedGoalsForUser', startTime);
      return result;

    } catch (error) {
      this.logQueryError('getOptimizedGoalsForUser', error, startTime);
      throw error;
    }
  }

  /**
   * Optimized analytics query with proper indexing hints
   */
  async getOptimizedAnalyticsData(
    userId: string, 
    startDate: Date, 
    endDate: Date,
    reportType: 'month' | 'quarter' | 'year'
  ) {
    const cacheKey = `analytics:${userId}:${reportType}:${startDate.toISOString()}:${endDate.toISOString()}`;
    
    if (this.options.cacheResults) {
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;
    }

    const startTime = Date.now();

    try {
      // Optimized query with selective fields and proper joins
      const dailyRecords = await this.prisma.dailyRecord.findMany({
        where: {
          userId,
          date: {
            gte: startDate,
            lte: endDate
          },
          exceptionType: null
        },
        select: {
          id: true,
          date: true,
          totalKpi: true,
          habitRecords: {
            select: {
              id: true,
              habitId: true,
              actualMinutes: true,
              qualityScore: true,
              habit: {
                select: {
                  id: true,
                  name: true,
                  targetMinutes: true,
                  category: true,
                  skillLevel: true
                }
              }
            }
          }
        },
        orderBy: {
          date: 'asc'
        }
      });

      // Process data efficiently
      const result = this.processAnalyticsData(dailyRecords, reportType);

      if (this.options.cacheResults) {
        this.setCache(cacheKey, result, 1800000); // 30 minutes
      }

      this.logQueryPerformance('getOptimizedAnalyticsData', startTime);
      return result;

    } catch (error) {
      this.logQueryError('getOptimizedAnalyticsData', error, startTime);
      throw error;
    }
  }

  /**
   * Optimized dashboard data query
   */
  async getOptimizedDashboardData(userId: string, year: number, month?: number) {
    const cacheKey = month 
      ? `dashboard:${userId}:month:${year}:${month}`
      : `dashboard:${userId}:year:${year}`;
    
    if (this.options.cacheResults) {
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;
    }

    const startTime = Date.now();

    try {
      let startDate: Date;
      let endDate: Date;

      if (month) {
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 0);
      } else {
        startDate = new Date(year, 0, 1);
        endDate = new Date(year, 11, 31);
      }

      // Single optimized query
      const dailyRecords = await this.prisma.dailyRecord.findMany({
        where: {
          userId,
          date: {
            gte: startDate,
            lte: endDate
          },
          exceptionType: null
        },
        select: {
          id: true,
          date: true,
          totalKpi: true,
          habitRecords: {
            select: {
              habitId: true,
              actualMinutes: true,
              qualityScore: true,
              habit: {
                select: {
                  id: true,
                  name: true,
                  targetMinutes: true
                }
              }
            }
          },
          tasks: {
            select: {
              id: true,
              title: true,
              completed: true
            }
          }
        },
        orderBy: {
          date: 'asc'
        }
      });

      const result = month 
        ? this.processDashboardMonthData(dailyRecords, year, month)
        : this.processDashboardYearData(dailyRecords, year);

      if (this.options.cacheResults) {
        this.setCache(cacheKey, result, 3600000); // 1 hour
      }

      this.logQueryPerformance('getOptimizedDashboardData', startTime);
      return result;

    } catch (error) {
      this.logQueryError('getOptimizedDashboardData', error, startTime);
      throw error;
    }
  }

  /**
   * Batch query optimization for multiple related queries
   */
  async executeBatchQueries<T>(queries: (() => Promise<T>)[]): Promise<T[]> {
    const startTime = Date.now();
    
    try {
      // Execute all queries in parallel
      const results = await Promise.all(queries.map(query => query()));
      
      this.logQueryPerformance(`executeBatchQueries(${queries.length})`, startTime);
      return results;
    } catch (error) {
      this.logQueryError('executeBatchQueries', error, startTime);
      throw error;
    }
  }

  /**
   * Process analytics data efficiently
   */
  private processAnalyticsData(dailyRecords: any[], reportType: string) {
    const summary = {
      averageKPI: 0,
      totalHours: 0,
      completedDays: dailyRecords.length,
      totalDays: dailyRecords.length,
      topHabits: [] as any[]
    };

    const habitMap = new Map<string, {
      habitId: string;
      habitName: string;
      totalMinutes: number;
      count: number;
      qualityScores: number[];
    }>();

    let totalKPI = 0;
    let totalMinutes = 0;

    // Process records efficiently in a single pass
    for (const record of dailyRecords) {
      if (record.totalKpi) {
        totalKPI += record.totalKpi;
      }

      for (const habitRecord of record.habitRecords) {
        totalMinutes += habitRecord.actualMinutes;

        const habitId = habitRecord.habitId;
        if (!habitMap.has(habitId)) {
          habitMap.set(habitId, {
            habitId,
            habitName: habitRecord.habit.name,
            totalMinutes: 0,
            count: 0,
            qualityScores: []
          });
        }

        const habit = habitMap.get(habitId)!;
        habit.totalMinutes += habitRecord.actualMinutes;
        habit.count += 1;
        
        if (habitRecord.qualityScore) {
          habit.qualityScores.push(habitRecord.qualityScore);
        }
      }
    }

    // Calculate summary
    summary.averageKPI = dailyRecords.length > 0 ? totalKPI / dailyRecords.length : 0;
    summary.totalHours = totalMinutes / 60;

    // Process top habits
    summary.topHabits = Array.from(habitMap.values())
      .map(habit => ({
        habitId: habit.habitId,
        habitName: habit.habitName,
        totalMinutes: habit.totalMinutes,
        averageMinutes: habit.totalMinutes / habit.count,
        completionRate: (habit.count / dailyRecords.length) * 100,
        averageQuality: habit.qualityScores.length > 0 
          ? habit.qualityScores.reduce((sum, q) => sum + q, 0) / habit.qualityScores.length 
          : undefined
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes)
      .slice(0, 5);

    return {
      summary,
      trends: [], // Would be calculated based on time series analysis
      recommendations: [], // Would be generated based on patterns
      forecast: {
        predictedKPI: summary.averageKPI * 1.01, // Simple 1% improvement forecast
        confidence: 0.75
      },
      period: {
        start: dailyRecords[0]?.date,
        end: dailyRecords[dailyRecords.length - 1]?.date,
        type: reportType
      },
      generatedAt: new Date()
    };
  }

  /**
   * Process dashboard year data efficiently
   */
  private processDashboardYearData(dailyRecords: any[], year: number) {
    const monthsData = [];
    let totalYearHours = 0;
    let totalYearKPI = 0;
    let totalValidDays = 0;

    // Group by months
    for (let month = 1; month <= 12; month++) {
      const monthRecords = dailyRecords.filter(record => 
        new Date(record.date).getMonth() + 1 === month
      );

      if (monthRecords.length === 0) {
        monthsData.push({
          month,
          year,
          averageKPI: 0,
          totalHours: 0,
          completedDays: 0,
          habitBreakdown: []
        });
        continue;
      }

      // Process month data
      const monthKPIs = monthRecords
        .filter(r => r.totalKpi !== null)
        .map(r => r.totalKpi);
      
      const averageKPI = monthKPIs.length > 0 
        ? monthKPIs.reduce((sum, kpi) => sum + kpi, 0) / monthKPIs.length 
        : 0;

      const monthHours = monthRecords.reduce((total, record) => {
        return total + record.habitRecords.reduce((sum, hr) => sum + hr.actualMinutes, 0);
      }, 0) / 60;

      monthsData.push({
        month,
        year,
        averageKPI,
        totalHours: monthHours,
        completedDays: monthRecords.length,
        habitBreakdown: [] // Simplified for performance
      });

      totalYearHours += monthHours;
      totalYearKPI += averageKPI * monthRecords.length;
      totalValidDays += monthRecords.length;
    }

    const averageYearKPI = totalValidDays > 0 ? totalYearKPI / totalValidDays : 0;
    const totalActivities = dailyRecords.reduce((total, record) => 
      total + record.habitRecords.length, 0
    );

    const forecast2027 = averageYearKPI * Math.pow(1.01, 365);

    return {
      months: monthsData,
      averageKPI: Math.round(averageYearKPI * 100) / 100,
      totalHours: Math.round(totalYearHours * 100) / 100,
      totalActivities,
      forecast2027: Math.round(forecast2027 * 100) / 100
    };
  }

  /**
   * Process dashboard month data efficiently
   */
  private processDashboardMonthData(dailyRecords: any[], year: number, month: number) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyKPIData = [];

    // Create daily data
    for (let day = 1; day <= daysInMonth; day++) {
      const dayRecord = dailyRecords.find(record => 
        new Date(record.date).getDate() === day
      );

      dailyKPIData.push({
        day,
        date: new Date(year, month - 1, day).toISOString().split('T')[0],
        kpi: dayRecord?.totalKpi || 0,
        isException: false,
        exceptionType: null,
        habitRecords: dayRecord?.habitRecords || []
      });
    }

    // Calculate month statistics
    const validRecords = dailyRecords.filter(r => !r.exceptionType);
    const monthKPIs = validRecords
      .filter(r => r.totalKpi !== null)
      .map(r => r.totalKpi);
    
    const monthStats = {
      averageKPI: monthKPIs.length > 0 
        ? monthKPIs.reduce((sum, kpi) => sum + kpi, 0) / monthKPIs.length 
        : 0,
      totalHours: validRecords.reduce((total, record) => {
        return total + record.habitRecords.reduce((sum, hr) => sum + hr.actualMinutes, 0);
      }, 0) / 60,
      completedDays: validRecords.length,
      totalDays: daysInMonth,
      completionRate: (validRecords.length / daysInMonth) * 100,
      exceptionDays: 0
    };

    return {
      dailyData: dailyKPIData,
      monthStats,
      month,
      year
    };
  }

  /**
   * Simple in-memory cache implementation
   */
  private getFromCache(key: string): any | null {
    const cached = this.queryCache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    this.queryCache.delete(key);
    return null;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.queryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Log query performance
   */
  private logQueryPerformance(queryName: string, startTime: number): void {
    if (!this.options.enableLogging) return;

    const duration = Date.now() - startTime;
    if (duration > this.options.slowQueryThreshold!) {
      console.warn(`Slow query detected: ${queryName} took ${duration}ms`);
    } else {
      console.log(`Query ${queryName} completed in ${duration}ms`);
    }
  }

  /**
   * Log query errors
   */
  private logQueryError(queryName: string, error: any, startTime: number): void {
    const duration = Date.now() - startTime;
    console.error(`Query ${queryName} failed after ${duration}ms:`, error);
  }

  /**
   * Clear all cached queries
   */
  clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.queryCache.size,
      keys: Array.from(this.queryCache.keys())
    };
  }
}

export default QueryOptimizationService;