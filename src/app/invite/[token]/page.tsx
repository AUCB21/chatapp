"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type InviteState =
  | { kind: "loading" }
  | { kind: "ready"; chatName: string }
  | { kind: "accepting"; chatName: string }
  | { kind: "success"; chatName: string }
  | { kind: "expired" }
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
          const msg = json?.error ?? "Invalid invitation";
          if (res.status === 403 && msg.toLowerCase().includes("expired")) {
            setState({ kind: "expired" });
          } else {
            setState({ kind: "error", message: msg });
          }
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

        {state.kind === "expired" && (
          <>
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
            </div>
            <h1 className="text-lg font-semibold text-center">This link has expired</h1>
            <p className="text-sm text-muted-foreground text-center">
              Invitation links are valid for 7 days. Ask the chat admin to send you a new invite.
            </p>
            <Button variant="outline" onClick={() => router.push("/")} className="w-full">
              Back to chats
            </Button>
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
