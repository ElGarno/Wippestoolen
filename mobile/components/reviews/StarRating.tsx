import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors } from "../../constants/colors";

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onRate?: (rating: number) => void;
}

const STAR_FONT_SIZE: Record<"sm" | "md" | "lg", number> = {
  sm: 14,
  md: 20,
  lg: 28,
};

export function StarRating({
  rating,
  maxStars = 5,
  size = "md",
  interactive = false,
  onRate,
}: StarRatingProps) {
  const fontSize = STAR_FONT_SIZE[size];

  return (
    <View style={styles.row}>
      {Array.from({ length: maxStars }, (_, i) => {
        const filled = i < Math.round(rating);

        if (interactive) {
          return (
            <TouchableOpacity
              key={i}
              onPress={() => onRate?.(i + 1)}
              style={styles.starWrapper}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            >
              <Text style={[styles.star, { fontSize, color: filled ? colors.accent : colors.gray[300] }]}>
                ★
              </Text>
            </TouchableOpacity>
          );
        }

        return (
          <View key={i} style={styles.starWrapper}>
            <Text style={[styles.star, { fontSize, color: filled ? colors.accent : colors.gray[300] }]}>
              ★
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  starWrapper: {
    marginRight: 2,
  },
  star: {
    // fontSize and color are applied inline per star
  },
});
