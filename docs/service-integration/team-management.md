# Team Management and Collaboration Documentation

## Overview

The KPI Productivity application provides comprehensive team management features that enable users to create teams, collaborate on goals, track progress through leaderboards, and manage team members with role-based permissions. This documentation covers all aspects of team creation, member management, goal collaboration, analytics, and moderation tools.

## Table of Contents

1. [Team Creation and Setup](#team-creation-and-setup)
2. [Member Management](#member-management)
3. [Role-Based Permissions](#role-based-permissions)
4. [Team Goals and Collaboration](#team-goals-and-collaboration)
5. [Leaderboards and Competition](#leaderboards-and-competition)
6. [Team Analytics](#team-analytics)
7. [Invitation System](#invitation-system)
8. [Moderation Tools](#moderation-tools)
9. [API Endpoints](#api-endpoints)
10. [Real-time Features](#real-time-features)
11. [Best Practices](#best-practices)

## Team Creation and Setup

### Creating a New Team

Teams can be created by any authenticated user who will automatically become the team leader.

#### Team Configuration Options

```typescript
interface TeamCreationData {
  name: string;           // Required: Team name (1-100 characters)
  description?: string;   // Optional: Team description
  avatar?: string;        // Optional: Team avatar URL
  maxMembers: number;     // Default: 99, Range: 1-99
  isPublic: boolean;      // Default: false
}
```

#### Example Team Creation

```bash
# Create a new team
curl -X POST http://localhost:3001/api/teams \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Productivity Champions",
    "description": "A team focused on achieving daily productivity goals",
    "maxMembers": 20,
    "isPublic": false
  }'
```

Response:
```json
{
  "id": "team-123",
  "name": "Productivity Champions",
  "description": "A team focused on achieving daily productivity goals",
  "maxMembers": 20,
  "isPublic": false,
  "inviteCode": "TEAM-ABC123",
  "createdAt": "2026-01-10T10:00:00.000Z",
  "members": [
    {
      "id": "member-1",
      "userId": "user-123",
      "role": "leader",
      "joinedAt": "2026-01-10T10:00:00.000Z",
      "user": {
        "id": "user-123",
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ]
}
```

### Team Settings Management

Team leaders can update team settings including name, description, member limits, and privacy settings.

```bash
# Update team settings (leader only)
curl -X PUT http://localhost:3001/api/teams/team-123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Elite Productivity Team",
    "description": "Updated description",
    "maxMembers": 25
  }'
```

## Member Management

### Team Roles and Hierarchy

The system supports three distinct roles with different permission levels:

#### 1. Leader
- **Full team control**: Can modify all team settings
- **Member management**: Add, remove, and change roles of all members
- **Goal management**: Create, update, and delete team goals
- **Analytics access**: View comprehensive team analytics
- **Moderation powers**: Full moderation capabilities
- **Invitation control**: Send team invitations

#### 2. Deputy
- **Limited team control**: Cannot modify core team settings
- **Member management**: Can manage regular members (not other deputies/leaders)
- **Goal management**: Create and update goals (cannot delete)
- **Analytics access**: View team analytics
- **Moderation powers**: Moderate content and members
- **Invitation control**: Send team invitations

#### 3. Member
- **Basic participation**: Can update own goal progress
- **View access**: View team goals and leaderboards
- **Limited interaction**: Cannot manage other members or create goals

### Adding Members

#### Via Invite Code
```bash
# Join team using invite code
curl -X POST http://localhost:3001/api/teams/join/TEAM-ABC123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Via Email Invitation
```bash
# Send email invitation (leader/deputy only)
curl -X POST http://localhost:3001/api/teams/team-123/invite \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newmember@example.com",
    "message": "Join our productivity team!"
  }'
```

### Managing Member Roles

#### Changing Member Roles
```bash
# Change member role (leader/deputy only)
curl -X PUT http://localhost:3001/api/teams/team-123/members/member-456/role \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "deputy"
  }'
```

#### Removing Members
```bash
# Remove member from team (leader/deputy only)
curl -X DELETE http://localhost:3001/api/teams/team-123/members/member-456 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Member Self-Management

#### Leaving a Team
```bash
# Leave team (any member)
curl -X POST http://localhost:3001/api/teams/team-123/leave \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Note**: Leaders cannot leave if they are the last leader. They must assign another leader first.

## Role-Based Permissions

### Permission Matrix

| Permission | Leader | Deputy | Member |
|------------|--------|--------|--------|
| Manage Team Settings | ✅ | ❌ | ❌ |
| Manage Members | ✅ | ✅* | ❌ |
| Create Goals | ✅ | ✅ | ❌ |
| Update Goals | ✅ | ✅ | ❌ |
| Delete Goals | ✅ | ❌ | ❌ |
| View Analytics | ✅ | ✅ | ❌ |
| Moderate Content | ✅ | ✅ | ❌ |
| Invite Members | ✅ | ✅ | ❌ |
| Remove Members | ✅ | ✅* | ❌ |
| Assign Roles | ✅ | ❌** | ❌ |
| Update Own Progress | ✅ | ✅ | ✅ |
| View Leaderboards | ✅ | ✅ | ✅ |

*Deputies can only manage regular members, not other deputies or leaders  
**Deputies cannot assign leader roles

### Permission Validation

The system automatically validates permissions for all team operations:

```typescript
// Example permission check
const hasPermission = await AccessControlService.hasTeamPermission(
  userId, 
  teamId, 
  'canCreateGoals'
);

if (!hasPermission) {
  return res.status(403).json({ error: 'Insufficient permissions' });
}
```

## Team Goals and Collaboration

### Creating Team Goals

Team goals enable collaborative progress tracking across all team members.

```bash
# Create team goal (leader/deputy only)
curl -X POST http://localhost:3001/api/teams/team-123/goals \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Daily Exercise Challenge",
    "description": "Complete 30 minutes of exercise daily",
    "targetValue": 30,
    "unit": "minutes",
    "startDate": "2026-01-10",
    "endDate": "2026-02-10"
  }'
```

### Goal Progress Tracking

#### Individual Progress Updates
```bash
# Update own progress
curl -X PUT http://localhost:3001/api/teams/team-123/goals/goal-456/progress/user-123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentValue": 25
  }'
```

#### Leader/Deputy Progress Management
Leaders and deputies can update progress for any team member:

```bash
# Update member progress (leader/deputy only)
curl -X PUT http://localhost:3001/api/teams/team-123/goals/goal-456/progress/user-789 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentValue": 30
  }'
```

### Goal Management

#### Updating Goals
```bash
# Update team goal (leader/deputy only)
curl -X PUT http://localhost:3001/api/teams/team-123/goals/goal-456 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Exercise Challenge",
    "targetValue": 45,
    "endDate": "2026-02-15"
  }'
```

#### Deactivating Goals
```bash
# Delete/deactivate goal (leader only)
curl -X DELETE http://localhost:3001/api/teams/team-123/goals/goal-456 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Leaderboards and Competition

### Team Leaderboard Features

The leaderboard system provides competitive elements to motivate team members:

#### Leaderboard Components
- **Member Rankings**: Based on average goal completion percentage
- **Achievement Badges**: Earned through various accomplishments
- **Real-time Updates**: Live updates when progress is made
- **Filtering Options**: View by time period (day, week, month, custom)

#### Achievement System

The system automatically awards badges based on performance:

```typescript
interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: 'gold' | 'silver' | 'bronze' | 'blue';
}
```

**Available Achievements:**
- 🏆 **Perfect Score**: Achieved 100% completion on a goal
- ⭐ **Consistent Performer**: Maintained 80%+ completion across all goals
- 🥇 **Top Performer**: Achieved 90%+ average completion
- 🥈 **High Performer**: Achieved 75%+ average completion
- 🥉 **Good Performer**: Achieved 60%+ average completion

### Accessing Leaderboards

#### Basic Leaderboard
```bash
# Get team leaderboard
curl -X GET http://localhost:3001/api/teams/team-123/leaderboard \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Filtered Leaderboard
```bash
# Get weekly leaderboard
curl -X GET "http://localhost:3001/api/teams/team-123/leaderboard?period=week" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get custom date range
curl -X GET "http://localhost:3001/api/teams/team-123/leaderboard?period=custom&startDate=2026-01-01&endDate=2026-01-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Response:
```json
{
  "teamId": "team-123",
  "period": "week",
  "leaderboard": [
    {
      "userId": "user-123",
      "name": "John Doe",
      "role": "leader",
      "totalPercentage": 95.5,
      "rank": 1,
      "achievements": [
        {
          "id": "top_performer",
          "title": "Top Performer",
          "icon": "🥇",
          "color": "gold"
        }
      ],
      "goalProgress": [...]
    }
  ],
  "summary": {
    "totalMembers": 15,
    "averageCompletion": 78.3,
    "topPerformer": {...},
    "totalGoals": 5,
    "activeGoals": 5
  }
}
```

### Real-time Leaderboard Updates

The system provides real-time leaderboard updates using WebSocket connections:

```bash
# Get live leaderboard (WebSocket endpoint)
curl -X GET http://localhost:3001/api/realtime/teams/team-123/leaderboard/live \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Team Analytics

### Comprehensive Analytics Dashboard

Team analytics provide detailed insights into team performance, member engagement, and goal progress.

#### Analytics Features
- **Team Performance Metrics**: Average KPI, total hours, completion rates
- **Member Performance Analysis**: Individual rankings and consistency scores
- **Goal Progress Tracking**: Completion trends and insights
- **Engagement Metrics**: Member activity and participation levels
- **Activity Trends**: Historical performance data

### Accessing Team Analytics

```bash
# Get team analytics (leader/deputy only)
curl -X GET "http://localhost:3001/api/teams/team-123/analytics?startDate=2026-01-01&endDate=2026-01-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Analytics Data Export

Teams can export their data in multiple formats:

#### JSON Export
```bash
# Export team data as JSON
curl -X POST http://localhost:3001/api/teams/team-123/export \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "json",
    "startDate": "2026-01-01",
    "endDate": "2026-01-31"
  }'
```

#### CSV Export
```bash
# Export team data as CSV
curl -X POST http://localhost:3001/api/teams/team-123/export \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "csv",
    "startDate": "2026-01-01",
    "endDate": "2026-01-31"
  }'
```

### Analytics Insights

The system automatically generates insights based on team data:

- **Performance Gaps**: Identifies large differences between top and bottom performers
- **Goal Completion Warnings**: Alerts for goals with approaching deadlines and low completion
- **Team Momentum**: Tracks improving or declining performance trends
- **Engagement Alerts**: Identifies inactive or disengaged members

## Invitation System

### Team Invitation Workflows

The team invitation system supports multiple invitation methods with comprehensive validation.

#### Invitation Types
1. **Direct Invite Code**: Share team invite code for immediate joining
2. **Email Invitations**: Send personalized email invitations
3. **Public Team Discovery**: Allow users to find and join public teams

### Invitation Management

#### Creating Invitations
```bash
# Send email invitation
curl -X POST http://localhost:3001/api/teams/team-123/invite \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "candidate@example.com",
    "message": "Join our productivity team and achieve your goals together!"
  }'
```

#### Validating Invitations
```bash
# Validate invitation code
curl -X GET http://localhost:3001/api/invitations/teams/validate/TEAM-ABC123
```

#### Processing Invitations
```bash
# Accept team invitation
curl -X POST http://localhost:3001/api/invitations/teams/accept \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "inviteCode": "TEAM-ABC123"
  }'
```

### Invitation Validation Rules

The system enforces several validation rules:

1. **Team Capacity**: Cannot exceed maximum member limit
2. **Existing Membership**: Users cannot join teams they're already in
3. **Invitation Expiry**: Invitations expire after 7 days
4. **Permission Validation**: Only leaders and deputies can send invitations
5. **Email Validation**: Email addresses must be valid format

## Moderation Tools

### Team Moderation Dashboard

Leaders and deputies have access to comprehensive moderation tools for managing team behavior and content.

#### Accessing Moderation Dashboard
```bash
# Get moderation dashboard (leader/deputy only)
curl -X GET http://localhost:3001/api/teams/team-123/moderation \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Response:
```json
{
  "data": {
    "team": {
      "id": "team-123",
      "name": "Productivity Champions",
      "totalMembers": 15,
      "activeGoals": 5,
      "recentJoins": 3,
      "averagePerformance": 78.5
    },
    "members": [
      {
        "id": "member-1",
        "userId": "user-123",
        "name": "John Doe",
        "email": "john@example.com",
        "role": "leader",
        "joinedAt": "2026-01-01T10:00:00.000Z",
        "isActive": true
      }
    ],
    "permissions": {
      "canModerateContent": true,
      "canRemoveMembers": true,
      "canAssignRoles": true
    }
  }
}
```

### Moderation Actions

#### Warning Members
```bash
# Issue warning to member
curl -X POST http://localhost:3001/api/teams/team-123/moderate/member-456 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "warn",
    "reason": "Inappropriate behavior in team discussions"
  }'
```

#### Removing Members
```bash
# Remove member for moderation reasons
curl -X POST http://localhost:3001/api/teams/team-123/moderate/member-456 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "remove",
    "reason": "Repeated violations of team guidelines"
  }'
```

### Moderation Logging

All moderation actions are automatically logged for audit purposes:

```typescript
interface ModerationLog {
  id: string;
  teamId: string;
  moderatorId: string;
  targetUserId?: string;
  action: string;
  reason?: string;
  metadata?: any;
  timestamp: Date;
}
```

## API Endpoints

### Team Management Endpoints

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/teams` | Get user's teams | Any user |
| POST | `/api/teams` | Create new team | Any user |
| GET | `/api/teams/:teamId` | Get team details | Team member |
| PUT | `/api/teams/:teamId` | Update team settings | Leader |
| POST | `/api/teams/join/:inviteCode` | Join team by code | Any user |

### Member Management Endpoints

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| PUT | `/api/teams/:teamId/members/:memberId/role` | Change member role | Leader/Deputy |
| DELETE | `/api/teams/:teamId/members/:memberId` | Remove member | Leader/Deputy |
| POST | `/api/teams/:teamId/leave` | Leave team | Team member |
| GET | `/api/teams/:teamId/permissions` | Get user permissions | Team member |

### Goal Management Endpoints

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| POST | `/api/teams/:teamId/goals` | Create team goal | Leader/Deputy |
| PUT | `/api/teams/:teamId/goals/:goalId` | Update team goal | Leader/Deputy |
| DELETE | `/api/teams/:teamId/goals/:goalId` | Delete team goal | Leader |
| PUT | `/api/teams/:teamId/goals/:goalId/progress/:userId` | Update progress | Leader/Deputy/Self |

### Analytics and Leaderboard Endpoints

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/teams/:teamId/leaderboard` | Get team leaderboard | Team member |
| GET | `/api/teams/:teamId/analytics` | Get team analytics | Leader/Deputy |
| POST | `/api/teams/:teamId/export` | Export team data | Leader/Deputy |
| GET | `/api/realtime/teams/:teamId/leaderboard/live` | Live leaderboard | Team member |

### Moderation Endpoints

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/teams/:teamId/moderation` | Get moderation dashboard | Leader/Deputy |
| POST | `/api/teams/:teamId/moderate/:memberId` | Moderate member | Leader/Deputy |

## Real-time Features

### WebSocket Integration

The team system integrates with WebSocket for real-time updates:

#### Real-time Events
- **Progress Updates**: Live progress updates on team goals
- **Leaderboard Changes**: Real-time leaderboard position updates
- **Member Activity**: Online/offline status updates
- **Goal Completion**: Instant notifications for goal achievements
- **Team Notifications**: Real-time team announcements

#### WebSocket Event Types
```typescript
interface TeamWebSocketEvents {
  'team:progress_update': {
    teamId: string;
    goalId: string;
    userId: string;
    newProgress: number;
    leaderboardUpdate: any;
  };
  
  'team:member_joined': {
    teamId: string;
    newMember: TeamMember;
  };
  
  'team:goal_completed': {
    teamId: string;
    goalId: string;
    userId: string;
    achievement: Achievement;
  };
}
```

### Real-time Notifications

Team members receive real-time notifications for:
- New team goals created
- Goal progress updates from teammates
- Leaderboard position changes
- Team achievements and milestones
- Member joins and leaves
- Role changes and promotions

## Best Practices

### Team Setup Best Practices

1. **Clear Team Purpose**: Define clear team objectives and goals
2. **Appropriate Size**: Keep teams between 5-20 members for optimal engagement
3. **Role Distribution**: Have 1-2 leaders and 2-3 deputies for larger teams
4. **Goal Setting**: Create specific, measurable, achievable team goals
5. **Regular Check-ins**: Schedule regular team progress reviews

### Member Management Best Practices

1. **Onboarding Process**: Provide clear onboarding for new team members
2. **Role Clarity**: Ensure all members understand their roles and permissions
3. **Progressive Responsibility**: Promote active members to deputy roles
4. **Fair Moderation**: Apply moderation consistently and fairly
5. **Recognition**: Acknowledge top performers and achievements

### Goal Management Best Practices

1. **SMART Goals**: Create Specific, Measurable, Achievable, Relevant, Time-bound goals
2. **Balanced Difficulty**: Mix easy wins with challenging stretch goals
3. **Regular Updates**: Encourage frequent progress updates
4. **Collaborative Goals**: Design goals that require team collaboration
5. **Celebration**: Celebrate goal completions and milestones

### Analytics and Monitoring Best Practices

1. **Regular Reviews**: Conduct weekly/monthly team performance reviews
2. **Trend Analysis**: Monitor long-term trends rather than daily fluctuations
3. **Individual Support**: Identify and support struggling team members
4. **Data-Driven Decisions**: Use analytics to inform team strategy
5. **Privacy Respect**: Respect member privacy while maintaining transparency

### Security and Privacy Best Practices

1. **Permission Audits**: Regularly review and audit team permissions
2. **Invitation Security**: Use secure invitation codes and email validation
3. **Data Protection**: Protect sensitive team and member data
4. **Moderation Guidelines**: Establish clear moderation guidelines
5. **Access Logging**: Monitor and log all administrative actions

## Troubleshooting

### Common Issues and Solutions

#### Team Creation Issues
- **Error**: "Team name already exists"
  - **Solution**: Choose a unique team name
- **Error**: "Invalid member limit"
  - **Solution**: Set maxMembers between 1-99

#### Permission Issues
- **Error**: "Insufficient permissions"
  - **Solution**: Verify user role and required permissions
- **Error**: "Cannot remove last leader"
  - **Solution**: Assign another leader before leaving

#### Goal Management Issues
- **Error**: "Goal not found"
  - **Solution**: Verify goal ID and team membership
- **Error**: "Cannot update progress"
  - **Solution**: Check if user has permission to update specific member's progress

#### Invitation Issues
- **Error**: "Team at capacity"
  - **Solution**: Increase team size limit or remove inactive members
- **Error**: "Invitation expired"
  - **Solution**: Generate new invitation code

### Performance Optimization

1. **Pagination**: Use pagination for large team member lists
2. **Caching**: Cache frequently accessed team data
3. **Batch Operations**: Batch multiple goal progress updates
4. **Lazy Loading**: Load team analytics data on demand
5. **Connection Pooling**: Optimize database connections for team queries

This comprehensive documentation provides all the necessary information for implementing, managing, and troubleshooting team management features in the KPI Productivity application.