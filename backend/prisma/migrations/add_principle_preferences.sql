-- Add principle preferences table
CREATE TABLE IF NOT EXISTS principle_preferences (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  principle_id TEXT NOT NULL,
  applied BOOLEAN DEFAULT FALSE,
  applied_to_habits TEXT DEFAULT '[]', -- JSON array of habit IDs
  usage_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, principle_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_principle_preferences_user_id ON principle_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_principle_preferences_principle_id ON principle_preferences(principle_id);