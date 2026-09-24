"use client";
import { POSTER_THEMES } from "@/lib/card-theme";
import { THEMES, THEME_LABEL, type Theme } from "@/lib/content/poster";

/**
 * The poster's colour themes as swatches to press rather than names to read: twenty names
 * say little, twenty little posters say it all. Each is drawn in the theme's own ground and
 * headline colour, so what is chosen here is what the poster will look like.
 */
export function ThemeSwatches({ value, onChange }: { value: Theme; onChange: (t: Theme) => void }) {
  return (
    <div>
      <div role="radiogroup" aria-label="โทนสีโปสเตอร์" className="grid grid-cols-5 gap-2">
        {THEMES.map((t) => {
          const c = POSTER_THEMES[t];
          const on = value === t;
          return (
            <button
              key={t} type="button" role="radio" aria-checked={on} aria-label={THEME_LABEL[t]} title={THEME_LABEL[t]}
              onClick={() => onChange(t)}
              className={`flex aspect-square items-center justify-center rounded-md text-sm font-semibold ${on ? "ring-2 ring-[var(--ct-solid)] ring-offset-2" : "ring-1 ring-black/10"}`}
              style={{ background: `linear-gradient(160deg, ${c.from}, ${c.to})`, color: c.headline }}
            >
              ก
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-[var(--ct-mute)]">เลือกอยู่: {THEME_LABEL[value]}</p>
    </div>
  );
}
