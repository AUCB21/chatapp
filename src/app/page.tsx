"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@/hooks/useChat";
import { useSessionStore } from "@/store/sessionStore";
import NewChatModal from "@/components/NewChatModal";

export default function ChatPage() {
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const clearSession = useSessionStore((s) => s.clearSession);

  const {
    chats,
    messages,
    activeChatId,
    canWrite,
    loading,
    error,
    setActiveChat,
    sendMessage,
    refreshChats,
    joinChat,
    declineChat,
  } = useChat();

  const [input, setInput] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joiningChatId, setJoiningChatId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChatId, messages.length]);

  // Clear join error when switching chats
  useEffect(() => {
    setJoinError(null);
  }, [activeChatId]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearSession();
    router.push("/login");
  }

  async function handleSend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!input.trim()) return;
    const content = input;
    setInput("");
    await sendMessage(content);
  }

  async function handleJoin(chatId: string) {
    if (joiningChatId) return;
    setJoiningChatId(chatId);
    setJoinError(null);
    try {
      await joinChat(chatId);
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setJoiningChatId(null);
    }
  }

  async function handleDecline(chatId: string) {
    if (joiningChatId) return;
    setJoiningChatId(chatId);
    setJoinError(null);
    try {
      await declineChat(chatId);
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setJoiningChatId(null);
    }
  }

  const activeChat = chats.find((c) => c.id === activeChatId);
  const isPending = activeChat?.role === "pending";

  return (
    <div className="flex h-screen bg-white overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-95 shrink-0 border-r border-neutral-200 flex flex-col">

        {/* Header */}
        <div className="px-5 h-16 border-b border-neutral-200 flex items-center justify-between shrink-0">
          <span className="font-semibold text-base tracking-tight">Chat App</span>
          <div className="flex items-center gap-4">
            <span className="text-xs text-neutral-400 truncate max-w-30">
              {user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="text-xs text-neutral-400 hover:text-neutral-900 transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto">

          {/* New chat — first row */}
          <button
            onClick={() => setModalOpen(true)}
            className="w-full text-left px-5 py-4 border-b border-neutral-100 flex items-center gap-4 hover:bg-neutral-50 transition"
          >
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-neutral-300 flex items-center justify-center shrink-0 text-neutral-400 text-xl leading-none">
              +
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-600">New chat</p>
              <p className="text-xs text-neutral-400 mt-0.5">Invite someone by email</p>
            </div>
          </button>

          {loading.chats && (
            <p className="text-xs text-neutral-400 px-5 py-4">Loading chats…</p>
          )}
          {error.chats && (
            <p className="text-xs text-red-500 px-5 py-4">{error.chats}</p>
          )}
          {!loading.chats && chats.length === 0 && (
            <p className="text-xs text-neutral-400 text-center px-5 py-10">
              No chats yet.
            </p>
          )}

          {chats.map((chat) => {
            const isActive = chat.id === activeChatId;
            const pending = chat.role === "pending";
            const isJoining = joiningChatId === chat.id;
            return (
              <div
                key={chat.id}
                onClick={() => setActiveChat(chat.id)}
                className={`w-full text-left px-5 py-4 border-b border-neutral-100 flex items-center gap-4 transition cursor-pointer ${
                  isActive ? "bg-neutral-100" : "hover:bg-neutral-50"
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-base font-semibold ${
                    pending
                      ? "bg-neutral-100 text-neutral-400"
                      : "bg-neutral-200 text-neutral-600"
                  }`}
                >
                  {chat.name[0].toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-semibold truncate ${
                      pending ? "text-neutral-400" : "text-neutral-900"
                    }`}
                  >
                    {chat.name}
                  </p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {pending ? "Invited" : chat.role}
                  </p>
                </div>

                {pending && (
                  <div
                    className="flex gap-1.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleJoin(chat.id)}
                      disabled={!!joiningChatId}
                      className="text-xs px-3 py-1.5 rounded-full bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      {isJoining ? "…" : "Accept"}
                    </button>
                    <button
                      onClick={() => handleDecline(chat.id)}
                      disabled={!!joiningChatId}
                      className="text-xs px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-600 hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* ── Main panel ── */}
      <main className="flex-1 flex flex-col min-w-0">
        {activeChat ? (
          <>
            {/* Chat header */}
            <div className="h-16 px-6 border-b border-neutral-200 flex items-center gap-4 shrink-0">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                  isPending
                    ? "bg-neutral-100 text-neutral-400"
                    : "bg-neutral-200 text-neutral-600"
                }`}
              >
                {activeChat.name[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight text-neutral-900">
                  {activeChat.name}
                </p>
                <p className="text-xs text-neutral-400 capitalize mt-0.5">
                  {isPending ? "Pending invitation" : activeChat.role}
                </p>
              </div>
            </div>

            {/* Pending: accept / decline prompt */}
            {isPending ? (
              <div className="flex-1 flex items-center justify-center px-6">
                <div className="text-center max-w-xs">
                  <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-5 text-2xl font-semibold text-neutral-400">
                    {activeChat.name[0].toUpperCase()}
                  </div>
                  <p className="text-sm font-semibold text-neutral-900 mb-1">
                    {activeChat.name}
                  </p>
                  <p className="text-xs text-neutral-400 mb-7">
                    You&apos;ve been invited to join this chat.
                    Accept to start reading and sending messages.
                  </p>

                  {joinError && (
                    <p className="text-xs text-red-500 mb-4">{joinError}</p>
                  )}

                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => handleJoin(activeChatId!)}
                      disabled={!!joiningChatId}
                      className="bg-neutral-900 text-white text-sm px-7 py-2.5 rounded-full hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      {joiningChatId === activeChatId ? "Joining…" : "Accept"}
                    </button>
                    <button
                      onClick={() => handleDecline(activeChatId!)}
                      disabled={!!joiningChatId}
                      className="bg-neutral-100 text-neutral-700 text-sm px-7 py-2.5 rounded-full hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-1">
                  {loading.messages && (
                    <p className="text-xs text-neutral-400 text-center py-4">
                      Loading messages…
                    </p>
                  )}
                  {!loading.messages && messages.length === 0 && (
                    <p className="text-xs text-neutral-400 text-center py-10">
                      No messages yet. Say something!
                    </p>
                  )}

                  {messages.map((msg, i) => {
                    const isOwn =
                      msg.userId === user?.id || msg.userId === "optimistic";
                    const isOptimistic = msg.id.startsWith("optimistic-");
                    const prevMsg = messages[i - 1];
                    const isSameUser = prevMsg?.userId === msg.userId;

                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwn ? "justify-end" : "justify-start"} ${
                          isSameUser ? "mt-0.5" : "mt-4"
                        }`}
                      >
                        <div
                          className={`max-w-[65%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                            isOwn
                              ? `bg-neutral-900 text-white rounded-br-sm ${isOptimistic ? "opacity-60" : ""}`
                              : "bg-neutral-100 text-neutral-900 rounded-bl-sm"
                          }`}
                        >
                          <p className="whitespace-pre-wrap wrap-break-word">
                            {msg.content}
                          </p>
                          <p className="text-[11px] mt-1 text-neutral-400 text-right">
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                {canWrite ? (
                  <form
                    onSubmit={handleSend}
                    className="px-5 py-4 border-t border-neutral-200 flex items-center gap-3 shrink-0"
                  >
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Type a message…"
                      className="flex-1 bg-neutral-100 rounded-full px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-neutral-900 transition"
                    />
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      className="bg-neutral-900 text-white text-sm px-6 py-3 rounded-full hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      Send
                    </button>
                  </form>
                ) : (
                  <div className="px-6 py-4 border-t border-neutral-200 shrink-0">
                    <p className="text-xs text-neutral-400 text-center">
                      You have read-only access to this chat.
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-7 h-7 text-neutral-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-neutral-500">
                Select a chat to start messaging
              </p>
            </div>
          </div>
        )}
      </main>

      <NewChatModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onChatCreated={async (chatId) => {
          await refreshChats();
          setActiveChat(chatId);
        }}
      />
    </div>
  );
}
