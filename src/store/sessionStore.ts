import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type { AuthUser } from "../db/schema";

// --- State shape ---

interface SessionState {
  user: AuthUser | null;
  isAuthenticated: boolean;

  // Actions
  setUser: (user: AuthUser) => void;
  clearSession: () => void;
}

// --- Store ---

/**
 * persist: survives page refresh via localStorage.
 * Only stores minimal user data — no tokens (Supabase manages those via cookies).
 */
export const useSessionStore = create<SessionState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        isAuthenticated: false,

        setUser: (user) =>
          set({ user, isAuthenticated: true }, false, "setUser"),

        clearSession: () =>
          set({ user: null, isAuthenticated: false }, false, "clearSession"),
      }),
      {
        name: "session",
        // Only persist non-sensitive fields
        partialize: (state) => ({ user: state.user }),
      }
    ),
    { name: "SessionStore" }
  )
);
