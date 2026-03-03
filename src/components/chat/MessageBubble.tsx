"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Message } from "@/db/schema";
import type { ReactionGroup } from "@/store/chatStore";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

interface MessageBubbleProps {
  msg: Message;
  isOwn: boolean;
  isOptimistic: boolean;
  isSameUser: boolean;
  parentMsg: Message | null;
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
}

export default function MessageBubble({
  msg,
  isOwn,
  isOptimistic,
  isSameUser,
  parentMsg,
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
}: MessageBubbleProps) {
  const isEditing = editContent !== null;
  const isDeleted = !!msg.deletedAt;
  const isEdited = !!msg.editedAt && !isDeleted;

  return (
    <div
      className={`flex ${isOwn ? "justify-end" : "justify-start"} ${
        isSameUser ? "mt-0.5" : "mt-4"
      } group relative`}
      onContextMenu={onContextMenu}
    >
      <div className="max-w-[85%] md:max-w-[65%] relative">
        {/* Reply preview */}
        {parentMsg && (
          <div
            className={`text-[0.6875rem] px-3 py-1 mb-0.5 rounded-t-lg border-l-2 border-primary/40 bg-muted/50 text-muted-foreground ${
              isOwn ? "ml-auto" : ""
            }`}
          >
            ↩ {parentMsg.content.slice(0, 60)}
            {parentMsg.content.length > 60 ? "…" : ""}
          </div>
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
            className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
              isOwn
                ? `bg-primary text-primary-foreground rounded-br-sm ${
                    isOptimistic ? "opacity-60" : ""
                  }`
                : "bg-muted rounded-bl-sm"
            } ${isDeleted ? "opacity-50 italic" : ""}`}
          >
            <p className="whitespace-pre-wrap wrap-break-word">{msg.content}</p>
            <div className="flex items-center gap-1.5 mt-1 justify-end">
              {isEdited && (
                <span className="text-[0.625rem] opacity-50">edited</span>
              )}
              <span className="text-[0.6875rem] opacity-70">
                {new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {isOwn && !isOptimistic && !isDeleted && (
                <span className="text-[0.6875rem]">
                  {msg.status === "read" ? (
                    <span className="text-blue-400">✓✓</span>
                  ) : msg.status === "delivered" ? (
                    <span className="opacity-70">✓✓</span>
                  ) : (
                    <span className="opacity-50">✓</span>
                  )}
                </span>
              )}
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
