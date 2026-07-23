// components/Skeleton.tsx
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      {Array.from({ length: 2 }).map((_, section) => (
        <div key={section}>
          <div className="h-3 w-24 bg-linen rounded animate-pulse mb-2 ml-1" />
          <div className="rounded-lg bg-white shadow-sm divide-y divide-cardBorder overflow-hidden">
            {Array.from({ length: rows }).map((_, row) => (
              <div key={row} className="flex items-center gap-3 px-3 py-3">
                <div className="h-4 flex-1 bg-linen rounded animate-pulse" />
                <div className="h-4 w-12 bg-linen rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
