// Backend TypeScript interfaces for KPI Productivity 2026

export interface User {
  id: string;
  email: string;
  password: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Habit {
  id: string;
  name: string;
  targetMinutes: number;
  category?: string;
  skillLevel: number;
  eisenhowerQuadrant?: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  isWeekdayOnly: boolean;
  createdAt: Date;
}

export interface DailyRecord {
  id: string;
  userId: string;
  date: Date;
  totalKpi?: number;
  exceptionType?: ExceptionType;
  exceptionNote?: string;
  createdAt: Date;
}

export interface HabitRecord {
  id: string;
  dailyRecordId: string;
  habitId: string;
  actualMinutes: number;
  qualityScore?: number; // 1-5 scale
  efficiencyCoefficients?: EfficiencyCoefficients;
  createdAt: Date;
}

export interface Task {
  id: string;
  dailyRecordId: string;
  title: string;
  priority: TaskPriority;
  completed: boolean;
  estimatedMinutes?: number;
  actualMinutes?: number;
  createdAt: Date;
}

export interface SkillTest {
  id: string;
  userId: string;
  habitId: string;
  month: number;
  year: number;
  testType: SkillTestType;
  skillLevel: number;
  testData: SkillTestData;
  createdAt: Date;
}

export interface SkillProgress {
  id: string;
  userId: string;
  habitId: string;
  month: number;
  year: number;
  startLevel: number;
  endLevel: number;
  deltaPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface HabitHistory {
  id: string;
  habitId: string;
  action: HabitHistoryAction;
  changes: HabitChanges;
  createdAt: Date;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description?: string;
  type: GoalType;
  status: GoalStatus;
  progress: number; // 0-100%
  positionX: number;
  positionY: number;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoalConnection {
  id: string;
  fromGoalId: string;
  toGoalId: string;
  connectionType: ConnectionType;
  createdAt: Date;
}

export interface GoalHabit {
  id: string;
  goalId: string;
  habitId: string;
  createdAt: Date;
}

export interface GoalWithRelations extends Goal {
  fromConnections: GoalConnection[];
  toConnections: GoalConnection[];
  generatedHabits: GoalHabit[];
}

export interface GoalsGraphData {
  goals: GoalWithRelations[];
  connections: GoalConnection[];
  viewport: { x: number; y: number; zoom: number };
}

export interface HabitChanges {
  field: string;
  oldValue: any;
  newValue: any;
}

export type HabitHistoryAction = 'created' | 'updated' | 'deleted';
export type GoalType = 'main' | 'sub' | 'task';
export type GoalStatus = 'active' | 'completed' | 'paused';
export type ConnectionType = 'depends_on' | 'enables' | 'blocks';

// Enums and Union Types
export type TaskPriority = 'high' | 'medium' | 'low';
export type EisenhowerQuadrant = 'Q1' | 'Q2' | 'Q3' | 'Q4';
export type ExceptionType = 'illness' | 'travel' | 'emergency' | 'technical';
export type HabitCategory = 'health' | 'skills' | 'learning' | 'career' | 'recovery' | 'content' | 'wellness';
export type SkillTestType = 'before' | 'after';

// Skill test data structures for different habits
export interface SkillTestData {
  [key: string]: any;
}

export interface EnglishTestData extends SkillTestData {
  vocabularyWords: number;
  grammarScore: number; // 0-100
  listeningScore: number; // 0-100
  speakingScore: number; // 0-100
  readingSpeed: number; // words per minute
}

export interface AITestData extends SkillTestData {
  promptEngineering: number; // 0-100
  toolUsage: number; // 0-100
  codeGeneration: number; // 0-100
  problemSolving: number; // 0-100
}

export interface SportTestData extends SkillTestData {
  endurance: number; // minutes of continuous activity
  strength: number; // 0-100 relative score
  flexibility: number; // 0-100 relative score
  technique: number; // 0-100 relative score
}

export interface WorkTestData extends SkillTestData {
  productivity: number; // tasks completed per hour
  quality: number; // 0-100 quality score
  focus: number; // minutes of deep work
  efficiency: number; // 0-100 efficiency score
}

export interface ReadingTestData extends SkillTestData {
  readingSpeed: number; // words per minute
  comprehension: number; // 0-100 comprehension score
  retention: number; // 0-100 retention score
  criticalThinking: number; // 0-100 analysis score
}

export interface AnalyticsTestData extends SkillTestData {
  dataInterpretation: number; // 0-100
  visualizationSkills: number; // 0-100
  statisticalKnowledge: number; // 0-100
  toolProficiency: number; // 0-100
}

export interface BlogTestData extends SkillTestData {
  writingQuality: number; // 0-100
  engagement: number; // average likes/shares
  consistency: number; // posts per week
  audienceGrowth: number; // follower growth rate
}

export interface DrivingTestData extends SkillTestData {
  theoryKnowledge: number; // 0-100
  practicalSkills: number; // 0-100
  safetyAwareness: number; // 0-100
  confidence: number; // 0-100
}

export interface SleepTestData extends SkillTestData {
  sleepQuality: number; // 0-100 subjective score
  fallAsleepTime: number; // minutes to fall asleep
  wakeUpEnergy: number; // 0-100 energy level
  consistency: number; // 0-100 schedule consistency
}

export interface RestTestData extends SkillTestData {
  relaxationLevel: number; // 0-100
  stressReduction: number; // 0-100
  mindfulness: number; // 0-100
  recovery: number; // 0-100 recovery feeling
}

// Complex types for KPI calculations
export interface EfficiencyCoefficients {
  paretoLaw?: number;
  parkinsonLaw?: number;
  diminishingReturns?: number;
  yerkesDodssonLaw?: number;
  pomodoroTechnique?: number;
  deepWork?: number;
  timeBlocking?: number;
  habitStacking?: number;
  compoundEffect?: number;
  focusBlocks?: number;
  productivityBooks?: number; // NEW: Integrated productivity book principles
}

export interface RevolutPillars {
  deliverables: number; // 0-100% completion rate
  skills: number; // delta in skill level %
  culture: number; // % positive responses to culture questions
}

export interface KPICalculationData {
  baseScore: number;
  efficiencyCoefficients: EfficiencyCoefficients;
  priorityBonus: number;
  revolutScore: number;
  totalKPI: number;
}

// Monthly and yearly aggregation types
export interface MonthSummary {
  month: number;
  year: number;
  averageKPI: number;
  totalHours: number;
  completedDays: number;
  habitBreakdown: HabitSummary[];
}

export interface HabitSummary {
  habitId: string;
  habitName: string;
  totalMinutes: number;
  averageMinutes: number;
  completionRate: number; // percentage
  averageQuality?: number;
}

export interface YearData {
  months: MonthSummary[];
  averageKPI: number;
  totalHours: number;
  totalActivities: number;
  forecast2027: number;
}

// API Response types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  details?: any;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Validation error types
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface PrinciplePreference {
  id: string;
  userId: string;
  principleId: string;
  applied: boolean;
  appliedToHabits: string[]; // Array of habit IDs
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Default habits configuration
export interface DefaultHabit {
  name: string;
  targetMinutes: number;
  category: HabitCategory;
  skillLevel: number;
  eisenhowerQuadrant?: EisenhowerQuadrant;
  isWeekdayOnly?: boolean;
}

export const DEFAULT_HABITS: DefaultHabit[] = [
  { 
    name: 'Сон', 
    targetMinutes: 480, 
    category: 'health', 
    skillLevel: 3,
    eisenhowerQuadrant: 'Q2'
  },
  { 
    name: 'Спорт', 
    targetMinutes: 60, 
    category: 'health', 
    skillLevel: 3,
    eisenhowerQuadrant: 'Q2'
  },
  { 
    name: 'Английский', 
    targetMinutes: 60, 
    category: 'skills', 
    skillLevel: 2,
    eisenhowerQuadrant: 'Q2'
  },
  { 
    name: 'Чтение', 
    targetMinutes: 30, 
    category: 'learning', 
    skillLevel: 3,
    eisenhowerQuadrant: 'Q2'
  },
  { 
    name: 'Работа', 
    targetMinutes: 360, 
    category: 'career', 
    skillLevel: 4, 
    isWeekdayOnly: true,
    eisenhowerQuadrant: 'Q1'
  },
  { 
    name: 'Отдых', 
    targetMinutes: 180, 
    category: 'recovery', 
    skillLevel: 3,
    eisenhowerQuadrant: 'Q3'
  },
  { 
    name: 'Права', 
    targetMinutes: 20, 
    category: 'skills', 
    skillLevel: 1,
    eisenhowerQuadrant: 'Q2'
  },
  { 
    name: 'Блог в X', 
    targetMinutes: 20, 
    category: 'content', 
    skillLevel: 1,
    eisenhowerQuadrant: 'Q2'
  },
  { 
    name: 'ИИ', 
    targetMinutes: 30, 
    category: 'skills', 
    skillLevel: 1,
    eisenhowerQuadrant: 'Q2'
  },
  { 
    name: 'Аналитика', 
    targetMinutes: 30, 
    category: 'skills', 
    skillLevel: 3,
    eisenhowerQuadrant: 'Q2'
  }
];

// Friends System Types
export interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: FriendRequestStatus;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FriendRequestWithUsers extends FriendRequest {
  sender: Pick<User, 'id' | 'name' | 'email'>;
  receiver: Pick<User, 'id' | 'name' | 'email'>;
}

export interface Friendship {
  id: string;
  user1Id: string;
  user2Id: string;
  createdAt: Date;
}

export interface FriendshipWithUser extends Friendship {
  friend: Pick<User, 'id' | 'name' | 'email' | 'inviteCode'>;
}

export interface FriendInvite {
  id: string;
  senderId: string;
  email: string;
  inviteCode: string;
  status: InviteStatus;
  message?: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface SupportMessage {
  id: string;
  senderId: string;
  receiverId: string;
  message: string;
  type: SupportMessageType;
  createdAt: Date;
  readAt?: Date;
}

export interface SupportMessageWithSender extends SupportMessage {
  sender: Pick<User, 'id' | 'name' | 'email'>;
}

export interface UserPrivacySettings {
  showProgress: boolean;
  showGoals: boolean;
  showAchievements: boolean;
  allowFriendRequests: boolean;
  allowTeamInvites: boolean;
  showOnlineStatus: boolean;
}

export interface FriendProgress {
  userId: string;
  userName: string;
  currentKPI: number;
  weeklyAverage: number;
  monthlyAverage: number;
  streak: number;
  lastActive: Date;
  goals?: Goal[];
  achievements?: Achievement[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: Date;
}

// Enums for friends system
export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected';
export type InviteStatus = 'pending' | 'accepted' | 'expired';
export type SupportMessageType = 'support' | 'congratulation' | 'motivation';

// API request/response types for friends
export interface SendFriendRequestData {
  receiverId?: string;
  inviteCode?: string;
  message?: string;
}

export interface SendEmailInviteData {
  email: string;
  message?: string;
}

export interface AcceptFriendRequestData {
  requestId: string;
}

export interface SendSupportMessageData {
  receiverId: string;
  message: string;
  type: SupportMessageType;
}

export interface UpdatePrivacySettingsData {
  showProgress?: boolean;
  showGoals?: boolean;
  showAchievements?: boolean;
  allowFriendRequests?: boolean;
  allowTeamInvites?: boolean;
  showOnlineStatus?: boolean;
}