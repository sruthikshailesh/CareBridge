import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../auth";

export default function Index() {
  const { user, profile, loading } = useAuth();

  if (loading || (user && !profile)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.hint}>Loading…</Text>
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;
  if (!profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (!profile.onboardingComplete) {
    return <Redirect href={`/onboarding/${profile.role}`} />;
  }
  return <Redirect href={profile.role === "clinic" ? "/(drawer)/dashboard" : "/(drawer)/today"} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hint: { marginTop: 12, color: "#555" },
});
