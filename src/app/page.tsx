"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

import { useChat } from "@/hooks/useChat";
import { usePresence } from "@/hooks/usePresence";
import { useBootLoader } from "@/hooks/useBootLoader";
import { useIdleDetector } from "@/hooks/useIdleDetector";
import { useSessionStore } from "@/store/sessionStore";
import { groupReactions, useChatStore } from "@/store/chatStore";
import { useProfileStore, selectIsDnd } from "@/store/profileStore";
import { unlockAudio } from "@/lib/sounds";
import { useScreenShare } from "@/hooks/useScreenShare";
import { useVoiceCall } from "@/hooks/useVoiceCall";
import NewChatModal from "@/components/NewChatModal";
import ScreenShareViewer from "@/components/ScreenShareViewer";
import CallModal from "@/components/CallModal";
import BootScreen from "@/components/BootScreen";
import SettingsView from "@/components/chat/SettingsView";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatHeader from "@/components/chat/ChatHeader";
import MessageBubble from "@/components/chat/MessageBubble";
import MessageInput from "@/components/chat/MessageInput";
import PendingPrompt from "@/components/chat/PendingPrompt";
import EmptyChatState from "@/components/chat/EmptyChatState";
import MembersPanel from "@/components/chat/MembersPanel";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";
import { useMutedChats } from "@/hooks/useMutedChats";
import { supabase } from "@/lib/supabaseClient";

function formatDateSeparator(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = today.getTime() - target.getTime();
  const oneDay = 86_400_000;

  if (diff < oneDay) return "Today";
  if (diff < oneDay * 2) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    ...(date.getFullYear() !== now.getFullYear() && { year: "numeric" }),
  });
}

function isDifferentDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() !== b.getFullYear() ||
    a.getMonth() !== b.getMonth() ||
    a.getDate() !== b.getDate()
  );
}

export default function ChatPageWrapper() {
  const boot = useBootLoader();

  if (!boot.ready) {
    return <BootScreen progress={boot.progress} label={boot.label} />;
  }

  return <ChatPage />;
}

