import { View, Text } from "react-native";
import type { BookingStatus } from "../../types";

interface StatusBadgeProps {
  status: BookingStatus | string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bgClass: string; textClass: string }
> = {
  pending: { label: "Ausstehend", bgClass: "bg-yellow-100", textClass: "text-yellow-800" },
  confirmed: { label: "Bestätigt", bgClass: "bg-blue-100", textClass: "text-blue-800" },
  declined: { label: "Abgelehnt", bgClass: "bg-red-100", textClass: "text-red-800" },
  cancelled: { label: "Storniert", bgClass: "bg-gray-100", textClass: "text-gray-600" },
  active: { label: "Aktiv", bgClass: "bg-green-100", textClass: "text-green-800" },
  returned: { label: "Zurückgegeben", bgClass: "bg-purple-100", textClass: "text-purple-800" },
  completed: { label: "Abgeschlossen", bgClass: "bg-emerald-100", textClass: "text-emerald-800" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    bgClass: "bg-gray-100",
    textClass: "text-gray-600",
  };

  return (
    <View className={`px-2 py-1 rounded-full ${config.bgClass}`}>
      <Text className={`text-xs font-semibold ${config.textClass}`}>{config.label}</Text>
    </View>
  );
}
