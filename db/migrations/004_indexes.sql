CREATE INDEX IF NOT EXISTS idx_users_platform
    ON users(platform);

CREATE INDEX IF NOT EXISTS idx_messages_user_id
    ON messages(user_id);
