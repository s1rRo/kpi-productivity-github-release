import { describe, test, expect, beforeEach, vi } from 'vitest';
import { AnalyticsService } from '../analyticsService.js';
import { TrendAnalysis, ForecastData, PersonalizedRecommendation } from '../analyticsService.js';

// Mock Prisma client
vi.mock('../index.js', () => ({
  prisma: {
    dailyRecord: {
      findMany: vi.fn()
    },
    habit: {
      findMany: vi.fn()
    }
  }
}));

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let mockDailyRecords: any[];
  let mockHabits: any[];

  beforeEach(() => {
    analyticsService = new AnalyticsService();
    
    // Mock daily records with habit records and tasks
    mockDailyRecords = [
      {
        id: 'daily1',
        userId: 'user1',
        date: new Date('2024-01-01'),
        totalKpi: 95.5,
        exceptionType: null,
        habitRecords: [
          {
            id: 'hr1',
            habitId: 'habit1',
            actualMinutes: 300,
            qualityScore: 4,
            createdAt: new Date('2024-01-01'),
            habit: { id: 'habit1', name: 'Работа' }
          },
          {
            id: 'hr2',
            habitId: 'habit2',
            actualMinutes: 60,
            qualityScore: 5,
            createdAt: new Date('2024-01-01'),
            habit: { id: 'habit2', name: 'Английский' }
          }
        ],
        tasks: [
          {
            id: 'task1',
            title: 'Complete project',
            priority: 'high',
            completed: true,
            estimatedMinutes: 120,
            actualMinutes: 100
          }
        ]
      },
      {
        id: 'daily2',
        userId: 'user1',
        date: new Date('2024-01-02'),
        totalKpi: 88.2,
        exceptionType: null,
        habitRecords: [
          {
            id: 'hr3',
            habitId: 'habit1',
            actualMinutes: 280,
            qualityScore: 3,
            createdAt: new Date('2024-01-02'),
            habit: { id: 'habit1', name: 'Работа' }
          },
          {
            id: 'hr4',
            habitId: 'habit2',
            actualMinutes: 45,
            qualityScore: 4,
            createdAt: new Date('2024-01-02'),
            habit: { id: 'habit2', name: 'Английский' }
          }
        ],
        tasks: [
          {
            id: 'task2',
            title: 'Review documentation',
            priority: 'medium',
            completed: true,
            estimatedMinutes: 60,
            actualMinutes: 70
          }
        ]
      }
    ];

    mockHabits = [
      {
        id: 'habit1',
        name: 'Работа',
        targetMinutes: 360,
        category: 'career',
        skillLevel: 4,
        eisenhowerQuadrant: 'Q1'
      },
      {
        id: 'habit2',
        name: 'Английский',
        targetMinutes: 60,
        category: 'skills',
        skillLevel: 2,
        eisenhowerQuadrant: 'Q2'
      }
    ];
  });

  describe('calculateSummaryStats', () => {
    test('should calculate correct summary statistics', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-02');
      
      // Use private method through type assertion for testing
      const summary = (analyticsService as any).calculateSummaryStats(
        mockDailyRecords, 
        startDate, 
        endDate
      );

      expect(summary.averageKPI).toBeCloseTo(91.85, 1); // (95.5 + 88.2) / 2
      expect(summary.totalHours).toBeCloseTo(11.42, 1); // (300+60+280+45) / 60
      expect(summary.completedDays).toBe(2);
      expect(summary.totalDays).toBe(2);
      expect(summary.topHabits).toHaveLength(2);
      expect(summary.topHabits[0].habitName).toBe('Работа'); // Should be first by total minutes
    });

    test('should handle empty records gracefully', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-01');
      
      const summary = (analyticsService as any).calculateSummaryStats(
        [], 
        startDate, 
        endDate
      );

      expect(summary.averageKPI).toBe(0);
      expect(summary.totalHours).toBe(0);
      expect(summary.completedDays).toBe(0);
      expect(summary.topHabits).toHaveLength(0);
    });
  });

  describe('calculateTrend', () => {
    test('should identify improving trend', () => {
      const values = [10, 12, 14, 16, 18]; // Clear upward trend
      
      const trend = (analyticsService as any).calculateTrend(values);
      
      expect(trend.trend).toBe('improving');
      expect(trend.percentage).toBeGreaterThan(0);
    });

    test('should identify declining trend', () => {
      const values = [20, 18, 16, 14, 12]; // Clear downward trend
      
      const trend = (analyticsService as any).calculateTrend(values);
      
      expect(trend.trend).toBe('declining');
      expect(trend.percentage).toBeGreaterThan(0);
    });

    test('should identify stable trend', () => {
      const values = [15, 15.1, 14.9, 15.2, 14.8]; // Stable with minor variations
      
      const trend = (analyticsService as any).calculateTrend(values);
      
      expect(trend.trend).toBe('stable');
      expect(trend.percentage).toBe(0);
    });

    test('should handle insufficient data', () => {
      const values = [10]; // Only one data point
      
      const trend = (analyticsService as any).calculateTrend(values);
      
      expect(trend.trend).toBe('stable');
      expect(trend.percentage).toBe(0);
    });
  });

  describe('generateForecast', () => {
    test('should generate forecast with compound growth', () => {
      const forecast = (analyticsService as any).generateForecast(
        mockDailyRecords, 
        'month'
      );

      expect(forecast).toHaveProperty('period', 'next_month');
      expect(forecast).toHaveProperty('predictedKPI');
      expect(forecast).toHaveProperty('predictedHours');
      expect(forecast).toHaveProperty('confidence');
      expect(forecast).toHaveProperty('basedOnDays');
      expect(forecast).toHaveProperty('compoundGrowthRate');

      expect(forecast.predictedKPI).toBeGreaterThan(0);
      expect(forecast.confidence).toBeGreaterThan(0);
      expect(forecast.basedOnDays).toBe(2);
    });

    test('should handle insufficient data for forecasting', () => {
      const forecast = (analyticsService as any).generateForecast(
        [], 
        'month'
      );

      expect(forecast.predictedKPI).toBe(0);
      expect(forecast.predictedHours).toBe(0);
      expect(forecast.confidence).toBe(0);
      expect(forecast.basedOnDays).toBe(0);
    });

    test('should adjust forecast period correctly', () => {
      const monthlyForecast = (analyticsService as any).generateForecast(
        mockDailyRecords, 
        'month'
      );
      const yearlyForecast = (analyticsService as any).generateForecast(
        mockDailyRecords, 
        'year'
      );

      expect(monthlyForecast.period).toBe('next_month');
      expect(yearlyForecast.period).toBe('next_year');
      
      // Yearly forecast should be higher due to compound effect
      expect(yearlyForecast.predictedKPI).toBeGreaterThan(monthlyForecast.predictedKPI);
    });
  });

  describe('generateRecommendations', () => {
    test('should generate habit focus recommendations for declining habits', () => {
      const decliningTrends: TrendAnalysis[] = [
        {
          habitId: 'habit1',
          habitName: 'Работа',
          trend: 'declining',
          trendPercentage: 15,
          averageMinutes: 290,
          consistency: 80,
          recommendation: 'Address declining trend'
        }
      ];

      const recommendations = (analyticsService as any).generateRecommendations(
        mockDailyRecords,
        decliningTrends,
        mockHabits
      );

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].type).toBe('habit_focus');
      expect(recommendations[0].priority).toBe('high');
      expect(recommendations[0].habitIds).toContain('habit1');
    });

    test('should generate time optimization recommendations for low consistency', () => {
      const lowConsistencyTrends: TrendAnalysis[] = [
        {
          habitId: 'habit2',
          habitName: 'Английский',
          trend: 'stable',
          trendPercentage: 0,
          averageMinutes: 50,
          consistency: 45, // Low consistency
          recommendation: 'Improve consistency'
        }
      ];

      const recommendations = (analyticsService as any).generateRecommendations(
        mockDailyRecords,
        lowConsistencyTrends,
        mockHabits
      );

      const timeOptimization = recommendations.find(r => r.type === 'time_optimization');
      expect(timeOptimization).toBeDefined();
      expect(timeOptimization?.priority).toBe('medium');
    });

    test('should generate priority adjustment recommendations for low KPI', () => {
      // Mock low KPI records
      const lowKpiRecords = mockDailyRecords.map(record => ({
        ...record,
        totalKpi: 65 // Below 80 threshold
      }));

      const recommendations = (analyticsService as any).generateRecommendations(
        lowKpiRecords,
        [],
        mockHabits
      );

      const priorityAdjustment = recommendations.find(r => r.type === 'priority_adjustment');
      expect(priorityAdjustment).toBeDefined();
      expect(priorityAdjustment?.priority).toBe('high');
    });

    test('should sort recommendations by priority', () => {
      const mixedTrends: TrendAnalysis[] = [
        {
          habitId: 'habit1',
          habitName: 'Работа',
          trend: 'declining',
          trendPercentage: 15,
          averageMinutes: 290,
          consistency: 80,
          recommendation: 'High priority issue'
        },
        {
          habitId: 'habit2',
          habitName: 'Английский',
          trend: 'stable',
          trendPercentage: 0,
          averageMinutes: 50,
          consistency: 45,
          recommendation: 'Medium priority issue'
        }
      ];

      const recommendations = (analyticsService as any).generateRecommendations(
        mockDailyRecords,
        mixedTrends,
        mockHabits
      );

      // High priority recommendations should come first
      expect(recommendations[0].priority).toBe('high');
    });
  });

  describe('calculatePeriodMetrics', () => {
    test('should calculate period metrics correctly', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-02');
      
      const metrics = (analyticsService as any).calculatePeriodMetrics(
        mockDailyRecords,
        startDate,
        endDate
      );

      expect(metrics.averageKPI).toBeCloseTo(91.85, 1);
      expect(metrics.totalHours).toBeCloseTo(11.42, 1);
      expect(metrics.completionRate).toBe(100); // 2 completed days out of 2 total days
    });

    test('should handle partial completion correctly', () => {
      const partialRecords = [mockDailyRecords[0]]; // Only one day completed
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-02'); // 2-day period
      
      const metrics = (analyticsService as any).calculatePeriodMetrics(
        partialRecords,
        startDate,
        endDate
      );

      expect(metrics.completionRate).toBe(50); // 1 completed day out of 2 total days
    });
  });

  describe('generateComparisonInsights', () => {
    test('should generate positive insights for improvements', () => {
      const insights = (analyticsService as any).generateComparisonInsights(
        10, // KPI improved by 10
        5,  // Hours increased by 5
        15  // Completion rate improved by 15%
      );

      expect(insights).toContain(expect.stringMatching(/Excellent KPI improvement/));
      expect(insights).toContain(expect.stringMatching(/Great improvement in completion rate/));
    });

    test('should generate warning insights for declines', () => {
      const insights = (analyticsService as any).generateComparisonInsights(
        -8,  // KPI declined by 8
        -12, // Hours decreased by 12
        -20  // Completion rate dropped by 20%
      );

      expect(insights).toContain(expect.stringMatching(/KPI declined/));
      expect(insights).toContain(expect.stringMatching(/Completion rate dropped/));
    });

    test('should generate stable insights for minimal changes', () => {
      const insights = (analyticsService as any).generateComparisonInsights(
        2,  // Small KPI change
        1,  // Small hours change
        3   // Small completion rate change
      );

      expect(insights).toContain(expect.stringMatching(/remained relatively stable/));
    });
  });

  describe('generateHabitRecommendation', () => {
    test('should recommend consistency focus for low consistency habits', () => {
      const habit = mockHabits[0];
      const recommendation = (analyticsService as any).generateHabitRecommendation(
        habit,
        'stable',
        0,
        40 // Low consistency
      );

      expect(recommendation).toContain('Focus on consistency');
      expect(recommendation).toContain('habit stacking');
    });

    test('should recommend review for declining habits', () => {
      const habit = mockHabits[0];
      const recommendation = (analyticsService as any).generateHabitRecommendation(
        habit,
        'declining',
        15, // Significant decline
        70
      );

      expect(recommendation).toContain('declining');
      expect(recommendation).toContain('reviewing your approach');
    });

    test('should encourage continued progress for improving habits', () => {
      const habit = mockHabits[0];
      const recommendation = (analyticsService as any).generateHabitRecommendation(
        habit,
        'improving',
        20, // Good improvement
        80
      );

      expect(recommendation).toContain('Great progress');
      expect(recommendation).toContain('increasing the target');
    });

    test('should suggest optimization for stable high-consistency habits', () => {
      const habit = mockHabits[0];
      const recommendation = (analyticsService as any).generateHabitRecommendation(
        habit,
        'stable',
        0,
        85 // High consistency
      );

      expect(recommendation).toContain('optimizing quality');
    });
  });
});