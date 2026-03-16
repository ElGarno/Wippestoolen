import { useState } from "react";
import { View, Text, TextInput, TextInputProps, StyleSheet } from "react-native";
import { colors } from "../../constants/colors";

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
}

export function Input({ label, error, onFocus, onBlur, ...props }: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const borderColor = error
    ? colors.error
    : isFocused
    ? colors.primary[600]
    : colors.gray[200];

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, { borderColor }]}
        placeholderTextColor={colors.gray[400]}
        onFocus={(e) => {
          setIsFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.gray[700],
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.gray[900],
  },
  error: {
    marginTop: 4,
    fontSize: 13,
    color: colors.error,
  },
});
