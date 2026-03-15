"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";

/**
 * Universal auth callback page.
 * Supabase redirects here with tokens in the URL hash.
 * Waits for Supabase JS to process the token, then routes to the correct page.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    const supabase = getSupabase();
    const hash = window.location.hash;
    const isRecovery = hash.includes("type=recovery");

    // For recovery, redirect immediately — the reset-password page
    // will handle token processing via the hash fragment.
    if (isRecovery) {
      handled.current = true;
      window.location.href = "/reset-password" + hash;
      return;
    }

    function navigate(path: string) {
      if (handled.current) return;
      handled.current = true;
      router.replace(path);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        navigate("/reset-password");
      } else if (event === "SIGNED_IN") {
        navigate("/");
      }
    });

    // Fallback: if the event already fired before we subscribed
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/");
    });

    // Safety net
    const timeout = setTimeout(() => navigate("/login"), 5000);
    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <svg className="w-6 h-6 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <p className="text-sm text-muted-foreground">Verifying...</p>
      </div>
    </main>
  );
}
