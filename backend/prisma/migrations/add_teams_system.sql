-- Add Teams System Migration
-- This migration adds the team system with roles and goals

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    avatar TEXT,
    inviteCode TEXT UNIQUE NOT NULL,
    maxMembers INTEGER DEFAULT 99,
    isPublic BOOLEAN DEFAULT FALSE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    teamId TEXT NOT NULL,
    userId TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    isActive BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(teamId, userId)
);

-- Create team_goals table
CREATE TABLE IF NOT EXISTS team_goals (
    id TEXT PRIMARY KEY,
    teamId TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    targetValue INTEGER NOT NULL,
    unit TEXT DEFAULT 'points',
    startDate DATETIME NOT NULL,
    endDate DATETIME NOT NULL,
    isActive BOOLEAN DEFAULT TRUE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE
);

-- Create team_goal_progress table
CREATE TABLE IF NOT EXISTS team_goal_progress (
    id TEXT PRIMARY KEY,
    teamGoalId TEXT NOT NULL,
    userId TEXT NOT NULL,
    currentValue INTEGER DEFAULT 0,
    percentage REAL DEFAULT 0,
    lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teamGoalId) REFERENCES team_goals(id) ON DELETE CASCADE,
    UNIQUE(teamGoalId, userId)
);

-- Create team_invites table
CREATE TABLE IF NOT EXISTS team_invites (
    id TEXT PRIMARY KEY,
    teamId TEXT NOT NULL,
    senderId TEXT NOT NULL,
    email TEXT,
    inviteCode TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending',
    message TEXT,
    expiresAt DATETIME NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(teamId);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(userId);
CREATE INDEX IF NOT EXISTS idx_team_goals_team ON team_goals(teamId);
CREATE INDEX IF NOT EXISTS idx_team_goal_progress_goal ON team_goal_progress(teamGoalId);
CREATE INDEX IF NOT EXISTS idx_team_goal_progress_user ON team_goal_progress(userId);
CREATE INDEX IF NOT EXISTS idx_team_invites_team ON team_invites(teamId);
CREATE INDEX IF NOT EXISTS idx_team_invites_code ON team_invites(inviteCode);