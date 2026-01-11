# Habits and Daily Tracking System Documentation

## Overview

The KPI Productivity API provides comprehensive habit management and daily tracking capabilities. This system allows users to create, manage, and track habits while recording daily progress with detailed analytics and KPI calculations.

## Table of Contents

1. [Habit Management](#habit-management)
2. [Daily Records System](#daily-records-system)
3. [Habit Records](#habit-records)
4. [KPI Calculation](#kpi-calculation)
5. [Streak Tracking](#streak-tracking)
6. [Analytics and Reporting](#analytics-and-reporting)
7. [Exception Handling](#exception-handling)
8. [Code Examples](#code-examples)

## Habit Management

### Data Model

A habit contains the following properties:

```typescript
interface Habit {
  id: string;
  name: string;
  targetMinutes: number;
  category: string;
  skillLevel?: 'Beginner' | 'Intermediate' | 'Advanced';
  eisenhowerQuadrant?: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  isWeekdayOnly?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Habit CRUD Operations

#### Create Habit

**Endpoint:** `POST /api/habits`

**Request Body:**
```json
{
  "name": "Morning Exercise",
  "targetMinutes": 60,
  "category": "Health",
  "skillLevel": "Beginner",
  "eisenhowerQuadrant": "Q2",
  "isWeekdayOnly": false
}
```

**Response:**
```json
{
  "habit": {
    "id": "habit-uuid",
    "name": "Morning Exercise",
    "targetMinutes": 60,
    "category": "Health",
    "skillLevel": "Beginner",
    "eisenhowerQuadrant": "Q2",
    "isWeekdayOnly": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Habit created successfully"
}
```

**Example Usage:**
```javascript
const createHabit = async (habitData) => {
  const response = await fetch('http://localhost:3001/api/habits', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(habitData)
  });

  if (!response.ok) {
    throw new Error('Failed to create habit');
  }

  return response.json();
};

// Usage
const newHabit = await createHabit({
  name: 'Morning Exercise',
  targetMinutes: 60,
  category: 'Health',
  skillLevel: 'Beginner',
  eisenhowerQuadrant: 'Q2',
  isWeekdayOnly: false
});
```

#### Get All Habits

**Endpoint:** `GET /api/habits`

**Response:**
```json
{
  "habits": [
    {
      "id": "habit-uuid",
      "name": "Morning Exercise",
      "targetMinutes": 60,
      "category": "Health",
      "skillLevel": "Beginner",
      "eisenhowerQuadrant": "Q2",
      "isWeekdayOnly": false,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### Get Habit by ID

**Endpoint:** `GET /api/habits/:id`

**Query Parameters:**
- `includeHistory` (optional): Include habit change history

**Response:**
```json
{
  "habit": {
    "id": "habit-uuid",
    "name": "Morning Exercise",
    "targetMinutes": 60,
    "category": "Health",
    "habitHistory": [
      {
        "id": "history-uuid",
        "action": "created",
        "changes": [
          {
            "field": "name",
            "oldValue": null,
            "newValue": "Morning Exercise"
          }
        ],
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

#### Update Habit

**Endpoint:** `PUT /api/habits/:id`

**Request Body:**
```json
{
  "name": "Evening Exercise",
  "targetMinutes": 90
}
```

**Response:**
```json
{
  "habit": {
    "id": "habit-uuid",
    "name": "Evening Exercise",
    "targetMinutes": 90,
    "category": "Health"
  },
  "message": "Habit updated successfully",
  "changes": 2
}
```

#### Delete Habit

**Endpoint:** `DELETE /api/habits/:id`

**Query Parameters:**
- `force` (optional): Force delete even if habit has associated data

**Response:**
```json
{
  "message": "Habit deleted successfully",
  "deletedData": {
    "habitRecords": 15,
    "skillTests": 3,
    "skillProgress": 8
  }
}
```

#### Check Deletion Safety

**Endpoint:** `GET /api/habits/:id/deletion-check`

**Response:**
```json
{
  "habit": {
    "id": "habit-uuid",
    "name": "Morning Exercise"
  },
  "canDelete": false,
  "warnings": {
    "message": "This habit has associated data that will be permanently deleted",
    "details": {
      "habitRecords": 15,
      "skillTests": 3,
      "skillProgress": 8
    }
  }
}
```

### Habit Categories and Filtering

#### Get Habits by Category

**Endpoint:** `GET /api/habits/category/:category`

**Response:**
```json
{
  "habits": [
    {
      "id": "habit-uuid",
      "name": "Morning Exercise",
      "category": "Health"
    }
  ],
  "category": "Health"
}
```

#### Get Habits by Eisenhower Quadrant

**Endpoint:** `GET /api/habits/quadrant/:quadrant`

**Valid quadrants:** Q1, Q2, Q3, Q4

**Response:**
```json
{
  "habits": [
    {
      "id": "habit-uuid",
      "name": "Strategic Planning",
      "eisenhowerQuadrant": "Q2"
    }
  ],
  "quadrant": "Q2"
}
```

### Default Habits Initialization

**Endpoint:** `POST /api/habits/initialize-defaults`

**Response:**
```json
{
  "message": "Default habits initialized successfully",
  "count": 10,
  "habits": [
    "Работа",
    "Спорт",
    "Чтение",
    "Медитация",
    "Планирование"
  ]
}
```

## Daily Records System

### Data Model

A daily record represents a user's activity for a specific date:

```typescript
interface DailyRecord {
  id: string;
  userId: string;
  date: Date;
  totalKpi?: number;
  exceptionType?: 'SICK' | 'VACATION' | 'EMERGENCY' | 'PERSONAL';
  exceptionNote?: string;
  habitRecords: HabitRecord[];
  tasks: Task[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Daily Record Operations

#### Get Daily Records

**Endpoint:** `GET /api/daily-records`

**Query Parameters:**
- `startDate` (optional): Start date for filtering (ISO format)
- `endDate` (optional): End date for filtering (ISO format)

**Response:**
```json
{
  "dailyRecords": [
    {
      "id": "record-uuid",
      "userId": "user-uuid",
      "date": "2024-01-01T00:00:00.000Z",
      "totalKpi": 85.5,
      "exceptionType": null,
      "exceptionNote": null,
      "habitRecords": [
        {
          "id": "habit-record-uuid",
          "habitId": "habit-uuid",
          "actualMinutes": 60,
          "qualityScore": 8,
          "efficiencyCoefficients": {
            "paretoLaw": 10,
            "deepWork": 15
          },
          "habit": {
            "id": "habit-uuid",
            "name": "Morning Exercise",
            "targetMinutes": 60
          }
        }
      ],
      "tasks": []
    }
  ]
}
```

#### Get Daily Record by Date

**Endpoint:** `GET /api/daily-records/:date`

**Parameters:**
- `date`: Date in YYYY-MM-DD format

**Response:**
```json
{
  "dailyRecord": {
    "id": "record-uuid",
    "date": "2024-01-01T00:00:00.000Z",
    "totalKpi": 85.5,
    "habitRecords": [
      {
        "id": "habit-record-uuid",
        "habitId": "habit-uuid",
        "actualMinutes": 60,
        "qualityScore": 8,
        "habit": {
          "name": "Morning Exercise"
        }
      }
    ],
    "tasks": []
  }
}
```

#### Create or Update Daily Record

**Endpoint:** `POST /api/daily-records`

**Request Body:**
```json
{
  "date": "2024-01-01T00:00:00.000Z",
  "exceptionType": null,
  "exceptionNote": null,
  "habitRecords": [
    {
      "habitId": "habit-uuid",
      "actualMinutes": 60,
      "qualityScore": 8,
      "efficiencyCoefficients": {
        "paretoLaw": 10,
        "deepWork": 15
      }
    }
  ]
}
```

**Response:**
```json
{
  "dailyRecord": {
    "id": "record-uuid",
    "date": "2024-01-01T00:00:00.000Z",
    "habitRecords": [
      {
        "id": "habit-record-uuid",
        "habitId": "habit-uuid",
        "actualMinutes": 60,
        "qualityScore": 8,
        "habit": {
          "name": "Morning Exercise"
        }
      }
    ]
  }
}
```

#### Update Daily Record

**Endpoint:** `PUT /api/daily-records/:date`

**Request Body:**
```json
{
  "exceptionType": "SICK",
  "exceptionNote": "Flu symptoms",
  "totalKpi": 0
}
```

#### Delete Daily Record

**Endpoint:** `DELETE /api/daily-records/:date`

**Response:**
```json
{
  "message": "Daily record deleted successfully"
}
```

## Habit Records

### Data Model

A habit record represents the completion of a specific habit on a specific day:

```typescript
interface HabitRecord {
  id: string;
  dailyRecordId: string;
  habitId: string;
  actualMinutes: number;
  qualityScore?: number; // 1-10 scale
  efficiencyCoefficients?: {
    [key: string]: number; // -15 to +15 range
  };
  habit: Habit;
}
```

### Efficiency Coefficients

Efficiency coefficients are bonuses/penalties applied based on productivity principles:

```typescript
interface EfficiencyCoefficients {
  paretoLaw?: number;           // Pareto Principle (80/20)
  parkinsonLaw?: number;        // Work expands to fill time
  diminishingReturns?: number;  // Productivity decreases after optimal duration
  yerkesDodssonLaw?: number;    // Optimal performance at moderate stress
  pomodoroTechnique?: number;   // 25-minute focused work sessions
  deepWork?: number;            // Sustained focus sessions
  timeBlocking?: number;        // Planned vs actual time alignment
  habitStacking?: number;       // Completing multiple habits
  compoundEffect?: number;      // Consistency bonus
  focusBlocks?: number;         // Avoiding context switching
}
```

**Validation Rules:**
- All coefficients must be between -15 and +15
- Quality score must be between 1 and 10
- Actual minutes must be positive

## KPI Calculation

### Calculate Daily KPI

**Endpoint:** `POST /api/kpi/calculate`

**Request Body:**
```json
{
  "habitRecords": [
    {
      "habitId": "habit-uuid",
      "actualMinutes": 60,
      "qualityScore": 8,
      "efficiencyCoefficients": {
        "paretoLaw": 10,
        "deepWork": 15
      }
    }
  ],
  "tasks": [
    {
      "id": "task-uuid",
      "name": "Complete project",
      "estimatedMinutes": 120,
      "actualMinutes": 100,
      "priority": "HIGH",
      "eisenhowerQuadrant": "Q1"
    }
  ],
  "habits": [
    {
      "id": "habit-uuid",
      "name": "Deep Work",
      "targetMinutes": 60,
      "eisenhowerQuadrant": "Q2"
    }
  ],
  "revolutPillars": {
    "deliverables": 85,
    "skills": 75,
    "culture": 90
  },
  "recentHabitRecords": []
}
```

**Response:**
```json
{
  "data": {
    "totalKPI": 87.5,
    "baseKPI": 75.0,
    "efficiencyBonus": 12.5,
    "efficiencyCoefficients": {
      "paretoLaw": 10,
      "deepWork": 15,
      "habitStacking": 5
    },
    "revolutScorecard": {
      "deliverables": 85,
      "skills": 75,
      "culture": 90
    },
    "productivityBreakdown": {
      "atomicHabits": 15,
      "sevenHabits": 20,
      "deepWork": 25,
      "totalBonus": 50
    },
    "streakData": {
      "habit-uuid": 7
    }
  },
  "message": "KPI calculated successfully"
}
```

### Get Efficiency Laws

**Endpoint:** `GET /api/kpi/laws`

**Response:**
```json
{
  "data": [
    {
      "name": "Pareto Principle (80/20 Rule)",
      "description": "Focus on the 20% of tasks that produce 80% of results",
      "coefficient": "+10",
      "trigger": "High-priority task focus ≥80% or Q2 focus ≥60%",
      "source": "Vilfredo Pareto"
    },
    {
      "name": "Deep Work Principle",
      "description": "Sustained focus produces higher quality output",
      "coefficient": "+15",
      "trigger": "Focused work sessions ≥90 minutes",
      "source": "Cal Newport"
    }
  ],
  "message": "Efficiency laws retrieved successfully"
}
```

### Productivity Books Integration

**Endpoint:** `POST /api/kpi/productivity-books`

**Request Body:**
```json
{
  "habitRecords": [],
  "tasks": [],
  "habits": [],
  "recentHabitRecords": []
}
```

**Response:**
```json
{
  "data": {
    "breakdown": {
      "atomicHabits": {
        "score": 15,
        "principles": {
          "compound1Percent": 5,
          "habitStacking": 10
        }
      },
      "sevenHabits": {
        "score": 20,
        "principles": {
          "beginWithEnd": 8,
          "firstThingsFirst": 12
        }
      },
      "totalBonus": 50
    },
    "bookDescriptions": {
      "atomicHabits": {
        "title": "Atomic Habits by James Clear",
        "principles": ["Compound 1% improvement", "Habit stacking"],
        "maxBonus": 25
      }
    }
  },
  "message": "Productivity books breakdown calculated successfully"
}
```

## Streak Tracking

### Calculate Streaks

**Endpoint:** `POST /api/kpi/streaks`

**Request Body:**
```json
{
  "recentHabitRecords": [
    {
      "date": "2024-01-01",
      "habitRecords": [
        {
          "habitId": "habit-uuid",
          "actualMinutes": 60
        }
      ]
    }
  ],
  "habits": [
    {
      "id": "habit-uuid",
      "name": "Exercise",
      "targetMinutes": 60
    }
  ]
}
```

**Response:**
```json
{
  "data": {
    "streaks": {
      "habit-uuid": 7
    },
    "statistics": {
      "totalActiveStreaks": 3,
      "longestStreak": 21,
      "averageStreak": 12.5
    },
    "insights": [
      {
        "type": "milestone",
        "message": "You've reached a 7-day streak for Exercise!",
        "habitId": "habit-uuid"
      }
    ],
    "predictions": {
      "habit-uuid": {
        "continuationProbability": 0.85,
        "nextMilestone": 14,
        "daysToMilestone": 7
      }
    },
    "milestones": [7, 14, 21, 30, 60, 90, 180, 365]
  },
  "message": "Streak analysis completed successfully"
}
```

## Analytics and Reporting

### Monthly Summary

**Endpoint:** `GET /api/daily-records/summary/month/:year/:month`

**Parameters:**
- `year`: Year (e.g., 2024)
- `month`: Month (1-12)

**Response:**
```json
{
  "monthSummary": {
    "month": 1,
    "year": 2024,
    "averageKPI": 82.5,
    "totalHours": 156.5,
    "completedDays": 28,
    "habitBreakdown": [
      {
        "habitId": "habit-uuid",
        "habitName": "Exercise",
        "totalMinutes": 1680,
        "averageMinutes": 60,
        "completionRate": 93.3,
        "averageQuality": 8.2
      }
    ],
    "exceptionDays": 3,
    "exceptionSummary": {
      "SICK": 2,
      "PERSONAL": 1
    }
  }
}
```

## Exception Handling

### Exception Types

The system supports the following exception types:

- `SICK`: Illness or health-related issues
- `VACATION`: Planned time off
- `EMERGENCY`: Unexpected urgent situations
- `PERSONAL`: Personal matters

### Exception Impact

- Exception days are excluded from KPI calculations
- Monthly summaries show both total days and exception days
- Streaks are not broken by exception days
- Analytics provide separate views with/without exceptions

## Code Examples

### Complete Daily Tracking Service

```javascript
class DailyTrackingService {
  constructor(apiService) {
    this.api = apiService;
  }

  async createDailyRecord(date, habitRecords, exceptionType = null, exceptionNote = null) {
    try {
      const response = await this.api.request('/api/daily-records', {
        method: 'POST',
        body: JSON.stringify({
          date,
          habitRecords,
          exceptionType,
          exceptionNote
        })
      });

      return response.dailyRecord;
    } catch (error) {
      console.error('Failed to create daily record:', error);
      throw error;
    }
  }

  async getDailyRecord(date) {
    try {
      const response = await this.api.request(`/api/daily-records/${date}`);
      return response.dailyRecord;
    } catch (error) {
      if (error.message.includes('404')) {
        return null; // No record for this date
      }
      throw error;
    }
  }

  async getDateRange(startDate, endDate) {
    try {
      const response = await this.api.request(
        `/api/daily-records?startDate=${startDate}&endDate=${endDate}`
      );
      return response.dailyRecords;
    } catch (error) {
      console.error('Failed to get date range:', error);
      throw error;
    }
  }

  async calculateKPI(habitRecords, tasks, habits, revolutPillars = null) {
    try {
      const response = await this.api.request('/api/kpi/calculate', {
        method: 'POST',
        body: JSON.stringify({
          habitRecords,
          tasks,
          habits,
          revolutPillars: revolutPillars || { deliverables: 0, skills: 0, culture: 0 }
        })
      });

      return response.data;
    } catch (error) {
      console.error('Failed to calculate KPI:', error);
      throw error;
    }
  }

  async getMonthSummary(year, month) {
    try {
      const response = await this.api.request(`/api/daily-records/summary/month/${year}/${month}`);
      return response.monthSummary;
    } catch (error) {
      console.error('Failed to get month summary:', error);
      throw error;
    }
  }

  async trackHabitCompletion(habitId, actualMinutes, qualityScore = null, efficiencyCoefficients = {}) {
    const today = new Date().toISOString().split('T')[0];
    
    // Get existing daily record or create new one
    let dailyRecord = await this.getDailyRecord(today);
    
    const habitRecord = {
      habitId,
      actualMinutes,
      qualityScore,
      efficiencyCoefficients
    };

    if (dailyRecord) {
      // Update existing record
      const existingHabitRecords = dailyRecord.habitRecords || [];
      const updatedHabitRecords = existingHabitRecords.filter(hr => hr.habitId !== habitId);
      updatedHabitRecords.push(habitRecord);

      return this.createDailyRecord(today, updatedHabitRecords, dailyRecord.exceptionType, dailyRecord.exceptionNote);
    } else {
      // Create new record
      return this.createDailyRecord(today, [habitRecord]);
    }
  }

  async markExceptionDay(date, exceptionType, exceptionNote = null) {
    try {
      const response = await this.api.request(`/api/daily-records/${date}`, {
        method: 'PUT',
        body: JSON.stringify({
          exceptionType,
          exceptionNote,
          totalKpi: 0
        })
      });

      return response.dailyRecord;
    } catch (error) {
      console.error('Failed to mark exception day:', error);
      throw error;
    }
  }
}

// Usage example
const trackingService = new DailyTrackingService(apiService);

// Track habit completion
await trackingService.trackHabitCompletion('habit-uuid', 60, 8, {
  paretoLaw: 10,
  deepWork: 15
});

// Get month summary
const summary = await trackingService.getMonthSummary(2024, 1);
console.log(`Average KPI: ${summary.averageKPI}`);

// Mark exception day
await trackingService.markExceptionDay('2024-01-15', 'SICK', 'Flu symptoms');
```

### Habit Management Service

```javascript
class HabitService {
  constructor(apiService) {
    this.api = apiService;
  }

  async createHabit(habitData) {
    const response = await this.api.request('/api/habits', {
      method: 'POST',
      body: JSON.stringify(habitData)
    });
    return response.habit;
  }

  async getAllHabits() {
    const response = await this.api.request('/api/habits');
    return response.habits;
  }

  async getHabit(id, includeHistory = false) {
    const url = `/api/habits/${id}${includeHistory ? '?includeHistory=true' : ''}`;
    const response = await this.api.request(url);
    return response.habit;
  }

  async updateHabit(id, updates) {
    const response = await this.api.request(`/api/habits/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return response.habit;
  }

  async deleteHabit(id, force = false) {
    const url = `/api/habits/${id}${force ? '?force=true' : ''}`;
    const response = await this.api.request(url, {
      method: 'DELETE'
    });
    return response;
  }

  async checkDeletionSafety(id) {
    const response = await this.api.request(`/api/habits/${id}/deletion-check`);
    return response;
  }

  async getHabitsByCategory(category) {
    const response = await this.api.request(`/api/habits/category/${category}`);
    return response.habits;
  }

  async getHabitsByQuadrant(quadrant) {
    const response = await this.api.request(`/api/habits/quadrant/${quadrant}`);
    return response.habits;
  }

  async initializeDefaults() {
    const response = await this.api.request('/api/habits/initialize-defaults', {
      method: 'POST'
    });
    return response;
  }
}

// Usage
const habitService = new HabitService(apiService);

// Create a new habit
const newHabit = await habitService.createHabit({
  name: 'Morning Meditation',
  targetMinutes: 20,
  category: 'Wellness',
  skillLevel: 'Beginner',
  eisenhowerQuadrant: 'Q2'
});

// Get all habits
const habits = await habitService.getAllHabits();

// Update habit
await habitService.updateHabit(newHabit.id, {
  targetMinutes: 30
});

// Check if habit can be safely deleted
const deletionCheck = await habitService.checkDeletionSafety(newHabit.id);
if (deletionCheck.canDelete) {
  await habitService.deleteHabit(newHabit.id);
} else {
  console.log('Habit has associated data:', deletionCheck.warnings);
}
```

This comprehensive documentation covers all aspects of the habits and daily tracking system, providing developers with the information needed to effectively use and integrate with the KPI Productivity API.