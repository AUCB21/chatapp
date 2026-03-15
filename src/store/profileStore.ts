import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { UserProfile, UserStatus } from "../db/schema";

interface ProfileState {
  profile: UserProfile | null;
  setProfile: (profile: UserProfile | null) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  reset: () => void;
}

export const useProfileStore = create<ProfileState>()(
  devtools(
    (set) => ({
      profile: null,

      setProfile: (profile) => set({ profile }, false, "setProfile"),

      updateProfile: (updates) =>
        set(
          (state) =>
            state.profile
              ? { profile: { ...state.profile, ...updates } }
              : state,
          false,
          "updateProfile"
        ),

      reset: () => set({ profile: null }, false, "reset"),
    }),
    { name: "ProfileStore" }
  )
);

// Selectors
export const selectAccentColors = (state: ProfileState) => ({
  bg: state.profile?.accentBg ?? null,
  font: state.profile?.accentFont ?? null,
  chat: state.profile?.accentChat ?? null,
});

export const selectUserStatus = (state: ProfileState): UserStatus =>
  state.profile?.status ?? "online";

export const selectIsDnd = (state: ProfileState): boolean =>
  state.profile?.status === "dnd";

export const selectProfileStatus = (state: ProfileState) =>
  state.profile?.status ?? null;
