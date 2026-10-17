import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import Animated, {
  cancelAnimation,
  Extrapolation,
  FadeInUp,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import {
  collection,
  deleteField,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  AppButton,
  Card,
  CountUpMetricTile,
  EmptyState,
  Field,
  InlineMessage,
  MetricTile,
  SectionHeader,
  StatusPill,
  palette,
  spacing,
  type,
  uiStyles,
} from "./carebridge-ui";
import { db } from "../firebase";
import { useAuth } from "../auth";
import { computeStreak } from "../lib/streak";
import { useDisplayName } from "../lib/names";
import {
  COLLECTIONS,
  dateKey,
  generateConsentCode,
  type CaregiverLink,
  type Checkin,
  type CheckinStatus,
  type LogEntry,
  type LogKind,
  type MealNudge,
  type NudgeTiming,
  type NudgeSettings,
  type Patient,
} from "@diabetes/shared";
import {
  defaultNudgeSettings,
  formatNudgeTime,
  getNextNudgeSummaries,
  requestNudgePermission,
  shiftTime,
  syncNudgeNotifications,
} from "../lib/nudges";

interface PatientData {
  patient: Patient | null;
  logs: LogEntry[];
  todayCounts: { glucose: number; tablet: number; insulin: number };
  glucoseLogs: LogEntry[];
  latestGlucose: LogEntry | null;
  latestTone: ReturnType<typeof glucoseTone>;
  streak: number;
  accepted: CaregiverLink[];
  pending: CaregiverLink[];
  code: string | null;
  generating: boolean;
  message: string | null;
  nudgeSettings: NudgeSettings | null;
  nudgeError: string | null;
  setMessage: (message: string | null) => void;
  generateCode: () => Promise<void>;
  respondToLink: (link: CaregiverLink, status: "accepted" | "declined") => Promise<void>;
}

const PatientDataContext = createContext<PatientData | null>(null);

export function PatientDataProvider({ patientId, children }: { patientId: string; children: ReactNode }) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [links, setLinks] = useState<CaregiverLink[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [storedNudgeSettings, setStoredNudgeSettings] = useState<NudgeSettings | null>(null);
  const [nudgeError, setNudgeError] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(doc(db, COLLECTIONS.patients, patientId), (snap) => {
      setPatient(snap.exists() ? (snap.data() as Patient) : null);
    });
  }, [patientId]);

  useEffect(() => {
    return onSnapshot(
      doc(db, COLLECTIONS.patients, patientId, "settings", "nudges"),
      (snap) => {
        setStoredNudgeSettings(snap.exists() ? (snap.data() as NudgeSettings) : null);
        setNudgeError(null);
      },
      () => setNudgeError("Your reminder settings aren’t available right now.")
    );
  }, [patientId]);

  useEffect(() => {
    const recentQuery = query(
      collection(db, COLLECTIONS.logs),
      where("patientId", "==", patientId),
      orderBy("timestamp", "desc"),
      limit(200)
    );
    return onSnapshot(recentQuery, (snap) => {
      setLogs(snap.docs.map((d) => d.data() as LogEntry));
    });
  }, [patientId]);

  useEffect(() => {
    const linksQuery = query(
      collection(db, COLLECTIONS.caregiverLinks),
      where("patientId", "==", patientId),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(linksQuery, (snap) => {
      setLinks(snap.docs.map((d) => d.data() as CaregiverLink));
    });
  }, [patientId]);

  const todayCounts = useMemo(() => {
    const counts = { glucose: 0, tablet: 0, insulin: 0 };
    const start = startOfToday();
    logs.forEach((log) => {
      if (log.timestamp >= start) counts[log.kind] += 1;
    });
    return counts;
  }, [logs]);

  const glucoseLogs = useMemo(() => logs.filter((log) => log.kind === "glucose"), [logs]);
  const latestGlucose = glucoseLogs[0] ?? null;
  const latestTone = glucoseTone(latestGlucose?.value ?? null, patient);
  const streak = useMemo(() => computeStreak(logs.map((log) => log.timestamp)), [logs]);
  const pending = links.filter((link) => link.status === "pending");
  const accepted = links.filter((link) => link.status === "accepted");
  const nudgeSettings = useMemo(
    () => storedNudgeSettings ?? (patient ? defaultNudgeSettings(patient.diabetesType) : null),
    [patient?.diabetesType, storedNudgeSettings]
  );

  const generateCode = async () => {
    setGenerating(true);
    setMessage(null);
    try {
      const newCode = generateConsentCode();
      await setDoc(doc(db, COLLECTIONS.consentCodes, newCode), {
        code: newCode,
        patientId,
        createdAt: Date.now(),
      });
      setCode(newCode);
    } catch {
      setMessage("We couldn’t create a consent code. Check your connection and try again.");
    } finally {
      setGenerating(false);
    }
  };

  const respondToLink = async (link: CaregiverLink, status: "accepted" | "declined") => {
    try {
      await updateDoc(doc(db, COLLECTIONS.caregiverLinks, link.linkId), {
        status,
        respondedAt: Date.now(),
      });
    } catch {
      setMessage("We couldn’t update that caregiver request. Please try again.");
    }
  };

  const value: PatientData = {
    patient,
    logs,
    todayCounts,
    glucoseLogs,
    latestGlucose,
    latestTone,
    streak,
    accepted,
    pending,
    code,
    generating,
    message,
    nudgeSettings,
    nudgeError,
    setMessage,
    generateCode,
    respondToLink,
  };

  return <PatientDataContext.Provider value={value}>{children}</PatientDataContext.Provider>;
}

function usePatientData(): PatientData {
  const data = useContext(PatientDataContext);
  if (!data) throw new Error("Patient screens must be inside PatientDataProvider");
  return data;
}

interface CaregiverData {
  accepted: CaregiverLink[];
  pending: CaregiverLink[];
  other: CaregiverLink[];
}

const CaregiverDataContext = createContext<CaregiverData | null>(null);

