import { TouchableOpacity, Text } from "react-native";

interface CategoryChipProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
  count?: number;
}

export function CategoryChip({ label, isActive, onPress, count }: CategoryChipProps) {
  return (
    <TouchableOpacity
      className={`px-4 py-2 rounded-full mr-2 ${
        isActive ? "bg-primary-600" : "bg-gray-100"
      }`}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        className={`text-sm font-medium ${isActive ? "text-white" : "text-gray-700"}`}
      >
        {label}
        {count !== undefined && ` (${count})`}
      </Text>
    </TouchableOpacity>
  );
}
