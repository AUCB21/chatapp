"use client";

import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useProfileStore, selectAccentColors } from "@/store/profileStore";

/**
 * Overrides core theme CSS variables when the user has custom accent colors.
 *
 * Instead of introducing separate --accent-* vars, we override the theme
 * variables themselves (--background, --foreground, --primary) so every
 * Tailwind class that references them (bg-background, text-foreground,
 * bg-primary, etc.) automatically picks up the custom color.
 *
 * When no custom color is set the override is removed and the theme
 * defaults (light/dark) take effect again.
 */
export default function AccentColorProvider() {
  const colors = useProfileStore(useShallow(selectAccentColors));

  useEffect(() => {
    const root = document.documentElement.style;

    // Override --background when custom bg is set
    if (colors.bg) {
      root.setProperty("--background", colors.bg);
    } else {
      root.removeProperty("--background");
    }

    // Override --foreground when custom font color is set
    if (colors.font) {
      root.setProperty("--foreground", colors.font);
      root.setProperty("--card-foreground", colors.font);
    } else {
      root.removeProperty("--foreground");
      root.removeProperty("--card-foreground");
    }

    // Override --primary when custom chat bubble color is set
    if (colors.chat) {
      root.setProperty("--primary", colors.chat);
    } else {
      root.removeProperty("--primary");
    }
  }, [colors.bg, colors.font, colors.chat]);

  return null;
}