export function CaregiverDataProvider({ caregiverId, children }: { caregiverId: string; children: ReactNode }) {
  const [links, setLinks] = useState<CaregiverLink[]>([]);

  useEffect(() => {
    const linksQuery = query(
      collection(db, COLLECTIONS.caregiverLinks),
      where("caregiverId", "==", caregiverId),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(linksQuery, (snap) => {
      setLinks(snap.docs.map((d) => d.data() as CaregiverLink));
    });
  }, [caregiverId]);

  const value = {
    accepted: links.filter((link) => link.status === "accepted"),
    pending: links.filter((link) => link.status === "pending"),
    other: links.filter((link) => link.status !== "accepted" && link.status !== "pending"),
  };
  return <CaregiverDataContext.Provider value={value}>{children}</CaregiverDataContext.Provider>;
}

function useCaregiverData(): CaregiverData {
  const data = useContext(CaregiverDataContext);
  if (!data) throw new Error("Caregiver screens must be inside CaregiverDataProvider");
  return data;
}

function ScreenFrame({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  if (!profile) return null;
  const roleTone = profile.role === "patient" ? "range" : profile.role === "caregiver" ? "caregiver" : "clinic";

  return (
    <SafeAreaView style={[uiStyles.safe, styles.screenFrame]}>
      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={[uiStyles.screen, styles.screenContent]}
      >
        <View style={styles.topBar}>
          <View style={styles.titleBlock}>
            <Text style={styles.kicker}>CareBridge</Text>
            <Text style={uiStyles.title}>Hi, {profile.displayName}</Text>
          </View>
          <View style={styles.headerActions}>
            <StatusPill label={profile.role} tone={roleTone} />
          </View>
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function SettingsScreen() {
  const { profile } = useAuth();
  return (
    <ScreenFrame>
      <Card style={styles.settingsCard}>
        <SectionHeader title="Your account" eyebrow="Settings" />
        <View style={styles.settingsRow}>
          <Text style={styles.settingsLabel}>Name</Text>
          <Text style={styles.settingsValue}>{profile?.displayName ?? ""}</Text>
        </View>
        <View style={styles.settingsRow}>
          <Text style={styles.settingsLabel}>Role</Text>
          <Text style={styles.settingsValue}>{profile?.role ?? ""}</Text>
        </View>
      </Card>
    </ScreenFrame>
  );
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatElapsed(timestamp?: number): string {
  if (!timestamp) return "No readings yet";
  const minutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function glucoseTone(value: number | null, patient: Patient | null): "low" | "range" | "high" | "neutral" {
  if (value === null || !patient) return "neutral";
  if (value < patient.thresholds.low) return "low";
  if (value > patient.thresholds.high) return "high";
  return "range";
}

function glucoseLabel(tone: ReturnType<typeof glucoseTone>): string {
  if (tone === "low") return "Below range";
  if (tone === "high") return "Above range";
  if (tone === "range") return "In range";
  return "Awaiting first log";
}

export function PatientTodayScreen() {
  const { profile } = useAuth();
  const { patient, todayCounts, glucoseLogs, latestGlucose, latestTone, streak, accepted, message, setMessage, nudgeSettings, nudgeError } = usePatientData();
  const [logOpen, setLogOpen] = useState(false);
  const heroScale = useSharedValue(1);
  const heroAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heroScale.value }],
  }));

  useEffect(() => {
    if (!latestGlucose) return;
    heroScale.value = withSequence(
      withSpring(1.045, { duration: 170 }),
      withSpring(1, { duration: 220 })
    );
  }, [heroScale, latestGlucose?.logId, latestGlucose?.timestamp, latestGlucose?.value]);

  if (!profile) return null;

  return (
    <ScreenFrame>
      <View style={styles.stack}>
        {message ? <InlineMessage tone="danger">{message}</InlineMessage> : null}
        <Animated.View entering={FadeInUp.delay(0).duration(360)}>
          <Card elevated style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <StatusPill label={glucoseLabel(latestTone)} tone={latestTone} />
              <Text style={styles.heroMeta}>{formatElapsed(latestGlucose?.timestamp)}</Text>
            </View>
            <View style={styles.heroReadingRow}>
              <Animated.Text style={[styles.heroNumber, styles[`heroNumber_${latestTone}`], heroAnimatedStyle]}>
                {latestGlucose ? Math.round(latestGlucose.value) : "—"}
              </Animated.Text>
              <Text style={styles.heroUnit}>mg/dL</Text>
            </View>
            <View style={styles.heroFooter}>
              <CountUpMetricTile label="day streak" value={streak} />
              <CountUpMetricTile label="today" value={todayCounts.glucose} detail="glucose logs" />
              <CountUpMetricTile label="care team" value={accepted.length} detail="linked" />
            </View>
          </Card>
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(80).duration(360)}>
          <Card style={styles.quickCard}>
            <View style={styles.quickCopy}>
              <Text style={styles.quickTitle}>Log in under 10 seconds</Text>
              <Text style={uiStyles.muted}>Large tap targets and a numeric entry keep this focused on today, not form filling.</Text>
            </View>
            <AppButton label="Quick log" onPress={() => setLogOpen(true)} />
          </Card>
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(160).duration(360)}>
          <Card style={styles.nudgeCard}>
            <SectionHeader
              title="Upcoming nudges"
              eyebrow={patient?.diabetesType === "type1" ? "Strict mode" : "Gentle mode"}
            />
            {nudgeError ? <InlineMessage tone="danger">{nudgeError}</InlineMessage> : null}
            {!nudgeError && nudgeSettings ? getNextNudgeSummaries(nudgeSettings).map((summary) => (
              <View key={summary} style={styles.nudgeRow}>
                <View style={styles.nudgeDot} />
                <View style={styles.nudgeTextBlock}>
                  <Text style={styles.nudgeTitle}>{summary}</Text>
                </View>
              </View>
            )) : null}
            {!nudgeError && nudgeSettings && getNextNudgeSummaries(nudgeSettings).length === 0 ? (
              <Text style={uiStyles.muted}>No reminders are turned on right now.</Text>
            ) : null}
            <Text style={uiStyles.muted}>A quiet reminder, set to the times that work for you.</Text>
            <Link href="/(drawer)/nudges" asChild>
              <AppButton compact label="Set nudges" tone="secondary" />
            </Link>
          </Card>
        </Animated.View>
      </View>
      <QuickLogModal
        visible={logOpen}
        patientId={profile.uid}
        onClose={() => setLogOpen(false)}
        onSaved={() => {
          setLogOpen(false);
          setMessage(null);
        }}
      />
    </ScreenFrame>
  );
}

export function PatientTrendsScreen() {
  const { patient, glucoseLogs, message } = usePatientData();
  return (
    <ScreenFrame>
      <View style={styles.stack}>
        {message ? <InlineMessage tone="danger">{message}</InlineMessage> : null}
        <TrendSection logs={glucoseLogs} patient={patient} />
        <ScreeningTracker patient={patient} />
      </View>
    </ScreenFrame>
  );
}

