# EPS Chat — Product Improvements Roadmap

> Assessment date: 2026-03-16
> Goal: identify everything needed to make this a sellable, production-ready product.
> Items are grouped by dimension, then ranked by priority within each group.

---

## Legend

- 🔴 **Blocker** — prevents selling / legal risk
- 🟠 **High** — major feature parity gap or significant UX regression
- 🟡 **Medium** — visible gap, users will notice
- 🟢 **Low** — polish / nice-to-have
- 🔵 **Future** — post-v1 considerations

---

## 1. Security & Privacy

### 🔴 Rate Limiting (server-side)
No API rate limiting on any endpoint. Password reset, message creation, file upload, and invite emails are fully unprotected.
- **Risk:** Spam abuse, storage exhaustion, DoS via invite flood.
- **Fix:** Add `upstash/ratelimit` or Vercel edge rate limiting on:
  - `POST /api/auth/forgot-password` — 3/hour per IP
  - `POST /api/chat/[chatId]/messages` — 60/min per user
  - `POST /api/chat/[chatId]/invite` — 10/hour per user
  - File upload route — 20/hour per user
- **Effort:** 1–2 days

### 🔴 Security Headers
`next.config.js` has no security headers — no CSP, HSTS, X-Frame-Options, Referrer-Policy, or Permissions-Policy.
- **Risk:** Fails OWASP scans; enterprise buyers will bounce immediately.
- **Fix:** Add `headers()` in `next.config.ts`:
  ```
  Content-Security-Policy: default-src 'self'; connect-src 'self' wss://*.supabase.co https://*.supabase.co; ...
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(self), geolocation=()
  Strict-Transport-Security: max-age=63072000; includeSubDomains
  ```
- **Effort:** 2–4 hours

### 🔴 Terms of Service + Privacy Policy Consent
No consent collection on signup. Required under GDPR, CCPA, and virtually every market.
- **Fix:** Checkbox on register form: *"I agree to the Terms of Service and Privacy Policy."* Store `consented_at` in `user_profiles`. Block API access for non-consented users.
- **Effort:** 1 day (legal copy written separately)

### 🟠 Two-Factor Authentication (TOTP)
No 2FA. Supabase Auth supports TOTP natively via `enrollFactor` / `challengeAndVerify`.
- **Fix:** Settings > Security — TOTP setup with recovery codes. Gate password change and account deletion behind a 2FA re-verify prompt.
- **Effort:** 2–3 days

### 🟠 Orphaned File Cleanup
Deleted messages soft-delete the DB row but leave attachments in Supabase Storage indefinitely.
- **Fix:** On hard-delete (or a nightly cron), call `supabase.storage.remove([storagePath])` for orphaned attachments. Also clean up on account deletion.
- **Effort:** 1 day

### 🟠 Per-User Storage Quota
No enforcement — a single user can upload unbounded data.
- **Fix:** `storage_used_bytes` column in `user_profiles`. Increment on upload, decrement on delete. Reject uploads over plan limit (e.g. 1 GB free tier).
- **Effort:** 1–2 days

### 🟡 Disappearing Messages
No message expiry. Privacy expectation for many users.
- **Fix:** Optional per-chat `message_ttl` (24h / 7d / 30d / off). Cron or Supabase scheduled function deletes `messages WHERE created_at < now() - interval`. Show TTL badge in ChatHeader.
- **Effort:** 2–3 days

### 🟡 Audit Log
No record of admin actions, member changes, or data access. Required for SOC 2 / HIPAA-adjacent compliance.
- **Fix:** `audit_logs(id, actor_id, action, target_type, target_id, metadata jsonb, created_at)`. Log: role changes, member removes, chat deletes, admin pin/unpin, account deletions. Expose read-only view in admin dashboard.
- **Effort:** 2–3 days

