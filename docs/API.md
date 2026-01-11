# KPI Productivity 2026 - API Documentation

## Overview

The KPI Productivity 2026 API provides endpoints for tracking personal productivity metrics, managing habits, calculating KPI scores, and generating analytics. The API follows RESTful principles and returns JSON responses.

**Base URL**: `http://localhost:3001/api` (development)  
**Authentication**: JWT Bearer tokens  
**Content-Type**: `application/json`

## Authentication

### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Response (201):**
```json
{
  "message": "User created successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "jwt_token_here"
}
```

### POST /auth/login
Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "jwt_token_here"
}
```

### GET /auth/me
Get current authenticated user information.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2026-01-07T10:30:00Z"
  }
}
```

## Habits Management

### GET /habits
Get all habits for the authenticated user.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "habits": [
    {
      "id": "uuid",
      "name": "Сон",
      "targetMinutes": 480,
      "category": "health",
      "skillLevel": 3,
      "eisenhowerQuadrant": "Q2",
      "isWeekdayOnly": false
    }
  ]
}
```

### POST /habits
Create a new habit.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "name": "Медитация",
  "targetMinutes": 20,
  "category": "wellness",
  "skillLevel": 1,
  "eisenhowerQuadrant": "Q2"
}
```

**Response (201):**
```json
{
  "habit": {
    "id": "uuid",
    "name": "Медитация",
    "targetMinutes": 20,
    "category": "wellness",
    "skillLevel": 1,
    "eisenhowerQuadrant": "Q2",
    "isWeekdayOnly": false
  },
  "message": "Habit created successfully"
}
```

### PUT /habits/:id
Update an existing habit.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "targetMinutes": 30,
  "skillLevel": 2
}
```

**Response (200):**
```json
{
  "habit": {
    "id": "uuid",
    "name": "Медитация",
    "targetMinutes": 30,
    "skillLevel": 2
  },
  "message": "Habit updated successfully",
  "changes": 2
}
```

### GET /habits/:id/deletion-check
Check if a habit can be safely deleted (has no associated data).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "habit": {
    "id": "uuid",
    "name": "Habit Name"
  },
  "canDelete": false,
  "warnings": {
    "message": "This habit has associated data that will be permanently deleted",
    "details": {
      "habitRecords": 15,
      "skillTests": 3,
      "skillProgress": 2
    }
  }
}
```

### GET /habits/:id/history
Get change history for a specific habit.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)

**Response (200):**
```json
{
  "habit": {
    "id": "uuid",
    "name": "Habit Name"
  },
  "history": [
    {
      "id": "uuid",
      "action": "updated",
      "changes": [
        {
          "field": "targetMinutes",
          "oldValue": 30,
          "newValue": 45
        }
      ],
      "createdAt": "2026-01-07T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

### POST /habits/initialize-defaults
Initialize default habits for a new user.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "message": "Default habits initialized successfully",
  "count": 10,
  "habits": ["Сон", "Спорт", "Английский", ...]
}
```

### GET /habits/category/:category
Get habits filtered by category.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "habits": [...],
  "category": "health"
}
```

### GET /habits/quadrant/:quadrant
Get habits filtered by Eisenhower quadrant.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "habits": [...],
  "quadrant": "Q2"
}
```

## Daily Records

### GET /daily-records
Get daily records for a date range.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `startDate` (optional): ISO date string (default: current month start)
- `endDate` (optional): ISO date string (default: current month end)

**Response (200):**
```json
{
  "records": [
    {
      "id": "uuid",
      "date": "2026-01-07",
      "totalKPI": 125.5,
      "exceptionType": null,
      "exceptionNote": null,
      "habitRecords": [
        {
          "habitId": "uuid",
          "actualMinutes": 450,
          "qualityScore": 4,
          "completed": true
        }
      ],
      "tasks": [
        {
          "id": "uuid",
          "title": "Complete project proposal",
          "priority": "high",
          "completed": true,
          "eisenhowerQuadrant": "Q1"
        }
      ]
    }
  ]
}
```

