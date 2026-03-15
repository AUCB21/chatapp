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

### ~~16. File / Image Sharing~~ DONE
~~The `<Paperclip>` button is rendered but does nothing.~~ Full file/image sharing via Supabase Storage. FormData upload (max 10 files, 10 MB each), MIME allowlist, `attachments` table with cascade delete, signed URLs (5-min TTL), drag-and-drop, image thumbnails + file cards in MessageBubble, realtime broadcast, storage cleanup on message deletion. ⚠️ Requires migration `0014_attachments.sql` on Supabase + `chat-attachments` private bucket.

### ~~11. Per-User Storage Hardening~~ DONE (partial)
~~Harden storage before production rollout.~~ Private bucket, signed URLs with 5-min TTL, server-proxy uploads via service role key (no client-side bucket access), strict MIME allowlist, file size limits, storage cleanup on message deletion. Remaining: per-user quotas, abuse scanning, audit logging.

---

## 🔴 High Priority — Quick wins & core gaps

### Execution Order (least complex first, dependencies respected)

1. **34. Signed URL Auto-Refresh**
   Attachment URLs expire after 5 min. If a chat stays open longer, images break and downloads fail. Add a client-side refresh mechanism (re-fetch signed URLs on demand or on a timer).

2. **35. Leave Group**
   Non-admin users have no way to leave a group chat — they can only be removed by an admin. Add a "Leave group" option in the chat menu/members panel with confirmation modal.

3. **36. Edit Group Name**
   No way to rename a group chat after creation. Add `PATCH /api/chat/[chatId]` endpoint (admin-only) and inline edit UI in the chat header or settings.

4. **37. Retry Failed Uploads**
   File upload errors show a message but no retry action. Add a retry button on failed attachment uploads in the MessageInput file preview strip.

5. **38. File Upload Progress Bar**
   No visual feedback during file uploads. Replace `fetch` with `XMLHttpRequest` or a progress-aware wrapper to show per-file upload progress in the preview strip.

---

## 🟡 Medium Priority — UX polish & content features

6. **39. Members Panel Pagination**
   Members list loads all members at once. Add cursor-based pagination for groups with many members.

7. **40. Image/Video Inline Preview**
   Images open as raw signed URLs. Add a lightbox overlay for image viewing and inline `<video>`/`<audio>` players for media attachments.

8. **41. Markdown & Code Highlighting**
   Messages render as plain text. Add markdown parsing (bold, italic, links, lists) and syntax-highlighted code blocks using a lightweight library.

9. **42. Add Members After Creation**
   No way to invite new members to an existing group chat. Add a search/invite UI in the members panel that reuses the existing invitation API.

10. **43. Message Pinning**
    No ability to pin important messages. Requires new schema (`pinned_at` column or `pinned_messages` table), API endpoints, and a pinned messages panel in the chat UI.

---

## 🔵 Lower Priority — Advanced features

11. **44. Read Receipts UI**
    Schema has `read_receipts` table but the UI doesn't show who has read each message. Add per-message read indicators (checkmarks, avatar list on hover).

12. **45. Block/Mute Users**
    No user-level blocking. Requires new schema, API, and client-side message filtering for blocked users.

13. **46. Keyboard Shortcuts**
    No keyboard navigation. Add `Cmd+K` / `Ctrl+K` for search, `@mention` autocomplete, and chat navigation shortcuts.

14. **47. Full-Text Message Search**
    Search box exists but only filters client-side. Add a backend `tsvector`/`tsquery` full-text search index and search results UI with message jumping. Benefits from keyboard shortcut (#46) for discovery.

15. **48. Thread View**
    Schema supports `parentId` for replies but there's no expandable thread UI. Add a thread panel/drawer that shows the full reply chain for a message.

16. **49. Call Flow Completion**
    Voice call hooks and modal exist but the accept/reject/missed-call flow is incomplete. Finish WebRTC signaling, ringtone, and multi-screen call UI.
