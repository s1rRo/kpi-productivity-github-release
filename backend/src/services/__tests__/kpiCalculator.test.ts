import { describe, test, expect, beforeEach } from 'vitest';
import { KPICalculator } from '../kpiCalculator.js';
import { 
  HabitRecord, 
  Task, 
  Habit, 
  RevolutPillars, 
  TaskPriority,
  EisenhowerQuadrant 
} from '../../types/index.js';

describe('KPICalculator', () => {
  let calculator: KPICalculator;
  let mockHabits: Habit[];
  let mockHabitRecords: HabitRecord[];
  let mockTasks: Task[];
  let mockRevolutPillars: RevolutPillars;

  beforeEach(() => {
    calculator = new KPICalculator();
    
    // Mock habits based on default habits from design
    mockHabits = [
      {
        id: '1',
        name: 'Работа',
        targetMinutes: 360,
        category: 'career',
        skillLevel: 4,
        eisenhowerQuadrant: 'Q1',
        isWeekdayOnly: true,
        createdAt: new Date()
      },
      {
        id: '2',
        name: 'Английский',
        targetMinutes: 60,
        category: 'skills',
        skillLevel: 2,
        eisenhowerQuadrant: 'Q2',
        isWeekdayOnly: false,
        createdAt: new Date()
      },
      {
        id: '3',
        name: 'Спорт',
        targetMinutes: 60,
        category: 'health',
        skillLevel: 3,
        eisenhowerQuadrant: 'Q2',
        isWeekdayOnly: false,
        createdAt: new Date()
      }
    ];

    // Mock habit records
    mockHabitRecords = [
      {
        id: '1',
        dailyRecordId: 'daily1',
        habitId: '1',
        actualMinutes: 300, // 83.3% of 360 target
        qualityScore: 4,
        createdAt: new Date()
      },
      {
        id: '2',
        dailyRecordId: 'daily1',
        habitId: '2',
        actualMinutes: 70, // 116.7% of 60 target
        qualityScore: 5,
        createdAt: new Date()
      },
      {
        id: '3',
        dailyRecordId: 'daily1',
        habitId: '3',
        actualMinutes: 45, // 75% of 60 target
        qualityScore: 3,
        createdAt: new Date()
      }
    ];

    // Mock tasks
    mockTasks = [
      {
        id: '1',
        dailyRecordId: 'daily1',
        title: 'Complete project milestone',
        priority: 'high',
        completed: true,
        estimatedMinutes: 120,
        actualMinutes: 100, // Faster than planned
        createdAt: new Date()
      },
      {
        id: '2',
        dailyRecordId: 'daily1',
        title: 'Review documentation',
        priority: 'medium',
        completed: true,
        estimatedMinutes: 60,
        actualMinutes: 65, // Slightly slower
        createdAt: new Date()
      }
    ];

    // Mock Revolut pillars
    mockRevolutPillars = {
      deliverables: 85,
      skills: 70,
      culture: 90
    };
  });

  describe('calculateDailyKPI', () => {
    test('should calculate complete KPI with all components', () => {
      const result = calculator.calculateDailyKPI(
        mockHabitRecords,
        mockTasks,
        mockHabits,
        mockRevolutPillars
      );

      expect(result).toHaveProperty('baseScore');
      expect(result).toHaveProperty('efficiencyCoefficients');
      expect(result).toHaveProperty('priorityBonus');
      expect(result).toHaveProperty('revolutScore');
      expect(result).toHaveProperty('totalKPI');

      // Base score should be average of habit percentages
      // (83.3 + 116.7 + 75) / 3 = 91.67
      expect(result.baseScore).toBeCloseTo(91.67, 1);

      // Priority bonus: high (20) + medium (10) = 30
      expect(result.priorityBonus).toBeGreaterThanOrEqual(30);

      // Revolut score: 0.4*85 + 0.3*70 + 0.3*90 = 82
      expect(result.revolutScore).toBeCloseTo(82, 1);

      // Total KPI should be sum of all components, capped at 150
      expect(result.totalKPI).toBeGreaterThan(0);
      expect(result.totalKPI).toBeLessThanOrEqual(150);
    });

    test('should cap total KPI at 150', () => {
      // Create scenario with very high values
      const highHabitRecords: HabitRecord[] = [
        {
          id: '1',
          dailyRecordId: 'daily1',
          habitId: '1',
          actualMinutes: 540, // 150% of target
          qualityScore: 5,
          createdAt: new Date()
        }
      ];

      const highRevolutPillars: RevolutPillars = {
        deliverables: 100,
        skills: 100,
        culture: 100
      };

      const result = calculator.calculateDailyKPI(
        highHabitRecords,
        mockTasks,
        mockHabits,
        highRevolutPillars
      );

      expect(result.totalKPI).toBeLessThanOrEqual(150);
    });

    test('should handle empty inputs gracefully', () => {
      const result = calculator.calculateDailyKPI(
        [],
        [],
        [],
        { deliverables: 0, skills: 0, culture: 0 }
      );

      expect(result.baseScore).toBe(0);
      expect(result.priorityBonus).toBe(0);
      expect(result.revolutScore).toBe(0);
      expect(result.totalKPI).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Efficiency Laws', () => {
    test('should apply Pareto Law correctly', () => {
      // Test with high priority focus
      const highPriorityTasks: Task[] = [
        { ...mockTasks[0], priority: 'high' },
        { ...mockTasks[1], priority: 'high' }
      ];

      const result = calculator.calculateDailyKPI(
        mockHabitRecords,
        highPriorityTasks,
        mockHabits,
        mockRevolutPillars
      );

      expect(result.efficiencyCoefficients.paretoLaw).toBeGreaterThanOrEqual(0);
    });

    test('should apply Parkinson Law correctly', () => {
      // Task completed faster than planned should get bonus
      const fasterTask: Task = {
        ...mockTasks[0],
        estimatedMinutes: 120,
        actualMinutes: 100 // 83% of planned time
      };

      const result = calculator.calculateDailyKPI(
        mockHabitRecords,
        [fasterTask],
        mockHabits,
        mockRevolutPillars
      );

      expect(result.efficiencyCoefficients.parkinsonLaw).toBeGreaterThan(0);
    });

    test('should apply Diminishing Returns Law correctly', () => {
      // Work habit with more than 240 minutes should get penalty
      const longWorkRecord: HabitRecord = {
        ...mockHabitRecords[0],
        actualMinutes: 300 // 5 hours of work
      };

      const result = calculator.calculateDailyKPI(
        [longWorkRecord, ...mockHabitRecords.slice(1)],
        mockTasks,
        mockHabits,
        mockRevolutPillars
      );

      expect(result.efficiencyCoefficients.diminishingReturns).toBeLessThanOrEqual(0);
    });

    test('should apply Yerkes-Dodson Law correctly', () => {
      // Tasks completed on time should get bonus
      const timelyTasks: Task[] = mockTasks.map(task => ({
        ...task,
        actualMinutes: task.estimatedMinutes // Exactly on time
      }));

      const result = calculator.calculateDailyKPI(
        mockHabitRecords,
        timelyTasks,
        mockHabits,
        mockRevolutPillars
      );

      expect(result.efficiencyCoefficients.yerkesDodssonLaw).toBeGreaterThanOrEqual(0);
    });

    test('should apply Pomodoro Technique correctly', () => {
      // Habit record with 25-50 minute session should get bonus
      const pomodoroRecord: HabitRecord = {
        ...mockHabitRecords[0],
        actualMinutes: 25 // Perfect pomodoro session
      };

      const result = calculator.calculateDailyKPI(
        [pomodoroRecord, ...mockHabitRecords.slice(1)],
        mockTasks,
        mockHabits,
        mockRevolutPillars
      );

      expect(result.efficiencyCoefficients.pomodoroTechnique).toBeGreaterThanOrEqual(0);
    });

    test('should apply Deep Work principle correctly', () => {
      // Work session of 90+ minutes should get deep work bonus
      const deepWorkRecord: HabitRecord = {
        ...mockHabitRecords[0],
        actualMinutes: 120 // 2 hours of focused work
      };

      const result = calculator.calculateDailyKPI(
        [deepWorkRecord, ...mockHabitRecords.slice(1)],
        mockTasks,
        mockHabits,
        mockRevolutPillars
      );

      expect(result.efficiencyCoefficients.deepWork).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Priority Bonus Calculation', () => {
    test('should calculate correct priority bonus for completed tasks', () => {
      const result = calculator.calculateDailyKPI(
        mockHabitRecords,
        mockTasks,
        mockHabits,
        mockRevolutPillars
      );

      // High priority (20) + Medium priority (10) = 30 base
      // Plus potential Q2 and strategic bonuses
      expect(result.priorityBonus).toBeGreaterThanOrEqual(30);
    });

    test('should not give bonus for incomplete tasks', () => {
      const incompleteTasks: Task[] = mockTasks.map(task => ({
        ...task,
        completed: false
      }));

      const result = calculator.calculateDailyKPI(
        mockHabitRecords,
        incompleteTasks,
        mockHabits,
        mockRevolutPillars
      );

      // Should only have Q2 focus bonus, no priority bonus for incomplete tasks
      expect(result.priorityBonus).toBeLessThan(30);
    });
  });

  describe('Revolut Score Calculation', () => {
    test('should calculate Revolut score with correct weights', () => {
      const result = calculator.calculateDailyKPI(
        mockHabitRecords,
        mockTasks,
        mockHabits,
        mockRevolutPillars
      );

      // 0.4 * 85 + 0.3 * 70 + 0.3 * 90 = 34 + 21 + 27 = 82
      expect(result.revolutScore).toBeCloseTo(82, 1);
    });

    test('should handle edge case Revolut values', () => {
      const edgeCasePillars: RevolutPillars = {
        deliverables: 0,
        skills: 100,
        culture: 50
      };

      const result = calculator.calculateDailyKPI(
        mockHabitRecords,
        mockTasks,
        mockHabits,
        edgeCasePillars
      );

      // 0.4 * 0 + 0.3 * 100 + 0.3 * 50 = 0 + 30 + 15 = 45
      expect(result.revolutScore).toBeCloseTo(45, 1);
    });
  });

  describe('Input Validation', () => {
    test('should validate habit records input', () => {
      const validation = calculator.validateInputs(
        mockHabitRecords,
        mockTasks,
        mockHabits,
        mockRevolutPillars
      );

      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    test('should reject more than 5 tasks', () => {
      const tooManyTasks: Task[] = Array(6).fill(null).map((_, i) => ({
        id: `task-${i}`,
        dailyRecordId: 'daily1',
        title: `Task ${i}`,
        priority: 'medium' as TaskPriority,
        completed: true,
        estimatedMinutes: 30,
        actualMinutes: 30,
        createdAt: new Date()
      }));

      const validation = calculator.validateInputs(
        mockHabitRecords,
        tooManyTasks,
        mockHabits,
        mockRevolutPillars
      );

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Maximum 5 tasks allowed per day');
    });

    test('should validate Revolut pillars range', () => {
      const invalidPillars: RevolutPillars = {
        deliverables: 150, // Invalid: > 100
        skills: -10, // Invalid: < 0
        culture: 50
      };

      const validation = calculator.validateInputs(
        mockHabitRecords,
        mockTasks,
        mockHabits,
        invalidPillars
      );

      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });
  });

  describe('Base Score Calculation', () => {
    test('should calculate base score as average of habit percentages', () => {
      const result = calculator.calculateDailyKPI(
        mockHabitRecords,
        mockTasks,
        mockHabits,
        mockRevolutPillars
      );

      // Expected: (300/360*100 + 70/60*100 + 45/60*100) / 3
      // = (83.33 + 116.67 + 75) / 3 = 91.67
      expect(result.baseScore).toBeCloseTo(91.67, 1);
    });

    test('should cap individual habit scores at 150%', () => {
      const overachievingRecord: HabitRecord = {
        id: '1',
        dailyRecordId: 'daily1',
        habitId: '2', // English habit, 60 min target
        actualMinutes: 200, // 333% of target, should be capped at 150%
        qualityScore: 5,
        createdAt: new Date()
      };

      const result = calculator.calculateDailyKPI(
        [overachievingRecord],
        mockTasks,
        mockHabits,
        mockRevolutPillars
      );

      // Base score should be capped at 150
      expect(result.baseScore).toBeLessThanOrEqual(150);
    });

    test('should handle weekday-only habits correctly', () => {
      // Test work habit on weekend (should use 180 min target instead of 360)
      const weekendWorkRecord: HabitRecord = {
        id: '1',
        dailyRecordId: 'daily1',
        habitId: '1', // Work habit
        actualMinutes: 180, // Should be 100% on weekend
        qualityScore: 4,
        createdAt: new Date()
      };

      // Note: This test would need date context to properly test weekend adjustment
      // For now, we test that the calculation doesn't break
      const result = calculator.calculateDailyKPI(
        [weekendWorkRecord],
        mockTasks,
        mockHabits,
        mockRevolutPillars
      );

      expect(result.baseScore).toBeGreaterThan(0);
    });
  });

  describe('Streak Data Integration', () => {
    test('should integrate streak data for compound calculations', () => {
      const streakData = new Map([
        ['1', 15], // 15-day streak for work
        ['2', 30], // 30-day streak for English
        ['3', 7]   // 7-day streak for sport
      ]);

      const result = calculator.calculateDailyKPI(
        mockHabitRecords,
        mockTasks,
        mockHabits,
        mockRevolutPillars,
        streakData
      );

      // Should include productivity books coefficient with streak bonuses
      expect(result.efficiencyCoefficients.productivityBooks).toBeGreaterThan(0);
    });

    test('should handle missing streak data gracefully', () => {
      const result = calculator.calculateDailyKPI(
        mockHabitRecords,
        mockTasks,
        mockHabits,
        mockRevolutPillars
        // No streak data provided
      );

      expect(result.totalKPI).toBeGreaterThan(0);
      expect(result.efficiencyCoefficients.productivityBooks).toBeGreaterThanOrEqual(0);
    });
  });
});