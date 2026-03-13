# EPS Chat App

Welcome to **EPS Chat App** — a real-time messaging workspace designed to be used immediately.

This repository is intended as a **plug-and-play experience** for exploring the product, not as a setup guide.

## Quick Tour

### 1) Sign in
- Open the app and authenticate.
- Session sync is already integrated so chat/call features can start right away.

### 2) Land on Home
- The left sidebar shows your conversations.
- Select any chat to enter the conversation view.
- Use the top-left back arrow to return to “select chat” mode.

### 3) Start a conversation
- Click **New chat** from the sidebar.
- Create a chat and either:
  - invite one person directly by email, or
  - generate a shareable invite link.

### 4) Message naturally
- Send normal text messages.
- Use markdown-style content in messages:
  - links: `[label](https://...)`
  - raw URLs: `https://...`
  - inline code: `` `code` ``
  - code blocks: triple backticks
- React, reply, edit, and delete from message interactions.

### 5) Presence and collaboration
- See online status and typing activity in active chats.
- Accept/decline pending invites directly in the chat flow.

### 6) Call and share
- Start voice calls per chat.
- Toggle mute while connected.
- Start/receive screen sharing during calls.

## What You’re Looking At

- **Sidebar**: chats, quick actions, account strip.
- **Header**: chat identity, presence, call/share controls.
- **Message area**: timeline, reactions, context actions, typing signal.
- **Composer**: multiline input (`Enter` sends, `Shift+Enter` adds a newline).

## Product Principles

- Fast real-time updates
- Minimal friction invites
- Clear roles and permissions
- Lightweight, modern chat UI

## Notes

- This project already includes auth, realtime sync, invite flow, and call/share UX.
- Treat this README as a **feature tour**. No repository modification steps are required here.
