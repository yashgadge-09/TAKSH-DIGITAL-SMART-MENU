import { cn } from "@/lib/utils"

export function TakshBrand({
  compact = false,
  className,
  showTagline = true,
  vibrant = false,
}: {
  compact?: boolean
  className?: string
  showTagline?: boolean
  vibrant?: boolean
}) {
  if (compact) {
    return (
      <div
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#8E5A33] bg-[#2C1A10] text-sm font-bold tracking-[0.12em] text-[#E6B779]",
          className
        )}
      >
        T
      </div>
    )
  }

  const titleTone = vibrant
    ? "text-[#F1C78F] [text-shadow:0_4px_18px_rgba(232,101,10,0.35)]"
    : "text-[#D7A267]"
  const taglineTone = vibrant
    ? "text-[#F2CA95] [text-shadow:0_2px_10px_rgba(232,101,10,0.2)]"
    : "text-[#D1A068]"

  return (
    <div className={cn("leading-tight", className)}>
      <p className={cn("font-serif text-[2rem] font-semibold uppercase tracking-[0.28em]", titleTone)}>
        TAKSH
      </p>
      {showTagline ? (
        <div className={cn("mt-1.5 flex items-center gap-2 text-[0.92rem] font-medium uppercase tracking-[0.16em]", taglineTone)}>
          <span className={cn("h-2.5 w-2.5 rounded-full", vibrant ? "bg-[#57CF6E]" : "bg-[#4DB161]")} />
          <span>Pure Veg Restaurant</span>
        </div>
      ) : null}
    </div>
  )
}