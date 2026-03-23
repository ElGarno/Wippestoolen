import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, Switch, Linking, TextInput, Modal } from "react-native";
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
  const { logout, deleteAccount } = useAuth();

  // Notification preferences (local state — would be persisted to backend in production)
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [bookingNotifications, setBookingNotifications] = useState(true);
  const [reviewNotifications, setReviewNotifications] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDeleteAccount = () => {
    Alert.alert(
      "Account loeschen",
      "Bist du sicher? Alle deine Daten, Werkzeuge und Buchungen werden unwiderruflich geloescht.",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Ja, weiter",
          style: "destructive",
          onPress: () => {
            setDeletePassword("");
            setShowDeleteModal(true);
          },
        },
      ]
    );
  };

  const confirmDelete = async () => {
    if (!deletePassword) return;
    setIsDeleting(true);
    try {
      await deleteAccount(deletePassword);
      setShowDeleteModal(false);
    } catch {
      Alert.alert("Fehler", "Account konnte nicht geloescht werden. Bitte pruefe dein Passwort.");
    } finally {
      setIsDeleting(false);
    }
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
            onPress={() => Linking.openURL("https://api.wippestoolen.de/api/v1/privacy")}
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

        {/* Danger zone */}
        <SectionLabel title="Gefahrenzone" />
        <SettingsCard>
          <SettingsRow
            label="Account loeschen"
            onPress={handleDeleteAccount}
            isDestructive
            isLast
          />
        </SettingsCard>
      </ScrollView>
      </View>

      {/* Delete account password modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={{ backgroundColor: colors.white, borderRadius: 16, padding: 24, width: "85%", maxWidth: 340 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.gray[900], marginBottom: 8 }}>
              Passwort bestaetigen
            </Text>
            <Text style={{ fontSize: 14, color: colors.gray[500], marginBottom: 16 }}>
              Gib dein Passwort ein um die Loeschung zu bestaetigen.
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: colors.gray[300],
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 15,
                marginBottom: 16,
                color: colors.gray[900],
              }}
              placeholder="Passwort"
              placeholderTextColor={colors.gray[400]}
              secureTextEntry
              value={deletePassword}
              onChangeText={setDeletePassword}
              autoFocus
            />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.gray[100], alignItems: "center" }}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={{ fontSize: 15, color: colors.gray[700], fontWeight: "500" }}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.error, alignItems: "center", opacity: isDeleting ? 0.6 : 1 }}
                onPress={confirmDelete}
                disabled={isDeleting || !deletePassword}
              >
                <Text style={{ fontSize: 15, color: colors.white, fontWeight: "600" }}>
                  {isDeleting ? "Wird geloescht..." : "Endgueltig loeschen"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
