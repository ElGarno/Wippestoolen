import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, View } from "react-native";
import { colors } from "../../constants/colors";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "danger";
  isLoading?: boolean;
  disabled?: boolean;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  isLoading,
  disabled,
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  const containerStyle = [
    styles.base,
    variant === "primary" && styles.primary,
    variant === "secondary" && styles.secondary,
    variant === "outline" && styles.outline,
    variant === "danger" && styles.danger,
    isDisabled && styles.disabled,
  ];

  const textStyle = [
    styles.text,
    variant === "primary" && styles.textPrimary,
    variant === "secondary" && styles.textSecondary,
    variant === "outline" && styles.textOutline,
    variant === "danger" && styles.textDanger,
  ];

  const indicatorColor =
    variant === "secondary" ? colors.primary[600] : colors.white;

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
    >
      {isLoading && (
        <View style={styles.indicatorWrapper}>
          <ActivityIndicator color={indicatorColor} size="small" />
        </View>
      )}
      <Text style={textStyle}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: colors.primary[600],
  },
  secondary: {
    backgroundColor: colors.primary[50],
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.primary[600],
  },
  danger: {
    backgroundColor: colors.error,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
  },
  textPrimary: {
    color: colors.white,
  },
  textSecondary: {
    color: colors.primary[600],
  },
  textOutline: {
    color: colors.primary[600],
  },
  textDanger: {
    color: colors.white,
  },
  indicatorWrapper: {
    marginRight: 8,
  },
});