### 🟡 End-to-End Encryption (optional mode)
Messages stored in plaintext. Privacy-focused buyers expect at least optional E2E.
- **Fix:** libsodium sealed-box encryption. Keys derived from user password (PBKDF2), stored locally — never on server. Content encrypted client-side before send. **Tradeoff:** server-side search must be redesigned.
- **Effort:** 1–2 weeks
- **Note:** v2 — defer until search redesign is planned.

### 🟢 Session Management UI
No way to see or revoke active sessions.
- **Fix:** Settings > Security: list active sessions (device, IP, last seen) from Supabase Auth. "Sign out all other sessions" button.
- **Effort:** 1 day

---

## 2. Performance

### 🟠 Virtual List for Messages
All loaded messages render as real DOM nodes. 200+ messages accumulate on scroll, causing visible jank.
- **Fix:** Replace `ScrollArea` message list with `@tanstack/react-virtual`. Render ~20 visible items + overscan. Variable row heights and scroll anchoring make this non-trivial.
- **Effort:** 3–4 days

### 🟠 Image Resizing / Thumbnails
Uploaded images served at full resolution — an 8 MB photo downloads for every viewer.
- **Fix:** Supabase Storage Image Transformations (`?width=400&quality=80`) for thumbnails in message bubbles; full resolution only in the lightbox. Alternatively, resize server-side on upload with `sharp`.
- **Effort:** 1–2 days

### 🟡 PWA / Service Worker
No `manifest.json`, no service worker, no install prompt.
- **Fix:** Add `next-pwa` or a manual service worker. Cache static assets and app shell. Background sync for messages written while offline.
- **Effort:** 2–3 days

### 🟡 Reduce Supabase Realtime Channel Count
Each open chat holds 4–6 concurrent Realtime subscriptions (messages, typing, presence, calls, screen share, global calls).
- **Fix:** Consolidate to 1 broadcast channel per chat with a `type` discriminator in the payload. Significantly reduces subscription overhead.
- **Effort:** 2–3 days (careful refactor)

### 🟡 highlight.js Bundle Size
`highlight.js` with 20+ languages adds ~200 KB to the bundle.
- **Fix:** Verify unused languages are tree-shaken with `next/bundle-analyzer`. Consider `lowlight` (lighter) or dynamic import per code block.
- **Effort:** 4 hours

### 🟢 PgBouncer Connection Pooling
Under load, Supabase's limited direct DB connections can exhaust.
- **Fix:** Enable built-in PgBouncer in Supabase project settings. Update `DATABASE_URL` to pooler endpoint. Already compatible with Drizzle.
- **Effort:** 30 minutes (config only)

### 🟢 Bundle Analysis
No visibility into what's large in the client bundle.
- **Fix:** Add `@next/bundle-analyzer`. Run `ANALYZE=true next build` to identify heavy imports.
- **Effort:** 1 hour

---

## 3. UX / UI

### 🔴 Message Delivery Status (sent → delivered → read)
The `messageStatus` enum exists in the DB but only "read" is surfaced. Users expect double-tick confirmation.
- **Fix:** Render in MessageBubble on own messages: single tick (sent), double tick grey (delivered), double tick colored (read). Data is already available — this is purely a UI addition.
- **Effort:** 1 day

### 🟠 @Mentions
No way to alert a specific person. Table stakes for any team chat.
- **Fix:**
  - `@` in MessageInput → member autocomplete popover
  - Store as `@[userId:displayName]` token; render as highlighted badge in MessageBubble
  - On receive, check if current user is mentioned → higher-priority notification (bypasses mute)
  - Unread badge differentiation: blue = unread, orange = mentioned
- **Effort:** 3–4 days (mention notifications included)

### 🟠 Link Previews (OG cards)
Pasting a URL shows nothing. Discord, Slack, and iMessage all render a preview card.
- **Fix:** Server route `GET /api/link-preview?url=...` fetches OG tags (`og:title`, `og:description`, `og:image`), cached in a `link_previews` table. Client detects URLs on render and shows a card below the message text.
- **Effort:** 2–3 days

