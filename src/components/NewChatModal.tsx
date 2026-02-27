"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";

interface NewChatModalProps {
  open: boolean;
  onClose: () => void;
  onChatCreated: (chatId: string) => void;
}

type ModalState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; chatName: string }
  | { kind: "error"; message: string };

export default function NewChatModal({
  open,
  onClose,
  onChatCreated,
}: NewChatModalProps) {
  const [chatName, setChatName] = useState("");
  const [invitedEmail, setInvitedEmail] = useState("");
  const [state, setState] = useState<ModalState>({ kind: "idle" });

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setChatName("");
      setInvitedEmail("");
      setState({ kind: "idle" });
    }
  }, [open]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!chatName.trim() || !invitedEmail.trim()) return;

    setState({ kind: "submitting" });

    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatName: chatName.trim(),
          invitedEmail: invitedEmail.trim(),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setState({ kind: "error", message: json.error ?? "Something went wrong" });
        return;
      }

      setState({ kind: "success", chatName: json.data.chatName });
      onChatCreated(json.data.chatId);
    } catch {
      setState({ kind: "error", message: "Network error" });
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-neutral-900">New chat</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-900 transition text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {state.kind !== "success" ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="block text-xs text-neutral-500 mb-1" htmlFor="chatName">
                Chat name
              </label>
              <input
                ref={inputRef}
                id="chatName"
                type="text"
                value={chatName}
                onChange={(e) => setChatName(e.target.value)}
                placeholder="e.g. Project Alpha"
                maxLength={100}
                required
                className="w-full bg-neutral-100 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-neutral-900 transition"
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-500 mb-1" htmlFor="invitedEmail">
                Invite via email
              </label>
              <input
                id="invitedEmail"
                type="email"
                value={invitedEmail}
                onChange={(e) => setInvitedEmail(e.target.value)}
                placeholder="friend@example.com"
                required
                className="w-full bg-neutral-100 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-neutral-900 transition"
              />
            </div>

            {state.kind === "error" && (
              <p className="text-xs text-red-500">{state.message}</p>
            )}

            <button
              type="submit"
              disabled={
                state.kind === "submitting" ||
                !chatName.trim() ||
                !invitedEmail.trim()
              }
              className="w-full bg-neutral-900 text-white text-sm py-2.5 rounded-xl hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition mt-1"
            >
              {state.kind === "submitting" ? "Creating…" : "Create & invite"}
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium text-neutral-900 mb-1">
                &ldquo;{state.chatName}&rdquo; created!
              </p>
              <p className="text-xs text-neutral-500">
                The invitation will appear in their chat list when they log in.
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-neutral-900 text-white text-sm py-2.5 rounded-xl hover:bg-neutral-700 transition"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
