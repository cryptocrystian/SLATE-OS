import { Skeleton } from "@/components/ui/skeleton";

/** Loading skeleton for the BuildOS tree. */
export default function BuildLoading() {
  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full" />
        ))}
      </div>
    </div>
  );
}
