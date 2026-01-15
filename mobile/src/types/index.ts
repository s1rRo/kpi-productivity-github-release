// User types
export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

// Habit types
export interface Habit {
  id: string;
  userId: string;
  title: string;
  description?: string;
  category?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  targetCount?: number;
  createdAt: string;
  updatedAt: string;
}

// Task types
export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

// KPI types
export interface KPI {
  id: string;
  userId: string;
  name: string;
  value: number;
  target: number;
  unit: string;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  createdAt: string;
  updatedAt: string;
}

// API Error types
export interface APIError {
  error: string;
  details?: any;
}
