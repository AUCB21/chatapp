# chat-app

Global chat application built with Next.js, Supabase, Drizzle ORM, and Zustand.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Auth | Supabase Auth |
| Database | Supabase (Postgres) |
| ORM | Drizzle |
| Realtime | Supabase Realtime |
| State | Zustand |
| Validation | Zod |

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   └── logout/route.ts
│   │   └── chat/
│   │       ├── route.ts
│   │       └── [chatId]/
│   │           ├── route.ts
│   │           ├── messages/route.ts
│   │           └── members/route.ts
├── db/
│   ├── index.ts
│   ├── schema.ts
│   ├── migrations/
│   │   └── rls_policies.sql
│   └── queries/
│       ├── chats.ts
│       ├── memberships.ts
│       └── messages.ts
├── hooks/
│   └── useChat.ts
├── lib/
│   ├── apiResponse.ts
│   ├── supabaseClient.ts
│   ├── supabaseServer.ts
│   └── validation.ts
├── store/
│   ├── chatStore.ts
│   └── sessionStore.ts
└── middleware.ts
```

## Security Layers

Every request passes through 4 independent gates:

```
Request → middleware (edge session check)
        → API route (auth + role check)
        → DB query (membership check)
        → RLS (Postgres, final gate)
```

## Permission Model

| Role | Read messages | Send messages | Manage members |
|---|---|---|---|
| read | ✅ | ❌ | ❌ |
| write | ✅ | ✅ | ❌ |
| admin | ✅ | ✅ | ✅ |

## Setup

1. Copy `.env.example` to `.env.local` and fill in Supabase credentials
2. Run Drizzle migrations: `npm run db:migrate`
3. Run RLS policies manually in Supabase SQL editor: `src/db/migrations/rls_policies.sql`
4. Start dev server: `npm run dev`

## Notes

- Passwords are managed entirely by Supabase Auth — never stored in application tables
- Prefer `SUPABASE_URL` and `SUPABASE_ANON_KEY` for server/middleware config; keep `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for browser client usage
- `DATABASE_URL` uses Supabase pooler (port 6543) for runtime
- `DATABASE_URL_DIRECT` uses direct connection (port 5432) for migrations only
- Realtime subscriptions are RLS-filtered server-side before delivery