### 🟡 Draft Message Persistence
Leaving a chat mid-sentence loses the draft.
- **Fix:** Debounced `localStorage.setItem(`draft:${chatId}`, text)` on input. Restore on chat open. Clear on send.
- **Effort:** 2 hours

### 🟡 Reaction Summary Tooltip
Clicking a reaction count shows nothing. Users expect to see who reacted.
- **Fix:** Hover/click on a reaction group → popover listing display names of reactors. Data already available in `reactions` table.
- **Effort:** 4 hours

### 🟡 Call History
No record of past calls. `call_sessions` table has all the data.
- **Fix:** "Calls" tab in sidebar or within chat listing past calls (caller, duration, timestamp, missed/answered). `GET /api/chat/[chatId]/calls?history=true`.
- **Effort:** 1–2 days

### 🟡 Chat Folders / Organization
20+ chats becomes an unmanageable scrolling list.
- **Fix:** User-created folders (e.g. "Work", "Personal") with drag-to-assign. `chat_folders` table, collapsible in sidebar. DMs and groups auto-separated.
- **Effort:** 2–3 days

### 🟡 Onboarding Flow
New users land on a blank screen with no guidance.
- **Fix:** First-login wizard: (1) set display name + avatar, (2) invite first contact, (3) brief feature tour via tooltips. "Skip" on each step. Track `onboarding_completed` in `user_profiles`.
- **Effort:** 2 days

### 🟡 Message Formatting Toolbar
Markdown is supported but users must know the syntax.
- **Fix:** Collapsed toolbar above MessageInput (`Aa` toggle): Bold, Italic, Code, Code block, Link, Strikethrough. Inserts markdown at cursor position.
- **Effort:** 1–2 days

### 🟡 Voice Messages
Record a short audio clip inline. Very popular on mobile.
- **Fix:** Hold-to-record button via `MediaRecorder` API. Preview before send. Upload as `.webm` / `.ogg`. Render as inline `<audio>` player with waveform visualization.
- **Effort:** 3–4 days

### 🟢 Message Forwarding
Forward a message to another chat in one tap. Ubiquitous in messaging apps.
- **Fix:** "Forward" in message hover bar → chat picker → sends as new message with optional "Forwarded from" attribution.
- **Effort:** 1–2 days

### 🟢 Message Scheduling
"Send at 9am Monday" — common for async teams.
- **Fix:** Clock icon in MessageInput → datetime picker. `scheduled_messages` table. Vercel cron or Supabase scheduled function sends at the scheduled time.
- **Effort:** 2–3 days

### 🟢 Slash Commands
`/giphy`, `/poll`, `/remind` — patterns users know from Slack.
- **Fix:** Detect `/` at input start → command picker popover. Start with `/poll` and `/remind`; add `/giphy` if GIPHY key is available.
- **Effort:** 1 day for framework + ~1 day per command

### 🟢 Improved Search UI
Current FTS panel shows snippets but has no filters.
- **Fix:** Sidebar search panel with filters: date range, sender, chat, file type. Results grouped by chat. Click-to-jump already implemented.
- **Effort:** 2–3 days

---

## 4. Notifications & Communication

### 🔴 Email Notifications for Missed Messages
Close the browser tab, miss a DM, never know. Critical for retention.
- **Fix:** Track last-seen per user. After 15 min of inactivity with unread messages, send a "You have X unread messages" email via Resend / SendGrid. Daily digest option. Unsubscribe link required (CAN-SPAM).
- **Effort:** 2–3 days

### 🟠 Push Notifications (Web Push / FCM)
Browser notifications only fire while the tab is open. Users miss calls and messages when the app is closed.
- **Fix:** Web Push API with service worker. Store subscriptions in `push_subscriptions` table. Trigger from a server-side handler on new messages / calls via FCM.
- **Effort:** 3–4 days

