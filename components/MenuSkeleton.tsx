import { Skeleton } from "@/components/ui/skeleton";

export function MenuSkeleton() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-sm pb-28">
        <header className="px-4 pt-5 pb-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="mt-3 h-1.5 w-24" />
          <Skeleton className="mt-3 h-11 w-full rounded-full" />
        </header>

        <div className="mt-3 flex gap-4 overflow-hidden px-4 pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex w-[72px] shrink-0 flex-col items-center gap-1.5">
              <Skeleton className="h-14 w-14 rounded-full" />
              <Skeleton className="h-2.5 w-10" />
            </div>
          ))}
        </div>

        <div className="px-4 mt-6 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl p-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-[88px] w-[88px] shrink-0 rounded-2xl" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
