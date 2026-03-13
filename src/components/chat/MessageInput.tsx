"use client";

import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Paperclip, Send } from "lucide-react";

interface MessageInputProps {
  canWrite: boolean;
  replyTo: { id: string; content: string } | null;
  onSend: (content: string) => Promise<void>;
  onTypingChange: (isTyping: boolean) => void;
  onJumpToReplyMessage: () => void;
  onCancelReply: () => void;
}

export default function MessageInput({
  canWrite,
  replyTo,
  onSend,
  onTypingChange,
  onJumpToReplyMessage,
  onCancelReply,
}: MessageInputProps) {
  const [input, setInput] = useState("");

  useEffect(() => {
    return () => onTypingChange(false);
  }, [onTypingChange]);

  async function handleSend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const content = input.trim();
    if (!content) return;
    setInput("");
    onTypingChange(false);
    await onSend(content);
  }

  function handleComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter") return;
    if (e.shiftKey) return;
    if (e.nativeEvent.isComposing) return;

    e.preventDefault();
    if (!input.trim()) return;
    const form = e.currentTarget.form;
    form?.requestSubmit();
  }

  if (!canWrite) {
    return (
      <div className="px-6 py-4 border-t shrink-0 bg-background">
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
        <div className="px-4 md:px-6 py-2.5 border-t bg-muted/50 flex items-center gap-3 shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Replying to:</p>
            <p className="text-sm truncate">{replyTo.content}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onJumpToReplyMessage}
            className="shrink-0"
          >
            Jump
          </Button>
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
        onSubmit={handleSend}
        className="px-4 md:px-6 py-3 md:py-4 border-t bg-background flex items-center gap-3 shrink-0"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-xl text-muted-foreground hover:bg-muted"
          title="Attach file"
        >
          <Paperclip className="w-5 h-5" />
        </Button>

        <textarea
          value={input}
          onChange={(e) => {
            const value = e.target.value;
            setInput(value);
            onTypingChange(value.trim().length > 0);
          }}
          onKeyDown={handleComposerKeyDown}
          placeholder={replyTo ? "Reply…" : "Type a message…"}
          rows={1}
          className="flex-1 rounded-2xl min-h-11 max-h-36 bg-muted border-0 text-sm px-4 py-3 outline-none resize-none"
        />
        <Button
          type="submit"
          disabled={!input.trim()}
          size="icon"
          className="rounded-2xl h-11 w-11"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </>
  );
}
