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
  onBack: () => void;
  onToggleSearch: () => void;
  onToggleMembers: () => void;
}

function getAvatarColor(name: string) {
  const colors = [
    "bg-cyan-500/20 text-cyan-400",
    "bg-blue-500/20 text-blue-400",
    "bg-violet-500/20 text-violet-400",
    "bg-emerald-500/20 text-emerald-400",
    "bg-rose-500/20 text-rose-400",
    "bg-teal-500/20 text-teal-400",
    "bg-indigo-500/20 text-indigo-400",
  ];
  return colors[name.charCodeAt(0) % colors.length];
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
  onBack,
  onToggleSearch,
  onToggleMembers,
}: ChatHeaderProps) {
  const avatarColor = getAvatarColor(chat.displayName);
  const isOnline = onlineUsers.length > 0;

  return (
    <div className="h-15 px-3 md:px-4 border-b border-border flex items-center gap-2.5 shrink-0 bg-background/95 backdrop-blur-md">
      {/* Back button — visible on all screen sizes */}
      <button
        onClick={onBack}
        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
        aria-label="Back to chats"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>

      <Avatar className="w-8 h-8 shrink-0">
        <AvatarFallback className={`text-xs font-semibold ${avatarColor}`}>
          {chat.displayName[0].toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate leading-tight">{chat.displayName}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {!isPending && (
            <div className={`w-1.5 h-1.5 rounded-full transition-colors ${
              isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"
            }`} />
          )}
          <span className="text-[0.6rem] text-muted-foreground">
            {isPending
              ? "Pending invitation"
              : isOnline
                ? `${onlineUsers.length} online`
                : chat.role}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {/* Members toggle */}
        {!isPending && (
          <button
            onClick={onToggleMembers}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            aria-label="View members"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
          </button>
        )}
        {/* Search toggle */}
        <button
          onClick={onToggleSearch}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
          aria-label="Search messages"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
          </svg>
        </button>
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
