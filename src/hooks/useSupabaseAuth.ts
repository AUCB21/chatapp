"use client";

import { useState, useEffect } from "react";
import { getSupabase } from "@/lib/supabaseClient";

/**
 * Waits for the Supabase client to have a valid auth session
 * AND explicitly pushes the access token to the Realtime transport.
 *
 * Realtime subscriptions must NOT be created until this returns true,
 * otherwise RLS policies will silently block all events.
 */
export function useSupabaseAuth() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();

    function pushToken(session: { access_token: string } | null) {
      if (session) {
        // Explicitly set the Realtime token so the WebSocket sends it
        // on the next channel join. This closes the race where the
        // internal SupabaseClient listener fires before Realtime is
        // initialized.
        supabase.realtime.setAuth(session.access_token);
      }
    }

    // Listen for auth state changes (initial restore from localStorage, refreshes, sign-outs)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        pushToken(session);
        setIsReady(true);
      } else if (event === "SIGNED_OUT") {
        setIsReady(false);
      }
    });

    // Fallback: session may already be restored before the listener registered
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        pushToken(session);
        setIsReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return isReady;
}
