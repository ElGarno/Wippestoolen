import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../../contexts/AuthContext";
import { useMyTools } from "../../../hooks/useTools";
import { useBookings } from "../../../hooks/useBookings";
import { useUserReviews } from "../../../hooks/useReviews";
import { StarRating } from "../../../components/reviews/StarRating";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import type { UpdateProfileRequest } from "../../../types";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View className="flex-1 items-center py-4 bg-white rounded-2xl mx-1.5 shadow-sm">
      <Text className="text-2xl font-bold" style={{ color: "#E8470A" }}>
        {value}
      </Text>
      <Text className="text-xs text-gray-500 mt-0.5 font-medium">{label}</Text>
    </View>
  );
}

function QuickActionCard({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      className="bg-white rounded-2xl p-4 mb-3 flex-row items-center shadow-sm"
      style={{ borderLeftWidth: 3, borderLeftColor: "#E8470A" }}
    >
      <View
        className="w-10 h-10 rounded-xl items-center justify-center mr-3"
        style={{ backgroundColor: "#FFF7ED" }}
      >
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </View>
      <Text className="flex-1 text-base font-semibold" style={{ color: "#1A1A1A" }}>
        {label}
      </Text>
      <Text className="text-gray-400 text-lg font-light">›</Text>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, updateProfile, isLoading: authLoading } = useAuth();
  const { data: myToolsData } = useMyTools();
  const { data: borrowerBookings } = useBookings({ role: "borrower", size: 100 });
  const { data: reviews } = useUserReviews(user?.id ?? "");

  const [showEditModal, setShowEditModal] = useState(false);
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [isSaving, setIsSaving] = useState(false);

  if (authLoading || !user) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: "#FAFAFA" }}>
        <ActivityIndicator size="large" color="#E8470A" />
      </View>
    );
  }

  const toolCount = myToolsData?.total ?? 0;
  const borrowerBookingCount = borrowerBookings?.pagination.total ?? 0;
  const reviewCount = reviews?.total ?? 0;

  const openEditModal = () => {
    setDisplayName(user.display_name);
    setFirstName(user.first_name ?? "");
    setLastName(user.last_name ?? "");
    setPhoneNumber(user.phone_number ?? "");
    setBio(user.bio ?? "");
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      Alert.alert("Name fehlt", "Bitte gib einen Anzeigenamen ein.");
      return;
    }
    setIsSaving(true);
    try {
      const payload: UpdateProfileRequest = {
        display_name: displayName.trim(),
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        phone_number: phoneNumber.trim() || undefined,
        bio: bio.trim() || undefined,
      };
      await updateProfile(payload);
      setShowEditModal(false);
      Alert.alert("Gespeichert!", "Dein Profil wurde aktualisiert.");
    } catch {
      Alert.alert("Fehler", "Profil konnte nicht gespeichert werden.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Abmelden", "Möchtest du dich wirklich abmelden?", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Abmelden",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
          } catch {
            Alert.alert("Fehler", "Abmelden fehlgeschlagen.");
          }
        },
      },
    ]);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: "#FAFAFA" }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Gradient header with avatar */}
        <LinearGradient
          colors={["#E8470A", "#F5A623"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: 60, paddingBottom: 40, paddingHorizontal: 24, alignItems: "center" }}
        >
          {/* Avatar circle */}
          <View
            className="w-24 h-24 rounded-full items-center justify-center mb-4 shadow-lg"
            style={{ backgroundColor: "rgba(255,255,255,0.25)", borderWidth: 3, borderColor: "rgba(255,255,255,0.6)" }}
          >
            <Text className="text-5xl font-bold text-white">
              {user.display_name.charAt(0).toUpperCase()}
            </Text>
          </View>

          <Text className="text-2xl font-bold text-white text-center">{user.display_name}</Text>

          {(user.first_name || user.last_name) && (
            <Text className="text-sm text-white opacity-80 mt-0.5">
              {[user.first_name, user.last_name].filter(Boolean).join(" ")}
            </Text>
          )}

          <Text className="text-sm text-white opacity-75 mt-1">{user.email}</Text>

          {user.average_rating > 0 && (
            <View className="flex-row items-center mt-2">
              <StarRating rating={user.average_rating} size="sm" />
              <Text className="text-sm text-white ml-2 opacity-90">
                {Number(user.average_rating).toFixed(1)} ({user.total_ratings} Bewertungen)
              </Text>
            </View>
          )}

          {user.bio && (
            <Text className="text-sm text-white opacity-85 mt-3 text-center leading-5 px-4">
              {user.bio}
            </Text>
          )}

          <TouchableOpacity
            onPress={openEditModal}
            activeOpacity={0.8}
            className="mt-5 px-6 py-2 rounded-xl"
            style={{ backgroundColor: "rgba(255,255,255,0.25)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }}
          >
            <Text className="text-white font-semibold text-sm">Profil bearbeiten</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Stats row */}
        <View className="flex-row px-4 -mt-5 mb-5">
          <StatCard label="Werkzeuge" value={toolCount} />
          <StatCard label="Ausleihen" value={borrowerBookingCount} />
          <StatCard label="Bewertungen" value={reviewCount} />
        </View>

        {/* Quick action cards */}
        <View className="px-4 mb-4">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Schnellzugriff
          </Text>
          <QuickActionCard
            icon="🔧"
            label="Meine Werkzeuge"
            onPress={() => router.push("/my-tools")}
          />
          <QuickActionCard
            icon="📋"
            label="Meine Buchungen"
            onPress={() => router.push("/my-bookings")}
          />
          <QuickActionCard
            icon="🔔"
            label="Benachrichtigungen"
            onPress={() => router.push("/notifications")}
          />
          <QuickActionCard
            icon="⚙️"
            label="Einstellungen"
            onPress={() => router.push("/settings")}
          />
        </View>

        {/* Account info card */}
        <View className="bg-white mx-4 rounded-2xl shadow-sm mb-5">
          <View className="px-4 py-3.5 border-b border-gray-50">
            <Text className="text-xs text-gray-400 mb-0.5 font-medium">E-Mail</Text>
            <Text className="text-sm text-gray-800">{user.email}</Text>
          </View>
          {user.phone_number && (
            <View className="px-4 py-3.5 border-b border-gray-50">
              <Text className="text-xs text-gray-400 mb-0.5 font-medium">Telefon</Text>
              <Text className="text-sm text-gray-800">{user.phone_number}</Text>
            </View>
          )}
          <View className="px-4 py-3.5">
            <Text className="text-xs text-gray-400 mb-0.5 font-medium">Mitglied seit</Text>
            <Text className="text-sm text-gray-800">
              {new Date(user.created_at).toLocaleDateString("de-DE", {
                month: "long",
                year: "numeric",
              })}
            </Text>
          </View>
        </View>

        {/* Logout button */}
        <View className="px-4 mb-10">
          <TouchableOpacity
            onPress={handleLogout}
            activeOpacity={0.75}
            className="py-3.5 rounded-2xl items-center"
            style={{ borderWidth: 2, borderColor: "#DC2626", backgroundColor: "transparent" }}
          >
            <Text className="font-semibold text-base" style={{ color: "#DC2626" }}>
              Abmelden
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit profile modal */}
      <Modal visible={showEditModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1" style={{ backgroundColor: "#FAFAFA" }}>
          {/* Modal header with gradient accent */}
          <LinearGradient
            colors={["#E8470A", "#F5A623"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16 }}
          >
            <View className="flex-row items-center justify-between">
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Text className="text-base text-white opacity-90">Abbrechen</Text>
              </TouchableOpacity>
              <Text className="text-base font-bold text-white">Profil bearbeiten</Text>
              <View className="w-20" />
            </View>
          </LinearGradient>

          <ScrollView className="p-4" keyboardShouldPersistTaps="handled">
            <View className="bg-white rounded-2xl p-4 shadow-sm mb-4">
              <Input
                label="Anzeigename *"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Dein Anzeigename"
              />
              <Input
                label="Vorname"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Vorname"
              />
              <Input
                label="Nachname"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Nachname"
              />
              <Input
                label="Telefon"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="+49 123 456789"
                keyboardType="phone-pad"
              />
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">Bio</Text>
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 text-base bg-gray-50 min-h-[80px]"
                  placeholder="Erzähl etwas über dich..."
                  placeholderTextColor="#9ca3af"
                  value={bio}
                  onChangeText={setBio}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </View>

            <TouchableOpacity
              onPress={handleSaveProfile}
              disabled={isSaving}
              activeOpacity={0.85}
              className="mb-6"
            >
              <LinearGradient
                colors={["#E8470A", "#F5A623"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  borderRadius: 16,
                  paddingVertical: 15,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  opacity: isSaving ? 0.7 : 1,
                }}
              >
                {isSaving && <ActivityIndicator color="white" style={{ marginRight: 8 }} />}
                <Text className="text-white font-bold text-base">Speichern</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
