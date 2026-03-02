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
  startCall: (targetUserId: string, targetUserName: string) => Promise<void>;
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
  const targetUserIdRef = useRef<string | null>(null);

  // Refs for values accessed inside signal handlers (avoids stale closures)
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const callStatusRef = useRef(callStatus);
  callStatusRef.current = callStatus;

  // Check WebRTC support
  useEffect(() => {
    if (!isWebRTCSupported()) {
      setError(
        "Voice calls are not supported in your browser. Please use Chrome, Firefox, Safari, or Edge."
      );
    }
  }, []);

  // Initialize remote audio element
  useEffect(() => {
    if (typeof window !== "undefined" && !remoteAudioRef.current) {
      remoteAudioRef.current = new Audio();
      remoteAudioRef.current.autoplay = true;
    }
  }, []);

  // --- Call-only cleanup (keeps the signaling channel alive) ---
  const cleanupCall = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    stopMediaStream(localStreamRef.current);
    localStreamRef.current = null;

    stopMediaStream(remoteStreamRef.current);
    remoteStreamRef.current = null;

    setCallStatus("idle");
    setIsIncomingCall(false);
    setCaller(null);
    setIsMuted(false);
    targetUserIdRef.current = null;
  }, []);

  // --- Channel-only cleanup (used only when unmounting or chatId changes) ---
  const cleanupChannel = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
  }, []);

  // --- Send signal via Realtime ---
  const sendSignal = useCallback(async (signal: VoiceSignalType) => {
    if (!channelRef.current) {
      console.warn("[Voice] Cannot send signal: channel not ready");
      return;
    }

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

  // --- Peer connection event listeners ---
  const setupPeerConnectionListeners = useCallback(
    (pc: RTCPeerConnection) => {
      pc.onicecandidate = (event) => {
        if (event.candidate && userIdRef.current && targetUserIdRef.current) {
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
        console.log("[Voice] Connection state:", pc.connectionState);
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

  // --- Signal handlers (use refs to avoid stale closures) ---

  const handleIncomingOffer = useCallback(
    async (
      payload: Extract<VoiceSignalType, { type: "call-offer" }>
    ) => {
      const uid = userIdRef.current;
      if (!uid) return;

      const status = callStatusRef.current;

      // Handle glare: both users calling simultaneously
      if (status === "calling" && peerConnectionRef.current) {
        if (uid < payload.from) {
          console.log("[Voice] Glare detected: backing off and accepting incoming call");
          peerConnectionRef.current.close();
          stopMediaStream(localStreamRef.current);
          localStreamRef.current = null;
        } else {
          console.log("[Voice] Glare detected: continuing our call attempt");
          return;
        }
      } else if (status !== "idle") {
        return;
      }

      setCaller({ id: payload.from, name: payload.fromName });
      setIsIncomingCall(true);
      setCallStatus("ringing");
      targetUserIdRef.current = payload.from;

      if (!peerConnectionRef.current) {
        const pc = createPeerConnection();
        setupPeerConnectionListeners(pc);
        peerConnectionRef.current = pc;
      }

      try {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(payload.offer)
        );
      } catch (err) {
        console.error("[Voice] Failed to set remote description:", err);
        setError("Failed to process incoming call");
        cleanupCall();
      }
    },
    [setupPeerConnectionListeners, cleanupCall]
  );

  const handleAnswer = useCallback(
    async (
      payload: Extract<VoiceSignalType, { type: "call-answer" }>
    ) => {
      if (!peerConnectionRef.current) return;
      await peerConnectionRef.current.setRemoteDescription(
        new RTCSessionDescription(payload.answer)
      );
      setCallStatus("connected");
    },
    []
  );

  const handleIceCandidate = useCallback(
    async (
      payload: Extract<VoiceSignalType, { type: "ice-candidate" }>
    ) => {
      if (!peerConnectionRef.current) return;
      await peerConnectionRef.current.addIceCandidate(
        new RTCIceCandidate(payload.candidate)
      );
    },
    []
  );

  const handleCallEnd = useCallback(() => {
    cleanupCall();
    setCallStatus("ended");
    setTimeout(() => setCallStatus("idle"), 2000);
  }, [cleanupCall]);

  const handleCallRejected = useCallback(() => {
    cleanupCall();
    setError("Call was declined");
    setCallStatus("ended");
    setTimeout(() => {
      setCallStatus("idle");
      setError(null);
    }, 3000);
  }, [cleanupCall]);

  // --- Stable ref for the signal dispatch (avoids stale closure in channel listener) ---
  const handleSignalRef = useRef<(payload: VoiceSignalType) => Promise<void>>();
  handleSignalRef.current = async (payload: VoiceSignalType) => {
    switch (payload.type) {
      case "call-offer":
        await handleIncomingOffer(payload);
        break;
      case "call-answer":
        await handleAnswer(payload);
        break;
      case "ice-candidate":
        await handleIceCandidate(payload);
        break;
      case "call-end":
        handleCallEnd();
        break;
      case "call-reject":
        handleCallRejected();
        break;
    }
  };

  // --- Setup Realtime channel for signaling ---
  // Depends only on chatId and userId (strings), NOT object references.
  // Channel stays alive across auth token refreshes and call state changes.
  useEffect(() => {
    if (!chatId || !userId) return;

    console.log("[Voice] Setting up voice channel for chat:", chatId);
    const channel = supabase.channel(`voice:${chatId}`);

    channel
      .on(
        "broadcast",
        { event: "voice-signal" },
        async ({ payload }: { payload: VoiceSignalType }) => {
          // Ignore our own signals (use ref for latest userId)
          if (payload.from === userIdRef.current) return;

          console.log(
            "[Voice] Received signal:",
            payload.type,
            "from:",
            payload.from
          );
          try {
            await handleSignalRef.current?.(payload);
          } catch (err) {
            console.error("[Voice] Error handling voice signal:", err);
          }
        }
      )
      .subscribe((status, err) => {
        console.log(`[Voice] Channel voice:${chatId} →`, status, err ?? "");
        if (err) {
          console.error("[Voice] Subscription error:", err);
        }
      });

    channelRef.current = channel;

    return () => {
      console.log("[Voice] Cleaning up channel for chat:", chatId);
      cleanupCall();
      cleanupChannel();
    };
  }, [chatId, userId, cleanupCall, cleanupChannel]);

  // --- Start a call ---
  const startCall = useCallback(
    async (targetUserId: string, _targetUserName: string) => {
      if (!userId || !chatId) return;

      setError(null);
      setCallStatus("calling");
      targetUserIdRef.current = targetUserId;

      try {
        const stream = await requestMicrophoneAccess();
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
          offer: pc.localDescription!.toJSON(),
        });
      } catch (err) {
        console.error("[Voice] Failed to start call:", err);
        setError(err instanceof Error ? err.message : "Failed to start call");
        cleanupCall();
      }
    },
    [userId, userEmail, chatId, sendSignal, setupPeerConnectionListeners, cleanupCall]
  );

  // --- Answer an incoming call ---
  const answerCall = useCallback(async () => {
    if (!userId || !peerConnectionRef.current) return;

    setError(null);
    setIsIncomingCall(false);

    try {
      const stream = await requestMicrophoneAccess();
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
      console.error("[Voice] Failed to answer call:", err);
      setError(err instanceof Error ? err.message : "Failed to answer call");
      cleanupCall();
    }
  }, [userId, sendSignal, cleanupCall]);

  // --- Reject an incoming call ---
  const rejectCall = useCallback(() => {
    if (!userId) return;
    sendSignal({ type: "call-reject", from: userId });
    cleanupCall();
  }, [userId, sendSignal, cleanupCall]);

  // --- Hang up the call ---
  const hangUp = useCallback(() => {
    if (!userId) return;
    sendSignal({ type: "call-end", from: userId });
    cleanupCall();
  }, [userId, sendSignal, cleanupCall]);

  // --- Toggle mute ---
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const newMuted = !prev;
      toggleStreamMute(localStreamRef.current, newMuted);
      return newMuted;
    });
  }, []);

  return {
    callStatus,
    isMuted,
    isIncomingCall,
    caller,
    error,
    startCall,
    answerCall,
    rejectCall,
    hangUp,
    toggleMute,
  };
}
