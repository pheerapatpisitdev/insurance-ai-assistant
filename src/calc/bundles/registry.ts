import type { Bundle } from "../types";
import legacyFamily from "../../../data/bundles/legacy-family.json";
import ci123 from "../../../data/bundles/ci123.json";

/** Display order for the bundle picker. */
const BUNDLES: Bundle[] = [legacyFamily as Bundle, ci123 as Bundle];

export function listBundles(): { code: string; name: string }[] {
  return BUNDLES.map((b) => ({ code: b.code, name: b.name }));
}

export function getBundle(code: string): Bundle | undefined {
  return BUNDLES.find((b) => b.code === code);
}
