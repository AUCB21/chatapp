# EPS Chat App — What to Build Next

## 🔵 Lower Priority — Polish

### ~~1. Invite Link Expiry Enforcement~~ DONE
~~No UI or server-side enforcement of invite link expiry beyond whatever is stored in the DB. Should show a clear "This link has expired" page and prevent join attempts past the expiry date.~~

### 2. Mute / Unread State — PENDING TEST
No per-chat notification control. Users cannot mute noisy chats or see an unread badge count. Needs a `muted` flag per membership row and a client-side unread counter driven by Realtime events.

### ~~3. Retry on Failed Optimistic Send~~ DONE — PENDING TEST
~~Failed messages (network error during optimistic send) currently disappear silently. Should persist in the UI with a "Failed — tap to retry" state and a re-send action.~~

---

## 🟡 Medium Priority — Noticeable product gaps

### ~~4. Real Read Receipt Logic~~ DONE — PENDING TEST
~~`msg.status` is rendered (✓✓ ticks) in `MessageBubble` but is never actually updated to `"read"` anywhere in the codebase. Needs an update call when a message scrolls into view (IntersectionObserver) and a Realtime broadcast back to the sender.~~

### 5. Member Management UI — PENDING TEST
No way to see who is in a chat, add members after creation, or view/change roles. Needs a members panel (side sheet or modal) wired to the existing `/api/chat/[chatId]/members` endpoint.

### ~~6. Reconnection Feedback~~ DONE — PENDING TEST
~~Silent failure when the Supabase Realtime connection drops. Should show a dismissible banner ("Reconnecting…" / "Back online") so users know their messages may not be delivered.~~

### 7. Message Search — PENDING TEST
No in-chat search at all. Needs a search input in the header or sidebar that queries messages by content (full-text search via Postgres `tsvector` or `ilike`).

### ~~8. Forgot Password Handler~~ DONE — PENDING TEST
~~Add a dedicated **Forgot Password** view/flow that calls Supabase's password reset method, with confirmation feedback and redirect handling for reset completion.~~

### 9. Me-to-Me Personal Chat — PENDING TEST
Add a self-chat feature so each user has a personal conversation space (notes/saved messages). This should appear as a dedicated chat and work with normal message, media, and search flows.

### 10. Missed Call Message in Chat — PENDING TEST
When a call goes unanswered or is declined, insert a system-style message into the chat timeline (e.g., "Missed voice call" / "Missed video call") with a timestamp and a callback button. Requires a `type` field on messages (or a dedicated `call_events` table) to distinguish call events from regular text. Depends on the call feature being in place first.

### 11. Per-User Supabase Storage Hardening — PENDING TEST
After attachment support ships, harden Supabase Storage for per-user isolation: bucket policy review, path conventions, quotas/limits, and cleanup lifecycle.

### 20. User Details / Chat Field Height Alignment — PENDING TEST
Fix misalignment between the **User details area** and the **chat text field** heights so both rows align consistently across desktop and mobile breakpoints.

---

## 🔴 High Priority — Users will hit these immediately

### ~~12. Typing Indicator UI~~ DONE (was already implemented) — PENDING TEST
~~The hooks (`usePresence`, `typingUsers`) already exist and are wired up in `page.tsx`. It just needs a render — a ~20-line addition showing "Alice is typing…" above the message input when another member is active.~~

### ~~13. Date Separators~~ DONE — PENDING TEST
~~Show "Today", "Yesterday", and "March 10" between messages grouped by day. Pure UI, no backend changes needed — derive from each message's `created_at` timestamp.~~

### ~~14. Header Back-To-Home Behavior~~ DONE — PENDING TEST
~~When a chat is open, the left arrow in `ChatHeader` should return to "select chat" mode (clear `activeChatId`) instead of only opening/toggling sidebar behavior. This should work consistently on mobile and desktop layouts.~~

### 15. Message Pagination — PENDING TEST
Currently loads all messages at once via a single query. Will degrade severely with any real usage volume. Needs cursor-based pagination (load older messages on scroll-to-top) and a virtual/windowed list.

### 16. File / Image Sharing — PENDING TEST
The `<Paperclip>` button is rendered but does nothing. Needs a file picker, upload to Supabase Storage, and a rendered preview/download in `MessageBubble`. Requires a new `attachments` column or table.

### 17. Single Message Deletion Modes — PENDING TEST
Add per-message deletion options using the same dual logic pattern: **delete for me** and **delete for everybody**. If deleted for everybody, the message should remain in timeline with replacement text: **"message deleted by sender"**.

### ~~18. Push Notifications~~ DONE — PENDING TEST
~~No browser notification fires when the tab is unfocused. Users will miss messages. Implement the Web Notifications API (request permission on login) and trigger on incoming Realtime message events.~~ Also added ping sound for new messages and unread badge counter per chat.

### ~~19. Notification Icon Reliability / Speed~~ DONE — PENDING TEST
~~Notification icon behavior is not working consistently (or feels too slow).~~ Replaced with a global Realtime subscription driving instant unread badges + document title counter (e.g. "(3) EPS Chat"). Also added incoming-call ringtone via Web Audio API.

### ~~21. Logout Icon Color (Reddish)~~ DONE — PENDING TEST
~~Change the logout icon color to a reddish tone to better signal a destructive/exit action while preserving contrast and accessibility.~~

### ~~22. Call Button Font Consistency~~ DONE — PENDING TEST
~~Update the "Call" button text to use the same project font styling as the rest of the UI for visual consistency.~~
