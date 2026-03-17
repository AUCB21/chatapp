"use client";

import { useState, useEffect, useCallback } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Check, X, UserPlus, Upload } from "lucide-react";
import { useRef } from "react";

/* ─── Types ─────────────────────────────────────────────── */

interface Contact {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
}

interface InviteModalProps {
  chatId: string;
  isOpen: boolean;
  onClose: () => void;
  /** Token for the most recent pending invitation (for the copy-link section) */
  latestInviteToken?: string | null;
}

/* ─── Helpers ────────────────────────────────────────────── */

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

function Spinner({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

type InviteStatus = "idle" | "loading" | "success" | "error";
type InviteTab = "contacts" | "email";
interface BulkEmail { email: string; status: "pending" | "sending" | "done" | "error"; error?: string }

/* ─── Main ───────────────────────────────────────────────── */

export default function InviteModal({ chatId, isOpen, onClose, latestInviteToken }: InviteModalProps) {
  const [tab, setTab] = useState<InviteTab>("contacts");
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [inviteStatuses, setInviteStatuses] = useState<Record<string, InviteStatus>>({});
  const [linkCopied, setLinkCopied] = useState(false);

  // Email invite state
  const [emailValue, setEmailValue] = useState("");
  const [emailStatus, setEmailStatus] = useState<InviteStatus>("idle");
  const [emailError, setEmailError] = useState<string | null>(null);

  // Bulk invite state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bulkEmails, setBulkEmails] = useState<BulkEmail[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setTab("contacts");
      setInvited(new Set());
      setInviteStatuses({});
      setEmailValue("");
      setEmailStatus("idle");
      setEmailError(null);
      setBulkEmails([]);
    }
  }, [isOpen]);

  const fetchContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const res = await fetch(`/api/chat/${chatId}/invite-candidates`);
      if (res.ok) {
        const { data } = await res.json();
        setContacts(data ?? []);
      }
    } catch { /* silent */ }
    finally { setLoadingContacts(false); }
  }, [chatId]);

  useEffect(() => {
    if (isOpen) fetchContacts();
  }, [isOpen, fetchContacts]);

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.displayName.toLowerCase().includes(q) ||
      c.username.toLowerCase().includes(q)
    );
  });

  async function handleInviteContact(contact: Contact) {
    if (invited.has(contact.userId) || inviteStatuses[contact.userId] === "loading") return;
    setInviteStatuses((prev) => ({ ...prev, [contact.userId]: "loading" }));
    try {
      // We invite by a virtual email lookup — use the invite endpoint with a userId approach
      // The existing invite API takes email; for known users we POST the email which resolves to userId
      const res = await fetch(`/api/chat/${chatId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: contact.userId, role: "write" }),
      });
      if (res.ok) {
        setInviteStatuses((prev) => ({ ...prev, [contact.userId]: "success" }));
        setInvited((prev) => new Set([...prev, contact.userId]));
      } else {
        setInviteStatuses((prev) => ({ ...prev, [contact.userId]: "error" }));
      }
    } catch {
      setInviteStatuses((prev) => ({ ...prev, [contact.userId]: "error" }));
    }
  }

  async function handleEmailInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = emailValue.trim();
    if (!email) return;
    setEmailStatus("loading");
    setEmailError(null);
    try {
      const res = await fetch(`/api/chat/${chatId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: "write" }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setEmailError(json.error ?? "Failed to invite");
        setEmailStatus("error");
        return;
      }
      setEmailStatus("success");
      setEmailValue("");
      setTimeout(() => setEmailStatus("idle"), 2000);
    } catch {
      setEmailError("Network error");
      setEmailStatus("error");
    }
  }

  function parseBulkFile(text: string): string[] {
    return [...new Set(
      text.split(/[\n,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
    )];
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const emails = parseBulkFile(ev.target?.result as string);
      setBulkEmails(emails.map((email) => ({ email, status: "pending" })));
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleBulkSend() {
    if (bulkRunning || bulkEmails.length === 0) return;
    setBulkRunning(true);
    const pending = bulkEmails.filter((e) => e.status === "pending");
    for (const item of pending) {
      setBulkEmails((prev) => prev.map((e) => e.email === item.email ? { ...e, status: "sending" } : e));
      try {
        const res = await fetch(`/api/chat/${chatId}/invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: item.email, role: "write" }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          setBulkEmails((prev) => prev.map((e) => e.email === item.email ? { ...e, status: "done" } : e));
        } else {
          setBulkEmails((prev) => prev.map((e) => e.email === item.email ? { ...e, status: "error", error: json.error ?? "Failed" } : e));
        }
      } catch {
        setBulkEmails((prev) => prev.map((e) => e.email === item.email ? { ...e, status: "error", error: "Network error" } : e));
      }
    }
    setBulkRunning(false);
  }

  function copyLink() {
    const token = latestInviteToken;
    if (!token) return;
    navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md bg-background rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <h2 className="text-base font-semibold">Invite People</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Recipients will be added to this group
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-5 pt-3 pb-0">
            {([
              { id: "contacts" as InviteTab, label: "From contacts" },
              { id: "email" as InviteTab, label: "By email" },
            ]).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  tab === t.id
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto max-h-80">
            {tab === "contacts" && (
              <>
                {/* Search */}
                <div className="px-5 py-3">
                  <div className="relative">
                    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search for friends"
                      className="w-full h-8 pl-8 pr-3 text-sm bg-muted/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all"
                    />
                  </div>
                </div>

                {loadingContacts ? (
                  <div className="flex items-center justify-center py-8">
                    <Spinner className="w-5 h-5 text-muted-foreground" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-5">
                    <p className="text-sm text-muted-foreground">
                      {contacts.length === 0
                        ? "No contacts available to invite"
                        : "No contacts match your search"}
                    </p>
                    <p className="text-xs text-muted-foreground/60">Try inviting by email instead</p>
                  </div>
                ) : (
                  <ul>
                    {filtered.map((contact) => {
                      const status = inviteStatuses[contact.userId] ?? "idle";
                      const isDone = status === "success" || invited.has(contact.userId);
                      return (
                        <li key={contact.userId} className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/40 transition-colors">
                          <Avatar className="w-8 h-8 shrink-0">
                            <AvatarFallback className={`text-xs font-semibold ${getAvatarColor(contact.username)}`}>
                              {contact.displayName[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{contact.displayName}</p>
                            <p className="text-[0.65rem] text-muted-foreground truncate">{contact.username}</p>
                          </div>
                          <button
                            onClick={() => handleInviteContact(contact)}
                            disabled={isDone || status === "loading"}
                            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                              isDone
                                ? "border-emerald-500/40 text-emerald-500 bg-emerald-500/10 cursor-default"
                                : status === "error"
                                  ? "border-destructive/40 text-destructive bg-destructive/10"
                                  : "border-border text-foreground hover:bg-muted"
                            }`}
                          >
                            {status === "loading" ? (
                              <Spinner className="w-3 h-3" />
                            ) : isDone ? (
                              <><Check className="w-3 h-3" /> Invited</>
                            ) : status === "error" ? (
                              "Retry"
                            ) : (
                              "Invite"
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}

            {tab === "email" && (
              <div className="px-5 py-4 flex flex-col gap-4">
                {/* Single invite */}
                <form onSubmit={handleEmailInvite} className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Invite by email</label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={emailValue}
                      onChange={(e) => setEmailValue(e.target.value)}
                      placeholder="user@example.com"
                      disabled={emailStatus === "loading" || emailStatus === "success"}
                      className="flex-1 text-sm bg-muted/60 border border-border rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-ring/40 disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={emailStatus === "loading" || emailStatus === "success" || !emailValue.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
                    >
                      {emailStatus === "loading" ? <Spinner className="w-3 h-3" /> : emailStatus === "success" ? <Check className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
                      {emailStatus === "success" ? "Sent!" : "Invite"}
                    </button>
                  </div>
                  {emailStatus === "error" && emailError && (
                    <p className="text-[0.65rem] text-destructive">{emailError}</p>
                  )}
                </form>

                {/* Bulk import */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Import from file</label>
                  <div className="flex gap-2">
                    <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileChange} className="hidden" />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg border border-dashed border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {bulkEmails.length > 0 ? `${bulkEmails.length} emails loaded — replace` : "Choose .csv or .txt"}
                    </button>
                    {bulkEmails.length > 0 && !bulkRunning && (
                      <button
                        onClick={handleBulkSend}
                        disabled={bulkEmails.every((e) => e.status !== "pending")}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
                      >
                        <UserPlus className="w-3 h-3" /> Send all
                      </button>
                    )}
                    {bulkRunning && (
                      <div className="w-9 flex items-center justify-center">
                        <Spinner className="w-3.5 h-3.5 text-primary" />
                      </div>
                    )}
                  </div>

                  {bulkEmails.length > 0 && (
                    <ul className="max-h-28 overflow-y-auto space-y-0.5 text-[0.65rem] border border-border rounded-lg p-2">
                      {bulkEmails.map((item) => (
                        <li key={item.email} className="flex items-center gap-1.5 px-1">
                          {item.status === "done" && <Check className="w-3 h-3 text-emerald-500 shrink-0" />}
                          {item.status === "error" && <X className="w-3 h-3 text-destructive shrink-0" />}
                          {item.status === "sending" && <Spinner className="w-3 h-3 shrink-0" />}
                          {item.status === "pending" && <div className="w-3 h-3 rounded-full border border-border shrink-0" />}
                          <span className={`truncate ${item.status === "error" ? "text-destructive" : item.status === "done" ? "text-emerald-500" : "text-foreground"}`}>
                            {item.email}
                          </span>
                          {item.status === "error" && item.error && (
                            <span className="text-destructive/70 ml-auto shrink-0">{item.error}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[0.6rem] text-muted-foreground">One email per line, or comma/semicolon separated.</p>
                </div>
              </div>
            )}
          </div>

          {/* Copy invite link footer */}
          <div className="px-5 py-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Or, send a group invite link to a friend</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-8 px-3 flex items-center rounded-lg bg-muted/60 border border-border text-xs text-muted-foreground truncate">
                {latestInviteToken
                  ? `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${latestInviteToken}`
                  : "No invite link available — invite someone by email first"}
              </div>
              <button
                onClick={copyLink}
                disabled={!latestInviteToken}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {linkCopied ? <><Check className="w-3 h-3" /> Copied!</> : "Copy"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
