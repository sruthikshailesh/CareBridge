import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, runTransaction } from "firebase/firestore";
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
} from "../../components/carebridge-ui";
import { db } from "../../firebase";
import { useAuth } from "../../auth";
import {
  COLLECTIONS,
  linkIdFor,
  type CaregiverLink,
  type ConsentCode,
} from "@diabetes/shared";

export default function CaregiverOnboarding() {
  const { user, completeOnboarding } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!user) return;
    const normalized = code.trim().toUpperCase();
    if (normalized.length !== 6) {
      setError("Consent codes are 6 characters.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const codeRef = doc(db, COLLECTIONS.consentCodes, normalized);
      await runTransaction(db, async (tx) => {
        const codeSnap = await tx.get(codeRef);
        if (!codeSnap.exists()) {
          throw new Error("Invalid consent code. Ask the patient to share their current code.");
        }
        const patientId = (codeSnap.data() as ConsentCode).patientId;
        const linkId = linkIdFor(patientId, user.uid);
        const linkRef = doc(db, COLLECTIONS.caregiverLinks, linkId);
        const existing = await tx.get(linkRef);
        const status = existing.exists()
          ? (existing.data() as CaregiverLink).status
          : null;
        if (status === "pending" || status === "accepted") {
          throw new Error("You already have a link request with this patient.");
        }
        tx.set(linkRef, {
          linkId,
          patientId,
          caregiverId: user.uid,
          status: "pending",
          consentCode: normalized,
          createdAt: Date.now(),
        } satisfies CaregiverLink);
      });
      await completeOnboarding();
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={uiStyles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Caregiver setup</Text>
          <Text style={uiStyles.title}>Link to a patient</Text>
          <Text style={uiStyles.subtitle}>Enter the patient’s current consent code. They stay in control and approve the connection before you can see shared data.</Text>
        </View>

        <Card elevated style={styles.card}>
          <SectionHeader
            title="Consent code"
            eyebrow="Secure request"
            action={<StatusPill label="6 characters" tone="caregiver" />}
          />
          <View style={styles.codePreview}>
            {Array.from({ length: 6 }).map((_, index) => (
              <View key={index} style={[styles.codeSlot, code[index] && styles.codeSlotFilled]}>
                <Text style={styles.codeSlotText}>{code[index]?.toUpperCase() ?? ""}</Text>
              </View>
            ))}
          </View>
          <Field
            label="Enter code"
            placeholder="ABC123"
            autoCapitalize="characters"
            maxLength={6}
            value={code}
            onChangeText={setCode}
            style={styles.hiddenCodeField}
            helper="Ask the patient to generate this from their Care bridge section."
          />
          {error ? <InlineMessage tone="danger">{error}</InlineMessage> : null}
          <AppButton label="Send link request" loading={busy} onPress={onSubmit} />
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: spacing.xl, gap: spacing.xl },
  header: { gap: spacing.sm },
  kicker: {
    color: palette.caregiver,
    fontFamily: type.familyStrong,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  card: { gap: spacing.lg, backgroundColor: "#fff9f0" },
  codePreview: { flexDirection: "row", gap: spacing.sm, justifyContent: "center" },
  codeSlot: {
    width: 42,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  codeSlotFilled: { borderColor: palette.caregiver, backgroundColor: palette.caregiverSoft },
  codeSlotText: { color: palette.caregiver, fontFamily: type.familyStrong, fontSize: 20, fontWeight: "800" },
  hiddenCodeField: { textAlign: "center", letterSpacing: 5, fontFamily: type.familyStrong, fontSize: 22, fontWeight: "800" },
});
