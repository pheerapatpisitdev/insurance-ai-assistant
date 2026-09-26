/** The people library's shape while it is fetched: a row per person, then the add form. */
export default function PeopleLoading() {
  const bar = "rounded-full bg-[var(--ct-soft)]";
  return (
    <div role="status" aria-label="กำลังโหลดคลังบุคคล" className="max-w-[1000px] space-y-4 motion-safe:animate-pulse">
      <div className={`h-6 w-32 ${bar}`} />
      <div className={`h-4 w-[32rem] max-w-full ${bar}`} />
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="flex flex-wrap items-center gap-4 rounded-lg border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-3">
          <div className="flex gap-2">
            {Array.from({ length: 3 }, (_, j) => <div key={j} className="size-16 rounded-md bg-[var(--ct-ground)]" />)}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className={`h-4 w-24 ${bar}`} />
            <div className={`h-3 w-40 ${bar}`} />
          </div>
        </div>
      ))}
      <div className="space-y-3 rounded-lg border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4">
        <div className={`h-5 w-24 ${bar}`} />
        <div className="h-11 rounded-lg bg-[var(--ct-ground)]" />
        <div className="h-28 rounded-xl bg-[var(--ct-ground)]" />
      </div>
      <span className="sr-only">กำลังโหลด…</span>
    </div>
  );
}
