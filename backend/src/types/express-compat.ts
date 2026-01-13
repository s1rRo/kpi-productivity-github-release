// Express 5 compatibility helpers
// This file provides backward compatibility for Express 5 query parameters

/**
 * In Express 5, req.query values can be string | string[]
 * These helpers ensure type safety without breaking existing code
 */

export function ensureString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function ensureStringOrDefault(value: string | string[] | undefined, defaultValue: string = ''): string {
  if (Array.isArray(value)) {
    return value[0] || defaultValue;
  }
  return value || defaultValue;
}

// Type guard to check if value is string
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// Safely convert query param to number
export function queryToNumber(value: string | string[] | undefined, defaultValue: number = 0): number {
  const str = ensureString(value);
  if (!str) return defaultValue;
  const num = parseInt(str, 10);
  return isNaN(num) ? defaultValue : num;
}

// Safely convert query param to date
export function queryToDate(value: string | string[] | undefined): Date | null {
  const str = ensureString(value);
  if (!str) return null;
  const date = new Date(str);
  return isNaN(date.getTime()) ? null : date;
}
