import { z } from 'zod';

/**
 * Схема для создания привычки
 */
export const createHabitSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  targetFrequency: z.number().int().min(1).max(31).optional(),
  targetType: z.enum(['daily', 'weekly', 'monthly']).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
  icon: z.string().max(50).optional(),
  category: z.string().max(50).optional(),
  isDefault: z.boolean().optional(),
  order: z.number().int().min(0).optional()
});

/**
 * Схема для обновления привычки
 */
export const updateHabitSchema = createHabitSchema.partial();

/**
 * Схема для записи выполнения привычки
 */
export const createHabitRecordSchema = z.object({
  habitId: z.string().min(1, 'Habit ID is required'),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  completed: z.boolean(),
  notes: z.string().max(500).optional(),
  value: z.number().optional()
});

/**
 * Схема для теста навыков
 */
export const createSkillTestSchema = z.object({
  habitId: z.string().min(1, 'Habit ID is required'),
  testType: z.enum(['initial', 'progress', 'final']),
  score: z.number().min(0).max(100),
  notes: z.string().max(1000).optional(),
  date: z.string().datetime().optional()
});

/**
 * Схема для обновления прогресса навыка
 */
export const updateSkillProgressSchema = z.object({
  habitId: z.string().min(1, 'Habit ID is required'),
  level: z.number().int().min(1).max(10),
  experience: z.number().min(0),
  milestones: z.array(z.string()).optional()
});

/**
 * Схема для параметров запроса списка привычек
 */
export const getHabitsQuerySchema = z.object({
  category: z.string().optional(),
  isDefault: z.enum(['true', 'false']).optional(),
  limit: z.string().regex(/^\d+$/).optional().transform(val => val ? parseInt(val) : undefined),
  offset: z.string().regex(/^\d+$/).optional().transform(val => val ? parseInt(val) : undefined)
});

/**
 * Схема для ID параметра
 */
export const habitIdParamSchema = z.object({
  id: z.string().min(1, 'Habit ID is required')
});

// Типы TypeScript на основе схем
export type CreateHabitInput = z.infer<typeof createHabitSchema>;
export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;
export type CreateHabitRecordInput = z.infer<typeof createHabitRecordSchema>;
export type CreateSkillTestInput = z.infer<typeof createSkillTestSchema>;
export type UpdateSkillProgressInput = z.infer<typeof updateSkillProgressSchema>;
export type GetHabitsQuery = z.infer<typeof getHabitsQuerySchema>;
export type HabitIdParam = z.infer<typeof habitIdParamSchema>;
