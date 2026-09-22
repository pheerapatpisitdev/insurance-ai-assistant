"use client";
import { useId } from "react";

export interface MoneyInputProps {
  value: number | "";
  onChange: (value: number | "") => void;
  placeholder?: string;
  className?: string;
  /** shown under the field */
  hint?: string;
  max?: number;
}

const MAX = 999_999_999_999;

/**
 * An amount field that always shows thousands separators. A number input cannot render
 * commas, so this is a text field that keeps only digits and re-formats as you type.
 */
export function MoneyInput({ value, onChange, placeholder, className, hint, max = MAX }: MoneyInputProps) {
  const id = useId();
  const shown = value === "" ? "" : value.toLocaleString("en-US");

  function handle(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (digits === "") return onChange("");
    onChange(Math.min(Number(digits), max));
  }

  return (
    <>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        className={className}
        value={shown}
        onChange={(e) => handle(e.target.value)}
      />
      {hint && <p className="mt-1 text-xs text-[var(--bot-ink-mute)]">{hint}</p>}
    </>
  );
}
