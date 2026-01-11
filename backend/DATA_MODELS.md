# KPI Productivity 2026 - Data Models Documentation

## Overview

This document describes the data models, validation schemas, and business rules implemented for the KPI Productivity 2026 system. The system tracks habits, daily records, tasks, and calculates productivity KPIs based on scientific principles.

## Database Schema

### Core Entities

#### Users
- **Purpose**: Store user authentication and profile information
- **Key Fields**: id, email, password, name
- **Relationships**: One-to-many with DailyRecords

#### Habits
- **Purpose**: Define trackable habits with targets and metadata
- **Key Fields**: name, targetMinutes, category, skillLevel, eisenhowerQuadrant, isWeekdayOnly
- **Business Rules**:
  - Skill levels range from 1-5
  - Categories: health, skills, learning, career, recovery, content
  - Eisenhower quadrants: Q1 (urgent+important), Q2 (important), Q3 (urgent), Q4 (neither)
  - Work habit has different targets for weekdays (360 min) vs weekends (180 min)

#### DailyRecords
- **Purpose**: Store daily tracking data and exceptions
- **Key Fields**: userId, date, totalKpi, exceptionType, exceptionNote
- **Business Rules**:
  - Unique constraint on (userId, date)
  - Exception days are excluded from KPI calculations
  - Exception types: illness, travel, emergency, technical

#### HabitRecords
- **Purpose**: Track actual habit performance for each day
- **Key Fields**: dailyRecordId, habitId, actualMinutes, qualityScore, efficiencyCoefficients
- **Business Rules**:
  - Quality scores range from 1-5
  - Efficiency coefficients range from -15 to +15
  - Links habits to daily records

#### Tasks
- **Purpose**: Manage daily tasks with prioritization
- **Key Fields**: dailyRecordId, title, priority, estimatedMinutes, actualMinutes, completed
- **Business Rules**:
  - Maximum 5 tasks per day (requirement 8.1)
  - Priority levels: high (+20 KPI bonus), medium (+10), low (0)
  - Tasks ordered by priority then creation time

## Default Habits Configuration

The system comes with 10 predefined habits based on requirements 3.1-3.5:

| Habit | Target (min) | Category | Skill Level | Quadrant | Weekday Only |
|-------|-------------|----------|-------------|----------|--------------|
| Сон | 480 | health | 3 | Q2 | No |
| Спорт | 60 | health | 3 | Q2 | No |
| Английский | 60 | skills | 2 | Q2 | No |
| Чтение | 30 | learning | 3 | Q2 | No |
| Работа | 360/180 | career | 4 | Q1 | Yes |
| Отдых | 180 | recovery | 3 | Q3 | No |
| Права | 20 | skills | 1 | Q2 | No |
| Блог в X | 20 | content | 1 | Q2 | No |
| ИИ | 30 | skills | 1 | Q2 | No |
| Аналитика | 30 | skills | 3 | Q2 | No |

## Validation Rules

### Time Validation
- Minutes: 0-1440 (24 hours max)
- Quality scores: 1-5
- Skill levels: 1-5
- KPI scores: 0-150 (capped at 150%)

### Business Rule Validation

#### Sleep Habit (Сон)
- Target: 480 minutes (8 hours)
- Special rule: Bonus for sleeping before midnight
- Validation range: 360-600 minutes (6-10 hours)

#### Work Habit (Работа)
- Weekdays: 360 minutes (6 hours)
- Weekends: 180 minutes (3 hours)
- Automatically adjusts based on date

#### Task Limits
- Maximum 5 tasks per day to maintain focus
- Enforced at API level with clear error messages

#### Efficiency Coefficients
- All coefficients must be between -15 and +15
- Based on 10+ laws of effectiveness
- Applied to KPI calculations

### Data Integrity Rules

#### Required Fields
- Habit: name, targetMinutes
- Task: title, dailyRecordId
- DailyRecord: userId, date
- HabitRecord: habitId, dailyRecordId, actualMinutes

#### Unique Constraints
- User email must be unique
- Daily record per user per date must be unique

#### Referential Integrity
- All foreign keys have CASCADE delete
- Orphaned records are automatically cleaned up

## API Validation Schemas

### Zod Schemas
The system uses Zod for runtime validation with custom error messages:

```typescript
// Example habit validation
const habitSchema = z.object({
  name: z.string().min(1).max(100),
  targetMinutes: z.number().min(1).max(1440),
  skillLevel: z.number().min(1).max(5).default(3),
  eisenhowerQuadrant: z.enum(['Q1', 'Q2', 'Q3', 'Q4']).optional()
});
```

### Custom Validation Functions
- `validateSleepHabit()`: Special rules for sleep tracking
- `validateWorkHabit()`: Weekday/weekend target adjustment
- `validateKPIBounds()`: Ensures KPI stays within 0-150 range
- `validateEfficiencyCoefficients()`: Bounds checking for coefficients
- `validateTaskLimit()`: Enforces 5-task daily limit

## Error Handling

### Validation Error Messages
Standardized error messages for common validation failures:
- `HABIT_NAME_REQUIRED`: "Habit name is required"
- `TASK_LIMIT_EXCEEDED`: "Maximum 5 tasks allowed per day"
- `KPI_SCORE_INVALID`: "KPI score must be between 0 and 150"

### API Error Responses
```json
{
  "error": "Invalid input",
  "details": [
    {
      "field": "targetMinutes",
      "message": "Target minutes must be between 1 and 1440"
    }
  ]
}
```

## Database Seeding

### Initial Setup
Run `npm run db:seed` to populate default habits:
- Checks if habits already exist
- Creates all 10 default habits with proper metadata
- Provides detailed logging of created habits

### Development Workflow
1. `npm run db:generate` - Generate Prisma client
2. `npm run db:push` - Push schema to database
3. `npm run db:seed` - Populate default data

## TypeScript Types

### Frontend Types
- Consistent with backend models
- Includes form data types for UI components
- Supports all enum values and union types

### Backend Types
- Comprehensive interfaces for all entities
- Complex types for KPI calculations
- Utility types for API responses and pagination

## Performance Considerations

### Database Indexes
- Unique indexes on (userId, date) for daily records
- Indexes on frequently queried fields (date, userId, habitId)

### Validation Efficiency
- Early validation at API boundary
- Cached validation results where appropriate
- Minimal database queries for validation

## Security Measures

### Input Sanitization
- All user input validated through Zod schemas
- SQL injection prevention through Prisma ORM
- XSS prevention through input validation

### Data Access Control
- All routes require authentication
- User data isolation through userId filtering
- Proper error handling without data leakage

## Future Extensibility

### Adding New Habits
- Use the habits API endpoints
- Follow the default habit structure
- Consider Eisenhower quadrant classification

### Custom Validation Rules
- Extend `validateBusinessRules` object
- Add new Zod schemas to `validationSchemas`
- Update error messages in `validationMessages`

### New Entity Types
- Follow existing patterns for validation
- Add proper TypeScript interfaces
- Include in API route structure
- Update database schema through migrations