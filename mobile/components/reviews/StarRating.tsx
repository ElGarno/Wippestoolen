import { View, Text, TouchableOpacity } from "react-native";

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onRate?: (rating: number) => void;
}

export function StarRating({
  rating,
  maxStars = 5,
  size = "md",
  interactive = false,
  onRate,
}: StarRatingProps) {
  const starSize = { sm: "text-sm", md: "text-lg", lg: "text-2xl" }[size];

  return (
    <View className="flex-row">
      {Array.from({ length: maxStars }, (_, i) => {
        const filled = i < Math.round(rating);
        const Star = interactive ? TouchableOpacity : View;
        return (
          <Star
            key={i}
            onPress={interactive ? () => onRate?.(i + 1) : undefined}
            className="mr-0.5"
          >
            <Text className={`${starSize} ${filled ? "text-yellow-400" : "text-gray-300"}`}>
              ★
            </Text>
          </Star>
        );
      })}
    </View>
  );
}
