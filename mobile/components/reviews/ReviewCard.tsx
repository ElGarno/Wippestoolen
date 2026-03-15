import { View, Text, StyleSheet } from "react-native";
import { StarRating } from "./StarRating";
import { colors } from "../../constants/colors";
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
  const initial = review.reviewer_name.charAt(0).toUpperCase();

  return (
    <View style={styles.card}>
      {/* Header: avatar + reviewer name + date */}
      <View style={styles.header}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.reviewerName}>{review.reviewer_name}</Text>
        </View>
        <Text style={styles.date}>{formatDate(review.created_at)}</Text>
      </View>

      {/* Star rating */}
      <View style={styles.stars}>
        <StarRating rating={review.rating} size="sm" />
      </View>

      {/* Optional bold title */}
      {review.title && (
        <Text style={styles.reviewTitle}>{review.title}</Text>
      )}

      {/* Comment body */}
      {review.comment && (
        <Text style={styles.comment}>{review.comment}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.gray[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary[600],
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray[900],
  },
  date: {
    fontSize: 12,
    color: colors.gray[400],
  },
  stars: {
    marginBottom: 8,
  },
  reviewTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray[800],
    marginBottom: 4,
  },
  comment: {
    fontSize: 14,
    color: colors.gray[600],
    lineHeight: 21,
  },
});
