"use client";

import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
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
      <div className="px-5 py-4 border-t border-border shrink-0 bg-background">
        <p className="text-xs text-muted-foreground text-center">
          You have read-only access to this chat.
        </p>
      </div>
    );
  }

  return (
    <>
      {replyTo && (
        <div className="px-4 md:px-5 pt-3 pb-0 flex items-center gap-3 shrink-0">
          <div className="flex-1 min-w-0 flex items-center gap-2.5 bg-muted/60 border border-border/60 rounded-xl px-3 py-2">
            <div className="w-0.5 h-8 rounded-full bg-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[0.6rem] font-medium text-primary uppercase tracking-wider mb-0.5">Replying</p>
              <p className="text-xs text-muted-foreground truncate">{replyTo.content}</p>
            </div>
            <button
              onClick={onJumpToReplyMessage}
              className="text-[0.65rem] text-muted-foreground hover:text-foreground px-1.5 transition-colors shrink-0"
            >
              Jump
            </button>
            <button
              onClick={onCancelReply}
              className="w-5 h-5 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-border transition-colors shrink-0"
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSend}
        className="px-4 md:px-5 py-3 border-t border-border bg-background flex items-end gap-2.5 shrink-0"
      >
        <button
          type="button"
          className="mb-0.5 w-9 h-9 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
          title="Attach file"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <textarea
          value={input}
          onChange={(e) => {
            const value = e.target.value;
            setInput(value);
            onTypingChange(value.trim().length > 0);
          }}
          onKeyDown={handleComposerKeyDown}
          placeholder={replyTo ? "Write a reply…" : "Type a message…"}
          rows={1}
          className="flex-1 rounded-2xl min-h-9 max-h-36 bg-muted/60 border border-border/60 text-sm px-4 py-2 outline-none resize-none focus:ring-1 focus:ring-ring/40 focus:border-border transition-all placeholder:text-muted-foreground/50"
        />

        <button
          type="submit"
          disabled={!input.trim()}
          className="mb-0.5 w-9 h-9 flex items-center justify-center rounded-xl bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </>
  );
}
