/**
 * The registrar's list of trades — 1,099 of them, and 180KB.
 *
 * It sits in its own module, apart from the premium tables, and the split is the whole point:
 * imported from `data.ts` it would ride into the main bundle behind the rate tables that
 * every visitor needs, where it is four times their weight and most visits never open the tab
 * that shows it. Nothing outside `BusinessTypeTable` may import this file, and that component
 * is reached through `next/dynamic` so the chunk is fetched the first time the tab is.
 */
import businessTypesJson from "../../../data/group-insurance/business-types.json";

/** One row: its code, its name, and the risk class it falls in. */
export interface BusinessType {
  code: string;
  name: string;
  /** 1 (very low) to 4 — and 4 is not written at all */
  level: number;
  note: string | null;
}

export const businessTypes = businessTypesJson as BusinessType[];
