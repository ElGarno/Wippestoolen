import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useTool } from "../../../hooks/useTools";
import { useCreateBooking } from "../../../hooks/useBookings";
import { Button } from "../../../components/ui/Button";
import { colors } from "../../../constants/colors";

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
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function daysBetween(start: string, end: string): number {
  const s = parseDateString(start);
  const e = parseDateString(end);
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

/** Inline date stepper with orange stepper buttons. */
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
    <View style={styles.stepperWrapper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <TouchableOpacity style={styles.stepperBtn} onPress={() => step(-1)}>
          <Text style={styles.stepperBtnText}>−</Text>
        </TouchableOpacity>
        <View style={styles.stepperValueBox}>
          <Text style={styles.stepperValue}>{formatDateDisplay(value)}</Text>
        </View>
        <TouchableOpacity style={styles.stepperBtn} onPress={() => step(1)}>
          <Text style={styles.stepperBtnText}>+</Text>
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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  if (!tool) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>Werkzeug nicht gefunden</Text>
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
      <Stack.Screen
        options={{
          title: "Jetzt ausleihen",
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 8 }}>
              <Text style={{ fontSize: 17, color: colors.primary[600] }}>‹ Zurück</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView style={styles.scrollView}>
        {/* Gradient header with tool title */}
        <LinearGradient
          colors={[colors.gradient.start, colors.gradient.end]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientHeader}
        >
          <Text style={styles.gradientTitle}>{tool.title}</Text>
          <Text style={styles.gradientSubtitle}>{tool.category.name}</Text>
        </LinearGradient>

        <View style={styles.content}>
          {/* Tool summary card */}
          <View style={styles.card}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tagesrate</Text>
              <Text style={styles.summaryValue}>
                {dailyRate > 0 ? `${dailyRate.toFixed(2)} €` : "Kostenlos"}
              </Text>
            </View>
            {depositAmount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Kaution</Text>
                <Text style={styles.summaryValue}>{depositAmount.toFixed(2)} €</Text>
              </View>
            )}
          </View>

          {/* Date section */}
          <Text style={styles.sectionTitle}>Zeitraum</Text>
          <View style={styles.card}>
            <DateStepper
              label="Von"
              value={startDate}
              onChange={(v) => {
                setStartDate(v);
                if (endDate < v) setEndDate(v);
              }}
            />
            <DateStepper
              label="Bis"
              value={endDate}
              onChange={setEndDate}
              minDate={startDate}
            />
          </View>

          {/* Pickup method */}
          <Text style={styles.sectionTitle}>Abholung</Text>
          <View style={styles.pickupRow}>
            <TouchableOpacity
              style={[
                styles.pickupOption,
                pickupMethod === "pickup" ? styles.pickupOptionActive : styles.pickupOptionInactive,
              ]}
              onPress={() => setPickupMethod("pickup")}
            >
              <Text
                style={[
                  styles.pickupOptionText,
                  pickupMethod === "pickup"
                    ? styles.pickupOptionTextActive
                    : styles.pickupOptionTextInactive,
                ]}
              >
                Selbst abholen
              </Text>
            </TouchableOpacity>
            {tool.delivery_available && (
              <TouchableOpacity
                style={[
                  styles.pickupOption,
                  pickupMethod === "delivery"
                    ? styles.pickupOptionActive
                    : styles.pickupOptionInactive,
                ]}
                onPress={() => setPickupMethod("delivery")}
              >
                <Text
                  style={[
                    styles.pickupOptionText,
                    pickupMethod === "delivery"
                      ? styles.pickupOptionTextActive
                      : styles.pickupOptionTextInactive,
                  ]}
                >
                  Lieferung
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {pickupMethod === "delivery" && (
            <View style={styles.card}>
              <Text style={styles.inputLabel}>Lieferadresse</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Straße, Hausnummer, PLZ Ort"
                placeholderTextColor={colors.gray[400]}
                value={pickupAddress}
                onChangeText={setPickupAddress}
                multiline
              />
            </View>
          )}

          {/* Message */}
          <Text style={styles.sectionTitle}>Nachricht (optional)</Text>
          <TextInput
            style={[styles.textInput, styles.messageInput]}
            placeholder="Stell dich kurz vor oder erkläre den Verwendungszweck..."
            placeholderTextColor={colors.gray[400]}
            value={message}
            onChangeText={setMessage}
            multiline
            textAlignVertical="top"
          />

          {/* Cost summary */}
          <View style={[styles.card, styles.costCard]}>
            <Text style={styles.cardTitle}>Kostenübersicht</Text>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>
                {days} {days === 1 ? "Tag" : "Tage"} × {dailyRate.toFixed(2)} €
              </Text>
              <Text style={styles.costValue}>{subtotal.toFixed(2)} €</Text>
            </View>
            {depositAmount > 0 && (
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Kaution (rückerstattbar)</Text>
                <Text style={styles.costValue}>{depositAmount.toFixed(2)} €</Text>
              </View>
            )}
            <View style={styles.costTotalRow}>
              <Text style={styles.costTotalLabel}>Gesamt</Text>
              <Text style={styles.costTotalValue}>{total.toFixed(2)} €</Text>
            </View>
          </View>

          <Button
            title="Anfrage senden"
            onPress={handleSubmit}
            isLoading={createBooking.isPending}
          />
          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gray[50],
  },
  notFoundText: {
    color: colors.gray[500],
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  gradientHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  gradientTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.white,
    letterSpacing: -0.3,
  },
  gradientSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 3,
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.gray[900],
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.gray[500],
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray[900],
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.gray[900],
    marginBottom: 10,
    marginTop: 4,
  },
  stepperWrapper: {
    marginBottom: 14,
  },
  stepperLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.gray[700],
    marginBottom: 6,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.white,
  },
  stepperBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: colors.primary[50],
  },
  stepperBtnText: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.primary[600],
  },
  stepperValueBox: {
    flex: 1,
    alignItems: "center",
  },
  stepperValue: {
    fontSize: 15,
    color: colors.gray[900],
    fontWeight: "500",
  },
  pickupRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  pickupOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1.5,
  },
  pickupOptionActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  pickupOptionInactive: {
    backgroundColor: colors.white,
    borderColor: colors.gray[300],
  },
  pickupOptionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  pickupOptionTextActive: {
    color: colors.white,
  },
  pickupOptionTextInactive: {
    color: colors.gray[700],
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.gray[700],
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: colors.white,
    color: colors.gray[900],
    marginBottom: 16,
  },
  messageInput: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  costCard: {
    marginBottom: 20,
  },
  costRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  costLabel: {
    fontSize: 13,
    color: colors.gray[500],
  },
  costValue: {
    fontSize: 13,
    color: colors.gray[900],
  },
  costTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
    marginTop: 8,
    paddingTop: 10,
  },
  costTotalLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.gray[900],
  },
  costTotalValue: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.primary[600],
  },
  bottomSpacer: {
    height: 32,
  },
});
