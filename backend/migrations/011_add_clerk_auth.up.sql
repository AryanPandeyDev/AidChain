-- Add clerk_id column and make password_hash optional (Clerk handles auth now).
ALTER TABLE users ADD COLUMN clerk_id VARCHAR(255) UNIQUE;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
CREATE INDEX idx_users_clerk_id ON users(clerk_id);
