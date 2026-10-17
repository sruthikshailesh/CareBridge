import { Drawer } from "expo-router/drawer";
import {
  DrawerContentScrollView,
  DrawerItem,
  DrawerItemList,
  DrawerToggleButton,
  type DrawerContentComponentProps,
} from "expo-router/drawer";
import { StyleSheet, Text, View } from "react-native";
import { palette, spacing, type } from "../../components/carebridge-ui";
import { useAuth } from "../../auth";
import { CaregiverDataProvider, PatientDataProvider } from "../../components/tab-screens";

export default function DrawerLayout() {
  const { profile } = useAuth();
  if (!profile) return null;

  const isPatient = profile.role === "patient";
  const isCaregiver = profile.role === "caregiver";
  const isClinic = profile.role === "clinic";

  const drawer = (
    <Drawer
      initialRouteName={isClinic ? "dashboard" : "today"}
      drawerContent={(props) => <RoleDrawerContent {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: palette.paper },
        headerTintColor: palette.ink,
        headerTitleStyle: {
          fontFamily: type.familyStrong,
          fontWeight: "700",
        },
        headerLeft: () => <DrawerToggleButton tintColor={palette.accentDark} />,
        drawerPosition: "left",
        drawerStyle: {
          backgroundColor: palette.paper,
          width: 300,
        },
        drawerActiveTintColor: palette.accentDark,
        drawerActiveBackgroundColor: palette.accentSoft,
        drawerInactiveTintColor: palette.muted,
        drawerLabelStyle: {
          fontFamily: type.familyStrong,
          fontSize: 15,
          fontWeight: "700",
          marginLeft: -spacing.sm,
        },
        drawerItemStyle: {
          borderRadius: 14,
          marginHorizontal: spacing.md,
        },
      }}
    >
      <Drawer.Screen
        name="today"
        options={{
          title: "Today",
          drawerLabel: "Today",
          ...(!(isPatient || isCaregiver) && { drawerItemStyle: styles.hiddenDrawerItem }),
        }}
      />
      <Drawer.Screen
        name="trends"
        options={{
          title: "Trends",
          drawerLabel: "Trends",
          ...(!isPatient && { drawerItemStyle: styles.hiddenDrawerItem }),
        }}
      />
      <Drawer.Screen
        name="care-team"
        options={{
          title: "Care team",
          drawerLabel: "Care team",
          ...(!isPatient && { drawerItemStyle: styles.hiddenDrawerItem }),
        }}
      />
      <Drawer.Screen
        name="requests"
        options={{
          title: "Requests",
          drawerLabel: "Requests",
          ...(!isCaregiver && { drawerItemStyle: styles.hiddenDrawerItem }),
        }}
      />
      <Drawer.Screen
        name="settings"
        options={{
          title: "Settings",
          drawerLabel: "Settings",
          ...(!(isPatient || isCaregiver) && { drawerItemStyle: styles.hiddenDrawerItem }),
        }}
      />
      <Drawer.Screen
        name="nudges"
        options={{
          title: "Set Nudges",
          drawerLabel: "Set Nudges",
          ...(!isPatient && { drawerItemStyle: styles.hiddenDrawerItem }),
        }}
      />
      <Drawer.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          drawerLabel: "Dashboard",
          ...(!isClinic && { drawerItemStyle: styles.hiddenDrawerItem }),
        }}
      />
    </Drawer>
  );

  if (isPatient) {
    return <PatientDataProvider patientId={profile.uid}>{drawer}</PatientDataProvider>;
  }
  if (isCaregiver) {
    return <CaregiverDataProvider caregiverId={profile.uid}>{drawer}</CaregiverDataProvider>;
  }
  return drawer;
}

function RoleDrawerContent(props: DrawerContentComponentProps) {
  const { profile, signOutUser } = useAuth();
  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent}>
      <View style={styles.drawerIdentity}>
        <Text style={styles.drawerBrand}>CareBridge</Text>
        {profile ? <Text style={styles.drawerName}>{profile.displayName}</Text> : null}
      </View>
      <DrawerItemList {...props} />
      <DrawerItem
        label="Sign out"
        onPress={() => {
          void signOutUser();
        }}
        activeTintColor={palette.danger}
        inactiveTintColor={palette.danger}
        labelStyle={styles.signOutLabel}
        style={styles.signOutItem}
      />
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  hiddenDrawerItem: { display: "none" },
  drawerContent: { flexGrow: 1, paddingBottom: spacing.lg },
  drawerIdentity: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  drawerBrand: {
    color: palette.accentDark,
    fontFamily: type.familyStrong,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  drawerName: {
    color: palette.ink,
    fontFamily: type.familyStrong,
    fontSize: 20,
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  signOutItem: { marginTop: "auto" },
  signOutLabel: {
    color: palette.danger,
    fontFamily: type.familyStrong,
    fontSize: 15,
    fontWeight: "700",
    marginLeft: -spacing.sm,
  },
});
