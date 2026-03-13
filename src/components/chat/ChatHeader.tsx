"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import VoiceCallControls from "@/components/VoiceCallControls";
import ScreenShareControls from "@/components/ScreenShareControls";
import type { ChatWithRole } from "@/store/chatStore";
import type { PresenceUser } from "@/hooks/usePresence";

interface ChatHeaderProps {
  chat: ChatWithRole;
  isPending: boolean;
  onlineUsers: PresenceUser[];
  callStatus: VoiceCallStatus;
  isMuted: boolean;
  isIncomingCall: boolean;
  caller: CallerInfo | null;
  callError: string | null;
  canWrite: boolean;
  onStartCall: () => Promise<void>;
  onAnswerCall: () => Promise<void>;
  onRejectCall: () => void;
  onHangUp: () => void;
  onToggleMute: () => void;
  shareStatus: ScreenShareStatus;
  isIncomingShare: boolean;
  presenter: PresenterInfo | null;
  shareError: string | null;
  onStartSharing: (options: import("@/lib/webrtc").ScreenShareOptions) => Promise<void>;
  onStopSharing: () => void;
  onOpenSidebar: () => void;
}

export default function ChatHeader({
  chat,
  isPending,
  onlineUsers,
  callStatus,
  isMuted,
  isIncomingCall,
  caller,
  callError,
  canWrite,
  onStartCall,
  onAnswerCall,
  onRejectCall,
  onHangUp,
  onToggleMute,
  shareStatus,
  isIncomingShare,
  presenter,
  shareError,
  onStartSharing,
  onStopSharing,
  onOpenSidebar,
}: ChatHeaderProps) {
  return (
    <div className="h-16 px-3 md:px-6 border-b flex items-center gap-3 md:gap-4 shrink-0 bg-background/90 backdrop-blur-md">
      <button
        onClick={onOpenSidebar}
        className="md:hidden shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
        aria-label="Open sidebar"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 19.5L8.25 12l7.5-7.5"
          />
        </svg>
      </button>

      <Avatar className="w-9 h-9 md:w-10 md:h-10 shrink-0">
        <AvatarFallback
          className={isPending ? "bg-muted text-muted-foreground" : ""}
        >
          {chat.name[0].toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold uppercase tracking-tight leading-tight truncate">
          {chat.name}
        </p>
        <p className="text-[0.625rem] text-emerald-500 font-medium uppercase tracking-widest mt-0.5">
          {isPending
            ? "Pending invitation"
            : onlineUsers.length > 0
              ? "Active now"
              : chat.role}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <VoiceCallControls
          chatId={chat.id}
          canCall={!isPending && canWrite}
          callStatus={callStatus}
          isMuted={isMuted}
          isIncomingCall={isIncomingCall}
          caller={caller}
          error={callError}
          onStartCall={onStartCall}
          onAnswerCall={onAnswerCall}
          onRejectCall={onRejectCall}
          onHangUp={onHangUp}
          onToggleMute={onToggleMute}
        />
        <ScreenShareControls
          chatId={chat.id}
          canShare={!isPending && canWrite}
          isInCall={callStatus === "connected"}
          shareStatus={shareStatus}
          isIncomingShare={isIncomingShare}
          presenter={presenter}
          error={shareError}
          onStartSharing={onStartSharing}
          onStopSharing={onStopSharing}
        />
      </div>
    </div>
  );
}
