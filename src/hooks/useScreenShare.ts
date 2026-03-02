"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useSessionStore } from "@/store/sessionStore";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  requestScreenShare,
  createPeerConnection,
  addStreamToPeer,
  stopScreenShare,
  isScreenShareSupported,
  type ScreenShareOptions,
} from "@/lib/webrtc";

interface UseScreenShareReturn {
  shareStatus: ScreenShareStatus;
  isIncomingShare: boolean;
  presenter: PresenterInfo | null;
  error: string | null;
  startSharing: (options: ScreenShareOptions) => Promise<void>;
  stopSharing: () => void;
  acceptShare: () => void;
  rejectShare: () => void;
}

export function useScreenShare(chatId: string | null): UseScreenShareReturn {
  const userId = useSessionStore((s) => s.user?.id ?? null);
  const userEmail = useSessionStore((s) => s.user?.email ?? null);

  const [shareStatus, setShareStatus] = useState<ScreenShareStatus>("idle");
  const [isIncomingShare, setIsIncomingShare] = useState(false);
  const [presenter, setPresenter] = useState<PresenterInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Refs for values accessed inside signal handlers
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const shareStatusRef = useRef(shareStatus);
  shareStatusRef.current = shareStatus;

  // Check screen share support
  useEffect(() => {
    if (!isScreenShareSupported()) {
      setError(
        "Screen sharing is not supported in your browser. Please use Chrome, Firefox, Safari, or Edge."
      );
    }
  }, []);

  // Initialize remote video element
  useEffect(() => {
    if (typeof window !== "undefined" && !remoteVideoRef.current) {
      remoteVideoRef.current = document.createElement("video");
      remoteVideoRef.current.autoplay = true;
      remoteVideoRef.current.playsInline = true;
      remoteVideoRef.current.style.display = "none";
      document.body.appendChild(remoteVideoRef.current);
    }

    return () => {
      if (remoteVideoRef.current && document.body.contains(remoteVideoRef.current)) {
        document.body.removeChild(remoteVideoRef.current);
      }
    };
  }, []);

  // --- Cleanup ---
  const cleanupShare = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    stopScreenShare(localStreamRef.current);
    localStreamRef.current = null;

    stopScreenShare(remoteStreamRef.current);
    remoteStreamRef.current = null;

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setShareStatus("idle");
    setIsIncomingShare(false);
    setPresenter(null);
  }, []);

  const cleanupChannel = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
  }, []);

  // --- Send signal via Realtime ---
  const sendSignal = useCallback(async (signal: ScreenShareSignalType) => {
    if (!channelRef.current) {
      console.warn("[ScreenShare] Cannot send signal: channel not ready");
      return;
    }

    try {
      await channelRef.current.send({
        type: "broadcast",
        event: "screen-signal",
        payload: signal,
      });
    } catch (err) {
      console.error("[ScreenShare] Failed to send signal:", err);
    }
  }, []);

  // --- Peer connection event listeners ---
  const setupPeerConnectionListeners = useCallback(
    (pc: RTCPeerConnection, isPresenter: boolean) => {
      pc.onicecandidate = (event) => {
        if (event.candidate && userIdRef.current) {
          sendSignal({
            type: "screen-ice-candidate",
            from: userIdRef.current,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        remoteStreamRef.current = remoteStream;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
        if (!isPresenter) {
          setShareStatus("viewing");
        }
      };

      pc.onconnectionstatechange = () => {
        console.log("[ScreenShare] Connection state:", pc.connectionState);
        if (pc.connectionState === "connected") {
          console.log("[ScreenShare] Connection established");
        } else if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected"
        ) {
          setError("Connection lost");
          cleanupShare();
        }
      };
    },
    [sendSignal, cleanupShare]
  );

  // --- Signal handlers ---

  const handleIncomingOffer = useCallback(
    async (payload: Extract<ScreenShareSignalType, { type: "screen-offer" }>) => {
      const uid = userIdRef.current;
      if (!uid) return;

      const status = shareStatusRef.current;

      if (status !== "idle") {
        console.log("[ScreenShare] Already in a share session, ignoring offer");
        return;
      }

      setPresenter({ id: payload.from, name: payload.fromName });
      setIsIncomingShare(true);
      setShareStatus("viewing");

      if (!peerConnectionRef.current) {
        const pc = createPeerConnection();
        setupPeerConnectionListeners(pc, false);
        peerConnectionRef.current = pc;
      }

      try {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(payload.offer)
        );

        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);

        sendSignal({
          type: "screen-answer",
          from: uid,
          answer,
        });
      } catch (err) {
        console.error("[ScreenShare] Failed to handle offer:", err);
        setError("Failed to process screen share");
        cleanupShare();
      }
    },
    [setupPeerConnectionListeners, sendSignal, cleanupShare]
  );

  const handleAnswer = useCallback(
    async (payload: Extract<ScreenShareSignalType, { type: "screen-answer" }>) => {
      if (!peerConnectionRef.current) return;
      await peerConnectionRef.current.setRemoteDescription(
        new RTCSessionDescription(payload.answer)
      );
      setShareStatus("sharing");
    },
    []
  );

  const handleIceCandidate = useCallback(
    async (payload: Extract<ScreenShareSignalType, { type: "screen-ice-candidate" }>) => {
      if (!peerConnectionRef.current) return;
      await peerConnectionRef.current.addIceCandidate(
        new RTCIceCandidate(payload.candidate)
      );
    },
    []
  );

  const handleShareEnd = useCallback(() => {
    cleanupShare();
    setShareStatus("ended");
    setTimeout(() => setShareStatus("idle"), 2000);
  }, [cleanupShare]);

  const handleShareRejected = useCallback(() => {
    cleanupShare();
    setError("Screen share was declined");
    setShareStatus("ended");
    setTimeout(() => {
      setShareStatus("idle");
      setError(null);
    }, 3000);
  }, [cleanupShare]);

  // --- Stable ref for signal dispatch ---
  const handleSignalRef = useRef<(payload: ScreenShareSignalType) => Promise<void>>();
  handleSignalRef.current = async (payload: ScreenShareSignalType) => {
    switch (payload.type) {
      case "screen-offer":
        await handleIncomingOffer(payload);
        break;
      case "screen-answer":
        await handleAnswer(payload);
        break;
      case "screen-ice-candidate":
        await handleIceCandidate(payload);
        break;
      case "screen-end":
        handleShareEnd();
        break;
      case "screen-reject":
        handleShareRejected();
        break;
    }
  };

  // --- Setup Realtime channel for signaling ---
  useEffect(() => {
    if (!chatId || !userId) return;

    console.log("[ScreenShare] Setting up screen share channel for chat:", chatId);
    const channel = supabase.channel(`screen:${chatId}`);

    channel
      .on(
        "broadcast",
        { event: "screen-signal" },
        async ({ payload }: { payload: ScreenShareSignalType }) => {
          if (payload.from === userIdRef.current) return;

          console.log(
            "[ScreenShare] Received signal:",
            payload.type,
            "from:",
            payload.from
          );
          try {
            await handleSignalRef.current?.(payload);
          } catch (err) {
            console.error("[ScreenShare] Error handling screen signal:", err);
          }
        }
      )
      .subscribe((status, err) => {
        console.log(`[ScreenShare] Channel screen:${chatId} →`, status, err ?? "");
        if (err) {
          console.error("[ScreenShare] Subscription error:", err);
        }
      });

    channelRef.current = channel;

    return () => {
      console.log("[ScreenShare] Cleaning up channel");
      cleanupChannel();
      cleanupShare();
    };
  }, [chatId, userId, cleanupChannel, cleanupShare]);

  // --- Public API ---

  const startSharing = useCallback(
    async (options: ScreenShareOptions) => {
      if (!userId || !chatId) {
        setError("Cannot start screen share: no active chat");
        return;
      }

      if (shareStatus !== "idle") {
        console.log("[ScreenShare] Already sharing/viewing");
        return;
      }

      try {
        setError(null);
        setShareStatus("starting");

        // Request screen access
        const stream = await requestScreenShare(options);
        localStreamRef.current = stream;

        // Handle user stopping share via browser button
        stream.getVideoTracks()[0].onended = () => {
          console.log("[ScreenShare] User stopped sharing via browser");
          stopSharing();
        };

        // Create peer connection
        const pc = createPeerConnection();
        setupPeerConnectionListeners(pc, true);
        addStreamToPeer(pc, stream);
        peerConnectionRef.current = pc;

        // Create and send offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await sendSignal({
          type: "screen-offer",
          from: userId,
          fromName: userEmail || "Anonymous",
          offer,
        });

        console.log("[ScreenShare] Screen share offer sent");
      } catch (err) {
        console.error("[ScreenShare] Failed to start sharing:", err);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Failed to start screen sharing");
        }
        cleanupShare();
      }
    },
    [userId, chatId, userEmail, shareStatus, setupPeerConnectionListeners, sendSignal, cleanupShare]
  );

  const stopSharing = useCallback(() => {
    if (!userId) return;

    sendSignal({
      type: "screen-end",
      from: userId,
    });

    cleanupShare();
  }, [userId, sendSignal, cleanupShare]);

  const acceptShare = useCallback(() => {
    // Auto-accepted when receiving offer
    console.log("[ScreenShare] Screen share accepted");
  }, []);

  const rejectShare = useCallback(() => {
    if (!userId) return;

    sendSignal({
      type: "screen-reject",
      from: userId,
    });

    cleanupShare();
  }, [userId, sendSignal, cleanupShare]);

  // Expose the remote video element for rendering
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__screenShareVideoElement = remoteVideoRef.current;
    }
  }, []);

  return {
    shareStatus,
    isIncomingShare,
    presenter,
    error,
    startSharing,
    stopSharing,
    acceptShare,
    rejectShare,
  };
}
