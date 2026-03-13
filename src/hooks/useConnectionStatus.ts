"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

export type ConnectionState = "connected" | "disconnected" | "reconnecting";

/**
 * Monitors Supabase Realtime websocket connection state.
 * Returns the current connection status for UI feedback.
 */
export function useConnectionStatus(): ConnectionState {
  const [state, setState] = useState<ConnectionState>("connected");
  const wasDisconnectedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const channel = supabase.channel("connection-monitor");

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        if (wasDisconnectedRef.current) {
          // Briefly show "reconnecting" then switch to connected
          setState("reconnecting");
          setTimeout(() => setState("connected"), 1500);
          wasDisconnectedRef.current = false;
        } else {
          setState("connected");
        }
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        wasDisconnectedRef.current = true;
        setState("disconnected");
      } else if (status === "CLOSED") {
        wasDisconnectedRef.current = true;
        setState("disconnected");
      }
    });

    // Also monitor browser online/offline events
    function handleOffline() {
      wasDisconnectedRef.current = true;
      setState("disconnected");
    }
    function handleOnline() {
      setState("reconnecting");
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      channel.unsubscribe();
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return state;
}
