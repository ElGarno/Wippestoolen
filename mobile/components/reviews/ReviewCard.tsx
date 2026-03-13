import { View, Text } from "react-native";
import { StarRating } from "./StarRating";
import type { ReviewListItem } from "../../types";

interface ReviewCardProps {
  review: ReviewListItem;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ReviewCard({ review }: ReviewCardProps) {
  return (
    <View className="bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <View className="w-8 h-8 bg-primary-100 rounded-full items-center justify-center mr-2">
            <Text className="text-sm font-bold text-primary-600">
              {review.reviewer_name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text className="text-sm font-medium text-gray-900">{review.reviewer_name}</Text>
        </View>
        <Text className="text-xs text-gray-400">{formatDate(review.created_at)}</Text>
      </View>

      <StarRating rating={review.rating} size="sm" />

      {review.title && (
        <Text className="text-sm font-semibold text-gray-800 mt-2">{review.title}</Text>
      )}
      {review.comment && (
        <Text className="text-sm text-gray-600 mt-1 leading-5">{review.comment}</Text>
      )}
    </View>
  );
}
