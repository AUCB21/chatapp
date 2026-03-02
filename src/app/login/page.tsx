"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSessionStore } from "@/store/sessionStore";

export default function LoginPage() {
  const router = useRouter();
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

      // Set session in client Supabase for Realtime auth
      if (json.data.session) {
        const { supabase } = await import("@/lib/supabaseClient");
        await supabase.auth.setSession(json.data.session);
        console.log('[Auth] Session set in localStorage for Realtime');
      }

      router.push("/");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">
          Chat App
        </h1>
        <p className="text-sm text-neutral-500 mb-8">
          Sign in to your account or{" "}
          <Link
            href="/register"
            className="text-neutral-900 font-medium hover:underline"
          >
            create one
          </Link>
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition"
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 bg-neutral-900 text-white text-sm font-medium py-2 rounded-md hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
