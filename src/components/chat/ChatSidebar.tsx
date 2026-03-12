"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LogOut, Moon, Plus, Search, Sun } from "lucide-react";
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
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const visibleChats = useMemo(() => {
    if (!search.trim()) return chats;
    const term = search.trim().toLowerCase();
    return chats.filter((chat) => chat.name.toLowerCase().includes(term));
  }, [chats, search]);

  const displayName = userEmail?.split("@")[0] || "User";

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="h-16 shrink-0 border-b px-4 flex items-center justify-between">
        <span className="text-lg font-semibold tracking-tighter uppercase">
          ChatApp
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-full text-muted-foreground hover:bg-muted transition-colors"
            title="Toggle theme"
          >
            {mounted && theme === "dark" ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={onNewChat}
            className="p-2 rounded-full text-muted-foreground hover:bg-muted transition-colors"
            title="New chat"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats..."
            className="w-full rounded-xl bg-muted/70 py-2 pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full px-2 pb-2">

          {loading && (
            <p className="text-xs text-muted-foreground px-3 py-4">
              Loading chats…
            </p>
          )}
          {error && (
            <p className="text-xs text-destructive px-3 py-4">{error}</p>
          )}
          {!loading && visibleChats.length === 0 && (
            <p className="text-xs text-muted-foreground text-center px-3 py-10">
              No chats yet.
            </p>
          )}

          {visibleChats.map((chat) => {
            const isActive = chat.id === activeChatId;
            const pending = chat.role === "pending";
            const isJoining = joiningChatId === chat.id;

            return (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`w-full text-left px-3 py-3 my-1 rounded-xl flex items-center gap-3 transition cursor-pointer ${
                  isActive
                    ? "bg-foreground text-background"
                    : "hover:bg-muted/80"
                }`}
              >
                <Avatar className="w-10 h-10 shrink-0">
                  <AvatarFallback
                    className={
                      pending
                        ? "bg-muted text-muted-foreground"
                        : isActive
                          ? "bg-background/20 text-background"
                          : ""
                    }
                  >
                    {chat.name[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${
                      pending && !isActive ? "text-muted-foreground" : ""
                    }`}
                  >
                    {chat.name}
                  </p>
                  <p
                    className={`text-xs mt-0.5 ${
                      isActive ? "text-background/70" : "text-muted-foreground"
                    }`}
                  >
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

      <div className="h-16 shrink-0 p-3 border-t bg-muted/40 flex items-center gap-3">
        <Avatar className="w-8 h-8 shrink-0">
          <AvatarFallback className="text-[0.6875rem] font-semibold">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-[0.6875rem] font-medium truncate leading-none mb-1">
            {displayName}
          </p>
          <p className="text-[0.5625rem] text-emerald-500 font-medium uppercase tracking-wider">
            Online
          </p>
        </div>
        <button
          onClick={onLogout}
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
