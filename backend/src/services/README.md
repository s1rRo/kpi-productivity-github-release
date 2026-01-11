# KPI Calculation Engine

This directory contains the core KPI calculation services for the KPI Productivity 2026 system.

## Services Overview

### 1. KPICalculator (`kpiCalculator.ts`)

The main KPI calculation engine that implements the core formula:

**Formula**: `Base Score + Efficiency Coefficients + Priority Bonus + Revolut Score` (capped at 150)

#### Key Features:
- **Base Score**: (actual/target * 100, capped at 150%) averaged across habits
- **10+ Efficiency Laws**: Each with coefficients ranging from ±10 to ±15
- **Priority Bonus**: +20 for high priority, +10 for medium priority tasks
- **Revolut Scorecard Integration**: Weighted scoring system
- **Input Validation**: Comprehensive validation with detailed error messages

#### Efficiency Laws Implemented:

1. **Pareto Principle (80/20)**: +10 for focusing on high-priority tasks
2. **Parkinson's Law**: +15 faster than planned, -10 slower than planned
3. **Diminishing Returns**: -15 for working >4 hours without break
4. **Yerkes-Dodson Law**: +10 for timely task completion
5. **Pomodoro Technique**: +10 for focused work blocks (25-50 min)
6. **Deep Work**: +15 for sustained focus sessions (90+ min)
7. **Time Blocking**: +10 for planned vs actual time alignment
8. **Habit Stacking**: +10 for completing multiple habits
9. **Compound Effect**: +5 for consistency (80%+ completion)
10. **Focus Blocks**: +12 for maintaining focus without context switching

### 2. RevolutScorecardService (`revolutScorecard.ts`)

Implements the three-pillar Revolut scorecard system:

- **Deliverables (40% weight)**: Actual output and completion rates
- **Skills (30% weight)**: Learning progress and skill development
- **Culture (30% weight)**: Alignment with productivity principles

#### Culture Factors:
- Q2 Focus (Important, Not Urgent activities)
- Life Balance across categories
- Consistency and discipline
- Growth mindset
- Compound thinking

### 3. PriorityManager (`priorityManager.ts`)

Manages task prioritization using the Eisenhower Matrix:

- **Q1**: Urgent + Important
- **Q2**: Important, Not Urgent (target focus area)
- **Q3**: Urgent, Not Important
- **Q4**: Neither Urgent nor Important

#### Features:
- Priority bonus calculation
- Q2 focus analysis and recommendations
- Time distribution analytics
- Task limit validation (max 5 tasks/day)
- Strategic task identification

## API Endpoints

### POST `/api/kpi/calculate`
Calculate complete KPI for a day.

**Request Body:**
```json
{
  "habitRecords": [...],
  "tasks": [...],
  "habits": [...],
  "revolutPillars": {
    "deliverables": 85,
    "skills": 70,
    "culture": 80
  }
}
```

**Response:**
```json
{
  "data": {
    "baseScore": 104.63,
    "efficiencyCoefficients": {...},
    "priorityBonus": 30,
    "revolutScore": 79.0,
    "totalKPI": 150.0
  }
}
```

### POST `/api/kpi/revolut-scorecard`
Calculate Revolut scorecard for a day.

### POST `/api/kpi/efficiency-breakdown`
Get detailed breakdown of efficiency coefficients with explanations.

### GET `/api/kpi/laws`
Get information about all efficiency laws and their triggers.

### POST `/api/kpi/monthly-skills`
Calculate monthly skill progression deltas.

## Usage Examples

### Basic KPI Calculation
```typescript
import { kpiCalculator } from './services/kpiCalculator.js';

const result = kpiCalculator.calculateDailyKPI(
  habitRecords,
  tasks,
  habits,
  revolutPillars
);

console.log(`Daily KPI: ${result.totalKPI}`);
```

### Priority Analysis
```typescript
import { priorityManager } from './services/priorityManager.js';

const recommendations = priorityManager.generateRecommendations(tasks, habits);
console.log('Q2 Focus:', recommendations.currentQ2Focus);
```

### Revolut Scorecard
```typescript
import { revolutScorecardService } from './services/revolutScorecard.js';

const scorecard = revolutScorecardService.calculateDailyScorecard(
  habitRecords,
  tasks,
  habits
);

console.log('Pillars:', scorecard);
```

## Validation Rules

### Input Validation
- Habit records: Must be valid array
- Tasks: Maximum 5 per day
- Revolut pillars: 0-100 range for each pillar
- Time values: 0-1440 minutes (24 hours)

### Business Rules
- KPI is capped at 150% maximum
- Work habit adjusts for weekdays (360 min) vs weekends (180 min)
- Efficiency coefficients range from -15 to +15
- Priority bonuses: High (+20), Medium (+10), Low (0)

## Performance Considerations

- All calculations are performed in-memory
- No database queries during calculation
- Efficient algorithms for coefficient calculations
- Minimal object creation during computation

## Testing

The services include comprehensive validation and have been tested with:
- Normal performance scenarios
- Edge cases (extreme performance, empty inputs)
- Invalid input handling
- Boundary conditions (KPI capping, time limits)

## Integration with Requirements

This implementation satisfies the following requirements:

- **4.1**: Base score calculation with (actual/target*100, cap 150%)
- **4.2**: 10+ efficiency laws with ±10-15 coefficients
- **4.3**: Priority system (+20 high, +10 medium)
- **4.4**: Revolut Scorecard (0.4 Deliverables + 0.3 Skills + 0.3 Culture)
- **4.5**: Automatic recalculation when goals change
- **5.1-5.5**: All efficiency laws implemented with proper coefficients
- **6.1-6.5**: Eisenhower Matrix integration and Q2 focus
- **8.1-8.5**: Task management with 5-task limit and prioritization

## Future Enhancements

- Machine learning for personalized coefficient tuning
- Historical trend analysis for efficiency law effectiveness
- Advanced streak calculations for compound effect
- Integration with external productivity tools
- Real-time KPI updates via WebSocket