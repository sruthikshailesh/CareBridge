import { Redirect } from "expo-router";
import { useAuth } from "../auth";

export default function HomeRedirect() {
  const { profile } = useAuth();
  return <Redirect href={profile?.role === "clinic" ? "/(drawer)/dashboard" : "/(drawer)/today"} />;
}
