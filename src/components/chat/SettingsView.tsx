"use client";

import { useState, useCallback, useEffect } from "react";
import { useTheme } from "next-themes";
import { ArrowLeft, ChevronRight, Moon, Sun, Monitor, Palette, User, Shield, Trash2, KeyRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProfileStore } from "@/store/profileStore";
import { useSessionStore } from "@/store/sessionStore";
import { getSupabase } from "@/lib/supabaseClient";
import type { UserStatus } from "@/db/schema";

interface SettingsViewProps {
  onBack: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
}

type SettingsPage = "main" | "profile" | "appearance" | "status";

const STATUS_OPTIONS: { value: UserStatus; label: string; color: string; description: string }[] = [
  { value: "online", label: "Online", color: "bg-emerald-500", description: "You appear active to others" },
  { value: "idle", label: "Idle", color: "bg-amber-500", description: "Auto-sets after 5 min inactivity" },
  { value: "dnd", label: "Do Not Disturb", color: "bg-rose-500", description: "Notification sounds are muted" },
];

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#0ea5e9", "#06b6d4", "#10b981", "#84cc16", "#a855f7",
];

export default function SettingsView({ onBack, onLogout, onDeleteAccount }: SettingsViewProps) {
  const [page, setPage] = useState<SettingsPage>("main");
  const profile = useProfileStore((s) => s.profile);
  const updateProfileStore = useProfileStore((s) => s.updateProfile);
  const user = useSessionStore((s) => s.user);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [passwordSending, setPasswordSending] = useState(false);
  const [passwordResult, setPasswordResult] = useState<{ type: "success" | "rate-limit" | "error"; message: string } | null>(null);

  // Local edit state for profile fields
  const [editUsername, setEditUsername] = useState(profile?.username ?? "");
  const [editDisplayName, setEditDisplayName] = useState(profile?.displayName ?? "");

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    setEditUsername(profile?.username ?? "");
    setEditDisplayName(profile?.displayName ?? "");
  }, [profile?.username, profile?.displayName]);

  const saveProfile = useCallback(async (updates: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const { data } = await res.json();
        if (data.profile) {
          updateProfileStore({
            ...data.profile,
            createdAt: new Date(data.profile.createdAt),
            updatedAt: new Date(data.profile.updatedAt),
          });
        }
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }, [updateProfileStore]);

  const handlePasswordChange = useCallback(async () => {
    if (!user?.email) return;
    setPasswordSending(true);
    setPasswordResult(null);

    const RATE_LIMIT_KEY = "password_reset_last_sent";
    const RATE_LIMIT_SECONDS = 60;
    const lastSent = parseInt(localStorage.getItem(RATE_LIMIT_KEY) ?? "0", 10);
    const elapsed = Math.floor(Date.now() / 1000) - lastSent;

    if (elapsed < RATE_LIMIT_SECONDS) {
      const remaining = RATE_LIMIT_SECONDS - elapsed;
      setPasswordResult({
        type: "rate-limit",
        message: `Please wait ${remaining}s before requesting another reset email.`,
      });
      setPasswordSending(false);
      return;
    }

    try {
      const supabase = getSupabase();
      await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      localStorage.setItem(RATE_LIMIT_KEY, String(Math.floor(Date.now() / 1000)));
      setPasswordResult({
        type: "success",
        message: "Reset email sent! Check your inbox.",
      });
    } catch {
      setPasswordResult({
        type: "error",
        message: "Failed to send reset email. Try again later.",
      });
    } finally {
      setPasswordSending(false);
    }
  }, [user?.email]);

  const displayName = profile?.displayName ?? user?.email?.split("@")[0] ?? "User";

  if (page === "profile") {
    return (
      <div className="flex h-full flex-col bg-sidebar">
        <PageHeader title="Profile" onBack={() => setPage("main")} />
        <ScrollArea className="flex-1 px-4 py-4">
          <div className="space-y-5">
            {/* Avatar placeholder */}
            <div className="flex flex-col items-center gap-3">
              <Avatar className="w-16 h-16">
                <AvatarFallback className="text-lg font-semibold bg-primary/15 text-primary">
                  {displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <p className="text-[0.6rem] text-muted-foreground">Profile image coming soon</p>
            </div>

            {/* Username */}
            <FieldGroup label="Username">
              <input
                type="text"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                onBlur={() => {
                  const v = editUsername.trim();
                  if (v && v !== profile?.username) saveProfile({ username: v });
                }}
                className="w-full rounded-lg bg-sidebar-accent/60 border border-sidebar-border/50 py-2 px-3 text-sm outline-none focus:ring-1 focus:ring-ring/40"
              />
            </FieldGroup>

            {/* Display Name */}
            <FieldGroup label="Display Name">
              <input
                type="text"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                onBlur={() => {
                  const v = editDisplayName.trim();
                  if (v && v !== profile?.displayName) saveProfile({ displayName: v });
                }}
                className="w-full rounded-lg bg-sidebar-accent/60 border border-sidebar-border/50 py-2 px-3 text-sm outline-none focus:ring-1 focus:ring-ring/40"
              />
            </FieldGroup>

            {/* Email (read-only) */}
            <FieldGroup label="Email">
              <p className="text-sm text-muted-foreground px-3 py-2">{user?.email ?? "—"}</p>
            </FieldGroup>
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (page === "appearance") {
    return (
      <div className="flex h-full flex-col bg-sidebar">
        <PageHeader title="Appearance" onBack={() => setPage("main")} />
        <ScrollArea className="flex-1 px-4 py-4">
          <div className="space-y-6">
            {/* Theme */}
            <FieldGroup label="Theme">
              <div className="flex gap-2">
                {[
                  { value: "light", icon: Sun, label: "Light" },
                  { value: "dark", icon: Moon, label: "Dark" },
                  { value: "system", icon: Monitor, label: "System" },
                ].map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-lg border transition-all ${
                      mounted && theme === value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-sidebar-border/50 hover:bg-sidebar-accent/60 text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[0.65rem] font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </FieldGroup>

            {/* Custom Colors */}
            <ColorPicker
              label="Background Color"
              value={profile?.accentBg ?? null}
              onChange={(color) => saveProfile({ accentBg: color })}
            />
            <ColorPicker
              label="Font Color"
              value={profile?.accentFont ?? null}
              onChange={(color) => saveProfile({ accentFont: color })}
            />
            <ColorPicker
              label="Chat Bubble Color"
              value={profile?.accentChat ?? null}
              onChange={(color) => saveProfile({ accentChat: color })}
            />
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (page === "status") {
    return (
      <div className="flex h-full flex-col bg-sidebar">
        <PageHeader title="Status" onBack={() => setPage("main")} />
        <ScrollArea className="flex-1 px-4 py-4">
          <div className="space-y-1">
            {STATUS_OPTIONS.map((opt) => {
              const isActive = profile?.status === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => saveProfile({ status: opt.value })}
                  disabled={saving}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                    isActive
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-sidebar-accent/60 border border-transparent"
                  }`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${opt.color}`} />
                  <div className="text-left flex-1">
                    <p className={`text-sm font-medium ${isActive ? "text-primary" : ""}`}>
                      {opt.label}
                    </p>
                    <p className="text-[0.6rem] text-muted-foreground">{opt.description}</p>
                  </div>
                  {isActive && (
                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Main settings page
  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Header */}
      <div className="h-15 shrink-0 border-b border-sidebar-border px-4 flex items-center gap-2.5">
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold">Settings</span>
      </div>

      <ScrollArea className="flex-1 px-2 py-2">
        {/* User summary card */}
        <div className="mx-2 mb-4 p-3 rounded-xl bg-sidebar-accent/40 flex items-center gap-3">
          <Avatar className="w-10 h-10 shrink-0">
            <AvatarFallback className="text-sm font-semibold bg-primary/15 text-primary">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{displayName}</p>
            <p className="text-[0.6rem] text-muted-foreground truncate">{user?.email}</p>
          </div>
          <StatusDot status={profile?.status ?? "online"} />
        </div>

        {/* Menu items */}
        <div className="space-y-0.5">
          <MenuItem
            icon={User}
            label="Profile"
            sublabel="Username, display name"
            onClick={() => setPage("profile")}
          />
          <MenuItem
            icon={Palette}
            label="Appearance"
            sublabel={mounted ? `${theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System"} theme` : ""}
            onClick={() => setPage("appearance")}
          />
          <MenuItem
            icon={Shield}
            label="Status"
            sublabel={STATUS_OPTIONS.find((s) => s.value === profile?.status)?.label ?? "Online"}
            onClick={() => setPage("status")}
          />

          <div className="h-px bg-sidebar-border mx-2 my-2" />

          <MenuItem
            icon={KeyRound}
            label="Change Password"
            sublabel="Send reset email"
            onClick={() => { setPasswordResult(null); setPasswordModal(true); }}
          />

          <div className="h-px bg-sidebar-border mx-2 my-2" />

          {/* Logout */}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-sidebar-accent/60 transition-colors text-rose-500/80 hover:text-rose-500"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Log out</span>
          </button>

          {/* Delete Account */}
          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-destructive/10 transition-colors text-destructive/70 hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-sm font-medium">Delete Account</span>
            </button>
          ) : (
            <div className="mx-2 p-3 rounded-xl border border-destructive/30 bg-destructive/5 space-y-2">
              <p className="text-xs text-destructive font-medium">
                This will permanently delete your account and all data. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteModal(true)}
                  className="flex-1 text-xs py-1.5 rounded-lg bg-destructive text-destructive-foreground font-medium hover:opacity-90 transition-opacity"
                >
                  Confirm Delete
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="flex-1 text-xs py-1.5 rounded-lg bg-sidebar-accent text-foreground font-medium hover:opacity-80 transition-opacity"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Password reset confirmation modal */}
      {passwordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setPasswordModal(false)}
          />
          <div className="relative z-10 w-[90vw] max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <KeyRound className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-base font-semibold">Change Password</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A password reset link will be sent to{" "}
                <span className="font-medium text-foreground">{user?.email}</span>.
                You&apos;ll be redirected to set a new password.
              </p>
            </div>
            {passwordResult && (
              <div className={`text-xs px-3 py-2 rounded-lg border ${
                passwordResult.type === "success"
                  ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/20"
                  : passwordResult.type === "rate-limit"
                    ? "text-amber-600 bg-amber-500/10 border-amber-500/20"
                    : "text-destructive bg-destructive/10 border-destructive/20"
              }`}>
                {passwordResult.message}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setPasswordModal(false)}
                disabled={passwordSending}
                className="flex-1 text-sm py-2 rounded-lg border border-border bg-secondary text-secondary-foreground font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordChange}
                disabled={passwordSending}
                className="flex-1 text-sm py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {passwordSending ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Sending…
                  </>
                ) : (
                  "Send Reset Email"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Final confirmation modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDeleteModal(false)}
          />
          <div className="relative z-10 w-[90vw] max-w-sm rounded-xl border border-destructive/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="text-base font-semibold">Are you absolutely sure?</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your account, messages, and all associated data will be permanently deleted.
                This action <span className="font-semibold text-destructive">cannot</span> be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal(false)}
                className="flex-1 text-sm py-2 rounded-lg border border-border bg-secondary text-secondary-foreground font-medium hover:opacity-80 transition-opacity"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setDeleteModal(false);
                  onDeleteAccount();
                }}
                className="flex-1 text-sm py-2 rounded-lg bg-destructive text-destructive-foreground font-medium hover:opacity-90 transition-opacity"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function PageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="h-15 shrink-0 border-b border-sidebar-border px-4 flex items-center gap-2.5">
      <button
        onClick={onBack}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
      </button>
      <span className="text-sm font-semibold">{title}</span>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  sublabel,
  onClick,
}: {
  icon: typeof User;
  label: string;
  sublabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-sidebar-accent/60 transition-colors group"
    >
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="flex-1 text-left min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {sublabel && (
          <p className="text-[0.6rem] text-muted-foreground truncate">{sublabel}</p>
        )}
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 group-hover:text-muted-foreground transition-colors" />
    </button>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60 px-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function StatusDot({ status }: { status: UserStatus }) {
  const color =
    status === "online" ? "bg-emerald-500" :
    status === "idle" ? "bg-amber-500" :
    "bg-rose-500";
  return <div className={`w-2 h-2 rounded-full ${color}`} />;
}

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (color: string | null) => void;
}) {
  return (
    <FieldGroup label={label}>
      <div className="flex flex-wrap gap-2">
        {/* Reset button */}
        <button
          onClick={() => onChange(null)}
          className={`w-7 h-7 rounded-lg border-2 transition-all flex items-center justify-center ${
            !value
              ? "border-primary ring-2 ring-primary/30"
              : "border-sidebar-border/50 hover:border-muted-foreground/40"
          }`}
          title="Reset to default"
        >
          <svg className="w-3 h-3 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => onChange(color)}
            className={`w-7 h-7 rounded-lg border-2 transition-all ${
              value === color
                ? "border-primary ring-2 ring-primary/30 scale-110"
                : "border-transparent hover:scale-110"
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}

        {/* Custom color input */}
        <label
          className={`w-7 h-7 rounded-lg border-2 transition-all cursor-pointer flex items-center justify-center ${
            value && !PRESET_COLORS.includes(value)
              ? "border-primary ring-2 ring-primary/30"
              : "border-sidebar-border/50 hover:border-muted-foreground/40"
          }`}
          style={value && !PRESET_COLORS.includes(value) ? { backgroundColor: value } : undefined}
          title="Custom color"
        >
          {(!value || PRESET_COLORS.includes(value)) && (
            <Palette className="w-3 h-3 text-muted-foreground" />
          )}
          <input
            type="color"
            value={value ?? "#000000"}
            onChange={(e) => onChange(e.target.value)}
            className="sr-only"
          />
        </label>
      </div>
    </FieldGroup>
  );
}
