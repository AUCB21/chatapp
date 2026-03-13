"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useChat } from "@/hooks/useChat";
import { usePresence } from "@/hooks/usePresence";
import { useSessionStore } from "@/store/sessionStore";
import { groupReactions } from "@/store/chatStore";
import { useScreenShare } from "@/hooks/useScreenShare";
import { useVoiceCall } from "@/hooks/useVoiceCall";
import NewChatModal from "@/components/NewChatModal";
import ScreenShareViewer from "@/components/ScreenShareViewer";
import CallModal from "@/components/CallModal";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatHeader from "@/components/chat/ChatHeader";
import MessageBubble from "@/components/chat/MessageBubble";
import MessageInput from "@/components/chat/MessageInput";
import PendingPrompt from "@/components/chat/PendingPrompt";
import EmptyChatState from "@/components/chat/EmptyChatState";

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
    deleteChat,
    toggleReaction,
    refreshChats,
    joinChat,
    declineChat,
  } = useChat();

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
  } = useVoiceCall(activeChatId);
  const { onlineUsers, typingUsers, startTyping, stopTyping } =
    usePresence(activeChatId);

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
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const promptedPendingInvitesRef = useRef<Set<string>>(new Set());

  const reactionGrouped = groupReactions(reactions);
  const activeChat = chats.find((c) => c.id === activeChatId);
  const isPending = activeChat?.role === "pending";
  const isDeclined = activeChat?.role === "declined";

  /* ── Effects ── */

  useEffect(() => {
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
    };
    viewport.addEventListener("scroll", handleScroll);
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, [messages.length, activeChatId]);

  useEffect(() => {
    setJoinError(null);
  }, [activeChatId]);

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
    router.push("/login");
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

  async function handleDelete(msgId: string) {
    setContextMenuMsgId(null);
    await deleteMessage(msgId);
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

  useEffect(() => {
    const pendingChats = chats.filter((chat) => chat.role === "pending");
    const currentPendingIds = new Set(pendingChats.map((chat) => chat.id));

    for (const chatId of promptedPendingInvitesRef.current) {
      if (!currentPendingIds.has(chatId)) {
        promptedPendingInvitesRef.current.delete(chatId);
      }
    }

    for (const chat of pendingChats) {
      if (promptedPendingInvitesRef.current.has(chat.id)) continue;

      promptedPendingInvitesRef.current.add(chat.id);

      toast(`Invitation to ${chat.name}`, {
        description: "Accept to join now or decline the request.",
        duration: 12000,
        action: {
          label: "Accept",
          onClick: () => {
            setActiveChat(chat.id);
            void handleJoin(chat.id);
          },
        },
        cancel: {
          label: "Decline",
          onClick: () => {
            void handleDecline(chat.id);
          },
        },
      });
    }
  }, [chats]);

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
    <div className="flex h-dvh bg-background text-foreground overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[20rem] shrink-0 border-r flex-col">
        <ChatSidebar
          chats={chats}
          activeChatId={activeChatId}
          loading={loading.chats}
          error={error.chats}
          userEmail={user?.email}
          joiningChatId={joiningChatId}
          onSelectChat={handleSelectChat}
          onJoin={handleJoin}
          onDecline={handleDecline}
          onNewChat={handleNewChat}
          onLogout={handleLogout}
          onDeleteChat={handleDeleteChat}
        />
      </aside>

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
            onSelectChat={handleSelectChat}
            onJoin={handleJoin}
            onDecline={handleDecline}
            onNewChat={handleNewChat}
            onLogout={handleLogout}
            onDeleteChat={handleDeleteChat}
          />
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
              onOpenSidebar={() => setSidebarOpen(true)}
            />

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
                {/* Messages */}
                <div
                  className="flex-1 overflow-hidden relative"
                  ref={messagesContainerRef}
                >
                  <ScrollArea className="h-full px-4 md:px-6 py-4 md:py-6">
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
                          msg.userId === user?.id ||
                          msg.userId === "optimistic";
                        const prevMsg = messages[i - 1];
                        const parentMsg = msg.parentId
                          ? (messages.find((m) => m.id === msg.parentId) ??
                            null)
                          : null;

                        return (
                          <div
                            key={msg.id}
                            data-message-id={msg.id}
                            className="scroll-mt-24"
                          >
                            <MessageBubble
                              msg={msg}
                              isOwn={isOwn}
                              isOptimistic={msg.id.startsWith("optimistic-")}
                              isSameUser={prevMsg?.userId === msg.userId}
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
                        onClick={() => handleDelete(contextMenuMsgId)}
                        className="w-full text-left px-3 py-1.5 text-sm text-destructive hover:bg-muted transition-colors"
                      >
                        Delete
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
        chatName={activeChat?.name ?? ""}
        callStatus={callStatus}
        isMuted={isMuted}
        caller={caller}
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
    </div>
  );
}
