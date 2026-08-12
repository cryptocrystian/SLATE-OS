import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading skeleton for the operator app shell (Phase 1 / W4).
 * Renders while a server component in the /app tree is streaming.
 */
export default function AppLoading() {
  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Skeleton className="h-72 w-full xl:col-span-2" />
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}
