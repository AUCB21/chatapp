"use client";

import { type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface MessageInputProps {
  canWrite: boolean;
  input: string;
  replyTo: { id: string; content: string } | null;
  onInputChange: (value: string) => void;
  onSend: (e: FormEvent<HTMLFormElement>) => void;
  onCancelReply: () => void;
}

export default function MessageInput({
  canWrite,
  input,
  replyTo,
  onInputChange,
  onSend,
  onCancelReply,
}: MessageInputProps) {
  if (!canWrite) {
    return (
      <div className="px-6 py-4 border-t shrink-0">
        <p className="text-xs text-muted-foreground text-center">
          You have read-only access to this chat.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Reply preview bar */}
      {replyTo && (
        <div className="px-3 md:px-5 py-2 border-t bg-muted/50 flex items-center gap-3 shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Replying to:</p>
            <p className="text-sm truncate">{replyTo.content}</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancelReply}
            className="shrink-0"
          >
            ✕
          </Button>
        </div>
      )}

      <form
        onSubmit={onSend}
        className="px-3 md:px-5 py-3 md:py-4 border-t flex items-center gap-2 md:gap-3 shrink-0"
      >
        <Input
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={replyTo ? "Reply…" : "Type a message…"}
          className="flex-1 rounded-full text-base md:text-sm"
        />
        <Button
          type="submit"
          disabled={!input.trim()}
          className="rounded-full px-4 md:px-6"
        >
          Send
        </Button>
      </form>
    </>
  );
}
