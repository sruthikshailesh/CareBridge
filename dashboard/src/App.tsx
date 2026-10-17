import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Patients from "./pages/Patients";
import PatientDetail from "./pages/PatientDetail";
import type { ReactNode } from "react";

function RequireClinic({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="centered">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.role !== "clinic") {
    return (
      <div className="centered">
        <p>This dashboard is only available to clinic accounts.</p>
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/patients"
        element={
          <RequireClinic>
            <Patients />
          </RequireClinic>
        }
      />
      <Route
        path="/patients/:patientId"
        element={
          <RequireClinic>
            <PatientDetail />
          </RequireClinic>
        }
      />
      <Route path="*" element={<Navigate to="/patients" replace />} />
    </Routes>
  );
}
