/** The calendar's shape while the month is fetched (and Facebook asked about held posts). */
export default function CalendarLoading() {
  const bar = "rounded-full bg-[var(--ct-soft)]";
  return (
    <div role="status" aria-label="กำลังโหลดปฏิทิน" className="space-y-4 motion-safe:animate-pulse">
      <div className={`h-6 w-36 ${bar}`} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-11 w-16 rounded-lg bg-[var(--ct-panel)]" />
          <div className="size-11 rounded-lg bg-[var(--ct-panel)]" />
          <div className={`h-5 w-40 ${bar}`} />
          <div className="size-11 rounded-lg bg-[var(--ct-panel)]" />
        </div>
        <div className="h-12 w-40 rounded-full bg-[var(--ct-panel)]" />
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-[var(--ct-hair)] bg-[var(--ct-hair)]">
        {Array.from({ length: 35 }, (_, i) => (
          <div key={i} className="min-h-12 bg-[var(--ct-panel)] p-1 sm:min-h-24 sm:p-2 lg:min-h-36">
            <div className="size-6 rounded-full bg-[var(--ct-ground)]" />
          </div>
        ))}
      </div>
      <span className="sr-only">กำลังโหลดปฏิทิน…</span>
    </div>
  );
}
