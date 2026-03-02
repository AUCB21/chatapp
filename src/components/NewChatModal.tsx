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

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      onClose();
      // Reset state when closing
      setTimeout(() => {
        setChatName("");
        setInvitedEmail("");
        setState({ kind: "idle" });
      }, 200);
    }
  }

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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {state.kind !== "success" ? (
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
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Chat created!</DialogTitle>
              <DialogDescription>
                &ldquo;{state.chatName}&rdquo; has been created successfully. The invitation will appear in their chat list when they log in.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={onClose} className="w-full sm:w-auto">
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
