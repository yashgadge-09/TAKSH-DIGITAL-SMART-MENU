"use client";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const sizeClasses = { sm: "size-4", md: "size-6", lg: "size-10" } as const;

export function BrandSpinner({
  size = "md",
  label,
  className,
}: {
  size?: keyof typeof sizeClasses;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <Spinner className={cn(sizeClasses[size], "text-[color:var(--brand-gold)]")} />
      {label && <p className="text-[13px] text-[color:var(--brand-gold-muted)]">{label}</p>}
    </div>
  );
}

export function FullScreenLoader({
  label,
  variant = "guest",
}: {
  label?: string;
  variant?: "guest" | "admin";
}) {
  return (
    <div
      className={cn(
        "flex min-h-screen w-full flex-col items-center justify-center",
        variant === "guest" ? "bg-[color:var(--brand-bg)]" : "bg-[#FFF8EE]"
      )}
    >
      <BrandSpinner size="lg" label={label ?? "Loading…"} />
    </div>
  );
}

/**
 * Dims stale content in place while it's being replaced — so a filter/range
 * change never silently leaves old data on screen looking current.
 */
export function PendingOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center rounded-[inherit] bg-black/40 backdrop-blur-[1px]">
      <BrandSpinner size="md" />
    </div>
  );
}
