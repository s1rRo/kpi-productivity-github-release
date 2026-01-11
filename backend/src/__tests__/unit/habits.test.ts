import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { validationSchemas } from '../../utils/validation';
import { DEFAULT_HABITS } from '../../types';

describe('Habits CRUD Operations', () => {
  describe('Validation', () => {
    test('should validate habit creation data', () => {
      const validHabitData = {
        name: 'Test Habit',
        targetMinutes: 60,
        category: 'health',
        skillLevel: 3,
        eisenhowerQuadrant: 'Q2',
        isWeekdayOnly: false
      };

      const result = validationSchemas.habit.create.safeParse(validHabitData);
      expect(result.success).toBe(true);
    });

    test('should reject invalid habit data', () => {
      const invalidHabitData = {
        name: '', // Empty name should fail
        targetMinutes: -10, // Negative minutes should fail
        skillLevel: 6 // Skill level > 5 should fail
      };

      const result = validationSchemas.habit.create.safeParse(invalidHabitData);
      expect(result.success).toBe(false);
    });

    test('should validate habit update data', () => {
      const validUpdateData = {
        name: 'Updated Habit',
        targetMinutes: 90,
        skillLevel: 4
      };

      const result = validationSchemas.habit.update.safeParse(validUpdateData);
      expect(result.success).toBe(true);
    });

    test('should validate default habits structure', () => {
      DEFAULT_HABITS.forEach(habit => {
        const result = validationSchemas.habit.create.safeParse(habit);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Business Logic', () => {
    test('should format minutes to hours correctly', () => {
      const formatMinutesToHours = (minutes: number): string => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours === 0) return `${mins} мин`;
        if (mins === 0) return `${hours} ч`;
        return `${hours} ч ${mins} мин`;
      };

      expect(formatMinutesToHours(30)).toBe('30 мин');
      expect(formatMinutesToHours(60)).toBe('1 ч');
      expect(formatMinutesToHours(90)).toBe('1 ч 30 мин');
      expect(formatMinutesToHours(480)).toBe('8 ч');
    });

    test('should categorize habits correctly', () => {
      const getCategoryLabel = (category?: string): string => {
        const categories: Record<string, string> = {
          health: 'Здоровье',
          skills: 'Навыки',
          learning: 'Обучение',
          career: 'Карьера',
          recovery: 'Восстановление',
          content: 'Контент'
        };
        return categories[category || ''] || category || 'Без категории';
      };

      expect(getCategoryLabel('health')).toBe('Здоровье');
      expect(getCategoryLabel('skills')).toBe('Навыки');
      expect(getCategoryLabel('unknown')).toBe('unknown');
      expect(getCategoryLabel()).toBe('Без категории');
    });

    test('should assign correct quadrant colors', () => {
      const getQuadrantColor = (quadrant?: string): string => {
        switch (quadrant) {
          case 'Q1': return 'bg-red-100 text-red-800';
          case 'Q2': return 'bg-green-100 text-green-800';
          case 'Q3': return 'bg-yellow-100 text-yellow-800';
          case 'Q4': return 'bg-gray-100 text-gray-800';
          default: return 'bg-gray-100 text-gray-800';
        }
      };

      expect(getQuadrantColor('Q1')).toBe('bg-red-100 text-red-800');
      expect(getQuadrantColor('Q2')).toBe('bg-green-100 text-green-800');
      expect(getQuadrantColor('Q3')).toBe('bg-yellow-100 text-yellow-800');
      expect(getQuadrantColor('Q4')).toBe('bg-gray-100 text-gray-800');
      expect(getQuadrantColor()).toBe('bg-gray-100 text-gray-800');
    });
  });

  describe('Default Habits Configuration', () => {
    test('should have correct number of default habits', () => {
      expect(DEFAULT_HABITS).toHaveLength(10);
    });

    test('should have sleep habit with correct configuration', () => {
      const sleepHabit = DEFAULT_HABITS.find(h => h.name === 'Сон');
      expect(sleepHabit).toBeDefined();
      expect(sleepHabit?.targetMinutes).toBe(480); // 8 hours
      expect(sleepHabit?.category).toBe('health');
      expect(sleepHabit?.skillLevel).toBe(3);
      expect(sleepHabit?.eisenhowerQuadrant).toBe('Q2');
    });

    test('should have work habit with weekday-only configuration', () => {
      const workHabit = DEFAULT_HABITS.find(h => h.name === 'Работа');
      expect(workHabit).toBeDefined();
      expect(workHabit?.targetMinutes).toBe(360); // 6 hours
      expect(workHabit?.category).toBe('career');
      expect(workHabit?.isWeekdayOnly).toBe(true);
      expect(workHabit?.eisenhowerQuadrant).toBe('Q1');
    });

    test('should have English habit with beginner skill level', () => {
      const englishHabit = DEFAULT_HABITS.find(h => h.name === 'Английский');
      expect(englishHabit).toBeDefined();
      expect(englishHabit?.skillLevel).toBe(2); // Beginner level
      expect(englishHabit?.category).toBe('skills');
      expect(englishHabit?.eisenhowerQuadrant).toBe('Q2');
    });

    test('should have AI habit with novice skill level', () => {
      const aiHabit = DEFAULT_HABITS.find(h => h.name === 'ИИ');
      expect(aiHabit).toBeDefined();
      expect(aiHabit?.skillLevel).toBe(1); // Novice level
      expect(aiHabit?.category).toBe('skills');
      expect(aiHabit?.eisenhowerQuadrant).toBe('Q2');
    });
  });

  describe('History Tracking', () => {
    test('should create proper change objects', () => {
      const createChange = (field: string, oldValue: any, newValue: any) => ({
        field,
        oldValue,
        newValue
      });

      const change = createChange('name', 'Old Name', 'New Name');
      expect(change).toEqual({
        field: 'name',
        oldValue: 'Old Name',
        newValue: 'New Name'
      });
    });

    test('should format change values correctly', () => {
      const formatValue = (field: string, value: any): string => {
        if (value === null || value === undefined) return 'не задано';
        
        switch (field) {
          case 'targetMinutes':
            const hours = Math.floor(value / 60);
            const minutes = value % 60;
            if (hours === 0) return `${minutes} мин`;
            if (minutes === 0) return `${hours} ч`;
            return `${hours} ч ${minutes} мин`;
          case 'isWeekdayOnly':
            return value ? 'Да' : 'Нет';
          case 'category':
            const categories: Record<string, string> = {
              health: 'Здоровье',
              skills: 'Навыки',
              learning: 'Обучение',
              career: 'Карьера',
              recovery: 'Восстановление',
              content: 'Контент'
            };
            return categories[value] || value;
          default:
            return String(value);
        }
      };

      expect(formatValue('targetMinutes', 60)).toBe('1 ч');
      expect(formatValue('isWeekdayOnly', true)).toBe('Да');
      expect(formatValue('category', 'health')).toBe('Здоровье');
      expect(formatValue('name', null)).toBe('не задано');
    });
  });

  describe('Safety Checks', () => {
    test('should identify habits with data correctly', () => {
      // Mock function to simulate checking if habit has associated data
      const checkHabitHasData = (habitRecords: number, skillTests: number, skillProgress: number) => {
        return {
          hasData: habitRecords > 0 || skillTests > 0 || skillProgress > 0,
          habitRecordsCount: habitRecords,
          skillTestsCount: skillTests,
          skillProgressCount: skillProgress
        };
      };

      const noDataResult = checkHabitHasData(0, 0, 0);
      expect(noDataResult.hasData).toBe(false);

      const withDataResult = checkHabitHasData(5, 2, 1);
      expect(withDataResult.hasData).toBe(true);
      expect(withDataResult.habitRecordsCount).toBe(5);
      expect(withDataResult.skillTestsCount).toBe(2);
      expect(withDataResult.skillProgressCount).toBe(1);
    });

    test('should generate appropriate warning messages', () => {
      const generateWarningMessage = (habitRecords: number, skillTests: number, skillProgress: number) => {
        const items = [];
        if (habitRecords > 0) items.push(`${habitRecords} записей о выполнении`);
        if (skillTests > 0) items.push(`${skillTests} тестов навыков`);
        if (skillProgress > 0) items.push(`${skillProgress} записей прогресса`);
        
        return {
          message: 'This habit has associated data that will be permanently deleted',
          details: {
            habitRecords,
            skillTests,
            skillProgress
          },
          itemsList: items
        };
      };

      const warning = generateWarningMessage(10, 3, 2);
      expect(warning.message).toContain('permanently deleted');
      expect(warning.details.habitRecords).toBe(10);
      expect(warning.itemsList).toHaveLength(3);
      expect(warning.itemsList[0]).toBe('10 записей о выполнении');
    });
  });
});