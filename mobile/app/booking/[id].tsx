import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useBooking, useConfirmBooking, useDeclineBooking, useCancelBooking, usePickupBooking, useReturnBooking } from "../../hooks/useBookings";
import { StatusBadge } from "../../components/bookings/StatusBadge";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../contexts/AuthContext";

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-2 border-b border-gray-50">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className="text-sm text-gray-900 font-medium">{value}</Text>
    </View>
  );
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data: booking, isLoading } = useBooking(id);

  const confirm = useConfirmBooking(id);
  const decline = useDeclineBooking(id);
  const cancel = useCancelBooking(id);
  const pickup = usePickupBooking(id);
  const returnBooking = useReturnBooking(id);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!booking) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-500">Buchung nicht gefunden</Text>
      </View>
    );
  }

  const isOwner = user?.id === booking.tool.owner.id;
  const isBorrower = user?.id === booking.borrower.id;

  const handleConfirm = () => {
    Alert.alert("Buchung bestätigen", "Möchtest du diese Buchungsanfrage bestätigen?", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Bestätigen",
        onPress: () => confirm.mutate(undefined, {
          onError: () => Alert.alert("Fehler", "Buchung konnte nicht bestätigt werden."),
        }),
      },
    ]);
  };

  const handleDecline = () => {
    Alert.alert("Buchung ablehnen", "Möchtest du diese Buchungsanfrage ablehnen?", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Ablehnen",
        style: "destructive",
        onPress: () => decline.mutate(undefined, {
          onError: () => Alert.alert("Fehler", "Buchung konnte nicht abgelehnt werden."),
        }),
      },
    ]);
  };

  const handleCancel = () => {
    Alert.alert("Buchung stornieren", "Möchtest du diese Buchung stornieren?", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Stornieren",
        style: "destructive",
        onPress: () => cancel.mutate(undefined, {
          onError: () => Alert.alert("Fehler", "Buchung konnte nicht storniert werden."),
        }),
      },
    ]);
  };

  const handlePickup = () => {
    pickup.mutate(undefined, {
      onError: () => Alert.alert("Fehler", "Abholung konnte nicht bestätigt werden."),
    });
  };

  const handleReturn = () => {
    Alert.alert("Rückgabe bestätigen", "Bestätigst du die Rückgabe des Werkzeugs?", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Bestätigen",
        onPress: () => returnBooking.mutate(undefined, {
          onSuccess: () => router.push(`/booking/${id}/review`),
          onError: () => Alert.alert("Fehler", "Rückgabe konnte nicht bestätigt werden."),
        }),
      },
    ]);
  };

  const isActionLoading =
    confirm.isPending ||
    decline.isPending ||
    cancel.isPending ||
    pickup.isPending ||
    returnBooking.isPending;

  return (
    <>
      <Stack.Screen options={{ title: "Buchungsdetails", headerBackTitle: "Zurück" }} />
      <ScrollView className="flex-1 bg-gray-50">
        <View className="p-4">
          {/* Status header */}
          <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100 shadow-sm">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>
                {booking.tool.title}
              </Text>
              <StatusBadge status={booking.status} />
            </View>
            <Text className="text-sm text-gray-500 mt-1">{booking.tool.category}</Text>
          </View>

          {/* Dates & amounts */}
          <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100 shadow-sm">
            <Text className="text-base font-semibold text-gray-900 mb-2">Details</Text>
            <DetailRow label="Von" value={formatDate(booking.requested_start_date)} />
            <DetailRow label="Bis" value={formatDate(booking.requested_end_date)} />
            <DetailRow label="Abholung" value={booking.pickup_method === "delivery" ? "Lieferung" : "Selbst abholen"} />
            {Number(booking.total_amount) > 0 && (
              <DetailRow label="Gesamtbetrag" value={`${Number(booking.total_amount).toFixed(2)} €`} />
            )}
            {Number(booking.deposit_amount) > 0 && (
              <DetailRow label="Kaution" value={`${Number(booking.deposit_amount).toFixed(2)} €`} />
            )}
          </View>

          {/* Parties */}
          <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100 shadow-sm">
            <Text className="text-base font-semibold text-gray-900 mb-2">Beteiligte</Text>
            <DetailRow label="Ausleiher" value={booking.borrower.username} />
            <DetailRow label="Verleiher" value={booking.tool.owner.username} />
          </View>

          {/* Messages */}
          {booking.borrower_message && (
            <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100 shadow-sm">
              <Text className="text-sm font-semibold text-gray-700 mb-1">Nachricht des Ausleihers</Text>
              <Text className="text-sm text-gray-600">{booking.borrower_message}</Text>
            </View>
          )}
          {booking.owner_response && (
            <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100 shadow-sm">
              <Text className="text-sm font-semibold text-gray-700 mb-1">Antwort des Verleihers</Text>
              <Text className="text-sm text-gray-600">{booking.owner_response}</Text>
            </View>
          )}

          {/* Action buttons */}
          <View className="gap-2 mb-8">
            {/* Owner actions */}
            {isOwner && booking.status === "pending" && (
              <>
                <Button
                  title="Anfrage bestätigen"
                  onPress={handleConfirm}
                  isLoading={confirm.isPending}
                  disabled={isActionLoading}
                />
                <Button
                  title="Anfrage ablehnen"
                  onPress={handleDecline}
                  variant="outline"
                  isLoading={decline.isPending}
                  disabled={isActionLoading}
                />
              </>
            )}
            {isOwner && booking.status === "confirmed" && (
              <Button
                title="Abholung bestätigen"
                onPress={handlePickup}
                isLoading={pickup.isPending}
                disabled={isActionLoading}
              />
            )}
            {isOwner && booking.status === "active" && (
              <Button
                title="Rückgabe bestätigen"
                onPress={handleReturn}
                isLoading={returnBooking.isPending}
                disabled={isActionLoading}
              />
            )}

            {/* Borrower actions */}
            {isBorrower && (booking.status === "pending" || booking.status === "confirmed") && (
              <Button
                title="Buchung stornieren"
                onPress={handleCancel}
                variant="outline"
                isLoading={cancel.isPending}
                disabled={isActionLoading}
              />
            )}

            {/* Review after completion */}
            {(booking.status === "returned" || booking.status === "completed") && (
              <Button
                title="Bewertung abgeben"
                onPress={() => router.push(`/booking/${id}/review`)}
                variant="secondary"
              />
            )}

            {/* Link to tool */}
            <Button
              title="Werkzeug ansehen"
              onPress={() => router.push(`/tool/${booking.tool.id}`)}
              variant="outline"
            />
          </View>
        </View>
      </ScrollView>
    </>
  );
}
