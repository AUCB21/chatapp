"use client";

import { useRef, useState, useEffect } from "react";
import { MessageSquare, Send } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Message } from "@/db/schema";

interface ThreadPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rootMessage: Message | null;
  replies: Message[];
  userId: string;
  onReply: (content: string) => void;
}

function ThreadMessageBubble({
  msg,
  isOwn,
}: {
  msg: Message;
  isOwn: boolean;
}) {
  const initial = msg.userId.charAt(0).toUpperCase();

  return (
    <div className="flex gap-2.5 px-3 py-2">
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[0.65rem] font-semibold ${
          isOwn
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {initial}
      </div>

      <div className="min-w-0 flex-1">
        {/* Sender label + timestamp */}
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-xs font-medium text-foreground truncate">
            {isOwn ? "You" : msg.userId.slice(0, 8)}
          </span>
          <span className="text-[0.6rem] text-muted-foreground shrink-0">
            {new Date(msg.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* Content */}
        <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
          {msg.deletedAt ? (
            <span className="italic opacity-40">This message was deleted</span>
          ) : (
            msg.content
          )}
        </p>
      </div>
    </div>
  );
}

export default function ThreadPanel({
  open,
  onOpenChange,
  rootMessage,
  replies,
  userId,
  onReply,
}: ThreadPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when replies change
  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [replies.length, open]);

  // Reset input when panel closes
  useEffect(() => {
    if (!open) setInput("");
  }, [open]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;
    onReply(trimmed);
    setInput("");
  }

  const totalCount = 1 + replies.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[24rem] p-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
          <MessageSquare className="w-4 h-4 text-primary" />
          <SheetTitle className="text-sm font-semibold text-foreground">
            Thread
          </SheetTitle>
          <span className="text-xs text-muted-foreground ml-1">
            {totalCount} {totalCount === 1 ? "message" : "messages"}
          </span>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-col divide-y divide-border/40">
            {/* Root message */}
            {rootMessage && (
              <div className="bg-muted/30">
                <ThreadMessageBubble
                  msg={rootMessage}
                  isOwn={rootMessage.userId === userId}
                />
              </div>
            )}

            {/* Replies */}
            {replies.length > 0 && (
              <div className="px-3 py-1.5">
                <span className="text-[0.6rem] font-medium text-muted-foreground uppercase tracking-wider">
                  {replies.length} {replies.length === 1 ? "reply" : "replies"}
                </span>
              </div>
            )}

            {replies.map((reply) => (
              <ThreadMessageBubble
                key={reply.id}
                msg={reply}
                isOwn={reply.userId === userId}
              />
            ))}

            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Reply input */}
        <div className="border-t border-border p-3 shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Reply in thread..."
              className="flex-1 text-sm bg-muted/50 border border-border rounded-lg px-3 py-2 outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-primary/40 transition-shadow"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
