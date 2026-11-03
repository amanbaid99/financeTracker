/** Shown the moment a tab is tapped, while its content loads. */
export function PageSkeleton({
  title,
  rows = 3,
}: {
  title: string;
  rows?: number;
}) {
  return (
    <main className="space-y-5" aria-busy="true">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
      </div>
      {title === "Goals" ? (
        <>
          <div className="h-80 animate-pulse rounded-2xl border bg-card p-4">
            <div className="mb-4 h-4 w-28 rounded bg-muted" />
            <div className="h-20 rounded-xl bg-muted" />
            <div className="mt-4 h-28 rounded-xl bg-muted/60" />
          </div>
          <div className="flex gap-2">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-11 w-24 animate-pulse rounded-full bg-muted"
              />
            ))}
          </div>
        </>
      ) : (
        <div className="h-10 animate-pulse rounded-lg bg-muted" />
      )}
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-2xl border bg-card"
        />
      ))}
      <span className="sr-only" role="status">
        Loading {title}
      </span>
    </main>
  );
}
