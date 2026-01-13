import { z } from 'zod';
import { TaskPriority, EisenhowerQuadrant, ExceptionType, HabitCategory } from '../types';

// Base validation schemas
export const taskPrioritySchema = z.enum(['high', 'medium', 'low'] as const);
export const eisenhowerQuadrantSchema = z.enum(['Q1', 'Q2', 'Q3', 'Q4'] as const);
export const exceptionTypeSchema = z.enum(['illness', 'travel', 'emergency', 'technical'] as const);
export const habitCategorySchema = z.enum(['health', 'skills', 'learning', 'career', 'recovery', 'content', 'wellness'] as const);

// Common validation rules
export const timeValidation = {
  minutes: z.number().min(0).max(1440), // 0-24 hours in minutes
  qualityScore: z.number().min(1).max(5),
  skillLevel: z.number().min(1).max(5),
  kpiScore: z.number().min(0).max(150)
};

// User validation schemas
export const userValidationSchema = {
  create: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(1, 'Name is required').optional()
  }),
  
  update: z.object({
    email: z.string().email('Invalid email format').optional(),
    name: z.string().min(1, 'Name cannot be empty').optional()
  })
};

// Habit validation schemas
export const habitValidationSchema = {
  create: z.object({
    name: z.string().min(1, 'Habit name is required').max(100, 'Habit name too long'),
    targetMinutes: timeValidation.minutes.min(1, 'Target minutes must be at least 1'),
    category: habitCategorySchema.optional(),
    skillLevel: timeValidation.skillLevel.default(3),
    eisenhowerQuadrant: eisenhowerQuadrantSchema.optional(),
    isWeekdayOnly: z.boolean().default(false)
  }),
  
  update: z.object({
    name: z.string().min(1, 'Habit name is required').max(100, 'Habit name too long').optional(),
    targetMinutes: timeValidation.minutes.min(1, 'Target minutes must be at least 1').optional(),
    category: habitCategorySchema.optional(),
    skillLevel: timeValidation.skillLevel.optional(),
    eisenhowerQuadrant: eisenhowerQuadrantSchema.optional(),
    isWeekdayOnly: z.boolean().optional()
  })
};

// Habit record validation schemas
export const habitRecordValidationSchema = {
  create: z.object({
    habitId: z.string().uuid('Invalid habit ID'),
    actualMinutes: timeValidation.minutes,
    qualityScore: timeValidation.qualityScore.optional(),
    efficiencyCoefficients: z.object({
      paretoLaw: z.number().optional(),
      parkinsonLaw: z.number().optional(),
      diminishingReturns: z.number().optional(),
      yerkesDodssonLaw: z.number().optional(),
      pomodoroTechnique: z.number().optional(),
      deepWork: z.number().optional(),
      timeBlocking: z.number().optional(),
      habitStacking: z.number().optional(),
      compoundEffect: z.number().optional(),
      focusBlocks: z.number().optional()
    }).optional()
  }),
  
  update: z.object({
    actualMinutes: timeValidation.minutes.optional(),
    qualityScore: timeValidation.qualityScore.optional(),
    efficiencyCoefficients: z.object({
      paretoLaw: z.number().optional(),
      parkinsonLaw: z.number().optional(),
      diminishingReturns: z.number().optional(),
      yerkesDodssonLaw: z.number().optional(),
      pomodoroTechnique: z.number().optional(),
      deepWork: z.number().optional(),
      timeBlocking: z.number().optional(),
      habitStacking: z.number().optional(),
      compoundEffect: z.number().optional(),
      focusBlocks: z.number().optional()
    }).optional()
  })
};

// Task validation schemas
export const taskValidationSchema = {
  create: z.object({
    dailyRecordId: z.string().uuid('Invalid daily record ID'),
    title: z.string().min(1, 'Task title is required').max(200, 'Task title too long'),
    priority: taskPrioritySchema.default('medium'),
    estimatedMinutes: timeValidation.minutes.optional(),
    actualMinutes: timeValidation.minutes.optional(),
    completed: z.boolean().default(false)
  }),
  
  update: z.object({
    title: z.string().min(1, 'Task title is required').max(200, 'Task title too long').optional(),
    priority: taskPrioritySchema.optional(),
    estimatedMinutes: timeValidation.minutes.optional(),
    actualMinutes: timeValidation.minutes.optional(),
    completed: z.boolean().optional()
  }),
  
  // Validation for maximum 5 tasks per day (requirement 8.1)
  validateTaskLimit: async (dailyRecordId: string, prisma: any): Promise<boolean> => {
    const taskCount = await prisma.task.count({
      where: { dailyRecordId }
    });
    return taskCount < 5;
  }
};

