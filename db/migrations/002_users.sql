CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    platform TEXT NOT NULL,
    platform_user_id TEXT NOT NULL,
    username TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT users_platform_unique UNIQUE (platform, platform_user_id)
);
