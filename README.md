# EPS Chat App

Real-time chat application built with Next.js 15, Supabase, Drizzle ORM, and Zustand.

It supports:

- Auth with Supabase
- Real-time chat updates with Supabase Realtime
- Role-based chat access
- Voice calls and screen sharing
- Message reactions, replies, edit/delete flows
- Direct 1-to-1 invitations and shareable invite links

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 15 App Router |
| Auth | Supabase Auth |
| Database | Supabase Postgres |
| ORM | Drizzle ORM |
| Realtime | Supabase Realtime |
| State | Zustand |
| Validation | Zod |
| UI | shadcn/ui + Tailwind |

## Main Flows

### Chat creation

- Create a chat without an email to generate a shareable invite link.
- Create a chat with an email to send a direct pending invite.
- If the invited user is already in-app, they receive an immediate accept or decline prompt.

### Invitations

- Direct invite: recipient sees the chat as `pending` and can accept or decline.
- Link invite: creator gets an `/invite/[token]` URL to share.
- Token invite page validates the token and joins the user to the chat on acceptance.

### Calls and sharing

- Per-chat voice calling
- Per-chat screen sharing during active calls
- Realtime state synchronization via Supabase channels

## Project Layout

```text
src/
        app/
                api/
                        auth/
                        chat/
                        invite/
                invite/[token]/
                login/
                register/
                layout.tsx
                page.tsx
        components/
                chat/
                ui/
                CallModal.tsx
                NewChatModal.tsx
                ScreenShareViewer.tsx
                SessionSync.tsx
        db/
                migrations/
                queries/
                index.ts
                schema.ts
        hooks/
                useChat.ts
                usePresence.ts
                useScreenShare.ts
                useSupabaseAuth.ts
                useVoiceCall.ts
        lib/
                apiResponse.ts
                supabaseClient.ts
                supabaseServer.ts
                validation.ts
                webrtc.ts
        store/
                chatStore.ts
                sessionStore.ts
        middleware.ts
```

## Access Model

Every protected operation is gated in multiple layers:

```text
Request
        -> middleware session check
        -> API auth and role check
        -> query-level membership checks
        -> Postgres RLS
```

Chat roles:

| Role | Read | Write | Manage chat |
| --- | --- | --- | --- |
| `read` | Yes | No | No |
| `write` | Yes | Yes | No |
| `admin` | Yes | Yes | Yes |

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your Supabase project values.

Required values:

```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].pooler.supabase.com:6543/postgres
DATABASE_URL_DIRECT=postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].pooler.supabase.com:5432/postgres

NEXT_PUBLIC_SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

Notes:

- `DATABASE_URL` should use the Supabase pooler for app runtime.
- `DATABASE_URL_DIRECT` should use the direct connection for migrations.
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` are used server-side.
- `NEXT_PUBLIC_*` values are used by the browser client.

### 3. Run database migrations

```bash
npm run db:migrate
```

### 4. Start development server

```bash
npm run dev
```

### 5. Validate production build

```bash
npm run build
```

## Deployment

This app is configured for Vercel.

Current deployment config in `vercel.json`:

- framework: `nextjs`
- install command: `npm install`
- build command: `npm run build`
- region: `iad1`

### Deploy on Vercel

1. Create a Vercel project and import the repository.
2. Add the same environment variables used locally.
3. Ensure your Supabase database is migrated.
4. Deploy.

Before deploying, verify:

```bash
npm run build
```

### Vercel environment variables

Add these in the Vercel dashboard:

```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].pooler.supabase.com:6543/postgres
DATABASE_URL_DIRECT=postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].pooler.supabase.com:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

## Operational Notes

- Passwords are handled by Supabase Auth and are not stored in app tables.
- Realtime subscriptions are RLS-filtered.
- `SessionSync` ensures browser-side Supabase Realtime has the current auth session.
- Invite links are intended for generic share flows; direct email invites are better for 1-to-1 chat creation.

## Repository Hygiene

The following should stay out of git:

- `.env.local`
- `.next/`
- `node_modules/`
- `tsconfig.tsbuildinfo`
- `.vercel/`
- log files and coverage output

There is also a likely leftover prototype file at the repository root: `chatapp.jsx`.
If it is no longer needed, it should be removed or archived outside the active app surface.
