"use client";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatWithRole } from "@/store/chatStore";

interface ChatSidebarProps {
  chats: ChatWithRole[];
  activeChatId: string | null;
  loading: boolean;
  error: string | null;
  userEmail?: string;
  joiningChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onJoin: (chatId: string) => void;
  onDecline: (chatId: string) => void;
  onNewChat: () => void;
  onLogout: () => void;
}

export default function ChatSidebar({
  chats,
  activeChatId,
  loading,
  error,
  userEmail,
  joiningChatId,
  onSelectChat,
  onJoin,
  onDecline,
  onNewChat,
  onLogout,
}: ChatSidebarProps) {
  return (
    <>
      {/* Header */}
      <div className="px-4 md:px-5 h-14 md:h-16 border-b flex items-center justify-between shrink-0">
        <span className="font-semibold text-base tracking-tight">Chat App</span>
        <div className="flex items-center gap-2 md:gap-4">
          <span className="text-xs text-muted-foreground truncate max-w-20 md:max-w-30">
            {userEmail}
          </span>
          <Button
            onClick={onLogout}
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
          {/* New chat row */}
          <button
            onClick={onNewChat}
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
                <path d="M6 12L3.269 3.125A59.8 59.8 0 0 1 21.486 12a59.8 59.8 0 0 1-18.217 8.875zm0 0h7.5" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium">New chat</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Invite someone by email
              </p>
            </div>
          </button>

          {loading && (
            <p className="text-xs text-muted-foreground px-5 py-4">
              Loading chats…
            </p>
          )}
          {error && (
            <p className="text-xs text-destructive px-5 py-4">{error}</p>
          )}
          {!loading && chats.length === 0 && (
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
                onClick={() => onSelectChat(chat.id)}
                className={`w-full text-left px-4 md:px-5 py-3 md:py-4 border-b flex items-center gap-3 md:gap-4 transition cursor-pointer ${
                  isActive ? "bg-muted" : "hover:bg-muted/50"
                }`}
              >
                <Avatar className="w-10 h-10 md:w-12 md:h-12 shrink-0">
                  <AvatarFallback
                    className={pending ? "bg-muted text-muted-foreground" : ""}
                  >
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
                      onClick={() => onJoin(chat.id)}
                      disabled={!!joiningChatId}
                      size="sm"
                      className="text-xs h-auto px-3 py-1.5 rounded-full"
                    >
                      {isJoining ? "…" : "Accept"}
                    </Button>
                    <Button
                      onClick={() => onDecline(chat.id)}
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
}