export function PatientNudgesScreen() {
  const { profile } = useAuth();
  const { patient, nudgeSettings, nudgeError } = usePatientData();
  const strict = patient?.diabetesType === "type1";
  const [draft, setDraft] = useState<NudgeSettings | null>(null);
  const [picker, setPicker] = useState<{ mealId: MealNudge["id"]; timing: NudgeTiming } | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    requestNudgePermission()
      .then((granted) => {
        if (!active) return;
        setPermissionGranted(granted);
        if (!granted) {
          setPermissionMessage(
            Platform.OS === "web"
              ? "Reminders can be scheduled from the mobile app."
              : "Notifications are off for now. You can still save your reminder times and turn notifications on in device settings."
          );
        } else {
          setPermissionMessage(null);
        }
      })
      .catch(() => {
        if (!active) return;
        setPermissionGranted(false);
        setPermissionMessage("We couldn’t check notification access just now. Your reminder times can still be saved.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (nudgeSettings) setDraft(nudgeSettings);
  }, [nudgeSettings]);

  if (!profile) return null;
  const activeMealNudges = draft
    ? draft.meals.reduce((total, meal) => total + Number(meal.beforeEnabled) + Number(meal.afterEnabled), 0)
    : 0;

  const updateMeal = (mealId: MealNudge["id"], update: Partial<MealNudge>) => {
    setDraft((current) =>
      current
        ? { ...current, meals: current.meals.map((meal) => meal.id === mealId ? { ...meal, ...update } : meal) }
        : current
    );
  };

  const updateInsulin = (mealId: MealNudge["id"], update: { enabled?: boolean; minutesBeforeMeal?: number }) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            insulin: current.insulin.map((nudge) => nudge.mealId === mealId ? { ...nudge, ...update } : nudge),
          }
        : current
    );
  };

  const toggleMealNudge = (meal: MealNudge, timing: NudgeTiming, enabled: boolean) => {
    const currentEnabled = timing === "before" ? meal.beforeEnabled : meal.afterEnabled;
    if (strict && currentEnabled && !enabled && activeMealNudges <= 1) return;
    updateMeal(meal.id, timing === "before" ? { beforeEnabled: enabled } : { afterEnabled: enabled });
  };

  const saveSettings = async () => {
    if (!draft || !patient) return;
    if (strict && activeMealNudges < 1) {
      setSaveMessage("Keep at least one meal reminder active in strict mode.");
      return;
    }
    const validOffsets = draft.meals.every(
      (meal) =>
        /^([01]\d|2[0-3]):[0-5]\d$/.test(meal.beforeTime) &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(meal.afterTime) &&
        Number.isInteger(meal.beforeMinutesOffset) &&
        meal.beforeMinutesOffset >= 0 &&
        meal.beforeMinutesOffset <= 1440 &&
        Number.isInteger(meal.afterMinutesOffset) &&
        meal.afterMinutesOffset >= 0 &&
        meal.afterMinutesOffset <= 1440
    );
    const validInsulinOffsets = draft.insulin.every(
      (nudge) => Number.isInteger(nudge.minutesBeforeMeal) && nudge.minutesBeforeMeal >= 1 && nudge.minutesBeforeMeal <= 240
    );
    if (!validOffsets || !validInsulinOffsets) {
      setSaveMessage("Check the meal times and use 0–1,440 minutes for meal reminders and 1–240 minutes for insulin.");
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    const settings: NudgeSettings = {
      ...draft,
      insulin: strict ? draft.insulin : [],
      updatedAt: Timestamp.now(),
    };
    try {
      await setDoc(doc(db, COLLECTIONS.patients, profile.uid, "settings", "nudges"), settings);
    } catch {
      setSaveMessage("We couldn’t save your reminder times. Please try again.");
      setSaving(false);
      return;
    }

    setDraft(settings);
    try {
      const scheduled = await syncNudgeNotifications(profile.uid, settings, permissionGranted === true);
      setSaveMessage(
        scheduled
          ? "Your reminder times are saved and set to repeat each day."
          : "Your reminder times are saved. Notifications are off, so reminders haven’t been scheduled."
      );
    } catch {
      setSaveMessage("Your settings were saved, but reminders couldn’t be scheduled. Please try saving again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenFrame>
      <View style={styles.stack}>
        <Card style={styles.nudgeModeCard}>
          <View style={styles.modeHeading}>
            <StatusPill
              label={strict ? "Strict mode" : "Gentle mode"}
              tone={strict ? "caregiver" : "range"}
            />
          </View>
          <Text style={uiStyles.muted}>
            {strict
              ? "More frequent meal and insulin reminders are on by default. Keep at least one meal reminder active, and adjust the times to suit your day."
              : "A lighter set of reminders starts on by default. Every reminder is optional, and you can turn them all off."}
          </Text>
        </Card>
        {permissionMessage ? <InlineMessage>{permissionMessage}</InlineMessage> : null}
        {nudgeError ? <InlineMessage tone="danger">{nudgeError}</InlineMessage> : null}
        {!draft || !patient ? (
          <Card><ActivityIndicator color={palette.accent} /></Card>
        ) : (
          <>
            {draft.meals.map((meal) => {
              const insulin = draft.insulin.find((item) => item.mealId === meal.id);
              return (
                <Card key={meal.id} style={styles.nudgeMealCard}>
                  <SectionHeader title={meal.mealLabel} />
                  <NudgeToggle
                    title="Before meal"
                    detail={`Reminder ${meal.beforeMinutesOffset} minutes before`}
                    value={meal.beforeEnabled}
                    disabled={strict && meal.beforeEnabled && activeMealNudges <= 1}
                    onValueChange={(enabled) => toggleMealNudge(meal, "before", enabled)}
                  />
                  {meal.beforeEnabled || strict ? (
                    <>
                      <TimePickerControl
                        label="Meal time"
                        time={meal.beforeTime}
                        pickerVisible={picker?.mealId === meal.id && picker.timing === "before"}
                        onPress={() => setPicker(picker?.mealId === meal.id && picker.timing === "before" ? null : { mealId: meal.id, timing: "before" })}
                        onChange={(event, date) => {
                          if (date) updateMeal(meal.id, { beforeTime: clockTime(date) });
                          if (event.type === "dismissed" || Platform.OS === "android") setPicker(null);
                        }}
                      />
                      <Field
                        label="Minutes before meal"
                        value={String(meal.beforeMinutesOffset)}
                        onChangeText={(value) => updateMeal(meal.id, { beforeMinutesOffset: numericValue(value) })}
                        keyboardType="number-pad"
                        maxLength={4}
                        style={styles.nudgeInput}
                      />
                    </>
                  ) : null}
                  <NudgeToggle
                    title="After meal"
                    detail={`Reminder ${meal.afterMinutesOffset} minutes after`}
                    value={meal.afterEnabled}
                    disabled={strict && meal.afterEnabled && activeMealNudges <= 1}
                    onValueChange={(enabled) => toggleMealNudge(meal, "after", enabled)}
                  />
                  {meal.afterEnabled || strict ? (
                    <>
                      <TimePickerControl
                        label="Meal time"
                        time={meal.afterTime}
                        pickerVisible={picker?.mealId === meal.id && picker.timing === "after"}
                        onPress={() => setPicker(picker?.mealId === meal.id && picker.timing === "after" ? null : { mealId: meal.id, timing: "after" })}
                        onChange={(event, date) => {
                          if (date) updateMeal(meal.id, { afterTime: clockTime(date) });
                          if (event.type === "dismissed" || Platform.OS === "android") setPicker(null);
                        }}
                      />
                      <Field
                        label="Minutes after meal"
                        value={String(meal.afterMinutesOffset)}
                        onChangeText={(value) => updateMeal(meal.id, { afterMinutesOffset: numericValue(value) })}
                        keyboardType="number-pad"
                        maxLength={4}
                        style={styles.nudgeInput}
                      />
                    </>
                  ) : null}
                  {strict && insulin ? (
                    <>
                      <NudgeToggle
                        title="Insulin reminder"
                        detail="A reminder before this meal"
                        value={insulin.enabled}
                        onValueChange={(enabled) => updateInsulin(meal.id, { enabled })}
                      />
                      {insulin.enabled ? (
                        <Field
                          label="Minutes before meal"
                          value={String(insulin.minutesBeforeMeal)}
                          onChangeText={(value) => updateInsulin(meal.id, { minutesBeforeMeal: numericValue(value) })}
                          keyboardType="number-pad"
                          maxLength={3}
                          style={styles.nudgeInput}
                        />
                      ) : null}
                    </>
                  ) : null}
                </Card>
              );
            })}
            {saveMessage ? <InlineMessage tone={saveMessage.includes("couldn’t") || saveMessage.startsWith("Use ") ? "danger" : "neutral"}>{saveMessage}</InlineMessage> : null}
            <AppButton
              label="Save reminders"
              loading={saving}
              disabled={permissionGranted === null}
              onPress={saveSettings}
            />
          </>
        )}
      </View>
    </ScreenFrame>
  );
}

function NudgeToggle({
  title,
  detail,
  value,
  disabled = false,
  onValueChange,
}: {
  title: string;
  detail: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.nudgeToggleRow}>
      <View style={styles.nudgeToggleCopy}>
        <Text style={styles.nudgeTitle}>{title}</Text>
        <Text style={uiStyles.muted}>{detail}</Text>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: palette.line, true: palette.accentSoft }}
        thumbColor={value ? palette.accent : palette.surface}
      />
    </View>
  );
}

