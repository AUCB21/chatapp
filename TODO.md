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

### ~~26. Invite Link Single-Use Enforcement~~ DONE
~~An accepted invite token is not invalidated server-side after use.~~ Invite validation and accept flows now reject tokens whose status is not `pending`.

### ~~25. Delete-for-Me Server-Side Persistence~~ DONE
~~"Delete for me" was stored only in `localStorage` per browser.~~ Hidden messages are now persisted server-side with a silent localStorage migration fallback for older clients.

---

## 🔴 High Priority — Users will hit these immediately

### Dependency-First Execution Order
1) **30** Login boot preload (faster first meaningful paint)
2) **5** Member management UI (foundation for profile editing)
3) **28** User menu + global profile settings
4) **29** Per-chat user detail overrides (depends on 5 + 28)
5) **16** File/image sharing MVP
6) **11** Storage hardening gate before production rollout of 16
7) **27** Jump/reaction overlay polish
8) **24** DB role restriction for production security
9) **9** Me-to-me personal chat

### 30. Login Boot Preload (Chats + First Page)
After successful login, preload core chat data and only render the main app once initial data is ready.

- Fetch chat list first, then preload the initial active chat messages using `PAGINATION_SIZE` (same first-page size as normal load).
- Add a boot/loading gate so the chat UI does not mount in a partially empty state.
- Keep a clear fallback: if preload fails, show retry/error state instead of rendering broken UI.
- Avoid duplicate fetches between bootstrap preload and existing `useChat` effects (single source of truth for initial load).
- Ensure unread counts, memberships, and active chat selection are hydrated before first paint.
- Measure login-to-interactive time to confirm preload improves perceived startup UX.

### 16. File / Image Sharing
The `<Paperclip>` button is rendered but does nothing. Implement file/image sharing with a single storage provider and attachment metadata in DB. Blocked by item 11 for production hardening.

**Recommended approach (MVP):** use one provider only (Supabase Storage) for now; delete the extra S3 bucket unless there is a strong non-functional requirement to keep it.

- Phase 0 — Storage decision (required): choose exactly one provider for upload/read/delete paths and remove the unused one.
- Phase 1 — DB contract: add `attachments` table linked to `messages` with `message_id`, `uploader_user_id`, `storage_provider`, `storage_key`, `original_name`, `mime_type`, `size_bytes`, optional `width`/`height`, and `created_at`.
- Phase 1 — DB integrity: add indexes on `message_id` and `uploader_user_id`; cascade delete on `message_id`.
- Phase 2 — Upload API: implement server-authenticated upload flow (presigned URL or proxy upload), then store attachment metadata in DB.
- Phase 2 — Read API: return signed read URLs (short TTL), never expose raw bucket paths/public objects.
- Phase 3 — Message API: support text+attachment and attachment-only messages consistently.
- Phase 4 — UI composer: wire `Paperclip` to file picker, show upload progress/error, and prevent send until upload result is known.
- Phase 4 — UI rendering: show image previews in `MessageBubble`, and file cards for non-image attachments.
- Phase 5 — Realtime/store: include attachments in optimistic messages, fetch, retry, and pagination payloads.
- Phase 6 — Deletion behavior: decide and implement whether message deletion also deletes storage objects immediately or via cleanup jobs.
- Phase 7 — Production gate: ship behind a feature flag, then complete item 11 before enabling broadly.

### 11. Per-User Storage Hardening (Prerequisite for production rollout)
After item 16 works in staging, harden the chosen storage provider before production rollout.

- Provider scope: enforce single-provider policy in code/config so uploads cannot drift across multiple buckets/providers.
- Access model: private objects only; read access via signed URLs from server APIs.
- Path convention: enforce deterministic keys, e.g. `chat/<chatId>/user/<userId>/<yyyy>/<mm>/<uuid>-<safeName>`.
- AuthZ checks: uploader/downloader must be a member of the target chat at request time.
- Validation policy: strict MIME allowlist, max file size, and optional dimension caps for images.
- Signed URL policy: short TTL (1–5 min), with refresh-on-demand for older messages.
- Quotas and limits: per-file, per-user, and optional per-chat usage limits with explicit API errors.
- Abuse controls: optional scanning/quarantine workflow for suspicious content before it becomes visible.
- Cleanup jobs: remove orphaned objects, failed-temp uploads, and (if chosen) files from deleted messages.
- Auditability: log upload/read/delete events with userId/chatId/storageKey for incident response.
- Release gate: keep item 16 behind a flag until hardening checks are validated in staging.

---

## 🟡 Medium Priority — Noticeable product gaps

### 5. Member Management UI
No way to see who is in a chat, add members after creation, or view/change roles. Needs a members panel (side sheet or modal) wired to the existing `/api/chat/[chatId]/members` endpoint.

### 28. User Menu & Profile Settings
Add a user menu/settings area for profile, account, and personalization controls.

- Show user identity details (display name and email) with editable profile fields.
- Add password update handler (current password + new password flow with validation and feedback).
- Add app appearance controls (theme colors/background style handler) and persist preferences.
- Add status selection (e.g., online/away/do-not-disturb) and reflect status in UI/presence.
- Add profile image selection/upload flow; store image using the storage approach from items 11/16.
- Wire existing Delete Account logic into the menu as a destructive action with confirmation UX.
- Define API/store boundaries for profile updates so changes sync across sessions/devices.

### 29. Per-Chat User Details Editing (Forked from item 28)
Allow modifying chat participants' visible details (username, profile picture, status, etc.) from chat management flows.

- Define scope clearly: global profile fields vs chat-specific overrides (recommended: chat-specific overrides).
- Rework schema if needed (new `chat_user_profiles` table or equivalent) keyed by `chat_id + user_id`.
- Add API endpoints for create/update/reset of chat-specific user details with role-based permissions.
- Add UI controls in member management to edit/display per-chat username, image, and status.
- Ensure fallback behavior: if chat-specific details are missing, use global user profile defaults.
- Update message, sidebar, and header renderers to read effective profile (chat override first, global second).
- Add migration/backfill plan so existing chats/users are not broken during schema transition.

### 9. Me-to-Me Personal Chat
Add a self-chat so each user has a personal notes/saved-messages space. Should appear as a pinned chat and work with normal message and search flows.

### 31. Invitation Email for Non-Existing Users
When a direct email invitation is sent and the target has no account, send a Supabase `inviteUserByEmail` signup magic-link. Requires `SUPABASE_SERVICE_ROLE_KEY` in env.

- Admin client utility created at `src/lib/supabaseAdmin.ts`.
- Fire-and-forget call in `POST /api/invite` — never blocks the invitation response.
- If user already exists, Supabase returns an error which is silently ignored.
- Redirect target: `/login` so the new user lands on the login page after signup.

---

## 🔵 Lower Priority — Polish & Security

### 24. Restrict DB Role for Production
`DATABASE_URL` currently connects as the DB owner (bypasses RLS). Create a dedicated `app_server` role with `GRANT SELECT, INSERT, UPDATE, DELETE` only — no `SUPERUSER` or `BYPASSRLS`. Reduces blast radius if the connection string leaks. See security analysis in chat history.

### 27. Jump-To-Message + Reaction Overlay Collision
The reaction overlay can overlap the message content and conflict with jump-to-message highlighting.

- Position the reaction overlay beside the target message bubble (left/right depending on ownership), not on top of message text.
- Ensure jump-to-message keeps the highlighted bubble fully visible and unobstructed.
- Keep overlay placement responsive on mobile and desktop, with no clipping at viewport edges.