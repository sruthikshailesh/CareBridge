import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { Link, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  AppButton,
  Card,
  Field,
  InlineMessage,
  palette,
  spacing,
  type,
  uiStyles,
} from "../components/carebridge-ui";
import { useAuth } from "../auth";
import { friendlyAuthError } from "../lib/errors";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
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
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>CareBridge</Text>
          <Text style={uiStyles.title}>Welcome back</Text>
          <Text style={uiStyles.subtitle}>Sign in to continue tracking, sharing, or reviewing care data.</Text>
        </View>

        <Card elevated style={styles.card}>
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
            placeholder="Your password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {error ? <InlineMessage tone="danger">{error}</InlineMessage> : null}
          <AppButton label="Sign in" loading={busy} onPress={onSubmit} />
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerText}>New here?</Text>
          <Link href="/signup" style={styles.link}>
            Create an account
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: spacing.xl, gap: spacing.xl },
  header: { gap: spacing.sm },
  kicker: {
    color: palette.accentDark,
    fontFamily: type.familyStrong,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  card: { gap: spacing.lg },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.xs },
  footerText: { color: palette.muted, fontFamily: type.family },
  link: { color: palette.accentDark, fontFamily: type.familyStrong, fontWeight: "800" },
});
