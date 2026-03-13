"use client";

import { useState, useCallback } from "react";

const STORAGE_KEY = "muted-chats";

function readMuted(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return new Set(stored ? (JSON.parse(stored) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function useMutedChats() {
  const [mutedChats, setMutedChats] = useState<Set<string>>(readMuted);

  const toggleMute = useCallback((chatId: string) => {
    setMutedChats((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) next.delete(chatId);
      else next.add(chatId);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const isMutedChat = useCallback(
    (chatId: string) => mutedChats.has(chatId),
    [mutedChats]
  );

  return { mutedChats, isMutedChat, toggleMute };
}
