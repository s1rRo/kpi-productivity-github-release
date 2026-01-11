-- Create habit_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS habit_history (
    id TEXT PRIMARY KEY,
    habitId TEXT NOT NULL,
    action TEXT NOT NULL,
    changes TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (habitId) REFERENCES habits (id) ON DELETE CASCADE
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_habit_history_habitId ON habit_history(habitId);
CREATE INDEX IF NOT EXISTS idx_habit_history_createdAt ON habit_history(createdAt);