"use client";

interface EmptyChatStateProps {
  onOpenSidebar: () => void;
}

export default function EmptyChatState({ onOpenSidebar }: EmptyChatStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-background p-12 text-center relative overflow-hidden">
      {/* Subtle decorative grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025] dark:opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Center content */}
      <div className="relative flex flex-col items-center">
        <div className="relative mb-8">
          <div className="w-16 h-16 rounded-2xl bg-muted/80 border border-border flex items-center justify-center">
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
          {/* Small accent dot */}
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary/40 border-2 border-background" />
        </div>

        <h2 className="text-base font-semibold tracking-tight mb-2">
          No conversation selected
        </h2>
        <p className="text-xs text-muted-foreground max-w-[200px] leading-relaxed">
          Pick a chat from the sidebar or start a new one.
        </p>

        <button
          onClick={onOpenSidebar}
          className="mt-6 md:hidden inline-flex items-center justify-center h-9 px-5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
        >
          Open chats
        </button>
      </div>
    </div>
  );
}
