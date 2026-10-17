import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  AppButton,
  Card,
  Field,
  InlineMessage,
  SectionHeader,
  StatusPill,
  palette,
  spacing,
  type,
  uiStyles,
} from "../components/carebridge-ui";
import { useAuth } from "../auth";
import { friendlyAuthError } from "../lib/errors";
import type { UserRole } from "@diabetes/shared";

const ROLES: { value: UserRole; label: string; blurb: string }[] = [
  { value: "patient", label: "Patient", blurb: "Track glucose, tablets and insulin" },
  { value: "caregiver", label: "Caregiver", blurb: "Follow a loved one's daily log" },
  { value: "clinic", label: "Clinic", blurb: "Monitor enrolled patients" },
];

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("patient");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!displayName.trim()) {
      setError("Please enter your name.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await signUp({ email, password, displayName, role });
      router.replace("/");
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={uiStyles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={uiStyles.screen}>
          <View style={styles.header}>
            <Text style={styles.kicker}>Start with your role</Text>
            <Text style={uiStyles.title}>Create your account</Text>
            <Text style={uiStyles.subtitle}>CareBridge adapts the first screen around how you support diabetes care.</Text>
          </View>

          <Card elevated style={styles.formCard}>
            <Field label="Full name" placeholder="Maya Patel" value={displayName} onChangeText={setDisplayName} />
            <Field
              label="Email"
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Field
              label="Password"
              placeholder="Minimum 6 characters"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </Card>

          <Card style={styles.roleSection}>
            <SectionHeader title="I am a…" eyebrow="Choose your view" />
            <View style={styles.roleGrid}>
              {ROLES.map((r) => (
                <RoleCard key={r.value} role={r} active={role === r.value} onPress={() => setRole(r.value)} />
              ))}
            </View>
          </Card>

          {error ? <InlineMessage tone="danger">{error}</InlineMessage> : null}
          <AppButton label="Continue" loading={busy} onPress={onSubmit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RoleCard({
  role,
  active,
  onPress,
}: {
  role: { value: UserRole; label: string; blurb: string };
  active: boolean;
  onPress: () => void;
}) {
  const tone = role.value === "caregiver" ? "caregiver" : role.value === "clinic" ? "clinic" : "range";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.roleCard, active && styles.roleCardActive, pressed && styles.roleCardPressed]}
    >
      <View style={styles.roleHeading}>
        <Text style={[styles.roleLabel, active && styles.roleLabelActive]}>{role.label}</Text>
        {active ? <StatusPill label="Selected" tone={tone} /> : null}
      </View>
      <Text style={styles.roleBlurb}>{role.blurb}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { gap: spacing.sm },
  kicker: {
    color: palette.accentDark,
    fontFamily: type.familyStrong,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  formCard: { gap: spacing.lg },
  roleSection: { gap: spacing.lg },
  roleGrid: { gap: spacing.md },
  roleCard: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 22,
    backgroundColor: palette.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  roleCardActive: { borderColor: palette.accent, backgroundColor: palette.accentSoft },
  roleCardPressed: { transform: [{ translateY: 1 }], opacity: 0.86 },
  roleHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
  roleLabel: { color: palette.ink, fontFamily: type.familyStrong, fontSize: 19, fontWeight: "800" },
  roleLabelActive: { color: palette.accentDark },
  roleBlurb: { color: palette.muted, fontFamily: type.family, lineHeight: 21 },
});
