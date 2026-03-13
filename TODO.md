# EPS Chat App — What to Build Next

## 🔴 High Priority — Users will hit these immediately

### 1. Typing Indicator UI
The hooks (`usePresence`, `typingUsers`) already exist and are wired up in `page.tsx`. It just needs a render — a ~20-line addition showing "Alice is typing…" above the message input when another member is active.

### 2. Date Separators
Show "Today", "Yesterday", and "March 10" between messages grouped by day. Pure UI, no backend changes needed — derive from each message's `created_at` timestamp.

### 3. Message Pagination
Currently loads all messages at once via a single query. Will degrade severely with any real usage volume. Needs cursor-based pagination (load older messages on scroll-to-top) and a virtual/windowed list.

### 4. File / Image Sharing
The `<Paperclip>` button is rendered but does nothing. Needs a file picker, upload to Supabase Storage, and a rendered preview/download in `MessageBubble`. Requires a new `attachments` column or table.

### 5. Push Notifications
No browser notification fires when the tab is unfocused. Users will miss messages. Implement the Web Notifications API (request permission on login) and trigger on incoming Realtime message events.

---

## 🟡 Medium Priority — Noticeable product gaps

### 6. Real Read Receipt Logic
`msg.status` is rendered (✓✓ ticks) in `MessageBubble` but is never actually updated to `"read"` anywhere in the codebase. Needs an update call when a message scrolls into view (IntersectionObserver) and a Realtime broadcast back to the sender.

### 7. Member Management UI
No way to see who is in a chat, add members after creation, or view/change roles. Needs a members panel (side sheet or modal) wired to the existing `/api/chat/[chatId]/members` endpoint.

### 8. Reconnection Feedback
Silent failure when the Supabase Realtime connection drops. Should show a dismissible banner ("Reconnecting…" / "Back online") so users know their messages may not be delivered.

### 9. Message Search
No in-chat search at all. Needs a search input in the header or sidebar that queries messages by content (full-text search via Postgres `tsvector` or `ilike`).

---

## 🔵 Lower Priority — Polish

### 10. Invite Link Expiry Enforcement
No UI or server-side enforcement of invite link expiry beyond whatever is stored in the DB. Should show a clear "This link has expired" page and prevent join attempts past the expiry date.

### 11. Mute / Unread State
No per-chat notification control. Users cannot mute noisy chats or see an unread badge count. Needs a `muted` flag per membership row and a client-side unread counter driven by Realtime events.

### 12. Retry on Failed Optimistic Send
Failed messages (network error during optimistic send) currently disappear silently. Should persist in the UI with a "Failed — tap to retry" state and a re-send action.

### 13. Header Back-To-Home Behavior
When a chat is open, the left arrow in `ChatHeader` should return to "select chat" mode (clear `activeChatId`) instead of only opening/toggling sidebar behavior. This should work consistently on mobile and desktop layouts.

### 14. Single Message Deletion Modes
Add per-message deletion options using the same dual logic pattern: **delete for me** and **delete for everybody**. If deleted for everybody, the message should remain in timeline with replacement text: **"message deleted by sender"**.

### 15. Per-User Supabase Storage Handling
Implement or refactor storage handling with Supabase Storage (S3-style object storage) scoped per user. Include clear path strategy, access rules, and upload/download lifecycle for attachments.

### 16. Me-to-Me Personal Chat
Add a self-chat feature so each user has a personal conversation space (notes/saved messages). This should appear as a dedicated chat and work with normal message, media, and search flows.
