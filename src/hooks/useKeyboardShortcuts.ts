import { useEffect } from "react";

interface UseKeyboardShortcutsOptions {
  onToggleSearch: () => void;
  onEscapeSearch: () => void;
  onNavigateChat: (direction: "up" | "down") => void;
  isSearchMode: boolean;
}

export function useKeyboardShortcuts({
  onToggleSearch,
  onEscapeSearch,
  onNavigateChat,
  isSearchMode,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+K (Mac) / Ctrl+K (Windows): Toggle search mode
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onToggleSearch();
        return;
      }

      // Escape: Close search mode (only when search is active)
      if (e.key === "Escape" && isSearchMode) {
        onEscapeSearch();
        return;
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
  }, [onToggleSearch, onEscapeSearch, onNavigateChat, isSearchMode]);
}
