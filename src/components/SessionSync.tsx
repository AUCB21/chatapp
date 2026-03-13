"use client";

import { useEffect } from "react";
import { getSupabase } from "@/lib/supabaseClient";

/**
 * SessionSync component ensures client-side Supabase has the session.
 * On mount, fetches session from server-side cookies and syncs to client.
 * This enables Realtime subscriptions to have proper auth context.
 */
export function SessionSync() {
  useEffect(() => {
    async function syncSession() {
      try {
        const supabase = getSupabase();
        
        // Check if client already has a session
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        if (existingSession) {
          return;
        }
        
        // Fetch session from server-side cookies
        const res = await fetch('/api/auth/session');
        
        if (!res.ok) {
          return;
        }
        
        const { data } = await res.json();
        
        if (data?.session) {
          await supabase.auth.setSession(data.session);
        }
      } catch (error) {
        console.error('[SessionSync] Failed to sync session:', error);
      }
    }
    
    syncSession();
  }, []);
  
  return null; // This component only handles side effects
}
