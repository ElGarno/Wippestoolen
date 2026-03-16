import { View, Text, StyleSheet } from "react-native";
import type { BookingStatus } from "../../types";

interface StatusBadgeProps {
  status: BookingStatus | string;
}

interface StatusConfig {
  label: string;
  backgroundColor: string;
  textColor: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  pending: {
    label: "Ausstehend",
    backgroundColor: "#FEF3C7",
    textColor: "#92400E",
  },
  confirmed: {
    label: "Bestätigt",
    backgroundColor: "#DBEAFE",
    textColor: "#1E40AF",
  },
  active: {
    label: "Aktiv",
    backgroundColor: "#FFEDD5",
    textColor: "#9A3412",
  },
  completed: {
    label: "Abgeschlossen",
    backgroundColor: "#DCFCE7",
    textColor: "#14532D",
  },
  declined: {
    label: "Abgelehnt",
    backgroundColor: "#FEE2E2",
    textColor: "#991B1B",
  },
  cancelled: {
    label: "Storniert",
    backgroundColor: "#FEE2E2",
    textColor: "#991B1B",
  },
  returned: {
    label: "Zurückgegeben",
    backgroundColor: "#CCFBF1",
    textColor: "#134E4A",
  },
};

const FALLBACK: StatusConfig = {
  label: "",
  backgroundColor: "#F5F5F5",
  textColor: "#525252",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { ...FALLBACK, label: status };

  return (
    <View style={[styles.badge, { backgroundColor: config.backgroundColor }]}>
      <Text style={[styles.label, { color: config.textColor }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
  },
});
