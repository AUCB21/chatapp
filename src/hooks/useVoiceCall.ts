"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useSessionStore } from "@/store/sessionStore";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  requestMicrophoneAccess,
  createPeerConnection,
  addStreamToPeer,
  stopMediaStream,
  toggleStreamMute,
  isWebRTCSupported,
} from "@/lib/webrtc";
import { startRingtone, stopRingtone } from "@/lib/sounds";
import { useProfileStore } from "@/store/profileStore";

interface UseVoiceCallReturn {
  callStatus: VoiceCallStatus;
  isMuted: boolean;
  isRemoteMuted: boolean;
  isSpeaking: boolean;
  isRemoteSpeaking: boolean;
  isIncomingCall: boolean;
  caller: CallerInfo | null;
  error: string | null;
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;
  remoteStream: MediaStream | null;
  startCall: () => Promise<void>;
  answerCall: () => Promise<void>;
  rejectCall: () => void;
  hangUp: () => void;
  toggleMute: () => void;
}

export function useVoiceCall(chatId: string | null): UseVoiceCallReturn {
  const userId = useSessionStore((s) => s.user?.id ?? null);
  const userEmail = useSessionStore((s) => s.user?.email ?? null);

  // Lock chatId for the duration of an active call so navigating between
  // chats doesn't re-initialize the hook and kill the connection.
  const lockedChatIdRef = useRef<string | null>(chatId);

  const [callStatus, setCallStatus] = useState<VoiceCallStatus>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRemoteSpeaking, setIsRemoteSpeaking] = useState(false);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [caller, setCaller] = useState<CallerInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Only update the locked chatId when the call is idle — prevents the
  // Realtime channel from being torn down if the user switches chats mid-call.
  if (callStatus === "idle") {
    lockedChatIdRef.current = chatId;
  }
  const effectiveChatId = lockedChatIdRef.current;

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callIdRef = useRef<string | null>(null);
  const isHostRef = useRef(false);
  const pendingAnswerRef = useRef(false);
  const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([]);
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const remoteAnalyserRef = useRef<AnalyserNode | null>(null);
  const speakingRafRef = useRef<number | null>(null);

  // Refs for values accessed inside signal handlers (avoids stale closures)
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const callStatusRef = useRef(callStatus);
  callStatusRef.current = callStatus;

  useEffect(() => {
    if (!isWebRTCSupported()) {
      setError("Voice calls are not supported in your browser.");
    }
  }, []);

  // remoteAudioRef is attached to a real DOM <audio> element rendered in CallModal
  // so the browser's autoplay policy is satisfied by the user gesture that started/answered the call.

  // --- Ringtone + browser notification on incoming call ---
  useEffect(() => {
    if (isIncomingCall) {
      startRingtone();
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification("Incoming Call", {
            body: caller?.name
              ? `${caller.name} is calling you`
              : "Someone is calling you",
            tag: "incoming-call",
          });
        } catch {
          // Notification blocked
        }
      }
    } else {
      stopRingtone();
    }
    return () => stopRingtone();
  }, [isIncomingCall, caller?.name]);

  const cleanupCall = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    stopMediaStream(localStreamRef.current);
    localStreamRef.current = null;
    stopMediaStream(remoteStreamRef.current);
    remoteStreamRef.current = null;

    if (endedTimerRef.current) {
      clearTimeout(endedTimerRef.current);
      endedTimerRef.current = null;
    }

    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }

    if (speakingRafRef.current) {
      cancelAnimationFrame(speakingRafRef.current);
      speakingRafRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    localAnalyserRef.current = null;
    remoteAnalyserRef.current = null;

    setCallStatus("idle");
    setIsIncomingCall(false);
    setCaller(null);
    setIsMuted(false);
    setIsRemoteMuted(false);
    setIsSpeaking(false);
    setIsRemoteSpeaking(false);
    setRemoteStream(null);
    setError(null);
    callIdRef.current = null;
    isHostRef.current = false;
    pendingAnswerRef.current = false;
    iceCandidateQueue.current = [];
  }, []);

  const syncCallSession = useCallback(async () => {
    if (!effectiveChatId || !userId) return;

    // Skip only if already in the ended/cleanup state
    const current = callStatusRef.current;
    if (current === "ended") return;

    try {
      const res = await fetch(`/api/chat/${effectiveChatId}/call`);
      if (!res.ok) return;

      // Re-check after await
      const postFetchStatus = callStatusRef.current;
      if (postFetchStatus === "ended") return;

      const json = await res.json();
      const activeCall = json?.data?.activeCall ?? null;
      const callerName = (json?.data?.activeCall?.callerName as string | null) ?? null;
      const participants = (json?.data?.participants ?? []) as Array<{
        userId: string;
        state: "joined" | "left";
      }>;

      if (!activeCall) {
        // If we just initiated a call, the row may not be committed yet — don't reset.
        if (callStatusRef.current === "calling") return;

        // Session was deleted (host ended call from another client) — treat as call-end
        callIdRef.current = null;
        isHostRef.current = false;
        if (callStatusRef.current !== "idle") {
          // Use showEnded path if we were connected, otherwise just reset
          if (callStatusRef.current === "connected") {
            cleanupCall();
            setCallStatus("ended");
            endedTimerRef.current = setTimeout(() => {
              endedTimerRef.current = null;
              setCallStatus("idle");
            }, 2000);
          } else {
            setCallStatus("idle");
            setIsIncomingCall(false);
            setCaller(null);
          }
        }
        return;
      }

      callIdRef.current = activeCall.id;
      isHostRef.current = activeCall.createdByUserId === userId;

      const meJoined = participants.some(
        (p) => p.userId === userId && p.state === "joined"
      );

      if (activeCall.status === "ringing") {
        // Don't overwrite "calling" when WebRTC signaling is already in progress
        if (activeCall.createdByUserId === userId) {
          if (!peerConnectionRef.current) {
            setCallStatus("calling");
            setIsIncomingCall(false);
            setCaller(null);
          }
        } else if (!meJoined) {
          setIsIncomingCall(true);
          // Only set caller if not already set (signal handler sets the real name from fromName)
          setCaller((prev) => prev ?? { id: activeCall.createdByUserId, name: callerName ?? "" });
          setCallStatus("ringing");
        }
      }

      if (activeCall.status === "active" && meJoined) {
        setIsIncomingCall(false);
        setCallStatus("connected");
      }
    } catch {
      // Non-fatal sync
    }
  }, [effectiveChatId, userId, cleanupCall]);

  const ensureActiveCallId = useCallback(async () => {
    if (!effectiveChatId) return null;
    if (callIdRef.current) return callIdRef.current;

    const res = await fetch(`/api/chat/${effectiveChatId}/call`);
    const json = await res.json().catch(() => null);

    if (!res.ok) throw new Error(json?.error || "Failed to find active call");

    const activeCallId = json?.data?.activeCall?.id as string | undefined;
    if (!activeCallId) throw new Error("Call is no longer available");

    callIdRef.current = activeCallId;
    return activeCallId;
  }, [effectiveChatId]);

  const cleanupChannel = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
  }, []);

  const sendSignal = useCallback(async (signal: VoiceSignalType) => {
    if (!channelRef.current) return;
    try {
      await channelRef.current.send({
        type: "broadcast",
        event: "voice-signal",
        payload: signal,
      });
    } catch (err) {
      console.error("[Voice] Failed to send signal:", err);
    }
  }, []);

  const startAudioLevelPolling = useCallback((localStream: MediaStream | null, remoteStream: MediaStream | null) => {
    if (speakingRafRef.current) {
      cancelAnimationFrame(speakingRafRef.current);
      speakingRafRef.current = null;
    }
    if (!localStream && !remoteStream) return;

    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;

    const makeAnalyser = (stream: MediaStream): AnalyserNode => {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.5;
      ctx.createMediaStreamSource(stream).connect(analyser);
      return analyser;
    };

    if (localStream) localAnalyserRef.current = makeAnalyser(localStream);
    if (remoteStream) remoteAnalyserRef.current = makeAnalyser(remoteStream);

    const data = new Uint8Array(256);
    const RMS_THRESHOLD = 12;

    const poll = () => {
      speakingRafRef.current = requestAnimationFrame(poll);
      const getRms = (analyser: AnalyserNode | null): number => {
        if (!analyser) return 0;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        return Math.sqrt(sum / data.length) * 100;
      };
      setIsSpeaking(getRms(localAnalyserRef.current) > RMS_THRESHOLD);
      setIsRemoteSpeaking(getRms(remoteAnalyserRef.current) > RMS_THRESHOLD);
    };
    poll();
  }, []);

  const setupPeerConnectionListeners = useCallback(
    (pc: RTCPeerConnection) => {
      pc.onicecandidate = (event) => {
        if (event.candidate && userIdRef.current) {
          sendSignal({
            type: "ice-candidate",
            from: userIdRef.current,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        remoteStreamRef.current = stream;
        // Set srcObject directly if the audio element is already mounted,
        // and also store in state so CallModal's useEffect can attach it on mount.
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
        }
        setRemoteStream(stream);
        startAudioLevelPolling(localStreamRef.current, stream);
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          // Clear any pending disconnect timer — connection recovered
          if (disconnectTimerRef.current) {
            clearTimeout(disconnectTimerRef.current);
            disconnectTimerRef.current = null;
          }
          startAudioLevelPolling(localStreamRef.current, remoteStreamRef.current);
          setCallStatus("connected");
        } else if (pc.connectionState === "failed") {
          setError("Connection lost");
          cleanupCall();
        } else if (pc.connectionState === "disconnected") {
          // "disconnected" is transient — wait before cleaning up
          if (!disconnectTimerRef.current) {
            disconnectTimerRef.current = setTimeout(() => {
              disconnectTimerRef.current = null;
              if (peerConnectionRef.current?.connectionState === "disconnected") {
                setError("Connection lost");
                cleanupCall();
              }
            }, 5000);
          }
        }
      };
    },
    [sendSignal, cleanupCall, startAudioLevelPolling]
  );

  const flushIceCandidates = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !pc.remoteDescription) return;

    const queued = iceCandidateQueue.current.splice(0);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("[Voice] Failed to add queued ICE candidate:", err);
      }
    }
  }, []);

  // --- Signal handlers ---

  const handleIncomingOffer = useCallback(
    async (payload: Extract<VoiceSignalType, { type: "call-offer" }>) => {
      const uid = userIdRef.current;
      if (!uid) return;

      const status = callStatusRef.current;

      // Glare: both users calling simultaneously
      if (status === "calling" && peerConnectionRef.current) {
        if (uid < payload.from) {
          peerConnectionRef.current.close();
          stopMediaStream(localStreamRef.current);
          localStreamRef.current = null;
        } else {
          return;
        }
      } else if (status !== "idle") {
        return;
      }

      setCaller({ id: payload.from, name: payload.fromName });
      setIsIncomingCall(true);
      setCallStatus("ringing");

      if (payload.callId) callIdRef.current = payload.callId;

      if (!peerConnectionRef.current) {
        const pc = createPeerConnection();
        setupPeerConnectionListeners(pc);
        peerConnectionRef.current = pc;
      }

      try {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(payload.offer)
        );
        await flushIceCandidates();

        if (pendingAnswerRef.current) {
          pendingAnswerRef.current = false;
          try {
            const activeCallId = await ensureActiveCallId();
            const joinRes = await fetch(
              `/api/chat/${effectiveChatId}/call/${activeCallId}/participants`,
              { method: "POST" }
            );
            if (!joinRes.ok) {
              const failure = await joinRes.json().catch(() => null);
              throw new Error(failure?.error || "Failed to join call");
            }

            const stream = await requestMicrophoneAccess();
            localStreamRef.current = stream;
            addStreamToPeer(peerConnectionRef.current, stream);

            const answer = await peerConnectionRef.current.createAnswer();
            await peerConnectionRef.current.setLocalDescription(answer);

            await sendSignal({
              type: "call-answer",
              from: uid,
              answer: peerConnectionRef.current.localDescription!.toJSON(),
            });
            setCallStatus("connected");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to answer call");
            cleanupCall();
          }
        }
      } catch {
        setError("Failed to process incoming call");
        cleanupCall();
      }
    },
    [effectiveChatId, sendSignal, setupPeerConnectionListeners, cleanupCall, ensureActiveCallId, flushIceCandidates]
  );

  const handleAnswer = useCallback(
    async (payload: Extract<VoiceSignalType, { type: "call-answer" }>) => {
      if (!peerConnectionRef.current) return;
      if (peerConnectionRef.current.signalingState !== "have-local-offer") return;

      try {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(payload.answer)
        );
        await flushIceCandidates();
        setCallStatus("connected");
      } catch {
        setError("Failed to complete call setup");
        cleanupCall();
      }
    },
    [cleanupCall, flushIceCandidates]
  );

  const handleIceCandidate = useCallback(
    async (payload: Extract<VoiceSignalType, { type: "ice-candidate" }>) => {
      if (!peerConnectionRef.current) return;

      if (!peerConnectionRef.current.remoteDescription) {
        iceCandidateQueue.current.push(payload.candidate);
        return;
      }

      try {
        await peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(payload.candidate)
        );
      } catch (err) {
        console.error("[Voice] Failed to add ICE candidate:", err);
      }
    },
    []
  );

  const showEnded = useCallback(
    (msg?: string) => {
      // End/leave the call in the DB before local cleanup clears refs
      if (effectiveChatId && callIdRef.current) {
        const endpoint = isHostRef.current
          ? `/api/chat/${effectiveChatId}/call`
          : `/api/chat/${effectiveChatId}/call/${callIdRef.current}/participants`;
        fetch(endpoint, { method: "DELETE" }).catch(() => {});
      }
      cleanupCall();
      if (msg) setError(msg);
      setCallStatus("ended");
      endedTimerRef.current = setTimeout(() => {
        endedTimerRef.current = null;
        setCallStatus("idle");
        setError(null);
      }, msg ? 3000 : 2000);
    },
    [cleanupCall, effectiveChatId]
  );

  // Stable ref for signal dispatch (avoids stale closure in channel listener)
  const handleSignalRef = useRef<(payload: VoiceSignalType) => Promise<void>>();
  handleSignalRef.current = async (payload: VoiceSignalType) => {
    switch (payload.type) {
      case "call-offer":
        return handleIncomingOffer(payload);
      case "call-answer":
        return handleAnswer(payload);
      case "ice-candidate":
        return handleIceCandidate(payload);
      case "call-end":
        return showEnded();
      case "call-reject":
        return showEnded("Call was declined");
      case "call-mute":
        setIsRemoteMuted(payload.isMuted);
        return;
    }
  };

  // --- Realtime channel ---
  useEffect(() => {
    if (!effectiveChatId || !userId) return;

    const channel = supabase.channel(`voice:${effectiveChatId}`);

    const debouncedSync = () => {
      if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
      syncDebounceRef.current = setTimeout(() => {
        syncDebounceRef.current = null;
        syncCallSession();
      }, 300);
    };

    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "call_sessions", filter: `chat_id=eq.${effectiveChatId}` }, debouncedSync)
      .on("postgres_changes", { event: "*", schema: "public", table: "call_participants" }, debouncedSync)
      .on("broadcast", { event: "voice-signal" }, async ({ payload }: { payload: VoiceSignalType }) => {
        if (payload.from === userIdRef.current) return;
        try {
          await handleSignalRef.current?.(payload);
        } catch (err) {
          console.error("[Voice] Error handling signal:", err);
        }
      })
      .subscribe();

    channelRef.current = channel;
    syncCallSession();

    return () => {
      if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
      cleanupCall();
      cleanupChannel();
    };
  }, [effectiveChatId, userId, cleanupCall, cleanupChannel, syncCallSession]);

  // --- Actions ---

  const startCall = useCallback(async () => {
    if (!userId || !effectiveChatId) return;
    setError(null);
    setCallStatus("calling");
    isHostRef.current = true;

    try {
      const [createRes, stream] = await Promise.all([
        fetch(`/api/chat/${effectiveChatId}/call`, { method: "POST" }),
        requestMicrophoneAccess(),
      ]);

      if (!createRes.ok) {
        stopMediaStream(stream);
        const failure = await createRes.json().catch(() => null);
        throw new Error(failure?.error || "Failed to start call session");
      }

      const created = await createRes.json();
      const activeCallId = created?.data?.activeCall?.id as string | undefined;
      if (!activeCallId) {
        stopMediaStream(stream);
        throw new Error("Call session id missing");
      }

      callIdRef.current = activeCallId;
      localStreamRef.current = stream;

      const pc = createPeerConnection();
      setupPeerConnectionListeners(pc);
      peerConnectionRef.current = pc;
      addStreamToPeer(pc, stream);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const profileName = useProfileStore.getState().profile?.displayName;
      await sendSignal({
        type: "call-offer",
        from: userId,
        fromName: profileName || userEmail?.split("@")[0] || "Unknown",
        callId: activeCallId,
        offer: pc.localDescription!.toJSON(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start call");
      cleanupCall();
    }
  }, [userId, userEmail, effectiveChatId, sendSignal, setupPeerConnectionListeners, cleanupCall]);

  const answerCall = useCallback(async () => {
    if (!userId || !effectiveChatId) return;
    setError(null);
    setIsIncomingCall(false);

    if (!peerConnectionRef.current || !peerConnectionRef.current.remoteDescription) {
      pendingAnswerRef.current = true;
      return;
    }

    try {
      const activeCallId = await ensureActiveCallId();

      const [stream, joinRes] = await Promise.all([
        requestMicrophoneAccess(),
        fetch(`/api/chat/${effectiveChatId}/call/${activeCallId}/participants`, { method: "POST" }),
      ]);

      if (!joinRes.ok) {
        stopMediaStream(stream);
        const failure = await joinRes.json().catch(() => null);
        throw new Error(failure?.error || "Failed to join call");
      }

      localStreamRef.current = stream;
      addStreamToPeer(peerConnectionRef.current, stream);

      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      await sendSignal({
        type: "call-answer",
        from: userId,
        answer: peerConnectionRef.current.localDescription!.toJSON(),
      });
      setCallStatus("connected");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to answer call");
      cleanupCall();
    }
  }, [userId, effectiveChatId, sendSignal, cleanupCall, ensureActiveCallId]);

  const rejectCall = useCallback(() => {
    if (!userId) return;
    if (effectiveChatId && callIdRef.current) {
      fetch(`/api/chat/${effectiveChatId}/call/${callIdRef.current}/participants`, { method: "DELETE" }).catch(() => {});
    }
    sendSignal({ type: "call-reject", from: userId });
    cleanupCall();
  }, [userId, effectiveChatId, sendSignal, cleanupCall]);

  const hangUp = useCallback(() => {
    if (!userId) return;
    sendSignal({ type: "call-end", from: userId });
    showEnded();
  }, [userId, sendSignal, showEnded]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      toggleStreamMute(localStreamRef.current, next);
      // Broadcast mute state to remote peer immediately
      if (userIdRef.current) {
        sendSignal({ type: "call-mute", from: userIdRef.current, isMuted: next });
      }
      if (effectiveChatId && callIdRef.current) {
        fetch(`/api/chat/${effectiveChatId}/call/${callIdRef.current}/participants`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isMuted: next }),
        }).catch(() => {});
      }
      return next;
    });
  }, [effectiveChatId, sendSignal]);

  return { callStatus, isMuted, isRemoteMuted, isSpeaking, isRemoteSpeaking, isIncomingCall, caller, error, remoteAudioRef, remoteStream, startCall, answerCall, rejectCall, hangUp, toggleMute };
}