import { z } from 'zod';

/**
 * Схема для создания цели
 */
export const createGoalSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  targetDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  category: z.string().max(50).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['not_started', 'in_progress', 'completed', 'cancelled']).optional(),
  progress: z.number().min(0).max(100).optional(),
  parentGoalId: z.string().optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  isPublic: z.boolean().optional(),
  teamId: z.string().optional()
});

/**
 * Схема для обновления цели
 */
export const updateGoalSchema = createGoalSchema.partial();

/**
 * Схема для обновления прогресса
 */
export const updateGoalProgressSchema = z.object({
  progress: z.number().min(0).max(100),
  notes: z.string().max(500).optional()
});

/**
 * Схема для создания milestone
 */
export const createMilestoneSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  targetDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  completed: z.boolean().optional()
});

/**
 * Схема для обновления milestone
 */
export const updateMilestoneSchema = createMilestoneSchema.partial();

/**
 * Схема для параметров запроса целей
 */
export const getGoalsQuerySchema = z.object({
  category: z.string().optional(),
  status: z.enum(['not_started', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  teamId: z.string().optional(),
  sortBy: z.enum(['targetDate', 'priority', 'progress', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.string().regex(/^\d+$/).optional().transform(val => val ? parseInt(val) : undefined),
  offset: z.string().regex(/^\d+$/).optional().transform(val => val ? parseInt(val) : undefined)
});

/**
 * Схема для ID цели
 */
export const goalIdParamSchema = z.object({
  id: z.string().min(1, 'Goal ID is required')
});

/**
 * Схема для ID milestone
 */
export const milestoneIdParamSchema = z.object({
  goalId: z.string().min(1, 'Goal ID is required'),
  milestoneId: z.string().min(1, 'Milestone ID is required')
});

// Типы TypeScript
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type UpdateGoalProgressInput = z.infer<typeof updateGoalProgressSchema>;
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
export type GetGoalsQuery = z.infer<typeof getGoalsQuerySchema>;
export type GoalIdParam = z.infer<typeof goalIdParamSchema>;
export type MilestoneIdParam = z.infer<typeof milestoneIdParamSchema>;
