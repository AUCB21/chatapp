"use client";

import { useEffect, useRef, useCallback } from "react";

const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const ACTIVITY_EVENTS = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];

/**
 * Detects user inactivity and calls onIdle/onActive callbacks.
 * Used to auto-set presence status to "idle" after 5 minutes.
 */
export function useIdleDetector(
  onIdle: () => void,
  onActive: () => void,
  enabled: boolean = true
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIdleRef = useRef(false);

  const resetTimer = useCallback(() => {
    if (!enabled) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    if (isIdleRef.current) {
      isIdleRef.current = false;
      onActive();
    }

    timerRef.current = setTimeout(() => {
      isIdleRef.current = true;
      onIdle();
    }, IDLE_TIMEOUT);
  }, [enabled, onIdle, onActive]);

  useEffect(() => {
    if (!enabled) return;

    // Start initial timer
    resetTimer();

    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, resetTimer, { passive: true });
    }

    // Also detect tab visibility changes
    const handleVisibility = () => {
      if (document.hidden) {
        // Start idle countdown immediately on tab hide
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          isIdleRef.current = true;
          onIdle();
        }, IDLE_TIMEOUT);
      } else {
        resetTimer();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const event of ACTIVITY_EVENTS) {
        document.removeEventListener(event, resetTimer);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, resetTimer, onIdle]);
}
