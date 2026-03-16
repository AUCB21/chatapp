"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";

import { useChat } from "@/hooks/useChat";
import { usePresence } from "@/hooks/usePresence";
import { useBootLoader } from "@/hooks/useBootLoader";
import { useIdleDetector } from "@/hooks/useIdleDetector";
import { useSessionStore } from "@/store/sessionStore";
import { groupReactions, useChatStore, selectActiveChat, selectActiveReadReceipts } from "@/store/chatStore";
import { useProfileStore, selectIsDnd, selectProfileStatus } from "@/store/profileStore";
import { unlockAudio } from "@/lib/sounds";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useScreenShare } from "@/hooks/useScreenShare";
import { useVoiceCall } from "@/hooks/useVoiceCall";
import NewChatModal from "@/components/NewChatModal";
import ScreenShareViewer from "@/components/ScreenShareViewer";
import CallModal from "@/components/CallModal";
import BootScreen from "@/components/BootScreen";
import SettingsView from "@/components/chat/SettingsView";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatHeader from "@/components/chat/ChatHeader";
import MessageBubble from "@/components/chat/MessageBubble";
import MediaLightbox from "@/components/chat/MediaLightbox";
import MessageInput from "@/components/chat/MessageInput";
import PendingPrompt from "@/components/chat/PendingPrompt";
import EmptyChatState from "@/components/chat/EmptyChatState";
import MembersPanel from "@/components/chat/MembersPanel";
import ThreadPanel from "@/components/chat/ThreadPanel";
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
  const profileStatus = useProfileStore(selectProfileStatus);
  // Accent colors are applied globally via CSS vars (AccentColorProvider)
  // No need to read them here — just use the CSS var classes below

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
  } = useScreenShare(incomingCallChatId ?? activeChatId);
  const {
    callStatus,
    isMuted,
    isRemoteMuted,
    isSpeaking,
    isRemoteSpeaking,
    isIncomingCall,
    caller,
    error: callError,
    remoteAudioRef,
    remoteStream: remoteVoiceStream,
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
  const [searchResults, setSearchResults] = useState<typeof messages>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState<{src: string; mimeType: string; fileName: string} | null>(null);
  const [threadRootId, setThreadRootId] = useState<string | null>(null);
  const starredIds = useChatStore((s) => s.starredMessageIds);
  const blockedUserIds = useChatStore((s) => s.blockedUserIds);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [starredPanelOpen, setStarredPanelOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const paginationScrollHeightRef = useRef<number | null>(null);
  const skipAutoScrollRef = useRef(false);

  const unreadCounts = useChatStore((s) => s.unreadCounts);
  const chatAttachments = useChatStore(
    useCallback((s) => (activeChatId ? s.attachments[activeChatId] : undefined), [activeChatId])
  );
  const readReceipts = useChatStore(selectActiveReadReceipts);
  const totalUnread = useMemo(
    () => Object.values(unreadCounts).reduce((a, b) => a + b, 0),
    [unreadCounts]
  );

  const reactionGrouped = useMemo(() => groupReactions(reactions), [reactions]);
  const activeChat = useChatStore(selectActiveChat);
  const isPending = activeChat?.role === "pending";
  const isDeclined = activeChat?.role === "declined";

  // Thread support: reply counts per message
  const replyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of messages) {
      if (m.parentId) counts[m.parentId] = (counts[m.parentId] ?? 0) + 1;
    }
    return counts;
  }, [messages]);

  const threadRoot = threadRootId ? messages.find(m => m.id === threadRootId) ?? null : null;
  const threadReplies = useMemo(
    () => threadRootId ? messages.filter(m => m.parentId === threadRootId) : [],
    [messages, threadRootId]
  );

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

  useKeyboardShortcuts({
    onToggleSearch: () => setSearchMode((m) => !m),
    onEscapeSearch: () => { setSearchMode(false); setSearchQuery(""); },
    onNavigateChat: (direction) => {
      const currentIndex = chats.findIndex((c) => c.id === activeChatId);
      const nextIndex = direction === 'up'
        ? Math.max(0, currentIndex - 1)
        : Math.min(chats.length - 1, currentIndex + 1);
      if (chats[nextIndex]) setActiveChat(chats[nextIndex].id);
    },
    onExitChat: () => setActiveChat(null),
    isSearchMode: searchMode,
    hasActiveChat: !!activeChatId,
  });

  /* ── Pinned messages per active chat ── */

  useEffect(() => {
    if (!activeChatId) { setPinnedIds(new Set()); return; }
    fetch(`/api/chat/${activeChatId}/pinned`).then((r) => r.ok ? r.json() : null).then((j) => {
      if (j?.data) setPinnedIds(new Set(j.data.map((p: { messageId: string }) => p.messageId)));
    }).catch(() => {});
  }, [activeChatId]);

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
    setSearchResults([]);
  }, [activeChatId]);

  // FTS search — debounced API call
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!searchMode || !activeChatId || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/chat/${activeChatId}/messages?search=${encodeURIComponent(searchQuery.trim())}`
        );
        if (res.ok) {
          const j = await res.json();
          setSearchResults(j.data?.messages ?? j.messages ?? []);
        }
      } catch {
        // silent
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchQuery, searchMode, activeChatId]);

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

  const handleSend = useCallback(async (content: string, files?: File[]) => {
    stopTyping();
    await sendMessage(content, replyTo?.id, files);
    setReplyTo(null);
  }, [stopTyping, sendMessage, replyTo?.id]);

  const handleTypingChange = useCallback((isTyping: boolean) => {
    if (isTyping) startTyping();
    else stopTyping();
  }, [startTyping, stopTyping]);

  const handleContextMenu = useCallback((
    e: React.MouseEvent,
    msgId: string,
    isOwn: boolean
  ) => {
    if (!isOwn) {
      e.preventDefault();
      setShowEmojiPicker(msgId);
      return;
    }
    e.preventDefault();
    setContextMenuMsgId(msgId);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleStartEdit = useCallback((msgId: string, content: string) => {
    setEditingMessageId(msgId);
    setEditContent(content);
    setContextMenuMsgId(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingMessageId || !editContent.trim()) return;
    await editMessage(editingMessageId, editContent.trim());
    setEditingMessageId(null);
    setEditContent("");
  }, [editingMessageId, editContent, editMessage]);

  const handleDelete = useCallback(async (msgId: string, mode: "for_me" | "for_everyone") => {
    setContextMenuMsgId(null);
    await deleteMessage(msgId, mode);
  }, [deleteMessage]);

  const handleLoadMore = useCallback(() => {
    const container = messagesContainerRef.current;
    const viewport = container?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement | null;

    if (viewport) {
      paginationScrollHeightRef.current = viewport.scrollHeight;
      skipAutoScrollRef.current = true;
    }

    loadMoreMessages();
  }, [loadMoreMessages]);

  const handleReply = useCallback((msgId: string, content: string) => {
    setReplyTo({ id: msgId, content: content.slice(0, 80) });
    setContextMenuMsgId(null);
  }, []);

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


  const handleMediaClick = useCallback((src: string, mimeType: string, fileName: string) => {
    setLightboxMedia({ src, mimeType, fileName });
  }, []);

  const handleSelectChat = useCallback((chatId: string) => {
    setActiveChat(chatId);
    setSidebarOpen(false);
  }, [setActiveChat]);

  const handleNewChat = useCallback(() => {
    setModalOpen(true);
    setSidebarOpen(false);
  }, []);

  const handleDeleteChat = useCallback((chatId: string, mode: "for_me" | "for_everyone") => {
    deleteChat(chatId, mode);
  }, [deleteChat]);

  const handleToggleStar = useCallback((msgId: string) => {
    const isStarred = useChatStore.getState().starredMessageIds.has(msgId);
    useChatStore.getState().toggleStarredMessage(msgId);
    fetch("/api/starred", {
      method: isStarred ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: msgId }),
    }).catch(() => {});
  }, []);

  const handleTogglePin = useCallback((msgId: string) => {
    if (!activeChatId) return;
    const isPinned = pinnedIds.has(msgId);
    setPinnedIds((prev) => { const s = new Set(prev); isPinned ? s.delete(msgId) : s.add(msgId); return s; });
    fetch(`/api/chat/${activeChatId}/pinned`, {
      method: isPinned ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: msgId }),
    }).catch(() => {});
  }, [activeChatId, pinnedIds]);

  const handleToggleBlock = useCallback((userId: string) => {
    const isBlocked = useChatStore.getState().blockedUserIds.has(userId);
    useChatStore.getState().toggleBlockedUser(userId);
    fetch("/api/block", {
      method: isBlocked ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    }).catch(() => {});
  }, []);

  const handleJumpToMessage = useCallback((messageId: string) => {
    const target = document.querySelector(
      `[data-message-id="${messageId}"]`
    ) as HTMLElement | null;

    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(messageId);

    window.setTimeout(() => {
      setHighlightedMessageId((prev) => (prev === messageId ? null : prev));
    }, 1500);
  }, []);

  const displayMessages = useMemo(
    () => messages.filter((m) => !blockedUserIds.has(m.userId)),
    [messages, blockedUserIds]
  );

  // The ID of the last own message that others have seen (for read receipt display)
  const lastReadOwnMsgId = useMemo(() => {
    if (!user?.id || readReceipts.length === 0) return null;
    // Find the last own message where at least one other user's lastReadAt >= createdAt
    for (let i = displayMessages.length - 1; i >= 0; i--) {
      const m = displayMessages[i];
      const isOwn = m.userId === user.id || m.userId === "optimistic";
      if (!isOwn || m.id.startsWith("optimistic-") || m.id.startsWith("failed-")) continue;
      const msgTime = new Date(m.createdAt).getTime();
      const seen = readReceipts.filter(
        (r) => r.userId !== user.id && new Date(r.lastReadAt).getTime() >= msgTime
      );
      if (seen.length > 0) return m.id;
    }
    return null;
  }, [displayMessages, readReceipts, user?.id]);

  // Map msgId → readers for the lastReadOwnMsgId
  const seenByMap = useMemo(() => {
    if (!lastReadOwnMsgId || !user?.id) return {} as Record<string, typeof readReceipts>;
    const msgTime = new Date(
      displayMessages.find((m) => m.id === lastReadOwnMsgId)?.createdAt ?? 0
    ).getTime();
    const seen = readReceipts.filter(
      (r) => r.userId !== user.id && new Date(r.lastReadAt).getTime() >= msgTime
    );
    return { [lastReadOwnMsgId]: seen };
  }, [lastReadOwnMsgId, displayMessages, readReceipts, user?.id]);

  /* ── Render ── */

  return (
    <div
      className="flex h-dvh bg-background text-foreground overflow-hidden transition-[background-color,color] duration-300 ease-in-out"
    >
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[24rem] shrink-0 border-r flex-col backdrop-blur-sm">
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
      </aside>

      {/* Settings overlay — renders over content so chat stays visible */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="left" className="w-[24rem] p-0 flex flex-col">
          <SheetTitle className="sr-only">Settings</SheetTitle>
          <SettingsView
            onBack={() => setSettingsOpen(false)}
            onLogout={handleLogout}
            onDeleteAccount={handleDeleteAccount}
          />
        </SheetContent>
      </Sheet>

      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[80vw] max-w-sm p-0 flex flex-col">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
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
        </SheetContent>
      </Sheet>

      {/* Main panel */}
      <main className="flex-1 flex flex-col min-w-0 bg-background backdrop-blur-sm transition-[background-color,color] duration-300 ease-in-out">
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
              isAdmin={activeChat.role === "admin"}
              onBack={() => setActiveChat(null)}
              onToggleSearch={() => setSearchMode((m) => !m)}
              onToggleMembers={() => setMembersOpen(true)}
              onToggleStarred={() => setStarredPanelOpen(true)}
              onRenameChat={(newName) => {
                // Optimistic: update store immediately
                useChatStore.getState().updateChat(activeChatId!, { name: newName, displayName: newName });
                // Background persist
                fetch(`/api/chat/${activeChatId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: newName }),
                }).catch(() => {});
              }}
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

            {/* Pinned messages banner */}
            {pinnedIds.size > 0 && !isPending && (
              <div className="shrink-0 px-3 py-1.5 border-b border-border bg-primary/5 flex items-center gap-2 text-xs">
                <svg className="w-3.5 h-3.5 text-primary shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3l1.5 5h5l-4 3 1.5 5L12 13 7 16l1.5-5-4-3h5z" />
                </svg>
                <span className="text-muted-foreground flex-1">{pinnedIds.size} pinned {pinnedIds.size === 1 ? "message" : "messages"}</span>
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
                {/* Search bar + results */}
                {searchMode && (
                  <div className="shrink-0 flex flex-col border-b border-border">
                    <div className="px-3 py-2 flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-muted-foreground shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                      </svg>
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search messages…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                      />
                      {searchLoading && (
                        <svg className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                      )}
                      <button
                        onClick={() => { setSearchMode(false); setSearchQuery(""); setSearchResults([]); }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Search results dropdown */}
                    {searchQuery.trim().length >= 2 && (
                      <div className="max-h-72 overflow-y-auto border-t border-border/50">
                        {searchResults.length === 0 && !searchLoading ? (
                          <p className="text-xs text-muted-foreground text-center py-4">No results found</p>
                        ) : (
                          <ul className="py-1">
                            {searchResults.map((result) => {
                              const query = searchQuery.trim().toLowerCase();
                              const content = result.content ?? "";
                              const idx = content.toLowerCase().indexOf(query);
                              const snippet = idx >= 0
                                ? content.slice(Math.max(0, idx - 30), idx + query.length + 60)
                                : content.slice(0, 90);
                              const parts = idx >= 0
                                ? [
                                    snippet.slice(0, Math.min(30, idx)),
                                    snippet.slice(Math.min(30, idx), Math.min(30, idx) + query.length),
                                    snippet.slice(Math.min(30, idx) + query.length),
                                  ]
                                : [snippet, "", ""];
                              return (
                                <li
                                  key={result.id}
                                  onClick={() => {
                                    setSearchMode(false);
                                    setSearchQuery("");
                                    setSearchResults([]);
                                    setTimeout(() => handleJumpToMessage(result.id), 100);
                                  }}
                                  className="px-3 py-2 hover:bg-muted/50 transition-colors cursor-pointer"
                                >
                                  <p className="text-[0.6rem] text-muted-foreground mb-0.5">
                                    {new Date(result.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                  </p>
                                  <p className="text-xs line-clamp-2">
                                    {idx > 30 && <span className="text-muted-foreground">…</span>}
                                    <span className="text-muted-foreground">{parts[0]}</span>
                                    {parts[1] && <mark className="bg-primary/25 text-foreground rounded-sm px-0.5">{parts[1]}</mark>}
                                    <span className="text-muted-foreground">{parts[2]}</span>
                                    {content.length > snippet.length + 30 && <span className="text-muted-foreground">…</span>}
                                  </p>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Messages */}
                <div
                  className="flex-1 overflow-hidden relative"
                  ref={messagesContainerRef}
                >
                  <ScrollArea className="h-full px-4 md:px-6 pt-4 md:pt-6 pb-2">
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

                      {displayMessages.map((msg, i, list) => {
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
                              attachments={chatAttachments?.[msg.id]}
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
                              seenBy={seenByMap[msg.id]}
                              onMediaClick={handleMediaClick}
                              replyCount={replyCounts[msg.id]}
                              onViewThread={() => setThreadRootId(msg.id)}
                              isStarred={starredIds.has(msg.id)}
                              onToggleStar={() => handleToggleStar(msg.id)}
                              isAdmin={activeChat?.role === "admin"}
                              isPinned={pinnedIds.has(msg.id)}
                              onTogglePin={() => handleTogglePin(msg.id)}
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
          chatType={activeChat?.type ?? "group"}
          open={membersOpen}
          onOpenChange={setMembersOpen}
          currentUserId={user?.id ?? ""}
          currentUserRole={activeChat?.role ?? "read"}
          blockedUserIds={blockedUserIds}
          onToggleBlock={handleToggleBlock}
          onLeaveGroup={() => {
            setMembersOpen(false);
            deleteChat(activeChatId, "for_me");
          }}
        />
      )}

      <ThreadPanel
        open={!!threadRootId}
        onOpenChange={(open) => { if (!open) setThreadRootId(null); }}
        rootMessage={threadRoot}
        replies={threadReplies}
        userId={user?.id ?? ""}
        onReply={(content) => sendMessage(content, threadRootId ?? undefined)}
      />

      {/* Starred Messages Panel */}
      <Sheet open={starredPanelOpen} onOpenChange={setStarredPanelOpen}>
        <SheetContent side="right" className="w-88 sm:w-96 p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-3 border-b border-border">
            <SheetTitle className="text-sm font-semibold flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
              </svg>
              Starred Messages
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            {starredIds.size === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground py-16">
                <svg className="w-8 h-8 opacity-30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                </svg>
                <p className="text-sm">No starred messages</p>
              </div>
            ) : (
              <ul className="py-2 divide-y divide-border/50">
                {messages.filter((m) => starredIds.has(m.id)).map((m) => (
                  <li
                    key={m.id}
                    className="px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer group"
                    onClick={() => {
                      if (m.chatId !== activeChatId) setActiveChat(m.chatId);
                      setStarredPanelOpen(false);
                      setTimeout(() => handleJumpToMessage(m.id), 300);
                    }}
                  >
                    <p className="text-xs text-muted-foreground mb-1">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-sm line-clamp-3 wrap-break-word">{m.content}</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleStar(m.id); }}
                      className="mt-1 text-[0.65rem] text-amber-400 hover:text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Unstar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

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
        isRemoteMuted={isRemoteMuted}
        isSpeaking={isSpeaking}
        isRemoteSpeaking={isRemoteSpeaking}
        caller={caller}
        remoteAudioRef={remoteAudioRef}
        remoteStream={remoteVoiceStream}
        error={callError}
        isIncomingCall={isIncomingCall}
        currentUserEmail={user?.email ?? null}
        remoteParticipantName={caller?.name ?? null}
        onAnswerCall={answerCall}
        onRejectCall={rejectCall}
        onHangUp={hangUp}
        onToggleMute={toggleMute}
        shareStatus={shareStatus}
        onStartSharing={startSharing}
        onStopSharing={stopSharing}
      />

      <MediaLightbox
        src={lightboxMedia?.src ?? null}
        mimeType={lightboxMedia?.mimeType ?? ""}
        fileName={lightboxMedia?.fileName ?? ""}
        onClose={() => setLightboxMedia(null)}
      />
    </div>
  );
}
