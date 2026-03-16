# EPS Chat App — What to Build Next

---

## ✅ Completed

### Core
- **1. Invite Link Expiry Enforcement** — Shows "This link has expired" page and prevents join attempts past expiry date.
- **3. Retry on Failed Optimistic Send** — Persisted in UI with "Failed — tap to retry" state and re-send action.
- **4. Real Read Receipt Logic** — `markRead` called on initial message load; `read_receipts` table updated server-side.
- **6. Reconnection Feedback** — Banner shows "Reconnecting…" / "Back online" via `useConnectionStatus`.
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
- **46. Keyboard Shortcuts** — `Ctrl/Cmd+K` toggles search, `Escape` exits search, `Alt+↑/↓` navigates chats.
- **50. Performance: Memoization & Re-render Reduction** — `useMemo`, `useCallback`, `React.memo` on key components. `refreshChats` deduplication guard.
- **51. Optimistic UI Across All Actions** — All selectors/buttons update visually immediately. API calls fire in background.
- **52. Global CSS Accent Color System** — `AccentColorProvider` overrides CSS theme vars on `:root`. Live preview via Sheet overlay. Frosted glass surfaces.

### Settings & Auth
- **28. User Menu & Profile Settings** — Profile editing, theme, accent colors, Discord-style presence, password reset, delete account.
- **29. Per-Chat User Details Editing** — `chat_user_profiles` table. Per-chat display name overrides.
- **31. Invitation Email for Non-Existing Users** — `inviteUserByEmail` sends signup magic-link email.

### Security & Infrastructure
- **11. Per-User Storage Hardening** (partial) — Private bucket, signed URLs, server-proxy uploads, MIME allowlist, size limits, storage cleanup. Remaining: per-user quotas, abuse scanning, audit logging.
- **24. Restrict DB Role for Production** — `app_server` role with DML-only permissions. No SUPERUSER or BYPASSRLS.

---

## 🟡 Pending — Requires DB migration

1. **45. Block/Mute Users**
   User-level blocking with message filtering. Requires `blocked_users` table, API, and client-side filtering.

2. **47. Full-Text Message Search**
   Backend `tsvector`/`tsquery` full-text search index + search results UI with message jumping. Benefits from #46.

3. **53. Contacts Master Data**
   `contacts` table (user → contact with nickname/notes) + Contacts page in settings. Contact picker for invite flows instead of manual email entry.

4. **54. Starred Messages**
   Per-user message bookmarking. `starred_messages` table (`user_id, message_id`), API endpoints, "Starred" panel in chat header or sidebar.

5. **55. Pin Messages**
   Admin-only group-wide message pinning. `pinned_messages` table (or `pinned_at`/`pinned_by` on messages), API endpoints, pinned messages banner/panel. Distinct from starred (personal vs group-wide).

6. **56. Polls**
   In-chat polls/voting. `polls`, `poll_options`, `poll_votes` tables. Creation UI, inline poll card, real-time vote updates. Single/multi-choice, optional expiry.

---

## 🔵 Pending — No migration needed

1. **49. Call Flow Completion**
   Finish WebRTC signaling, ringtone, multi-screen call UI. Full-screen call modal with avatar, controls bar (mic/video/screenshare/hangup), connection status badge. Screen sharing may need fixing.
