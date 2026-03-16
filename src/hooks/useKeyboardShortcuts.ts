import { useEffect } from "react";

interface UseKeyboardShortcutsOptions {
  onToggleSearch: () => void;
  onEscapeSearch: () => void;
  onNavigateChat: (direction: "up" | "down") => void;
  onExitChat: () => void;
  isSearchMode: boolean;
  hasActiveChat: boolean;
}

export function useKeyboardShortcuts({
  onToggleSearch,
  onEscapeSearch,
  onNavigateChat,
  onExitChat,
  isSearchMode,
  hasActiveChat,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+K (Mac) / Ctrl+K (Windows): Toggle search mode
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onToggleSearch();
        return;
      }

      if (e.key === "Escape") {
        // Don't fire if user is typing in an input/textarea
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;

        // Priority 1: close search
        if (isSearchMode) {
          onEscapeSearch();
          return;
        }
        // Priority 2: exit chat
        if (hasActiveChat) {
          onExitChat();
          return;
        }
      }

      // Alt+ArrowUp / Alt+ArrowDown: Navigate chats
      if (e.altKey && e.key === "ArrowUp") {
        e.preventDefault();
        onNavigateChat("up");
        return;
      }
      if (e.altKey && e.key === "ArrowDown") {
        e.preventDefault();
        onNavigateChat("down");
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToggleSearch, onEscapeSearch, onNavigateChat, onExitChat, isSearchMode, hasActiveChat]);
}
