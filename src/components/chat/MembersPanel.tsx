"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, LogOut, Pencil, UserPlus, X } from "lucide-react";
import type { MemberRole } from "@/db/schema";

interface Member {
  userId: string;
  email: string;
  role: MemberRole;
  joinedAt: string;
  displayName: string;
  chatDisplayName: string | null;
  globalDisplayName: string | null;
}

interface MembersPanelProps {
  chatId: string;
  chatType: "direct" | "group";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  currentUserRole: string;
  onLeaveGroup?: () => void;
}

const ROLE_BADGE: Record<MemberRole, { label: string; className: string }> = {
  admin: {
    label: "Admin",
    className: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  },
  write: {
    label: "Member",
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  read: {
    label: "Read-only",
    className: "bg-muted text-muted-foreground border-border",
  },
};

const AVATAR_COLORS = [
  "bg-cyan-500/20 text-cyan-400",
  "bg-blue-500/20 text-blue-400",
  "bg-violet-500/20 text-violet-400",
  "bg-emerald-500/20 text-emerald-400",
  "bg-rose-500/20 text-rose-400",
  "bg-teal-500/20 text-teal-400",
  "bg-indigo-500/20 text-indigo-400",
];

function getAvatarColor(str: string) {
  return AVATAR_COLORS[str.charCodeAt(0) % AVATAR_COLORS.length];
}

export default function MembersPanel({
  chatId,
  chatType,
  open,
  onOpenChange,
  currentUserId,
  currentUserRole,
  onLeaveGroup,
}: MembersPanelProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const isAdmin = currentUserRole === "admin";

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/${chatId}/members`);
      if (res.ok) {
        const { data } = await res.json();
        setMembers(data.members);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    if (open) fetchMembers();
  }, [open, fetchMembers]);

  function handleChangeRole(userId: string, newRole: MemberRole) {
    // Optimistic update
    setMembers((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, role: newRole } : m))
    );
    // Background persist
    fetch(`/api/chat/${chatId}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: newRole }),
    }).catch(() => {});
  }

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [inviteError, setInviteError] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    setInviteStatus("loading");
    setInviteError(null);
    try {
      const res = await fetch(`/api/chat/${chatId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: "write" }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setInviteError(json.error ?? "Failed to invite");
        setInviteStatus("error");
        return;
      }
      setInviteStatus("success");
      setInviteEmail("");
      // Refresh member list in case user was added directly
      fetchMembers();
      setTimeout(() => {
        setInviteStatus("idle");
        setInviteOpen(false);
      }, 1500);
    } catch {
      setInviteError("Network error");
      setInviteStatus("error");
    }
  }

  function handleNicknameSave(userId: string) {
    const trimmed = editValue.trim();
    const member = members.find((m) => m.userId === userId);
    if (!member) return;

    const newName = trimmed || null;
    if (newName === member.chatDisplayName) {
      setEditingId(null);
      return;
    }

    // Optimistic update
    setMembers((prev) =>
      prev.map((m) =>
        m.userId === userId
          ? {
              ...m,
              chatDisplayName: newName,
              displayName: newName ?? m.globalDisplayName ?? m.email.split("@")[0],
            }
          : m
      )
    );
    setEditingId(null);

    // Background persist
    fetch(`/api/chat/${chatId}/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, displayName: newName }),
    }).catch(() => {});
  }

  function handleRemove(userId: string) {
    // Optimistic update
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
    // Background persist
    fetch(`/api/chat/${chatId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    }).catch(() => {});
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[20rem] sm:w-88 p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-sm font-semibold">
              Members{!loading && ` (${members.length})`}
            </SheetTitle>
            {isAdmin && chatType === "group" && (
              <button
                onClick={() => { setInviteOpen((v) => !v); setInviteStatus("idle"); setInviteError(null); }}
                className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Invite member"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            )}
          </div>

          {isAdmin && inviteOpen && (
            <form onSubmit={handleInvite} className="mt-2 flex flex-col gap-1.5">
              <div className="flex gap-1.5">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  disabled={inviteStatus === "loading" || inviteStatus === "success"}
                  className="flex-1 text-sm bg-muted/60 border border-border rounded-md px-2.5 py-1 outline-none focus:ring-1 focus:ring-ring/40 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={inviteStatus === "loading" || inviteStatus === "success" || !inviteEmail.trim()}
                  className="w-8 h-8 flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  {inviteStatus === "loading" ? (
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  ) : inviteStatus === "success" ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <UserPlus className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setInviteOpen(false); setInviteEmail(""); setInviteStatus("idle"); setInviteError(null); }}
                  className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {inviteStatus === "success" && (
                <p className="text-[0.65rem] text-emerald-500">Invited successfully!</p>
              )}
              {inviteStatus === "error" && inviteError && (
                <p className="text-[0.65rem] text-destructive">{inviteError}</p>
              )}
            </form>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <svg className="w-5 h-5 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            </div>
          ) : (
            <ul className="py-1">
              {members.map((member) => {
                const displayName = member.displayName;
                const isSelf = member.userId === currentUserId;
                const badge = ROLE_BADGE[member.role];
                const canManage = isAdmin && !isSelf;
                const isEditing = editingId === member.userId;
                const canEditNickname = isAdmin || isSelf;

                return (
                  <li
                    key={member.userId}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors group"
                  >
                    <Avatar className="w-8 h-8 shrink-0">
                      <AvatarFallback
                        className={`text-xs font-semibold ${getAvatarColor(member.email)}`}
                      >
                        {displayName[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          ref={editRef}
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleNicknameSave(member.userId)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleNicknameSave(member.userId);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          placeholder={member.globalDisplayName ?? member.email.split("@")[0]}
                          className="w-full text-sm font-medium bg-muted/60 border border-border rounded-md px-2 py-0.5 outline-none focus:ring-1 focus:ring-ring/40"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">
                            {displayName}
                            {isSelf && (
                              <span className="text-muted-foreground font-normal"> (you)</span>
                            )}
                          </span>
                          {canEditNickname && (
                            <button
                              onClick={() => {
                                setEditingId(member.userId);
                                setEditValue(member.chatDisplayName ?? "");
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                              title="Edit chat nickname"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                      <p className="text-[0.65rem] text-muted-foreground truncate">
                        {member.chatDisplayName && (
                          <span className="text-muted-foreground/60">
                            {member.globalDisplayName ?? member.email.split("@")[0]}
                            {" · "}
                          </span>
                        )}
                        {member.email}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant="outline"
                        className={`text-[0.6rem] px-1.5 py-0 h-5 font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </Badge>

                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                              aria-label="Member actions"
                            >
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                                <circle cx="8" cy="3" r="1.5" />
                                <circle cx="8" cy="8" r="1.5" />
                                <circle cx="8" cy="13" r="1.5" />
                              </svg>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            {member.role !== "admin" && (
                              <DropdownMenuItem
                                onClick={() => handleChangeRole(member.userId, "admin")}
                              >
                                Make admin
                              </DropdownMenuItem>
                            )}
                            {member.role !== "write" && (
                              <DropdownMenuItem
                                onClick={() => handleChangeRole(member.userId, "write")}
                              >
                                Set as member
                              </DropdownMenuItem>
                            )}
                            {member.role !== "read" && (
                              <DropdownMenuItem
                                onClick={() => handleChangeRole(member.userId, "read")}
                              >
                                Set read-only
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleRemove(member.userId)}
                              className="text-destructive focus:text-destructive"
                            >
                              Remove from chat
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {chatType === "group" && !isAdmin && onLeaveGroup && (
          <div className="shrink-0 px-4 py-3 border-t border-border">
            <button
              onClick={onLeaveGroup}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Leave group
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
