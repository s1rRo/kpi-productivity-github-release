import { productivityBooksService } from '../productivityBooks.js';
import { HabitRecord, Task, Habit } from '../../types/index.js';

describe('ProductivityBooksService', () => {
  const mockHabits: Habit[] = [
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

  const mockHabitRecords: HabitRecord[] = [
    {
      id: '1',
      dailyRecordId: 'daily1',
      habitId: '1',
      actualMinutes: 300,
      qualityScore: 4,
      createdAt: new Date()
    },
    {
      id: '2',
      dailyRecordId: 'daily1',
      habitId: '2',
      actualMinutes: 70,
      qualityScore: 5,
      createdAt: new Date()
    },
    {
      id: '3',
      dailyRecordId: 'daily1',
      habitId: '3',
      actualMinutes: 45,
      qualityScore: 3,
      createdAt: new Date()
    }
  ];

  const mockTasks: Task[] = [
    {
      id: '1',
      dailyRecordId: 'daily1',
      title: 'Complete project milestone',
      priority: 'high',
      completed: true,
      estimatedMinutes: 120,
      actualMinutes: 100,
      createdAt: new Date()
    },
    {
      id: '2',
      dailyRecordId: 'daily1',
      title: 'Review documentation',
      priority: 'medium',
      completed: true,
      estimatedMinutes: 60,
      actualMinutes: 65,
      createdAt: new Date()
    }
  ];

  test('should calculate Atomic Habits bonus correctly', () => {
    const streakData = new Map([
      ['1', 10], // 10-day streak
      ['2', 25], // 25-day streak (habit formation)
      ['3', 5]   // 5-day streak
    ]);

    const bonus = productivityBooksService.calculateAtomicHabitsBonus(
      mockHabitRecords,
      mockHabits,
      streakData
    );

    expect(bonus).toBeGreaterThan(0);
    expect(bonus).toBeLessThanOrEqual(25); // Capped at 25
  });

  test('should calculate Seven Habits bonus correctly', () => {
    const bonus = productivityBooksService.calculateSevenHabitsBonus(
      mockHabitRecords,
      mockTasks,
      mockHabits
    );

    expect(bonus).toBeGreaterThan(0);
    expect(bonus).toBeLessThanOrEqual(30); // Capped at 30
  });

  test('should calculate Deep Work bonus correctly', () => {
    const bonus = productivityBooksService.calculateDeepWorkBonus(
      mockHabitRecords,
      mockTasks,
      mockHabits
    );

    expect(bonus).toBeGreaterThanOrEqual(0);
    expect(bonus).toBeLessThanOrEqual(25); // Capped at 25
  });

  test('should calculate ONE Thing bonus correctly', () => {
    const bonus = productivityBooksService.calculateOneThingBonus(
      mockHabitRecords,
      mockTasks,
      mockHabits
    );

    expect(bonus).toBeGreaterThan(0);
    expect(bonus).toBeLessThanOrEqual(30); // Capped at 30
  });

  test('should calculate total productivity books coefficient', () => {
    const streakData = new Map([
      ['1', 15],
      ['2', 30],
      ['3', 8]
    ]);

    const totalBonus = productivityBooksService.calculateProductivityBooksCoefficient(
      mockHabitRecords,
      mockTasks,
      mockHabits,
      streakData
    );

    expect(totalBonus).toBeGreaterThan(0);
    expect(totalBonus).toBeLessThanOrEqual(50); // Capped at 50
  });

  test('should provide detailed productivity breakdown', () => {
    const streakData = new Map([
      ['1', 20],
      ['2', 35],
      ['3', 12]
    ]);

    const breakdown = productivityBooksService.getProductivityBreakdown(
      mockHabitRecords,
      mockTasks,
      mockHabits,
      streakData
    );

    expect(breakdown).toHaveProperty('atomicHabits');
    expect(breakdown).toHaveProperty('sevenHabits');
    expect(breakdown).toHaveProperty('deepWork');
    expect(breakdown).toHaveProperty('oneThingPrinciple');
    expect(breakdown).toHaveProperty('gettingThingsDone');
    expect(breakdown).toHaveProperty('eatThatFrog');
    expect(breakdown).toHaveProperty('powerOfHabit');
    expect(breakdown).toHaveProperty('mindset');
    expect(breakdown).toHaveProperty('fourHourWorkweek');
    expect(breakdown).toHaveProperty('essentialism');
    expect(breakdown).toHaveProperty('total');

    expect(breakdown.total).toBeLessThanOrEqual(50);
  });

  test('should handle empty inputs gracefully', () => {
    const bonus = productivityBooksService.calculateProductivityBooksCoefficient(
      [],
      [],
      [],
      new Map()
    );

    expect(bonus).toBeGreaterThanOrEqual(0);
  });
});