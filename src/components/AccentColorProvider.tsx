"use client";

import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useProfileStore, selectAccentColors } from "@/store/profileStore";

/**
 * Injects user accent color CSS variables onto :root.
 * Components use these variables via Tailwind arbitrary values or inline styles.
 *
 * Variables:
 *   --accent-bg    → custom background color
 *   --accent-font  → custom font/text color
 *   --accent-chat  → custom chat bubble color (own messages)
 */
export default function AccentColorProvider() {
  const colors = useProfileStore(useShallow(selectAccentColors));

  useEffect(() => {
    const root = document.documentElement;

    if (colors.bg) {
      root.style.setProperty("--accent-bg", colors.bg);
    } else {
      root.style.removeProperty("--accent-bg");
    }

    if (colors.font) {
      root.style.setProperty("--accent-font", colors.font);
    } else {
      root.style.removeProperty("--accent-font");
    }

    if (colors.chat) {
      root.style.setProperty("--accent-chat", colors.chat);
    } else {
      root.style.removeProperty("--accent-chat");
    }
  }, [colors.bg, colors.font, colors.chat]);

  return null;
}