### 🟡 Notification Preferences
Per-chat mute is all-or-nothing. No granular control.
- **Fix:** Per-chat settings: All messages / Only @mentions / Nothing. Time-based DND (e.g. 10pm–8am). `notification_preferences` table.
- **Effort:** 1–2 days

---

## 5. Admin & Operations

### 🔴 Admin Dashboard
No way to manage users, moderate content, or handle abuse without direct Supabase access. Required for any B2B sale.
- **Fix:** `/admin` route gated by `is_admin` flag in `user_profiles`. Pages:
  - **Users** — list, search, suspend, delete, reset password
  - **Chats** — list groups, view members, delete
  - **Reports** — view abuse reports, take action
  - **Usage** — messages/day chart, active users, storage consumed
  - **Audit Log** — all loggable admin actions
- **Effort:** 1–2 weeks

### 🟠 Error Tracking (Sentry)
26+ `console.error` calls but zero aggregated monitoring. Production issues are invisible.
- **Fix:** Add `@sentry/nextjs`. Wrap API routes. Add user context on login. Configure Slack/email alerts for new error types.
- **Effort:** 4 hours

### 🟠 Analytics
No usage data. Can't make product decisions without it.
- **Fix:** PostHog (privacy-respecting, self-hostable) or Plausible for page analytics. Custom events: message sent, call started, file uploaded, search performed.
- **Effort:** 1 day

### 🟡 Abuse Reporting
No way for users to flag a message or user. Required for any public-facing platform.
- **Fix:** "Report" option in message hover bar and user profile menu. `reports(reporter_id, target_type, target_id, reason, created_at)`. Surfaces in admin dashboard.
- **Effort:** 1 day

### 🟡 CI/CD Pipeline
No automated testing or deployment pipeline. Every push is a manual risk.
- **Fix:** GitHub Actions: lint → type-check → test → deploy to Vercel on `main`. PR checks block merge on type errors.
- **Effort:** 4 hours

### 🟡 Automated Tests
Zero test files. Enterprise buyers ask for coverage before signing.
- **Fix:**
  - **Unit** — Zod schemas, utility functions, store selectors (Vitest, ~1 week)
  - **Integration** — API route handlers against a test DB (Vitest + test DB, ~2 weeks)
  - **E2E** — login, send message, file upload, call flow (Playwright, ~1 week)
- **Effort:** 4–6 weeks total (build incrementally)

### 🟢 Health Check Endpoint
No `/api/health` route. Required for uptime monitoring (UptimeRobot, Betterstack).
- **Fix:** `GET /api/health` → check DB connectivity → return `{ status: "ok", db: true, latency_ms: N }`.
- **Effort:** 1 hour

### 🟢 Deployment Documentation
No README, no self-host guide, no env var reference.
- **Fix:** `README.md` with prerequisites, env var table, local setup steps, Supabase setup, and a "Deploy to Vercel" button.
- **Effort:** 4 hours

---

## 6. Monetization

### 🔴 Billing / Subscription System
No monetization path. Can't sell as SaaS without Stripe.
- **Fix:**
  - Stripe integration + webhook handler at `/api/webhooks/stripe`
  - Plans: Free (5 chats, 1 GB, voice), Pro ($8/mo: unlimited chats, 10 GB, video), Team ($15/user/mo: admin dashboard, audit log, SSO)
  - `subscriptions(user_id, stripe_customer_id, plan, status, current_period_end)`
  - Enforce limits in API routes (chat count, upload size, storage quota)
  - Billing portal in Settings
- **Effort:** 1–2 weeks

### 🟡 White-Label / Tenant Branding
Companies want their logo and colors. No tenant-level theming exists.
- **Fix:** `tenants(logo_url, primary_color, app_name, custom_domain)`. Middleware reads tenant from subdomain. CSS variables overridden server-side.
- **Effort:** 1 week

### 🟡 Public API / Webhooks
No integration path for Jira, GitHub, Zapier. Expected by enterprise buyers.
- **Fix:** REST API with `X-API-Key` header auth. Webhook events: `on_message`, `on_member_join`, `on_call_started`. `api_keys` and `webhook_subscriptions` tables. Auto-generated OpenAPI spec.
- **Effort:** 1–2 weeks

