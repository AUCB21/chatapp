"use client";

import { Button } from "@/components/ui/button";

interface EmptyChatStateProps {
  onOpenSidebar: () => void;
}

export default function EmptyChatState({ onOpenSidebar }: EmptyChatStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-muted/20 p-12 text-center">
      <div className="w-20 h-20 rounded-[2rem] bg-background border shadow-sm flex items-center justify-center mb-8 -rotate-6">
          <svg
            className="w-8 h-8 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
            />
          </svg>
      </div>
      <h2 className="text-2xl font-semibold uppercase tracking-tighter">
        Select a chat
      </h2>
      <p className="max-w-xs text-[0.625rem] font-medium text-muted-foreground uppercase tracking-widest mt-4 leading-relaxed">
        Choose a conversation from the left panel to begin.
      </p>
      <Button
        onClick={onOpenSidebar}
        variant="outline"
        className="mt-6 md:hidden rounded-full"
      >
        Open chats
      </Button>
    </div>
  );
}
