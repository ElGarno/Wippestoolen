import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { StatusBadge } from "./StatusBadge";
import { colors } from "../../constants/colors";
import type { BookingSummary } from "../../types";

interface BookingCardProps {
  booking: BookingSummary;
  role: "borrower" | "owner";
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function BookingCard({ booking, role }: BookingCardProps) {
  const router = useRouter();
  const otherParty =
    role === "borrower" ? booking.tool.owner.display_name : booking.borrower.display_name;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/booking/${booking.id}`)}
      activeOpacity={0.75}
    >
      {/* Left orange accent stripe */}
      <View style={styles.accent} />

      <View style={styles.body}>
        {/* Header row: title + status */}
        <View style={styles.headerRow}>
          <View style={styles.titleWrapper}>
            <Text style={styles.title} numberOfLines={1}>
              {booking.tool.title}
            </Text>
            <Text style={styles.party}>
              {role === "borrower" ? "Von" : "An"}: {otherParty}
            </Text>
          </View>
          <StatusBadge status={booking.status} />
        </View>

        {/* Footer row: dates + amount */}
        <View style={styles.footerRow}>
          <Text style={styles.dates}>
            {formatDate(booking.requested_start_date)} – {formatDate(booking.requested_end_date)}
          </Text>
          {booking.total_amount > 0 && (
            <Text style={styles.amount}>
              {Number(booking.total_amount).toFixed(2)} €
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: colors.gray[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  accent: {
    width: 4,
    backgroundColor: colors.primary[600],
    alignSelf: "stretch",
  },
  body: {
    flex: 1,
    padding: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  titleWrapper: {
    flex: 1,
    marginRight: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.gray[900],
  },
  party: {
    fontSize: 13,
    color: colors.gray[500],
    marginTop: 2,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  dates: {
    fontSize: 13,
    color: colors.gray[500],
  },
  amount: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary[600],
  },
});
