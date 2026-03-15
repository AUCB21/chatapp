"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { PASSWORD_RULES } from "@/lib/validation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);

  // Users arrive here with a hash fragment containing access_token + type=recovery.
  // Supabase JS auto-detects the hash and exchanges it for a session.
  // We listen for both PASSWORD_RECOVERY and SIGNED_IN events.
  useEffect(() => {
    let resolved = false;
    const hash = window.location.hash;
    const isRecoveryHash = hash.includes("type=recovery");

    function markReady() {
      if (resolved) return;
      resolved = true;
      setReady(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY") {
          markReady();
        } else if (event === "SIGNED_IN" && isRecoveryHash) {
          markReady();
        }
      }
    );

    // Poll for session — Supabase processes the hash asynchronously.
    // Check every second until we find a session or give up after 15s.
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) markReady();
      });
      if (attempts >= 15) clearInterval(interval);
    }, 1000);

    // Also check immediately for pre-existing session (e.g. navigated from callback)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) markReady();
    });

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    if (!PASSWORD_RULES.every((r) => r.test(password))) {
      setError("Password does not meet all requirements.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-background relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025] dark:opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            {done ? "Password updated" : "Set new password"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {done
              ? "Redirecting you to sign in…"
              : ready
                ? "Enter your new password below."
                : "Verifying your reset link…"}
          </p>
        </div>

        {done ? (
          <Link
            href="/login"
            className="block w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all text-center leading-11"
          >
            Go to sign in
          </Link>
        ) : !ready ? (
          <div className="flex justify-center py-8">
            <svg className="w-6 h-6 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                New password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 10 characters"
                disabled={loading}
                className="w-full h-11 px-4 rounded-xl bg-muted/60 border border-border text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all placeholder:text-muted-foreground/50 disabled:opacity-50"
              />
              {password.length > 0 && (
                <ul className="space-y-0.5 mt-1.5">
                  {PASSWORD_RULES.map((rule) => {
                    const pass = rule.test(password);
                    return (
                      <li key={rule.label} className={`text-[0.65rem] flex items-center gap-1.5 ${pass ? "text-emerald-500" : "text-muted-foreground"}`}>
                        {pass ? (
                          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                        ) : (
                          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>
                        )}
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="········"
                disabled={loading}
                className="w-full h-11 px-4 rounded-xl bg-muted/60 border border-border text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all placeholder:text-muted-foreground/50 disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Updating…
                </>
              ) : (
                "Update password"
              )}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
