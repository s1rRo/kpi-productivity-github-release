import axios, { AxiosInstance, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, API_ENDPOINTS, STORAGE_KEYS, APP_CONFIG } from '@constants/config';
import type {
  User,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  Habit,
  Task,
  KPI,
  APIError,
} from '@types/index';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      timeout: APP_CONFIG.REQUEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      async (config) => {
        const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<APIError>) => {
        if (error.response?.status === 401) {
          // Token expired or invalid, clear storage
          await AsyncStorage.multiRemove([
            STORAGE_KEYS.AUTH_TOKEN,
            STORAGE_KEYS.USER_DATA,
          ]);
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth methods
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await this.api.post<AuthResponse>(
      API_ENDPOINTS.LOGIN,
      data
    );
    // Save token and user data
    await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, response.data.token);
    await AsyncStorage.setItem(
      STORAGE_KEYS.USER_DATA,
      JSON.stringify(response.data.user)
    );
    return response.data;
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await this.api.post<AuthResponse>(
      API_ENDPOINTS.REGISTER,
      data
    );
    // Save token and user data
    await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, response.data.token);
    await AsyncStorage.setItem(
      STORAGE_KEYS.USER_DATA,
      JSON.stringify(response.data.user)
    );
    return response.data;
  }

  async logout(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.USER_DATA,
    ]);
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.api.get<{ user: User }>(API_ENDPOINTS.ME);
    return response.data.user;
  }

  // Habit methods
  async getHabits(): Promise<Habit[]> {
    const response = await this.api.get<Habit[]>(API_ENDPOINTS.HABITS);
    return response.data;
  }

  async getHabit(id: string): Promise<Habit> {
    const response = await this.api.get<Habit>(
      API_ENDPOINTS.HABIT_BY_ID(id)
    );
    return response.data;
  }

  async createHabit(data: Partial<Habit>): Promise<Habit> {
    const response = await this.api.post<Habit>(API_ENDPOINTS.HABITS, data);
    return response.data;
  }

  async updateHabit(id: string, data: Partial<Habit>): Promise<Habit> {
    const response = await this.api.put<Habit>(
      API_ENDPOINTS.HABIT_BY_ID(id),
      data
    );
    return response.data;
  }

  async deleteHabit(id: string): Promise<void> {
    await this.api.delete(API_ENDPOINTS.HABIT_BY_ID(id));
  }

  // Task methods
  async getTasks(): Promise<Task[]> {
    const response = await this.api.get<Task[]>(API_ENDPOINTS.TASKS);
    return response.data;
  }

  async getTask(id: string): Promise<Task> {
    const response = await this.api.get<Task>(API_ENDPOINTS.TASK_BY_ID(id));
    return response.data;
  }

  async createTask(data: Partial<Task>): Promise<Task> {
    const response = await this.api.post<Task>(API_ENDPOINTS.TASKS, data);
    return response.data;
  }

  async updateTask(id: string, data: Partial<Task>): Promise<Task> {
    const response = await this.api.put<Task>(
      API_ENDPOINTS.TASK_BY_ID(id),
      data
    );
    return response.data;
  }

  async deleteTask(id: string): Promise<void> {
    await this.api.delete(API_ENDPOINTS.TASK_BY_ID(id));
  }

  // KPI methods
  async getKPIs(): Promise<KPI[]> {
    const response = await this.api.get<KPI[]>(API_ENDPOINTS.KPI);
    return response.data;
  }

  async getKPI(id: string): Promise<KPI> {
    const response = await this.api.get<KPI>(API_ENDPOINTS.KPI_BY_ID(id));
    return response.data;
  }

  async createKPI(data: Partial<KPI>): Promise<KPI> {
    const response = await this.api.post<KPI>(API_ENDPOINTS.KPI, data);
    return response.data;
  }

  async updateKPI(id: string, data: Partial<KPI>): Promise<KPI> {
    const response = await this.api.put<KPI>(
      API_ENDPOINTS.KPI_BY_ID(id),
      data
    );
    return response.data;
  }

  async deleteKPI(id: string): Promise<void> {
    await this.api.delete(API_ENDPOINTS.KPI_BY_ID(id));
  }

  // Health check
  async checkHealth(): Promise<boolean> {
    try {
      await this.api.get(API_ENDPOINTS.HEALTH);
      return true;
    } catch {
      return false;
    }
  }
}

export default new ApiService();
