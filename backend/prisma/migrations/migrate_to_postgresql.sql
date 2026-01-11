-- Migration from SQLite to PostgreSQL
-- This migration creates all tables for PostgreSQL production environment

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    invite_code VARCHAR(50) UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
    privacy_settings JSONB DEFAULT '{"showProgress":true,"showGoals":true,"showAchievements":true}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create habits table
CREATE TABLE IF NOT EXISTS habits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    target_minutes INTEGER NOT NULL,
    category VARCHAR(50),
    skill_level INTEGER DEFAULT 3,
    eisenhower_quadrant VARCHAR(2),
    is_weekday_only BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create daily_records table
CREATE TABLE IF NOT EXISTS daily_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    date DATE NOT NULL,
    total_kpi DECIMAL(5,2),
    exception_type VARCHAR(50),
    exception_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, date)
);

-- Create habit_records table
CREATE TABLE IF NOT EXISTS habit_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    daily_record_id UUID NOT NULL,
    habit_id UUID NOT NULL,
    actual_minutes INTEGER NOT NULL,
    quality_score INTEGER CHECK (quality_score BETWEEN 1 AND 5),
    efficiency_coefficients JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (daily_record_id) REFERENCES daily_records(id) ON DELETE CASCADE,
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    daily_record_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    priority VARCHAR(10) NOT NULL,
    completed BOOLEAN DEFAULT false,
    estimated_minutes INTEGER,
    actual_minutes INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (daily_record_id) REFERENCES daily_records(id) ON DELETE CASCADE
);

-- Create skill_tests table
CREATE TABLE IF NOT EXISTS skill_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    habit_id UUID NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    test_type VARCHAR(10) NOT NULL,
    skill_level INTEGER NOT NULL,
    test_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
    UNIQUE(user_id, habit_id, month, year, test_type)
);

-- Create skill_progress table
CREATE TABLE IF NOT EXISTS skill_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    habit_id UUID NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    start_level INTEGER NOT NULL,
    end_level INTEGER NOT NULL,
    delta_percentage DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
    UNIQUE(user_id, habit_id, month, year)
);

-- Create habit_history table
CREATE TABLE IF NOT EXISTS habit_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    habit_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,
    changes JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
);

-- Create goals table
CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    progress INTEGER DEFAULT 0,
    position_x DECIMAL(10,2) DEFAULT 0,
    position_y DECIMAL(10,2) DEFAULT 0,
    color VARCHAR(7) DEFAULT '#3B82F6',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create goal_connections table
CREATE TABLE IF NOT EXISTS goal_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_goal_id UUID NOT NULL,
    to_goal_id UUID NOT NULL,
    connection_type VARCHAR(20) DEFAULT 'depends_on',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_goal_id) REFERENCES goals(id) ON DELETE CASCADE,
    FOREIGN KEY (to_goal_id) REFERENCES goals(id) ON DELETE CASCADE,
    UNIQUE(from_goal_id, to_goal_id)
);

-- Create goal_habits table
CREATE TABLE IF NOT EXISTS goal_habits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    goal_id UUID NOT NULL,
    habit_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
    UNIQUE(goal_id, habit_id)
);

-- Create friend_requests table
CREATE TABLE IF NOT EXISTS friend_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(sender_id, receiver_id)
);

-- Create friendships table
CREATE TABLE IF NOT EXISTS friendships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user1_id UUID NOT NULL,
    user2_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user1_id, user2_id)
);

-- Create friend_invites table
CREATE TABLE IF NOT EXISTS friend_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    invite_code VARCHAR(50) UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
    status VARCHAR(20) DEFAULT 'pending',
    message TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create support_messages table
CREATE TABLE IF NOT EXISTS support_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'support',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    avatar VARCHAR(255),
    invite_code VARCHAR(50) UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
    max_members INTEGER DEFAULT 99,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role VARCHAR(20) DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(team_id, user_id)
);

-- Create team_goals table
CREATE TABLE IF NOT EXISTS team_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    target_value INTEGER NOT NULL,
    unit VARCHAR(20) DEFAULT 'points',
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- Create team_goal_progress table
CREATE TABLE IF NOT EXISTS team_goal_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_goal_id UUID NOT NULL,
    user_id UUID NOT NULL,
    current_value INTEGER DEFAULT 0,
    percentage DECIMAL(5,2) DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_goal_id) REFERENCES team_goals(id) ON DELETE CASCADE,
    UNIQUE(team_goal_id, user_id)
);

-- Create team_invites table
CREATE TABLE IF NOT EXISTS team_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    email VARCHAR(255),
    invite_code VARCHAR(50) UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
    status VARCHAR(20) DEFAULT 'pending',
    message TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- Create principle_preferences table
CREATE TABLE IF NOT EXISTS principle_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    principle_id VARCHAR(50) NOT NULL,
    applied BOOLEAN DEFAULT false,
    applied_to_habits JSONB DEFAULT '[]',
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, principle_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_daily_records_user_date ON daily_records(user_id, date);
CREATE INDEX IF NOT EXISTS idx_habit_records_daily_record ON habit_records(daily_record_id);
CREATE INDEX IF NOT EXISTS idx_habit_records_habit ON habit_records(habit_id);
CREATE INDEX IF NOT EXISTS idx_tasks_daily_record ON tasks(daily_record_id);
CREATE INDEX IF NOT EXISTS idx_skill_tests_user_habit ON skill_tests(user_id, habit_id);
CREATE INDEX IF NOT EXISTS idx_skill_progress_user_habit ON skill_progress(user_id, habit_id);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_connections_from ON goal_connections(from_goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_connections_to ON goal_connections(to_goal_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user1 ON friendships(user1_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user2 ON friendships(user2_id);
CREATE INDEX IF NOT EXISTS idx_friend_invites_email ON friend_invites(email);
CREATE INDEX IF NOT EXISTS idx_friend_invites_code ON friend_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_support_messages_receiver ON support_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_goals_team ON team_goals(team_id);
CREATE INDEX IF NOT EXISTS idx_team_goal_progress_goal ON team_goal_progress(team_goal_id);
CREATE INDEX IF NOT EXISTS idx_team_goal_progress_user ON team_goal_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_team ON team_invites(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_code ON team_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_principle_preferences_user ON principle_preferences(user_id);