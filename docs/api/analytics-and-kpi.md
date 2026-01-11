# Analytics and KPI System Documentation

## Overview

The KPI Productivity API provides comprehensive analytics and Key Performance Indicator (KPI) calculation capabilities. This system enables users to track performance metrics, generate detailed reports, analyze trends, and export data for further analysis.

## Table of Contents

1. [KPI Calculation System](#kpi-calculation-system)
2. [Analytics Reports](#analytics-reports)
3. [Team Analytics](#team-analytics)
4. [Principles Analytics](#principles-analytics)
5. [Goal Insights](#goal-insights)
6. [Data Export](#data-export)
7. [Performance Metrics](#performance-metrics)
8. [Code Examples](#code-examples)

## KPI Calculation System

### KPI Components

The KPI system is built on multiple components:

1. **Base KPI**: Calculated from habit completion and task performance
2. **Efficiency Coefficients**: Bonuses/penalties based on productivity principles
3. **Revolut Scorecard**: Professional development metrics (Deliverables, Skills, Culture)
4. **Productivity Books Integration**: Principles from 10 key productivity books
5. **Streak Bonuses**: Consistency rewards

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
        "deepWork": 15,
        "pomodoroTechnique": 10
      }
    }
  ],
  "tasks": [
    {
      "id": "task-uuid",
      "name": "Complete project analysis",
      "estimatedMinutes": 120,
      "actualMinutes": 100,
      "priority": "HIGH",
      "eisenhowerQuadrant": "Q1",
      "completed": true
    }
  ],
  "habits": [
    {
      "id": "habit-uuid",
      "name": "Deep Work Session",
      "targetMinutes": 60,
      "category": "Productivity",
      "eisenhowerQuadrant": "Q2"
    }
  ],
  "revolutPillars": {
    "deliverables": 85,
    "skills": 75,
    "culture": 90
  },
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
  ]
}
```

**Response:**
```json
{
  "data": {
    "totalKPI": 92.5,
    "baseKPI": 78.0,
    "efficiencyBonus": 35.0,
    "revolutBonus": 14.5,
    "efficiencyCoefficients": {
      "paretoLaw": 10,
      "deepWork": 15,
      "pomodoroTechnique": 10,
      "habitStacking": 5,
      "compoundEffect": 5
    },
    "revolutScorecard": {
      "deliverables": 85,
      "skills": 75,
      "culture": 90,
      "averageScore": 83.3
    },
    "productivityBreakdown": {
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
      "deepWork": {
        "score": 15,
        "principles": {
          "deepWorkSessions": 15
        }
      },
      "totalBonus": 50
    },
    "streakData": {
      "habit-uuid": 14
    },
    "breakdown": {
      "habitCompletion": 85.0,
      "taskEfficiency": 92.0,
      "qualityScore": 8.0,
      "consistencyBonus": 5.0
    }
  },
  "message": "KPI calculated successfully with productivity books integration"
}
```

### Efficiency Laws and Coefficients

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
      "name": "Parkinson's Law",
      "description": "Work expands to fill the time available",
      "coefficient": "+15 / -10",
      "trigger": "Completing tasks faster/slower than estimated",
      "source": "Cyril Northcote Parkinson"
    },
    {
      "name": "Law of Diminishing Returns",
      "description": "Productivity decreases after optimal work duration",
      "coefficient": "-15",
      "trigger": "Working >4 hours without break",
      "source": "Economic theory"
    },
    {
      "name": "Yerkes-Dodson Law",
      "description": "Optimal performance occurs at moderate stress levels",
      "coefficient": "+10",
      "trigger": "Timely completion of tasks (within 110% of estimate)",
      "source": "Robert Yerkes & John Dodson"
    },
    {
      "name": "Pomodoro Technique",
      "description": "Work in focused 25-minute intervals",
      "coefficient": "+10",
      "trigger": "Work sessions between 25-50 minutes",
      "source": "Francesco Cirillo"
    },
    {
      "name": "Deep Work Principle",
      "description": "Sustained focus produces higher quality output",
      "coefficient": "+15",
      "trigger": "Focused work sessions ≥90 minutes",
      "source": "Cal Newport"
    },
    {
      "name": "Time Blocking",
      "description": "Planned time allocation improves efficiency",
      "coefficient": "+10",
      "trigger": "Actual time within 20% of planned time",
      "source": "Productivity methodology"
    },
    {
      "name": "Habit Stacking",
      "description": "Linking habits creates powerful routines",
      "coefficient": "+10",
      "trigger": "Completing 5+ habits in a day",
      "source": "James Clear (Atomic Habits)"
    },
    {
      "name": "Compound Effect",
      "description": "Small daily improvements create exponential results",
      "coefficient": "+5",
      "trigger": "Consistency rate ≥80%",
      "source": "Darren Hardy"
    },
    {
      "name": "Focus Blocks",
      "description": "Avoiding context switching maintains mental clarity",
      "coefficient": "+12",
      "trigger": "Completing 2+ focused tasks (≥25 min each)",
      "source": "Attention research"
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
  "habitRecords": [
    {
      "habitId": "habit-uuid",
      "actualMinutes": 90,
      "qualityScore": 9
    }
  ],
  "tasks": [
    {
      "priority": "HIGH",
      "eisenhowerQuadrant": "Q2",
      "estimatedMinutes": 60,
      "actualMinutes": 55
    }
  ],
  "habits": [
    {
      "id": "habit-uuid",
      "name": "Deep Work",
      "eisenhowerQuadrant": "Q2"
    }
  ],
  "recentHabitRecords": []
}
```

**Response:**
```json
{
  "data": {
    "breakdown": {
      "atomicHabits": {
        "score": 20,
        "principles": {
          "compound1Percent": 5,
          "habitStacking": 10,
          "environmentDesign": 5
        },
        "explanation": "Compound improvement through consistent habits"
      },
      "sevenHabits": {
        "score": 25,
        "principles": {
          "beginWithEnd": 10,
          "firstThingsFirst": 15
        },
        "explanation": "Q2 focus and proactive planning"
      },
      "deepWork": {
        "score": 25,
        "principles": {
          "deepWorkSessions": 15,
          "attentionResidueMin": 10
        },
        "explanation": "Sustained focus and minimal distractions"
      },
      "oneThingPrinciple": {
        "score": 20,
        "principles": {
          "paretoFocus": 10,
          "timeBlocking": 10
        },
        "explanation": "Focus on most important tasks"
      },
      "gettingThingsDone": {
        "score": 10,
        "principles": {
          "captureEverything": 5,
          "clarifyOrganize": 5
        },
        "explanation": "Task organization and clarity"
      },
      "eatThatFrog": {
        "score": 15,
        "principles": {
          "hardestTaskFirst": 10,
          "planEveryDay": 5
        },
        "explanation": "Tackle difficult tasks early"
      },
      "powerOfHabit": {
        "score": 15,
        "principles": {
          "habitLoop": 10,
          "keystoneHabits": 5
        },
        "explanation": "Habit formation and consistency"
      },
      "mindset": {
        "score": 10,
        "principles": {
          "growthMindset": 10
        },
        "explanation": "Learning from challenges"
      },
      "fourHourWorkweek": {
        "score": 8,
        "principles": {
          "elimination": 8
        },
        "explanation": "Focus on essential tasks"
      },
      "essentialism": {
        "score": 12,
        "principles": {
          "lessBetter": 12
        },
        "explanation": "Disciplined pursuit of less"
      },
      "totalBonus": 50,
      "cappedTotal": 50
    },
    "bookDescriptions": {
      "atomicHabits": {
        "title": "Atomic Habits by James Clear",
        "principles": [
          "Compound 1% improvement",
          "Habit stacking",
          "Environment design",
          "Identity-based habits"
        ],
        "maxBonus": 25
      },
      "sevenHabits": {
        "title": "7 Habits of Highly Effective People by Stephen Covey",
        "principles": [
          "Begin with end in mind",
          "Put first things first (Q2 focus)",
          "Think win-win",
          "Sharpen the saw"
        ],
        "maxBonus": 30
      }
    },
    "totalMaxBonus": 50
  },
  "message": "Productivity books breakdown calculated successfully"
}
```

### Revolut Scorecard

**Endpoint:** `POST /api/kpi/revolut-scorecard`

**Request Body:**
```json
{
  "habitRecords": [
    {
      "habitId": "habit-uuid",
      "actualMinutes": 120,
      "qualityScore": 9
    }
  ],
  "tasks": [
    {
      "name": "Complete feature development",
      "priority": "HIGH",
      "completed": true,
      "estimatedMinutes": 180,
      "actualMinutes": 160
    }
  ],
  "habits": [
    {
      "id": "habit-uuid",
      "name": "Coding",
      "category": "Work"
    }
  ],
  "skillLevelDeltas": {
    "javascript": 2,
    "react": 1,
    "leadership": 1
  }
}
```

**Response:**
```json
{
  "data": {
    "deliverables": 88,
    "skills": 82,
    "culture": 75,
    "breakdown": {
      "deliverables": {
        "taskCompletion": 90,
        "qualityScore": 85,
        "efficiency": 89
      },
      "skills": {
        "technicalGrowth": 85,
        "learningConsistency": 80,
        "skillDiversity": 78
      },
      "culture": {
        "collaboration": 75,
        "mentoring": 70,
        "innovation": 80
      }
    }
  },
  "message": "Revolut scorecard calculated successfully"
}
```

## Analytics Reports

### Comprehensive Analytics Report

**Endpoint:** `GET /api/analytics/report`

**Query Parameters:**
- `startDate` (required): Start date (ISO format)
- `endDate` (required): End date (ISO format)
- `type` (optional): Report type (`month`, `quarter`, `year`)

**Response:**
```json
{
  "data": {
    "period": {
      "start": "2024-01-01T00:00:00.000Z",
      "end": "2024-01-31T23:59:59.999Z",
      "type": "month",
      "totalDays": 31,
      "workingDays": 22
    },
    "summary": {
      "averageKPI": 84.2,
      "totalHours": 186.5,
      "completedDays": 28,
      "completionRate": 90.3,
      "topHabits": [
        {
          "habitId": "habit-uuid",
          "habitName": "Deep Work",
          "totalMinutes": 2100,
          "averageKPI": 88.5,
          "completionRate": 95.2
        }
      ],
      "productivityScore": 87.3,
      "consistencyScore": 91.8
    },
    "trends": [
      {
        "habitId": "habit-uuid",
        "habitName": "Deep Work",
        "trend": "increasing",
        "trendPercentage": 12.5,
        "weeklyAverage": [75, 78, 82, 85],
        "prediction": "continued_growth"
      }
    ],
    "forecast": {
      "predictedKPI": 86.8,
      "confidence": 0.87,
      "factors": [
        "Consistent habit completion",
        "Improving efficiency coefficients",
        "Strong streak momentum"
      ]
    },
    "recommendations": [
      {
        "type": "habit_optimization",
        "priority": "high",
        "title": "Increase Deep Work Sessions",
        "description": "Your deep work sessions show the highest KPI correlation. Consider increasing from 60 to 90 minutes.",
        "expectedImpact": "+5.2 KPI points",
        "effort": "medium"
      },
      {
        "type": "efficiency_improvement",
        "priority": "medium",
        "title": "Implement Time Blocking",
        "description": "Your actual vs planned time variance is high. Time blocking could improve efficiency.",
        "expectedImpact": "+3.1 KPI points",
        "effort": "low"
      }
    ],
    "streakAnalysis": {
      "activeStreaks": 5,
      "longestStreak": 21,
      "streakMomentum": "strong",
      "riskHabits": [
        {
          "habitId": "habit-uuid",
          "habitName": "Exercise",
          "currentStreak": 3,
          "riskLevel": "medium",
          "recommendation": "Focus on consistency"
        }
      ]
    },
    "efficiencyAnalysis": {
      "topCoefficients": [
        {
          "name": "deepWork",
          "averageBonus": 14.2,
          "frequency": 0.85
        },
        {
          "name": "paretoLaw",
          "averageBonus": 9.8,
          "frequency": 0.72
        }
      ],
      "improvementAreas": [
        {
          "name": "timeBlocking",
          "currentBonus": 2.1,
          "potentialBonus": 8.5,
          "improvement": "Plan tasks more accurately"
        }
      ]
    }
  },
  "message": "Analytics report generated successfully"
}
```

### Analytics Summary (Dashboard)

**Endpoint:** `GET /api/analytics/summary`

**Query Parameters:**
- `days` (optional): Number of days to include (default: 30)

**Response:**
```json
{
  "data": {
    "period": "Last 30 days",
    "averageKPI": 82.7,
    "totalHours": 156.3,
    "completedDays": 27,
    "completionRate": 90,
    "topHabits": [
      {
        "habitName": "Deep Work",
        "averageMinutes": 75,
        "kpiContribution": 15.2
      },
      {
        "habitName": "Exercise",
        "averageMinutes": 45,
        "kpiContribution": 8.7
      },
      {
        "habitName": "Reading",
        "averageMinutes": 30,
        "kpiContribution": 6.1
      }
    ],
    "keyTrends": [
      {
        "habit": "Deep Work",
        "trend": "increasing",
        "percentage": 8.5
      },
      {
        "habit": "Exercise",
        "trend": "stable",
        "percentage": 1.2
      },
      {
        "habit": "Planning",
        "trend": "decreasing",
        "percentage": -3.1
      }
    ],
    "topRecommendation": {
      "title": "Extend Deep Work Sessions",
      "impact": "+4.2 KPI points",
      "effort": "medium"
    },
    "forecast": {
      "nextMonth": 85.3,
      "confidence": 0.82
    },
    "streakStatus": {
      "activeStreaks": 4,
      "longestCurrent": 18,
      "atRisk": 1
    }
  },
  "message": "Analytics summary retrieved successfully"
}
```

### Trend Analysis

**Endpoint:** `GET /api/analytics/trends`

**Query Parameters:**
- `startDate` (required): Start date
- `endDate` (required): End date

**Response:**
```json
{
  "data": {
    "trends": [
      {
        "habitId": "habit-uuid",
        "habitName": "Deep Work",
        "trend": "increasing",
        "trendPercentage": 15.3,
        "dataPoints": [
          {
            "date": "2024-01-01",
            "value": 75.2
          },
          {
            "date": "2024-01-08",
            "value": 78.1
          },
          {
            "date": "2024-01-15",
            "value": 82.5
          },
          {
            "date": "2024-01-22",
            "value": 86.8
          }
        ],
        "correlation": {
          "withKPI": 0.87,
          "withProductivity": 0.92
        },
        "seasonality": {
          "weekdayAverage": 85.2,
          "weekendAverage": 78.9,
          "bestDay": "Tuesday",
          "worstDay": "Sunday"
        }
      }
    ],
    "period": {
      "start": "2024-01-01",
      "end": "2024-01-31"
    },
    "generatedAt": "2024-02-01T10:00:00.000Z"
  },
  "message": "Trend analysis retrieved successfully"
}
```

### Period Comparison

**Endpoint:** `GET /api/analytics/compare`

**Query Parameters:**
- `currentStart`: Current period start date
- `currentEnd`: Current period end date
- `previousStart`: Previous period start date
- `previousEnd`: Previous period end date

**Response:**
```json
{
  "data": {
    "current": {
      "period": "2024-01-01 to 2024-01-31",
      "averageKPI": 84.2,
      "totalHours": 186.5,
      "completedDays": 28
    },
    "previous": {
      "period": "2023-12-01 to 2023-12-31",
      "averageKPI": 78.9,
      "totalHours": 172.3,
      "completedDays": 25
    },
    "comparison": {
      "kpiChange": 5.3,
      "kpiChangePercent": 6.7,
      "hoursChange": 14.2,
      "hoursChangePercent": 8.2,
      "completedDaysChange": 3,
      "improvements": [
        {
          "metric": "Deep Work consistency",
          "improvement": "12% increase in completion rate"
        },
        {
          "metric": "Efficiency coefficients",
          "improvement": "Average bonus increased by 3.2 points"
        }
      ],
      "regressions": [
        {
          "metric": "Exercise frequency",
          "regression": "8% decrease in weekly sessions"
        }
      ]
    },
    "insights": [
      "Significant improvement in overall productivity",
      "Deep work habits showing strong positive trend",
      "Exercise consistency needs attention"
    ]
  },
  "message": "Period comparison completed successfully"
}
```

### Forecast Analysis

**Endpoint:** `GET /api/analytics/forecast`

**Query Parameters:**
- `startDate` (required): Historical data start date
- `endDate` (required): Historical data end date
- `type` (optional): Forecast type (`month`, `quarter`, `year`)

**Response:**
```json
{
  "data": {
    "forecast": {
      "predictedKPI": 87.3,
      "confidence": 0.84,
      "range": {
        "low": 82.1,
        "high": 92.5
      },
      "factors": [
        {
          "factor": "Habit consistency",
          "weight": 0.35,
          "trend": "positive"
        },
        {
          "factor": "Efficiency improvements",
          "weight": 0.28,
          "trend": "positive"
        },
        {
          "factor": "Seasonal patterns",
          "weight": 0.15,
          "trend": "neutral"
        }
      ]
    },
    "recommendations": [
      {
        "action": "Maintain current deep work schedule",
        "impact": "Sustain 15% of predicted improvement"
      },
      {
        "action": "Address exercise consistency gap",
        "impact": "Potential 3-5 point KPI boost"
      }
    ],
    "basedOnPeriod": {
      "start": "2024-01-01",
      "end": "2024-01-31"
    },
    "generatedAt": "2024-02-01T10:00:00.000Z"
  },
  "message": "Forecast data retrieved successfully"
}
```

## Team Analytics

### Team Activity Summary

**Endpoint:** `GET /api/analytics/team/:teamId/activity`

**Query Parameters:**
- `startDate` (required): Start date
- `endDate` (required): End date

**Response:**
```json
{
  "data": {
    "team": {
      "id": "team-uuid",
      "name": "Development Team",
      "memberCount": 8
    },
    "period": {
      "start": "2024-01-01",
      "end": "2024-01-31"
    },
    "summary": {
      "averageTeamKPI": 81.5,
      "totalTeamHours": 1248,
      "activeMembers": 7,
      "completionRate": 87.3
    },
    "memberPerformance": [
      {
        "userId": "user-uuid",
        "userName": "John Doe",
        "averageKPI": 89.2,
        "totalHours": 168,
        "rank": 1,
        "improvement": 5.7
      },
      {
        "userId": "user-uuid-2",
        "userName": "Jane Smith",
        "averageKPI": 85.1,
        "totalHours": 156,
        "rank": 2,
        "improvement": 2.3
      }
    ],
    "teamTrends": {
      "kpiTrend": "increasing",
      "kpiChange": 4.2,
      "productivityTrend": "stable",
      "collaborationScore": 78.5
    },
    "topHabits": [
      {
        "habitName": "Daily Standup",
        "adoptionRate": 95.2,
        "averageKPI": 12.3
      },
      {
        "habitName": "Code Review",
        "adoptionRate": 88.7,
        "averageKPI": 15.8
      }
    ],
    "insights": [
      "Team productivity increased by 4.2% this month",
      "Code review habits showing highest KPI correlation",
      "3 members at risk of burnout based on hours worked"
    ]
  },
  "message": "Team activity analytics retrieved successfully"
}
```

### Team Data Export

**Endpoint:** `POST /api/analytics/team/:teamId/export`

**Request Body:**
```json
{
  "format": "csv",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}
```

**Response:** File download with team analytics data

## Principles Analytics

### Principles Usage Statistics

**Endpoint:** `GET /api/analytics/principles/usage`

**Query Parameters:**
- `startDate` (optional): Start date for filtering
- `endDate` (optional): End date for filtering

**Response:**
```json
{
  "data": {
    "period": {
      "start": "2024-01-01",
      "end": "2024-01-31"
    },
    "principleUsage": [
      {
        "principle": "Pareto Principle",
        "usageCount": 156,
        "averageBonus": 9.2,
        "adoptionRate": 78.5,
        "effectivenessScore": 85.3
      },
      {
        "principle": "Deep Work",
        "usageCount": 142,
        "averageBonus": 14.1,
        "adoptionRate": 71.2,
        "effectivenessScore": 91.7
      }
    ],
    "topPerformers": [
      {
        "userId": "user-uuid",
        "userName": "John Doe",
        "principlesUsed": 8,
        "averageBonus": 32.5
      }
    ],
    "insights": [
      "Deep Work principle shows highest effectiveness",
      "Pareto Principle has highest adoption rate",
      "Time Blocking shows room for improvement"
    ]
  },
  "message": "Principles usage statistics retrieved successfully"
}
```

### User Principle Insights

**Endpoint:** `GET /api/analytics/principles/user-insights`

**Query Parameters:**
- `startDate` (optional): Start date
- `endDate` (optional): End date

**Response:**
```json
{
  "data": {
    "userPrinciples": [
      {
        "principle": "Deep Work",
        "personalUsage": 45,
        "personalAverage": 13.8,
        "globalAverage": 12.1,
        "percentile": 78,
        "trend": "increasing"
      }
    ],
    "recommendations": [
      {
        "principle": "Time Blocking",
        "reason": "Low usage but high potential impact",
        "expectedImprovement": "+6.2 KPI points"
      }
    ],
    "strengths": [
      "Excellent at Deep Work application",
      "Consistent Pareto Principle usage"
    ],
    "improvementAreas": [
      "Time Blocking implementation",
      "Pomodoro Technique consistency"
    ]
  },
  "message": "User principle insights retrieved successfully"
}
```

### Principle Effectiveness Report

**Endpoint:** `GET /api/analytics/principles/effectiveness-report`

**Query Parameters:**
- `startDate` (required): Start date
- `endDate` (required): End date

**Response:**
```json
{
  "data": {
    "period": {
      "start": "2024-01-01",
      "end": "2024-01-31"
    },
    "effectivenessRanking": [
      {
        "principle": "Deep Work",
        "effectivenessScore": 94.2,
        "averageBonus": 14.8,
        "usageFrequency": 0.73,
        "kpiCorrelation": 0.89
      },
      {
        "principle": "Pareto Principle",
        "effectivenessScore": 87.5,
        "averageBonus": 9.1,
        "usageFrequency": 0.81,
        "kpiCorrelation": 0.76
      }
    ],
    "combinationAnalysis": [
      {
        "combination": ["Deep Work", "Pareto Principle"],
        "synergy": 1.23,
        "averageBonus": 26.4,
        "frequency": 0.45
      }
    ],
    "recommendations": [
      "Deep Work shows highest individual effectiveness",
      "Combining Deep Work with Pareto Principle creates 23% synergy",
      "Time Blocking has low adoption but high potential"
    ]
  },
  "message": "Principle effectiveness report generated successfully"
}
```

## Goal Insights

### Goal-Based Analytics

**Endpoint:** `GET /api/analytics/goals/insights`

**Response:**
```json
{
  "data": {
    "goalProgress": [
      {
        "goalId": "goal-uuid",
        "goalName": "Improve Deep Work Skills",
        "targetValue": 90,
        "currentValue": 78.5,
        "progress": 87.2,
        "onTrack": true,
        "estimatedCompletion": "2024-03-15",
        "contributingHabits": [
          {
            "habitId": "habit-uuid",
            "habitName": "Deep Work Sessions",
            "contribution": 65.2
          }
        ]
      }
    ],
    "goalRecommendations": [
      {
        "goalId": "goal-uuid",
        "recommendation": "Increase deep work session duration by 15 minutes",
        "expectedImpact": "Accelerate goal completion by 8 days",
        "effort": "medium"
      }
    ],
    "habitGoalAlignment": [
      {
        "habitId": "habit-uuid",
        "habitName": "Reading",
        "alignedGoals": 2,
        "alignmentScore": 0.78,
        "recommendation": "Well aligned with learning goals"
      }
    ],
    "insights": [
      "3 out of 5 goals are on track for completion",
      "Deep work habits contribute most to goal achievement",
      "Consider adding specific habits for goal #4"
    ]
  },
  "message": "Goal insights generated successfully"
}
```

## Data Export

### Export User Data

**Endpoint:** `POST /api/analytics/export`

**Request Body:**
```json
{
  "format": "json",
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-01-31"
  },
  "includeHabits": true,
  "includeTasks": true,
  "includeSkillTests": false,
  "includeAnalytics": true
}
```

**Response:** File download with exported data

**Supported Formats:**
- `json`: Structured JSON format
- `csv`: Comma-separated values

**Export Options:**
- `includeHabits`: Include habit data and records
- `includeTasks`: Include task data
- `includeSkillTests`: Include skill test results
- `includeAnalytics`: Include calculated analytics

### Export Statistics

**Endpoint:** `GET /api/analytics/export/stats`

**Response:**
```json
{
  "data": {
    "totalExports": 15,
    "lastExport": "2024-01-25T14:30:00.000Z",
    "exportsByFormat": {
      "json": 10,
      "csv": 5
    },
    "averageExportSize": "2.3 MB",
    "dataAvailability": {
      "earliestDate": "2023-06-01",
      "latestDate": "2024-01-31",
      "totalDays": 245
    }
  },
  "message": "Export statistics retrieved successfully"
}
```

## Performance Metrics

### Key Performance Indicators

The system tracks several key metrics:

1. **KPI Score**: Overall productivity score (0-100+)
2. **Efficiency Ratio**: Actual vs planned time performance
3. **Consistency Score**: Habit completion regularity
4. **Quality Score**: Average quality rating across activities
5. **Productivity Score**: Weighted combination of all factors

### Calculation Formulas

#### Base KPI Calculation
```
Base KPI = (Habit Completion Rate × 0.4) + 
           (Task Efficiency × 0.3) + 
           (Quality Score × 0.2) + 
           (Consistency Bonus × 0.1)
```

#### Total KPI with Bonuses
```
Total KPI = Base KPI + 
            Efficiency Coefficients + 
            Revolut Scorecard Bonus + 
            Productivity Books Bonus + 
            Streak Bonuses
```

#### Efficiency Coefficient Calculation
```
Efficiency Bonus = Sum of all applicable coefficients
                   (capped at -50 to +100)
```

## Code Examples

### Complete Analytics Service

```javascript
class AnalyticsService {
  constructor(apiService) {
    this.api = apiService;
  }

  async generateReport(startDate, endDate, type = 'month') {
    try {
      const response = await this.api.request(
        `/api/analytics/report?startDate=${startDate}&endDate=${endDate}&type=${type}`
      );
      return response.data;
    } catch (error) {
      console.error('Failed to generate analytics report:', error);
      throw error;
    }
  }

  async getDashboardSummary(days = 30) {
    try {
      const response = await this.api.request(`/api/analytics/summary?days=${days}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get dashboard summary:', error);
      throw error;
    }
  }

  async calculateKPI(habitRecords, tasks, habits, revolutPillars = null, recentHabitRecords = []) {
    try {
      const response = await this.api.request('/api/kpi/calculate', {
        method: 'POST',
        body: JSON.stringify({
          habitRecords,
          tasks,
          habits,
          revolutPillars: revolutPillars || { deliverables: 0, skills: 0, culture: 0 },
          recentHabitRecords
        })
      });
      return response.data;
    } catch (error) {
      console.error('Failed to calculate KPI:', error);
      throw error;
    }
  }

  async getTrends(startDate, endDate) {
    try {
      const response = await this.api.request(
        `/api/analytics/trends?startDate=${startDate}&endDate=${endDate}`
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get trends:', error);
      throw error;
    }
  }

  async comparePeriods(currentStart, currentEnd, previousStart, previousEnd) {
    try {
      const response = await this.api.request(
        `/api/analytics/compare?currentStart=${currentStart}&currentEnd=${currentEnd}&previousStart=${previousStart}&previousEnd=${previousEnd}`
      );
      return response.data;
    } catch (error) {
      console.error('Failed to compare periods:', error);
      throw error;
    }
  }

  async getForecast(startDate, endDate, type = 'month') {
    try {
      const response = await this.api.request(
        `/api/analytics/forecast?startDate=${startDate}&endDate=${endDate}&type=${type}`
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get forecast:', error);
      throw error;
    }
  }

  async getRecommendations(startDate, endDate) {
    try {
      const response = await this.api.request(
        `/api/analytics/recommendations?startDate=${startDate}&endDate=${endDate}`
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get recommendations:', error);
      throw error;
    }
  }

  async exportData(options) {
    try {
      const response = await this.api.request('/api/analytics/export', {
        method: 'POST',
        body: JSON.stringify(options)
      });

      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-export-${new Date().toISOString().split('T')[0]}.${options.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      return { success: true };
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }

  async getProductivityBreakdown(habitRecords, tasks, habits, recentHabitRecords = []) {
    try {
      const response = await this.api.request('/api/kpi/productivity-books', {
        method: 'POST',
        body: JSON.stringify({
          habitRecords,
          tasks,
          habits,
          recentHabitRecords
        })
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get productivity breakdown:', error);
      throw error;
    }
  }

  async getStreakAnalysis(recentHabitRecords, habits) {
    try {
      const response = await this.api.request('/api/kpi/streaks', {
        method: 'POST',
        body: JSON.stringify({
          recentHabitRecords,
          habits
        })
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get streak analysis:', error);
      throw error;
    }
  }

  async getEfficiencyLaws() {
    try {
      const response = await this.api.request('/api/kpi/laws');
      return response.data;
    } catch (error) {
      console.error('Failed to get efficiency laws:', error);
      throw error;
    }
  }
}

// Usage examples
const analyticsService = new AnalyticsService(apiService);

// Generate monthly report
const monthlyReport = await analyticsService.generateReport(
  '2024-01-01',
  '2024-01-31',
  'month'
);

console.log(`Average KPI: ${monthlyReport.summary.averageKPI}`);
console.log(`Top recommendation: ${monthlyReport.recommendations[0].title}`);

// Get dashboard summary
const summary = await analyticsService.getDashboardSummary(30);
console.log(`Completion rate: ${summary.completionRate}%`);

// Calculate daily KPI
const kpiData = await analyticsService.calculateKPI(
  [
    {
      habitId: 'habit-uuid',
      actualMinutes: 90,
      qualityScore: 8,
      efficiencyCoefficients: {
        deepWork: 15,
        paretoLaw: 10
      }
    }
  ],
  [
    {
      name: 'Complete analysis',
      estimatedMinutes: 120,
      actualMinutes: 100,
      priority: 'HIGH'
    }
  ],
  [
    {
      id: 'habit-uuid',
      name: 'Deep Work',
      targetMinutes: 90
    }
  ]
);

console.log(`Total KPI: ${kpiData.totalKPI}`);
console.log(`Productivity bonus: ${kpiData.productivityBreakdown.totalBonus}`);

// Export data
await analyticsService.exportData({
  format: 'json',
  dateRange: {
    start: '2024-01-01',
    end: '2024-01-31'
  },
  includeHabits: true,
  includeAnalytics: true
});
```

### KPI Dashboard Component (React)

```javascript
import React, { useState, useEffect } from 'react';
import { AnalyticsService } from './AnalyticsService';

const KPIDashboard = () => {
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const analyticsService = new AnalyticsService();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load summary and trends in parallel
      const [summaryData, trendsData] = await Promise.all([
        analyticsService.getDashboardSummary(30),
        analyticsService.getTrends(
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          new Date().toISOString().split('T')[0]
        )
      ]);

      setSummary(summaryData);
      setTrends(trendsData.trends);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      await analyticsService.exportData({
        format: 'json',
        dateRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end: new Date().toISOString().split('T')[0]
        },
        includeHabits: true,
        includeAnalytics: true
      });
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  if (loading) return <div>Loading dashboard...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!summary) return <div>No data available</div>;

  return (
    <div className="kpi-dashboard">
      <div className="dashboard-header">
        <h1>KPI Dashboard</h1>
        <button onClick={handleExport}>Export Data</button>
      </div>

      <div className="summary-cards">
        <div className="card">
          <h3>Average KPI</h3>
          <div className="metric">{summary.averageKPI.toFixed(1)}</div>
        </div>
        
        <div className="card">
          <h3>Total Hours</h3>
          <div className="metric">{summary.totalHours.toFixed(1)}</div>
        </div>
        
        <div className="card">
          <h3>Completion Rate</h3>
          <div className="metric">{summary.completionRate}%</div>
        </div>
        
        <div className="card">
          <h3>Active Streaks</h3>
          <div className="metric">{summary.streakStatus.activeStreaks}</div>
        </div>
      </div>

      <div className="top-habits">
        <h2>Top Performing Habits</h2>
        {summary.topHabits.map((habit, index) => (
          <div key={index} className="habit-item">
            <span className="habit-name">{habit.habitName}</span>
            <span className="habit-minutes">{habit.averageMinutes} min avg</span>
            <span className="habit-contribution">+{habit.kpiContribution} KPI</span>
          </div>
        ))}
      </div>

      <div className="trends-section">
        <h2>Key Trends</h2>
        {summary.keyTrends.map((trend, index) => (
          <div key={index} className={`trend-item ${trend.trend}`}>
            <span className="trend-habit">{trend.habit}</span>
            <span className="trend-direction">{trend.trend}</span>
            <span className="trend-percentage">
              {trend.percentage > 0 ? '+' : ''}{trend.percentage.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      {summary.topRecommendation && (
        <div className="recommendation">
          <h2>Top Recommendation</h2>
          <div className="recommendation-card">
            <h3>{summary.topRecommendation.title}</h3>
            <p>Expected impact: {summary.topRecommendation.impact}</p>
            <span className="effort-badge">{summary.topRecommendation.effort} effort</span>
          </div>
        </div>
      )}

      <div className="forecast">
        <h2>Next Month Forecast</h2>
        <div className="forecast-value">
          {summary.forecast.nextMonth.toFixed(1)} KPI
          <span className="confidence">
            ({Math.round(summary.forecast.confidence * 100)}% confidence)
          </span>
        </div>
      </div>
    </div>
  );
};

export default KPIDashboard;
```

This comprehensive documentation covers all aspects of the analytics and KPI system, providing developers with detailed information about calculations, reporting capabilities, and practical implementation examples.