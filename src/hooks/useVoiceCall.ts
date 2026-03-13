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

interface UseVoiceCallReturn {
  callStatus: VoiceCallStatus;
  isMuted: boolean;
  isIncomingCall: boolean;
  caller: CallerInfo | null;
  error: string | null;
  startCall: () => Promise<void>;
  answerCall: () => Promise<void>;
  rejectCall: () => void;
  hangUp: () => void;
  toggleMute: () => void;
}

export function useVoiceCall(chatId: string | null): UseVoiceCallReturn {
  const userId = useSessionStore((s) => s.user?.id ?? null);
  const userEmail = useSessionStore((s) => s.user?.email ?? null);

  const [callStatus, setCallStatus] = useState<VoiceCallStatus>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [caller, setCaller] = useState<CallerInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (typeof window !== "undefined" && !remoteAudioRef.current) {
      remoteAudioRef.current = new Audio();
      remoteAudioRef.current.autoplay = true;
    }
  }, []);

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

    setCallStatus("idle");
    setIsIncomingCall(false);
    setCaller(null);
    setIsMuted(false);
    setError(null);
    callIdRef.current = null;
    isHostRef.current = false;
    pendingAnswerRef.current = false;
    iceCandidateQueue.current = [];
  }, []);

  const syncCallSession = useCallback(async () => {
    if (!chatId || !userId) return;

    // Never let DB sync downgrade a WebRTC-established connection
    const current = callStatusRef.current;
    if (current === "connected" || current === "ended") return;

    try {
      const res = await fetch(`/api/chat/${chatId}/call`);
      if (!res.ok) return;

      // Re-check after await — status may have changed during the fetch
      const postFetchStatus = callStatusRef.current;
      if (postFetchStatus === "connected" || postFetchStatus === "ended") return;

      const json = await res.json();
      const activeCall = json?.data?.activeCall ?? null;
      const participants = (json?.data?.participants ?? []) as Array<{
        userId: string;
        state: "joined" | "left";
      }>;

      if (!activeCall) {
        callIdRef.current = null;
        isHostRef.current = false;
        if (callStatusRef.current !== "idle") {
          setCallStatus("idle");
          setIsIncomingCall(false);
          setCaller(null);
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
          setCaller({ id: activeCall.createdByUserId, name: "Incoming call" });
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
  }, [chatId, userId]);

  const ensureActiveCallId = useCallback(async () => {
    if (!chatId) return null;
    if (callIdRef.current) return callIdRef.current;

    const res = await fetch(`/api/chat/${chatId}/call`);
    const json = await res.json().catch(() => null);

    if (!res.ok) throw new Error(json?.error || "Failed to find active call");

    const activeCallId = json?.data?.activeCall?.id as string | undefined;
    if (!activeCallId) throw new Error("Call is no longer available");

    callIdRef.current = activeCallId;
    return activeCallId;
  }, [chatId]);

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
        const [remoteStream] = event.streams;
        remoteStreamRef.current = remoteStream;
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setCallStatus("connected");
        } else if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected"
        ) {
          setError("Connection lost");
          cleanupCall();
        }
      };
    },
    [sendSignal, cleanupCall]
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
              `/api/chat/${chatId}/call/${activeCallId}/participants`,
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
    [chatId, sendSignal, setupPeerConnectionListeners, cleanupCall, ensureActiveCallId, flushIceCandidates]
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
      if (chatId && callIdRef.current) {
        const endpoint = isHostRef.current
          ? `/api/chat/${chatId}/call`
          : `/api/chat/${chatId}/call/${callIdRef.current}/participants`;
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
    [cleanupCall, chatId]
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
    }
  };

  // --- Realtime channel ---
  useEffect(() => {
    if (!chatId || !userId) return;

    const channel = supabase.channel(`voice:${chatId}`);

    const debouncedSync = () => {
      if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
      syncDebounceRef.current = setTimeout(() => {
        syncDebounceRef.current = null;
        syncCallSession();
      }, 300);
    };

    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "call_sessions", filter: `chat_id=eq.${chatId}` }, debouncedSync)
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
  }, [chatId, userId, cleanupCall, cleanupChannel, syncCallSession]);

  // --- Actions ---

  const startCall = useCallback(async () => {
    if (!userId || !chatId) return;
    setError(null);
    setCallStatus("calling");
    isHostRef.current = true;

    try {
      const [createRes, stream] = await Promise.all([
        fetch(`/api/chat/${chatId}/call`, { method: "POST" }),
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

      await sendSignal({
        type: "call-offer",
        from: userId,
        fromName: userEmail?.split("@")[0] || "Unknown",
        callId: activeCallId,
        offer: pc.localDescription!.toJSON(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start call");
      cleanupCall();
    }
  }, [userId, userEmail, chatId, sendSignal, setupPeerConnectionListeners, cleanupCall]);

  const answerCall = useCallback(async () => {
    if (!userId || !chatId) return;
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
        fetch(`/api/chat/${chatId}/call/${activeCallId}/participants`, { method: "POST" }),
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
  }, [userId, chatId, sendSignal, cleanupCall, ensureActiveCallId]);

  const rejectCall = useCallback(() => {
    if (!userId) return;
    if (chatId && callIdRef.current) {
      fetch(`/api/chat/${chatId}/call/${callIdRef.current}/participants`, { method: "DELETE" }).catch(() => {});
    }
    sendSignal({ type: "call-reject", from: userId });
    cleanupCall();
  }, [userId, chatId, sendSignal, cleanupCall]);

  const hangUp = useCallback(() => {
    if (!userId) return;
    if (chatId && callIdRef.current) {
      const endpoint = isHostRef.current
        ? `/api/chat/${chatId}/call`
        : `/api/chat/${chatId}/call/${callIdRef.current}/participants`;
      fetch(endpoint, { method: "DELETE" }).catch(() => {});
    }
    sendSignal({ type: "call-end", from: userId });
    // Show "ended" briefly so user gets visual feedback
    const hadCall = callStatusRef.current !== "idle";
    cleanupCall();
    if (hadCall) {
      setCallStatus("ended");
      endedTimerRef.current = setTimeout(() => {
        endedTimerRef.current = null;
        setCallStatus("idle");
      }, 1500);
    }
  }, [userId, chatId, sendSignal, cleanupCall]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      toggleStreamMute(localStreamRef.current, next);
      if (chatId && callIdRef.current) {
        fetch(`/api/chat/${chatId}/call/${callIdRef.current}/participants`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isMuted: next }),
        }).catch(() => {});
      }
      return next;
    });
  }, [chatId]);

  return { callStatus, isMuted, isIncomingCall, caller, error, startCall, answerCall, rejectCall, hangUp, toggleMute };
}