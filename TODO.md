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

### 16. File / Image Sharing
The `<Paperclip>` button is rendered but does nothing. Needs a file picker, upload to Supabase Storage, and a rendered preview/download in `MessageBubble`. Requires a new `attachments` column or table. Blocked by item 11 (storage hardening) if targeting production.

- DB: add an `attachments` table keyed to `messages` with fields for `message_id`, `uploader_user_id`, `storage_key`, `original_name`, `mime_type`, `size_bytes`, `width`, `height`, and `created_at`.
- DB: add indexes on `message_id` and `uploader_user_id`, plus FK cascade on `message_id` so attachment rows are cleaned up with deleted messages.
- API: extend message send flow to support attachment metadata alongside text-only messages.
- API: add a server upload flow for S3 using either presigned upload URLs or a server-side proxy upload route.
- API: add a secure download/read flow so the client renders attachments via signed URLs instead of exposing raw bucket paths.
- Validation: enforce allowed MIME types, max file size, max image dimensions, and filename normalization.
- UI: wire the `Paperclip` button in `MessageInput` to a hidden file input with upload progress and failure states.
- UI: render image thumbnails inline in `MessageBubble`, and render non-image files as downloadable attachment cards.
- UI: support mixed messages where a user sends text plus one attachment, and define whether attachment-only messages are allowed.
- Realtime/store: include attachment payloads in optimistic message creation, message fetches, retries, and pagination.
- Lifecycle: decide whether deleting a message should only hide the attachment in chat or also enqueue the S3 object for deletion.
- Security follow-up: after shipping, complete item 11 with per-user S3 path conventions, signed URL expiry, quotas, and cleanup rules.

---

## 🟡 Medium Priority — Noticeable product gaps

### 5. Member Management UI
No way to see who is in a chat, add members after creation, or view/change roles. Needs a members panel (side sheet or modal) wired to the existing `/api/chat/[chatId]/members` endpoint.

### 9. Me-to-Me Personal Chat
Add a self-chat so each user has a personal notes/saved-messages space. Should appear as a pinned chat and work with normal message and search flows.

### 11. Per-User Supabase Storage Hardening
After file sharing ships, harden Supabase Storage: bucket policy review, per-user path conventions, quotas/limits, cleanup lifecycle.

---

## 🔵 Lower Priority — Polish & Security

### 24. Restrict DB Role for Production
`DATABASE_URL` currently connects as the DB owner (bypasses RLS). Create a dedicated `app_server` role with `GRANT SELECT, INSERT, UPDATE, DELETE` only — no `SUPERUSER` or `BYPASSRLS`. Reduces blast radius if the connection string leaks. See security analysis in chat history.