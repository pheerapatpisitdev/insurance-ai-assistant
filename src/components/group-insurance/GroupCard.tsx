"use client";
import { bizTypesFor, BIZ_LABEL_KEYS, PLAN_COUNT, type Product } from "@/lib/group-insurance/data";
import type { GroupInput, GroupQuote } from "@/lib/group-insurance/quote";
import { riderLevelLabel } from "@/lib/group-insurance/sheet";
import type { Key } from "@/lib/group-insurance/translations";
import { Icon } from "./Icon";
import { useLang } from "./lang";

/**
 * One group of employees: who they are, what they take, and what they cost.
 *
 * The count is held as a string rather than a number, and deliberately. An agent correcting
 * "10" to "25" passes through the empty field, and a numeric state would have had to decide
 * what an empty field means — most answers turn a backspace into a 0 that then has to be
 * deleted too. The string is what was typed; the quote reads `Number(count) || 0` off it and
 * the page says the group is too small until it is not.
 *
 * The rider levels above the plan are disabled rather than hidden. The insurer's rule is
 * that a rider may exceed its plan by one step and no more; hiding the rest would leave an
 * agent wondering whether ME 1,000,000 exists at all, where a greyed button says it exists
 * and this plan cannot have it.
 */
export function GroupCard({
  product, index, group, quote, removable, onChange, onRemove,
}: {
  product: Product;
  index: number;
  group: GroupInput;
  quote: GroupQuote;
  removable: boolean;
  onChange: (patch: Partial<GroupInput>) => void;
  onRemove: () => void;
}) {
  const { t, fmt } = useLang();
  const isPa = product === "pa";
  const bizTypes = bizTypesFor(product);
  const bizLabels = BIZ_LABEL_KEYS[product];
  const levels = Array.from({ length: PLAN_COUNT }, (_, i) => i);

  return (
    <section className="rounded-lg border border-[var(--gi-line)] bg-[var(--gi-panel)] p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ background: "var(--gi-gold-deep)" }}
          >
            {index + 1}
          </span>
          <input
            type="text"
            aria-label={`${t("groupNo")} ${index + 1} — ${t("groupNamePlaceholder")}`}
            value={group.name}
            placeholder={t("groupNamePlaceholder")}
            onChange={(e) => onChange({ name: e.target.value })}
            className="w-full max-w-xs rounded-lg border border-[var(--gi-line)] bg-[var(--gi-sunken)] px-3 py-2 text-sm text-[var(--gi-ink)]"
          />
        </div>
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--gi-lv4-ink)] hover:bg-[var(--gi-lv4-bg)]"
          >
            <Icon name="trash" className="h-4 w-4" />
            {t("removeGroup")}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor={`gi-biz-${group.id}`} className="mb-1.5 block text-sm font-medium text-[var(--gi-ink-soft)]">
            {t("bizType")}
          </label>
          <select
            id={`gi-biz-${group.id}`}
            value={group.bizType}
            onChange={(e) => onChange({ bizType: e.target.value as GroupInput["bizType"] })}
            className="w-full cursor-pointer rounded-lg border border-[var(--gi-line-strong)] py-2.5 pl-4 text-[var(--gi-ink)]"
          >
            {bizTypes.map((b) => (
              <option key={b.value} value={b.value}>
                {t(bizLabels[b.value] as Key)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`gi-count-${group.id}`} className="mb-1.5 block text-sm font-medium text-[var(--gi-ink-soft)]">
            {t("employeeCountShort")} ({t("people")})
          </label>
          <input
            id={`gi-count-${group.id}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={group.count}
            // digits only: a pasted "25 คน" would otherwise price the group at nothing
            onChange={(e) => onChange({ count: e.target.value.replace(/\D/g, "") })}
            className="w-full rounded-lg border border-[var(--gi-line-strong)] bg-[var(--gi-sunken)] px-4 py-2.5 text-[var(--gi-ink)]"
          />
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-medium text-[var(--gi-ink-soft)]">
          {isPa ? t("mainPlan") : t("ipdPlan")}
        </legend>
        <div className="grid grid-cols-6 gap-2">
          {levels.map((idx) => {
            const active = group.planIdx === idx;
            return (
              <button
                key={idx}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ planIdx: idx })}
                className={`rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-transparent text-white shadow-sm"
                    : "border-[var(--gi-line-strong)] bg-[var(--gi-panel)] text-[var(--gi-ink-soft)]"
                }`}
                style={active ? { background: "var(--gi-gold-deep)" } : undefined}
              >
                {isPa ? `P${idx + 1}` : idx + 1}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4">
        {/* The rider's name is the checkbox's own label rather than a heading beside it: a
            heading would leave the box unlabelled, and "แผน OPD" is exactly what ticking it
            buys. */}
        <label className="mb-2 flex cursor-pointer items-center gap-2.5 text-sm font-medium text-[var(--gi-ink-soft)]">
          <input
            type="checkbox"
            checked={group.includeRider}
            onChange={(e) => onChange({ includeRider: e.target.checked })}
            className="h-5 w-5 accent-[var(--gi-teal-deep)]"
          />
          {isPa ? t("mePlan") : t("opdPlan")}
        </label>
        {group.includeRider && (
          <div role="group" aria-label={isPa ? t("mePlan") : t("opdPlan")} className="grid grid-cols-6 gap-2">
            {levels.map((idx) => {
              // the insurer lets a rider run one step ahead of its plan, and no further
              const disabled = idx > group.planIdx + 1;
              const active = group.riderIdx === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={disabled}
                  aria-pressed={active && !disabled}
                  onClick={() => onChange({ riderIdx: idx })}
                  className={`rounded-xl border px-1 py-2.5 text-xs font-medium transition-colors ${
                    active && !disabled
                      ? "border-transparent text-white shadow-sm"
                      : "border-[var(--gi-line-strong)] bg-[var(--gi-panel)] text-[var(--gi-ink-soft)]"
                  }`}
                  style={active && !disabled ? { background: "var(--gi-teal-deep)" } : undefined}
                >
                  {riderLevelLabel(product, t, idx)}
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-2 text-xs text-[var(--gi-mute)]">{isPa ? t("meMaxOne") : t("opdMaxOne")}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--gi-line)] pt-4 text-sm">
        <span className="text-[var(--gi-mute)]">
          {t("totalPerPerson")}:{" "}
          <span className="tabular font-bold text-[var(--gi-ink)]">{fmt(quote.perPerson)}</span> {t("baht")}
        </span>
        <span className="font-semibold" style={{ color: "var(--gi-navy)" }}>
          {t("groupSubtotal")}: <span className="tabular font-bold">{fmt(quote.subtotal)}</span> {t("baht")}
        </span>
      </div>
    </section>
  );
}
