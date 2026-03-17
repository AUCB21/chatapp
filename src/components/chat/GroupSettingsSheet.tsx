"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, LogOut, Pencil, X } from "lucide-react";
import type { MemberRole } from "@/db/schema";

/* ─── Types ─────────────────────────────────────────────── */

interface Member {
  userId: string;
  email: string;
  role: MemberRole;
  joinedAt: string;
  displayName: string;
  chatDisplayName: string | null;
  globalDisplayName: string | null;
}

interface PendingInvitation {
  id: string;
  invitedEmail: string;
  token: string;
  createdAt: string;
  expiresAt: string;
}

interface GroupSettingsSheetProps {
  chatId: string;
  chatName: string;
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  currentUserId: string;
  currentUserRole: string;
  blockedUserIds?: Set<string>;
  onToggleBlock?: (userId: string) => void;
  onLeaveGroup?: () => void;
  onRenameChat?: (newName: string) => void;
}

/* ─── Constants ─────────────────────────────────────────── */

const ROLE_BADGE: Record<MemberRole, { label: string; className: string }> = {
  admin: { label: "Admin", className: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  write: { label: "Member", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  read: { label: "Read-only", className: "bg-muted text-muted-foreground border-border" },
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

const PERMISSION_ROWS = [
  { label: "View messages", read: true, write: true, admin: true },
  { label: "Send messages", read: false, write: true, admin: true },
  { label: "Upload files", read: false, write: true, admin: true },
  { label: "React to messages", read: true, write: true, admin: true },
  { label: "Invite members", read: false, write: false, admin: true },
  { label: "Remove members", read: false, write: false, admin: true },
  { label: "Change member roles", read: false, write: false, admin: true },
  { label: "Rename group", read: false, write: false, admin: true },
  { label: "Delete messages (own)", read: true, write: true, admin: true },
  { label: "Delete any message", read: false, write: false, admin: true },
];

type Tab = "overview" | "members" | "invites" | "permissions";

/* ─── Spinner ────────────────────────────────────────────── */

function Spinner({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

/* ─── Tabs nav ───────────────────────────────────────────── */

const TABS: { id: Tab; label: string; adminOnly?: boolean }[] = [
  { id: "overview", label: "Overview" },
  { id: "members", label: "Members" },
  { id: "invites", label: "Invites", adminOnly: true },
  { id: "permissions", label: "Permissions" },
];

/* ─── Main component ─────────────────────────────────────── */

export default function GroupSettingsSheet({
  chatId,
  chatName,
  isOpen,
  onClose,
  isAdmin,
  currentUserId,
  currentUserRole,
  blockedUserIds,
  onToggleBlock,
  onLeaveGroup,
  onRenameChat,
}: GroupSettingsSheetProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Reset tab when reopened
  useEffect(() => {
    if (isOpen) setActiveTab("overview");
  }, [isOpen]);

  if (!isOpen) return null;

  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl shadow-2xl">
        {/* Left nav */}
        <nav className="w-48 shrink-0 bg-sidebar flex flex-col py-6 px-3 border-r border-border">
          <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-3">
            Group Settings
          </p>
          <ul className="space-y-0.5">
            {visibleTabs.map((tab) => (
              <li key={tab.id}>
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-auto">
            {!isAdmin && onLeaveGroup && (
              <button
                onClick={onLeaveGroup}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Leave group
              </button>
            )}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 bg-background flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <h2 className="text-base font-semibold capitalize">{activeTab}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab panels */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "overview" && (
              <OverviewTab
                chatName={chatName}
                isAdmin={isAdmin}
                onRenameChat={onRenameChat}
              />
            )}
            {activeTab === "members" && (
              <MembersTab
                chatId={chatId}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                blockedUserIds={blockedUserIds}
                onToggleBlock={onToggleBlock}
              />
            )}
            {activeTab === "invites" && (
              <InvitesTab chatId={chatId} />
            )}
            {activeTab === "permissions" && <PermissionsTab />}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Overview tab ───────────────────────────────────────── */

function OverviewTab({
  chatName,
  isAdmin,
  onRenameChat,
}: {
  chatName: string;
  isAdmin: boolean;
  onRenameChat?: (name: string) => void;
}) {
  const [nameValue, setNameValue] = useState(chatName);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setNameValue(chatName);
  }, [chatName]);

  function handleSave() {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === chatName) return;
    // Delegate to parent — parent handles both store update and API call
    onRenameChat?.(trimmed);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const initials = chatName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="p-6 flex flex-col gap-6 max-w-lg">
      {/* Avatar placeholder */}
      <div className="flex items-center gap-4">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold ${getAvatarColor(chatName)}`}>
          {initials}
        </div>
        <div>
          <p className="font-semibold">{chatName}</p>
          <p className="text-xs text-muted-foreground">Group chat</p>
        </div>
      </div>

      {/* Group name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Group Name
        </label>
        <input
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
          maxLength={100}
          disabled={!isAdmin}
          className="w-full h-9 px-3 rounded-lg bg-muted/50 border border-border text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

      {/* Topic — display only, no DB column yet */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Topic
          <span className="ml-2 normal-case font-normal text-muted-foreground/60">(coming soon)</span>
        </label>
        <textarea
          placeholder="Let everyone know how to use this group!"
          disabled
          rows={4}
          className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm outline-none resize-none disabled:opacity-40 disabled:cursor-not-allowed"
        />
      </div>

      {isAdmin && (
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={!nameValue.trim() || nameValue.trim() === chatName}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center gap-2"
          >
            {saved ? <Check className="w-3.5 h-3.5" /> : null}
            {saved ? "Saved!" : "Save changes"}
          </button>
          {saved && <span className="text-xs text-emerald-500">Changes saved</span>}
        </div>
      )}
    </div>
  );
}

/* ─── Members tab ────────────────────────────────────────── */

function MembersTab({
  chatId,
  currentUserId,
  currentUserRole,
  blockedUserIds,
  onToggleBlock,
}: {
  chatId: string;
  currentUserId: string;
  currentUserRole: string;
  blockedUserIds?: Set<string>;
  onToggleBlock?: (userId: string) => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const isAdmin = currentUserRole === "admin";

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/${chatId}/members?limit=20`);
      if (res.ok) {
        const { data } = await res.json();
        setMembers(data.members);
        setNextCursor(data.nextCursor ?? null);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [chatId]);

  const fetchMoreMembers = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/chat/${chatId}/members?limit=20&cursor=${encodeURIComponent(nextCursor)}`);
      if (res.ok) {
        const { data } = await res.json();
        setMembers((prev) => [...prev, ...data.members]);
        setNextCursor(data.nextCursor ?? null);
      }
    } catch { /* silent */ }
    finally { setLoadingMore(false); }
  }, [chatId, nextCursor, loadingMore]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  function handleChangeRole(userId: string, newRole: MemberRole) {
    setMembers((prev) => prev.map((m) => m.userId === userId ? { ...m, role: newRole } : m));
    fetch(`/api/chat/${chatId}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: newRole }),
    }).catch(() => {});
  }

  function handleRemove(userId: string) {
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
    fetch(`/api/chat/${chatId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    }).catch(() => {});
  }

  function handleNicknameSave(userId: string) {
    const trimmed = editValue.trim();
    const member = members.find((m) => m.userId === userId);
    if (!member) return;
    const newName = trimmed || null;
    if (newName === member.chatDisplayName) { setEditingId(null); return; }
    setMembers((prev) => prev.map((m) =>
      m.userId === userId
        ? { ...m, chatDisplayName: newName, displayName: newName ?? m.globalDisplayName ?? m.email.split("@")[0] }
        : m
    ));
    setEditingId(null);
    fetch(`/api/chat/${chatId}/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, displayName: newName }),
    }).catch(() => {});
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="w-5 h-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="px-6 py-3 border-b border-border">
        <p className="text-xs text-muted-foreground">{members.length} member{members.length !== 1 ? "s" : ""}</p>
      </div>
      <ul>
        {members.map((member) => {
          const isSelf = member.userId === currentUserId;
          const badge = ROLE_BADGE[member.role];
          const canManage = isAdmin && !isSelf;
          const isBlocked = blockedUserIds?.has(member.userId) ?? false;
          const canBlock = !isSelf && !!onToggleBlock;
          const showDropdown = canManage || canBlock;
          const isEditing = editingId === member.userId;
          const canEditNickname = isAdmin || isSelf;

          return (
            <li key={member.userId} className="flex items-center gap-3 px-6 py-3 hover:bg-muted/40 transition-colors group">
              <Avatar className="w-9 h-9 shrink-0">
                <AvatarFallback className={`text-xs font-semibold ${getAvatarColor(member.email)}`}>
                  {member.displayName[0].toUpperCase()}
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
                      {member.displayName}
                      {isSelf && <span className="text-muted-foreground font-normal"> (you)</span>}
                    </span>
                    {canEditNickname && (
                      <button
                        onClick={() => { setEditingId(member.userId); setEditValue(member.chatDisplayName ?? ""); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                        title="Edit nickname"
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
                <Badge variant="outline" className={`text-[0.6rem] px-1.5 py-0 h-5 font-medium ${badge.className}`}>
                  {badge.label}
                </Badge>

                {showDropdown && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                        aria-label="Member actions"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                          <circle cx="8" cy="3" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="8" cy="13" r="1.5" />
                        </svg>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      {canManage && member.role !== "admin" && (
                        <DropdownMenuItem onClick={() => handleChangeRole(member.userId, "admin")}>Make admin</DropdownMenuItem>
                      )}
                      {canManage && member.role !== "write" && (
                        <DropdownMenuItem onClick={() => handleChangeRole(member.userId, "write")}>Set as member</DropdownMenuItem>
                      )}
                      {canManage && member.role !== "read" && (
                        <DropdownMenuItem onClick={() => handleChangeRole(member.userId, "read")}>Set read-only</DropdownMenuItem>
                      )}
                      {canManage && <DropdownMenuSeparator />}
                      {canManage && (
                        <DropdownMenuItem onClick={() => handleRemove(member.userId)} className="text-destructive focus:text-destructive">
                          Remove from group
                        </DropdownMenuItem>
                      )}
                      {canBlock && canManage && <DropdownMenuSeparator />}
                      {canBlock && (
                        <DropdownMenuItem
                          onClick={() => onToggleBlock!(member.userId)}
                          className={isBlocked ? "text-amber-500 focus:text-amber-500" : "text-destructive focus:text-destructive"}
                        >
                          {isBlocked ? "Unblock user" : "Block user"}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {nextCursor && (
        <div className="flex justify-center py-4">
          <button
            onClick={fetchMoreMembers}
            disabled={loadingMore}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-md transition-colors disabled:opacity-50"
          >
            {loadingMore ? <Spinner className="w-3.5 h-3.5" /> : null}
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Invites tab ────────────────────────────────────────── */

function InvitesTab({ chatId }: { chatId: string }) {
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/${chatId}/invitations`);
      if (res.ok) {
        const { data } = await res.json();
        setInvitations(data ?? []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [chatId]);

  useEffect(() => { fetchInvitations(); }, [fetchInvitations]);

  function copyLink(token: string) {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="w-5 h-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-4 max-w-lg">
      <p className="text-xs text-muted-foreground">
        Pending invitations — users invited by email who haven't signed up yet.
      </p>

      {invitations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
          <svg className="w-10 h-10 text-muted-foreground/30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
          </svg>
          <p className="text-sm text-muted-foreground">No pending invitations</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {invitations.map((inv) => {
            const expires = new Date(inv.expiresAt);
            const isExpired = expires < new Date();
            return (
              <li key={inv.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{inv.invitedEmail}</p>
                  <p className={`text-[0.65rem] ${isExpired ? "text-destructive" : "text-muted-foreground"}`}>
                    {isExpired ? "Expired" : `Expires ${expires.toLocaleDateString()}`}
                  </p>
                </div>
                <button
                  onClick={() => copyLink(inv.token)}
                  className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Copy invite link"
                >
                  {copied === inv.token ? (
                    <><Check className="w-3 h-3 text-emerald-500" /> Copied</>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>
                      Copy link
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ─── Permissions tab ────────────────────────────────────── */

function PermissionsTab() {
  return (
    <div className="p-6 max-w-lg">
      <p className="text-xs text-muted-foreground mb-4">
        Role capabilities for this group. Fine-grained per-role customization is coming in a future update.
      </p>

      <div className="rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_5rem_5rem_5rem] bg-muted/40 px-4 py-2.5 border-b border-border">
          <span className="text-xs font-semibold text-muted-foreground">Permission</span>
          {(["Read-only", "Member", "Admin"] as const).map((role) => (
            <span key={role} className="text-xs font-semibold text-muted-foreground text-center">{role}</span>
          ))}
        </div>

        {PERMISSION_ROWS.map((row, i) => (
          <div
            key={row.label}
            className={`grid grid-cols-[1fr_5rem_5rem_5rem] px-4 py-2.5 ${i % 2 === 0 ? "" : "bg-muted/20"}`}
          >
            <span className="text-sm text-foreground">{row.label}</span>
            {[row.read, row.write, row.admin].map((allowed, idx) => (
              <div key={idx} className="flex justify-center">
                {allowed ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <X className="w-4 h-4 text-muted-foreground/40" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
