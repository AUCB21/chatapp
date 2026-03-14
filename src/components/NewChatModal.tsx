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
import { MessageCircle, Users, Plus, X } from "lucide-react";

interface NewChatModalProps {
  open: boolean;
  onClose: () => void;
  onChatCreated: (chatId: string) => void;
}

type Mode = "direct" | "group";

type ModalState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

export default function NewChatModal({
  open,
  onClose,
  onChatCreated,
}: NewChatModalProps) {
  const [mode, setMode] = useState<Mode>("direct");

  // Direct fields
  const [directEmail, setDirectEmail] = useState("");

  // Group fields
  const [groupName, setGroupName] = useState("");
  const [groupEmails, setGroupEmails] = useState<string[]>([""]);

  const [state, setState] = useState<ModalState>({ kind: "idle" });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  function reset() {
    setDirectEmail("");
    setGroupName("");
    setGroupEmails([""]);
    setState({ kind: "idle" });
    setSuccessMessage(null);
    setInviteLink(null);
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      onClose();
      reset();
    }
  }

  function switchMode(m: Mode) {
    setMode(m);
    setState({ kind: "idle" });
    setSuccessMessage(null);
    setInviteLink(null);
  }

  function addEmailField() {
    setGroupEmails((prev) => [...prev, ""]);
  }

  function removeEmailField(index: number) {
    setGroupEmails((prev) => prev.filter((_, i) => i !== index));
  }

  function updateEmailField(index: number, value: string) {
    setGroupEmails((prev) => prev.map((e, i) => (i === index ? value : e)));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ kind: "submitting" });
    setSuccessMessage(null);
    setInviteLink(null);

    try {
      let body: Record<string, unknown>;

      if (mode === "direct") {
        body = { type: "direct", invitedEmail: directEmail.trim() };
      } else {
        const emails = groupEmails.map((e) => e.trim()).filter(Boolean);
        body = { type: "group", chatName: groupName.trim(), invitedEmails: emails };
      }

      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        setState({ kind: "error", message: json.error ?? "Something went wrong" });
        return;
      }

      setState({ kind: "idle" });

      if (mode === "direct") {
        setSuccessMessage(`Invitation sent to ${directEmail.trim()}.`);
        setDirectEmail("");
      } else if (json.data.delivery === "link") {
        const generatedLink = `${window.location.origin}/invite/${json.data.inviteToken}`;
        setInviteLink(generatedLink);
        setSuccessMessage(`Invite link created for "${json.data.chatName}".`);
        setGroupName("");
        setGroupEmails([""]);
      } else {
        const count = json.data.invitedEmails?.length ?? 0;
        setSuccessMessage(
          `"${json.data.chatName}" created. ${count} invitation${count !== 1 ? "s" : ""} sent.`
        );
        setGroupName("");
        setGroupEmails([""]);
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
      setSuccessMessage("Could not copy. Copy it manually below.");
    }
  }

  const isSubmitting = state.kind === "submitting";

  const canSubmitDirect = directEmail.trim().length > 0;
  const canSubmitGroup =
    groupName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
          <DialogDescription>
            Start a direct message or create a group chat.
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex gap-1 p-1 rounded-lg bg-muted">
          <button
            type="button"
            onClick={() => switchMode("direct")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === "direct"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Direct
          </button>
          <button
            type="button"
            onClick={() => switchMode("group")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === "group"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Group
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "direct" ? (
            <div className="space-y-2">
              <Label htmlFor="directEmail">Email address</Label>
              <Input
                id="directEmail"
                type="email"
                value={directEmail}
                onChange={(e) => setDirectEmail(e.target.value)}
                placeholder="friend@example.com"
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                If they don&apos;t have an account yet, they&apos;ll receive a signup invitation.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="groupName">Group name</Label>
                <Input
                  id="groupName"
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Project Alpha"
                  maxLength={100}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label>Invite members (optional)</Label>
                <div className="space-y-2">
                  {groupEmails.map((email, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => updateEmailField(i, e.target.value)}
                        placeholder="member@example.com"
                      />
                      {groupEmails.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeEmailField(i)}
                          className="shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addEmailField}
                  className="flex items-center gap-1 text-xs text-primary hover:underline underline-offset-4 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add another
                </button>
                <p className="text-xs text-muted-foreground">
                  Leave all emails blank to generate a shareable link instead.
                </p>
              </div>
            </>
          )}

          {inviteLink && (
            <div className="space-y-2">
              <Label>Invite link</Label>
              <div className="flex gap-2">
                <Input type="text" value={inviteLink} readOnly />
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
                isSubmitting ||
                (mode === "direct" ? !canSubmitDirect : !canSubmitGroup)
              }
              className="w-full sm:w-auto"
            >
              {isSubmitting
                ? "Creating…"
                : mode === "direct"
                  ? "Send invite"
                  : groupEmails.some((e) => e.trim())
                    ? "Create & invite"
                    : "Create & generate link"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
