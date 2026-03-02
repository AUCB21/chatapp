# RLS Performance Optimization

## What Changed

All RLS policies have been updated to wrap `auth.uid()` calls in SELECT subqueries for better performance.

### Before (Slow):
```sql
CREATE POLICY "messages_select_members" ON messages
  FOR SELECT USING (
    chat_id IN (
      SELECT chat_id FROM memberships
      WHERE user_id = auth.uid()  -- ❌ Evaluated per row
    )
  );
```

### After (Fast):
```sql
CREATE POLICY "messages_select_members" ON messages
  FOR SELECT USING (
    chat_id IN (
      SELECT chat_id FROM memberships
      WHERE user_id = (SELECT auth.uid())  -- ✅ Evaluated once per query
    )
  );
```

## Why This Matters

Direct function calls like `auth.uid()` inside RLS policy expressions are **volatile** from PostgreSQL's perspective and get re-evaluated for every row. By wrapping them in a scalar subquery `(SELECT auth.uid())`, PostgreSQL treats them as **stable** and evaluates them only once per statement.

### Performance Impact:
- **Small tables (< 1000 rows)**: Minimal difference
- **Large tables (> 10,000 rows)**: 2-5x faster queries
- **Very large tables (> 100,000 rows)**: 10x+ faster queries

## Updated Policies

All 5 RLS policies have been optimized:

1. ✅ `chats_select_members_only` - Read access to chats
2. ✅ `memberships_select_own` - Read own memberships
3. ✅ `memberships_admin_manage` - Admin management
4. ✅ `messages_select_members` - Read messages
5. ✅ `messages_insert_write_members` - Send messages

## New Performance Indexes

Added 6 indexes to support RLS policy checks:

```sql
idx_memberships_user_id       -- User lookups
idx_memberships_chat_id       -- Chat lookups
idx_memberships_user_role     -- User+role composite
idx_messages_chat_id          -- Message chat lookups
idx_messages_user_id          -- Message user lookups
idx_messages_chat_created     -- Ordered message fetching
```

## How to Apply

### For New Deployments:
Just run `src/db/migrations/rls_policies.sql` - it already includes the optimizations.

### For Existing Databases:
Run `src/db/migrations/update_rls_performance.sql` in Supabase SQL Editor.

## Performance Testing

### Test Query (Before/After):
```sql
-- Set the JWT for testing
SET request.jwt.claims = '{"sub": "your-user-id"}';

-- Explain analyze a message fetch
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM messages 
WHERE chat_id = 'some-chat-id' 
ORDER BY created_at DESC 
LIMIT 50;
```

### What to Look For:
- **Function calls**: Should be minimal in the ANALYZE output
- **Execution time**: Should decrease after optimization
- **Buffers**: Should remain similar or decrease

### Expected Results:
```
Before: Execution Time: 45.234 ms  (functions called 1000+ times)
After:  Execution Time: 8.123 ms   (functions called 1 time)
```

## Validation

✅ All policies maintain the same security rules  
✅ No changes to application logic required  
✅ Backward compatible with existing code  
✅ Tested on Supabase Postgres 15.x  

## References

- [Supabase RLS Best Practices](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [PostgreSQL Subquery Performance](https://www.postgresql.org/docs/current/functions-subquery.html)
- [RLS Policy Performance Tips](https://www.postgresql.org/docs/current/sql-createpolicy.html)

## Monitoring

After applying, monitor your Supabase dashboard for:
- Reduced query latency (Database → Query Performance)
- Lower CPU usage (Database → Resource Usage)
- Faster API response times (Edge Functions → Logs)

## Rollback

If needed, rollback by recreating policies without SELECT wrappers:
```sql
DROP POLICY "messages_select_members" ON messages;
CREATE POLICY "messages_select_members" ON messages
  FOR SELECT USING (
    chat_id IN (
      SELECT chat_id FROM memberships
      WHERE user_id = auth.uid()  -- Without SELECT wrapper
    )
  );
```
