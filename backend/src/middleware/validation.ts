import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Типы для валидации
 */
export type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Middleware для валидации запросов с использованием Zod схем
 * @param schema Zod схема для валидации
 * @param target Часть запроса для валидации (body, query, params)
 * @returns Express middleware
 */
export const validate = (schema: ZodSchema, target: ValidationTarget = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Валидируем указанную часть запроса
      const data = req[target];
      const validated = schema.parse(data);

      // Заменяем оригинальные данные валидированными
      // Это гарантирует, что мы используем только проверенные данные
      (req as any)[target] = validated;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Форматируем ошибки Zod в понятный формат
        const errors = error.issues.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        return res.status(400).json({
          error: 'Validation failed',
          details: errors
        });
      }

      // Для других ошибок
      return res.status(500).json({
        error: 'Internal server error during validation'
      });
    }
  };
};

/**
 * Валидация body
 */
export const validateBody = (schema: ZodSchema) => validate(schema, 'body');

/**
 * Валидация query parameters
 */
export const validateQuery = (schema: ZodSchema) => validate(schema, 'query');

/**
 * Валидация route parameters
 */
export const validateParams = (schema: ZodSchema) => validate(schema, 'params');

/**
 * Комбинированная валидация (body + params)
 * Полезно для PUT/PATCH запросов
 */
export const validateBodyAndParams = (bodySchema: ZodSchema, paramsSchema: ZodSchema) => {
  return [
    validateParams(paramsSchema),
    validateBody(bodySchema)
  ];
};

/**
 * Sanitize функция для очистки объектов от undefined значений
 * Полезна для partial updates
 */
export function sanitizePartialUpdate<T extends Record<string, any>>(data: T): Partial<T> {
  const sanitized: Partial<T> = {};

  for (const key in data) {
    if (data[key] !== undefined) {
      sanitized[key] = data[key];
    }
  }

  return sanitized;
}

/**
 * Хелпер для создания безопасных фильтров для Prisma
 * Предотвращает NoSQL injection
 */
export function createSafeFilter<T extends Record<string, any>>(
  allowedFields: string[],
  input: T
): Partial<T> {
  const filter: Partial<T> = {};

  for (const key in input) {
    if (allowedFields.includes(key) && input[key] !== undefined) {
      filter[key] = input[key];
    }
  }

  return filter;
}
