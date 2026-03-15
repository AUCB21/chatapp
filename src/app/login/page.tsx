"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSessionStore } from "@/store/sessionStore";

function EpsLogo({ className }: { className?: string }) {
  return (
    <svg className={className} width="400" height="200" viewBox="0 0 400 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="eps_g_login" x1="0" y1="100" x2="400" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E40AF" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <path d="M110 60C82.3858 60 60 82.3858 60 110C60 124.341 66.0142 137.278 75.666 146.438L65 170L95.5 158.5C100.1 159.4 104.9 160 110 160C137.614 160 160 137.614 160 110C160 82.3858 137.614 60 110 60Z" stroke="url(#eps_g_login)" strokeWidth="8" strokeLinejoin="round"/>
      <path d="M165 60C137.386 60 115 82.3858 115 110C115 124.341 121.014 137.278 130.666 146.438L120 170L150.5 158.5C155.1 158.5 159.9 160 165 160C192.614 160 215 137.614 215 110C215 82.3858 192.614 60 165 60Z" stroke="url(#eps_g_login)" strokeWidth="8" strokeLinejoin="round" fill="white" fillOpacity="0.1"/>
      <text x="235" y="125" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="64" fill="url(#eps_g_login)">EPS</text>
      <text x="237" y="155" fontFamily="Arial, sans-serif" fontWeight="400" fontSize="20" fill="#64748B" letterSpacing="2">CHATTING</text>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();

  // If Supabase redirects a recovery token here instead of /reset-password, forward it
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      router.replace("/reset-password" + hash);
    }
  }, [router]);

  const setUser = useSessionStore((s) => s.setUser);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Login failed.");
        return;
      }

      setUser({ id: json.data.id, email: json.data.email, created_at: "" });

      if (json.data.session) {
        const { supabase } = await import("@/lib/supabaseClient");
        await supabase.auth.setSession(json.data.session);
      }

      router.push("/");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex bg-background">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[46%] relative flex-col items-center justify-center p-12 overflow-hidden bg-[#0f1117]">
        {/* Gradient orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-125 h-125 rounded-full bg-blue-700/30 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-100 h-100 rounded-full bg-violet-600/25 blur-[100px] pointer-events-none" />

        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative z-10 flex flex-col items-center text-center gap-8 max-w-xs">
          {/* Logo */}
          <EpsLogo className="w-56 select-none" />

          <div className="space-y-3">
            <p className="text-white/60 text-sm leading-relaxed">
              Secure, real-time messaging for your team. Files, calls, and collaboration — all in one place.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {["End-to-end", "File sharing", "Voice calls", "Screen share"].map((f) => (
              <span
                key={f}
                className="text-[0.65rem] font-medium px-3 py-1 rounded-full border border-white/10 bg-white/5 text-white/50"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <EpsLogo className="h-10 select-none" />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in to continue, or{" "}
              <Link href="/register" className="text-primary hover:underline font-medium">
                create an account
              </Link>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={loading}
                className="w-full h-11 px-4 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all placeholder:text-muted-foreground/40 disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs text-primary hover:underline font-medium">
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="········"
                disabled={loading}
                className="w-full h-11 px-4 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all placeholder:text-muted-foreground/40 disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-1 relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #1E40AF 0%, #7C3AED 100%)" }}
            >
              <span className="absolute inset-0 bg-white/0 hover:bg-white/10 transition-colors rounded-xl" />
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin relative" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  <span className="relative">Signing in…</span>
                </>
              ) : (
                <span className="relative">Sign in</span>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary hover:underline font-medium">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
