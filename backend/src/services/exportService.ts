import { prisma } from '../index.js';
import { 
  DailyRecord,
  HabitRecord,
  Task,
  Habit,
  SkillTest,
  SkillProgress
} from '../types/index.js';

/**
 * Export Service for KPI Productivity 2026
 * Handles data export in JSON and CSV formats
 * Requirements: 1.4 - Export functionality
 */

export interface ExportOptions {
  format: 'json' | 'csv';
  dateRange: {
    start: Date;
    end: Date;
  };
  includeHabits?: boolean;
  includeTasks?: boolean;
  includeSkillTests?: boolean;
  includeAnalytics?: boolean;
}

export interface ExportData {
  metadata: {
    userId: string;
    exportDate: Date;
    dateRange: {
      start: Date;
      end: Date;
    };
    recordCount: number;
    format: string;
  };
  dailyRecords: any[];
  habits?: Habit[];
  skillTests?: SkillTest[];
  skillProgress?: SkillProgress[];
  analytics?: {
    averageKPI: number;
    totalHours: number;
    completionRate: number;
    topHabits: any[];
    trends: any[];
  };
}

export class ExportService {
  
  /**
   * Export user data in specified format
   */
  async exportUserData(
    userId: string, 
    options: ExportOptions
  ): Promise<{ data: string; filename: string; contentType: string }> {
    
    // Gather all requested data
    const exportData = await this.gatherExportData(userId, options);
    
    if (options.format === 'json') {
      return this.exportAsJSON(exportData, options);
    } else {
      return this.exportAsCSV(exportData, options);
    }
  }

  /**
   * Gather all data for export
   */
  private async gatherExportData(
    userId: string, 
    options: ExportOptions
  ): Promise<ExportData> {
    
    // Get daily records with related data
    const dailyRecords = await prisma.dailyRecord.findMany({
      where: {
        userId,
        date: {
          gte: options.dateRange.start,
          lte: options.dateRange.end
        }
      },
      include: {
        habitRecords: {
          include: {
            habit: true
          }
        },
        tasks: true
      },
      orderBy: {
        date: 'asc'
      }
    });

    const exportData: ExportData = {
      metadata: {
        userId,
        exportDate: new Date(),
        dateRange: options.dateRange,
        recordCount: dailyRecords.length,
        format: options.format
      },
      dailyRecords: this.formatDailyRecords(dailyRecords)
    };

    // Add habits if requested
    if (options.includeHabits) {
      exportData.habits = await prisma.habit.findMany({
        orderBy: { name: 'asc' }
      }) as any[];
    }

    // Add skill tests if requested (temporarily disabled - Prisma client needs regeneration)
    if (options.includeSkillTests) {
      // Skill functionality is temporarily disabled
      exportData.skillTests = [];
      exportData.skillProgress = [];
    }

    // Add analytics if requested
    if (options.includeAnalytics) {
      exportData.analytics = this.calculateExportAnalytics(dailyRecords) as any;
    }

    return exportData;
  }

  /**
   * Format daily records for export
   */
  private formatDailyRecords(dailyRecords: any[]): any[] {
    return dailyRecords.map(record => ({
      id: record.id,
      date: record.date.toISOString().split('T')[0],
      totalKpi: record.totalKpi,
      exceptionType: record.exceptionType,
      exceptionNote: record.exceptionNote,
      habitRecords: record.habitRecords.map((hr: any) => ({
        habitId: hr.habitId,
        habitName: hr.habit.name,
        actualMinutes: hr.actualMinutes,
        qualityScore: hr.qualityScore,
        efficiencyCoefficients: hr.efficiencyCoefficients
      })),
      tasks: record.tasks.map((task: any) => ({
        id: task.id,
        title: task.title,
        priority: task.priority,
        completed: task.completed,
        estimatedMinutes: task.estimatedMinutes,
        actualMinutes: task.actualMinutes
      }))
    }));
  }

