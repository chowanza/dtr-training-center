import Image from "next/image";
import Link from "next/link";
import { signUp } from "@/lib/auth-actions";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Check that every field is filled in correctly (password needs at least 8 characters).",
  mismatch: "Passwords don't match.",
  exists: "An account with that email already exists — try signing in instead.",
  signup: "Something went wrong creating your account. Try again.",
};

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { sent, error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <Image src="/dtr-logo.webp" alt="Dream Team Roofing" width={40} height={40} className="rounded-full" />
          <span className="font-[var(--font-display)] font-bold text-[15px] leading-tight">
            <span className="block text-navy">DREAM TEAM</span>
            <span className="block text-copper">ROOFING</span>
          </span>
        </div>

        <div className="border border-rule rounded-xl bg-surface p-6 shadow-sm">
          <h1 className="font-[var(--font-display)] font-bold text-xl tracking-tight mb-1">Create your account</h1>
          <p className="text-ink-2 text-sm mb-6">
            If your company already uses this Training Center, use the same email your admin added you with — you&apos;ll
            be linked to it automatically. Otherwise this creates a brand-new company account and makes you its admin.
          </p>

          {sent ? (
            <div className="border border-patina bg-patina-soft text-patina rounded-lg p-3 text-sm">
              Check your email for a confirmation link — click it to finish setting up your account and sign in.
            </div>
          ) : (
            <>
              {error && (
                <div className="border border-brick bg-brick-soft text-brick rounded-lg p-3 text-sm mb-4">
                  {ERROR_MESSAGES[error] ?? "Something went wrong. Try again."}
                </div>
              )}

              <form action={signUp} className="space-y-3">
                <label className="block text-sm">
                  <span className="block text-ink-2 mb-1">Full name</span>
                  <input
                    name="name"
                    required
                    autoFocus
                    className="w-full border border-rule-2 rounded-lg bg-paper px-3 py-2.5 text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy"
                  />
                </label>
                <label className="block text-sm">
                  <span className="block text-ink-2 mb-1">Email</span>
                  <input
                    type="email"
                    name="email"
                    required
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
                    minLength={8}
                    placeholder="At least 8 characters"
                    className="w-full border border-rule-2 rounded-lg bg-paper px-3 py-2.5 text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy"
                  />
                </label>
                <label className="block text-sm">
                  <span className="block text-ink-2 mb-1">Confirm password</span>
                  <input
                    type="password"
                    name="confirmPassword"
                    required
                    minLength={8}
                    className="w-full border border-rule-2 rounded-lg bg-paper px-3 py-2.5 text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy"
                  />
                </label>
                <label className="block text-sm">
                  <span className="block text-ink-2 mb-1">Company name</span>
                  <input
                    name="orgName"
                    placeholder="Only needed if you're the first person from your company"
                    className="w-full border border-rule-2 rounded-lg bg-paper px-3 py-2.5 text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy"
                  />
                </label>
                <button type="submit" className="btn-primary w-full">
                  Create Account
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-ink-3 mt-5">
          Already have an account?{" "}
          <Link href="/login" className="text-navy hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
