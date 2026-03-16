"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useSessionStore } from "@/store/sessionStore";
import { useProfileStore } from "@/store/profileStore";
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
  remoteStream: MediaStream | null;
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
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([]);
  const endedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const shareStatusRef = useRef(shareStatus);
  shareStatusRef.current = shareStatus;

  useEffect(() => {
    if (!isScreenShareSupported()) {
      setError("Screen sharing is not supported in your browser.");
    }
  }, []);

  const cleanupShare = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    stopScreenShare(localStreamRef.current);
    localStreamRef.current = null;

    if (endedTimerRef.current) {
      clearTimeout(endedTimerRef.current);
      endedTimerRef.current = null;
    }

    setShareStatus("idle");
    setIsIncomingShare(false);
    setPresenter(null);
    setError(null);
    setRemoteStream(null);
    iceCandidateQueue.current = [];
  }, []);

  const cleanupChannel = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
  }, []);

  const sendSignal = useCallback(async (signal: ScreenShareSignalType) => {
    if (!channelRef.current) return;
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

  const flushIceCandidates = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !pc.remoteDescription) return;

    const queued = iceCandidateQueue.current.splice(0);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("[ScreenShare] Failed to add queued ICE candidate:", err);
      }
    }
  }, []);

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
        const [stream] = event.streams;
        setRemoteStream(stream);
        if (!isPresenter) {
          setShareStatus("viewing");
        }
      };

      pc.onconnectionstatechange = () => {
        if (
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

      if (shareStatusRef.current !== "idle") return;

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
        await flushIceCandidates();

        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);

        sendSignal({
          type: "screen-answer",
          from: uid,
          answer,
        });
      } catch {
        setError("Failed to process screen share");
        cleanupShare();
      }
    },
    [setupPeerConnectionListeners, sendSignal, cleanupShare, flushIceCandidates]
  );

  const handleAnswer = useCallback(
    async (payload: Extract<ScreenShareSignalType, { type: "screen-answer" }>) => {
      if (!peerConnectionRef.current) return;
      try {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(payload.answer)
        );
        await flushIceCandidates();
        setShareStatus("sharing");
      } catch {
        setError("Failed to complete screen share setup");
        cleanupShare();
      }
    },
    [cleanupShare, flushIceCandidates]
  );

  const handleIceCandidate = useCallback(
    async (payload: Extract<ScreenShareSignalType, { type: "screen-ice-candidate" }>) => {
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
        console.error("[ScreenShare] Failed to add ICE candidate:", err);
      }
    },
    []
  );

  const showEnded = useCallback(
    (msg?: string) => {
      cleanupShare();
      if (msg) setError(msg);
      setShareStatus("ended");
      endedTimerRef.current = setTimeout(() => {
        endedTimerRef.current = null;
        setShareStatus("idle");
        setError(null);
      }, msg ? 3000 : 2000);
    },
    [cleanupShare]
  );

  const handleSignalRef = useRef<(payload: ScreenShareSignalType) => Promise<void>>();
  handleSignalRef.current = async (payload: ScreenShareSignalType) => {
    switch (payload.type) {
      case "screen-offer":
        return handleIncomingOffer(payload);
      case "screen-answer":
        return handleAnswer(payload);
      case "screen-ice-candidate":
        return handleIceCandidate(payload);
      case "screen-end":
        return showEnded();
      case "screen-reject":
        return showEnded("Screen share was declined");
    }
  };

  // --- Realtime channel ---
  useEffect(() => {
    if (!chatId || !userId) return;

    const channel = supabase.channel(`screen:${chatId}`);

    channel
      .on("broadcast", { event: "screen-signal" }, async ({ payload }: { payload: ScreenShareSignalType }) => {
        if (payload.from === userIdRef.current) return;
        try {
          await handleSignalRef.current?.(payload);
        } catch (err) {
          console.error("[ScreenShare] Error handling signal:", err);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      cleanupChannel();
      cleanupShare();
    };
  }, [chatId, userId, cleanupChannel, cleanupShare]);

  // --- Actions ---

  const startSharing = useCallback(
    async (options: ScreenShareOptions) => {
      if (!userId || !chatId) {
        setError("Cannot start screen share: no active chat");
        return;
      }

      if (shareStatus !== "idle") return;

      try {
        setError(null);
        setShareStatus("starting");

        const stream = await requestScreenShare(options);
        localStreamRef.current = stream;

        stream.getVideoTracks()[0].onended = () => {
          stopSharing();
        };

        const pc = createPeerConnection();
        setupPeerConnectionListeners(pc, true);
        addStreamToPeer(pc, stream);
        peerConnectionRef.current = pc;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const profileName = useProfileStore.getState().profile?.displayName;
        await sendSignal({
          type: "screen-offer",
          from: userId,
          fromName: profileName || userEmail || "Anonymous",
          offer,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start screen sharing");
        cleanupShare();
      }
    },
    [userId, chatId, userEmail, shareStatus, setupPeerConnectionListeners, sendSignal, cleanupShare]
  );

  const stopSharing = useCallback(() => {
    if (!userId) return;
    sendSignal({ type: "screen-end", from: userId });
    cleanupShare();
  }, [userId, sendSignal, cleanupShare]);

  const acceptShare = useCallback(() => {}, []);

  const rejectShare = useCallback(() => {
    if (!userId) return;
    sendSignal({ type: "screen-reject", from: userId });
    cleanupShare();
  }, [userId, sendSignal, cleanupShare]);

  return { shareStatus, isIncomingShare, presenter, error, remoteStream, startSharing, stopSharing, acceptShare, rejectShare };
}
