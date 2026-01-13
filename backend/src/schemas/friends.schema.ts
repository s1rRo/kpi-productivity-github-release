import { z } from 'zod';

/**
 * Схема для отправки заявки в друзья
 */
export const sendFriendRequestSchema = z.object({
  friendId: z.string().min(1, 'Friend ID is required'),
  message: z.string().max(500).optional()
});

/**
 * Схема для ответа на заявку в друзья
 */
export const respondToFriendRequestSchema = z.object({
  status: z.enum(['accepted', 'rejected'])
});

/**
 * Схема для поиска друзей
 */
export const searchFriendsQuerySchema = z.object({
  query: z.string().max(100).optional(),
  status: z.enum(['pending', 'accepted', 'rejected']).optional(),
  limit: z.string().regex(/^\d+$/).optional().transform(val => val ? parseInt(val) : undefined),
  offset: z.string().regex(/^\d+$/).optional().transform(val => val ? parseInt(val) : undefined)
});

/**
 * Схема для ID друга
 */
export const friendIdParamSchema = z.object({
  id: z.string().min(1, 'Friend ID is required')
});

// Типы TypeScript
export type SendFriendRequestInput = z.infer<typeof sendFriendRequestSchema>;
export type RespondToFriendRequestInput = z.infer<typeof respondToFriendRequestSchema>;
export type SearchFriendsQuery = z.infer<typeof searchFriendsQuerySchema>;
export type FriendIdParam = z.infer<typeof friendIdParamSchema>;
