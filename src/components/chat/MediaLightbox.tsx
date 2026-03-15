"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface MediaLightboxProps {
  src: string | null;
  mimeType: string;
  fileName: string;
  onClose: () => void;
}

export default function MediaLightbox({ src, mimeType, fileName, onClose }: MediaLightboxProps) {
  useEffect(() => {
    if (!src) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [src, onClose]);

  if (!src) return null;

  const isImage = mimeType.startsWith("image/");
  const isVideo = mimeType.startsWith("video/");
  const isAudio = mimeType.startsWith("audio/");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Media content */}
      <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-3">
        {isImage && (
          <img
            src={src}
            alt={fileName}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
          />
        )}

        {isVideo && (
          <video
            controls
            autoPlay
            className="max-h-[90vh] max-w-[90vw] rounded-lg"
          >
            <source src={src} type={mimeType} />
          </video>
        )}

        {isAudio && (
          <div className="bg-card/90 backdrop-blur-md rounded-2xl p-8 flex flex-col items-center gap-4 border border-border/40 shadow-lg">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <audio controls autoPlay className="w-80">
              <source src={src} type={mimeType} />
            </audio>
          </div>
        )}

        {/* File name */}
        <p className="text-white/70 text-sm truncate max-w-[90vw] text-center">
          {fileName}
        </p>
      </div>
    </div>
  );
}
