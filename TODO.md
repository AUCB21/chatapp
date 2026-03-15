# EPS Chat App — What to Build Next

---

## ✅ Completed

### ~~1. Invite Link Expiry Enforcement~~ DONE
~~No UI or server-side enforcement of invite link expiry.~~ Shows "This link has expired" page and prevents join attempts past expiry date.

### ~~2. Mute / Unread State~~ DONE
~~No per-chat notification control.~~ localStorage-based per-chat mute (sidebar dropdown, BellOff indicator). Muted chats suppress notifications and ping. Unread badge fetched from DB on load (`read_receipts`-based query) and incremented in real time via global listener. Document title reflects total unread count.

### ~~3. Retry on Failed Optimistic Send~~ DONE
~~Failed messages disappear silently.~~ Persisted in UI with "Failed — tap to retry" state and re-send action.

### ~~4. Real Read Receipt Logic~~ DONE
~~`msg.status` never updated to `"read"`.~~ `markRead` called on initial message load; `read_receipts` table updated server-side.

### ~~5. Member Management UI~~ DONE
~~No way to see who is in a chat, add members after creation, or view/change roles.~~ Members panel implemented with role management wired to `/api/chat/[chatId]/members`.

### ~~6. Reconnection Feedback~~ DONE
~~Silent failure on Realtime drop.~~ Banner shows "Reconnecting…" / "Back online" via `useConnectionStatus`.

### ~~7. Message Search~~ DONE
~~No in-chat search.~~ Search toggle in ChatHeader; client-side filter over loaded messages. API supports `?search=` for server-side `ilike` queries.

### ~~8. Forgot Password Handler~~ DONE
~~No password reset flow.~~ Dedicated Forgot Password view calling Supabase reset method with confirmation and redirect.

### ~~10. Missed Call~~ DONE (reverted sentinel approach)
~~Missed call message sent as `__MISSED_CALL__` sentinel.~~ Reverted: now uses existing `showEnded("Call was declined")` feedback in the CallModal. No message inserted.

### ~~12. Typing Indicator UI~~ DONE
~~`usePresence` / `typingUsers` wired but not rendered.~~ "Alice is typing…" shown above message input.

### ~~13. Date Separators~~ DONE
~~No day grouping.~~ "Today", "Yesterday", "March 10" separators derived from `created_at`.

### ~~14. Header Back-To-Home Behavior~~ DONE
~~Back arrow toggled sidebar instead of clearing active chat.~~ Now clears `activeChatId` on all screen sizes.

### ~~15. Message Pagination~~ DONE
~~All messages loaded at once.~~ Initial load fetches last **25** messages. "Load older messages" button + auto-load on scroll-to-top via `?before=<ISO8601>`, preserving scroll position.

### ~~17. Single Message Deletion Modes~~ DONE
~~No per-message deletion control.~~ "Delete for me" (local store + localStorage persistence across reloads) and "Delete for everyone" (soft-delete in DB, shows "[Message deleted]" for all members).

### ~~18. Push Notifications~~ DONE
~~No browser notification when tab unfocused.~~ Web Notifications API triggered on incoming Realtime events. Ping sound fixed to await AudioContext resume before playing.

### ~~19. Notification Icon Reliability / Speed~~ DONE
~~Unread badge inconsistent / slow.~~ Global Realtime subscription drives instant unread badges. DB-backed initial unread counts loaded on startup. Document title counter e.g. "(3) EPS Chat".

### ~~20. User Details / Chat Field Height Alignment~~ DONE
~~Height misalignment between user details and message input.~~ Fixed: `py-2.5` → `py-2` on message input form.

### ~~21. Logout Icon Color~~ DONE
~~Logout icon had no visual danger cue.~~ Changed to reddish tone.

### ~~22. Call Button Font Consistency~~ DONE
~~Call button used inconsistent font styling.~~ Updated to match project font.

### ~~23. Global Incoming Call Modal~~ DONE
~~CallModal only showed when inside the relevant chat.~~ Global `call_sessions` postgres_changes listener detects ringing calls in any member chat; `useVoiceCall` receives the correct chatId regardless of which chat is open.

### ~~25. Delete-for-Me Server-Side Persistence~~ DONE
~~"Delete for me" was stored only in `localStorage` per browser.~~ Hidden messages are now persisted server-side with a silent localStorage migration fallback for older clients.

### ~~26. Invite Link Single-Use Enforcement~~ DONE
~~An accepted invite token is not invalidated server-side after use.~~ Invite validation and accept flows now reject tokens whose status is not `pending`.

### ~~28. User Menu & Profile Settings~~ DONE
~~No user settings area.~~ Sidebar settings panel with profile editing (username, displayName), theme (light/dark/system), custom accent colors (background, font, chat bubble), Discord-style presence (online/idle/DND with auto-idle after 5min), password reset, and delete account with cascading cleanup. `user_profiles` table + RLS + boot preload. ⚠️ Requires migration `0010_user_profiles.sql` on Supabase.