function ChatPage() {
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const clearSession = useSessionStore((s) => s.clearSession);
  const isDnd = useProfileStore(selectIsDnd);
  const profileStatus = useProfileStore((s) => s.profile?.status);
  const accentBg = useProfileStore((s) => s.profile?.accentBg);
  const accentFont = useProfileStore((s) => s.profile?.accentFont);
  const accentChat = useProfileStore((s) => s.profile?.accentChat);

  const {
    chats,
    messages,
    reactions,
    activeChatId,
    canWrite,
    loading,
    error,
    isLoadingMore,
    hasMoreMessages,
    setActiveChat,
    sendMessage,
    retrySend,
    editMessage,
    deleteMessage,
    deleteChat,
    toggleReaction,
    refreshChats,
    loadMoreMessages,
    joinChat,
    declineChat,
  } = useChat();

  const [incomingCallChatId, setIncomingCallChatId] = useState<string | null>(null);

  const {
    shareStatus,
    isIncomingShare,
    presenter,
    error: shareError,
    remoteStream,
    startSharing,
    stopSharing,
    rejectShare,
  } = useScreenShare(activeChatId);
  const {
    callStatus,
    isMuted,
    isIncomingCall,
    caller,
    error: callError,
    startCall,
    answerCall,
    rejectCall,
    hangUp,
    toggleMute,
  } = useVoiceCall(incomingCallChatId ?? activeChatId);
  const { onlineUsers, typingUsers, startTyping, stopTyping } =
    usePresence(activeChatId);
  const connectionStatus = useConnectionStatus();
  const { mutedChats, toggleMute: toggleChatMute } = useMutedChats();

  const [modalOpen, setModalOpen] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joiningChatId, setJoiningChatId] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [contextMenuMsgId, setContextMenuMsgId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [replyTo, setReplyTo] = useState<{
    id: string;
    content: string;
  } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [membersOpen, setMembersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const paginationScrollHeightRef = useRef<number | null>(null);
  const skipAutoScrollRef = useRef(false);

  const unreadCounts = useChatStore((s) => s.unreadCounts);
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  const reactionGrouped = groupReactions(reactions);
  const activeChat = chats.find((c) => c.id === activeChatId);
  const isPending = activeChat?.role === "pending";
  const isDeclined = activeChat?.role === "declined";

  /* ── Idle detection (Discord-style) ── */
  const onIdle = useCallback(() => {
    // Only auto-set to idle if user is currently "online"
    if (useProfileStore.getState().profile?.status === "online") {
      fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "idle" }),
      }).catch(() => {});
      useProfileStore.getState().updateProfile({ status: "idle" });
    }
  }, []);

  const onActive = useCallback(() => {
    // Restore to online when user becomes active (only from idle, not DND)
    if (useProfileStore.getState().profile?.status === "idle") {
      fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "online" }),
      }).catch(() => {});
      useProfileStore.getState().updateProfile({ status: "online" });
    }
  }, []);

  useIdleDetector(onIdle, onActive, profileStatus !== "dnd");

  /* ── Effects ── */

  useEffect(() => {
    if (paginationScrollHeightRef.current === null) return;

    const container = messagesContainerRef.current;
    if (!container) return;

    const viewport = container.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement;

    if (!viewport) return;

    viewport.scrollTop += viewport.scrollHeight - paginationScrollHeightRef.current;
    paginationScrollHeightRef.current = null;
  }, [messages.length]);

  useEffect(() => {
    if (skipAutoScrollRef.current) {
      skipAutoScrollRef.current = false;
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChatId, messages.length]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const viewport = container.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement;
    if (!viewport) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      setShowScrollButton(
        scrollHeight - scrollTop - clientHeight > 100 && messages.length > 0
      );
      if (scrollTop < 80 && hasMoreMessages && !isLoadingMore) {
        paginationScrollHeightRef.current = viewport.scrollHeight;
        skipAutoScrollRef.current = true;
        loadMoreMessages();
      }
    };
    viewport.addEventListener("scroll", handleScroll);
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, [messages.length, activeChatId, hasMoreMessages, isLoadingMore, loadMoreMessages]);

  useEffect(() => {
    setJoinError(null);
    setSearchMode(false);
    setSearchQuery("");
  }, [activeChatId]);

  // Request notification permission once on mount
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Unlock AudioContext + request notification permission on first click
  useEffect(() => {
    const handler = () => unlockAudio();
    document.addEventListener("click", handler, { once: true });
    return () => document.removeEventListener("click", handler);
  }, []);

  // Update document title with total unread count
  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) EPS Chat` : "EPS Chat";
  }, [totalUnread]);

  // Global incoming call detector — shows CallModal even when no chat is open
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("global-call-sessions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "call_sessions" },
        (payload) => {
          const raw = payload.new as Record<string, unknown> | undefined;
          if (!raw) { setIncomingCallChatId(null); return; }
          const createdBy = raw.created_by_user_id as string;
          const chatId = raw.chat_id as string;
          const status = raw.status as string;
          if (createdBy === user.id) return; // own call
          if (status === "ringing") {
            const state = useChatStore.getState();
            if (state.memberships[chatId]) setIncomingCallChatId(chatId);
          } else {
            setIncomingCallChatId(null);
          }
        }
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [user?.id]);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const close = () => setShowEmojiPicker(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [showEmojiPicker]);

  useEffect(() => {
    if (!contextMenuMsgId) return;
    const close = () => setContextMenuMsgId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenuMsgId]);

  /* ── Handlers ── */

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    const { supabase } = await import("@/lib/supabaseClient");
    await supabase.auth.signOut();
    clearSession();
    useChatStore.getState().reset();
    useProfileStore.getState().reset();
    router.push("/login");
  }

  async function handleDeleteAccount() {
    try {
      const res = await fetch("/api/auth/account", { method: "DELETE" });
      if (res.ok) {
        clearSession();
        useChatStore.getState().reset();
        useProfileStore.getState().reset();
        router.push("/login");
      }
    } catch {
      // silent — user stays on page
    }
  }

  async function handleSend(content: string) {
    stopTyping();
    await sendMessage(content, replyTo?.id);
    setReplyTo(null);
  }

  function handleTypingChange(isTyping: boolean) {
    if (isTyping) startTyping();
    else stopTyping();
  }

  function handleContextMenu(
    e: React.MouseEvent,
    msgId: string,
    isOwn: boolean
  ) {
    if (!isOwn) {
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

  async function handleDelete(msgId: string, mode: "for_me" | "for_everyone") {
    setContextMenuMsgId(null);
    await deleteMessage(msgId, mode);
  }

  function handleLoadMore() {
    const container = messagesContainerRef.current;
    const viewport = container?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement | null;

    if (viewport) {
      paginationScrollHeightRef.current = viewport.scrollHeight;
      skipAutoScrollRef.current = true;
    }

    loadMoreMessages();
  }

  function handleReply(msgId: string, content: string) {
    setReplyTo({ id: msgId, content: content.slice(0, 80) });
    setContextMenuMsgId(null);
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


  const handleSelectChat = (chatId: string) => {
    setActiveChat(chatId);
    setSidebarOpen(false);
  };

  const handleNewChat = () => {
    setModalOpen(true);
    setSidebarOpen(false);
  };

  async function handleDeleteChat(
    chatId: string,
    mode: "for_me" | "for_everyone"
  ) {
    try {
      await deleteChat(chatId, mode);
    } catch {
      // keep page stable; delete hook throws for consumer handling
    }
  }

  function handleJumpToMessage(messageId: string) {
    const target = document.querySelector(
      `[data-message-id="${messageId}"]`
    ) as HTMLElement | null;

    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(messageId);

    window.setTimeout(() => {
      setHighlightedMessageId((prev) => (prev === messageId ? null : prev));
    }, 1500);
  }

  /* ── Render ── */

  return (
    <div
      className="flex h-dvh bg-background text-foreground overflow-hidden"
      style={{
        ...(accentBg ? { backgroundColor: accentBg } : {}),
        ...(accentFont ? { color: accentFont } : {}),
      }}
    >
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[20rem] shrink-0 border-r flex-col">
        {settingsOpen ? (
          <SettingsView
            onBack={() => setSettingsOpen(false)}
            onLogout={handleLogout}
            onDeleteAccount={handleDeleteAccount}
          />
        ) : (
          <ChatSidebar
            chats={chats}
            activeChatId={activeChatId}
            loading={loading.chats}
            error={error.chats}
            userEmail={user?.email}
            joiningChatId={joiningChatId}
            unreadCounts={unreadCounts}
            onSelectChat={handleSelectChat}
            onJoin={handleJoin}
            onDecline={handleDecline}
            onNewChat={handleNewChat}
            onLogout={handleLogout}
            onOpenSettings={() => setSettingsOpen(true)}
            onDeleteChat={handleDeleteChat}
            mutedChats={mutedChats}
            onToggleMute={toggleChatMute}
          />
        )}
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[80vw] max-w-sm p-0 flex flex-col">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {settingsOpen ? (
            <SettingsView
              onBack={() => setSettingsOpen(false)}
              onLogout={handleLogout}
              onDeleteAccount={handleDeleteAccount}
            />
          ) : (
            <ChatSidebar
              chats={chats}
              activeChatId={activeChatId}
              loading={loading.chats}
              error={error.chats}
              userEmail={user?.email}
              joiningChatId={joiningChatId}
              unreadCounts={unreadCounts}
              onSelectChat={handleSelectChat}
              onJoin={handleJoin}
              onDecline={handleDecline}
              onNewChat={handleNewChat}
              onLogout={handleLogout}
              onOpenSettings={() => setSettingsOpen(true)}
              onDeleteChat={handleDeleteChat}
              mutedChats={mutedChats}
              onToggleMute={toggleChatMute}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Main panel */}
      <main className="flex-1 flex flex-col min-w-0 bg-background">
        {activeChat ? (
          <>
            <ChatHeader
              chat={activeChat}
              isPending={!!isPending}
              onlineUsers={onlineUsers}
              callStatus={callStatus}
              isMuted={isMuted}
              isIncomingCall={isIncomingCall}
              caller={caller}
              callError={callError}
              canWrite={canWrite}
              onStartCall={startCall}
              onAnswerCall={answerCall}
              onRejectCall={rejectCall}
              onHangUp={hangUp}
              onToggleMute={toggleMute}
              shareStatus={shareStatus}
              isIncomingShare={isIncomingShare}
              presenter={presenter}
              shareError={shareError}
              onStartSharing={startSharing}
              onStopSharing={stopSharing}
              onBack={() => setActiveChat(null)}
              onToggleSearch={() => setSearchMode((m) => !m)}
              onToggleMembers={() => setMembersOpen(true)}
            />

            {connectionStatus !== "connected" && (
              <div className={`px-3 py-1.5 text-xs font-medium text-center shrink-0 transition-colors ${
                connectionStatus === "disconnected"
                  ? "bg-destructive/10 text-destructive border-b border-destructive/20"
                  : "bg-emerald-500/10 text-emerald-500 border-b border-emerald-500/20"
              }`}>
                {connectionStatus === "disconnected"
                  ? "Connection lost — messages may not be delivered"
                  : "Back online"}
              </div>
            )}

            {isPending ? (
              <PendingPrompt
                chat={activeChat}
                joiningChatId={joiningChatId}
                joinError={joinError}
                onJoin={handleJoin}
                onDecline={handleDecline}
              />
            ) : isDeclined ? (
              <div className="flex-1 flex items-center justify-center px-6">
                <p className="text-sm text-muted-foreground">
                  Invitation declined. Closing chat...
                </p>
              </div>
            ) : (
              <>
                {/* Search bar */}
                {searchMode && (
                  <div className="px-3 py-2 border-b border-border flex items-center gap-2 shrink-0">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search messages…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                    />
                    <button
                      onClick={() => { setSearchMode(false); setSearchQuery(""); }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* Messages */}
                <div
                  className="flex-1 overflow-hidden relative"
                  ref={messagesContainerRef}
                >
                  <ScrollArea className="h-full px-4 md:px-6 py-4 md:py-6">
                    <div className="flex flex-col gap-1">
                      {/* Load more older messages */}
                      {hasMoreMessages && !searchMode && (
                        <div className="flex justify-center py-2">
                          {isLoadingMore ? (
                            <p className="text-xs text-muted-foreground">Loading…</p>
                          ) : (
                            <button
                              onClick={handleLoadMore}
                              className="text-xs text-primary hover:underline"
                            >
                              Load older messages
                            </button>
                          )}
                        </div>
                      )}

                      {loading.messages && (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          Loading messages…
                        </p>
                      )}
                      {!loading.messages && messages.length === 0 && !searchMode && (
                        <p className="text-xs text-muted-foreground text-center py-10">
                          No messages yet. Say something!
                        </p>
                      )}

                      {(searchMode && searchQuery
                        ? messages.filter((m) =>
                            m.content.toLowerCase().includes(searchQuery.toLowerCase()) &&
                            !m.deletedAt
                          )
                        : messages
                      ).map((msg, i, list) => {
                        const isOwn =
                          msg.userId === user?.id ||
                          msg.userId === "optimistic";
                        const prevMsg = list[i - 1];
                        const parentMsg = msg.parentId
                          ? (messages.find((m) => m.id === msg.parentId) ??
                            null)
                          : null;

                        const msgDate = new Date(msg.createdAt);
                        const showDateSeparator =
                          i === 0 ||
                          isDifferentDay(
                            msgDate,
                            new Date(prevMsg.createdAt)
                          );

                        return (
                          <div
                            key={msg.id}
                            data-message-id={msg.id}
                            className="scroll-mt-24"
                          >
                            {showDateSeparator && (
                              <div className="flex items-center gap-3 my-3">
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-[0.65rem] font-medium text-muted-foreground uppercase tracking-wider">
                                  {formatDateSeparator(msgDate)}
                                </span>
                                <div className="flex-1 h-px bg-border" />
                              </div>
                            )}
                            <MessageBubble
                              msg={msg}
                              isOwn={isOwn}
                              isOptimistic={msg.id.startsWith("optimistic-")}
                              isSameUser={!showDateSeparator && prevMsg?.userId === msg.userId}
                              parentMsg={parentMsg}
                              isHighlighted={highlightedMessageId === msg.id}
                              msgReactions={reactionGrouped[msg.id]}
                              editContent={
                                editingMessageId === msg.id
                                  ? editContent
                                  : null
                              }
                              isAnyEditing={!!editingMessageId}
                              isPickerOpen={showEmojiPicker === msg.id}
                              userId={user?.id || ""}
                              canWrite={canWrite}
                              onContextMenu={(e) =>
                                handleContextMenu(e, msg.id, isOwn)
                              }
                              onEditContent={setEditContent}
                              onSaveEdit={handleSaveEdit}
                              onCancelEdit={() => setEditingMessageId(null)}
                              onToggleReaction={(emoji) =>
                                toggleReaction(msg.id, emoji)
                              }
                              onSetPickerOpen={(open) =>
                                setShowEmojiPicker(open ? msg.id : null)
                              }
                              onReply={() =>
                                handleReply(msg.id, msg.content)
                              }
                              onJumpToMessage={handleJumpToMessage}
                              onRetry={
                                msg.id.startsWith("failed-")
                                  ? () => retrySend(msg.id)
                                  : undefined
                              }
                              onEdit={() => {
                                if (!msg.deletedAt) handleStartEdit(msg.id, msg.content);
                              }}
                              onDeleteForMe={() => handleDelete(msg.id, "for_me")}
                              onDeleteForEveryone={() => handleDelete(msg.id, "for_everyone")}
                            />
                          </div>
                        );
                      })}

                      {/* Typing indicator */}
                      {typingUsers.length > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex gap-0.5">
                            {[0, 150, 300].map((delay) => (
                              <span
                                key={delay}
                                className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                                style={{ animationDelay: `${delay}ms` }}
                              />
                            ))}
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
                      className="fixed z-50 bg-popover border rounded-xl shadow-lg py-1 min-w-35"
                      style={{
                        top: contextMenuPos.y,
                        left: contextMenuPos.x,
                      }}
                    >
                      <button
                        onClick={() => {
                          const msg = messages.find(
                            (m) => m.id === contextMenuMsgId
                          );
                          if (msg) handleReply(msg.id, msg.content);
                        }}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                      >
                        Reply
                      </button>
                      <button
                        onClick={() => {
                          const msg = messages.find(
                            (m) => m.id === contextMenuMsgId
                          );
                          if (msg && !msg.deletedAt)
                            handleStartEdit(msg.id, msg.content);
                        }}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(contextMenuMsgId, "for_me")}
                        className="w-full text-left px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
                      >
                        Delete for me
                      </button>
                      <button
                        onClick={() => handleDelete(contextMenuMsgId, "for_everyone")}
                        className="w-full text-left px-3 py-1.5 text-sm text-destructive hover:bg-muted transition-colors"
                      >
                        Delete for everyone
                      </button>
                    </div>
                  )}

                  {/* Scroll to bottom */}
                  {showScrollButton && (
                    <Button
                      onClick={() =>
                        messagesEndRef.current?.scrollIntoView({
                          behavior: "smooth",
                        })
                      }
                      size="icon"
                      className="absolute bottom-6 right-6 rounded-xl shadow-lg z-10"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3"
                        />
                      </svg>
                    </Button>
                  )}
                </div>

                <MessageInput
                  canWrite={canWrite}
                  replyTo={replyTo}
                  onSend={handleSend}
                  onTypingChange={handleTypingChange}
                  onJumpToReplyMessage={() =>
                    replyTo && handleJumpToMessage(replyTo.id)
                  }
                  onCancelReply={() => setReplyTo(null)}
                />
              </>
            )}
          </>
        ) : (
          <EmptyChatState onOpenSidebar={() => setSidebarOpen(true)} />
        )}
      </main>

      {activeChatId && (
        <MembersPanel
          chatId={activeChatId}
          open={membersOpen}
          onOpenChange={setMembersOpen}
          currentUserId={user?.id ?? ""}
          currentUserRole={activeChat?.role ?? "read"}
        />
      )}

      <NewChatModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onChatCreated={async (chatId) => {
          await refreshChats();
          setActiveChat(chatId);
        }}
      />

      <ScreenShareViewer
        isActive={shareStatus === "viewing"}
        presenterName={presenter?.name || null}
        remoteStream={remoteStream}
        onClose={rejectShare}
      />

      <CallModal
        chatName={(incomingCallChatId ? chats.find((c) => c.id === incomingCallChatId) : activeChat)?.name ?? activeChat?.name ?? ""}
        callStatus={callStatus}
        isMuted={isMuted}
        caller={caller}
        error={callError}
        isIncomingCall={isIncomingCall}
        currentUserEmail={user?.email ?? null}
        remoteParticipantName={
          caller?.name ??
          onlineUsers.find((u) => u.id !== user?.id)?.email?.split("@")[0] ??
          activeChat?.name ??
          null
        }
        onAnswerCall={answerCall}
        onRejectCall={rejectCall}
        onHangUp={hangUp}
        onToggleMute={toggleMute}
        shareStatus={shareStatus}
        onStartSharing={startSharing}
        onStopSharing={stopSharing}
      />
    </div>
  );
}
