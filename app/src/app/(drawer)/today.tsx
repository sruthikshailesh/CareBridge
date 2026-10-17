import { useAuth } from "../../auth";
import { CaregiverTodayScreen, PatientTodayScreen } from "../../components/tab-screens";

export default function TodayRoute() {
  const { profile } = useAuth();
  if (profile?.role === "patient") return <PatientTodayScreen />;
  if (profile?.role === "caregiver") return <CaregiverTodayScreen />;
  return null;
}
