import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export const palette = {
  ink: "#1e2a27",
  muted: "#6f7f79",
  faint: "#9aa7a2",
  paper: "#fbf7ef",
  surface: "#fffdf8",
  surfaceStrong: "#f2eadf",
  line: "#ded5c7",
  accent: "#12776c",
  accentDark: "#0d5a52",
  accentSoft: "#d9eee9",
  caregiver: "#8c5f2f",
  caregiverSoft: "#f2e5d4",
  clinic: "#305f7f",
  clinicSoft: "#dbe9f0",
  low: "#b96b20",
  lowSoft: "#f7e4cc",
  inRange: "#16785f",
  inRangeSoft: "#dcefe7",
  high: "#9a4d56",
  highSoft: "#f1d8db",
  danger: "#9b3d35",
  dangerSoft: "#f3dcd8",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const type = {
  family: Platform.select({ ios: "Avenir Next", android: "sans-serif", default: undefined }),
  familyStrong: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: undefined }),
} as const;

type Tone = "primary" | "secondary" | "quiet" | "danger";

interface AppButtonProps extends Omit<PressableProps, "style"> {
  label: string;
  tone?: Tone;
  compact?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AppButton({
  label,
  tone = "primary",
  compact = false,
  loading = false,
  disabled,
  style,
  ...props
}: AppButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${tone}`],
        compact && styles.buttonCompact,
        pressed && !isDisabled && styles.buttonPressed,
        isDisabled && styles.buttonDisabled,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={tone === "primary" ? palette.surface : palette.accent} />
      ) : (
        <Text style={[styles.buttonText, styles[`buttonText_${tone}`]]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style, elevated = false }: { children: ReactNode; style?: StyleProp<ViewStyle>; elevated?: boolean }) {
  return <View style={[styles.card, elevated && styles.cardElevated, style]}>{children}</View>;
}

export function SectionHeader({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionCopy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action}
    </View>
  );
}

export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "low" | "range" | "high" | "caregiver" | "clinic" | "danger";
}) {
  const backgroundColor = useSharedValue<string>(statusBackground[tone]);
  const animatedBackground = useAnimatedStyle(() => ({ backgroundColor: backgroundColor.value }));

  useEffect(() => {
    backgroundColor.value = withTiming(statusBackground[tone], { duration: 280 });
  }, [backgroundColor, tone]);

  return (
    <Animated.View style={[styles.statusPill, animatedBackground]}>
      <Text style={[styles.statusText, styles[`statusText_${tone}`]]}>{label}</Text>
    </Animated.View>
  );
}

const statusBackground: Record<NonNullable<Parameters<typeof StatusPill>[0]["tone"]>, string> = {
  neutral: palette.surfaceStrong,
  low: palette.lowSoft,
  range: palette.inRangeSoft,
  high: palette.highSoft,
  caregiver: palette.caregiverSoft,
  clinic: palette.clinicSoft,
  danger: palette.dangerSoft,
};

export function Field({ label, helper, style, ...props }: TextInputProps & { label: string; helper?: string; style?: StyleProp<TextStyle> }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={palette.faint}
        style={[styles.field, style]}
        selectionColor={palette.accent}
        {...props}
      />
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Card style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action}
    </Card>
  );
}

export function MetricTile({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <View style={styles.metricTile}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {detail ? <Text style={styles.metricDetail}>{detail}</Text> : null}
    </View>
  );
}

export function CountUpMetricTile({ label, value, detail }: { label: string; value: number; detail?: string }) {
  const animatedValue = useSharedValue(value);
  const [displayedValue, setDisplayedValue] = useState(value);

  useEffect(() => {
    animatedValue.value = withTiming(value, { duration: 400 });
  }, [animatedValue, value]);

  useAnimatedReaction(
    () => Math.round(animatedValue.value),
    (next, previous) => {
      if (next !== previous) runOnJS(setDisplayedValue)(next);
    }
  );

  return <MetricTile label={label} value={displayedValue} detail={detail} />;
}

export function InlineMessage({ tone = "neutral", children }: { tone?: "neutral" | "danger" | "success"; children: ReactNode }) {
  return (
    <View style={[styles.inlineMessage, tone === "danger" && styles.inlineDanger, tone === "success" && styles.inlineSuccess]}>
      <Text style={[styles.inlineText, tone === "danger" && styles.inlineDangerText, tone === "success" && styles.inlineSuccessText]}>{children}</Text>
    </View>
  );
}

export const uiStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.paper },
  screen: { padding: spacing.xl, paddingBottom: 40, gap: spacing.xl },
  row: { flexDirection: "row", alignItems: "center" },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  muted: { color: palette.muted, fontFamily: type.family, lineHeight: 21 },
  title: { color: palette.ink, fontFamily: type.familyStrong, fontSize: 30, fontWeight: "700", letterSpacing: -0.6 },
  subtitle: { color: palette.muted, fontFamily: type.family, fontSize: 16, lineHeight: 23 },
});

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: 18,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  buttonCompact: { minHeight: 38, borderRadius: 14, paddingVertical: spacing.sm },
  buttonPressed: { transform: [{ translateY: 1 }], opacity: 0.86 },
  buttonDisabled: { opacity: 0.52 },
  button_primary: { backgroundColor: palette.accent, borderColor: palette.accent },
  button_secondary: { backgroundColor: palette.accentSoft, borderColor: palette.accentSoft },
  button_quiet: { backgroundColor: "transparent", borderColor: palette.line },
  button_danger: { backgroundColor: palette.dangerSoft, borderColor: palette.dangerSoft },
  buttonText: { fontFamily: type.familyStrong, fontSize: 15, fontWeight: "700" },
  buttonText_primary: { color: palette.surface },
  buttonText_secondary: { color: palette.accentDark },
  buttonText_quiet: { color: palette.ink },
  buttonText_danger: { color: palette.danger },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing.lg,
  },
  cardElevated: {
    borderColor: "#d5cab8",
  },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.md, minWidth: 0 },
  sectionCopy: { gap: spacing.xs, flex: 1, flexShrink: 1, minWidth: 0 },
  eyebrow: {
    color: palette.accentDark,
    fontFamily: type.familyStrong,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  sectionTitle: { flexShrink: 1, color: palette.ink, fontFamily: type.familyStrong, fontSize: 20, fontWeight: "700", letterSpacing: -0.2 },
  statusPill: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6 },
  statusText: { fontFamily: type.familyStrong, fontSize: 12, fontWeight: "700" },
  status_neutral: { backgroundColor: palette.surfaceStrong },
  status_low: { backgroundColor: palette.lowSoft },
  status_range: { backgroundColor: palette.inRangeSoft },
  status_high: { backgroundColor: palette.highSoft },
  status_caregiver: { backgroundColor: palette.caregiverSoft },
  status_clinic: { backgroundColor: palette.clinicSoft },
  status_danger: { backgroundColor: palette.dangerSoft },
  statusText_neutral: { color: palette.muted },
  statusText_low: { color: palette.low },
  statusText_range: { color: palette.inRange },
  statusText_high: { color: palette.high },
  statusText_caregiver: { color: palette.caregiver },
  statusText_clinic: { color: palette.clinic },
  statusText_danger: { color: palette.danger },
  fieldWrap: { gap: spacing.sm },
  fieldLabel: { color: palette.ink, fontFamily: type.familyStrong, fontSize: 14, fontWeight: "700" },
  field: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.lg,
    color: palette.ink,
    fontFamily: type.family,
    fontSize: 17,
  },
  helper: { color: palette.muted, fontFamily: type.family, fontSize: 13, lineHeight: 18 },
  emptyState: { gap: spacing.sm, backgroundColor: "#f9f1e5" },
  emptyTitle: { color: palette.ink, fontFamily: type.familyStrong, fontSize: 18, fontWeight: "700" },
  emptyBody: { color: palette.muted, fontFamily: type.family, lineHeight: 21 },
  metricTile: {
    flex: 1,
    flexShrink: 1,
    minWidth: 96,
    borderRadius: 20,
    backgroundColor: palette.surfaceStrong,
    padding: spacing.md,
    gap: 2,
  },
  metricValue: { flexShrink: 1, color: palette.ink, fontFamily: type.familyStrong, fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  metricLabel: { flexShrink: 1, color: palette.muted, fontFamily: type.familyStrong, fontSize: 12, fontWeight: "700" },
  metricDetail: { flexShrink: 1, color: palette.faint, fontFamily: type.family, fontSize: 12 },
  inlineMessage: { borderRadius: 16, backgroundColor: palette.surfaceStrong, padding: spacing.md },
  inlineDanger: { backgroundColor: palette.dangerSoft },
  inlineSuccess: { backgroundColor: palette.inRangeSoft },
  inlineText: { color: palette.muted, fontFamily: type.family, lineHeight: 20 },
  inlineDangerText: { color: palette.danger },
  inlineSuccessText: { color: palette.inRange },
});
