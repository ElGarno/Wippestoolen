import { TouchableOpacity, Text, ActivityIndicator } from "react-native";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline";
  isLoading?: boolean;
  disabled?: boolean;
}

export function Button({ title, onPress, variant = "primary", isLoading, disabled }: ButtonProps) {
  const baseClass = "py-3 px-6 rounded-lg items-center justify-center flex-row";
  const variantClass = {
    primary: "bg-primary-600",
    secondary: "bg-gray-600",
    outline: "border border-primary-600 bg-transparent",
  }[variant];
  const textClass = {
    primary: "text-white font-semibold text-base",
    secondary: "text-white font-semibold text-base",
    outline: "text-primary-600 font-semibold text-base",
  }[variant];
  const disabledClass = disabled || isLoading ? "opacity-50" : "";

  return (
    <TouchableOpacity
      className={`${baseClass} ${variantClass} ${disabledClass}`}
      onPress={onPress}
      disabled={disabled || isLoading}
      activeOpacity={0.7}
    >
      {isLoading && <ActivityIndicator color="white" className="mr-2" />}
      <Text className={textClass}>{title}</Text>
    </TouchableOpacity>
  );
}
