# Deployment Guide

## Required Environment Variables

Make sure these are set in your Vercel project settings:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://[your-project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_URL=https://[your-project-ref].supabase.co
SUPABASE_ANON_KEY=eyJhbGci...

# Database Connection (Pooler - Port 6543)
DATABASE_URL=postgresql://postgres:[password]@[project-ref].pooler.supabase.com:6543/postgres

# Database Direct Connection (Port 5432) - for migrations only
DATABASE_URL_DIRECT=postgresql://postgres:[password]@[project-ref].pooler.supabase.com:5432/postgres
```

## Pre-Deployment Checklist

### 1. Run Database Migrations

Before deploying, ensure your database is migrated:

```bash
npm run db:migrate
```

### 2. Apply RLS Policies

Manually run the RLS policies in Supabase SQL Editor:
- Open `src/db/migrations/rls_policies.sql`
- Copy contents
- Paste into Supabase SQL Editor
- Execute

**Important**: If you've already applied RLS policies before, run the performance update:
- Open `src/db/migrations/update_rls_performance.sql`
- Copy contents
- Paste into Supabase SQL Editor
- Execute

This update wraps `auth.uid()` calls in SELECT subqueries to prevent per-row re-evaluation, significantly improving query performance on large tables.

### 3. Verify Database Tables

Check that these tables exist in Supabase:
- `users`
- `chats`
- `memberships`
- `messages`  
- `invitations`

## Troubleshooting 500 Errors

If you're getting 500 errors after deployment, check:

### 1. Check Vercel Logs

Go to Vercel Dashboard → Your Project → Deployments → [Latest] → Function Logs

Look for error messages printed by the API routes.

### 2. Common Causes

#### Missing Environment Variables
**Error**: `DATABASE_URL environment variable is not set`
**Fix**: Add `DATABASE_URL` in Vercel project settings

#### Database Connection Failed
**Error**: Connection timeouts or "connection refused"
**Fix**: 
- Verify DATABASE_URL uses the pooler (port 6543)
- Check Supabase project is active
- Verify password is correct

#### Tables Don't Exist
**Error**: `relation "chats" does not exist`
**Fix**: Run migrations: `npm run db:migrate`

#### RLS Blocking Access
**Error**: `permission denied for table...` or empty results
**Fix**: Apply RLS policies from `src/db/migrations/rls_policies.sql`

#### Missing Supabase Keys
**Error**: `Missing Supabase environment variables`
**Fix**: Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` (plus `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for browser client) in Vercel

### 3. Test Locally First

Before deploying, test locally:

```bash
npm run build
npm run start
```

If it works locally but fails on Vercel, it's an environment configuration issue.

### 4. Enable Debug Logging

All API routes now log errors to console. Check Vercel function logs for details:

```
[API Error] Error: relation "chats" does not exist
Stack: ...
```

## DNS and Custom Domains

If using a custom domain:
1. Add domain in Vercel project settings
2. Configure DNS records as shown
3. Wait for SSL certificate provisioning (5-10 minutes)

## Deployment Steps

### Via Git (Recommended)

1. Commit changes:
   ```bash
   git add .
   git commit -m "Your message"
   git push
   ```

2. Vercel auto-deploys on push

### Via Vercel CLI

```bash
npm install -g vercel
vercel --prod
```

## Post-Deployment

1. Visit your deployed URL
2. Try registering a new account
3. Check if login works
4. Create a test chat
5. Send a test message

If any step fails, check Vercel function logs for the specific error.
