import { z } from 'zod';

/**
 * Схема для создания команды
 */
export const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100, 'Team name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  maxMembers: z.number().int().min(2).max(100).optional(),
  isPublic: z.boolean().optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  avatar: z.string().url().optional()
});

/**
 * Схема для обновления команды
 */
export const updateTeamSchema = createTeamSchema.partial();

/**
 * Схема для добавления участника
 */
export const addTeamMemberSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(['member', 'deputy', 'leader']).optional()
});

/**
 * Схема для обновления роли участника
 */
export const updateMemberRoleSchema = z.object({
  role: z.enum(['member', 'deputy', 'leader'])
});

/**
 * Схема для создания приглашения в команду
 */
export const createTeamInvitationSchema = z.object({
  userId: z.string().min(1, 'User ID is required').optional(),
  email: z.string().email('Invalid email').optional(),
  message: z.string().max(500).optional(),
  expiresIn: z.number().int().min(1).max(30).optional() // days
}).refine(data => data.userId || data.email, {
  message: 'Either userId or email must be provided'
});

/**
 * Схема для параметров поиска команд
 */
export const searchTeamsQuerySchema = z.object({
  query: z.string().max(100).optional(),
  tags: z.string().optional(), // comma-separated
  isPublic: z.enum(['true', 'false']).optional(),
  limit: z.string().regex(/^\d+$/).optional().transform(val => val ? parseInt(val) : undefined),
  offset: z.string().regex(/^\d+$/).optional().transform(val => val ? parseInt(val) : undefined)
});

/**
 * Схема для ID команды
 */
export const teamIdParamSchema = z.object({
  id: z.string().min(1, 'Team ID is required')
});

/**
 * Схема для ID участника
 */
export const memberIdParamSchema = z.object({
  teamId: z.string().min(1, 'Team ID is required'),
  memberId: z.string().min(1, 'Member ID is required')
});

// Типы TypeScript
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type CreateTeamInvitationInput = z.infer<typeof createTeamInvitationSchema>;
export type SearchTeamsQuery = z.infer<typeof searchTeamsQuerySchema>;
export type TeamIdParam = z.infer<typeof teamIdParamSchema>;
export type MemberIdParam = z.infer<typeof memberIdParamSchema>;
