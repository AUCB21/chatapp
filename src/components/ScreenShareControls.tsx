"use client";

import { useScreenShare } from "@/hooks/useScreenShare";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { ScreenShareOptions } from "@/lib/webrtc";

interface ScreenShareControlsProps {
  chatId: string | null;
  chatName: string | null;
  canShare: boolean;
  isInCall: boolean; // Only show when in active call
}

export default function ScreenShareControls({ chatId, chatName, canShare, isInCall }: ScreenShareControlsProps) {
  const {
    shareStatus,
    isIncomingShare,
    presenter,
    error,
    startSharing,
    stopSharing,
  } = useScreenShare(chatId);

  const [showOptions, setShowOptions] = useState(false);
  const [resolution, setResolution] = useState<'720p' | '1080p' | '4k'>('1080p');
  const [includeAudio, setIncludeAudio] = useState(false);
  const [shareDuration, setShareDuration] = useState(0);

  // Track share duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (shareStatus === 'sharing' || shareStatus === 'viewing') {
      setShareDuration(0);
      interval = setInterval(() => {
        setShareDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [shareStatus]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartShare = async () => {
    const options: ScreenShareOptions = {
      resolution,
      includeAudio,
    };
    await startSharing(options);
    setShowOptions(false);
  };

  // Don't render if no active chat, no share permission, or not in a call
  if (!chatId || !canShare || !isInCall) return null;

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Error display */}
        {error && (
          <Badge variant="destructive" className="text-xs max-w-xs truncate">
            {error}
          </Badge>
        )}

        {/* Incoming screen share notification */}
        {isIncomingShare && presenter && (
          <div className="flex items-center gap-2 bg-muted px-3 py-2 rounded-xl border">
            <span className="text-sm text-foreground/90">
              🖥️ {presenter.name} is sharing their screen
            </span>
          </div>
        )}

        {/* Share controls */}
        {!isIncomingShare && (
          <>
            {/* Idle - show share button */}
            {shareStatus === 'idle' && (
              <Button
                onClick={() => setShowOptions(true)}
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl"
                title="Share screen"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                </svg>
              </Button>
            )}

            {/* Starting */}
            {shareStatus === 'starting' && (
              <Badge variant="secondary" className="gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                Starting share...
              </Badge>
            )}

            {/* Sharing - show controls */}
            {shareStatus === 'sharing' && (
              <div className="flex items-center gap-2 bg-muted px-3 py-2 rounded-xl border">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm tabular-nums">
                  Sharing {formatDuration(shareDuration)}
                </span>
                
                <Button
                  onClick={stopSharing}
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs"
                >
                  Stop Sharing
                </Button>
              </div>
            )}

            {/* Viewing someone else's share */}
            {shareStatus === 'viewing' && presenter && (
              <Badge variant="secondary" className="gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                Viewing {presenter.name}&apos;s screen ({formatDuration(shareDuration)})
              </Badge>
            )}

            {/* Ended */}
            {shareStatus === 'ended' && (
              <Badge variant="outline">Share ended</Badge>
            )}
          </>
        )}
      </div>

      {/* Screen Share Options Dialog */}
      <Dialog open={showOptions} onOpenChange={setShowOptions}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Screen Share Options</DialogTitle>
            <DialogDescription>
              Choose your screen share settings. You&apos;ll select which screen or window to share in the next step.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Resolution Selection */}
            <div className="space-y-3">
              <Label>Resolution</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={resolution === '720p' ? 'default' : 'outline'}
                  onClick={() => setResolution('720p')}
                  className="h-auto py-3 flex flex-col gap-1"
                >
                  <span className="font-semibold">720p</span>
                  <span className="text-xs opacity-70">1280×720</span>
                  <span className="text-xs opacity-70">Lower bandwidth</span>
                </Button>
                <Button
                  type="button"
                  variant={resolution === '1080p' ? 'default' : 'outline'}
                  onClick={() => setResolution('1080p')}
                  className="h-auto py-3 flex flex-col gap-1"
                >
                  <span className="font-semibold">1080p</span>
                  <span className="text-xs opacity-70">1920×1080</span>
                  <span className="text-xs opacity-70">Recommended</span>
                </Button>
                <Button
                  type="button"
                  variant={resolution === '4k' ? 'default' : 'outline'}
                  onClick={() => setResolution('4k')}
                  className="h-auto py-3 flex flex-col gap-1"
                >
                  <span className="font-semibold">4K</span>
                  <span className="text-xs opacity-70">3840×2160</span>
                  <span className="text-xs opacity-70">High bandwidth</span>
                </Button>
              </div>
            </div>

            {/* Audio Toggle */}
            <div className="space-y-3">
              <Label>Audio</Label>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Include System Audio</div>
                  <div className="text-xs text-muted-foreground">
                    Share audio from your computer (videos, music, etc.)
                  </div>
                </div>
                <Button
                  type="button"
                  variant={includeAudio ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setIncludeAudio(!includeAudio)}
                >
                  {includeAudio ? 'On' : 'Off'}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOptions(false)}>
              Cancel
            </Button>
            <Button onClick={handleStartShare}>
              Start Sharing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