function TimePickerControl({
  label,
  time,
  pickerVisible,
  onPress,
  onChange,
}: {
  label: string;
  time: string;
  pickerVisible: boolean;
  onPress: () => void;
  onChange: (event: DateTimePickerEvent, date?: Date) => void;
}) {
  return (
    <View style={styles.timePickerControl}>
      <Text style={styles.nudgeFieldLabel}>{label}</Text>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.timePickerButton}>
        <Text style={styles.timePickerText}>{formatNudgeTime(time)}</Text>
      </Pressable>
      {pickerVisible ? (
        <DateTimePicker
          value={dateForClockTime(time)}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onChange}
        />
      ) : null}
    </View>
  );
}

function dateForClockTime(time: string): Date {
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

function clockTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function numericValue(value: string): number {
  return Number(value.replace(/\D/g, "")) || 0;
}

export function PatientCareTeamScreen() {
  const { accepted, pending, code, generating, generateCode, respondToLink, message } = usePatientData();
  return (
    <ScreenFrame>
      <View style={styles.stack}>
        {message ? <InlineMessage tone="danger">{message}</InlineMessage> : null}
        <CaregiverAccess
          accepted={accepted}
          pending={pending}
          code={code}
          generating={generating}
          onGenerate={generateCode}
          onRespond={respondToLink}
        />
      </View>
    </ScreenFrame>
  );
}

function TrendSection({ logs, patient }: { logs: LogEntry[]; patient: Patient | null }) {
  const [range, setRange] = useState<7 | 30>(7);
  const chartData = useMemo(() => {
    const cutoff = Date.now() - range * 24 * 60 * 60 * 1000;
    return logs
      .filter((log) => log.timestamp >= cutoff)
      .slice()
      .reverse();
  }, [logs, range]);

  return (
    <Card style={styles.chartCard}>
      <SectionHeader
        title="Glucose trend"
        eyebrow="Tracking only"
        action={
          <View style={styles.segmented}>
            <RangeButton active={range === 7} label="7D" onPress={() => setRange(7)} />
            <RangeButton active={range === 30} label="30D" onPress={() => setRange(30)} />
          </View>
        }
      />
      {chartData.length >= 2 ? (
        <LineChart logs={chartData} low={patient?.thresholds.low} high={patient?.thresholds.high} />
      ) : (
        <EmptyState
          title="Not enough readings for a trend yet"
          body="Two glucose logs are enough to start showing direction without adding noise."
        />
      )}
    </Card>
  );
}

function RangeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.rangeButton, active && styles.rangeButtonActive, pressed && styles.rangeButtonPressed]}
    >
      <Text style={[styles.rangeText, active && styles.rangeTextActive]}>{label}</Text>
    </Pressable>
  );
}

function LineChart({ logs, low, high }: { logs: LogEntry[]; low?: number; high?: number }) {
  const [plotWidth, setPlotWidth] = useState(0);
  const lineProgress = useSharedValue(0);
  const values = logs.map((log) => log.value);
  const min = Math.min(...values, low ?? Infinity) - 12;
  const max = Math.max(...values, high ?? -Infinity) + 12;
  const span = Math.max(1, max - min);
  const width = Math.max(0, plotWidth - 10);
  const height = 150;
  const points = logs.map((log, index) => ({
    x: 5 + (logs.length === 1 ? width / 2 : (index / (logs.length - 1)) * width),
    y: height - ((log.value - min) / span) * height,
    value: log.value,
    key: log.logId,
  }));
  const segmentLengths = points.slice(1).map((point, index) => {
    const previous = points[index];
    return Math.hypot(point.x - previous.x, point.y - previous.y);
  });
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);

  useEffect(() => {
    lineProgress.value = withTiming(1, { duration: 580 });
  }, [lineProgress]);

  return (
    <View style={styles.chartWrap}>
      <View style={[styles.thresholdLine, { top: `${100 - (((high ?? max) - min) / span) * 100}%` }]} />
      <View style={[styles.thresholdLine, styles.thresholdLineLow, { top: `${100 - (((low ?? min) - min) / span) * 100}%` }]} />
      <View
        style={styles.chartPlot}
        onLayout={(event) => setPlotWidth(event.nativeEvent.layout.width)}
      >
        {points.slice(1).map((point, index) => {
          const prev = points[index];
          const dx = point.x - prev.x;
          const dy = point.y - prev.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = `${Math.atan2(dy, dx)}rad`;
          const precedingLength = segmentLengths.slice(0, index).reduce((sum, item) => sum + item, 0);
          return (
            <AnimatedChartSegment
              key={`${prev.key}-${point.key}`}
              left={prev.x}
              top={prev.y}
              length={length}
              angle={angle}
              startProgress={totalLength ? precedingLength / totalLength : 0}
              endProgress={totalLength ? (precedingLength + length) / totalLength : 1}
              progress={lineProgress}
            />
          );
        })}
        {points.map((point) => (
          <View key={point.key} style={[styles.chartPoint, { left: point.x - 5, top: point.y - 5 }]} />
        ))}
      </View>
      <View style={styles.chartAxis}>
        <Text style={styles.axisText}>{Math.round(max)}</Text>
        <Text style={styles.axisText}>{Math.round(min)}</Text>
      </View>
    </View>
  );
}

function AnimatedChartSegment({
  left,
  top,
  length,
  angle,
  startProgress,
  endProgress,
  progress,
}: {
  left: number;
  top: number;
  length: number;
  angle: string;
  startProgress: number;
  endProgress: number;
  progress: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    width: interpolate(
      progress.value,
      [startProgress, endProgress],
      [0, length],
      Extrapolation.CLAMP
    ),
  }));
  return (
    <Animated.View
      style={[
        styles.chartSegment,
        animatedStyle,
        { left, top, transform: [{ rotate: angle }] },
      ]}
    />
  );
}

function ScreeningTracker({ patient }: { patient: Patient | null }) {
  const nextDate = patient?.nextScreeningDate ? new Date(`${patient.nextScreeningDate}T12:00:00`) : null;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const daysUntil = nextDate ? Math.ceil((nextDate.getTime() - today.getTime()) / 86400000) : null;
  const overdue = daysUntil !== null && daysUntil < 0;

  return (
    <Card style={styles.screeningCard}>
      <SectionHeader title="Eye screening" eyebrow="Tracker" />
      {daysUntil === null ? (
        <Text style={uiStyles.muted}>Add a screening date during onboarding to keep this visible without alarm.</Text>
      ) : (
        <View style={styles.screeningRow}>
          <Text style={[styles.screeningNumber, overdue && styles.screeningOverdue]}>{Math.abs(daysUntil)}</Text>
          <View style={styles.screeningCopy}>
            <StatusPill label={overdue ? "Overdue" : "On track"} tone={overdue ? "low" : "range"} />
            <Text style={uiStyles.muted}>
              {overdue ? "days past your planned screening" : "days until your planned screening"}
            </Text>
          </View>
        </View>
      )}
    </Card>
  );
}

