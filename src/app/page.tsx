"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@/hooks/useChat";
import { usePresence } from "@/hooks/usePresence";
import { useSessionStore } from "@/store/sessionStore";
import { groupReactions } from "@/store/chatStore";
import { useScreenShare } from "@/hooks/useScreenShare";
import { useVoiceCall } from "@/hooks/useVoiceCall";
import NewChatModal from "@/components/NewChatModal";
import VoiceCallControls from "@/components/VoiceCallControls";
import ScreenShareControls from "@/components/ScreenShareControls";
import ScreenShareViewer from "@/components/ScreenShareViewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export default function ChatPage() {
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const clearSession = useSessionStore((s) => s.clearSession);

  const {
    chats,
    messages,
    reactions,
    activeChatId,
    canWrite,
    loading,
    error,
    setActiveChat,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    refreshChats,
    joinChat,
    declineChat,
  } = useChat();

  const { shareStatus, presenter } = useScreenShare(activeChatId);
  const { callStatus } = useVoiceCall(activeChatId);
  const { onlineUsers, typingUsers, startTyping, stopTyping } = usePresence(activeChatId);

  const [input, setInput] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joiningChatId, setJoiningChatId] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [contextMenuMsgId, setContextMenuMsgId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [replyTo, setReplyTo] = useState<{ id: string; content: string } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null); // messageId
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const reactionGrouped = groupReactions(reactions);

  // Common emoji set for quick reactions
  const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChatId, messages.length]);

  // Check scroll position to show/hide scroll-to-bottom button
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Find the ScrollArea viewport element
    const viewport = container.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement;
    if (!viewport) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom && messages.length > 0);
    };

    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [messages.length, activeChatId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Clear join error when switching chats
  useEffect(() => {
    setJoinError(null);
  }, [activeChatId]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    if (!showEmojiPicker) return;
    
    const handleClickOutside = () => setShowEmojiPicker(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showEmojiPicker]);

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
    stopTyping();
    await sendMessage(content, replyTo?.id);
    setReplyTo(null);
  }

  function handleInputChange(value: string) {
    setInput(value);
    if (value.trim()) startTyping();
    else stopTyping();
  }

  function handleContextMenu(
    e: React.MouseEvent,
    msgId: string,
    isOwn: boolean
  ) {
    if (!isOwn) {
      // Non-own messages: only allow reactions
      e.preventDefault();
      setShowEmojiPicker(msgId);
      return;
    }
    e.preventDefault();
    setContextMenuMsgId(msgId);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  }

  function handleStartEdit(msgId: string, content: string) {
    setEditingMessageId(msgId);
    setEditContent(content);
    setContextMenuMsgId(null);
  }

  async function handleSaveEdit() {
    if (!editingMessageId || !editContent.trim()) return;
    await editMessage(editingMessageId, editContent.trim());
    setEditingMessageId(null);
    setEditContent("");
  }

  async function handleDelete(msgId: string) {
    setContextMenuMsgId(null);
    await deleteMessage(msgId);
  }

  function handleReply(msgId: string, content: string) {
    setReplyTo({ id: msgId, content: content.slice(0, 80) });
    setContextMenuMsgId(null);
  }

  async function handleDeleteAccount() {
    if (!confirm("Are you sure? This will permanently delete your account and all data. This cannot be undone.")) return;
    setDeletingAccount(true);
    try {
      const res = await fetch("/api/auth/account", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      const { supabase } = await import("@/lib/supabaseClient");
      await supabase.auth.signOut();
      clearSession();
      router.push("/login");
    } catch {
      alert("Failed to delete account.");
    } finally {
      setDeletingAccount(false);
    }
  }

  // Close context menu on click elsewhere
  useEffect(() => {
    if (!contextMenuMsgId) return;
    const close = () => setContextMenuMsgId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenuMsgId]);

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

  // Sidebar content (shared between desktop aside and mobile Sheet)
  const sidebarContent = (
    <>
      {/* Header */}
      <div className="px-4 md:px-5 h-14 md:h-16 border-b flex items-center justify-between shrink-0">
        <span className="font-semibold text-base tracking-tight">Chat App</span>
        <div className="flex items-center gap-2 md:gap-4">
          <span className="text-xs text-muted-foreground truncate max-w-20 md:max-w-30">
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
          {/* <Button
            onClick={handleDeleteAccount}
            variant="ghost"
            size="sm"
            className="text-xs h-auto py-1 text-destructive hover:text-destructive"
            disabled={deletingAccount}
          >
            {deletingAccount ? "Deleting…" : "Delete Account"}
          </Button> */}
        </div>
      </div>

        {/* Chat list */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">

            {/* New chat — first row */}
            <button
              onClick={() => { setModalOpen(true); setSidebarOpen(false); }}
              className="w-full text-left px-4 md:px-5 py-3 md:py-4 border-b flex items-center gap-3 md:gap-4 hover:bg-muted transition"
            >
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary flex items-center justify-center shrink-0 text-primary-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5 md:w-6 md:h-6"
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
                onClick={() => { setActiveChat(chat.id); setSidebarOpen(false); }}
                className={`w-full text-left px-4 md:px-5 py-3 md:py-4 border-b flex items-center gap-3 md:gap-4 transition cursor-pointer ${
                  isActive ? "bg-muted" : "hover:bg-muted/50"
                }`}
              >
                <Avatar className="w-10 h-10 md:w-12 md:h-12 shrink-0">
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
    </>
  );

  return (
    <div className="flex h-dvh bg-background overflow-hidden">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex w-[min(24rem,30vw)] shrink-0 border-r flex-col">
        {sidebarContent}
      </aside>

      {/* ── Mobile Sidebar (Sheet) ── */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[80vw] max-w-sm p-0 flex flex-col">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* ── Main panel ── */}
      <main className="flex-1 flex flex-col min-w-0">
        {activeChat ? (
          <>
            {/* Chat header */}
            <div className="h-14 md:h-16 px-3 md:px-6 border-b flex items-center gap-2 md:gap-4 shrink-0">
              {/* Mobile back / hamburger button */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden shrink-0 w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                aria-label="Open sidebar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <Avatar className="w-9 h-9 md:w-10 md:h-10 shrink-0">
                <AvatarFallback className={isPending ? "bg-muted text-muted-foreground" : ""}>
                  {activeChat.name[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight">
                  {activeChat.name}
                </p>
                <p className="text-xs text-muted-foreground capitalize mt-0.5">
                  {isPending
                    ? "Pending invitation"
                    : onlineUsers.length > 0
                    ? `${onlineUsers.length} online`
                    : activeChat.role}
                </p>
              </div>
              
              {/* Voice call controls */}
              <VoiceCallControls
                chatId={activeChatId}
                chatName={activeChat.name}
                canCall={!isPending && canWrite}
              />
              
              {/* Screen share controls */}
              <ScreenShareControls
                chatId={activeChatId}
                chatName={activeChat.name}
                canShare={!isPending && canWrite}
                isInCall={callStatus === 'connected'}
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
                <div className="flex-1 overflow-hidden relative" ref={messagesContainerRef}>
                  <ScrollArea className="h-full px-3 md:px-6 py-3 md:py-5">
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
                      const isDeleted = !!msg.deletedAt;
                      const isEdited = !!msg.editedAt && !isDeleted;
                      const msgReactions = reactionGrouped[msg.id];
                      const parentMsg = msg.parentId
                        ? messages.find((m) => m.id === msg.parentId)
                        : null;

                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOwn ? "justify-end" : "justify-start"} ${
                            isSameUser ? "mt-0.5" : "mt-4"
                          } group relative`}
                          onContextMenu={(e) => handleContextMenu(e, msg.id, isOwn)}
                        >
                          <div className="max-w-[85%] md:max-w-[65%] relative">
                            {/* Reply preview */}
                            {parentMsg && (
                              <div className={`text-[0.6875rem] px-3 py-1 mb-0.5 rounded-t-lg border-l-2 border-primary/40 bg-muted/50 text-muted-foreground ${
                                isOwn ? "ml-auto" : ""
                              }`}>
                                ↩ {parentMsg.content.slice(0, 60)}{parentMsg.content.length > 60 ? "…" : ""}
                              </div>
                            )}

                            {/* Edit mode */}
                            {editingMessageId === msg.id ? (
                              <div className="flex gap-2 items-center">
                                <Input
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveEdit();
                                    if (e.key === "Escape") setEditingMessageId(null);
                                  }}
                                  className="text-sm"
                                  autoFocus
                                />
                                <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingMessageId(null)}>Cancel</Button>
                              </div>
                            ) : (
                              <div
                                className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                  isOwn
                                    ? `bg-primary text-primary-foreground rounded-br-sm ${isOptimistic ? "opacity-60" : ""}`
                                    : "bg-muted rounded-bl-sm"
                                } ${isDeleted ? "opacity-50 italic" : ""}`}
                              >
                                <p className="whitespace-pre-wrap wrap-break-word">
                                  {msg.content}
                                </p>
                                <div className="flex items-center gap-1.5 mt-1 justify-end">
                                  {isEdited && (
                                    <span className="text-[0.625rem] opacity-50">edited</span>
                                  )}
                                  <span className="text-[0.6875rem] opacity-70">
                                    {new Date(msg.createdAt).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                  {/* Message status indicators (own messages only) */}
                                  {isOwn && !isOptimistic && !isDeleted && (
                                    <span className="text-[0.6875rem]">
                                      {msg.status === "read" ? (
                                        <span className="text-blue-400">✓✓</span>
                                      ) : msg.status === "delivered" ? (
                                        <span className="opacity-70">✓✓</span>
                                      ) : (
                                        <span className="opacity-50">✓</span>
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Reactions display */}
                            {msgReactions && Object.keys(msgReactions).length > 0 && (
                              <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
                                {Object.entries(msgReactions).map(([emoji, data]) => (
                                  <button
                                    key={emoji}
                                    onClick={() => toggleReaction(msg.id, emoji)}
                                    className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors ${
                                      data.users.includes(user?.id || "")
                                        ? "bg-primary/10 border-primary/30"
                                        : "bg-muted/50 border-transparent hover:border-muted-foreground/20"
                                    }`}
                                  >
                                    <span>{emoji}</span>
                                    <span className="text-muted-foreground">{data.count}</span>
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Reaction button - positioned on left for sent, right for received */}
                            {!isDeleted && !editingMessageId && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id);
                                  }}
                                  className={`absolute top-1/2 -translate-y-1/2 ${
                                    isOwn ? "-left-8" : "-right-8"
                                  } opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center text-sm`}
                                  title="React"
                                >
                                  😊
                                </button>

                                {/* Emoji picker popover */}
                                {showEmojiPicker === msg.id && (
                                  <div 
                                    onClick={(e) => e.stopPropagation()}
                                    className={`absolute -top-12 ${
                                      isOwn ? "right-0" : "left-0"
                                    } z-10 flex items-center gap-1 px-2 py-1.5 rounded-full bg-popover border shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300`}
                                  >
                                    {QUICK_EMOJIS.map((emoji) => (
                                      <button
                                        key={emoji}
                                        onClick={() => {
                                          toggleReaction(msg.id, emoji);
                                          setShowEmojiPicker(null);
                                        }}
                                        className="text-lg w-8 h-8 rounded-full hover:bg-muted transition-colors flex items-center justify-center"
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                    {canWrite && (
                                      <>
                                        <div className="w-px h-6 bg-border mx-0.5" />
                                        <button
                                          onClick={() => {
                                            handleReply(msg.id, msg.content);
                                            setShowEmojiPicker(null);
                                          }}
                                          className="text-xs px-2 h-8 rounded-full hover:bg-muted transition-colors text-muted-foreground flex items-center gap-1"
                                        >
                                          <span>↩</span>
                                          <span className="hidden sm:inline">Reply</span>
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Typing indicator */}
                    {typingUsers.length > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex gap-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {typingUsers.length === 1
                            ? `${typingUsers[0].email.split("@")[0]} is typing…`
                            : `${typingUsers.length} people typing…`}
                        </span>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                  
                  {/* Context menu */}
                  {contextMenuMsgId && (
                    <div
                      className="fixed z-50 bg-popover border rounded-lg shadow-lg py-1 min-w-35"
                      style={{ top: contextMenuPos.y, left: contextMenuPos.x }}
                    >
                      <button
                        onClick={() => {
                          const msg = messages.find((m) => m.id === contextMenuMsgId);
                          if (msg) handleReply(msg.id, msg.content);
                        }}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                      >
                        Reply
                      </button>
                      <button
                        onClick={() => {
                          const msg = messages.find((m) => m.id === contextMenuMsgId);
                          if (msg && !msg.deletedAt) handleStartEdit(msg.id, msg.content);
                        }}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(contextMenuMsgId)}
                        className="w-full text-left px-3 py-1.5 text-sm text-destructive hover:bg-muted transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                  
                  {/* Scroll to bottom button */}
                  {showScrollButton && (
                    <Button
                      onClick={scrollToBottom}
                      size="sm"
                      className="absolute bottom-6 right-6 rounded-full shadow-lg gap-2 z-10"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
                      </svg>
                      Go to bottom
                    </Button>
                  )}
                </div>

                {/* Reply preview bar */}
                {replyTo && (
                  <div className="px-3 md:px-5 py-2 border-t bg-muted/50 flex items-center gap-3 shrink-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Replying to:</p>
                      <p className="text-sm truncate">{replyTo.content}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setReplyTo(null)}
                      className="shrink-0"
                    >
                      ✕
                    </Button>
                  </div>
                )}

                {/* Input area */}
                {canWrite ? (
                  <form
                    onSubmit={handleSend}
                    className="px-3 md:px-5 py-3 md:py-4 border-t flex items-center gap-2 md:gap-3 shrink-0"
                  >
                    <Input
                      type="text"
                      value={input}
                      onChange={(e) => handleInputChange(e.target.value)}
                      placeholder={replyTo ? "Reply…" : "Type a message…"}
                      className="flex-1 rounded-full text-base md:text-sm"
                    />
                    <Button
                      type="submit"
                      disabled={!input.trim()}
                      className="rounded-full px-4 md:px-6"
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
          <div className="flex-1 flex items-center justify-center px-6">
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
              <Button
                onClick={() => setSidebarOpen(true)}
                variant="outline"
                className="mt-4 md:hidden rounded-full"
              >
                Open chats
              </Button>
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

      {/* Screen Share Viewer */}
      <ScreenShareViewer
        isActive={shareStatus === 'viewing'}
        presenterName={presenter?.name || null}
        onClose={() => {}}
      />
    </div>
  );
}
