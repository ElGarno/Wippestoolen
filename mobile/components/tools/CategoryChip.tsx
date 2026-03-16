import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { colors } from "../../constants/colors";

interface CategoryChipProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
  count?: number;
  icon?: string;
}

export function CategoryChip({
  label,
  isActive,
  onPress,
  count,
  icon,
}: CategoryChipProps) {
  return (
    <TouchableOpacity
      style={[styles.chip, isActive ? styles.chipActive : styles.chipInactive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {icon && (
        <Text style={styles.icon}>{icon}</Text>
      )}
      <Text style={[styles.label, isActive ? styles.labelActive : styles.labelInactive]}>
        {label}
        {count !== undefined ? ` (${count})` : ""}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: colors.gray[900],
  },
  chipInactive: {
    backgroundColor: "#F0F0F0",
  },
  icon: {
    fontSize: 14,
    marginRight: 5,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
  },
  labelActive: {
    color: colors.white,
  },
  labelInactive: {
    color: colors.gray[700],
  },
});
