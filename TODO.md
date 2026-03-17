# EPS Chat App — What to Build Next

---

## ✅ Completed

### Core
- **1. Invite Link Expiry Enforcement** — Shows "This link has expired" page and prevents join attempts past expiry date.
- **3. Retry on Failed Optimistic Send** — Persisted in UI with "Failed — tap to retry" state and re-send action.
- **4. Real Read Receipt Logic** — `markRead` called on initial message load; `read_receipts` table updated server-side.
- **6. Reconnection Feedback + Forced Logout** — Banner shows live countdown ("Connection lost — signing out in Xs"). If disconnected for 30s without recovery, `handleLogout()` fires: clears session, resets stores, redirects to `/login`. Reconnection cancels the timer.
- **8. Forgot Password Handler** — Dedicated Forgot Password view calling Supabase reset method with confirmation and redirect.
- **14. Header Back-To-Home Behavior** — Now clears `activeChatId` on all screen sizes.
- **26. Invite Link Single-Use Enforcement** — Invite validation and accept flows now reject tokens whose status is not `pending`.
- **30. Login Boot Preload** — Boot sequence preloads profile → chats → first chat messages before first paint. Progress indicator with labeled steps.
- **32. Password Strength Validator** — `PASSWORD_RULES` array with real-time UI checklist. Minimum 10 chars, uppercase, lowercase, special character. Shared `passwordSchema` Zod validator.

### Chat & Messages
- **5. Member Management UI** — Members panel with role management wired to `/api/chat/[chatId]/members`.
- **7. Message Search** — Search toggle in ChatHeader; client-side filter + API `?search=` server-side `ilike`.
- **9. Me-to-Me Personal Chat** — Auto-created "Saved Messages" self-chat. Pinned at top of sidebar with bookmark icon.
- **12. Typing Indicator UI** — "Alice is typing…" shown above message input.
- **13. Date Separators** — "Today", "Yesterday", "March 10" separators derived from `created_at`.
- **15. Message Pagination** — Last 25 messages on load. "Load older messages" + auto-load on scroll-to-top with scroll position preservation.
- **17. Single Message Deletion Modes** — "Delete for me" (persisted server-side) and "Delete for everyone" (soft-delete in DB).
- **25. Delete-for-Me Server-Side Persistence** — Hidden messages persisted server-side with localStorage migration fallback.
- **27. Jump-To-Message + Reaction Overlay Polish** — Emoji picker repositioned; jump-to-message highlight with ring indicator.
- **33. Chat Type Refactor** — Direct chats (no name, derived display name) vs group chats (require name). `chat_type` enum + `type` column.
- **35. Leave Group** — "Leave group" option in members panel, calls `deleteChat("for_me")` optimistically.
- **36. Edit Group Name** — `PATCH /api/chat/[chatId]` admin-only endpoint. Inline edit UI in ChatHeader. Optimistic.
- **39. Members Panel Pagination** — Cursor-based pagination (20/page) with "Load more" button. Backward-compatible.
- **42. Add Members After Creation** — Admin-only invite-by-email in MembersPanel. Direct add or signup email sent.
- **48. Thread View** — `ThreadPanel` Sheet shows reply chain. Thread indicator ("N replies") below messages. "View thread" in hover action bar.
- **55. Pin Messages** — `is_pinned` boolean on `messages` table (migration `0018`). Single pin per chat enforced at DB level (unique partial index). Admin-only pin/unpin via hover bar. Clickable banner jumps to pinned message. X button unpins. "Pinned" label + ring on pinned bubble. Real-time replication via broadcast (`pin-updated` event on per-chat channel). `pinnedId` derived via `useMemo` from message store — no extra state or fetch.
- **57. Group Settings Modal** — Clicking group name in ChatHeader opens Dialog with General tab (rename) and Members tab (opens members panel). Settings gear icon on hover.
- **58. Bulk Member Import (CSV/TXT)** — "Import file" tab in MembersPanel invite area. Parses `.csv`/`.txt`, deduplicates, previews with per-email status, batch-sends via existing invite API.
- **59. Login / Register UI Refresh** — Split-screen layout, SVG inline logo, gradient orb background, feature pills. Eye toggle on password fields. Forgot password moved below input.
- **60. View Password Toggle** — Eye icon in password/confirm fields on login and register. `onMouseDown` prevents focus steal so Enter still submits.
- **61. Forgot Password Link Position** — Moved below password input (right-aligned).
- **62. ESC to Exit Chat** — `useKeyboardShortcuts` fires `setActiveChat(null)` on Escape when a chat is open and focus is not in an input/textarea.

