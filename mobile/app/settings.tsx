import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, Switch } from "react-native";
import { useRouter, Stack } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import Constants from "expo-constants";

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-6">
      <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 mb-2">
        {title}
      </Text>
      <View className="bg-white rounded-xl border border-gray-100 shadow-sm mx-4">{children}</View>
    </View>
  );
}

function SettingsRow({
  label,
  value,
  onPress,
  rightElement,
  isDestructive,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  isDestructive?: boolean;
}) {
  const content = (
    <View className="flex-row items-center px-4 py-3.5 border-b border-gray-50">
      <Text className={`flex-1 text-base ${isDestructive ? "text-red-500" : "text-gray-800"}`}>
        {label}
      </Text>
      {value && <Text className="text-sm text-gray-400 mr-2">{value}</Text>}
      {rightElement}
      {onPress && !rightElement && <Text className="text-gray-400">›</Text>}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
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
      <Stack.Screen options={{ title: "Einstellungen", headerBackTitle: "Zurück" }} />
      <ScrollView className="flex-1 bg-gray-50 pt-4">
        {/* Notifications */}
        <SettingsSection title="Benachrichtigungen">
          <SettingsRow
            label="In-App Benachrichtigungen"
            rightElement={
              <Switch
                value={inAppEnabled}
                onValueChange={setInAppEnabled}
                trackColor={{ false: "#d1d5db", true: "#7c3aed" }}
                thumbColor="white"
              />
            }
          />
          <SettingsRow
            label="Buchungsbenachrichtigungen"
            rightElement={
              <Switch
                value={bookingNotifications}
                onValueChange={setBookingNotifications}
                trackColor={{ false: "#d1d5db", true: "#7c3aed" }}
                thumbColor="white"
              />
            }
          />
          <SettingsRow
            label="Bewertungsbenachrichtigungen"
            rightElement={
              <Switch
                value={reviewNotifications}
                onValueChange={setReviewNotifications}
                trackColor={{ false: "#d1d5db", true: "#7c3aed" }}
                thumbColor="white"
              />
            }
          />
        </SettingsSection>

        {/* Account */}
        <SettingsSection title="Konto">
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
            onPress={() => router.push("/my-tools")}
          />
        </SettingsSection>

        {/* Info */}
        <SettingsSection title="Über die App">
          <SettingsRow label="Version" value={`v${appVersion}`} />
          <SettingsRow label="Datenschutz" onPress={() => {}} />
          <SettingsRow label="Nutzungsbedingungen" onPress={() => {}} />
        </SettingsSection>

        {/* Logout */}
        <SettingsSection title="Sitzung">
          <SettingsRow
            label="Abmelden"
            onPress={handleLogout}
            isDestructive
          />
        </SettingsSection>

        <View className="h-8" />
      </ScrollView>
    </>
  );
}
