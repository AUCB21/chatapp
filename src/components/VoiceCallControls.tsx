"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";

interface VoiceCallControlsProps {
  chatId: string | null;
  canCall: boolean; // Whether user has permission to make calls
  callStatus: VoiceCallStatus;
  isMuted: boolean;
  isIncomingCall: boolean;
  caller: CallerInfo | null;
  error: string | null;
  onStartCall: () => Promise<void>;
  onAnswerCall: () => Promise<void>;
  onRejectCall: () => void;
  onHangUp: () => void;
  onToggleMute: () => void;
}

export default function VoiceCallControls({
  chatId,
  canCall,
  callStatus,
  isMuted,
  isIncomingCall,
  caller,
  error,
  onStartCall,
  onAnswerCall,
  onRejectCall,
  onHangUp,
  onToggleMute,
}: VoiceCallControlsProps) {

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

  // Don't render if no active chat or no call permission
  if (!chatId || !canCall) return null;

  return (
    <div className="flex items-center gap-2">
      {/* Error display */}
      {error && (
        <Badge variant="destructive" className="text-xs max-w-xs truncate">
          {error}
        </Badge>
      )}

      {/* Incoming call notification */}
      {isIncomingCall && caller && (
        <div className="flex items-center gap-2 bg-muted px-3 py-2 rounded-xl border">
          <span className="text-sm text-foreground/90">
            {caller.name} is calling...
          </span>
          <Button
            onClick={onAnswerCall}
            size="sm"
            className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
          >
            Answer
          </Button>
          <Button
            onClick={onRejectCall}
            size="sm"
            variant="destructive"
            className="h-7 text-xs"
          >
            Decline
          </Button>
        </div>
      )}

      {/* Call controls */}
      {!isIncomingCall && (
        <>
          {/* Idle - show call button */}
          {callStatus === 'idle' && (
            <Button
              onClick={onStartCall}
              className="h-9 px-4 rounded-xl text-[0.625rem] uppercase tracking-wider bg-green-600 hover:bg-green-700 text-white gap-2"
            >
              <Phone className="w-3.5 h-3.5" />
              Call
            </Button>
          )}

          {/* Calling - show status */}
          {callStatus === 'calling' && (
            <div className="flex items-center gap-2">
              <Button
                onClick={onHangUp}
                className="h-9 px-4 rounded-xl text-[0.625rem] uppercase tracking-wider bg-red-500 hover:bg-red-600 text-white gap-2"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                Cancel
              </Button>
              <Badge variant="secondary" className="h-8 rounded-lg">
                Calling…
              </Badge>
            </div>
          )}

          {/* Connected - show controls */}
          {callStatus === 'connected' && (
            <div className="flex items-center gap-2">
              <Button
                onClick={onHangUp}
                className="h-9 px-4 rounded-xl text-[0.625rem] uppercase tracking-wider bg-red-500 hover:bg-red-600 text-white gap-2"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                Hang up
              </Button>

              <Button
                onClick={onToggleMute}
                size="sm"
                variant="outline"
                className="h-9 w-9 p-0 rounded-xl"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>

              <Badge variant="secondary" className="h-8 rounded-lg tabular-nums">
                {formatDuration(callDuration)}
              </Badge>
            </div>
          )}

          {/* Ended */}
          {callStatus === 'ended' && (
            <Badge variant="outline" className="text-xs rounded-lg">
              Call ended
            </Badge>
          )}
        </>
      )}
    </div>
  );
}