---

## 7. Calls & Media

### 🟠 Video Calls (1:1)
Voice-only. Every competitor has video — largest single call feature gap.
- **Fix:** Add camera track alongside microphone in `requestMicrophoneAccess`. Add `<video>` elements (local + remote) to `CallModal`. Camera toggle button with picture-in-picture local preview.
- **Effort:** 2–3 days

### 🟠 Group Calls (SFU)
Current WebRTC is peer-to-peer (1:1 only). Group calls require a media server.
- **Fix:** Integrate LiveKit (open-source SFU). Replace `useVoiceCall` peer connection with LiveKit SDK. Supports N-participant calls, recording, and simulcast.
- **Effort:** 1–2 weeks (architectural change)

### 🟡 Noise Cancellation
`echoCancellation: true` helps but isn't sufficient for real background noise.
- **Fix:** Integrate `@ricky0123/vad-web` (VAD) or Krisp's browser SDK for real noise suppression.
- **Effort:** 1–2 days

### 🟡 Call Recording
No record of what was discussed. Important for business calls.
- **Fix:** Server-side recording via LiveKit's recording API (requires SFU). Store as `.mp4` in Supabase Storage, linked in call history.
- **Effort:** 1–2 days (requires group calls / SFU first)

---

## 8. Pending Schema Work

### 🟠 Polls
- **Tables:** `polls`, `poll_options`, `poll_votes`
- In-chat polls with single/multi-choice, optional expiry, real-time vote updates via Realtime broadcast.
- **Effort:** 3–4 days

---

## Suggested Implementation Order (v1 Launch Checklist)

### Sprint 1 — Security & Legal (Week 1–2)
1. Security headers (`next.config.ts`)
2. Server-side rate limiting (Upstash Redis)
3. ToS + Privacy Policy consent on signup
4. Sentry error tracking
5. Orphaned file cleanup on message delete

### Sprint 2 — Core Feature Parity (Week 3–5)
6. Message delivery status UI (ticks)
7. @mentions + mention notifications
8. Link previews (server-side OG scraper)
9. Draft message persistence
10. Reaction summary tooltip

### Sprint 3 — Calls + Media (Week 6–7)
11. Video calls (1:1, camera track)
12. Noise cancellation (VAD)
13. Call history view

### Sprint 4 — Operations (Week 8–9)
14. Admin dashboard (users + basic moderation)
15. Analytics (PostHog)
16. CI/CD pipeline (GitHub Actions)
17. Health check endpoint + deployment docs

### Sprint 5 — Monetization (Week 10–12)
18. Stripe subscription + plan enforcement
19. Storage quotas
20. Billing portal in Settings

### Sprint 6 — Polish (Week 13–14)
21. Virtual list for messages
22. Image thumbnails (Supabase Transform)
23. Onboarding flow
24. PWA + service worker
25. 2FA (TOTP)

### v2 Considerations (Post-launch)
- Group calls (LiveKit SFU)
- White-label / multi-tenant branding
- E2E encryption
- Localization (i18n)
- Native mobile app (React Native / Expo)
- Webhook / public API
- Message scheduling
- Slash commands

---

## Effort Summary

| Category | Items | Estimated Total |
|---|---|---|
| Security & Privacy | 9 | 3–4 weeks |
| Performance | 7 | 1–2 weeks |
| UX / UI | 13 | 4–6 weeks |
| Notifications | 3 | 1 week |
| Admin & Operations | 7 | 3–4 weeks |
| Monetization | 3 | 2–3 weeks |
| Calls & Media | 4 | 2–3 weeks |
| **Total (v1)** | | **~16–23 weeks solo** |

> With 2 developers, v1 (Sprints 1–4) is achievable in 8–10 weeks.
> Run the monetization sprint immediately after — before public launch.