  /**
   * Calculate analytics for export
   */
  private calculateExportAnalytics(dailyRecords: any[]) {
    const validRecords = dailyRecords.filter(r => r.totalKpi !== null);
    
    const averageKPI = validRecords.length > 0 
      ? validRecords.reduce((sum, r) => sum + r.totalKpi, 0) / validRecords.length 
      : 0;
    
    const totalHours = dailyRecords.reduce((total, record) => {
      return total + record.habitRecords.reduce((sum: number, hr: any) => sum + hr.actualMinutes, 0);
    }, 0) / 60;

    const completionRate = (validRecords.length / dailyRecords.length) * 100;

    // Calculate top habits
    const habitMap = new Map<string, { name: string, totalMinutes: number, count: number }>();
    
    dailyRecords.forEach(record => {
      record.habitRecords.forEach((hr: any) => {
        const key = hr.habitId;
        if (!habitMap.has(key)) {
          habitMap.set(key, { name: hr.habit.name, totalMinutes: 0, count: 0 });
        }
        const habit = habitMap.get(key)!;
        habit.totalMinutes += hr.actualMinutes;
        habit.count += 1;
      });
    });

    const topHabits = Array.from(habitMap.values())
      .sort((a, b) => b.totalMinutes - a.totalMinutes)
      .slice(0, 5)
      .map(habit => ({
        name: habit.name,
        totalMinutes: habit.totalMinutes,
        averageMinutes: Math.round(habit.totalMinutes / habit.count),
        totalHours: Math.round((habit.totalMinutes / 60) * 100) / 100
      }));

    // Simple trend calculation
    const trends = this.calculateSimpleTrends(dailyRecords);

    return {
      averageKPI: Math.round(averageKPI * 100) / 100,
      totalHours: Math.round(totalHours * 100) / 100,
      completionRate: Math.round(completionRate * 100) / 100,
      topHabits,
      trends
    };
  }

  /**
   * Calculate simple trends for export
   */
  private calculateSimpleTrends(dailyRecords: any[]) {
    const validRecords = dailyRecords.filter(r => r.totalKpi !== null);
    
    if (validRecords.length < 7) {
      return { trend: 'insufficient_data', message: 'Need at least 7 days of data for trend analysis' };
    }

    const firstWeek = validRecords.slice(0, 7);
    const lastWeek = validRecords.slice(-7);

    const firstWeekAvg = firstWeek.reduce((sum, r) => sum + r.totalKpi, 0) / firstWeek.length;
    const lastWeekAvg = lastWeek.reduce((sum, r) => sum + r.totalKpi, 0) / lastWeek.length;

    const change = lastWeekAvg - firstWeekAvg;
    const changePercentage = firstWeekAvg > 0 ? (change / firstWeekAvg) * 100 : 0;

    return {
      trend: change > 1 ? 'improving' : change < -1 ? 'declining' : 'stable',
      changePercentage: Math.round(changePercentage * 100) / 100,
      firstWeekAverage: Math.round(firstWeekAvg * 100) / 100,
      lastWeekAverage: Math.round(lastWeekAvg * 100) / 100
    };
  }

  /**
   * Export data as JSON
   */
  private exportAsJSON(
    exportData: ExportData, 
    options: ExportOptions
  ): { data: string; filename: string; contentType: string } {
    
    const jsonData = JSON.stringify(exportData, null, 2);
    const startDate = options.dateRange.start.toISOString().split('T')[0];
    const endDate = options.dateRange.end.toISOString().split('T')[0];
    const filename = `kpi-productivity-export-${startDate}-to-${endDate}.json`;

    return {
      data: jsonData,
      filename,
      contentType: 'application/json'
    };
  }

