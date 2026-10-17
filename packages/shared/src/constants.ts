import type { DiabetesType, GlucoseThresholds } from "./types";

export const DIABETES_TYPES: { value: DiabetesType; label: string }[] = [
  { value: "type1", label: "Type 1" },
  { value: "type2", label: "Type 2" },
  { value: "gestational", label: "Gestational" },
];

export const DEFAULT_THRESHOLDS: Record<DiabetesType, GlucoseThresholds> = {
  type1: { low: 70, high: 180 },
  type2: { low: 70, high: 180 },
  gestational: { low: 60, high: 120 },
};

export const CONSENT_CODE_LENGTH = 6;

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateConsentCode(rand: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < CONSENT_CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  }
  return code;
}

/** Local-timezone YYYY-MM-DD for a timestamp. */
export function dateKey(ts: number): string {
  const d = new Date(ts);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
