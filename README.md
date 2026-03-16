# EPS Chat App

A real-time messaging app with voice calling, screen sharing, and rich presence — built on Next.js and Supabase.

## Features

- **Real-time messaging** — instant delivery with typing indicators and online presence
- **Rich messages** — markdown support (links, inline code, code blocks), reactions, replies, edit & delete
- **Voice calls** — per-chat audio calls with mute controls, speaking indicators, and a floating PIP when minimized
- **Screen sharing** — share your screen during active calls
- **Invitations** — invite by email or generate a shareable link
- **Contacts** — manage contacts, block/mute users
- **Starred & pinned messages** — bookmark important messages, pin them for the whole chat
- **Full-text search** — search across messages with highlighted snippets and jump-to-message
- **Role-based access** — read, write, and admin roles per chat
- **Dark mode** — system-aware theme via `next-themes`

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (Turbopack) |
| Language | TypeScript 5.6 |
| UI | React 18, TailwindCSS 4, shadcn/ui, Radix UI |
| State | Zustand 5 |
| Auth & Realtime | Supabase (SSR, Realtime, Storage) |
| Database | PostgreSQL via Drizzle ORM |
| Validation | Zod |

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project with a PostgreSQL database

### Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd chat-app
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in your Supabase URL, anon key, and database URLs

# 3. Run migrations
npm run db:migrate

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Pooled connection URL (port 6543) — used at runtime |
| `DATABASE_URL_DIRECT` | Direct connection URL (port 5432) — used for migrations |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_URL` | Same as above, server-only alias |
| `SUPABASE_ANON_KEY` | Same as above, server-only alias |

Find your Supabase keys at: **Dashboard → Project Settings → API**

## Project Structure

```
src/
├── app/               # Next.js pages and API routes
│   ├── api/           # REST endpoints (auth, chats, messages, calls, invites, contacts)
│   └── (auth)/        # Auth pages (login, register)
├── components/        # React components (chat UI, call modal, voice controls, screen share)
├── store/             # Zustand stores (chat, profile, session)
├── hooks/             # Custom React hooks
├── db/
│   ├── schema.ts      # Drizzle table definitions
│   ├── migrations/    # SQL migration files
│   └── queries/       # Database query functions
└── lib/               # Utilities and helpers
```

## Database

Schema includes 15+ tables: `user_profiles`, `chats`, `memberships`, `messages`, `reactions`, `call_sessions`, `attachments`, `invitations`, and more — all with Row-Level Security (RLS) policies enforced via Supabase.

```bash
npm run db:generate   # Generate a new migration from schema changes
npm run db:migrate    # Apply pending migrations
npm run db:studio     # Open Drizzle Studio to browse the database
```