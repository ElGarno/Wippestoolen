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
    <View className="flex-1 items-center py-3 bg-gray-50 rounded-xl mx-1">
      <Text className="text-xl font-bold text-primary-600">{value}</Text>
      <Text className="text-xs text-gray-500 mt-0.5">{label}</Text>
    </View>
  );
}

function QuickLink({
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
      className="flex-row items-center px-4 py-3.5 border-b border-gray-50"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text className="text-xl w-8">{icon}</Text>
      <Text className="flex-1 text-base text-gray-800 ml-2">{label}</Text>
      <Text className="text-gray-400">›</Text>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, updateProfile, isLoading: authLoading } = useAuth();
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
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
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

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 pt-14 pb-4 border-b border-gray-100">
        <Text className="text-xl font-bold text-gray-900">Profil</Text>
      </View>

      <ScrollView>
        {/* Avatar & name */}
        <View className="bg-white px-4 py-6 items-center">
          <View className="w-20 h-20 bg-primary-100 rounded-full items-center justify-center mb-3">
            {user.avatar_url ? (
              <Text className="text-3xl">👤</Text>
            ) : (
              <Text className="text-3xl font-bold text-primary-600">
                {user.display_name.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <Text className="text-xl font-bold text-gray-900">{user.display_name}</Text>
          {(user.first_name || user.last_name) && (
            <Text className="text-sm text-gray-500 mt-0.5">
              {[user.first_name, user.last_name].filter(Boolean).join(" ")}
            </Text>
          )}
          {user.average_rating > 0 && (
            <View className="flex-row items-center mt-2">
              <StarRating rating={user.average_rating} size="sm" />
              <Text className="text-sm text-gray-500 ml-2">
                {Number(user.average_rating).toFixed(1)} ({user.total_ratings} Bewertungen)
              </Text>
            </View>
          )}
          {user.bio && (
            <Text className="text-sm text-gray-600 mt-3 text-center leading-5">{user.bio}</Text>
          )}
          <TouchableOpacity
            className="mt-4 border border-primary-600 px-6 py-2 rounded-lg"
            onPress={openEditModal}
          >
            <Text className="text-sm text-primary-600 font-medium">Profil bearbeiten</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View className="flex-row px-4 py-4">
          <StatCard label="Werkzeuge" value={toolCount} />
          <StatCard label="Ausleihungen" value={borrowerBookingCount} />
          <StatCard label="Bewertungen" value={reviewCount} />
        </View>

        {/* Quick links */}
        <View className="bg-white mx-4 rounded-xl border border-gray-100 shadow-sm mb-4">
          <QuickLink icon="🔧" label="Meine Werkzeuge" onPress={() => router.push("/my-tools")} />
          <QuickLink icon="📋" label="Meine Buchungen" onPress={() => router.push("/my-bookings")} />
          <QuickLink icon="🔔" label="Benachrichtigungen" onPress={() => router.push("/notifications")} />
          <QuickLink icon="⚙️" label="Einstellungen" onPress={() => router.push("/settings")} />
        </View>

        {/* Account info */}
        <View className="bg-white mx-4 rounded-xl border border-gray-100 shadow-sm mb-8">
          <View className="px-4 py-3 border-b border-gray-50">
            <Text className="text-xs text-gray-400 mb-0.5">E-Mail</Text>
            <Text className="text-sm text-gray-800">{user.email}</Text>
          </View>
          {user.phone_number && (
            <View className="px-4 py-3 border-b border-gray-50">
              <Text className="text-xs text-gray-400 mb-0.5">Telefon</Text>
              <Text className="text-sm text-gray-800">{user.phone_number}</Text>
            </View>
          )}
          <View className="px-4 py-3">
            <Text className="text-xs text-gray-400 mb-0.5">Mitglied seit</Text>
            <Text className="text-sm text-gray-800">
              {new Date(user.created_at).toLocaleDateString("de-DE", {
                month: "long",
                year: "numeric",
              })}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Edit profile modal */}
      <Modal visible={showEditModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-4 pt-14 pb-4 border-b border-gray-100">
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Text className="text-base text-gray-500">Abbrechen</Text>
            </TouchableOpacity>
            <Text className="text-base font-semibold text-gray-900">Profil bearbeiten</Text>
            <View className="w-16" />
          </View>

          <ScrollView className="p-4">
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
                className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white min-h-[80px]"
                placeholder="Erzähl etwas über dich..."
                placeholderTextColor="#9ca3af"
                value={bio}
                onChangeText={setBio}
                multiline
                textAlignVertical="top"
              />
            </View>
            <Button title="Speichern" onPress={handleSaveProfile} isLoading={isSaving} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
