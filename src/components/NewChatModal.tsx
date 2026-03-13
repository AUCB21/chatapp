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
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      onClose();
      setChatName("");
      setInvitedEmail("");
      setState({ kind: "idle" });
      setSuccessMessage(null);
      setInviteLink(null);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!chatName.trim()) return;

    setState({ kind: "submitting" });
    setSuccessMessage(null);
    setInviteLink(null);

    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatName: chatName.trim(),
          invitedEmail: invitedEmail.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setState({ kind: "error", message: json.error ?? "Something went wrong" });
        return;
      }

      setState({ kind: "idle" });
      const directInviteEmail = invitedEmail.trim();
      setChatName("");
      setInvitedEmail("");

      if (json.data.delivery === "direct") {
        setInviteLink(null);
        setSuccessMessage(
          `Invitation sent to ${directInviteEmail} for “${json.data.chatName}”.`
        );
      } else {
        const generatedLink = `${window.location.origin}/invite/${json.data.inviteToken}`;
        setInviteLink(generatedLink);
        setSuccessMessage(`Invite link created for “${json.data.chatName}”.`);
      }

      onChatCreated(json.data.chatId);
    } catch {
      setState({ kind: "error", message: "Network error" });
    }
  }

  async function handleCopyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setSuccessMessage("Invite link copied.");
    } catch {
      setSuccessMessage("Could not copy link. Copy it manually below.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <>
          <DialogHeader>
            <DialogTitle>New chat</DialogTitle>
            <DialogDescription>
              Create a chat, invite one person directly, or generate a shareable link.
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
              <Label htmlFor="invitedEmail">Invite one user now (optional)</Label>
              <Input
                id="invitedEmail"
                type="email"
                value={invitedEmail}
                onChange={(e) => setInvitedEmail(e.target.value)}
                placeholder="friend@example.com"
              />
              <p className="text-xs text-muted-foreground">
                If they are already online, they&apos;ll get an immediate accept or decline prompt.
                Leave blank to create a link invite instead.
              </p>
            </div>

            {inviteLink && (
              <div className="space-y-2">
                <Label htmlFor="inviteLink">Invite link</Label>
                <div className="flex gap-2">
                  <Input
                    id="inviteLink"
                    type="text"
                    value={inviteLink}
                    readOnly
                  />
                  <Button type="button" variant="outline" onClick={handleCopyLink}>
                    Copy
                  </Button>
                </div>
              </div>
            )}

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
                  !chatName.trim()
                }
                className="w-full sm:w-auto"
              >
                {state.kind === "submitting"
                  ? "Creating…"
                  : invitedEmail.trim()
                    ? "Create & send invite"
                    : "Create & generate link"}
              </Button>
            </DialogFooter>
          </form>
        </>
      </DialogContent>
    </Dialog>
  );
}
