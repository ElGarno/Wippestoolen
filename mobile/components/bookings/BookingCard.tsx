import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { StatusBadge } from "./StatusBadge";
import type { BookingSummary } from "../../types";

interface BookingCardProps {
  booking: BookingSummary;
  role: "borrower" | "owner";
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
}

export function BookingCard({ booking, role }: BookingCardProps) {
  const router = useRouter();
  const otherParty =
    role === "borrower" ? booking.tool.owner.username : booking.borrower.username;

  return (
    <TouchableOpacity
      className="bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm"
      onPress={() => router.push(`/booking/${booking.id}`)}
      activeOpacity={0.7}
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-3">
          <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
            {booking.tool.title}
          </Text>
          <Text className="text-sm text-gray-500 mt-0.5">
            {role === "borrower" ? "Von" : "An"}: {otherParty}
          </Text>
        </View>
        <StatusBadge status={booking.status} />
      </View>

      <View className="flex-row items-center justify-between mt-3">
        <Text className="text-sm text-gray-500">
          {formatDate(booking.requested_start_date)} – {formatDate(booking.requested_end_date)}
        </Text>
        {booking.total_amount > 0 && (
          <Text className="text-sm font-semibold text-primary-600">
            {Number(booking.total_amount).toFixed(2)} €
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}
