import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, setDoc } from "firebase/firestore";
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
  DEFAULT_THRESHOLDS,
  DIABETES_TYPES,
  type DiabetesType,
  type Patient,
} from "@diabetes/shared";

export default function PatientOnboarding() {
  const { user, completeOnboarding } = useAuth();
  const [diabetesType, setDiabetesType] = useState<DiabetesType>("type2");
  const [customThresholds, setCustomThresholds] = useState(false);
  const [low, setLow] = useState("70");
  const [high, setHigh] = useState("180");
  const [screening, setScreening] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!customThresholds) {
      const t = DEFAULT_THRESHOLDS[diabetesType];
      setLow(String(t.low));
      setHigh(String(t.high));
    }
  }, [diabetesType, customThresholds]);

  const onSubmit = async () => {
    if (!user) return;
    const lowNum = Number(low);
    const highNum = Number(high);
    if (!Number.isFinite(lowNum) || !Number.isFinite(highNum) || lowNum >= highNum) {
      setError("Thresholds must be numbers, with low below high.");
      return;
    }
    if (screening.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(screening.trim())) {
      setError("Screening date must be YYYY-MM-DD.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const patient: Patient = {
        patientId: user.uid,
        diabetesType,
        thresholds: { low: lowNum, high: highNum },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      if (screening.trim()) patient.nextScreeningDate = screening.trim();
      await setDoc(doc(db, COLLECTIONS.patients, user.uid), patient);
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
      <ScrollView contentContainerStyle={uiStyles.screen}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Patient setup</Text>
          <Text style={uiStyles.title}>Set up your health profile</Text>
          <Text style={uiStyles.subtitle}>Your type sets starter thresholds and the rhythm of future nudges. You can adjust details as care changes.</Text>
        </View>

        <Card elevated style={styles.cardStack}>
          <SectionHeader title="Diabetes type" eyebrow="Personalize defaults" />
          <View style={styles.typeGrid}>
            {DIABETES_TYPES.map((t) => (
              <TypeCard key={t.value} value={t.value} label={t.label} active={diabetesType === t.value} onPress={() => setDiabetesType(t.value)} />
            ))}
          </View>
        </Card>

        <Card style={styles.cardStack}>
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={styles.cardTitle}>Glucose thresholds</Text>
              <Text style={uiStyles.muted}>CareBridge uses these only for tracking states and alerts.</Text>
            </View>
            <Switch
              value={customThresholds}
              onValueChange={setCustomThresholds}
              trackColor={{ false: palette.surfaceStrong, true: palette.accentSoft }}
              thumbColor={customThresholds ? palette.accent : palette.faint}
            />
          </View>
          <View style={styles.thresholdRow}>
            <Field
              label="Low alert"
              helper="mg/dL"
              keyboardType="number-pad"
              value={low}
              onChangeText={setLow}
              editable={customThresholds}
              style={!customThresholds && styles.lockedField}
            />
            <Field
              label="High alert"
              helper="mg/dL"
              keyboardType="number-pad"
              value={high}
              onChangeText={setHigh}
              editable={customThresholds}
              style={!customThresholds && styles.lockedField}
            />
          </View>
        </Card>

        <Card style={styles.cardStack}>
          <SectionHeader title="Eye screening" eyebrow="Optional tracker" />
          <Field
            label="Next screening date"
            helper="Use YYYY-MM-DD when you already know the planned date."
            placeholder="YYYY-MM-DD"
            value={screening}
            onChangeText={setScreening}
          />
        </Card>

        {error ? <InlineMessage tone="danger">{error}</InlineMessage> : null}
        <AppButton label="Finish" loading={busy} onPress={onSubmit} />
      </ScrollView>
    </SafeAreaView>
  );
}

function TypeCard({ value, label, active, onPress }: { value: DiabetesType; label: string; active: boolean; onPress: () => void }) {
  const detail: Record<DiabetesType, string> = {
    type1: "Closer insulin and glucose rhythm",
    type2: "Daily trend and medication support",
    gestational: "Pregnancy-specific threshold defaults",
  };
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.typeCard, active && styles.typeCardActive, pressed && styles.typeCardPressed]}
    >
      <View style={styles.typeHeading}>
        <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>{label}</Text>
        {active ? <StatusPill label="Selected" tone="range" /> : null}
      </View>
      <Text style={styles.typeDetail}>{detail[value]}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  kicker: {
    color: palette.accentDark,
    fontFamily: type.familyStrong,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  cardStack: { gap: spacing.lg },
  typeGrid: { gap: spacing.md },
  typeCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  typeCardActive: { borderColor: palette.accent, backgroundColor: palette.accentSoft },
  typeCardPressed: { transform: [{ translateY: 1 }], opacity: 0.86 },
  typeHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  typeLabel: { color: palette.ink, fontFamily: type.familyStrong, fontSize: 18, fontWeight: "800" },
  typeLabelActive: { color: palette.accentDark },
  typeDetail: { color: palette.muted, fontFamily: type.family, lineHeight: 20 },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.lg },
  switchCopy: { flex: 1, gap: spacing.xs },
  cardTitle: { color: palette.ink, fontFamily: type.familyStrong, fontSize: 20, fontWeight: "800", letterSpacing: -0.2 },
  thresholdRow: { flexDirection: "row", gap: spacing.md },
  lockedField: { backgroundColor: palette.surfaceStrong, color: palette.muted },
});
