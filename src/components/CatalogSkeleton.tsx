export function CatalogSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="border border-border">
          <div className="aspect-square animate-pulse bg-secondary" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-full animate-pulse bg-secondary" />
            <div className="h-3 w-2/3 animate-pulse bg-secondary" />
            <div className="h-4 w-1/2 animate-pulse bg-secondary" />
          </div>
        </div>
      ))}
    </div>
  );
}