function CaregiverAccess({
  accepted,
  pending,
  code,
  generating,
  onGenerate,
  onRespond,
}: {
  accepted: CaregiverLink[];
  pending: CaregiverLink[];
  code: string | null;
  generating: boolean;
  onGenerate: () => void;
  onRespond: (link: CaregiverLink, status: "accepted" | "declined") => void;
}) {
  return (
    <Card style={styles.accessCard}>
      <SectionHeader title="Care bridge" eyebrow="Consent-based sharing" />
      {accepted.length === 0 && pending.length === 0 ? (
        <Text style={uiStyles.muted}>No caregivers are linked yet. Share a consent code when you want someone to request access.</Text>
      ) : null}
      {accepted.map((l) => (
        <LinkRow key={l.linkId} uid={l.caregiverId} suffix="connected" />
      ))}
      {pending.map((l) => (
        <View key={l.linkId} style={styles.requestCard}>
          <LinkRow uid={l.caregiverId} suffix="requests access" />
          <View style={styles.requestActions}>
            <AppButton compact label="Accept" onPress={() => onRespond(l, "accepted")} />
            <AppButton compact tone="quiet" label="Decline" onPress={() => onRespond(l, "declined")} />
          </View>
        </View>
      ))}
      <View style={styles.codePanel}>
        <Text style={styles.codeLabel}>Consent code</Text>
        {code ? <Text style={styles.code}>{code}</Text> : <Text style={uiStyles.muted}>Generate a six-character code for a caregiver request.</Text>}
        <AppButton compact tone="secondary" label={code ? "Generate new code" : "Generate code"} loading={generating} onPress={onGenerate} />
      </View>
    </Card>
  );
}

