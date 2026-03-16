import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, Switch } from "react-native";
import { useRouter, Stack } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import Constants from "expo-constants";
import { colors } from "../constants/colors";

function SectionLabel({ title }: { title: string }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: "700",
        color: colors.gray[400],
        textTransform: "uppercase",
        letterSpacing: 1,
        paddingHorizontal: 20,
        marginBottom: 8,
        marginTop: 4,
      }}
    >
      {title}
    </Text>
  );
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderRadius: 16,
        marginHorizontal: 16,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
        overflow: "hidden",
      }}
    >
      {children}
    </View>
  );
}

function SettingsRow({
  label,
  value,
  onPress,
  rightElement,
  isDestructive,
  isLast,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  isDestructive?: boolean;
  isLast?: boolean;
}) {
  const content = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.gray[100],
      }}
    >
      <Text
        style={{
          flex: 1,
          fontSize: 16,
          color: isDestructive ? colors.error : colors.gray[800],
          fontWeight: isDestructive ? "500" : "400",
        }}
      >
        {label}
      </Text>
      {value && (
        <Text style={{ fontSize: 14, color: colors.gray[400], marginRight: 8 }}>{value}</Text>
      )}
      {rightElement}
      {onPress && !rightElement && (
        <Text style={{ fontSize: 20, color: colors.primary[600], fontWeight: "300" }}>›</Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.6}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { logout } = useAuth();

  // Notification preferences (local state — would be persisted to backend in production)
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [bookingNotifications, setBookingNotifications] = useState(true);
  const [reviewNotifications, setReviewNotifications] = useState(true);

  const appVersion =
    Constants.expoConfig?.version ?? Constants.manifest?.version ?? "1.0.0";

  const handleLogout = () => {
    Alert.alert("Abmelden", "Möchtest du dich wirklich abmelden?", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Abmelden",
        style: "destructive",
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: colors.gray[50] }}>
        <View style={{ backgroundColor: colors.white, paddingTop: 56, paddingBottom: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.gray[200] }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 17, color: colors.primary[600] }}>‹ Zurück</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: "700", color: colors.gray[900] }}>Einstellungen</Text>
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}
        >
        {/* Notifications */}
        <SectionLabel title="Benachrichtigungen" />
        <SettingsCard>
          <SettingsRow
            label="In-App Benachrichtigungen"
            rightElement={
              <Switch
                value={inAppEnabled}
                onValueChange={setInAppEnabled}
                trackColor={{ false: colors.gray[300], true: colors.primary[600] }}
                thumbColor={colors.white}
                ios_backgroundColor={colors.gray[300]}
              />
            }
          />
          <SettingsRow
            label="Buchungsbenachrichtigungen"
            rightElement={
              <Switch
                value={bookingNotifications}
                onValueChange={setBookingNotifications}
                trackColor={{ false: colors.gray[300], true: colors.primary[600] }}
                thumbColor={colors.white}
                ios_backgroundColor={colors.gray[300]}
              />
            }
          />
          <SettingsRow
            label="Bewertungsbenachrichtigungen"
            isLast
            rightElement={
              <Switch
                value={reviewNotifications}
                onValueChange={setReviewNotifications}
                trackColor={{ false: colors.gray[300], true: colors.primary[600] }}
                thumbColor={colors.white}
                ios_backgroundColor={colors.gray[300]}
              />
            }
          />
        </SettingsCard>

        {/* Account */}
        <SectionLabel title="Konto" />
        <SettingsCard>
          <SettingsRow
            label="Profil bearbeiten"
            onPress={() => router.push("/(drawer)/(tabs)/profile")}
          />
          <SettingsRow
            label="Meine Buchungen"
            onPress={() => router.push("/my-bookings")}
          />
          <SettingsRow
            label="Meine Werkzeuge"
            isLast
            onPress={() => router.push("/my-tools")}
          />
        </SettingsCard>

        {/* App Info */}
        <SectionLabel title="Uber die App" />
        <SettingsCard>
          <SettingsRow label="Version" value={`v${appVersion}`} />
          <SettingsRow
            label="Datenschutz"
            onPress={() => Alert.alert("Datenschutz", "Deine Daten werden nur fuer die Werkzeugvermittlung verwendet und nicht an Dritte weitergegeben. Kontakt: datenschutz@wippestoolen.de")}
          />
          <SettingsRow
            label="Nutzungsbedingungen"
            isLast
            onPress={() => Alert.alert("Nutzungsbedingungen", "Mit der Nutzung von Wippestoolen akzeptierst du, dass du fuer ausgeliehene Werkzeuge verantwortlich bist und diese in gutem Zustand zurueckgibst.")}
          />
        </SettingsCard>

        {/* Logout */}
        <SectionLabel title="Sitzung" />
        <SettingsCard>
          <SettingsRow label="Abmelden" onPress={handleLogout} isDestructive isLast />
        </SettingsCard>
      </ScrollView>
      </View>
    </>
  );
}
