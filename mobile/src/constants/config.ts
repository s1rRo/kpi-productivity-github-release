import Constants from 'expo-constants';

// Get API URL from app.json extra config or environment variable
export const API_URL =
  Constants.expoConfig?.extra?.apiUrl ||
  'http://192.168.1.100:30002/api';

// API endpoints
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  ME: '/auth/me',

  // Habits
  HABITS: '/habits',
  HABIT_BY_ID: (id: string) => `/habits/${id}`,

  // Tasks
  TASKS: '/tasks',
  TASK_BY_ID: (id: string) => `/tasks/${id}`,

  // KPI
  KPI: '/kpi',
  KPI_BY_ID: (id: string) => `/kpi/${id}`,

  // Dashboard
  DASHBOARD: '/dashboard',

  // Health
  HEALTH: '/health',
};

// Storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: '@kpi_auth_token',
  USER_DATA: '@kpi_user_data',
};

// App configuration
export const APP_CONFIG = {
  REQUEST_TIMEOUT: 10000, // 10 seconds
  RETRY_ATTEMPTS: 3,
};
