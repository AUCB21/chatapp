"use client";

import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NewChatModalProps {
  open: boolean;
  onClose: () => void;
  onChatCreated: (chatId: string) => void;
}

type ModalState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

export default function NewChatModal({
  open,
  onClose,
  onChatCreated,
}: NewChatModalProps) {
  const [chatName, setChatName] = useState("");
  const [invitedEmail, setInvitedEmail] = useState("");
  const [state, setState] = useState<ModalState>({ kind: "idle" });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      onClose();
      setChatName("");
      setInvitedEmail("");
      setState({ kind: "idle" });
      setSuccessMessage(null);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!chatName.trim() || !invitedEmail.trim()) return;

    setState({ kind: "submitting" });
    setSuccessMessage(null);

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

      setState({ kind: "idle" });
      setChatName("");
      setInvitedEmail("");
      setSuccessMessage(`Invitation sent for “${json.data.chatName}”.`);
      onChatCreated(json.data.chatId);
    } catch {
      setState({ kind: "error", message: "Network error" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <>
          <DialogHeader>
            <DialogTitle>New chat</DialogTitle>
            <DialogDescription>
              Create a new chat and invite someone to join.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="chatName">Chat name</Label>
              <Input
                id="chatName"
                type="text"
                value={chatName}
                onChange={(e) => setChatName(e.target.value)}
                placeholder="e.g. Project Alpha"
                maxLength={100}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invitedEmail">Invite via email</Label>
              <Input
                id="invitedEmail"
                type="email"
                value={invitedEmail}
                onChange={(e) => setInvitedEmail(e.target.value)}
                placeholder="friend@example.com"
                required
              />
            </div>

            {successMessage && (
              <div className="text-sm text-emerald-600">{successMessage}</div>
            )}

            {state.kind === "error" && (
              <div className="text-sm text-destructive">{state.message}</div>
            )}

            <DialogFooter>
              <Button
                type="submit"
                disabled={
                  state.kind === "submitting" ||
                  !chatName.trim() ||
                  !invitedEmail.trim()
                }
                className="w-full sm:w-auto"
              >
                {state.kind === "submitting" ? "Creating…" : "Create & invite"}
              </Button>
            </DialogFooter>
          </form>
        </>
      </DialogContent>
    </Dialog>
  );
}