### POST /daily-records
Create or update a daily record.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "date": "2026-01-07",
  "habitRecords": [
    {
      "habitId": "uuid",
      "actualMinutes": 450,
      "qualityScore": 4
    }
  ],
  "tasks": [
    {
      "title": "Complete project proposal",
      "priority": "high",
      "eisenhowerQuadrant": "Q1"
    }
  ],
  "exceptionType": null,
  "exceptionNote": null
}
```

**Response (201):**
```json
{
  "dailyRecord": {
    "id": "uuid",
    "date": "2026-01-07",
    "totalKPI": 125.5,
    "habitRecords": [...],
    "tasks": [...]
  }
}
```

## Goals Management

### GET /goals
Get all goals for the authenticated user.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "goals": [
    {
      "id": "uuid",
      "title": "Learn Spanish",
      "description": "Become conversational in Spanish",
      "type": "main",
      "status": "active",
      "progress": 45,
      "positionX": 100,
      "positionY": 200,
      "color": "#3b82f6",
      "fromConnections": [],
      "toConnections": [],
      "generatedHabits": []
    }
  ],
  "connections": [],
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```

### POST /goals
Create a new goal.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "title": "Learn Spanish",
  "description": "Become conversational in Spanish",
  "type": "main",
  "positionX": 100,
  "positionY": 200,
  "color": "#3b82f6"
}
```

**Response (201):**
```json
{
  "goal": {
    "id": "uuid",
    "title": "Learn Spanish",
    "description": "Become conversational in Spanish",
    "type": "main",
    "status": "active",
    "progress": 0,
    "positionX": 100,
    "positionY": 200,
    "color": "#3b82f6"
  }
}
```

### PUT /goals/:id
Update an existing goal.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "title": "Master Spanish",
  "progress": 60
}
```

**Response (200):**
```json
{
  "goal": {
    "id": "uuid",
    "title": "Master Spanish",
    "progress": 60
  }
}
```

### DELETE /goals/:id
Delete a goal.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "message": "Goal deleted successfully"
}
```

### POST /goals/:id/connections
Create a connection between goals.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "toGoalId": "uuid",
  "connectionType": "depends_on"
}
```

**Response (201):**
```json
{
  "connection": {
    "id": "uuid",
    "fromGoalId": "uuid",
    "toGoalId": "uuid",
    "connectionType": "depends_on"
  }
}
```

### POST /goals/:id/generate-habits
Generate habit suggestions for a goal using AI.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "suggestions": [
    {
      "name": "Daily Spanish Practice",
      "targetMinutes": 30,
      "category": "skills",
      "reasoning": "Consistent daily practice is key to language learning"
    }
  ]
}
```

## KPI Calculations

### POST /kpi/calculate
Calculate KPI for a specific day with productivity books integration.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "habitRecords": [
    {
      "habitId": "uuid",
      "actualMinutes": 450,
      "qualityScore": 4
    }
  ],
  "tasks": [
    {
      "title": "Complete project proposal",
      "priority": "high",
      "eisenhowerQuadrant": "Q1"
    }
  ],
  "habits": [
    {
      "id": "uuid",
      "name": "Сон",
      "targetMinutes": 480,
      "category": "health",
      "skillLevel": 3,
      "eisenhowerQuadrant": "Q2"
    }
  ],
  "revolutPillars": {
    "deliverables": 85,
    "skills": 10,
    "culture": 90
  }
}
```

**Response (200):**
```json
{
  "data": {
    "baseScore": 93.75,
    "efficiencyCoefficients": {
      "paretoLaw": 10,
      "parkinsonLaw": 0,
      "diminishingReturns": 0,
      "yerkesDodssonLaw": 0,
      "pomodoroTechnique": 10,
      "deepWork": 0,
      "timeBlocking": 0,
      "habitStacking": 0,
      "compoundEffect": 5,
      "focusBlocks": 0,
      "productivityBooks": 25
    },
    "priorityBonus": 10,
    "revolutScore": 5.5,
    "totalKPI": 125.5,
    "productivityBreakdown": {
      "atomicHabits": 5,
      "sevenHabits": 8,
      "deepWork": 0,
      "oneThingPrinciple": 12,
      "total": 25
    }
  },
  "message": "KPI calculated successfully with productivity books integration"
}
```

### GET /kpi/laws
Get information about all efficiency laws and productivity principles.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "data": [
    {
      "name": "Pareto Principle (80/20 Rule)",
      "description": "Focus on the 20% of tasks that produce 80% of results",
      "coefficient": "+10",
      "trigger": "High-priority task focus ≥80% or Q2 focus ≥60%",
      "source": "Vilfredo Pareto"
    }
  ],
  "message": "Efficiency laws retrieved successfully"
}
```

### POST /kpi/revolut-scorecard
Calculate Revolut scorecard for a day.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "habitRecords": [...],
  "tasks": [...],
  "habits": [...],
  "skillLevelDeltas": {
    "habitId1": 0.5,
    "habitId2": -0.2
  }
}
```

