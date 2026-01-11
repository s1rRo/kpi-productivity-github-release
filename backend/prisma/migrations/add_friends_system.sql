-- Add friends system tables and update users table

-- Add new columns to users table (without UNIQUE constraint initially)
ALTER TABLE users ADD COLUMN inviteCode TEXT;
ALTER TABLE users ADD COLUMN privacySettings TEXT DEFAULT '{"showProgress":true,"showGoals":true,"showAchievements":true}';

-- Update existing users with unique invite codes
UPDATE users SET inviteCode = lower(hex(randomblob(8))) WHERE inviteCode IS NULL;

-- Now add the unique constraint
CREATE UNIQUE INDEX idx_users_invite_code ON users(inviteCode);

-- Create friend_requests table
CREATE TABLE friend_requests (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    senderId TEXT NOT NULL,
    receiverId TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    message TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiverId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(senderId, receiverId)
);

-- Create friendships table
CREATE TABLE friendships (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user1Id TEXT NOT NULL,
    user2Id TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user1Id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user2Id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user1Id, user2Id)
);

-- Create friend_invites table
CREATE TABLE friend_invites (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    senderId TEXT NOT NULL,
    email TEXT NOT NULL,
    inviteCode TEXT UNIQUE DEFAULT (lower(hex(randomblob(8)))),
    status TEXT DEFAULT 'pending',
    message TEXT,
    expiresAt DATETIME NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE
);

-- Create support_messages table
CREATE TABLE support_messages (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    senderId TEXT NOT NULL,
    receiverId TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'support',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    readAt DATETIME
);

-- Create indexes for better performance
CREATE INDEX idx_friend_requests_receiver ON friend_requests(receiverId);
CREATE INDEX idx_friend_requests_sender ON friend_requests(senderId);
CREATE INDEX idx_friendships_user1 ON friendships(user1Id);
CREATE INDEX idx_friendships_user2 ON friendships(user2Id);
CREATE INDEX idx_friend_invites_email ON friend_invites(email);
CREATE INDEX idx_friend_invites_code ON friend_invites(inviteCode);
CREATE INDEX idx_support_messages_receiver ON support_messages(receiverId);