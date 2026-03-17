"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PASSWORD_RULES } from "@/lib/validation";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

function EpsLogo({ className }: { className?: string }) {
  return (
    <svg className={className} width="400" height="200" viewBox="0 0 400 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="eps_g_reg" x1="0" y1="100" x2="400" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E40AF" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <path d="M110 60C82.3858 60 60 82.3858 60 110C60 124.341 66.0142 137.278 75.666 146.438L65 170L95.5 158.5C100.1 159.4 104.9 160 110 160C137.614 160 160 137.614 160 110C160 82.3858 137.614 60 110 60Z" stroke="url(#eps_g_reg)" strokeWidth="8" strokeLinejoin="round"/>
      <path d="M165 60C137.386 60 115 82.3858 115 110C115 124.341 121.014 137.278 130.666 146.438L120 170L150.5 158.5C155.1 158.5 159.9 160 165 160C192.614 160 215 137.614 215 110C215 82.3858 192.614 60 165 60Z" stroke="url(#eps_g_reg)" strokeWidth="8" strokeLinejoin="round" fill="white" fillOpacity="0.1"/>
      <text x="235" y="125" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="64" fill="url(#eps_g_reg)">EPS</text>
      <text x="237" y="155" fontFamily="Arial, sans-serif" fontWeight="400" fontSize="20" fill="#64748B" letterSpacing="2">CHATTING</text>
    </svg>
  );
}

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [consented, setConsented] = useState(false);
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
        body: JSON.stringify({ email, password, consented }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Registration failed.");
        return;
      }

      if (json.data.confirmed) {
        if (json.data.session) {
          const { supabase } = await import("@/lib/supabaseClient");
          await supabase.auth.setSession(json.data.session);
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
      <main className="min-h-screen flex bg-background">
        <div className="hidden lg:flex lg:w-[46%] relative flex-col items-center justify-center p-12 overflow-hidden bg-[#0f1117]">
          <div className="absolute top-[-10%] left-[-10%] w-125 h-125 rounded-full bg-blue-700/30 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-[-10%] right-[-10%] w-100 h-100 rounded-full bg-violet-600/25 blur-[100px] pointer-events-none" />
          <div className="absolute inset-0 pointer-events-none opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
          <div className="relative z-10 flex flex-col items-center text-center gap-8 max-w-xs">
            <EpsLogo className="w-56 select-none" />
            <p className="text-white/60 text-sm leading-relaxed">Secure, real-time messaging for your team. Files, calls, and collaboration — all in one place.</p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm text-center">
            <div className="flex justify-center mb-6 lg:hidden">
              <EpsLogo className="h-10 select-none" />
            </div>
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 0 1-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 0 0 1.183 1.981l6.478 3.488m8.839 2.51-4.66-2.51m0 0-1.023-.55a2.25 2.25 0 0 0-2.134 0l-1.022.55m0 0-4.661 2.51m16.5 1.615a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V8.844a2.25 2.25 0 0 1 1.183-1.981l7.5-4.039a2.25 2.25 0 0 1 2.134 0l7.5 4.039a2.25 2.25 0 0 1 1.183 1.98V19.5Z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">Check your email</h1>
            <p className="text-sm text-muted-foreground mb-8">
              We sent a confirmation link to{" "}
              <span className="font-medium text-foreground">{email}</span>.
              Click it to activate your account.
            </p>
            <Link
              href="/login"
              className="block w-full h-11 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors text-center leading-11"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex bg-background">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[46%] relative flex-col items-center justify-center p-12 overflow-hidden bg-[#0f1117]">
        <div className="absolute top-[-10%] left-[-10%] w-125 h-125 rounded-full bg-blue-700/30 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-100 h-100 rounded-full bg-violet-600/25 blur-[100px] pointer-events-none" />
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.06]"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />
        <div className="relative z-10 flex flex-col items-center text-center gap-8 max-w-xs">
          <EpsLogo className="w-56 select-none" />
          <p className="text-white/60 text-sm leading-relaxed">
            Secure, real-time messaging for your team. Files, calls, and collaboration — all in one place.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {["End-to-end", "File sharing", "Voice calls", "Screen share"].map((f) => (
              <span key={f} className="text-[0.65rem] font-medium px-3 py-1 rounded-full border border-white/10 bg-white/5 text-white/50">
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="flex justify-center mb-8 lg:hidden">
            <EpsLogo className="h-10 select-none" />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">Create an account</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Already have one?{" "}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Sign in
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
              <label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={10}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 10 characters"
                  disabled={loading}
                  className="w-full h-11 px-4 pr-11 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all placeholder:text-muted-foreground/40 disabled:opacity-50"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              {password.length > 0 && (
                <ul className="space-y-0.5 mt-1.5">
                  {PASSWORD_RULES.map((rule) => {
                    const pass = rule.test(password);
                    return (
                      <li key={rule.label} className={`text-[0.65rem] flex items-center gap-1.5 transition-colors ${pass ? "text-emerald-500" : "text-muted-foreground"}`}>
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
              <label htmlFor="confirm" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="confirm"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="········"
                  disabled={loading}
                  className="w-full h-11 px-4 pr-11 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all placeholder:text-muted-foreground/40 disabled:opacity-50"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer select-none group">
              <div className="relative mt-0.5 shrink-0">
                <input
                  type="checkbox"
                  checked={consented}
                  onChange={(e) => setConsented(e.target.checked)}
                  disabled={loading}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                  consented ? "bg-primary border-primary" : "border-border bg-muted/50 group-hover:border-primary/50"
                }`}>
                  {consented && (
                    <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-xs text-muted-foreground leading-relaxed">
                I agree to the{" "}
                <a href="/terms" target="_blank" className="text-primary hover:underline font-medium">Terms of Service</a>
                {" "}and{" "}
                <a href="/privacy" target="_blank" className="text-primary hover:underline font-medium">Privacy Policy</a>
              </span>
            </label>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !consented}
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
                  <span className="relative">Creating account…</span>
                </>
              ) : (
                <span className="relative">Create account</span>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