**Response (200):**
```json
{
  "data": {
    "deliverables": 85,
    "skills": 10,
    "culture": 90
  },
  "message": "Revolut scorecard calculated successfully"
}
```

### POST /kpi/productivity-books
Get detailed breakdown of productivity book principles.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "habitRecords": [...],
  "tasks": [...],
  "habits": [...]
}
```

**Response (200):**
```json
{
  "data": {
    "breakdown": {
      "atomicHabits": 5,
      "sevenHabits": 8,
      "deepWork": 0,
      "oneThingPrinciple": 12,
      "total": 25
    },
    "bookDescriptions": {
      "atomicHabits": {
        "title": "Atomic Habits by James Clear",
        "principles": ["Compound 1% improvement", "Habit stacking"],
        "maxBonus": 25
      }
    },
    "totalMaxBonus": 50
  },
  "message": "Productivity books breakdown calculated successfully"
}
```

## Analytics

### GET /analytics/year/:year
Get yearly analytics and trends.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "year": 2026,
  "summary": {
    "averageKPI": 115.8,
    "totalHours": 2856,
    "totalActivities": 3650,
    "forecast2027": 125.2
  },
  "monthlyData": [
    {
      "month": 1,
      "averageKPI": 118.3,
      "totalHours": 245.5
    }
  ],
  "trends": {
    "kpiGrowthRate": 0.15,
    "mostImprovedHabit": "Английский",
    "consistencyScore": 0.87
  }
}
```

### GET /analytics/export
Export user data in JSON or CSV format.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `format`: "json" or "csv" (default: "json")
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response (200):**
```json
{
  "exportData": {
    "user": {...},
    "habits": [...],
    "dailyRecords": [...],
    "analytics": {...}
  },
  "exportedAt": "2026-01-07T10:30:00Z",
  "recordCount": 365
}
```

## Skills Management

## Skills Management

### GET /skills/tests
Get skill tests for the authenticated user.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `habitId` (optional): Filter by specific habit
- `month` (optional): Filter by month
- `year` (optional): Filter by year

**Response (200):**
```json
{
  "data": [],
  "message": "Skill tests retrieved successfully"
}
```

### POST /skills/test
Submit skill test results.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "habitId": "uuid",
  "month": 1,
  "year": 2026,
  "testType": "monthly",
  "testData": {
    "score": 85,
    "maxScore": 100
  }
}
```

**Response (201):**
```json
{
  "data": {
    "id": "uuid",
    "habitId": "uuid",
    "score": 85,
    "levelBefore": 2,
    "levelAfter": 3,
    "improvement": 0.5
  },
  "message": "Skill test created successfully"
}
```

### GET /skills/progress
Get skill progress for the authenticated user.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `habitId` (optional): Filter by specific habit
- `year` (optional): Filter by year

**Response (200):**
```json
{
  "data": [],
  "message": "Skill progress retrieved successfully"
}
```

### GET /skills/template/:habitName
Get test template for a specific habit.

**Response (200):**
```json
{
  "data": {
    "habitName": "English",
    "testType": "monthly",
    "fields": [],
    "instructions": "Skills testing is currently being rebuilt"
  },
  "message": "Test template retrieved successfully"
}
```

### GET /skills/pillar-score/:month/:year
Get skills pillar score for Revolut scorecard.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "data": {
    "score": 75
  },
  "message": "Skills pillar score calculated successfully"
}
```

### POST /skills/initialize
Initialize default skill levels for the authenticated user.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "message": "Default skill levels initialized successfully"
}
```

## Exception Handling

## Exception Handling

### GET /exceptions/types
Get all available exception types.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "data": [
    {
      "type": "illness",
      "label": "Болезнь",
      "description": "Болезнь, плохое самочувствие, восстановление после болезни",
      "color": "#ef4444",
      "icon": "🤒"
    },
    {
      "type": "travel",
      "label": "Перелет/Путешествие",
      "description": "Перелеты, смена часовых поясов, путешествия",
      "color": "#3b82f6",
      "icon": "✈️"
    }
  ],
  "message": "Exception types retrieved successfully"
}
```

### POST /exceptions/mark
Mark a day as exception (illness, travel, etc.).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "date": "2026-01-07",
  "exceptionType": "illness",
  "exceptionNote": "Flu symptoms, unable to maintain routine"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "uuid",
    "date": "2026-01-07",
    "exceptionType": "illness",
    "exceptionNote": "Flu symptoms, unable to maintain routine"
  },
  "message": "Day marked as Болезнь exception"
}
```

### DELETE /exceptions/remove/:date
Remove exception from a day.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "data": {
    "id": "uuid",
    "date": "2026-01-07",
    "exceptionType": null,
    "exceptionNote": null
  },
  "message": "Exception removed from day"
}
```

