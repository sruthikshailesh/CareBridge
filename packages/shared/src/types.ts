import type { Timestamp } from "firebase/firestore";

export type UserRole = "patient" | "caregiver" | "clinic";

export interface UserProfile {
  uid: string;
  role: UserRole;
  displayName: string;
  phone?: string;
  onboardingComplete: boolean;
  createdAt: number;
}

export type DiabetesType = "type1" | "type2" | "gestational";

export interface GlucoseThresholds {
  /** mg/dL — alert when glucose is below this */
  low: number;
  /** mg/dL — alert when glucose is above this */
  high: number;
}

export interface Patient {
  /** same as the auth uid */
  patientId: string;
  diabetesType: DiabetesType;
  thresholds: GlucoseThresholds;
  /** YYYY-MM-DD */
  nextScreeningDate?: string;
  clinicianNotes?: string;
  createdAt: number;
  updatedAt: number;
}

export type NudgeTiming = "before" | "after";

export interface MealNudge {
  id: "breakfast" | "lunch" | "dinner";
  mealLabel: string;
  beforeEnabled: boolean;
  beforeMinutesOffset: number;
  /** Local meal-time anchor; the offset determines when the reminder fires. */
  beforeTime: string;
  afterEnabled: boolean;
  afterMinutesOffset: number;
  /** Local meal-time anchor; the offset determines when the reminder fires. */
  afterTime: string;
}

export interface InsulinNudge {
  enabled: boolean;
  mealId: MealNudge["id"];
  minutesBeforeMeal: number;
}

export interface NudgeSettings {
  meals: MealNudge[];
  insulin: InsulinNudge[];
  updatedAt: Timestamp;
}

export type LogKind = "glucose" | "tablet" | "insulin";

export interface LogEntry {
  logId: string;
  patientId: string;
  kind: LogKind;
  /** mg/dL for glucose, tablet count for tablet, units for insulin */
  value: number;
  timestamp: number;
  note?: string;
}

export type LinkStatus = "pending" | "accepted" | "declined" | "revoked";

export interface CaregiverLink {
  /** "<patientId>_<caregiverId>" */
  linkId: string;
  patientId: string;
  caregiverId: string;
  status: LinkStatus;
  /** the code the caregiver used to request the link */
  consentCode: string;
  createdAt: number;
  respondedAt?: number;
}

export interface ConsentCode {
  code: string;
  patientId: string;
  createdAt: number;
}

export type CheckinStatus = "ok" | "missed" | "concern";

export interface Checkin {
  checkinId: string;
  caregiverId: string;
  patientId: string;
  /** YYYY-MM-DD */
  date: string;
  status: CheckinStatus;
  note?: string;
  createdAt: number;
}

export interface Clinic {
  /** same as the auth uid */
  clinicId: string;
  clinicName: string;
  address?: string;
  phone?: string;
  createdAt: number;
}

export const COLLECTIONS = {
  users: "users",
  patients: "patients",
  clinics: "clinics",
  logs: "logs",
  consentCodes: "consentCodes",
  caregiverLinks: "caregiverLinks",
  checkins: "checkins",
} as const;

export function linkIdFor(patientId: string, caregiverId: string): string {
  return `${patientId}_${caregiverId}`;
}
