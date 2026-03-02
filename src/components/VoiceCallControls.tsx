"use client";

import { useVoiceCall } from "@/hooks/useVoiceCall";
import { useEffect, useState } from "react";

interface VoiceCallControlsProps {
  chatId: string | null;
  chatName: string | null;
  canCall: boolean; // Whether user has permission to make calls
}

export default function VoiceCallControls({ chatId, chatName, canCall }: VoiceCallControlsProps) {
  const {
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
  } = useVoiceCall(chatId);

  const [callDuration, setCallDuration] = useState(0);

  // Track call duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callStatus === 'connected') {
      setCallDuration(0);
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartCall = () => {
    if (!chatId || !chatName) return;
    // In a real app, you'd get the actual user ID to call
    // For now, we use the chat ID as a placeholder
    startCall(chatId, chatName);
  };

  // Don't render if no active chat or no call permission
  if (!chatId || !canCall) return null;

  return (
    <div className="flex items-center gap-2">
      {/* Error display */}
      {error && (
        <div className="text-xs text-red-500 max-w-xs truncate" title={error}>
          {error}
        </div>
      )}

      {/* Incoming call notification */}
      {isIncomingCall && caller && (
        <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
          <span className="text-sm font-medium text-blue-900">
            📞 {caller.name} is calling...
          </span>
          <button
            onClick={answerCall}
            className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded transition-colors"
          >
            Answer
          </button>
          <button
            onClick={rejectCall}
            className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded transition-colors"
          >
            Decline
          </button>
        </div>
      )}

      {/* Call controls */}
      {!isIncomingCall && (
        <>
          {/* Idle - show call button */}
          {callStatus === 'idle' && (
            <button
              onClick={handleStartCall}
              className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
              title="Start voice call"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
            </button>
          )}

          {/* Calling - show status */}
          {callStatus === 'calling' && (
            <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-blue-900">Calling...</span>
              <button
                onClick={hangUp}
                className="p-1 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                title="Cancel call"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
              </button>
            </div>
          )}

          {/* Connected - show controls */}
          {callStatus === 'connected' && (
            <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-sm font-medium text-green-900 tabular-nums">
                {formatDuration(callDuration)}
              </span>
              
              {/* Mute/Unmute */}
              <button
                onClick={toggleMute}
                className={`p-1 rounded transition-colors ${
                  isMuted
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              {/* Hang up */}
              <button
                onClick={hangUp}
                className="p-1 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                title="End call"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
              </button>
            </div>
          )}

          {/* Ended */}
          {callStatus === 'ended' && (
            <div className="text-sm text-gray-500">Call ended</div>
          )}
        </>
      )}
    </div>
  );
}
