"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { ChatWithRole } from "@/store/chatStore";

interface PendingPromptProps {
  chat: ChatWithRole;
  joiningChatId: string | null;
  joinError: string | null;
  onJoin: (chatId: string) => void;
  onDecline: (chatId: string) => void;
}

export default function PendingPrompt({
  chat,
  joiningChatId,
  joinError,
  onJoin,
  onDecline,
}: PendingPromptProps) {
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="text-center max-w-xs">
        <Avatar className="w-16 h-16 mx-auto mb-5">
          <AvatarFallback className="bg-muted text-muted-foreground text-2xl">
            {chat.displayName[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <p className="text-sm font-semibold mb-1">{chat.displayName}</p>
        <p className="text-xs text-muted-foreground mb-7">
          You&apos;ve been invited to join this chat. Accept to start reading
          and sending messages.
        </p>

        {joinError && (
          <p className="text-xs text-destructive mb-4">{joinError}</p>
        )}

        <div className="flex gap-3 justify-center">
          <Button
            onClick={() => onJoin(chat.id)}
            disabled={!!joiningChatId}
            size="lg"
            className="px-7 rounded-full"
          >
            {joiningChatId === chat.id ? "Joining…" : "Accept"}
          </Button>
          <Button
            onClick={() => onDecline(chat.id)}
            disabled={!!joiningChatId}
            variant="secondary"
            size="lg"
            className="px-7 rounded-full"
          >
            Decline
          </Button>
        </div>
      </div>
    </div>
  );
}