// Daily record validation schemas
export const dailyRecordValidationSchema = {
  create: z.object({
    date: z.string().transform(str => {
      const date = new Date(str);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date format');
      }
      return date;
    }),
    exceptionType: exceptionTypeSchema.optional(),
    exceptionNote: z.string().max(500, 'Exception note too long').optional(),
    totalKpi: timeValidation.kpiScore.optional(),
    habitRecords: z.array(habitRecordValidationSchema.create).optional()
  }),
  
  update: z.object({
    exceptionType: exceptionTypeSchema.optional(),
    exceptionNote: z.string().max(500, 'Exception note too long').optional(),
    totalKpi: timeValidation.kpiScore.optional()
  })
};

// Date range validation
export const dateRangeValidationSchema = z.object({
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str))
}).refine(data => data.startDate <= data.endDate, {
  message: 'Start date must be before or equal to end date'
});

// Pagination validation
export const paginationValidationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20)
});

// Skill test validation schemas
export const skillTestValidationSchema = {
  create: z.object({
    habitId: z.string().uuid('Invalid habit ID'),
    month: z.number().min(1).max(12),
    year: z.number().min(2020).max(2030),
    testType: z.enum(['before', 'after'] as const),
    testData: z.record(z.union([z.number(), z.string(), z.boolean()]))
  }),
  
  update: z.object({
    testData: z.record(z.union([z.number(), z.string(), z.boolean()])).optional()
  })
};

// Skill progress validation
export const skillProgressValidationSchema = {
  query: z.object({
    habitId: z.string().uuid().optional(),
    month: z.number().min(1).max(12).optional(),
    year: z.number().min(2020).max(2030).optional()
  })
};

// Custom validation functions
export const validateBusinessRules = {
  // Validate that sleep habit has special rules (requirement 3.1)
  validateSleepHabit: (actualMinutes: number, bedtime?: string): boolean => {
    if (bedtime) {
      const bedtimeHour = new Date(`1970-01-01T${bedtime}`).getHours();
      // Sleep before midnight gets bonus (requirement 3.1)
      return bedtimeHour <= 23 || bedtimeHour >= 22;
    }
    return actualMinutes >= 360 && actualMinutes <= 600; // 6-10 hours
  },
  
  // Validate work habit weekday rules (requirement 3.5)
  validateWorkHabit: (date: Date, targetMinutes: number): number => {
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    if (isWeekend) {
      return 180; // 3 hours on weekends
    }
    return 360; // 6 hours on weekdays
  },
  
  // Validate KPI calculation bounds
  validateKPIBounds: (kpi: number): number => {
    return Math.max(0, Math.min(150, kpi));
  },
  
  // Validate efficiency coefficients are within bounds
  validateEfficiencyCoefficients: (coefficients: any): boolean => {
    if (!coefficients) return true;
    
    const values = Object.values(coefficients).filter(v => typeof v === 'number');
    return values.every(value => value >= -15 && value <= 15);
  }
};

// Error messages
export const validationMessages = {
  HABIT_NAME_REQUIRED: 'Habit name is required',
  HABIT_NAME_TOO_LONG: 'Habit name cannot exceed 100 characters',
  TARGET_MINUTES_INVALID: 'Target minutes must be between 1 and 1440',
  QUALITY_SCORE_INVALID: 'Quality score must be between 1 and 5',
  SKILL_LEVEL_INVALID: 'Skill level must be between 1 and 5',
  KPI_SCORE_INVALID: 'KPI score must be between 0 and 150',
  TASK_LIMIT_EXCEEDED: 'Maximum 5 tasks allowed per day',
  TASK_TITLE_REQUIRED: 'Task title is required',
  TASK_TITLE_TOO_LONG: 'Task title cannot exceed 200 characters',
  INVALID_DATE_FORMAT: 'Invalid date format',
  INVALID_UUID: 'Invalid UUID format',
  EXCEPTION_NOTE_TOO_LONG: 'Exception note cannot exceed 500 characters',
  DATE_RANGE_INVALID: 'Start date must be before or equal to end date',
  EFFICIENCY_COEFFICIENTS_OUT_OF_BOUNDS: 'Efficiency coefficients must be between -15 and 15'
};

// Export all schemas for use in routes
export const validationSchemas = {
  user: userValidationSchema,
  habit: habitValidationSchema,
  habitRecord: habitRecordValidationSchema,
  task: taskValidationSchema,
  dailyRecord: dailyRecordValidationSchema,
  dateRange: dateRangeValidationSchema,
  pagination: paginationValidationSchema,
  skillTest: skillTestValidationSchema,
  skillProgress: skillProgressValidationSchema
};

// Helper function for skill test validation
export function validateSkillTest(data: {
  habitId: string;
  month: number;
  year: number;
  testType: 'before' | 'after';
  testData: Record<string, any>;
}) {
  try {
    skillTestValidationSchema.create.parse(data);
    return { isValid: true, errors: [] };
  } catch (error: any) {
    return {
      isValid: false,
      errors: error.issues?.map((err: any) => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      })) || []
    };
  }
}