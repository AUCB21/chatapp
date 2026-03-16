"use client";

import { memo, useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  isAdmin: boolean;
  onBack: () => void;
  onToggleSearch: () => void;
  onToggleMembers: () => void;
  onRenameChat?: (newName: string) => void;
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

function ChatHeader({
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
  isAdmin,
  onStartSharing,
  onStopSharing,
  onBack,
  onToggleSearch,
  onToggleMembers,
  onRenameChat,
}: ChatHeaderProps) {
  const avatarColor = getAvatarColor(chat.displayName);
  const isOnline = onlineUsers.length > 0;
  const canRename = isAdmin && chat.type === "group" && onRenameChat;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"general" | "members">("general");
  const [editValue, setEditValue] = useState(chat.displayName);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settingsOpen) {
      setEditValue(chat.displayName);
      setSettingsTab("general");
    }
  }, [settingsOpen, chat.displayName]);

  function handleRenameSave() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== chat.displayName && onRenameChat) {
      onRenameChat(trimmed);
    }
    setSettingsOpen(false);
  }

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
        <button
          onClick={() => canRename && setSettingsOpen(true)}
          className={`flex items-center gap-1.5 group/name text-left w-full ${canRename ? "cursor-pointer" : "cursor-default"}`}
          title={canRename ? "Group settings" : undefined}
        >
          <p className="text-sm font-semibold truncate leading-tight">{chat.displayName}</p>
          {canRename && (
            <svg className="w-3 h-3 text-muted-foreground opacity-0 group-hover/name:opacity-100 transition-opacity shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          )}
        </button>
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

      {/* Group Settings Dialog */}
      {canRename && (
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Group Settings</DialogTitle>
            </DialogHeader>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border pb-2 mb-3">
              {(["general", "members"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSettingsTab(tab)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                    settingsTab === tab
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {settingsTab === "general" && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Group name
                  </label>
                  <input
                    ref={editRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameSave();
                      if (e.key === "Escape") setSettingsOpen(false);
                    }}
                    maxLength={100}
                    autoFocus
                    className="w-full h-9 px-3 rounded-lg bg-muted/50 border border-border text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setSettingsOpen(false)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRenameSave}
                    disabled={!editValue.trim() || editValue.trim() === chat.displayName}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {settingsTab === "members" && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Open the members panel (
                <svg className="w-3.5 h-3.5 inline-block" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                </svg>
                ) for member management.
              </p>
            )}
          </DialogContent>
        </Dialog>
      )}

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

export default memo(ChatHeader);
