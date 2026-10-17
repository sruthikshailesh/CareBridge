import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
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
import { COLLECTIONS, type Clinic } from "@diabetes/shared";

export default function ClinicOnboarding() {
  const { user, completeOnboarding } = useAuth();
  const [clinicName, setClinicName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!user) return;
    if (!clinicName.trim()) {
      setError("Please enter the clinic name.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const clinic: Clinic = {
        clinicId: user.uid,
        clinicName: clinicName.trim(),
        createdAt: Date.now(),
      };
      if (address.trim()) clinic.address = address.trim();
      if (phone.trim()) clinic.phone = phone.trim();
      await setDoc(doc(db, COLLECTIONS.clinics, user.uid), clinic);
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
          <Text style={styles.kicker}>Clinic setup</Text>
          <Text style={uiStyles.title}>Register your clinic</Text>
          <Text style={uiStyles.subtitle}>A lean admin profile for dashboard access. Patient operations continue on the web dashboard.</Text>
        </View>

        <Card elevated style={styles.card}>
          <SectionHeader
            title="Clinic profile"
            eyebrow="Required for dashboard"
            action={<StatusPill label="Admin" tone="clinic" />}
          />
          <Field label="Clinic name" placeholder="Northside Endocrine Clinic" value={clinicName} onChangeText={setClinicName} />
          <Field label="Address" helper="Optional" placeholder="Street, city, state" value={address} onChangeText={setAddress} />
          <Field label="Phone" helper="Optional" placeholder="Clinic phone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        </Card>

        {error ? <InlineMessage tone="danger">{error}</InlineMessage> : null}
        <AppButton label="Finish" loading={busy} onPress={onSubmit} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  kicker: {
    color: palette.clinic,
    fontFamily: type.familyStrong,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  card: { gap: spacing.lg, backgroundColor: "#f7fbfd" },
});
