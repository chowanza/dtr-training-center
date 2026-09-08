import Image from "next/image";
import Link from "next/link";
import { signInWithPassword } from "@/lib/auth-actions";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Incorrect email or password.",
  unconfirmed: "Confirm your email first — check your inbox for the link we sent.",
  auth: "That link didn't work. Try signing in again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <Image src="/dtr-logo.webp" alt="Dream Team Roofing" width={40} height={40} className="rounded-full" />
          <span className="font-[var(--font-display)] font-bold text-[15px] leading-tight">
            <span className="block text-navy">DREAM TEAM</span>
            <span className="block text-copper">ROOFING</span>
          </span>
        </div>

        <div className="border border-rule rounded-xl bg-surface p-6 shadow-sm">
          <h1 className="font-[var(--font-display)] font-bold text-xl tracking-tight mb-1">Training Center</h1>
          <p className="text-ink-2 text-sm mb-6">Sign in with your email and password.</p>

          {error && (
            <div className="border border-brick bg-brick-soft text-brick rounded-lg p-3 text-sm mb-4">
              {ERROR_MESSAGES[error] ?? "Something went wrong. Try again."}
            </div>
          )}

          <form action={signInWithPassword} className="space-y-3">
            <label className="block text-sm">
              <span className="block text-ink-2 mb-1">Email</span>
              <input
                type="email"
                name="email"
                required
                autoFocus
                placeholder="you@dreamteamroofingfl.com"
                className="w-full border border-rule-2 rounded-lg bg-paper px-3 py-2.5 text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy"
              />
            </label>
            <label className="block text-sm">
              <span className="block text-ink-2 mb-1">Password</span>
              <input
                type="password"
                name="password"
                required
                placeholder="••••••••"
                className="w-full border border-rule-2 rounded-lg bg-paper px-3 py-2.5 text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy"
              />
            </label>
            <button type="submit" className="btn-primary w-full">
              Sign In
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-ink-3 mt-5">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-navy hover:underline font-medium">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
