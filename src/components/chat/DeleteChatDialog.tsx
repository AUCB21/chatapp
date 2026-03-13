"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteChatDialogProps {
  open: boolean;
  chatName: string;
  isAdmin: boolean;
  onClose: () => void;
  onDelete: (mode: "for_me" | "for_everyone") => Promise<void>;
}

export default function DeleteChatDialog({
  open,
  chatName,
  isAdmin,
  onClose,
  onDelete,
}: DeleteChatDialogProps) {
  const [loading, setLoading] = useState<"for_me" | "for_everyone" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(mode: "for_me" | "for_everyone") {
    setLoading(mode);
    setError(null);
    try {
      await onDelete(mode);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete chat</DialogTitle>
          <DialogDescription>
            Delete <span className="font-medium text-foreground">{chatName}</span>?
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Button
            variant="destructive"
            className="w-full"
            disabled={!!loading}
            onClick={() => handleDelete("for_me")}
          >
            {loading === "for_me" ? "Deleting..." : "Delete for me"}
          </Button>

          {isAdmin && (
            <Button
              variant="destructive"
              className="w-full"
              disabled={!!loading}
              onClick={() => handleDelete("for_everyone")}
            >
              {loading === "for_everyone" ? "Deleting..." : "Delete for everyone"}
            </Button>
          )}

          <Button
            variant="outline"
            className="w-full"
            disabled={!!loading}
            onClick={onClose}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