### GET /exceptions/range
Get exceptions for a date range.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `startDate`: ISO date string (required)
- `endDate`: ISO date string (required)

**Response (200):**
```json
{
  "data": [
    {
      "date": "2026-01-07",
      "exceptionType": "illness",
      "exceptionNote": "Flu symptoms, unable to maintain routine",
      "typeInfo": {
        "type": "illness",
        "label": "Болезнь",
        "color": "#ef4444",
        "icon": "🤒"
      },
      "displayText": "Болезнь: Flu symptoms, unable to maintain routine",
      "calendarColor": "#ef4444"
    }
  ],
  "message": "Exception days retrieved successfully"
}
```

### GET /exceptions/stats/:year/:month
Get exception statistics for a period.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "data": {
    "period": {
      "year": 2026,
      "month": 1,
      "totalDays": 31
    },
    "exceptionDays": 3,
    "validDays": 28,
    "exceptionRate": 9.7,
    "exceptionsByType": {
      "illness": 2,
      "travel": 1
    },
    "averageKPIExcludingExceptions": 118.5
  },
  "message": "Exception statistics retrieved successfully"
}
```

## Dashboard

## Dashboard

### GET /dashboard/year/:year
Get yearly overview data for the dashboard.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "data": {
    "months": [
      {
        "month": 1,
        "year": 2026,
        "averageKPI": 118.3,
        "totalHours": 245.5,
        "completedDays": 28
      }
    ],
    "averageKPI": 115.8,
    "totalHours": 2856,
    "totalActivities": 3650,
    "forecast2027": 125.2
  },
  "message": "Year data retrieved successfully"
}
```

### GET /dashboard/month/:year/:month
Get detailed monthly data.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "data": {
    "dailyData": [
      {
        "day": 1,
        "date": "2026-01-01",
        "kpi": 120.5,
        "isException": false
      }
    ],
    "monthStats": {
      "averageKPI": 118.3,
      "totalHours": 245.5,
      "completedDays": 28,
      "totalDays": 31,
      "completionRate": 90.3,
      "exceptionDays": 3
    },
    "month": 1,
    "year": 2026,
    "habits": [...]
  },
  "message": "Month data retrieved successfully"
}
```

## Error Responses

All endpoints may return the following error responses:

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "Invalid input",
  "details": [
    {
      "received": "wellness",
      "code": "invalid_enum_value",
      "options": ["health", "skills", "learning", "career", "recovery", "content", "wellness"],
      "path": ["category"],
      "message": "Invalid enum value. Expected valid category, received 'invalid_category'"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "error": "Access token required"
}
```

or

```json
{
  "error": "Invalid credentials"
}
```

### 403 Forbidden
```json
{
  "error": "Invalid or expired token"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

or

```json
{
  "error": "Route not found",
  "path": "/api/invalid-endpoint",
  "timestamp": "2026-01-07T10:30:00Z"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "timestamp": "2026-01-07T10:30:00Z"
}
```

## Rate Limiting

The API implements rate limiting to prevent abuse:
- **General endpoints**: 100 requests per minute per IP
- **Authentication endpoints**: 5 requests per minute per IP
- **Export endpoints**: 10 requests per hour per user

## Data Validation

All input data is validated using Zod schemas. Common validation rules:
- **Email**: Must be valid email format
- **Password**: Minimum 6 characters (updated from 8)
- **Minutes**: Must be between 0 and 1440 (24 hours)
- **Skill Level**: Must be between 1 and 5
- **Priority**: Must be "low", "medium", or "high"
- **Eisenhower Quadrant**: Must be "Q1", "Q2", "Q3", or "Q4"
- **Habit Category**: Must be "health", "skills", "learning", "career", "recovery", "content", or "wellness"
- **Exception Type**: Must be "illness", "travel", "emergency", or "technical"

## Webhooks (Future Feature)

The API will support webhooks for real-time notifications:
- Daily KPI calculations completed
- Monthly skill tests due
- Streak milestones achieved
- Goal targets reached

## SDK and Client Libraries

Official client libraries are planned for:
- JavaScript/TypeScript
- Python
- Mobile (React Native)

## Support

For API support and questions:
- GitHub Issues: [Repository URL]
- Email: support@kpi-productivity.com
- Documentation: [Documentation URL]