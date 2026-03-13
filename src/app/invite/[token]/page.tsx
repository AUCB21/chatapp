"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type InviteState =
  | { kind: "loading" }
  | { kind: "ready"; chatName: string }
  | { kind: "accepting"; chatName: string }
  | { kind: "success"; chatName: string }
  | { kind: "error"; message: string };

export default function InviteTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<InviteState>({ kind: "loading" });

  useEffect(() => {
    let active = true;

    async function load() {
      const resolved = await params;
      if (!active) return;
      setToken(resolved.token);

      try {
        const res = await fetch(`/api/invite/${resolved.token}`);
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          setState({ kind: "error", message: json?.error ?? "Invalid invitation" });
          return;
        }
        setState({ kind: "ready", chatName: json.data.chatName });
      } catch {
        setState({ kind: "error", message: "Network error" });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [params]);

  async function handleAccept() {
    if (!token || state.kind !== "ready") return;
    setState({ kind: "accepting", chatName: state.chatName });

    try {
      const res = await fetch(`/api/invite/${token}`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setState({ kind: "error", message: json?.error ?? "Failed to accept invitation" });
        return;
      }

      setState({ kind: "success", chatName: state.chatName });
      setTimeout(() => {
        router.push("/");
      }, 800);
    } catch {
      setState({ kind: "error", message: "Network error" });
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 space-y-4">
        {state.kind === "loading" && <p className="text-sm text-muted-foreground">Loading invitation...</p>}

        {(state.kind === "ready" || state.kind === "accepting" || state.kind === "success") && (
          <>
            <h1 className="text-lg font-semibold">Join chat</h1>
            <p className="text-sm text-muted-foreground">
              You&apos;ve been invited to join <span className="font-medium text-foreground">{state.chatName}</span>.
            </p>

            {state.kind === "success" ? (
              <p className="text-sm text-emerald-600">Invitation accepted. Redirecting...</p>
            ) : (
              <Button
                onClick={handleAccept}
                disabled={state.kind === "accepting"}
                className="w-full"
              >
                {state.kind === "accepting" ? "Joining..." : "Accept invitation"}
              </Button>
            )}
          </>
        )}

        {state.kind === "error" && (
          <>
            <h1 className="text-lg font-semibold">Invite unavailable</h1>
            <p className="text-sm text-destructive">{state.message}</p>
            <Button variant="outline" onClick={() => router.push("/")} className="w-full">
              Back to chats
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
