import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  COLLECTIONS,
  dateKey,
  type LogEntry,
  type Patient,
  type UserProfile,
} from "@diabetes/shared";

const DAY_MS = 86_400_000;
const PERIODS = [7, 14, 30, 90] as const;

const DIABETES_LABEL: Record<Patient["diabetesType"], string> = {
  type1: "Type 1",
  type2: "Type 2",
  gestational: "Gestational",
};

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type ScreeningPill = "overdue" | "soon" | "ok" | "none";

function screeningInfo(next?: string): {
  label: string;
  pill: ScreeningPill;
  detail: string;
} {
  if (!next) {
    return { label: "Not scheduled", pill: "none", detail: "No upcoming date in profile" };
  }
  const target = new Date(`${next}T12:00:00`).getTime();
  const days = Math.round((target - Date.now()) / DAY_MS);
  if (next < dateKey(Date.now())) {
    return { label: "Overdue", pill: "overdue", detail: `Was due ${next} (${Math.abs(days)}d ago)` };
  }
  if (days <= 14) {
    return { label: "Due soon", pill: "soon", detail: `Scheduled ${next} (in ${days}d)` };
  }
  return { label: "On track", pill: "ok", detail: `Scheduled ${next} (in ${days}d)` };
}

export default function PatientDetail() {
  const { patientId } = useParams<{ patientId: string }>();
  const [patient, setPatient] = useState<Patient | null | undefined>(undefined);
  const [name, setName] = useState("…");
  const [period, setPeriod] = useState<number>(30);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (!patientId) return;
    return onSnapshot(doc(db, COLLECTIONS.patients, patientId), (snap) => {
      setPatient(snap.exists() ? (snap.data() as Patient) : null);
    });
  }, [patientId]);

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    getDoc(doc(db, COLLECTIONS.users, patientId)).then((snap) => {
      if (!cancelled && snap.exists()) {
        setName((snap.data() as UserProfile).displayName);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const startTs = useMemo(() => Date.now() - period * DAY_MS, [period]);

  useEffect(() => {
    if (!patientId) return;
    const logsQuery = query(
      collection(db, COLLECTIONS.logs),
      where("patientId", "==", patientId),
      where("timestamp", ">=", startTs),
      orderBy("timestamp", "desc")
    );
    return onSnapshot(logsQuery, (snap) => {
      setLogs(snap.docs.map((d) => d.data() as LogEntry));
    });
  }, [patientId, startTs]);

  const stats = useMemo(() => {
    if (!patient) return null;
    const { low, high } = patient.thresholds;
    const glucose = logs.filter((l) => l.kind === "glucose");
    const lows = glucose.filter((l) => l.value < low).length;
    const highs = glucose.filter((l) => l.value > high).length;
    const inRange = glucose.length - lows - highs;
    const tabletDays = new Set(
      logs.filter((l) => l.kind === "tablet").map((l) => dateKey(l.timestamp))
    ).size;
    const daysElapsed = Math.min(period, Math.floor((Date.now() - startTs) / DAY_MS) + 1);
    return {
      glucoseCount: glucose.length,
      lows,
      highs,
      tir: glucose.length ? Math.round((inRange / glucose.length) * 100) : null,
      latest: glucose[0] ?? null,
      tabletDays,
      missedTabletDays: Math.max(0, daysElapsed - tabletDays),
      daysElapsed,
    };
  }, [logs, patient, period, startTs]);

  if (patient === undefined) return <div className="centered">Loading…</div>;

  if (patient === null) {
    return (
      <div className="page">
        <Link className="back-link" to="/patients">
          ← Patients
        </Link>
        <div className="card empty-state">
          <p>Patient not found.</p>
        </div>
      </div>
    );
  }

  const screening = screeningInfo(patient.nextScreeningDate);

  return (
    <div className="page">
      <Link className="back-link" to="/patients">
        ← Patients
      </Link>

      <div className="card padded detail-header">
        <div>
          <h1>{name}</h1>
          <p className="muted">
            {DIABETES_LABEL[patient.diabetesType]} · Alert range {patient.thresholds.low}–
            {patient.thresholds.high} mg/dL
          </p>
        </div>
        <div className="segmented" role="group" aria-label="Period">
          {PERIODS.map((days) => (
            <button
              key={days}
              className={days === period ? "" : "secondary"}
              onClick={() => setPeriod(days)}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      {stats && (
        <div className="stat-grid">
          <div className="card stat">
            <span className="stat-label">Latest glucose</span>
            {stats.latest ? (
              <>
                <span
                  className={`stat-value ${
                    stats.latest.value < patient.thresholds.low
                      ? "tone-low"
                      : stats.latest.value > patient.thresholds.high
                        ? "tone-high"
                        : "tone-range"
                  }`}
                >
                  {stats.latest.value}
                </span>
                <span className="stat-detail">{formatDateTime(stats.latest.timestamp)}</span>
              </>
            ) : (
              <span className="stat-value">—</span>
            )}
          </div>

          <div className="card stat">
            <span className="stat-label">Time in range</span>
            <span className={`stat-value ${stats.tir === null ? "" : "tone-range"}`}>
              {stats.tir === null ? "—" : `${stats.tir}%`}
            </span>
            <span className="stat-detail">of {stats.glucoseCount} glucose logs</span>
          </div>

          <div className="card stat">
            <span className="stat-label">Highs</span>
            <span className={`stat-value ${stats.highs > 0 ? "tone-high" : ""}`}>
              {stats.highs}
            </span>
            <span className="stat-detail">&gt; {patient.thresholds.high} mg/dL</span>
          </div>

          <div className="card stat">
            <span className="stat-label">Lows</span>
            <span className={`stat-value ${stats.lows > 0 ? "tone-low" : ""}`}>
              {stats.lows}
            </span>
            <span className="stat-detail">&lt; {patient.thresholds.low} mg/dL</span>
          </div>

          <div className="card stat">
            <span className="stat-label">Tablet days</span>
            <span className="stat-value">
              {stats.tabletDays}
              <span className="stat-detail"> / {stats.daysElapsed} days</span>
            </span>
            <span className="stat-detail">days with a tablet log</span>
          </div>

          <div className="card stat">
            <span className="stat-label">Missed tablets</span>
            <span className={`stat-value ${stats.missedTabletDays > 0 ? "tone-high" : ""}`}>
              {stats.missedTabletDays}
            </span>
            <span className="stat-detail">days with no tablet log</span>
          </div>
        </div>
      )}

      <div className="card padded">
        <h2 className="card-title">Eye screening</h2>
        <div className="kv">
          <span>Status</span>
          <span className={`pill ${screening.pill}`}>{screening.label}</span>
        </div>
        <div className="kv">
          <span>Next screening</span>
          <span>{screening.detail}</span>
        </div>
      </div>

      <p className="muted">
        {logs.length} log{logs.length === 1 ? "" : "s"} in the last {period} days.
      </p>
    </div>
  );
}
