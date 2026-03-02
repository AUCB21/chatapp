"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@/hooks/useChat";
import { useSessionStore } from "@/store/sessionStore";
import NewChatModal from "@/components/NewChatModal";
import VoiceCallControls from "@/components/VoiceCallControls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

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
    // Clear server-side session
    await fetch("/api/auth/logout", { method: "POST" });
    
    // Clear client-side Supabase session from localStorage
    const { supabase } = await import("@/lib/supabaseClient");
    await supabase.auth.signOut();
    
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
    <div className="flex h-screen bg-background overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-95 shrink-0 border-r flex flex-col">

        {/* Header */}
        <div className="px-5 h-16 border-b flex items-center justify-between shrink-0">
          <span className="font-semibold text-base tracking-tight">Chat App</span>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground truncate max-w-30">
              {user?.email}
            </span>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="text-xs h-auto py-1"
            >
              Logout
            </Button>
          </div>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">

            {/* New chat — first row */}
            <button
              onClick={() => setModalOpen(true)}
              className="w-full text-left px-5 py-4 border-b flex items-center gap-4 hover:bg-muted transition"
            >
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shrink-0 text-primary-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-6 h-6"
                >
                  <path d="M6 12L3.269 3.125A59.8 59.8 0 0 1 21.486 12a59.8 59.8 0 0 1-18.217 8.875zm0 0h7.5"/>
                </svg>
              </div>
            <div>
              <p className="text-sm font-medium">New chat</p>
              <p className="text-xs text-muted-foreground mt-0.5">Invite someone by email</p>
            </div>
          </button>

          {loading.chats && (
            <p className="text-xs text-muted-foreground px-5 py-4">Loading chats…</p>
          )}
          {error.chats && (
            <p className="text-xs text-destructive px-5 py-4">{error.chats}</p>
          )}
          {!loading.chats && chats.length === 0 && (
            <p className="text-xs text-muted-foreground text-center px-5 py-10">
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
                className={`w-full text-left px-5 py-4 border-b flex items-center gap-4 transition cursor-pointer ${
                  isActive ? "bg-muted" : "hover:bg-muted/50"
                }`}
              >
                <Avatar className="w-12 h-12 shrink-0">
                  <AvatarFallback className={pending ? "bg-muted text-muted-foreground" : ""}>
                    {chat.name[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-semibold truncate ${
                      pending ? "text-muted-foreground" : ""
                    }`}
                  >
                    {chat.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {pending ? "Invited" : chat.role}
                  </p>
                </div>

                {pending && (
                  <div
                    className="flex gap-1.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      onClick={() => handleJoin(chat.id)}
                      disabled={!!joiningChatId}
                      size="sm"
                      className="text-xs h-auto px-3 py-1.5 rounded-full"
                    >
                      {isJoining ? "…" : "Accept"}
                    </Button>
                    <Button
                      onClick={() => handleDecline(chat.id)}
                      disabled={!!joiningChatId}
                      variant="secondary"
                      size="sm"
                      className="text-xs h-auto px-3 py-1.5 rounded-full"
                    >
                      Decline
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          </ScrollArea>
        </div>
      </aside>

      {/* ── Main panel ── */}
      <main className="flex-1 flex flex-col min-w-0">
        {activeChat ? (
          <>
            {/* Chat header */}
            <div className="h-16 px-6 border-b flex items-center gap-4 shrink-0">
              <Avatar className="w-10 h-10 shrink-0">
                <AvatarFallback className={isPending ? "bg-muted text-muted-foreground" : ""}>
                  {activeChat.name[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-semibold leading-tight">
                  {activeChat.name}
                </p>
                <p className="text-xs text-muted-foreground capitalize mt-0.5">
                  {isPending ? "Pending invitation" : activeChat.role}
                </p>
              </div>
              
              {/* Voice call controls */}
              <VoiceCallControls
                chatId={activeChatId}
                chatName={activeChat.name}
                canCall={!isPending && canWrite}
              />
            </div>

            {/* Pending: accept / decline prompt */}
            {isPending ? (
              <div className="flex-1 flex items-center justify-center px-6">
                <div className="text-center max-w-xs">
                  <Avatar className="w-16 h-16 mx-auto mb-5">
                    <AvatarFallback className="bg-muted text-muted-foreground text-2xl">
                      {activeChat.name[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-sm font-semibold mb-1">
                    {activeChat.name}
                  </p>
                  <p className="text-xs text-muted-foreground mb-7">
                    You&apos;ve been invited to join this chat.
                    Accept to start reading and sending messages.
                  </p>

                  {joinError && (
                    <p className="text-xs text-destructive mb-4">{joinError}</p>
                  )}

                  <div className="flex gap-3 justify-center">
                    <Button
                      onClick={() => handleJoin(activeChatId!)}
                      disabled={!!joiningChatId}
                      size="lg"
                      className="px-7 rounded-full"
                    >
                      {joiningChatId === activeChatId ? "Joining…" : "Accept"}
                    </Button>
                    <Button
                      onClick={() => handleDecline(activeChatId!)}
                      disabled={!!joiningChatId}
                      variant="secondary"
                      size="lg"
                      className="px-7 rounded-full"
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full px-6 py-5">
                    <div className="flex flex-col gap-1">
                    {loading.messages && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Loading messages…
                      </p>
                    )}
                    {!loading.messages && messages.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-10">
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
                                ? `bg-primary text-primary-foreground rounded-br-sm ${isOptimistic ? "opacity-60" : ""}`
                                : "bg-muted rounded-bl-sm"
                            }`}
                          >
                            <p className="whitespace-pre-wrap wrap-break-word">
                              {msg.content}
                            </p>
                            <p className="text-[11px] mt-1 opacity-70 text-right">
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
                  </ScrollArea>
                </div>

                {/* Input area */}
                {canWrite ? (
                  <form
                    onSubmit={handleSend}
                    className="px-5 py-4 border-t flex items-center gap-3 shrink-0"
                  >
                    <Input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Type a message…"
                      className="flex-1 rounded-full"
                    />
                    <Button
                      type="submit"
                      disabled={!input.trim()}
                      className="rounded-full px-6"
                    >
                      Send
                    </Button>
                  </form>
                ) : (
                  <div className="px-6 py-4 border-t shrink-0">
                    <p className="text-xs text-muted-foreground text-center">
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
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-7 h-7 text-muted-foreground"
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
              <p className="text-sm font-medium text-muted-foreground">
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
