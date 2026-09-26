/** The formula library's shape while it is fetched: a search box, the category chips, a list. */
export default function HooksLoading() {
  const bar = "rounded-full bg-[var(--ct-soft)]";
  return (
    <div role="status" aria-label="กำลังโหลดคลังสูตร" className="max-w-3xl motion-safe:animate-pulse">
      <div className={`h-6 w-52 ${bar}`} />
      <div className={`mt-3 h-4 w-96 max-w-full ${bar}`} />
      <div className="mt-5 h-11 rounded-lg border border-[var(--ct-hair)] bg-[var(--ct-panel)]" />
      <div className="mt-4 flex flex-wrap gap-2">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-11 w-24 rounded-full border border-[var(--ct-hair)] bg-[var(--ct-panel)]" />)}
      </div>
      <div className="mt-4 divide-y divide-[var(--ct-hair)] rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)]">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className={`h-4 w-11/12 ${bar}`} />
              <div className={`h-3 w-1/2 ${bar}`} />
            </div>
            <div className="h-11 w-20 shrink-0 rounded-lg bg-[var(--ct-ground)]" />
          </div>
        ))}
      </div>
      <span className="sr-only">กำลังโหลด…</span>
    </div>
  );
}