  /**
   * Export data as CSV
   */
  private exportAsCSV(
    exportData: ExportData, 
    options: ExportOptions
  ): { data: string; filename: string; contentType: string } {
    
    let csvData = '';
    
    // Add metadata header
    csvData += 'KPI Productivity 2026 Export\n';
    csvData += `Export Date: ${exportData.metadata.exportDate.toISOString()}\n`;
    csvData += `Date Range: ${exportData.metadata.dateRange.start.toISOString().split('T')[0]} to ${exportData.metadata.dateRange.end.toISOString().split('T')[0]}\n`;
    csvData += `Total Records: ${exportData.metadata.recordCount}\n\n`;

    // Daily Records CSV
    csvData += 'DAILY RECORDS\n';
    csvData += 'Date,Total KPI,Exception Type,Exception Note,Habit Count,Task Count\n';
    
    exportData.dailyRecords.forEach(record => {
      csvData += `${record.date},${record.totalKpi || ''},${record.exceptionType || ''},${this.escapeCsvValue(record.exceptionNote || '')},${record.habitRecords.length},${record.tasks.length}\n`;
    });

    // Habit Records CSV
    csvData += '\nHABIT RECORDS\n';
    csvData += 'Date,Habit Name,Actual Minutes,Quality Score,Target Met\n';
    
    exportData.dailyRecords.forEach(record => {
      record.habitRecords.forEach((hr: any) => {
        const targetMet = hr.actualMinutes >= (exportData.habits?.find(h => h.id === hr.habitId)?.targetMinutes || 0);
        csvData += `${record.date},${this.escapeCsvValue(hr.habitName)},${hr.actualMinutes},${hr.qualityScore || ''},${targetMet ? 'Yes' : 'No'}\n`;
      });
    });

    // Tasks CSV
    csvData += '\nTASKS\n';
    csvData += 'Date,Task Title,Priority,Completed,Estimated Minutes,Actual Minutes\n';
    
    exportData.dailyRecords.forEach(record => {
      record.tasks.forEach((task: any) => {
        csvData += `${record.date},${this.escapeCsvValue(task.title)},${task.priority},${task.completed ? 'Yes' : 'No'},${task.estimatedMinutes || ''},${task.actualMinutes || ''}\n`;
      });
    });

    // Analytics summary if included
    if (exportData.analytics) {
      csvData += '\nANALYTICS SUMMARY\n';
      csvData += `Average KPI: ${exportData.analytics.averageKPI}\n`;
      csvData += `Total Hours: ${exportData.analytics.totalHours}\n`;
      csvData += `Completion Rate: ${exportData.analytics.completionRate}%\n`;
      
      csvData += '\nTOP HABITS\n';
      csvData += 'Habit Name,Total Minutes,Average Minutes,Total Hours\n';
      exportData.analytics.topHabits.forEach(habit => {
        csvData += `${this.escapeCsvValue(habit.name)},${habit.totalMinutes},${habit.averageMinutes},${habit.totalHours}\n`;
      });
    }

    const startDate = options.dateRange.start.toISOString().split('T')[0];
    const endDate = options.dateRange.end.toISOString().split('T')[0];
    const filename = `kpi-productivity-export-${startDate}-to-${endDate}.csv`;

    return {
      data: csvData,
      filename,
      contentType: 'text/csv'
    };
  }

  /**
   * Escape CSV values that contain commas, quotes, or newlines
   */
  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Get export statistics for a user
   */
  async getExportStats(userId: string): Promise<{
    totalDays: number;
    dateRange: { start: Date; end: Date } | null;
    totalHabits: number;
    totalTasks: number;
    totalSkillTests: number;
  }> {
    
    const [dailyRecordsCount, dateRange, habitsCount, tasksCount, skillTestsCount] = await Promise.all([
      prisma.dailyRecord.count({ where: { userId } }),
      prisma.dailyRecord.aggregate({
        where: { userId },
        _min: { date: true },
        _max: { date: true }
      }),
      prisma.habit.count(),
      prisma.task.count({
        where: {
          dailyRecord: { userId }
        }
      }),
      // Temporarily return 0 for skill tests count
      Promise.resolve(0)
    ]);

    return {
      totalDays: dailyRecordsCount,
      dateRange: dateRange._min.date && dateRange._max.date ? {
        start: dateRange._min.date,
        end: dateRange._max.date
      } : null,
      totalHabits: habitsCount,
      totalTasks: tasksCount,
      totalSkillTests: skillTestsCount
    };
  }
}

// Export singleton instance
export const exportService = new ExportService();