### Media & Files
- **16. File / Image Sharing** — Full file/image sharing via Supabase Storage. FormData upload (max 10 files, 10 MB), MIME allowlist, signed URLs (5-min TTL), drag-and-drop.
- **34. Signed URL Auto-Refresh** — Client-side 4-min interval re-fetches signed URLs for active chat.
- **37. Retry Failed Uploads** — Retry button on failed attachment cards in MessageInput.
- **38. File Upload Progress Bar** — Per-file progress bar using `XMLHttpRequest` upload progress events.
- **40. Image/Video Inline Preview** — `MediaLightbox` overlay for images, inline `<video>`/`<audio>` players. Close via X, backdrop, Escape.
- **41. Markdown & Code Highlighting** — `**bold**`, `*italic*`, `~~strikethrough~~`, bullet/numbered lists, syntax-highlighted code blocks (highlight.js, 20 languages, `github-dark` theme). Code file attachments render inline preview with expand/collapse.
- **80. Image Thumbnails** — `onError` fallback from Supabase image transform URL to original signed URL (transform requires Pro plan). Full resolution in lightbox.

### UI / UX Polish
- **2. Mute / Unread State** — Per-chat mute (localStorage). Unread badges (DB + real-time). Document title counter.
- **10. Missed Call** — Uses `showEnded("Call was declined")` feedback in CallModal.
- **18. Push Notifications** — Web Notifications API on incoming Realtime events. Ping sound with AudioContext resume.
- **19. Notification Icon Reliability / Speed** — Global Realtime subscription for instant unread badges. DB-backed initial counts.
- **20. User Details / Chat Field Height Alignment** — Fixed `py-2.5` → `py-2` on message input.
- **21. Logout Icon Color** — Changed to reddish tone.
- **22. Call Button Font Consistency** — Updated to match project font.
- **23. Global Incoming Call Modal** — Global `call_sessions` listener detects ringing calls in any member chat.
- **44. Read Receipts UI** — `GET /api/chat/[chatId]/read-receipts` with display names. "Seen by X, Y" beneath last read own message.
- **45. Block/Mute Users** — `blocked_users` table, `/api/block` GET/POST/DELETE, optimistic store state. Message filtering UI pending (#63).
- **47. Full-Text Message Search** — `tsvector` generated column + GIN index on `messages`. `searchMessages` upgraded to `tsquery` with `:*` prefix matching, falls back to `ilike`.
- **53. Contacts Master Data** — `contacts` table, `/api/contacts` CRUD, add-by-email support via admin API.
- **54. Starred Messages** — `starred_messages` table, `/api/starred` GET/POST/DELETE, star button in message hover bar, StarredPanel Sheet.
- **65. Starred Messages panel access** — Star icon in ChatHeader toolbar opens StarredPanel Sheet.
- **63 (emoji). Full emoji picker** — `EmojiPickerPopover` with 8 categories, search, 1000+ emojis. `+` button in quick reaction bar opens it.
- **46. Keyboard Shortcuts** — `Ctrl/Cmd+K` toggles search, `Escape` exits search, `Alt+↑/↓` navigates chats.
- **50. Performance: Memoization & Re-render Reduction** — `useMemo`, `useCallback`, `React.memo` on key components. `refreshChats` deduplication guard.
- **51. Optimistic UI Across All Actions** — All selectors/buttons update visually immediately. API calls fire in background.
- **52. Global CSS Accent Color System** — `AccentColorProvider` overrides CSS theme vars on `:root`. Live preview via Sheet overlay. Frosted glass surfaces.
- **72. Message Delivery Status** — GET route calls `markDelivered`; client calls PUT (markRead) immediately after load if tab is visible, and on INSERT/visibility change. Ticks in `MessageBubble`: ✓ sent, ✓✓ grey delivered, ✓✓ colored read.
- **79. Virtual List for Messages** — `@tanstack/react-virtual` `useVirtualizer` replaces `ScrollArea`. Absolute-positioned virtual items with `measureElement` for dynamic heights. Stacking context fix for emoji picker z-index.
- **81. @Mentions** — `@` in `MessageInput` triggers lazy-loaded member autocomplete (cached per chat). Token format `@[userId:displayName]`. Rendered in `MessageBubble` as highlighted span (orange + bg for self, primary for others). Bypasses mute in notification handler.
- **92. Reduce Realtime Channel Count** — Merged `global-messages` + `chat-list-changes` into single `app-events` channel. Reduced from 3 to 2 active Realtime channels. All listeners (messages INSERT, memberships INSERT/UPDATE/DELETE, deleted_for_me INSERT, invitations INSERT) consolidated.
- **94. Draft Message Persistence** — Debounced `localStorage` draft per `chatId`. Restored on chat switch. Cleared on send. "Draft ·" preview indicator in sidebar for non-active chats.
- **95. Reaction Summary Tooltip** — Hover reaction pill → popover listing reactor display names. `memberNames` map built from `readReceipts` data passed to `MessageBubble`.
- **116. Chat List Preview** — WhatsApp-style sidebar: last message preview (with `You:`/`SenderName:` prefix for groups), relative timestamp (`12:04`/`Yesterday`/`Mon`/date), filter tabs (All / Unread N / Groups N). `getLastMessages` uses `DISTINCT ON` SQL for efficiency. Real-time updates via `updateChatLastMessage` store action. Perf fixes: global channel only updates background chats, broadcast skips own-message double-update, `visibleChats` memo conditionally depends on `unreadCounts`, draft effect no longer re-reads localStorage on every message.

### Settings & Auth
- **28. User Menu & Profile Settings** — Profile editing, theme, accent colors, Discord-style presence, password reset, delete account.
- **29. Per-Chat User Details Editing** — `chat_user_profiles` table. Per-chat display name overrides.
- **31. Invitation Email for Non-Existing Users** — `inviteUserByEmail` sends signup magic-link email.

### Security & Infrastructure
- **11. Per-User Storage Hardening** (partial) — Private bucket, signed URLs, server-proxy uploads, MIME allowlist, size limits, storage cleanup. Remaining: per-user quotas, abuse scanning, audit logging.
- **24. Restrict DB Role for Production** — `app_server` role with DML-only permissions. No SUPERUSER or BYPASSRLS.
- **70. Security Headers** — CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy in `next.config.js` via `withSentryConfig`.
- **84. Error Tracking (Sentry)** — `@sentry/nextjs` with `sentry.client/server/edge.config.ts`. User context set on login. Production-only. Deprecated options moved to `webpack.*` sub-object.
- **115. Health Check Endpoint** — `GET /api/health` pings DB with `SELECT 1`, returns `{ status, db, latency_ms }` or 503. Added to `PUBLIC_ROUTES` in middleware.

---

## 🟡 Pending — Requires DB migration

1. **56. Polls**
   In-chat polls/voting. `polls`, `poll_options`, `poll_votes` tables. Creation UI, inline poll card, real-time vote updates. Single/multi-choice, optional expiry.

---

- **63. Block/Mute UI integration** — `blockedUserIds` filters messages in display list. Block/Unblock in MembersPanel dropdown for every non-self member. `onToggleBlock` wired from page.tsx.
- **64. Contacts Page in Settings** — `ContactsPage` in SettingsView. Add by email, nickname/notes edit, remove. Uses `/api/contacts` CRUD.
- **66. Full-Text Search UI upgrade** — Search bar fires debounced FTS API call (`?search=`), shows results panel with highlighted match terms, click jumps to message.

---

## 🔵 Pending — No migration needed

~~1. **49. Call Flow Completion** — Done: caller display name resolved from chat member profile (API enriched + signal `fromName` uses profile `displayName`); screen share `fromName` fixed; real-time audio level detection via Web Audio `AnalyserNode` → `isSpeaking`/`isRemoteSpeaking` wired to `CallModal`; green speaking ring shown only when voice detected, red ring + glow when muted.~~

~~2. **68. Call Minimize / Floating PiP** — Minimize button collapses full-screen call modal to a small draggable floating pill (pointer-capture drag, clamped to viewport). Pip shows remote avatar, speaking indicator, call timer, mute toggle, hang-up, and expand button. Auto-expands on incoming call or call end.~~

~~2. **67. Frontend Refactor** — Done: chat list sorted by last message desc (self-chat pinned, `bumpChatToTop` on new messages); starred+blocked IDs loaded during boot preload and stored in `chatStore` (removed 2 redundant mount-time fetches); `activeChat` now reads from `selectActiveChat` store selector instead of `useMemo` over full chats array.~~

---

## 🔴 Pending — Blockers (must ship before v1)

- ~~**69. Rate Limiting**~~ — In-memory sliding window rate limiter applied to 4 endpoints: 3/hr forgot-password, 60/min messages, 20/hr uploads, 10/hr invites. Process-local (approximate under multi-instance); swap to Redis later if needed.
- **71. ToS + Privacy Policy Consent** — Checkbox on signup. `consented_at` timestamp in `user_profiles`. Block API for non-consented users. (GDPR / CCPA)
- ~~**72. Message Delivery Status**~~ — GET route calls `markDelivered`; client calls PUT (markRead) immediately after load if tab is visible, and on INSERT/visibility change. Ticks in `MessageBubble`: ✓ sent, ✓✓ grey delivered, ✓✓ colored read.
- **73. Email Notifications for Missed Messages** — Track last-seen per user. Resend / SendGrid trigger after 15 min inactivity with unread messages. Daily digest option. Unsubscribe link (CAN-SPAM).
- ~~**74. Admin Dashboard**~~ — `/admin` route gated by global `is_admin` flag on `user_profiles` (migration `0019`). Overview stats, Users table (delete), Chats table (delete). Promote admin via Supabase dashboard SQL: `UPDATE user_profiles SET is_admin = true WHERE user_id = '<uuid>';`
- **75. Billing / Stripe** — Subscription plans (Free / Pro / Team), Stripe webhook at `/api/webhooks/stripe`, plan enforcement in API routes, billing portal in Settings.

---

## 🟠 Pending — High Priority

- **76. 2FA (TOTP)** — Supabase `enrollFactor` / `challengeAndVerify`. Setup in Settings > Security with recovery codes. Re-verify gate on password change and account deletion.
- **77. Orphaned File Cleanup** — On message hard-delete or nightly cron, `supabase.storage.remove()` orphaned attachments. Also clean up on account deletion.
- **78. Per-User Storage Quota** — `storage_used_bytes` in `user_profiles`. Increment/decrement on upload/delete. Reject uploads over plan limit. (Extends #11)
- **82. Link Previews** — `GET /api/link-preview?url=` server-side OG scraper. `link_previews` cache table. Card rendered below message text.
- **83. Web Push Notifications (FCM)** — Service worker + Web Push API. `push_subscriptions` table. Server-side trigger on new messages / calls. (Distinct from existing in-tab notifications #18.)
- **85. Analytics** — PostHog (self-hostable) or Plausible. Custom events: message sent, call started, file uploaded, search performed.
- **86. Video Calls (1:1)** — Camera track alongside mic in `requestMicrophoneAccess`. `<video>` elements in `CallModal`. Camera toggle + PiP local preview.
- **87. Group Calls (LiveKit SFU)** — Replace `useVoiceCall` P2P WebRTC with LiveKit SDK. N-participant calls, recording, simulcast. Architectural change.

---

## 🟡 Pending — Medium Priority

- **88. Disappearing Messages** — Per-chat `message_ttl` (24h / 7d / 30d / off). Cron deletes expired messages. TTL badge in `ChatHeader`.
- **89. Audit Log** — `audit_logs(actor_id, action, target_type, target_id, metadata jsonb, created_at)`. Log role changes, member removes, chat deletes, admin actions. Read-only in admin dashboard.
- **90. Session Management UI** — Settings > Security: list active sessions (device, IP, last seen). "Sign out all other sessions" via Supabase Auth API.
- **91. PWA / Service Worker** — `next-pwa` or manual service worker. Cache app shell + static assets. Background sync for offline messages.
- **93. highlight.js Bundle Optimization** — Verify unused languages are tree-shaken (`@next/bundle-analyzer`). Consider `lowlight` or dynamic import per code block.
- **96. Call History** — Calls tab in sidebar or chat: past calls with caller, duration, missed/answered. `GET /api/chat/[chatId]/calls?history=true`.
- **97. Chat Folders / Organization** — User-created folders with drag-to-assign. `chat_folders` table. Collapsible in sidebar.
- **98. Onboarding Flow** — First-login wizard: set name + avatar → invite first contact → feature tour. Track `onboarding_completed` in `user_profiles`.
- **99. Message Formatting Toolbar** — Collapsed `Aa` toggle in `MessageInput`: Bold, Italic, Code, Code block, Link, Strikethrough. Inserts markdown at cursor.
- **100. Voice Messages** — Hold-to-record via `MediaRecorder`. Preview before send. Upload as `.webm`. Inline `<audio>` player with waveform.
- **101. Notification Preferences** — Per-chat: All / Only @mentions / Off. Time-based DND (e.g. 10pm–8am). `notification_preferences` table.
- **102. Abuse Reporting** — "Report" in message hover bar and user profile menu. `reports(reporter_id, target_type, target_id, reason, created_at)`. Surfaces in admin dashboard.
- **103. CI/CD Pipeline** — GitHub Actions: lint → type-check → test → Vercel deploy on `main`. PR checks block on type errors. ~4 hours.
- **104. Automated Tests** — Vitest unit (schemas, store selectors) + integration (API routes + real DB) + Playwright E2E (login, message, file, call). Build incrementally.
- **105. Noise Cancellation** — `@ricky0123/vad-web` VAD or Krisp browser SDK for real noise suppression in calls.
- **106. Call Recording** — LiveKit recording API (requires #87 SFU). `.mp4` stored in Supabase Storage, linked in call history.
- **107. White-Label / Tenant Branding** — `tenants(logo_url, primary_color, app_name, custom_domain)`. Subdomain middleware. CSS variable override server-side.
- **108. Public API / Webhooks** — `X-API-Key` REST API. Events: `on_message`, `on_member_join`, `on_call_started`. `api_keys` + `webhook_subscriptions` tables. Auto-generated OpenAPI spec.

---

## 🟢 Pending — Low Priority / Polish

- **109. Message Forwarding** — "Forward" in hover bar → chat picker → send with optional "Forwarded from" attribution.
- **110. Message Scheduling** — Clock icon → datetime picker. `scheduled_messages` table. Vercel cron / Supabase scheduled function sends at target time.
- **111. Slash Commands** — `/` at input start → command picker. Start with `/poll`, `/remind`, `/giphy`. Framework ~1 day + ~1 day per command.
- **112. Improved Search UI** — Filters: date range, sender, chat, file type. Results grouped by chat. (Extends #66.)
- **113. PgBouncer Connection Pooling** — Enable Supabase built-in PgBouncer. Update `DATABASE_URL` to pooler endpoint. Config-only, ~30 min.
- **114. Bundle Analysis** — `@next/bundle-analyzer`. Run `ANALYZE=true next build` to surface heavy imports.
- **116. Deployment Documentation** — `README.md`: prerequisites, env var reference, local + Supabase setup, "Deploy to Vercel" button.

---

## 🔵 Future — Post-v1

- **E2E Encryption** — libsodium sealed-box, client-side key derivation (PBKDF2), keys never leave device. Requires full search redesign. v2.
- **Localization (i18n)** — `next-intl` or `i18next`. Start with English + Spanish.
- **Native Mobile App** — React Native / Expo sharing the API layer.
- **SSO / SAML** — Enterprise identity provider integration for Team plan.
