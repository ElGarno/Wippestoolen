import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useTool } from "../../../hooks/useTools";
import { useCreateBooking } from "../../../hooks/useBookings";
import { Button } from "../../../components/ui/Button";

function parseDateString(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateDisplay(dateStr: string): string {
  const date = parseDateString(dateStr);
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
}

function daysBetween(start: string, end: string): number {
  const s = parseDateString(start);
  const e = parseDateString(end);
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

/** Simple inline date stepper (no native date picker dependency needed). */
function DateStepper({
  label,
  value,
  onChange,
  minDate,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  minDate?: string;
}) {
  const step = (delta: number) => {
    const d = parseDateString(value);
    d.setDate(d.getDate() + delta);
    const next = formatDate(d);
    if (minDate && next < minDate) return;
    onChange(next);
  };

  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-700 mb-1">{label}</Text>
      <View className="flex-row items-center border border-gray-300 rounded-lg overflow-hidden bg-white">
        <TouchableOpacity className="px-4 py-3" onPress={() => step(-1)}>
          <Text className="text-lg text-primary-600 font-bold">−</Text>
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className="text-base text-gray-900">{formatDateDisplay(value)}</Text>
        </View>
        <TouchableOpacity className="px-4 py-3" onPress={() => step(1)}>
          <Text className="text-lg text-primary-600 font-bold">+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function BookToolScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: tool, isLoading } = useTool(id);
  const createBooking = useCreateBooking();

  const today = formatDate(new Date());
  const tomorrow = formatDate(new Date(Date.now() + 86400000));

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(tomorrow);
  const [message, setMessage] = useState("");
  const [pickupMethod, setPickupMethod] = useState<"pickup" | "delivery">("pickup");
  const [pickupAddress, setPickupAddress] = useState("");

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!tool) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-500">Werkzeug nicht gefunden</Text>
      </View>
    );
  }

  const days = daysBetween(startDate, endDate);
  const dailyRate = Number(tool.daily_rate);
  const depositAmount = Number(tool.deposit_amount);
  const subtotal = dailyRate * days;
  const total = subtotal + depositAmount;

  // Ensure end >= start
  const effectiveEnd = endDate < startDate ? startDate : endDate;

  const handleSubmit = async () => {
    if (endDate < startDate) {
      Alert.alert("Ungültige Daten", "Das Enddatum muss nach dem Startdatum liegen.");
      return;
    }
    if (pickupMethod === "delivery" && !pickupAddress.trim()) {
      Alert.alert("Adresse fehlt", "Bitte gib eine Lieferadresse ein.");
      return;
    }

    try {
      const booking = await createBooking.mutateAsync({
        tool_id: tool.id,
        requested_start_date: startDate,
        requested_end_date: effectiveEnd,
        borrower_message: message.trim() || undefined,
        pickup_method: pickupMethod,
        pickup_address: pickupMethod === "delivery" ? pickupAddress.trim() : undefined,
      });
      Alert.alert(
        "Anfrage gesendet!",
        "Deine Buchungsanfrage wurde erfolgreich gesendet. Der Vermieter wird benachrichtigt.",
        [
          {
            text: "OK",
            onPress: () => router.replace(`/booking/${booking.id}`),
          },
        ]
      );
    } catch {
      Alert.alert("Fehler", "Die Buchungsanfrage konnte nicht gesendet werden.");
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Jetzt ausleihen", headerBackTitle: "Zurück" }} />
      <ScrollView className="flex-1 bg-gray-50">
        <View className="p-4">
          {/* Tool summary */}
          <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100 shadow-sm">
            <Text className="text-lg font-bold text-gray-900">{tool.title}</Text>
            <Text className="text-sm text-gray-500 mt-0.5">{tool.category.name}</Text>
            <View className="flex-row justify-between mt-2">
              <Text className="text-sm text-gray-500">Tagesrate</Text>
              <Text className="text-sm font-semibold text-gray-900">
                {dailyRate > 0 ? `${dailyRate.toFixed(2)} €` : "Kostenlos"}
              </Text>
            </View>
            {depositAmount > 0 && (
              <View className="flex-row justify-between mt-1">
                <Text className="text-sm text-gray-500">Kaution</Text>
                <Text className="text-sm font-semibold text-gray-900">
                  {depositAmount.toFixed(2)} €
                </Text>
              </View>
            )}
          </View>

          {/* Dates */}
          <Text className="text-base font-semibold text-gray-900 mb-3">Zeitraum</Text>
          <DateStepper label="Von" value={startDate} onChange={(v) => {
            setStartDate(v);
            if (endDate < v) setEndDate(v);
          }} />
          <DateStepper label="Bis" value={endDate} onChange={setEndDate} minDate={startDate} />

          {/* Pickup method */}
          <Text className="text-base font-semibold text-gray-900 mb-3 mt-2">Abholung</Text>
          <View className="flex-row mb-4 gap-2">
            <TouchableOpacity
              className={`flex-1 py-3 rounded-lg border items-center ${
                pickupMethod === "pickup"
                  ? "bg-primary-600 border-primary-600"
                  : "bg-white border-gray-300"
              }`}
              onPress={() => setPickupMethod("pickup")}
            >
              <Text
                className={`font-medium ${
                  pickupMethod === "pickup" ? "text-white" : "text-gray-700"
                }`}
              >
                Selbst abholen
              </Text>
            </TouchableOpacity>
            {tool.delivery_available && (
              <TouchableOpacity
                className={`flex-1 py-3 rounded-lg border items-center ${
                  pickupMethod === "delivery"
                    ? "bg-primary-600 border-primary-600"
                    : "bg-white border-gray-300"
                }`}
                onPress={() => setPickupMethod("delivery")}
              >
                <Text
                  className={`font-medium ${
                    pickupMethod === "delivery" ? "text-white" : "text-gray-700"
                  }`}
                >
                  Lieferung
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {pickupMethod === "delivery" && (
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-1">Lieferadresse</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white"
                placeholder="Straße, Hausnummer, PLZ Ort"
                placeholderTextColor="#9ca3af"
                value={pickupAddress}
                onChangeText={setPickupAddress}
                multiline
              />
            </View>
          )}

          {/* Message */}
          <Text className="text-base font-semibold text-gray-900 mb-1 mt-2">
            Nachricht (optional)
          </Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white mb-4 min-h-[80px]"
            placeholder="Stell dich kurz vor oder erkläre den Verwendungszweck..."
            placeholderTextColor="#9ca3af"
            value={message}
            onChangeText={setMessage}
            multiline
            textAlignVertical="top"
          />

          {/* Cost summary */}
          <View className="bg-white rounded-xl p-4 mb-6 border border-gray-100 shadow-sm">
            <Text className="text-base font-semibold text-gray-900 mb-3">Kostenübersicht</Text>
            <View className="flex-row justify-between mb-1">
              <Text className="text-sm text-gray-500">
                {days} {days === 1 ? "Tag" : "Tage"} × {dailyRate.toFixed(2)} €
              </Text>
              <Text className="text-sm text-gray-900">{subtotal.toFixed(2)} €</Text>
            </View>
            {depositAmount > 0 && (
              <View className="flex-row justify-between mb-1">
                <Text className="text-sm text-gray-500">Kaution (rückerstattbar)</Text>
                <Text className="text-sm text-gray-900">{depositAmount.toFixed(2)} €</Text>
              </View>
            )}
            <View className="border-t border-gray-100 mt-2 pt-2 flex-row justify-between">
              <Text className="text-base font-semibold text-gray-900">Gesamt</Text>
              <Text className="text-base font-bold text-primary-600">{total.toFixed(2)} €</Text>
            </View>
          </View>

          <Button
            title="Anfrage senden"
            onPress={handleSubmit}
            isLoading={createBooking.isPending}
          />
        </View>
      </ScrollView>
    </>
  );
}
