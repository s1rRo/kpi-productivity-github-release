/**
 * Централизованный экспорт всех Zod схем валидации
 *
 * Использование:
 * import { validateBody, createHabitSchema } from './schemas';
 * router.post('/habits', validateBody(createHabitSchema), handler);
 */

// Re-export validation middleware
export * from '../middleware/validation';

// Re-export all schemas
export * from './auth.schema';
export * from './habits.schema';
export * from './teams.schema';
export * from './goals.schema';
export * from './friends.schema';
