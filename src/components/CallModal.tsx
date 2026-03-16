"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { ScreenShareOptions } from "@/lib/webrtc";

interface CallModalProps {
  chatName: string;
  callStatus: VoiceCallStatus;
  isMuted: boolean;
  isSpeaking: boolean;
  isRemoteSpeaking: boolean;
  caller: CallerInfo | null;
  error: string | null;
  isIncomingCall: boolean;
  currentUserEmail: string | null;
  remoteParticipantName: string | null;
  onAnswerCall: () => Promise<void>;
  onRejectCall: () => void;
  onHangUp: () => void;
  onToggleMute: () => void;
  shareStatus: ScreenShareStatus;
  onStartSharing: (options: ScreenShareOptions) => Promise<void>;
  onStopSharing: () => void;
}

function getInitials(name: string) {
  return name?.[0]?.toUpperCase() ?? "?";
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ControlButton({
  onClick,
  active,
  danger,
  title,
  children,
  size = "md",
}: {
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  title: string;
  children: React.ReactNode;
  size?: "md" | "lg";
}) {
  const base = "flex items-center justify-center rounded-full transition-all duration-150 select-none";
  const dim = size === "lg" ? "w-16 h-16" : "w-12 h-12";
  let bg = "bg-white/10 hover:bg-white/20 text-white";
  if (active) bg = "bg-white/25 hover:bg-white/30 text-white";
  if (danger) bg = "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30";

  return (
    <button onClick={onClick} title={title} className={`${base} ${dim} ${bg}`}>
      {children}
    </button>
  );
}

function ParticipantAvatar({
  initial,
  label,
  speaking,
  muted,
  color,
}: {
  initial: string;
  label: string;
  speaking: boolean;
  muted?: boolean;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        {/* Speaking/muted glow ring */}
        <div
          className={`absolute inset-0 rounded-full transition-all duration-300 ${
            muted ? "scale-110 opacity-100" : speaking ? "scale-110 opacity-100" : "scale-100 opacity-0"
          }`}
          style={{
            background: muted
              ? `radial-gradient(circle, transparent 55%, rgba(239,68,68,0.35) 70%, transparent 85%)`
              : `radial-gradient(circle, transparent 55%, rgba(74,222,128,0.35) 70%, transparent 85%)`,
          }}
        />
        <div
          className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center text-2xl md:text-3xl font-semibold text-white shadow-xl transition-all duration-300 ${
            muted
              ? "ring-2 ring-red-500/70 ring-offset-2 ring-offset-transparent"
              : speaking
              ? "ring-2 ring-emerald-400/70 ring-offset-2 ring-offset-transparent"
              : "ring-2 ring-white/10"
          }`}
          style={{ background: color }}
        >
          {initial}
        </div>
        {/* Muted badge */}
        {muted && (
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shadow-md">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 19L5 5M12 18.75a6 6 0 006-6v-1.5M6 13.5v-1.5a6 6 0 016-6m0 0V4.5a3 3 0 116 0v1.5" />
            </svg>
          </div>
        )}
      </div>
      <span className="text-white/60 text-xs font-medium max-w-25 truncate">{label}</span>
    </div>
  );
}

// ── Floating mini-pip ────────────────────────────────────────────────────────

interface FloatingPipProps {
  chatName: string;
  callStatus: VoiceCallStatus;
  isMuted: boolean;
  isSpeaking: boolean;
  isRemoteSpeaking: boolean;
  remoteName: string;
  callDuration: number;
  onExpand: () => void;
  onToggleMute: () => void;
  onHangUp: () => void;
}

function FloatingPip({
  chatName,
  callStatus,
  isMuted,
  isSpeaking,
  isRemoteSpeaking,
  remoteName,
  callDuration,
  onExpand,
  onToggleMute,
  onHangUp,
}: FloatingPipProps) {
  const pipRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    // Default: bottom-right corner with 20px margin
    if (typeof window === "undefined") return { x: 20, y: 20 };
    return { x: window.innerWidth - 220, y: window.innerHeight - 120 };
  });
  const [dragging, setDragging] = useState(false);
  const hasDragged = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    hasDragged.current = false;
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startLeft: pos.x,
      startTop: pos.y,
    };
    setDragging(true);
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged.current = true;
    const pip = pipRef.current;
    const w = pip?.offsetWidth ?? 200;
    const h = pip?.offsetHeight ?? 96;
    const newX = Math.max(8, Math.min(window.innerWidth - w - 8, dragState.current.startLeft + dx));
    const newY = Math.max(8, Math.min(window.innerHeight - h - 8, dragState.current.startTop + dy));
    setPos({ x: newX, y: newY });
  }, []);

  const onPointerUp = useCallback(() => {
    dragState.current = null;
    setDragging(false);
    if (!hasDragged.current) {
      // Tap on pip body (not button) → expand
    }
  }, []);

  const handlePipClick = useCallback(() => {
    if (!hasDragged.current) onExpand();
  }, [onExpand]);

  const isConnected = callStatus === "connected";

  // Determine speaking state for the active dot
  const activeSpeaking = isConnected && (isSpeaking || isRemoteSpeaking) && !isMuted;

  return (
    <div
      ref={pipRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={handlePipClick}
      className={`fixed z-50 select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
      style={{ left: pos.x, top: pos.y, touchAction: "none" }}
    >
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-2xl shadow-2xl border border-white/10"
        style={{
          background: "linear-gradient(135deg, #0d1117ee, #161b26ee)",
          backdropFilter: "blur(20px)",
          minWidth: 192,
        }}
      >
        {/* Avatar with speaking indicator */}
        <div className="relative shrink-0">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white transition-all duration-300 ${
              isMuted
                ? "ring-2 ring-red-500/80"
                : activeSpeaking
                ? "ring-2 ring-emerald-400/80"
                : "ring-1 ring-white/20"
            }`}
            style={{ background: "linear-gradient(135deg, #d97706, #b45309)" }}
          >
            {getInitials(remoteName)}
          </div>
          {/* Pulse when speaking */}
          {activeSpeaking && (
            <div className="absolute inset-0 rounded-full animate-ping opacity-25 ring-2 ring-emerald-400" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0" onClick={handlePipClick}>
          <p className="text-white text-xs font-semibold truncate leading-tight">{chatName}</p>
          <p className={`text-xs tabular-nums leading-tight mt-0.5 ${isConnected ? "text-emerald-400" : "text-amber-400"}`}>
            {isConnected ? formatDuration(callDuration) : callStatus === "calling" ? "Calling…" : "Ringing…"}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Mute */}
          <button
            onClick={onToggleMute}
            title={isMuted ? "Unmute" : "Mute"}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              isMuted ? "bg-red-500/80 hover:bg-red-500 text-white" : "bg-white/10 hover:bg-white/20 text-white"
            }`}
          >
            {isMuted ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 19L5 5M12 18.75a6 6 0 006-6v-1.5M6 13.5v-1.5a6 6 0 016-6m0 0V4.5a3 3 0 116 0v1.5" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>

          {/* Hang up */}
          <button
            onClick={onHangUp}
            title="Hang up"
            className="w-7 h-7 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 text-white transition-all shadow-md shadow-red-500/30"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 3.75L18 6m0 0l2.25 2.25M18 6l2.25-2.25M18 6l-2.25 2.25m1.5 13.5c-8.284 0-15-6.716-15-15V4.5A2.25 2.25 0 016.75 2.25h1.372c.516 0 .966.351 1.091.852l1.106 4.423c.11.44-.054.902-.417 1.173l-1.293.97a1.062 1.062 0 00-.38 1.21 12.035 12.035 0 007.143 7.143c.441.162.928-.004 1.21-.38l.97-1.293a1.125 1.125 0 011.173-.417l4.423 1.106c.5.125.852.575.852 1.091V19.5a2.25 2.25 0 01-2.25 2.25h-2.25z" />
            </svg>
          </button>

          {/* Expand */}
          <button
            onClick={(e) => { e.stopPropagation(); onExpand(); }}
            title="Expand"
            className="w-7 h-7 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main modal ───────────────────────────────────────────────────────────────

export default function CallModal({
  chatName,
  callStatus,
  isMuted,
  isSpeaking,
  isRemoteSpeaking,
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
  const [answering, setAnswering] = useState(false);
  const [minimized, setMinimized] = useState(false);

  // Reset minimized when call ends or new incoming call arrives
  useEffect(() => {
    if (callStatus === "idle" || callStatus === "ended" || isIncomingCall) {
      setMinimized(false);
    }
  }, [callStatus, isIncomingCall]);

  useEffect(() => {
    if (callStatus !== "connected") {
      setCallDuration(0);
      return;
    }
    const interval = setInterval(() => setCallDuration((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, [callStatus]);

  const handleScreenShare = useCallback(() => {
    if (shareStatus === "sharing") {
      onStopSharing();
    } else if (shareStatus === "idle") {
      onStartSharing({ resolution: "1080p", includeAudio: false });
    }
  }, [shareStatus, onStartSharing, onStopSharing]);

  const handleAnswer = useCallback(async () => {
    setAnswering(true);
    try { await onAnswerCall(); } finally { setAnswering(false); }
  }, [onAnswerCall]);

  if (callStatus === "idle") return null;

  const currentUserName = currentUserEmail?.split("@")[0] ?? "You";
  const remoteName = remoteParticipantName || caller?.name || "Unknown";

  const isConnected = callStatus === "connected";
  const isCalling = callStatus === "calling";
  const isRinging = callStatus === "ringing";
  const isEnded = callStatus === "ended";

  const statusText = isCalling
    ? "Calling\u2026"
    : isRinging
    ? `${caller?.name || "Someone"} is calling`
    : isConnected
    ? formatDuration(callDuration)
    : isEnded
    ? "Call ended"
    : "";

  // Minimized pip — only shown during active/calling/ringing (not incoming or ended)
  if (minimized && !isIncomingCall && !isEnded) {
    return (
      <FloatingPip
        chatName={chatName}
        callStatus={callStatus}
        isMuted={isMuted}
        isSpeaking={isSpeaking}
        isRemoteSpeaking={isRemoteSpeaking}
        remoteName={remoteName}
        callDuration={callDuration}
        onExpand={() => setMinimized(false)}
        onToggleMute={onToggleMute}
        onHangUp={onHangUp}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={{ background: "linear-gradient(160deg, #0d1117 0%, #161b26 40%, #0d1117 100%)" }}>
      {/* Subtle noise texture overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
          backgroundSize: "180px 180px",
        }}
      />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-5 pb-2">
        <div className="flex items-center gap-2.5">
          {/* Chat icon */}
          <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-xs font-semibold text-white/80">
            {getInitials(chatName)}
          </div>
          <span className="text-white/80 text-sm font-medium">{chatName}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Status pill */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            isConnected
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
              : isEnded
              ? "bg-white/8 text-white/50 border border-white/10"
              : "bg-amber-500/15 text-amber-400 border border-amber-500/20"
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${
              isConnected
                ? "bg-emerald-400"
                : isEnded
                ? "bg-white/30"
                : "bg-amber-400 animate-pulse"
            }`} />
            <span className="tabular-nums">{statusText}</span>
          </div>

          {/* Minimize button — only when not incoming / ended */}
          {!isIncomingCall && !isEnded && (
            <button
              onClick={() => setMinimized(true)}
              title="Minimize"
              className="w-7 h-7 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L3.75 3.75M3.75 3.75v4.5m0-4.5h4.5M15 9l5.25-5.25M20.25 3.75v4.5m0-4.5h-4.5M9 15l-5.25 5.25M3.75 20.25v-4.5m0 4.5h4.5M15 15l5.25 5.25M20.25 20.25v-4.5m0 4.5h-4.5" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="relative z-10 mx-5 mt-2 px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-500/20 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Center — participants */}
      <div className="relative z-10 flex-1 flex items-center justify-center">
        {isIncomingCall ? (
          // Incoming call — just one avatar with a pulse ring
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: "radial-gradient(circle, #34d399, transparent 70%)" }} />
              <div className="absolute -inset-3 rounded-full animate-pulse opacity-10" style={{ background: "radial-gradient(circle, #34d399, transparent 60%)" }} />
              <div
                className="w-24 h-24 md:w-28 md:h-28 rounded-full flex items-center justify-center text-3xl font-semibold text-white shadow-2xl ring-2 ring-white/15"
                style={{ background: "linear-gradient(135deg, #d97706, #b45309)" }}
              >
                {getInitials(remoteName)}
              </div>
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-lg">{remoteName}</p>
              <p className="text-white/50 text-sm mt-1">Incoming voice call</p>
            </div>
          </div>
        ) : (
          // Active/calling state — two avatars
          <div className="flex items-center gap-8 md:gap-16">
            <ParticipantAvatar
              initial={getInitials(currentUserName)}
              label="You"
              speaking={isConnected && isSpeaking && !isMuted}
              muted={isMuted}
              color="linear-gradient(135deg, #2563eb, #1d4ed8)"
            />

            {/* Connector */}
            {(isConnected || isCalling) && (
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className={`rounded-full transition-all ${
                        isConnected
                          ? "w-1.5 h-1.5 bg-emerald-400/60"
                          : "w-1 h-1 bg-white/20 animate-pulse"
                      }`}
                      style={{ animationDelay: `${i * 0.2}s` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {(isConnected || isCalling) && (
              <ParticipantAvatar
                initial={getInitials(remoteName)}
                label={remoteName}
                speaking={isConnected && isRemoteSpeaking}
                color="linear-gradient(135deg, #d97706, #b45309)"
              />
            )}
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 pb-10 pt-4">
        {isIncomingCall ? (
          // Incoming call — answer / reject
          <div className="flex items-center justify-center gap-12">
            <div className="flex flex-col items-center gap-2">
              <ControlButton onClick={onRejectCall} danger title="Decline">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 3.75L18 6m0 0l2.25 2.25M18 6l2.25-2.25M18 6l-2.25 2.25m1.5 13.5c-8.284 0-15-6.716-15-15V4.5A2.25 2.25 0 016.75 2.25h1.372c.516 0 .966.351 1.091.852l1.106 4.423c.11.44-.054.902-.417 1.173l-1.293.97a1.062 1.062 0 00-.38 1.21 12.035 12.035 0 007.143 7.143c.441.162.928-.004 1.21-.38l.97-1.293a1.125 1.125 0 011.173-.417l4.423 1.106c.5.125.852.575.852 1.091V19.5a2.25 2.25 0 01-2.25 2.25h-2.25z" />
                </svg>
              </ControlButton>
              <span className="text-white/40 text-xs">Decline</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleAnswer}
                disabled={answering}
                className="w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 transition-all duration-150 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60"
              >
                {answering ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.054-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97a1.125 1.125 0 00.417-1.173L5.963 3.102A1.125 1.125 0 004.872 2.25H3.75A2.25 2.25 0 001.5 4.5v2.25z" />
                  </svg>
                )}
              </button>
              <span className="text-white/40 text-xs">Answer</span>
            </div>
          </div>
        ) : isEnded ? (
          <div className="flex justify-center">
            <div className="px-5 py-2 rounded-full bg-white/8 border border-white/10 text-white/40 text-sm">
              Call ended
            </div>
          </div>
        ) : (
          // Active call controls
          <div className="flex items-end justify-center gap-3 px-6">
            {/* Mute */}
            <div className="flex flex-col items-center gap-2">
              <ControlButton onClick={onToggleMute} active={isMuted} title={isMuted ? "Unmute" : "Mute"}>
                {isMuted ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 19L5 5M12 18.75a6 6 0 006-6v-1.5M6 13.5v-1.5a6 6 0 016-6m0 0V4.5a3 3 0 116 0v1.5" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                )}
              </ControlButton>
              <span className="text-white/30 text-xs">{isMuted ? "Unmute" : "Mute"}</span>
            </div>

            {/* Screen share (connected only) */}
            {isConnected && (
              <div className="flex flex-col items-center gap-2">
                <ControlButton
                  onClick={handleScreenShare}
                  active={shareStatus === "sharing"}
                  title={shareStatus === "sharing" ? "Stop sharing" : "Share screen"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                  </svg>
                </ControlButton>
                <span className="text-white/30 text-xs">
                  {shareStatus === "sharing" ? "Stop" : "Share"}
                </span>
              </div>
            )}

            {/* Hang up */}
            <div className="flex flex-col items-center gap-2">
              <ControlButton onClick={onHangUp} danger size="lg" title="Hang up">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 3.75L18 6m0 0l2.25 2.25M18 6l2.25-2.25M18 6l-2.25 2.25m1.5 13.5c-8.284 0-15-6.716-15-15V4.5A2.25 2.25 0 016.75 2.25h1.372c.516 0 .966.351 1.091.852l1.106 4.423c.11.44-.054.902-.417 1.173l-1.293.97a1.062 1.062 0 00-.38 1.21 12.035 12.035 0 007.143 7.143c.441.162.928-.004 1.21-.38l.97-1.293a1.125 1.125 0 011.173-.417l4.423 1.106c.5.125.852.575.852 1.091V19.5a2.25 2.25 0 01-2.25 2.25h-2.25z" />
                </svg>
              </ControlButton>
              <span className="text-white/30 text-xs">End</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
