import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import {
  useBooking,
  useConfirmBooking,
  useDeclineBooking,
  useCancelBooking,
  usePickupBooking,
  useReturnBooking,
} from "../../hooks/useBookings";
import { StatusBadge } from "../../components/bookings/StatusBadge";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../contexts/AuthContext";
import { colors } from "../../constants/colors";

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>Buchung nicht gefunden</Text>
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
        onPress: () =>
          confirm.mutate(undefined, {
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
        onPress: () =>
          decline.mutate(undefined, {
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
        onPress: () =>
          cancel.mutate(undefined, {
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
        onPress: () =>
          returnBooking.mutate(undefined, {
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
      <Stack.Screen
        options={{
          title: "Buchungsdetails",
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 8 }}>
              <Text style={{ fontSize: 17, color: colors.primary[600] }}>‹ Zurück</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* Status header card */}
          <View style={styles.statusCard}>
            <View style={styles.statusCardHeader}>
              <Text style={styles.toolTitle} numberOfLines={1}>
                {booking.tool.title}
              </Text>
              <StatusBadge status={booking.status} />
            </View>
            <Text style={styles.toolCategory}>{booking.tool.category}</Text>
          </View>

          {/* Dates & amounts */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Details</Text>
            <DetailRow label="Von" value={formatDate(booking.requested_start_date)} />
            <DetailRow label="Bis" value={formatDate(booking.requested_end_date)} />
            <DetailRow
              label="Abholung"
              value={booking.pickup_method === "delivery" ? "Lieferung" : "Selbst abholen"}
            />
            {Number(booking.total_amount) > 0 && (
              <DetailRow
                label="Gesamtbetrag"
                value={`${Number(booking.total_amount).toFixed(2)} €`}
              />
            )}
            {Number(booking.deposit_amount) > 0 && (
              <DetailRow
                label="Kaution"
                value={`${Number(booking.deposit_amount).toFixed(2)} €`}
              />
            )}
          </View>

          {/* Parties */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Beteiligte</Text>
            <DetailRow label="Ausleiher" value={booking.borrower.username} />
            <DetailRow label="Verleiher" value={booking.tool.owner.username} />
          </View>

          {/* Messages */}
          {booking.borrower_message && (
            <View style={styles.messageCard}>
              <Text style={styles.messageSender}>Nachricht des Ausleihers</Text>
              <Text style={styles.messageText}>{booking.borrower_message}</Text>
            </View>
          )}
          {booking.owner_response && (
            <View style={styles.messageCard}>
              <Text style={styles.messageSender}>Antwort des Verleihers</Text>
              <Text style={styles.messageText}>{booking.owner_response}</Text>
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.actionsContainer}>
            {/* Owner actions: pending */}
            {isOwner && booking.status === "pending" && (
              <>
                <Button
                  title="Anfrage bestätigen"
                  onPress={handleConfirm}
                  isLoading={confirm.isPending}
                  disabled={isActionLoading}
                />
                <View style={styles.actionGap} />
                {/* Decline as red outline */}
                <TouchableOpacity
                  style={[
                    styles.declineButton,
                    isActionLoading && styles.disabledButton,
                  ]}
                  onPress={handleDecline}
                  disabled={isActionLoading || decline.isPending}
                  activeOpacity={0.75}
                >
                  <Text style={styles.declineButtonText}>Anfrage ablehnen</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Owner actions: confirmed */}
            {isOwner && booking.status === "confirmed" && (
              <>
                <Button
                  title="Abholung bestätigen"
                  onPress={handlePickup}
                  isLoading={pickup.isPending}
                  disabled={isActionLoading}
                />
                <View style={styles.actionGap} />
              </>
            )}

            {/* Owner actions: active */}
            {isOwner && booking.status === "active" && (
              <>
                <Button
                  title="Rückgabe bestätigen"
                  onPress={handleReturn}
                  isLoading={returnBooking.isPending}
                  disabled={isActionLoading}
                />
                <View style={styles.actionGap} />
              </>
            )}

            {/* Borrower actions */}
            {isBorrower &&
              (booking.status === "pending" || booking.status === "confirmed") && (
                <>
                  {/* Cancel as gray outline */}
                  <TouchableOpacity
                    style={[
                      styles.cancelButton,
                      isActionLoading && styles.disabledButton,
                    ]}
                    onPress={handleCancel}
                    disabled={isActionLoading || cancel.isPending}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.cancelButtonText}>Buchung stornieren</Text>
                  </TouchableOpacity>
                  <View style={styles.actionGap} />
                </>
              )}

            {/* Review after completion */}
            {(booking.status === "returned" || booking.status === "completed") && (
              <>
                <Button
                  title="Bewertung abgeben"
                  onPress={() => router.push(`/booking/${id}/review`)}
                />
                <View style={styles.actionGap} />
              </>
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
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  statusCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statusCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toolTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: colors.gray[900],
    marginRight: 10,
    letterSpacing: -0.2,
  },
  toolCategory: {
    fontSize: 13,
    color: colors.gray[500],
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
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
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[50],
  },
  detailLabel: {
    fontSize: 13,
    color: colors.gray[500],
  },
  detailValue: {
    fontSize: 13,
    color: colors.gray[900],
    fontWeight: "500",
  },
  messageCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[300],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  messageSender: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.gray[700],
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: colors.gray[600],
    lineHeight: 20,
  },
  actionsContainer: {
    marginTop: 8,
  },
  actionGap: {
    height: 10,
  },
  declineButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  declineButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.error,
  },
  cancelButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.gray[400],
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray[600],
  },
  disabledButton: {
    opacity: 0.5,
  },
});
