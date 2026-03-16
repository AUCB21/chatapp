"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSessionStore } from "@/store/sessionStore";
import { Button } from "@/components/ui/button";

// --- Types ---

interface AdminUser {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  status: string;
  isAdmin: boolean;
  createdAt: string;
}

interface AdminChat {
  id: string;
  name: string | null;
  type: string;
  createdAt: string;
  memberCount: number;
}

interface Stats {
  users: number;
  chats: number;
  messages: number;
}

type Tab = "overview" | "users" | "chats";

// --- Component ---

export default function AdminPage() {
  const user = useSessionStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Per-tab data
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [chats, setChats] = useState<AdminChat[]>([]);

  // Loading / error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Confirm-delete state
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Track which tabs have been fetched
  const [fetched, setFetched] = useState<Set<Tab>>(new Set());

  useEffect(() => {
    if (fetched.has(activeTab)) return;

    setLoading(true);
    setError(null);

    const fetchTab = async () => {
      try {
        if (activeTab === "overview") {
          const res = await fetch("/api/admin/stats");
          if (!res.ok) throw new Error(`${res.status}`);
          const { data } = await res.json();
          setStats(data);
        } else if (activeTab === "users") {
          const res = await fetch("/api/admin/users");
          if (!res.ok) throw new Error(`${res.status}`);
          const { data } = await res.json();
          setUsers(data.users ?? []);
        } else {
          const res = await fetch("/api/admin/chats");
          if (!res.ok) throw new Error(`${res.status}`);
          const { data } = await res.json();
          setChats(data.chats ?? []);
        }
        setFetched((prev) => new Set(prev).add(activeTab));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchTab();
  }, [activeTab, fetched]);

  const handleDeleteUser = async (userId: string) => {
    if (confirmingId !== userId) {
      setConfirmingId(userId);
      return;
    }
    setConfirmingId(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setUsers((prev) => prev.filter((u) => u.userId !== userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (confirmingId !== chatId) {
      setConfirmingId(chatId);
      return;
    }
    setConfirmingId(null);
    try {
      const res = await fetch("/api/admin/chats", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setChats((prev) => prev.filter((c) => c.id !== chatId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  if (user?.isAdmin !== true) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <p className="text-muted-foreground">Access denied.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top nav */}
      <div className="flex items-center gap-4 border-b border-border px-6 py-3">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to chat
        </Link>
        <h1 className="text-lg font-semibold">Admin Dashboard</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border px-6">
        {(["overview", "users", "chats"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setConfirmingId(null); setError(null); }}
            className={`px-4 py-2 text-sm capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {error && (
          <p className="mb-4 text-sm text-destructive">Error: {error}</p>
        )}
        {loading && (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}

        {/* Overview */}
        {activeTab === "overview" && !loading && stats && (
          <div className="grid grid-cols-3 gap-4 max-w-2xl">
            {(["users", "chats", "messages"] as const).map((key) => (
              <div key={key} className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{key}</p>
                <p className="text-3xl font-bold">{stats[key].toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        {/* Users */}
        {activeTab === "users" && !loading && users.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Display Name</th>
                  <th className="pb-2 pr-4 font-medium">Username</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Admin</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.userId} className="border-b border-border/50">
                    <td className="py-2 pr-4">{u.displayName}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{u.username}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{u.status}</td>
                    <td className="py-2 pr-4">
                      {u.isAdmin && (
                        <span className="rounded bg-primary/20 px-1.5 py-0.5 text-xs text-primary">
                          admin
                        </span>
                      )}
                    </td>
                    <td className="py-2">
                      {u.userId !== user.id && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteUser(u.userId)}
                        >
                          {confirmingId === u.userId ? "Confirm?" : "Delete"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {activeTab === "users" && !loading && users.length === 0 && !error && (
          <p className="text-sm text-muted-foreground">No users found.</p>
        )}

        {/* Chats */}
        {activeTab === "chats" && !loading && chats.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">Members</th>
                  <th className="pb-2 pr-4 font-medium">Created</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {chats.map((c) => (
                  <tr key={c.id} className="border-b border-border/50">
                    <td className="py-2 pr-4">{c.name ?? <span className="italic text-muted-foreground">Direct</span>}</td>
                    <td className="py-2 pr-4 text-muted-foreground capitalize">{c.type}</td>
                    <td className="py-2 pr-4">{c.memberCount}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteChat(c.id)}
                      >
                        {confirmingId === c.id ? "Confirm?" : "Delete"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {activeTab === "chats" && !loading && chats.length === 0 && !error && (
          <p className="text-sm text-muted-foreground">No chats found.</p>
        )}
      </div>
    </div>
  );
}
