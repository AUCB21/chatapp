"use client";

import { Button } from "@/components/ui/button";

interface EmptyChatStateProps {
  onOpenSidebar: () => void;
}

export default function EmptyChatState({ onOpenSidebar }: EmptyChatStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-7 h-7 text-muted-foreground"
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
        <p className="text-sm font-medium text-muted-foreground">
          Select a chat to start messaging
        </p>
        <Button
          onClick={onOpenSidebar}
          variant="outline"
          className="mt-4 md:hidden rounded-full"
        >
          Open chats
        </Button>
      </div>
    </div>
  );
}
