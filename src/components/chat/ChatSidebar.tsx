"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, BellOff, EllipsisVertical, LogOut, Moon, Plus, Search, Settings, Sun } from "lucide-react";
import { useProfileStore } from "@/store/profileStore";
import type { ChatWithRole } from "@/store/chatStore";
import type { UserStatus } from "@/db/schema";

interface ChatSidebarProps {
  chats: ChatWithRole[];
  activeChatId: string | null;
  loading: boolean;
  error: string | null;
  userEmail?: string;
  joiningChatId: string | null;
  unreadCounts: Record<string, number>;
  onSelectChat: (chatId: string) => void;
  onJoin: (chatId: string) => void;
  onDecline: (chatId: string) => void;
  onNewChat: () => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  onDeleteChat: (chatId: string, mode: "for_me" | "for_everyone") => void;
  mutedChats: Set<string>;
  onToggleMute: (chatId: string) => void;
}

function getAvatarColor(name: string) {
  const colors = [
    "bg-cyan-500/20 text-cyan-400",
    "bg-blue-500/20 text-blue-400",
    "bg-violet-500/20 text-violet-400",
    "bg-emerald-500/20 text-emerald-400",
    "bg-rose-500/20 text-rose-400",
    "bg-teal-500/20 text-teal-400",
    "bg-indigo-500/20 text-indigo-400",
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
}

export default function ChatSidebar({
  chats,
  activeChatId,
  loading,
  error,
  userEmail,
  joiningChatId,
  unreadCounts,
  onSelectChat,
  onJoin,
  onDecline,
  onNewChat,
  onLogout,
  onOpenSettings,
  onDeleteChat,
  mutedChats,
  onToggleMute,
}: ChatSidebarProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const profile = useProfileStore((s) => s.profile);

  useEffect(() => {
    setMounted(true);
  }, []);

  const pendingChats = useMemo(
    () => chats.filter((c) => c.role === "pending"),
    [chats]
  );

  const visibleChats = useMemo(() => {
    const nonPending = chats.filter((c) => c.role !== "pending");
    if (!search.trim()) return nonPending;
    const term = search.trim().toLowerCase();
    return nonPending.filter((chat) => chat.name.toLowerCase().includes(term));
  }, [chats, search]);

  const displayName = profile?.displayName ?? userEmail?.split("@")[0] ?? "User";
  const userStatus: UserStatus = profile?.status ?? "online";

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Header */}
      <div className="h-15 shrink-0 border-b border-sidebar-border px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center shrink-0">
            <svg className="w-3 h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 16 16">
              <path d="M14 1H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2v3l4-3h6a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1z" />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight">EPS Chat App</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent transition-colors"
            title="Toggle theme"
          >
            {mounted && theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={onNewChat}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent transition-colors"
            title="New chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-1.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full rounded-lg bg-sidebar-accent/60 border border-sidebar-border/50 py-2 pl-8.5 pr-3 text-xs outline-none focus:ring-1 focus:ring-ring/40 transition-all placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      {/* Pending invitations */}
      {pendingChats.length > 0 && (
        <div className="px-2 pt-2">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-2.5">
            <div className="flex items-center gap-1.5 px-1 pb-2">
              <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
              <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-primary/80">
                Invitations ({pendingChats.length})
              </span>
            </div>
            {pendingChats.map((chat) => {
              const isJoining = joiningChatId === chat.id;
              return (
                <div
                  key={chat.id}
                  className="flex items-center gap-2 px-1 py-1.5"
                >
                  <Avatar className="w-7 h-7 shrink-0">
                    <AvatarFallback className={`text-[0.6rem] font-semibold ${getAvatarColor(chat.name)}`}>
                      {chat.name[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-xs font-medium truncate flex-1 min-w-0">{chat.name}</p>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => onJoin(chat.id)}
                      disabled={!!joiningChatId}
                      className="text-[0.6rem] h-5.5 px-2 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {isJoining ? "…" : "Accept"}
                    </button>
                    <button
                      onClick={() => onDecline(chat.id)}
                      disabled={!!joiningChatId}
                      className="text-[0.6rem] h-5.5 px-2 rounded-full bg-sidebar-accent text-foreground font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section label */}
      {visibleChats.length > 0 && (
        <div className="px-4 pt-3 pb-1">
          <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
            Conversations
          </span>
        </div>
      )}

      {/* Chat list */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full px-2 pb-2">
          {loading && (
            <div className="space-y-1 px-2 pt-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-xl bg-sidebar-accent/40 animate-pulse" />
              ))}
            </div>
          )}
          {error && (
            <p className="text-xs text-destructive px-3 py-4">{error}</p>
          )}
          {!loading && visibleChats.length === 0 && (
            <div className="flex flex-col items-center justify-center px-3 py-12 text-center">
              <div className="w-10 h-10 rounded-xl bg-sidebar-accent/60 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                </svg>
              </div>
              <p className="text-xs text-muted-foreground">No chats yet</p>
              <button onClick={onNewChat} className="mt-3 text-xs text-primary hover:underline underline-offset-4 transition-colors">
                Start one
              </button>
            </div>
          )}

          {visibleChats.map((chat) => {
            const isActive = chat.id === activeChatId;
            const avatarColor = getAvatarColor(chat.name);
            const unread = unreadCounts[chat.id] ?? 0;
            const isMuted = mutedChats.has(chat.id);

            return (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`w-full text-left px-2.5 py-2.5 my-0.5 rounded-xl flex items-center gap-2.5 transition-all cursor-pointer group/item ${
                  isActive
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-sidebar-accent/70 border border-transparent"
                }`}
              >
                <Avatar className="w-9 h-9 shrink-0">
                  <AvatarFallback
                    className={`text-xs font-semibold ${
                      isActive ? "bg-primary text-primary-foreground" : avatarColor
                    }`}
                  >
                    {chat.name[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate leading-tight ${
                    isActive ? "text-primary" : unread > 0 ? "text-foreground" : ""
                  }`}>
                    {chat.name}
                  </p>
                  <p className="text-[0.65rem] mt-0.5 text-muted-foreground truncate">
                    {chat.role === "declined" ? "Declined" : chat.role}
                  </p>
                </div>

                {/* Muted indicator */}
                {isMuted && !isActive && (
                  <BellOff className="w-3 h-3 shrink-0 text-muted-foreground/50 group-hover/item:hidden" />
                )}

                {/* Unread badge — hidden when dropdown is visible */}
                {unread > 0 && !isActive && !isMuted && (
                  <span className="shrink-0 min-w-[1.2rem] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[0.6rem] font-semibold flex items-center justify-center tabular-nums group-hover/item:hidden">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}

                <div className="shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-sidebar-accent transition-colors"
                        aria-label={`Chat actions for ${chat.name}`}
                      >
                        <EllipsisVertical className="w-3.5 h-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="bottom">
                      <DropdownMenuItem onClick={() => onToggleMute(chat.id)}>
                        {isMuted ? (
                          <><Bell className="w-3.5 h-3.5 mr-1.5" />Unmute</>
                        ) : (
                          <><BellOff className="w-3.5 h-3.5 mr-1.5" />Mute</>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => onDeleteChat(chat.id, "for_me")}
                      >
                        Delete for me
                      </DropdownMenuItem>
                      {chat.role === "admin" && (
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => onDeleteChat(chat.id, "for_everyone")}
                        >
                          Delete for everyone
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </ScrollArea>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-3 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2.5 px-1.5">
          <Avatar className="w-7 h-7 shrink-0">
            <AvatarFallback className="text-[0.6rem] font-semibold bg-primary/15 text-primary">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate leading-none">{displayName}</p>
            <div className="flex items-center gap-1 mt-1">
              <div className={`w-1.5 h-1.5 rounded-full ${
                userStatus === "online" ? "bg-emerald-500" :
                userStatus === "idle" ? "bg-amber-500" :
                "bg-rose-500"
              }`} />
              <span className="text-[0.6rem] text-muted-foreground capitalize">{userStatus === "dnd" ? "Do Not Disturb" : userStatus}</span>
            </div>
          </div>
          <button
            onClick={onOpenSettings}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent transition-colors"
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onLogout}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-rose-500/70 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
            title="Logout"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