### ~~30. Login Boot Preload~~ DONE
~~Chat UI mounted in partially empty state after login.~~ Boot sequence preloads profile → chats → first chat messages before first paint. Progress indicator with labeled steps.

### ~~31. Invitation Email for Non-Existing Users~~ DONE
~~Inviting an email with no account silently did nothing.~~ `inviteUserByEmail` admin API sends a signup magic-link email. Fire-and-forget, non-blocking. Requires `SUPABASE_SERVICE_ROLE_KEY` in env.

### ~~33. Chat Type Refactor — One-on-One vs Group~~ DONE
~~All chats required a name; no distinction between DM and group.~~ Direct chats have no name (display name derived from other participant). Group chats require a name. NewChatModal redesigned with Direct / Group toggle and multi-email invite for groups. `chat_type` enum + `type` column added to schema. ⚠️ Requires migration `0011_chat_types.sql` on Supabase.

### ~~29. Per-Chat User Details Editing~~ DONE
~~No per-chat display name overrides.~~ `chat_user_profiles` table with `(chat_id, user_id)` PK. API endpoint `PATCH /api/chat/[chatId]/profile` for setting/clearing per-chat display names. Members panel uses effective `displayName` (per-chat > global > email prefix). ⚠️ Requires migration `0012_chat_user_profiles.sql` on Supabase.

### ~~9. Me-to-Me Personal Chat~~ DONE
~~No personal notes/saved-messages space.~~ Auto-created "Saved Messages" self-chat on first profile creation. Pinned at top of sidebar with bookmark icon. Uses existing direct chat type with single membership.

### ~~27. Jump-To-Message + Reaction Overlay Polish~~ DONE
~~Emoji picker popup overlapped message content above.~~ Repositioned emoji picker to `bottom-full` (above bubble, relative to bubble bottom). Enhanced jump-to-message highlight with ring indicator for better visibility.

### ~~24. Restrict DB Role for Production~~ DONE
~~`DATABASE_URL` connects as DB owner.~~ Migration `0013_app_server_role.sql` creates `app_server` role with DML-only permissions (SELECT/INSERT/UPDATE/DELETE). No SUPERUSER or BYPASSRLS. Includes template for login user creation.

### ~~32. Password Strength Validator~~ DONE
~~No password strength enforcement.~~ `PASSWORD_RULES` array with real-time UI checklist on register and reset-password pages. Minimum 10 chars, uppercase, lowercase, special character. Shared `passwordSchema` Zod validator.

### ~~50. Performance: Memoization & Re-render Reduction~~ DONE
~~No memoization on computed values or stable references for callbacks.~~ Applied `useMemo` to `reactionGrouped`, `activeChat`, `totalUnread`, `displayMessages` (search filter), and the `chatAttachments` Zustand selector. Wrapped all event handlers in `page.tsx` with `useCallback`. Wrapped `MessageBubble`, `ChatSidebar`, `ChatHeader`, and `MessageInput` with `React.memo` to skip re-renders when their props are unchanged. Added `selectProfileStatus` stable selector to `profileStore`. Added in-flight deduplication guard to `refreshChats` in `useChat.ts` to prevent parallel duplicate chat-list fetches triggered by concurrent Realtime events.

### ~~51. Optimistic UI Across All Actions~~ DONE
~~Many buttons waited for API response before updating UI.~~ All selectors/buttons now update visually immediately (optimistic): profile fields, status, accent colors, chat rename, role changes, nickname edits, member removal, and chat deletion. API calls fire in the background. Color picker now uses draft/persisted state with Save/Revert buttons so live preview is decoupled from server state.

### ~~52. Global CSS Accent Color System~~ DONE
~~Accent colors were applied per-component via inline styles.~~ `AccentColorProvider` overrides CSS theme variables (`--background`, `--foreground`, `--card-foreground`, `--primary`) directly on `:root`, so all Tailwind classes pick them up automatically. Live preview works globally (chat bubbles, background, font) with smooth CSS transitions. Surface layers (card, popover, sidebar) use alpha opacity for a frosted glass feel. Settings rendered as a Sheet overlay so the chat stays visible during color preview.

### ~~16. File / Image Sharing~~ DONE
~~The `<Paperclip>` button is rendered but does nothing.~~ Full file/image sharing via Supabase Storage. FormData upload (max 10 files, 10 MB each), MIME allowlist, `attachments` table with cascade delete, signed URLs (5-min TTL), drag-and-drop, image thumbnails + file cards in MessageBubble, realtime broadcast, storage cleanup on message deletion. ⚠️ Requires migration `0014_attachments.sql` on Supabase + `chat-attachments` private bucket.

