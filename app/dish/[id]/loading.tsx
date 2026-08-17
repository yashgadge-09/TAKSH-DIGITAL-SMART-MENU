import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-sm pb-28">
        <Skeleton className="aspect-square w-full rounded-b-3xl" />
        <div className="px-4 mt-6 space-y-3">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-6 w-20" />
        </div>
      </div>
    </main>
  );
}