function LinkRow({
  uid,
  suffix,
  statusLabel,
  statusTone,
}: {
  uid: string;
  suffix: string;
  statusLabel?: string;
  statusTone?: "caregiver" | "danger" | "neutral";
}) {
  const name = useDisplayName(uid);
  return (
    <View style={styles.linkRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={styles.linkCopy}>
        <Text style={styles.linkName}>{name}</Text>
        <Text style={uiStyles.muted}>{suffix}</Text>
      </View>
      {statusLabel && statusTone ? <StatusPill label={statusLabel} tone={statusTone} /> : null}
    </View>
  );
}

function GlucoseSparkline({ logs }: { logs: Array<LogEntry | null> }) {
  const [width, setWidth] = useState(0);
  const readings = logs.flatMap((log, dayIndex) => log ? [{ x: dayIndex, value: log.value }] : []);
  const values = readings.map((reading) => reading.value);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const range = Math.max(1, max - min);
  const chartHeight = 44;
  const points = readings.map(({ x, value }) => ({
    x: logs.length <= 1 ? width / 2 : 4 + (x / (logs.length - 1)) * Math.max(0, width - 8),
    y: chartHeight - 4 - ((value - min) / range) * (chartHeight - 8),
  }));

  return (
    <View
      style={styles.sparkline}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessibilityLabel={`Glucose readings over the last seven days, ${readings.length} days with readings`}
    >
      {points.slice(1).map((point, index) => {
        const previous = points[index];
        const dx = point.x - previous.x;
        const dy = point.y - previous.y;
        return (
          <View
            key={`${index}-${point.x}`}
            style={[
              styles.sparklineSegment,
              {
                left: previous.x,
                top: previous.y,
                width: Math.hypot(dx, dy),
                transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
              },
            ]}
          />
        );
      })}
      {points.map((point, index) => (
        <View key={`point-${index}`} style={[styles.sparklinePoint, { left: point.x - 3, top: point.y - 3 }]} />
      ))}
      {readings.length === 0 ? <Text style={styles.sparklineEmpty}>Recent readings will appear here.</Text> : null}
    </View>
  );
}

function QuickLogModal({
  visible,
  patientId,
  onClose,
  onSaved,
}: {
  visible: boolean;
  patientId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<LogKind>("glucose");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [mounted, setMounted] = useState(visible);
  const closing = useRef(false);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backdropOpacity = useSharedValue(0);
  const sheetTranslateY = useSharedValue(32);
  const successScale = useSharedValue(0.7);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
    transform: [{ translateY: sheetTranslateY.value }],
  }));
  const successIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(successScale.value, [0.7, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: successScale.value }],
  }));

  useEffect(() => {
    if (visible) {
      closing.current = false;
      cancelAnimation(backdropOpacity);
      cancelAnimation(sheetTranslateY);
      setMounted(true);
      setSuccess(false);
      backdropOpacity.value = 0;
      sheetTranslateY.value = 32;
      successScale.value = 0.7;
      backdropOpacity.value = withTiming(1, { duration: 240 });
      sheetTranslateY.value = withTiming(0, { duration: 280 });
      return;
    }

    if (!mounted || closing.current) return;
    closing.current = true;
    backdropOpacity.value = withTiming(0, { duration: 220 });
    sheetTranslateY.value = withTiming(32, { duration: 240 }, (finished) => {
      if (finished) runOnJS(setMounted)(false);
    });
  }, [backdropOpacity, mounted, sheetTranslateY, successScale, visible]);

  useEffect(() => () => {
    if (successTimer.current) clearTimeout(successTimer.current);
  }, []);

  useEffect(() => {
    if (success) successScale.value = withSpring(1, { duration: 300 });
  }, [success, successScale]);

  const save = async () => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a positive number before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const ref = doc(collection(db, COLLECTIONS.logs));
      const log: LogEntry = {
        logId: ref.id,
        patientId,
        kind,
        value: parsed,
        timestamp: Date.now(),
        ...(note.trim() ? { note: note.trim() } : {}),
      };
      await setDoc(ref, log);
      setSuccess(true);
      successTimer.current = setTimeout(onSaved, 480);
    } catch {
      setError("We couldn’t save this log. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return (
    <Modal animationType="none" transparent visible onRequestClose={onClose}>
      <Animated.View style={[styles.modalBackdrop, backdropStyle]}>
        <Animated.View style={[styles.modalSheet, sheetStyle]}>
          {success ? (
            <View style={styles.successState}>
              <Animated.View style={[styles.successIcon, successIconStyle]}>
                <Text style={styles.successCheck}>✓</Text>
              </Animated.View>
              <SectionHeader title="Log saved" eyebrow="All set for today" />
              <Text style={uiStyles.muted}>Your reading has been added.</Text>
            </View>
          ) : (
            <>
              <View style={styles.modalHandle} />
              <SectionHeader title="Quick log" eyebrow="Today" />
              <View style={styles.kindGrid}>
                <KindButton active={kind === "glucose"} label="Glucose" detail="mg/dL" onPress={() => setKind("glucose")} />
                <KindButton active={kind === "tablet"} label="Tablet" detail="count" onPress={() => setKind("tablet")} />
                <KindButton active={kind === "insulin"} label="Insulin" detail="units" onPress={() => setKind("insulin")} />
              </View>
              <Field
                label={kind === "glucose" ? "Reading" : kind === "tablet" ? "Tablet count" : "Insulin units"}
                value={value}
                onChangeText={setValue}
                keyboardType="number-pad"
                autoFocus
                style={styles.quickInput}
                helper={kind === "glucose" ? "A glucose value in mg/dL." : "Use the amount you just took."}
              />
              <Field label="Optional note" value={note} onChangeText={setNote} placeholder="Meal, walk, or context" />
              {error ? <InlineMessage tone="danger">{error}</InlineMessage> : null}
              <View style={styles.modalActions}>
                <AppButton label="Save log" loading={saving} onPress={save} />
                <AppButton label="Cancel" tone="quiet" onPress={onClose} />
              </View>
            </>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function KindButton({ active, label, detail, onPress }: { active: boolean; label: string; detail: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.kindButton, active && styles.kindButtonActive, pressed && styles.kindButtonPressed]}
    >
      <Text style={[styles.kindLabel, active && styles.kindLabelActive]}>{label}</Text>
      <Text style={[styles.kindDetail, active && styles.kindDetailActive]}>{detail}</Text>
    </Pressable>
  );
}

export function CaregiverTodayScreen() {
  const { accepted } = useCaregiverData();
  return (
    <ScreenFrame>
      <View style={styles.stack}>
        <Card elevated style={styles.caregiverHero}>
          <StatusPill label="Caregiver mode" tone="caregiver" />
          <Text style={styles.caregiverTitle}>A softer window into someone’s day.</Text>
          <Text style={uiStyles.muted}>You can see shared journey data only after the patient accepts your request.</Text>
        </Card>
        {accepted.length === 0 ? (
          <EmptyState
            title="No accepted links yet"
            body="Ask the patient to share their 6-character consent code. Enter it to send a request; they’ll approve access before any shared information appears here."
            action={
              <Link href="/onboarding/caregiver" asChild>
                <AppButton label="Enter consent code" tone="secondary" />
              </Link>
            }
          />
        ) : (
          accepted.map((link) => <CaregiverPatientCard key={link.linkId} link={link} />)
        )}
      </View>
    </ScreenFrame>
  );
}

export function CaregiverRequestsScreen() {
  const { pending, other } = useCaregiverData();
  return (
    <ScreenFrame>
      <View style={styles.stack}>
        {pending.length ? (
          <Card style={styles.accessCard}>
            <SectionHeader title="Pending requests" eyebrow="Waiting for consent" />
            {pending.map((link) => (
              <LinkRow
                key={link.linkId}
                uid={link.patientId}
                suffix="The patient will review your request."
                statusLabel="Waiting"
                statusTone="caregiver"
              />
            ))}
          </Card>
        ) : null}
        {other.length ? (
          <Card style={styles.accessCard}>
            <SectionHeader title="Closed requests" eyebrow="Access boundary" />
            {other.map((link) => (
              <LinkRow
                key={link.linkId}
                uid={link.patientId}
                suffix={link.status === "declined" ? "The request was declined." : "This connection is no longer active."}
                statusLabel={link.status === "declined" ? "Declined" : "Revoked"}
                statusTone={link.status === "declined" ? "danger" : "neutral"}
              />
            ))}
          </Card>
        ) : null}
        {pending.length === 0 && other.length === 0 ? (
          <EmptyState title="No requests just now" body="New requests will appear here when someone shares access with you." />
        ) : null}
      </View>
    </ScreenFrame>
  );
}

function CaregiverPatientCard({ link }: { link: CaregiverLink }) {
  const name = useDisplayName(link.patientId);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinStatus, setCheckinStatus] = useState<CheckinStatus>("ok");
  const [checkinNote, setCheckinNote] = useState("");
  const [savingCheckin, setSavingCheckin] = useState(false);
  const [checkinError, setCheckinError] = useState<string | null>(null);

  useEffect(() => {
    const logsQuery = query(
      collection(db, COLLECTIONS.logs),
      where("patientId", "==", link.patientId),
      orderBy("timestamp", "desc"),
      limit(50)
    );
    return onSnapshot(logsQuery, (snap) => setLogs(snap.docs.map((d) => d.data() as LogEntry)));
  }, [link.patientId]);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    today.setDate(today.getDate() - 6);
    const checkinsQuery = query(
      collection(db, COLLECTIONS.checkins),
      where("caregiverId", "==", link.caregiverId),
      where("patientId", "==", link.patientId),
      where("date", ">=", dateKey(today.getTime())),
      orderBy("date", "desc")
    );
    return onSnapshot(
      checkinsQuery,
      (snap) => {
        setCheckins(snap.docs.map((checkin) => checkin.data() as Checkin));
        setCheckinError(null);
      },
      () => setCheckinError("We couldn’t load check-ins just now.")
    );
  }, [link.caregiverId, link.patientId]);

  const latest = logs.find((log) => log.kind === "glucose");
  const glucoseLogs = logs.filter((log) => log.kind === "glucose");
  const today = logs.filter((log) => log.timestamp >= startOfToday());
  const todayKey = dateKey(Date.now());
  const todayCheckin = checkins.find((checkin) => checkin.date === todayKey);
  const historyDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - index));
    const date = dateKey(day.getTime());
    return { date, status: checkins.find((checkin) => checkin.date === date)?.status };
  });
  const sevenDayCutoff = (() => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - 6);
    return day.getTime();
  })();
  const sevenDayLogs = glucoseLogs.filter((log) => log.timestamp >= sevenDayCutoff);
  const dailyGlucose = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - index));
    const key = dateKey(day.getTime());
    return sevenDayLogs.find((log) => dateKey(log.timestamp) === key) ?? null;
  });

  const openCheckin = () => {
    setCheckinStatus(todayCheckin?.status ?? "ok");
    setCheckinNote(todayCheckin?.note ?? "");
    setCheckinError(null);
    setCheckinOpen(true);
  };

  const saveCheckin = async () => {
    setSavingCheckin(true);
    setCheckinError(null);
    try {
      const note = checkinNote.trim();
      if (todayCheckin) {
        await updateDoc(doc(db, COLLECTIONS.checkins, todayCheckin.checkinId), {
          status: checkinStatus,
          note: note || deleteField(),
        });
      } else {
        const checkinId = `${link.caregiverId}_${link.patientId}_${todayKey}`;
        const checkin: Checkin = {
          checkinId,
          caregiverId: link.caregiverId,
          patientId: link.patientId,
          date: todayKey,
          status: checkinStatus,
          ...(note ? { note } : {}),
          createdAt: Date.now(),
        };
        await setDoc(doc(db, COLLECTIONS.checkins, checkinId), checkin);
      }
      setCheckinOpen(false);
    } catch {
      setCheckinError("We couldn’t save this check-in. Check your connection and try again.");
    } finally {
      setSavingCheckin(false);
    }
  };

  return (
    <Card style={styles.patientBridgeCard}>
      <View style={styles.patientIdentity}>
        <View style={[styles.avatar, styles.patientAvatar]}>
          <Text style={[styles.avatarText, styles.patientAvatarText]}>{name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.patientIdentityCopy}>
          <Text style={styles.patientName}>{name}</Text>
          <Text style={styles.patientIdentityDetail}>Shared with you</Text>
        </View>
      </View>
      <SectionHeader title="How they’re doing today" eyebrow="Shared journey" />
      <View style={styles.bridgeMetrics}>
        <MetricTile label="latest glucose" value={latest ? Math.round(latest.value) : "—"} detail={latest ? formatElapsed(latest.timestamp) : "no reading"} />
        <MetricTile label="today’s logs" value={today.length} />
      </View>
      <View style={styles.patientTrend}>
        <View style={styles.trendSummaryHeader}>
          <Text style={styles.trendSummaryTitle}>7-day glucose</Text>
          <Text style={styles.trendSummaryDetail}>
            {sevenDayLogs.length ? `${sevenDayLogs.length} reading${sevenDayLogs.length === 1 ? "" : "s"}` : "No readings yet"}
          </Text>
        </View>
        <GlucoseSparkline logs={dailyGlucose} />
      </View>
      <View style={styles.checkinSection}>
        <SectionHeader
          title="A moment to check in"
          eyebrow="Daily check-in"
          action={
            <AppButton
              compact
              label={todayCheckin ? "Update" : "Check in"}
              tone="secondary"
              onPress={openCheckin}
            />
          }
        />
        {todayCheckin ? (
          <View style={styles.todayCheckin}>
            <View style={[styles.statusDot, styles[`statusDot_${todayCheckin.status}`]]} />
            <View style={styles.todayCheckinCopy}>
              <Text style={styles.todayCheckinTitle}>{checkinStatusLabel(todayCheckin.status)}</Text>
              {todayCheckin.note ? <Text style={uiStyles.muted}>{todayCheckin.note}</Text> : null}
            </View>
          </View>
        ) : (
          <Text style={uiStyles.muted}>A small note on how today is going, in your own words.</Text>
        )}
        <View style={styles.checkinHistory} accessibilityLabel="Check-in history for the last seven days">
          {historyDays.map(({ date, status }) => (
            <View key={date} style={styles.historyDay} accessible accessibilityLabel={`${date}: ${status ? checkinStatusLabel(status) : "no check-in"}`}>
              <View style={[styles.statusDot, status ? styles[`statusDot_${status}`] : styles.statusDot_empty]} />
              <Text style={styles.historyDate}>{date.slice(8)}</Text>
            </View>
          ))}
        </View>
        {checkinError ? <InlineMessage tone="danger">{checkinError}</InlineMessage> : null}
      </View>
      <InlineMessage>
        You can view accepted shared logs and add daily check-ins, but patient-owned records remain under their control.
      </InlineMessage>
      <Modal animationType="slide" transparent visible={checkinOpen} onRequestClose={() => setCheckinOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <SectionHeader title="How has today felt?" eyebrow="A gentle daily check-in" />
            <Text style={uiStyles.muted}>Choose what feels closest. You can add a little context if you’d like.</Text>
            <View style={styles.kindGrid}>
              <CheckinStatusButton status="ok" selected={checkinStatus} onPress={setCheckinStatus} />
              <CheckinStatusButton status="missed" selected={checkinStatus} onPress={setCheckinStatus} />
              <CheckinStatusButton status="concern" selected={checkinStatus} onPress={setCheckinStatus} />
            </View>
            <Field
              label="Optional note"
              value={checkinNote}
              onChangeText={setCheckinNote}
              placeholder="Anything you’d like to remember"
              multiline
            />
            {checkinError ? <InlineMessage tone="danger">{checkinError}</InlineMessage> : null}
            <View style={styles.modalActions}>
              <AppButton label="Save check-in" loading={savingCheckin} onPress={saveCheckin} />
              <AppButton label="Cancel" tone="quiet" onPress={() => setCheckinOpen(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </Card>
  );
}

function checkinStatusLabel(status: CheckinStatus): string {
  if (status === "ok") return "A steady day";
  if (status === "missed") return "A check-in was missed";
  return "Something to share";
}

function CheckinStatusButton({
  status,
  selected,
  onPress,
}: {
  status: CheckinStatus;
  selected: CheckinStatus;
  onPress: (status: CheckinStatus) => void;
}) {
  const label = status === "ok" ? "Okay" : status === "missed" ? "Missed" : "Concern";
  const detail = status === "ok" ? "Going well" : status === "missed" ? "Not today" : "Needs a note";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: selected === status }}
      onPress={() => onPress(status)}
      style={({ pressed }) => [
        styles.kindButton,
        selected === status && styles.kindButtonActive,
        pressed && styles.kindButtonPressed,
      ]}
    >
      <Text style={[styles.kindLabel, selected === status && styles.kindLabelActive]}>{label}</Text>
      <Text style={[styles.kindDetail, selected === status && styles.kindDetailActive]}>{detail}</Text>
    </Pressable>
  );
}

