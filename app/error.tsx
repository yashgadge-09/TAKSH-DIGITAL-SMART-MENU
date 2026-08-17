"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[color:var(--brand-bg-deep)] px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10">
        <span className="text-3xl">😕</span>
      </div>
      <div className="space-y-2">
        <h1 className="font-serif text-2xl font-semibold text-[color:var(--brand-gold)]">
          Something went wrong
        </h1>
        <p className="max-w-xs text-sm text-[color:var(--brand-gold-soft)]/70">
          Please try again, or ask your server for assistance.
        </p>
      </div>
      <button
        onClick={reset}
        className="rounded-full border border-[color:var(--brand-gold)] px-5 py-2 text-sm font-semibold text-[color:var(--brand-gold)] transition hover:bg-[color:var(--brand-gold)] hover:text-[color:var(--brand-bg-deep)]"
      >
        Try again
      </button>
    </main>
  );
}
