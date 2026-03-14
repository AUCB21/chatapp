-- Create a restricted app_server role for production use.
-- This role has DML-only permissions (no DDL, no SUPERUSER, no BYPASSRLS).
-- Reduces blast radius if DATABASE_URL leaks.
--
-- After running this migration:
-- 1. Create a Supabase database user with this role
-- 2. Update DATABASE_URL to use the new user credentials
-- 3. The app connects via connection pooler (port 6543)

-- Create role if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_server') THEN
    CREATE ROLE app_server NOLOGIN;
  END IF;
END $$;

-- Grant usage on the public schema
GRANT USAGE ON SCHEMA public TO app_server;

-- Grant DML-only on all existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_server;

-- Ensure future tables also get DML grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_server;

-- Grant usage on sequences (needed for serial/identity columns)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_server;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO app_server;

-- Allow reading auth.users (needed for JOIN queries)
GRANT USAGE ON SCHEMA auth TO app_server;
GRANT SELECT ON auth.users TO app_server;

-- Create a login user that inherits app_server
-- ⚠️ Change 'CHANGE_ME_STRONG_PASSWORD' to a real password before running!
-- DO $$ BEGIN
--   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_server_user') THEN
--     CREATE ROLE app_server_user LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD' IN ROLE app_server;
--   END IF;
-- END $$;
