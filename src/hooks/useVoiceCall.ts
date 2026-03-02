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
  // State
  callStatus: VoiceCallStatus;
  isMuted: boolean;
  isIncomingCall: boolean;
  caller: CallerInfo | null;
  error: string | null;
  
  // Actions
  startCall: (targetUserId: string, targetUserName: string) => Promise<void>;
  answerCall: () => Promise<void>;
  rejectCall: () => void;
  hangUp: () => void;
  toggleMute: () => void;
}

export function useVoiceCall(chatId: string | null): UseVoiceCallReturn {
  const user = useSessionStore((s) => s.user);
  
  const [callStatus, setCallStatus] = useState<VoiceCallStatus>('idle');
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

  // Check WebRTC support
  useEffect(() => {
    if (!isWebRTCSupported()) {
      setError('Voice calls are not supported in your browser. Please use Chrome, Firefox, Safari, or Edge.');
    }
  }, []);

  // Initialize remote audio element
  useEffect(() => {
    if (typeof window !== 'undefined' && !remoteAudioRef.current) {
      remoteAudioRef.current = new Audio();
      remoteAudioRef.current.autoplay = true;
    }
  }, []);

  // Cleanup on unmount or chat change
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [chatId]);

  const cleanup = useCallback(() => {
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Stop local stream
    stopMediaStream(localStreamRef.current);
    localStreamRef.current = null;

    // Stop remote stream
    stopMediaStream(remoteStreamRef.current);
    remoteStreamRef.current = null;

    // Unsubscribe from channel
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }

    // Reset state
    setCallStatus('idle');
    setIsIncomingCall(false);
    setCaller(null);
    setIsMuted(false);
    targetUserIdRef.current = null;
  }, []);

  // Setup Realtime channel for signaling
  const setupChannel = useCallback(() => {
    if (!chatId || !user) return;

    const channel = supabase.channel(`voice:${chatId}`);
    
    channel
      .on('broadcast', { event: 'voice-signal' }, async ({ payload }: { payload: VoiceSignalType }) => {
        // Ignore our own signals
        if (payload.from === user.id) return;

        try {
          switch (payload.type) {
            case 'call-offer':
              await handleIncomingOffer(payload);
              break;
            case 'call-answer':
              await handleAnswer(payload);
              break;
            case 'ice-candidate':
              await handleIceCandidate(payload);
              break;
            case 'call-end':
              handleCallEnd();
              break;
            case 'call-reject':
              handleCallRejected();
              break;
          }
        } catch (err) {
          console.error('Error handling voice signal:', err);
          setError(err instanceof Error ? err.message : 'Failed to process call signal');
        }
      })
      .subscribe();

    channelRef.current = channel;
  }, [chatId, user]);

  useEffect(() => {
    if (chatId && callStatus !== 'idle' && callStatus !== 'ended') {
      setupChannel();
    }
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [chatId, callStatus, setupChannel]);

  // Send signal via Realtime
  const sendSignal = useCallback(async (signal: VoiceSignalType) => {
    if (!channelRef.current) {
      setupChannel();
      // Wait a bit for channel to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'voice-signal',
        payload: signal,
      });
    }
  }, [setupChannel]);

  // Handle incoming call offer
  const handleIncomingOffer = async (payload: Extract<VoiceSignalType, { type: 'call-offer' }>) => {
    if (callStatus !== 'idle') return; // Already in a call

    setCaller({ id: payload.from, name: payload.fromName });
    setIsIncomingCall(true);
    setCallStatus('ringing');
    targetUserIdRef.current = payload.from;

    // Store the offer to process when user answers
    if (!peerConnectionRef.current) {
      const pc = createPeerConnection();
      setupPeerConnectionListeners(pc);
      peerConnectionRef.current = pc;
    }

    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(payload.offer));
  };

  // Handle answer to our call
  const handleAnswer = async (payload: Extract<VoiceSignalType, { type: 'call-answer' }>) => {
    if (!peerConnectionRef.current) return;
    
    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
    setCallStatus('connected');
  };

  // Handle ICE candidate
  const handleIceCandidate = async (payload: Extract<VoiceSignalType, { type: 'ice-candidate' }>) => {
    if (!peerConnectionRef.current) return;
    
    await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
  };

  // Handle call end
  const handleCallEnd = () => {
    cleanup();
    setCallStatus('ended');
    setTimeout(() => setCallStatus('idle'), 2000);
  };

  // Handle call rejection
  const handleCallRejected = () => {
    cleanup();
    setError('Call was declined');
    setCallStatus('ended');
    setTimeout(() => {
      setCallStatus('idle');
      setError(null);
    }, 3000);
  };

  // Setup peer connection event listeners
  const setupPeerConnectionListeners = (pc: RTCPeerConnection) => {
    pc.onicecandidate = (event) => {
      if (event.candidate && user && targetUserIdRef.current) {
        sendSignal({
          type: 'ice-candidate',
          from: user.id,
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
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallStatus('connected');
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setError('Connection lost');
        cleanup();
      }
    };
  };

  // Start a call
  const startCall = async (targetUserId: string, targetUserName: string) => {
    if (!user || !chatId) return;
    
    setError(null);
    setCallStatus('calling');
    targetUserIdRef.current = targetUserId;

    try {
      // Get microphone access
      const stream = await requestMicrophoneAccess();
      localStreamRef.current = stream;

      // Create peer connection
      const pc = createPeerConnection();
      setupPeerConnectionListeners(pc);
      peerConnectionRef.current = pc;

      // Add local stream
      addStreamToPeer(pc, stream);

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer via Realtime
      setupChannel();
      await sendSignal({
        type: 'call-offer',
        from: user.id,
        fromName: user.email?.split('@')[0] || 'Unknown',
        offer: pc.localDescription!.toJSON(),
      });
    } catch (err) {
      console.error('Failed to start call:', err);
      setError(err instanceof Error ? err.message : 'Failed to start call');
      cleanup();
    }
  };

  // Answer an incoming call
  const answerCall = async () => {
    if (!user || !peerConnectionRef.current) return;

    setError(null);
    setIsIncomingCall(false);

    try {
      // Get microphone access
      const stream = await requestMicrophoneAccess();
      localStreamRef.current = stream;

      // Add local stream
      addStreamToPeer(peerConnectionRef.current, stream);

      // Create answer
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      // Send answer
      await sendSignal({
        type: 'call-answer',
        from: user.id,
        answer: peerConnectionRef.current.localDescription!.toJSON(),
      });

      setCallStatus('connected');
    } catch (err) {
      console.error('Failed to answer call:', err);
      setError(err instanceof Error ? err.message : 'Failed to answer call');
      cleanup();
    }
  };

  // Reject an incoming call
  const rejectCall = () => {
    if (!user) return;

    sendSignal({
      type: 'call-reject',
      from: user.id,
    });

    cleanup();
  };

  // Hang up the call
  const hangUp = () => {
    if (!user) return;

    sendSignal({
      type: 'call-end',
      from: user.id,
    });

    cleanup();
  };

  // Toggle mute
  const toggleMute = () => {
    const newMutedState = !isMuted;
    toggleStreamMute(localStreamRef.current, newMutedState);
    setIsMuted(newMutedState);
  };

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
