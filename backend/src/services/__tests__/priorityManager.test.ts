import { describe, test, expect, beforeEach } from 'vitest';
import { PriorityManager } from '../priorityManager.js';
import { Task, Habit, TaskPriority, EisenhowerQuadrant } from '../../types/index.js';

describe('PriorityManager', () => {
  let priorityManager: PriorityManager;
  let mockTasks: Task[];
  let mockHabits: Habit[];

  beforeEach(() => {
    priorityManager = new PriorityManager();
    
    mockTasks = [
      {
        id: '1',
        dailyRecordId: 'daily1',
        title: 'Complete urgent project',
        priority: 'high',
        completed: true,
        estimatedMinutes: 120,
        actualMinutes: 100,
        createdAt: new Date()
      },
      {
        id: '2',
        dailyRecordId: 'daily1',
        title: 'Learn new skill',
        priority: 'medium',
        completed: true,
        estimatedMinutes: 60,
        actualMinutes: 65,
        createdAt: new Date()
      },
      {
        id: '3',
        dailyRecordId: 'daily1',
        title: 'Organize files',
        priority: 'low',
        completed: true,
        estimatedMinutes: 30,
        actualMinutes: 25,
        createdAt: new Date()
      },
      {
        id: '4',
        dailyRecordId: 'daily1',
        title: 'Strategic planning',
        priority: 'medium',
        completed: false, // Not completed
        estimatedMinutes: 90,
        actualMinutes: 0,
        createdAt: new Date()
      }
    ];

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
      }
    ];
  });

  describe('calculatePriorityBonus', () => {
    test('should calculate correct priority bonus for completed tasks', () => {
      const bonus = priorityManager.calculatePriorityBonus(mockTasks);
      
      // High (20) + Medium (10) + Low (0) = 30
      // Strategic planning is not completed, so no bonus
      expect(bonus).toBe(30);
    });

    test('should not give bonus for incomplete tasks', () => {
      const incompleteTasks: Task[] = mockTasks.map(task => ({
        ...task,
        completed: false
      }));

      const bonus = priorityManager.calculatePriorityBonus(incompleteTasks);
      expect(bonus).toBe(0);
    });

    test('should handle empty task list', () => {
      const bonus = priorityManager.calculatePriorityBonus([]);
      expect(bonus).toBe(0);
    });

    test('should handle mixed completion status', () => {
      const mixedTasks: Task[] = [
        { ...mockTasks[0], completed: true, priority: 'high' },  // +20
        { ...mockTasks[1], completed: false, priority: 'medium' }, // +0
        { ...mockTasks[2], completed: true, priority: 'low' }    // +0
      ];

      const bonus = priorityManager.calculatePriorityBonus(mixedTasks);
      expect(bonus).toBe(20);
    });
  });

  describe('classifyByEisenhowerMatrix', () => {
    test('should classify tasks by priority into quadrants', () => {
      const classification = priorityManager.classifyByEisenhowerMatrix(mockTasks, mockHabits);

      expect(classification).toHaveProperty('Q1');
      expect(classification).toHaveProperty('Q2');
      expect(classification).toHaveProperty('Q3');
      expect(classification).toHaveProperty('Q4');

      // High priority tasks should go to Q1
      expect(classification.Q1).toHaveLength(1);
      expect(classification.Q1[0].priority).toBe('high');

      // Medium priority tasks should go to Q2
      expect(classification.Q2).toHaveLength(2);
      expect(classification.Q2.every(task => task.priority === 'medium')).toBe(true);

      // Low priority tasks should go to Q4
      expect(classification.Q4).toHaveLength(1);
      expect(classification.Q4[0].priority).toBe('low');
    });

    test('should handle empty task list', () => {
      const classification = priorityManager.classifyByEisenhowerMatrix([], mockHabits);

      expect(classification.Q1).toHaveLength(0);
      expect(classification.Q2).toHaveLength(0);
      expect(classification.Q3).toHaveLength(0);
      expect(classification.Q4).toHaveLength(0);
    });
  });

  describe('calculateQ2FocusBonus', () => {
    test('should give bonus for high Q2 focus', () => {
      // Create tasks with mostly medium priority (Q2)
      const q2FocusedTasks: Task[] = [
        { ...mockTasks[0], priority: 'medium' },
        { ...mockTasks[1], priority: 'medium' },
        { ...mockTasks[2], priority: 'medium' },
        { ...mockTasks[3], priority: 'medium', completed: true }
      ];

      const bonus = priorityManager.calculateQ2FocusBonus(q2FocusedTasks, mockHabits);
      expect(bonus).toBeGreaterThan(0);
    });

    test('should give higher bonus for completing Q2 tasks', () => {
      const q2Tasks: Task[] = [
        { ...mockTasks[0], priority: 'medium', completed: true },
        { ...mockTasks[1], priority: 'medium', completed: true }
      ];

      const bonus = priorityManager.calculateQ2FocusBonus(q2Tasks, mockHabits);
      expect(bonus).toBeGreaterThan(10); // Should get both focus and completion bonuses
    });

    test('should handle no Q2 tasks', () => {
      const noQ2Tasks: Task[] = [
        { ...mockTasks[0], priority: 'high' },
        { ...mockTasks[1], priority: 'low' }
      ];

      const bonus = priorityManager.calculateQ2FocusBonus(noQ2Tasks, mockHabits);
      expect(bonus).toBe(0);
    });

    test('should handle empty task list', () => {
      const bonus = priorityManager.calculateQ2FocusBonus([], mockHabits);
      expect(bonus).toBe(0);
    });
  });

  describe('analyzeTimeDistribution', () => {
    test('should analyze time distribution across quadrants', () => {
      const distribution = priorityManager.analyzeTimeDistribution(mockTasks, mockHabits);

      expect(distribution).toHaveProperty('Q1');
      expect(distribution).toHaveProperty('Q2');
      expect(distribution).toHaveProperty('Q3');
      expect(distribution).toHaveProperty('Q4');
      expect(distribution).toHaveProperty('totalMinutes');

      // Check that percentages add up to 100 (or close to it)
      const totalPercentage = distribution.Q1.percentage + distribution.Q2.percentage + 
                             distribution.Q3.percentage + distribution.Q4.percentage;
      expect(totalPercentage).toBeCloseTo(100, 1);

      // Check that task counts are correct
      expect(distribution.Q1.tasks).toBe(1); // High priority
      expect(distribution.Q2.tasks).toBe(2); // Medium priority
      expect(distribution.Q4.tasks).toBe(1); // Low priority
    });

    test('should handle tasks without time estimates', () => {
      const tasksWithoutTime: Task[] = mockTasks.map(task => ({
        ...task,
        estimatedMinutes: undefined,
        actualMinutes: undefined
      }));

      const distribution = priorityManager.analyzeTimeDistribution(tasksWithoutTime, mockHabits);
      expect(distribution.totalMinutes).toBe(0);
      expect(distribution.Q1.percentage).toBe(0);
    });

    test('should prioritize actual minutes over estimated', () => {
      const tasksWithBothTimes: Task[] = [
        {
          ...mockTasks[0],
          estimatedMinutes: 120,
          actualMinutes: 100 // Should use actual
        }
      ];

      const distribution = priorityManager.analyzeTimeDistribution(tasksWithBothTimes, mockHabits);
      expect(distribution.Q1.minutes).toBe(100); // Should use actual, not estimated
    });
  });

  describe('generateRecommendations', () => {
    test('should recommend increasing Q2 focus when low', () => {
      // Create tasks with low Q2 focus
      const lowQ2Tasks: Task[] = [
        { ...mockTasks[0], priority: 'high', actualMinutes: 200 },  // Q1
        { ...mockTasks[1], priority: 'low', actualMinutes: 100 }    // Q4
      ];

      const recommendations = priorityManager.generateRecommendations(lowQ2Tasks, mockHabits);
      
      expect(recommendations.currentQ2Focus).toBeLessThan(40);
      expect(recommendations.recommendations).toContain(
        expect.stringMatching(/Increase focus on Q2 activities/)
      );
      expect(recommendations.actionItems.length).toBeGreaterThan(0);
    });

    test('should recommend reducing Q1 activities when high', () => {
      const highQ1Tasks: Task[] = [
        { ...mockTasks[0], priority: 'high', actualMinutes: 300 },
        { ...mockTasks[1], priority: 'high', actualMinutes: 200 },
        { ...mockTasks[2], priority: 'medium', actualMinutes: 50 }
      ];

      const recommendations = priorityManager.generateRecommendations(highQ1Tasks, mockHabits);
      
      expect(recommendations.recommendations).toContain(
        expect.stringMatching(/Reduce Q1 activities/)
      );
    });

    test('should give positive feedback for good Q2 focus', () => {
      const goodQ2Tasks: Task[] = [
        { ...mockTasks[0], priority: 'medium', actualMinutes: 150 },
        { ...mockTasks[1], priority: 'medium', actualMinutes: 120 },
        { ...mockTasks[2], priority: 'high', actualMinutes: 80 }
      ];

      const recommendations = priorityManager.generateRecommendations(goodQ2Tasks, mockHabits);
      
      expect(recommendations.currentQ2Focus).toBeGreaterThan(50);
      expect(recommendations.recommendations).toContain(
        expect.stringMatching(/Excellent Q2 focus/)
      );
    });

    test('should set appropriate target Q2 focus', () => {
      const recommendations = priorityManager.generateRecommendations(mockTasks, mockHabits);
      expect(recommendations.targetQ2Focus).toBe(60);
    });
  });

  describe('validateTaskLimits', () => {
    test('should validate task limit of 5', () => {
      const validTasks = mockTasks.slice(0, 4); // 4 tasks
      const validation = priorityManager.validateTaskLimits(validTasks);
      
      expect(validation.isValid).toBe(true);
      expect(validation.message).toBeUndefined();
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

      const validation = priorityManager.validateTaskLimits(tooManyTasks);
      
      expect(validation.isValid).toBe(false);
      expect(validation.message).toContain('Maximum 5 tasks allowed');
    });

    test('should handle empty task list', () => {
      const validation = priorityManager.validateTaskLimits([]);
      expect(validation.isValid).toBe(true);
    });

    test('should handle exactly 5 tasks', () => {
      const exactlyFiveTasks: Task[] = Array(5).fill(null).map((_, i) => ({
        id: `task-${i}`,
        dailyRecordId: 'daily1',
        title: `Task ${i}`,
        priority: 'medium' as TaskPriority,
        completed: true,
        estimatedMinutes: 30,
        actualMinutes: 30,
        createdAt: new Date()
      }));

      const validation = priorityManager.validateTaskLimits(exactlyFiveTasks);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('sortTasksByPriority', () => {
    test('should sort tasks by Eisenhower Matrix priority', () => {
      const unsortedTasks: Task[] = [
        { ...mockTasks[2], priority: 'low' },     // Q4 - should be last
        { ...mockTasks[0], priority: 'high' },    // Q1 - should be first
        { ...mockTasks[1], priority: 'medium' }   // Q2 - should be second
      ];

      const sortedTasks = priorityManager.sortTasksByPriority(unsortedTasks, mockHabits);
      
      expect(sortedTasks[0].priority).toBe('high');   // Q1 first
      expect(sortedTasks[1].priority).toBe('medium'); // Q2 second
      expect(sortedTasks[2].priority).toBe('low');    // Q4 last
    });

    test('should handle empty task list', () => {
      const sortedTasks = priorityManager.sortTasksByPriority([], mockHabits);
      expect(sortedTasks).toHaveLength(0);
    });

    test('should maintain relative order within same priority', () => {
      const samePriorityTasks: Task[] = [
        { ...mockTasks[0], id: '1', priority: 'high', title: 'Task A' },
        { ...mockTasks[1], id: '2', priority: 'high', title: 'Task B' },
        { ...mockTasks[2], id: '3', priority: 'high', title: 'Task C' }
      ];

      const sortedTasks = priorityManager.sortTasksByPriority(samePriorityTasks, mockHabits);
      
      // All should be high priority and maintain some consistent order
      expect(sortedTasks.every(task => task.priority === 'high')).toBe(true);
      expect(sortedTasks).toHaveLength(3);
    });
  });

  describe('calculateStrategicBonus', () => {
    test('should give bonus for strategic high-priority tasks', () => {
      const strategicTasks: Task[] = [
        {
          ...mockTasks[0],
          title: 'English learning session',
          priority: 'high',
          completed: true
        },
        {
          ...mockTasks[1],
          title: 'Business plan development',
          priority: 'high',
          completed: true
        }
      ];

      const bonus = priorityManager.calculateStrategicBonus(strategicTasks);
      expect(bonus).toBe(20); // 10 per strategic high-priority task
    });

    test('should not give bonus for non-strategic tasks', () => {
      const nonStrategicTasks: Task[] = [
        {
          ...mockTasks[0],
          title: 'Clean desk',
          priority: 'high',
          completed: true
        }
      ];

      const bonus = priorityManager.calculateStrategicBonus(nonStrategicTasks);
      expect(bonus).toBe(0);
    });

    test('should not give bonus for incomplete strategic tasks', () => {
      const incompleteStrategicTasks: Task[] = [
        {
          ...mockTasks[0],
          title: 'English learning session',
          priority: 'high',
          completed: false // Not completed
        }
      ];

      const bonus = priorityManager.calculateStrategicBonus(incompleteStrategicTasks);
      expect(bonus).toBe(0);
    });

    test('should not give bonus for strategic medium/low priority tasks', () => {
      const lowPriorityStrategicTasks: Task[] = [
        {
          ...mockTasks[0],
          title: 'English vocabulary review',
          priority: 'medium', // Not high priority
          completed: true
        }
      ];

      const bonus = priorityManager.calculateStrategicBonus(lowPriorityStrategicTasks);
      expect(bonus).toBe(0);
    });

    test('should handle empty task list', () => {
      const bonus = priorityManager.calculateStrategicBonus([]);
      expect(bonus).toBe(0);
    });

    test('should be case insensitive for strategic keywords', () => {
      const caseInsensitiveTasks: Task[] = [
        {
          ...mockTasks[0],
          title: 'ENGLISH Learning Session',
          priority: 'high',
          completed: true
        },
        {
          ...mockTasks[1],
          title: 'business PLAN development',
          priority: 'high',
          completed: true
        }
      ];

      const bonus = priorityManager.calculateStrategicBonus(caseInsensitiveTasks);
      expect(bonus).toBe(20);
    });
  });
});