-- What content may spend in a month, set by the owner on /admin/ai rather than in code.
--
-- A slice of monthly_budget_thb, not a second pot: the Messenger bot draws on the same money,
-- so content stops at this ceiling and leaves the rest for answering leads. Null means the
-- built-in default (30 baht, src/lib/content/store.ts).
alter table ins_ai_settings add column if not exists content_budget_thb numeric check (content_budget_thb >= 0);
