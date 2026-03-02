"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Registration failed.");
        return;
      }

      if (json.data.confirmed) {
        // Set session in client Supabase for Realtime auth
        if (json.data.session) {
          const { supabase } = await import("@/lib/supabaseClient");
          await supabase.auth.setSession(json.data.session);
          console.log('[Auth] Session set in localStorage for Realtime');
        }
        router.push("/");
      } else {
        setPendingConfirmation(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (pendingConfirmation) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">
            Check your email
          </h1>
          <p className="text-sm text-neutral-500">
            We sent a confirmation link to{" "}
            <span className="font-medium text-neutral-900">{email}</span>.
            Click it to activate your account.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block text-sm text-neutral-500 hover:text-neutral-900 transition"
          >
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">
          Create an account
        </h1>
        <p className="text-sm text-neutral-500 mb-8">
          Already have one?{" "}
          <Link
            href="/login"
            className="text-neutral-900 font-medium hover:underline"
          >
            Sign in
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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition"
              placeholder="Min. 8 characters"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="confirm" className="text-sm font-medium">
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
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
      </div>
    </main>
  );
}
