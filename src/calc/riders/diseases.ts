import dci from "../../../data/riders/dci-diseases.json";

export interface RiderDiseases {
  code: string;
  name: string;
  note: string;
  diseases: string[];
}

/**
 * The illnesses a rider names, taken from the company's own benefit sheet rather than
 * written out here. A customer asking "what does it cover" gets the list the policy carries.
 */
const BY_CODE: Record<string, RiderDiseases> = {
  DCI: dci as RiderDiseases,
};

export function riderDiseases(code: string): RiderDiseases | undefined {
  return BY_CODE[code];
}
