// Helper functions for Express 5 query parameters
// In Express 5, query parameters can be string | string[]

export function getQueryParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function getQueryParamAsString(value: string | string[] | undefined, defaultValue: string = ''): string {
  if (Array.isArray(value)) {
    return value[0] || defaultValue;
  }
  return value || defaultValue;
}

export function getQueryParamAsNumber(value: string | string[] | undefined, defaultValue: number = 0): number {
  const str = getQueryParam(value);
  if (!str) return defaultValue;
  const num = parseInt(str, 10);
  return isNaN(num) ? defaultValue : num;
}

export function getAllQueryParams(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value;
  }
  return value ? [value] : [];
}