export function ClinicDashboardScreen() {
  return (
    <ScreenFrame>
      <Card style={styles.clinicCard}>
        <StatusPill label="Clinic account" tone="clinic" />
        <Text style={styles.clinicTitle}>Use the web dashboard for patient monitoring.</Text>
        <Text style={uiStyles.muted}>This mobile view keeps account access available; the dense patient list and visit summaries are designed for the clinic dashboard.</Text>
      </Card>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  screenFrame: { flex: 1, width: "100%", maxWidth: "100%", minWidth: 0, overflow: "hidden" },
  screenScroll: { flex: 1, width: "100%", maxWidth: "100%", minWidth: 0 },
  screenContent: { flexGrow: 1, alignSelf: "stretch", maxWidth: "100%" },
  topBar: { width: "100%", maxWidth: "100%", minWidth: 0, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.lg },
  titleBlock: { flex: 1, minWidth: 0, gap: spacing.xs },
  headerActions: { alignItems: "flex-end", gap: spacing.sm },
  kicker: {
    color: palette.accentDark,
    fontFamily: type.familyStrong,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  stack: { gap: spacing.lg },
  heroCard: { gap: spacing.lg, backgroundColor: "#fffaf1" },
  heroHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
  heroMeta: { flexShrink: 1, minWidth: 0, color: palette.muted, fontFamily: type.familyStrong, fontSize: 13, fontWeight: "700", textAlign: "right" },
  heroReadingRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  heroNumber: { flexShrink: 1, fontFamily: type.familyStrong, fontSize: 76, fontWeight: "800", letterSpacing: -4, color: palette.ink, lineHeight: 86 },
  heroNumber_low: { color: palette.low },
  heroNumber_range: { color: palette.inRange },
  heroNumber_high: { color: palette.high },
  heroNumber_neutral: { color: palette.ink },
  heroUnit: { color: palette.muted, fontFamily: type.familyStrong, fontSize: 17, fontWeight: "700", paddingBottom: 14 },
  heroFooter: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  nudgeModeCard: { gap: spacing.md, backgroundColor: palette.accentSoft },
  modeHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nudgeMealCard: { gap: spacing.lg },
  nudgeToggleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: spacing.md },
  nudgeToggleCopy: { flex: 1, minWidth: 0, gap: 2 },
  timePickerControl: { gap: spacing.sm },
  nudgeFieldLabel: { color: palette.ink, fontFamily: type.familyStrong, fontSize: 14, fontWeight: "700" },
  timePickerButton: { alignSelf: "flex-start", borderRadius: 14, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  timePickerText: { color: palette.accentDark, fontFamily: type.familyStrong, fontSize: 16, fontWeight: "700" },
  nudgeInput: { maxWidth: 180 },
  chartCard: { gap: spacing.lg },
  segmented: { flexDirection: "row", backgroundColor: palette.surfaceStrong, borderRadius: 14, padding: 3 },
  rangeButton: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: 11 },
  rangeButtonActive: { backgroundColor: palette.surface },
  rangeButtonPressed: { opacity: 0.75 },
  rangeText: { color: palette.muted, fontFamily: type.familyStrong, fontSize: 12, fontWeight: "800" },
  rangeTextActive: { color: palette.accentDark },
  chartWrap: { width: "100%", maxWidth: "100%", height: 178, flexDirection: "row", gap: spacing.sm, overflow: "hidden" },
  chartPlot: { flex: 1, minWidth: 0, height: 150, marginTop: spacing.md, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: palette.line, position: "relative" },
  chartSegment: { position: "absolute", height: 3, borderRadius: 2, backgroundColor: palette.accent, transformOrigin: "left center" },
  chartPoint: { position: "absolute", width: 10, height: 10, borderRadius: 5, backgroundColor: palette.surface, borderWidth: 3, borderColor: palette.accent },
  thresholdLine: { position: "absolute", left: 0, right: 34, borderTopWidth: 1, borderStyle: "dashed", borderColor: palette.highSoft },
  thresholdLineLow: { borderColor: palette.lowSoft },
  chartAxis: { flexShrink: 0, justifyContent: "space-between", paddingVertical: spacing.md },
  axisText: { color: palette.faint, fontFamily: type.familyStrong, fontSize: 11, fontWeight: "700" },
  quickCard: { gap: spacing.lg, backgroundColor: palette.accentSoft },
  quickCopy: { gap: spacing.xs },
  quickTitle: { color: palette.accentDark, fontFamily: type.familyStrong, fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  screeningCard: { gap: spacing.lg },
  screeningRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  screeningNumber: { flexShrink: 1, color: palette.inRange, fontFamily: type.familyStrong, fontSize: 58, fontWeight: "800", letterSpacing: -2 },
  screeningOverdue: { color: palette.low },
  screeningCopy: { flex: 1, minWidth: 0, gap: spacing.sm },
  nudgeCard: { gap: spacing.lg, backgroundColor: "#f8efe1" },
  nudgeRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  nudgeDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: palette.accent, marginTop: 4 },
  nudgeTextBlock: { flex: 1, minWidth: 0, gap: 2 },
  nudgeTitle: { flexShrink: 1, color: palette.ink, fontFamily: type.familyStrong, fontSize: 16, fontWeight: "800" },
  accessCard: { gap: spacing.md },
  requestCard: { borderRadius: 20, backgroundColor: palette.surfaceStrong, padding: spacing.md, gap: spacing.md },
  requestActions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  codePanel: { borderRadius: 20, backgroundColor: "#f7efe3", padding: spacing.lg, gap: spacing.md },
  codeLabel: { color: palette.muted, fontFamily: type.familyStrong, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  code: { color: palette.ink, fontFamily: type.familyStrong, fontSize: 34, fontWeight: "800", letterSpacing: 8, textAlign: "center" },
  linkRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: palette.caregiverSoft, alignItems: "center", justifyContent: "center" },
  avatarText: { color: palette.caregiver, fontFamily: type.familyStrong, fontSize: 16, fontWeight: "800" },
  linkCopy: { flex: 1, minWidth: 0 },
  linkName: { flexShrink: 1, color: palette.ink, fontFamily: type.familyStrong, fontSize: 16, fontWeight: "800" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(30,42,39,0.28)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: palette.paper, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: spacing.xl, gap: spacing.lg, maxHeight: "92%" },
  successState: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: spacing.md },
  successIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: palette.inRangeSoft },
  successCheck: { color: palette.inRange, fontFamily: type.familyStrong, fontSize: 34, fontWeight: "800" },
  modalHandle: { width: 48, height: 5, borderRadius: 999, backgroundColor: palette.line, alignSelf: "center" },
  kindGrid: { flexDirection: "row", gap: spacing.sm },
  kindButton: { flex: 1, minWidth: 0, borderRadius: 18, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, padding: spacing.md, gap: 3 },
  kindButtonActive: { borderColor: palette.accent, backgroundColor: palette.accentSoft },
  kindButtonPressed: { transform: [{ translateY: 1 }], opacity: 0.8 },
  kindLabel: { flexShrink: 1, color: palette.ink, fontFamily: type.familyStrong, fontSize: 15, fontWeight: "800" },
  kindLabelActive: { color: palette.accentDark },
  kindDetail: { flexShrink: 1, color: palette.muted, fontFamily: type.family, fontSize: 12 },
  kindDetailActive: { color: palette.accentDark },
  quickInput: { fontFamily: type.familyStrong, fontSize: 36, fontWeight: "800", textAlign: "center", minHeight: 74 },
  modalActions: { gap: spacing.sm },
  caregiverHero: { gap: spacing.md, backgroundColor: "#f8ead7" },
  caregiverTitle: { flexShrink: 1, color: palette.ink, fontFamily: type.familyStrong, fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  patientBridgeCard: { gap: spacing.lg },
  patientIdentity: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: 1, borderBottomColor: palette.line, paddingBottom: spacing.md },
  patientAvatar: { backgroundColor: palette.accentSoft },
  patientAvatarText: { color: palette.accentDark },
  patientIdentityCopy: { flex: 1, minWidth: 0, gap: 2 },
  patientName: { flexShrink: 1, color: palette.ink, fontFamily: type.familyStrong, fontSize: 18, fontWeight: "800" },
  patientIdentityDetail: { color: palette.muted, fontFamily: type.family, fontSize: 13 },
  bridgeMetrics: { flexDirection: "row", gap: spacing.sm },
  patientTrend: { gap: spacing.sm, borderRadius: 18, backgroundColor: palette.surfaceStrong, padding: spacing.md },
  trendSummaryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  trendSummaryTitle: { flexShrink: 1, color: palette.ink, fontFamily: type.familyStrong, fontSize: 14, fontWeight: "800" },
  trendSummaryDetail: { flexShrink: 1, color: palette.muted, fontFamily: type.family, fontSize: 12, textAlign: "right" },
  sparkline: { width: "100%", height: 44, position: "relative" },
  sparklineSegment: { position: "absolute", height: 2, borderRadius: 2, backgroundColor: palette.caregiver },
  sparklinePoint: { position: "absolute", width: 6, height: 6, borderRadius: 3, backgroundColor: palette.surface, borderWidth: 1.5, borderColor: palette.caregiver },
  sparklineEmpty: { color: palette.faint, fontFamily: type.family, fontSize: 12, alignSelf: "center", marginTop: spacing.md },
  checkinSection: { gap: spacing.md, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: spacing.lg },
  todayCheckin: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, borderRadius: 16, backgroundColor: palette.caregiverSoft, padding: spacing.md },
  todayCheckinCopy: { flex: 1, minWidth: 0, gap: 2 },
  todayCheckinTitle: { flexShrink: 1, color: palette.ink, fontFamily: type.familyStrong, fontSize: 15, fontWeight: "800" },
  checkinHistory: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.sm },
  historyDay: { alignItems: "center", gap: spacing.xs },
  historyDate: { color: palette.faint, fontFamily: type.familyStrong, fontSize: 11, fontWeight: "700" },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statusDot_ok: { backgroundColor: palette.inRange },
  statusDot_missed: { backgroundColor: palette.caregiver },
  statusDot_concern: { backgroundColor: palette.low },
  statusDot_empty: { backgroundColor: palette.surfaceStrong, borderWidth: 1, borderColor: palette.line },
  clinicCard: { gap: spacing.md, backgroundColor: palette.clinicSoft },
  clinicTitle: { color: palette.clinic, fontFamily: type.familyStrong, fontSize: 24, fontWeight: "800", letterSpacing: -0.4 },
  settingsCard: { gap: spacing.lg },
  settingsRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: spacing.md },
  settingsLabel: { color: palette.muted, fontFamily: type.familyStrong, fontSize: 14, fontWeight: "700" },
  settingsValue: { flexShrink: 1, minWidth: 0, color: palette.ink, fontFamily: type.familyStrong, fontSize: 14, fontWeight: "700", textAlign: "right" },
});
