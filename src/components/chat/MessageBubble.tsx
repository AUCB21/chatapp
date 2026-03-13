"use client";

import { Fragment, useMemo, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Message } from "@/db/schema";
import type { ReactionGroup } from "@/store/chatStore";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];
const FENCED_CODE_REGEX = /```([\w+-]*)\n?([\s\S]*?)```/g;
const INLINE_CODE_REGEX = /`([^`]+)`/g;
const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const RAW_URL_REGEX = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]\}])/g;

type MessageSegment =
  | { type: "text"; value: string }
  | { type: "code"; value: string; language?: string };

function splitMarkdownMessage(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(FENCED_CODE_REGEX)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, index) });
    }

    segments.push({
      type: "code",
      language: match[1] || undefined,
      value: match[2].replace(/\n$/, ""),
    });

    lastIndex = index + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }

  return segments;
}

function renderLink(href: string, label: string, key: string, className: string) {
  return (
    <a
      key={key}
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
    >
      {label}
    </a>
  );
}

function renderLinks(text: string, keyPrefix: string, linkClassName: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(MARKDOWN_LINK_REGEX)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      const plainText = text.slice(lastIndex, index);
      nodes.push(...renderRawUrls(plainText, `${keyPrefix}-plain-${index}`, linkClassName));
    }

    nodes.push(
      renderLink(
        match[2],
        match[1],
        `${keyPrefix}-md-link-${index}`,
        linkClassName
      )
    );
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(...renderRawUrls(text.slice(lastIndex), `${keyPrefix}-tail`, linkClassName));
  }

  return nodes;
}

function renderRawUrls(text: string, keyPrefix: string, linkClassName: string): ReactNode[] {
  return text.split(RAW_URL_REGEX).map((part, index) => {
    if (!part) return null;

    if (part.match(RAW_URL_REGEX)) {
      return renderLink(part, part, `${keyPrefix}-raw-link-${index}`, linkClassName);
    }

    return <Fragment key={`${keyPrefix}-text-${index}`}>{part}</Fragment>;
  });
}

function renderMarkdownText(text: string, keyPrefix: string, isOwn: boolean): ReactNode[] {
  const linkClassName = isOwn
    ? "underline underline-offset-2 break-all text-background/90 hover:text-background"
    : "underline underline-offset-2 break-all text-foreground hover:text-primary";

  return text.split(INLINE_CODE_REGEX).map((part, index) => {
    const key = `${keyPrefix}-inline-${index}`;

    if (index % 2 === 1) {
      return (
        <code
          key={key}
          className={`rounded px-1.5 py-0.5 font-mono text-[0.8125rem] ${
            isOwn ? "bg-background/15 text-background" : "bg-background text-foreground"
          }`}
        >
          {part}
        </code>
      );
    }

    return <Fragment key={key}>{renderLinks(part, key, linkClassName)}</Fragment>;
  });
}

function renderMarkdownMessage(content: string, isOwn: boolean) {
  return splitMarkdownMessage(content).map((segment, index) => {
    if (segment.type === "code") {
      return (
        <div key={`code-${index}`} className="my-2 overflow-hidden rounded-xl border border-border/60">
          {segment.language && (
            <div className="border-b border-border/60 bg-background/70 px-3 py-1.5 font-mono text-[0.625rem] uppercase tracking-widest text-muted-foreground">
              {segment.language}
            </div>
          )}
          <pre className={`overflow-x-auto px-3 py-2.5 text-[0.8125rem] ${
            isOwn ? "bg-background/10 text-background" : "bg-background/80 text-foreground"
          }`}>
            <code className="font-mono whitespace-pre">{segment.value}</code>
          </pre>
        </div>
      );
    }

    return (
      <span key={`text-${index}`} className="whitespace-pre-wrap wrap-break-word">
        {renderMarkdownText(segment.value, `segment-${index}`, isOwn)}
      </span>
    );
  });
}

interface MessageBubbleProps {
  msg: Message;
  isOwn: boolean;
  isOptimistic: boolean;
  isSameUser: boolean;
  parentMsg: Message | null;
  isHighlighted?: boolean;
  msgReactions?: ReactionGroup;
  /** Non-null when THIS message is being edited; holds current edit text */
  editContent: string | null;
  /** True when any message in the list is in edit mode */
  isAnyEditing: boolean;
  isPickerOpen: boolean;
  userId: string;
  canWrite: boolean;
  onContextMenu: (e: React.MouseEvent) => void;
  onEditContent: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onToggleReaction: (emoji: string) => void;
  onSetPickerOpen: (open: boolean) => void;
  onReply: () => void;
  onJumpToMessage: (messageId: string) => void;
}

export default function MessageBubble({
  msg,
  isOwn,
  isOptimistic,
  isSameUser,
  parentMsg,
  isHighlighted = false,
  msgReactions,
  editContent,
  isAnyEditing,
  isPickerOpen,
  userId,
  canWrite,
  onContextMenu,
  onEditContent,
  onSaveEdit,
  onCancelEdit,
  onToggleReaction,
  onSetPickerOpen,
  onReply,
  onJumpToMessage,
}: MessageBubbleProps) {
  const isEditing = editContent !== null;
  const isDeleted = !!msg.deletedAt;
  const isEdited = !!msg.editedAt && !isDeleted;
  const renderedContent = useMemo(
    () => renderMarkdownMessage(msg.content, isOwn),
    [msg.content, isOwn]
  );

  function handleDoubleClick() {
    if (!canWrite || isDeleted || isEditing) return;
    onReply();
  }

  return (
    <div
      className={`w-full flex ${isOwn ? "justify-end" : "justify-start"} ${
        isSameUser ? "mt-0.5" : "mt-5"
      } group relative rounded-xl px-2 py-1 transition-colors duration-300 ease-out ${
        isHighlighted ? "bg-primary/10" : "bg-transparent"
      }`}
      onContextMenu={onContextMenu}
      onDoubleClick={handleDoubleClick}
    >
      <div className="max-w-[85%] md:max-w-[70%] relative">
        {/* Reply preview */}
        {parentMsg && (
          <button
            type="button"
            onClick={() => onJumpToMessage(parentMsg.id)}
            className={`text-[0.6875rem] px-3 py-1 mb-0.5 rounded-t-lg border-l-2 border-primary/40 bg-muted/50 text-muted-foreground ${
              isOwn ? "ml-auto" : ""
            } hover:bg-muted transition-colors`}
            title="Jump to original message"
          >
            ↩ {parentMsg.content.slice(0, 60)}
            {parentMsg.content.length > 60 ? "…" : ""}
          </button>
        )}

        {/* Edit mode */}
        {isEditing ? (
          <div className="flex gap-2 items-center">
            <Input
              value={editContent}
              onChange={(e) => onEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveEdit();
                if (e.key === "Escape") onCancelEdit();
              }}
              className="text-sm"
              autoFocus
            />
            <Button size="sm" onClick={onSaveEdit}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancelEdit}>
              Cancel
            </Button>
          </div>
        ) : (
          <div
            className={`group/message relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm transition-all ${
              isOwn
                ? `bg-foreground text-background rounded-br-sm ${
                    isOptimistic ? "opacity-60" : ""
                  }`
                : "bg-muted border border-border rounded-bl-sm"
            } ${isDeleted ? "opacity-50 italic" : ""}`}
          >
            <div className="space-y-1">{renderedContent}</div>
            <div className="flex items-center gap-1.5 mt-1 justify-end">
              {isEdited && (
                <span className="text-[0.625rem] opacity-50">edited</span>
              )}
              {isOwn && !isOptimistic && !isDeleted && (
                <span className="text-[0.6875rem]">
                  {msg.status === "read" ? (
                    <span className="text-primary">✓✓</span>
                  ) : msg.status === "delivered" ? (
                    <span className="opacity-70">✓✓</span>
                  ) : (
                    <span className="opacity-50">✓</span>
                  )}
                </span>
              )}
            </div>
            <div
              className={`absolute top-1/2 -translate-y-1/2 text-[0.5625rem] font-medium text-muted-foreground opacity-0 group-hover/message:opacity-100 transition-opacity whitespace-nowrap ${
                isOwn ? "-left-14" : "-right-14"
              }`}
            >
              {new Date(msg.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        )}

        {/* Reactions */}
        {msgReactions && Object.keys(msgReactions).length > 0 && (
          <div
            className={`flex flex-wrap gap-1 mt-1 ${
              isOwn ? "justify-end" : "justify-start"
            }`}
          >
            {Object.entries(msgReactions).map(([emoji, data]) => (
              <button
                key={emoji}
                onClick={() => onToggleReaction(emoji)}
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  data.users.includes(userId)
                    ? "bg-primary/10 border-primary/30"
                    : "bg-muted/50 border-transparent hover:border-muted-foreground/20"
                }`}
              >
                <span>{emoji}</span>
                <span className="text-muted-foreground">{data.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Reaction trigger + picker */}
        {!isDeleted && !isAnyEditing && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSetPickerOpen(!isPickerOpen);
              }}
              className={`absolute top-1/2 -translate-y-1/2 ${
                isOwn ? "-left-8" : "-right-8"
              } opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center text-sm`}
              title="React"
            >
              😊
            </button>

            {isPickerOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className={`absolute -top-12 ${
                  isOwn ? "right-0" : "left-0"
                } z-10 flex items-center gap-1 px-2 py-1.5 rounded-full bg-popover border shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onToggleReaction(emoji);
                      onSetPickerOpen(false);
                    }}
                    className="text-lg w-8 h-8 rounded-full hover:bg-muted transition-colors flex items-center justify-center"
                  >
                    {emoji}
                  </button>
                ))}
                {canWrite && (
                  <>
                    <div className="w-px h-6 bg-border mx-0.5" />
                    <button
                      onClick={() => {
                        onReply();
                        onSetPickerOpen(false);
                      }}
                      className="text-xs px-2 h-8 rounded-full hover:bg-muted transition-colors text-muted-foreground flex items-center gap-1"
                    >
                      <span>↩</span>
                      <span className="hidden sm:inline">Reply</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
