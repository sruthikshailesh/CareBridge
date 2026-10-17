import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, doc, getDoc, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth";
import { COLLECTIONS, type Patient, type UserProfile } from "@diabetes/shared";

const DIABETES_LABEL: Record<Patient["diabetesType"], string> = {
  type1: "Type 1",
  type2: "Type 2",
  gestational: "Gestational",
};

export default function Patients() {
  const { profile, signOutUser } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const patientsQuery = query(
      collection(db, COLLECTIONS.patients),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(patientsQuery, (snap) => {
      setPatients(snap.docs.map((d) => d.data() as Patient));
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const missing = patients
      .map((p) => p.patientId)
      .filter((id) => !(id in names));
    if (missing.length === 0) return;
    Promise.all(
      missing.map(async (id) => {
        const snap = await getDoc(doc(db, COLLECTIONS.users, id));
        return [id, snap.exists() ? (snap.data() as UserProfile).displayName : id] as const;
      })
    ).then((entries) => {
      if (!cancelled) {
        setNames((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [patients]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Patients</h1>
          <p className="muted">Signed in as {profile?.displayName}</p>
        </div>
        <button className="secondary" onClick={signOutUser}>
          Sign out
        </button>
      </header>

      {patients.length === 0 ? (
        <div className="card empty-state">
          <p>No patients registered yet. Patients appear here once they complete
          onboarding in the mobile app.</p>
        </div>
      ) : (
        <table className="card patient-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Diabetes type</th>
              <th>Alert range (mg/dL)</th>
              <th>Next screening</th>
              <th aria-label="View"></th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr
                key={p.patientId}
                className="clickable"
                onClick={() => navigate(`/patients/${p.patientId}`)}
              >
                <td>{names[p.patientId] ?? "…"}</td>
                <td>{DIABETES_LABEL[p.diabetesType]}</td>
                <td>
                  {p.thresholds.low}–{p.thresholds.high}
                </td>
                <td>{p.nextScreeningDate ?? "—"}</td>
                <td className="muted">→</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted">
        Monthly summaries (time in range, missed tablets, screening status) arrive
        in the next phase.
      </p>
    </div>
  );
}