### ~~11. Per-User Storage Hardening~~ DONE (partial)
~~Harden storage before production rollout.~~ Private bucket, signed URLs with 5-min TTL, server-proxy uploads via service role key (no client-side bucket access), strict MIME allowlist, file size limits, storage cleanup on message deletion. Remaining: per-user quotas, abuse scanning, audit logging.

---

## 🔴 High Priority — Quick wins & core gaps

### ~~34. Signed URL Auto-Refresh~~ DONE
~~Attachment URLs expire after 5 min.~~ Client-side 4-min interval re-fetches signed URLs for the active chat, restoring images/downloads without a page reload.

### ~~35. Leave Group~~ DONE
~~Non-admin users had no way to leave a group chat.~~ "Leave group" option added to members panel with confirmation, calls `deleteChat("for_me")` optimistically.

### ~~36. Edit Group Name~~ DONE
~~No way to rename a group chat after creation.~~ `PATCH /api/chat/[chatId]` endpoint added (admin-only). Inline edit UI in ChatHeader. Rename is optimistic.

### ~~37. Retry Failed Uploads~~ DONE
~~File upload errors showed no retry action.~~ Retry button added to failed attachment cards in MessageInput file preview strip.

### ~~38. File Upload Progress Bar~~ DONE
~~No visual feedback during file uploads.~~ Per-file progress bar shown in the preview strip using `XMLHttpRequest` upload progress events.

---

## 🟡 Medium Priority — UX polish & content features

### ~~39. Members Panel Pagination~~ DONE
~~Members list loads all members at once.~~ Cursor-based pagination (20 per page) added to `getChatMembersPaginated` backend query and `GET /api/chat/[chatId]/members?limit=&cursor=`. MembersPanel fetches page-by-page with a "Load more" button. Backward-compatible (no params = all members).

### ~~40. Image/Video Inline Preview~~ DONE
~~Images open as raw signed URLs.~~ `MediaLightbox` overlay component: images in full-screen modal (`max-h-[90vh]`), inline `<video controls>` for video, `<audio controls>` for audio. Close via X, backdrop click, or Escape. Non-media files keep download behavior.

### ~~41. Markdown & Code Highlighting~~ DONE
~~Messages render as plain text.~~ Added `**bold**`, `*italic*`, `~~strikethrough~~`, bullet lists (`- `/`* `), numbered lists (`1. `), and syntax-highlighted fenced code blocks via `highlight.js` (20 languages registered). `github-dark` theme for code. All rendering defined outside component to avoid re-render overhead.

### ~~42. Add Members After Creation~~ DONE
~~No way to invite new members to an existing group chat.~~ Admin-only `+` button in MembersPanel header opens an inline invite-by-email form. If the user has an account they are added directly as a write member (`POST /api/chat/[chatId]/invite`); if not, an invitation record is created and a signup email is sent. Member list auto-refreshes on success.

10. **43. Message Pinning**
    No ability to pin important messages. Requires new schema (`pinned_at` column or `pinned_messages` table), API endpoints, and a pinned messages panel in the chat UI.

---

## 🔵 Lower Priority — Advanced features

### ~~44. Read Receipts UI~~ DONE
~~No read indicator in the UI.~~ `GET /api/chat/[chatId]/read-receipts` returns receipts with display names. Receipts fetched on chat open and kept live via `read_receipts` Realtime subscription. `chatStore` holds receipts keyed by chatId. The last own message seen by at least one other member shows "Seen by X, Y" beneath it in italic muted text. Truncates to "Seen by A, B +N more" for long lists.

12. **45. Block/Mute Users**
    No user-level blocking. Requires new schema, API, and client-side message filtering for blocked users.

### ~~46. Keyboard Shortcuts~~ DONE
~~No keyboard navigation.~~ `useKeyboardShortcuts` hook: `Ctrl/Cmd+K` toggles search, `Escape` exits search, `Alt+↑/↓` navigates between chats in sidebar.

14. **47. Full-Text Message Search**
    Search box exists but only filters client-side. Add a backend `tsvector`/`tsquery` full-text search index and search results UI with message jumping. Benefits from keyboard shortcut (#46) for discovery.

### ~~48. Thread View~~ DONE
~~Schema supports `parentId` for replies but there's no expandable thread UI.~~ `ThreadPanel` right-side Sheet shows full reply chain for a message. Root message displayed at top, replies chronologically below, with inline reply input. Thread indicator ("N replies") shown below messages with replies. "View thread" button in hover action bar.

16. **49. Call Flow Completion**
    Voice call hooks and modal exist but the accept/reject/missed-call flow is incomplete. Finish WebRTC signaling, ringtone, and multi-screen call UI.

17. **53. Contacts Master Data**
    No contacts system. Add a `contacts` table (user → contact with optional nickname/notes) and a Contacts page in settings. Once contacts exist, invite flows (new chat, add member) can show a contact picker so users select from their saved contacts instead of typing emails manually. Requires DB migration `contacts` table + API endpoints + UI.
