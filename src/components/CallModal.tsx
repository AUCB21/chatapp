"use client";

import { useEffect, useState, useCallback } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { ScreenShareOptions } from "@/lib/webrtc";

interface CallModalProps {
  chatName: string;
  callStatus: VoiceCallStatus;
  isMuted: boolean;
  caller: CallerInfo | null;
  error: string | null;
  isIncomingCall: boolean;
  // Participants shown as avatars — current user + caller/remote
  currentUserEmail: string | null;
  remoteParticipantName: string | null;
  // Voice actions
  onAnswerCall: () => Promise<void>;
  onRejectCall: () => void;
  onHangUp: () => void;
  onToggleMute: () => void;
  // Screen share
  shareStatus: ScreenShareStatus;
  onStartSharing: (options: ScreenShareOptions) => Promise<void>;
  onStopSharing: () => void;
}

export default function CallModal({
  chatName,
  callStatus,
  isMuted,
  caller,
  error,
  isIncomingCall,
  currentUserEmail,
  remoteParticipantName,
  onAnswerCall,
  onRejectCall,
  onHangUp,
  onToggleMute,
  shareStatus,
  onStartSharing,
  onStopSharing,
}: CallModalProps) {
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    if (callStatus !== "connected") {
      setCallDuration(0);
      return;
    }
    const interval = setInterval(() => setCallDuration((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, [callStatus]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleScreenShare = useCallback(() => {
    if (shareStatus === "sharing") {
      onStopSharing();
    } else if (shareStatus === "idle") {
      onStartSharing({ resolution: "1080p", includeAudio: false });
    }
  }, [shareStatus, onStartSharing, onStopSharing]);

  // Only show when call is active (not idle)
  if (callStatus === "idle") return null;

  const currentUserInitial = currentUserEmail
    ? currentUserEmail[0].toUpperCase()
    : "?";
  const remoteInitial = remoteParticipantName
    ? remoteParticipantName[0].toUpperCase()
    : caller?.name?.[0]?.toUpperCase() ?? "?";
  const remoteName = remoteParticipantName || caller?.name || "Unknown";

  const statusLabel =
    callStatus === "calling"
      ? "Calling..."
      : callStatus === "ringing"
        ? `${caller?.name || "Someone"} is calling...`
        : callStatus === "connected"
          ? formatDuration(callDuration)
          : callStatus === "ended"
            ? "Call ended"
            : "";

  const statusDotColor =
    callStatus === "connected"
      ? "bg-green-500"
      : callStatus === "calling" || callStatus === "ringing"
        ? "bg-yellow-500 animate-pulse"
        : "bg-red-500";

  return (
    <div className="fixed inset-0 z-40 bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="text-xs bg-muted text-muted-foreground">
              {chatName[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-white text-sm font-semibold">{chatName}</p>
          </div>
        </div>

        {/* Status badge */}
        <Badge
          variant="secondary"
          className="gap-2 bg-white/10 text-white border-white/10"
        >
          <div className={`w-2 h-2 rounded-full ${statusDotColor}`} />
          {statusLabel}
        </Badge>
      </div>

      {/* Error */}
      {error && (
        <div className="px-6">
          <Badge variant="destructive" className="text-xs">
            {error}
          </Badge>
        </div>
      )}

      {/* Center: Avatars */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-6">
          {/* Current user avatar */}
          <div className="flex flex-col items-center gap-3">
            <div
              className={`rounded-full p-1 ${
                callStatus === "connected" && !isMuted
                  ? "ring-2 ring-green-500"
                  : "ring-2 ring-white/20"
              }`}
            >
              <Avatar className="w-20 h-20 md:w-24 md:h-24">
                <AvatarFallback className="text-2xl md:text-3xl bg-linear-to-br from-blue-600 to-blue-800 text-white">
                  {currentUserInitial}
                </AvatarFallback>
              </Avatar>
            </div>
            <span className="text-white/70 text-xs font-medium">You</span>
          </div>

          {/* Remote participant avatar */}
          {(callStatus === "connected" ||
            callStatus === "calling" ||
            callStatus === "ringing") && (
            <div className="flex flex-col items-center gap-3">
              <div
                className={`rounded-full p-1 ${
                  callStatus === "connected"
                    ? "ring-2 ring-green-500"
                    : "ring-2 ring-white/20"
                }`}
              >
                <Avatar className="w-20 h-20 md:w-24 md:h-24">
                  <AvatarFallback className="text-2xl md:text-3xl bg-linear-to-br from-amber-600 to-orange-800 text-white">
                    {remoteInitial}
                  </AvatarFallback>
                </Avatar>
              </div>
              <span className="text-white/70 text-xs font-medium truncate max-w-25">
                {remoteName}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Incoming call actions */}
      {isIncomingCall && (
        <div className="flex items-center justify-center gap-6 pb-4">
          <button
            onClick={onRejectCall}
            className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-colors"
            title="Decline"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 3.75L18 6m0 0l2.25 2.25M18 6l2.25-2.25M18 6l-2.25 2.25m1.5 13.5c-8.284 0-15-6.716-15-15V4.5A2.25 2.25 0 016.75 2.25h1.372c.516 0 .966.351 1.091.852l1.106 4.423c.11.44-.054.902-.417 1.173l-1.293.97a1.062 1.062 0 00-.38 1.21 12.035 12.035 0 007.143 7.143c.441.162.928-.004 1.21-.38l.97-1.293a1.125 1.125 0 011.173-.417l4.423 1.106c.5.125.852.575.852 1.091V19.5a2.25 2.25 0 01-2.25 2.25h-2.25z"
              />
            </svg>
          </button>
          <button
            onClick={onAnswerCall}
            className="w-14 h-14 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center transition-colors"
            title="Answer"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.054-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97a1.125 1.125 0 00.417-1.173L5.963 3.102A1.125 1.125 0 004.872 2.25H3.75A2.25 2.25 0 001.5 4.5v2.25z"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Bottom controls bar */}
      {!isIncomingCall && callStatus !== "ended" && (
        <div className="flex items-center justify-center gap-3 pb-8 pt-4">
          {/* Primary controls group */}
          <div className="flex items-center gap-1 bg-white/10 rounded-2xl p-1.5">
            {/* Mic toggle */}
            <button
              onClick={onToggleMute}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                isMuted
                  ? "bg-red-500/80 text-white"
                  : "text-white hover:bg-white/10"
              }`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
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
                    d="M19 19L17.591 17.591L5.409 5.409L4 4M12 18.75C8.272 18.75 5.25 15.728 5.25 12V10.5M18.75 10.5V12C18.75 12.712 18.631 13.396 18.41 14.032M12 15.75C10.757 15.75 9.66 15.096 9.042 14.119M12 15.75V22.5M12 22.5H8.25M12 22.5H15.75M15.75 7.5V3C15.75 1.757 14.743 0.75 13.5 0.75H10.5C9.565 0.75 8.77 1.33 8.42 2.148"
                  />
                </svg>
              ) : (
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
                    d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                  />
                </svg>
              )}
            </button>
          </div>

          {/* Secondary controls group */}
          {callStatus === "connected" && (
            <div className="flex items-center gap-1 bg-white/10 rounded-2xl p-1.5">
              {/* Screen share */}
              <button
                onClick={handleScreenShare}
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                  shareStatus === "sharing"
                    ? "bg-blue-500/80 text-white"
                    : "text-white hover:bg-white/10"
                }`}
                title={
                  shareStatus === "sharing"
                    ? "Stop sharing"
                    : "Share screen"
                }
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
                    d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25"
                  />
                </svg>
              </button>
            </div>
          )}

          {/* Hang up */}
          <button
            onClick={onHangUp}
            className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-colors"
            title="Hang up"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 3.75L18 6m0 0l2.25 2.25M18 6l2.25-2.25M18 6l-2.25 2.25m1.5 13.5c-8.284 0-15-6.716-15-15V4.5A2.25 2.25 0 016.75 2.25h1.372c.516 0 .966.351 1.091.852l1.106 4.423c.11.44-.054.902-.417 1.173l-1.293.97a1.062 1.062 0 00-.38 1.21 12.035 12.035 0 007.143 7.143c.441.162.928-.004 1.21-.38l.97-1.293a1.125 1.125 0 011.173-.417l4.423 1.106c.5.125.852.575.852 1.091V19.5a2.25 2.25 0 01-2.25 2.25h-2.25z"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Ended state - just shows briefly */}
      {callStatus === "ended" && (
        <div className="flex items-center justify-center pb-8 pt-4">
          <Badge
            variant="secondary"
            className="bg-white/10 text-white border-white/10 text-sm py-2 px-4"
          >
            Call ended
          </Badge>
        </div>
      )}
    </div>
  );
}
