import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useBooking } from "../../../hooks/useBookings";
import { useCreateReview } from "../../../hooks/useReviews";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { colors } from "../../../constants/colors";

/** Interactive star row rendered with inline TouchableOpacity stars. */
function StarRow({
  rating,
  onRate,
  size = 36,
}: {
  rating: number;
  onRate: (r: number) => void;
  size?: number;
}) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => onRate(star)}
          activeOpacity={0.7}
          style={styles.starButton}
        >
          <Text
            style={[
              styles.star,
              { fontSize: size, color: star <= rating ? colors.accent : colors.gray[300] },
            ]}
          >
            ★
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const RATING_LABELS = ["", "Sehr schlecht", "Schlecht", "Okay", "Gut", "Ausgezeichnet"];

export default function CreateReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: booking, isLoading } = useBooking(id);
  const createReview = useCreateReview();

  const [rating, setRating] = useState(0);
  const [conditionRating, setConditionRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>Buchung nicht gefunden</Text>
      </View>
    );
  }

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert("Bewertung fehlt", "Bitte gib eine Sternebewertung ab.");
      return;
    }

    try {
      await createReview.mutateAsync({
        booking_id: id,
        rating,
        title: title.trim() || undefined,
        comment: comment.trim() || undefined,
        tool_condition_rating: conditionRating > 0 ? conditionRating : undefined,
      });
      Alert.alert("Danke!", "Deine Bewertung wurde erfolgreich gespeichert.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Fehler", "Bewertung konnte nicht gespeichert werden.");
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Bewertung abgeben",
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 8 }}>
              <Text style={{ fontSize: 17, color: colors.primary[600] }}>‹ Zurück</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView style={styles.scrollView}>
        {/* Gradient header */}
        <LinearGradient
          colors={[colors.gradient.start, colors.gradient.end]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientHeader}
        >
          <Text style={styles.gradientTitle}>Bewertung abgeben</Text>
          <Text style={styles.gradientSubtitle}>
            Wie war deine Erfahrung mit {booking.tool.title}?
          </Text>
        </LinearGradient>

        <View style={styles.content}>
          {/* Booking summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTool}>{booking.tool.title}</Text>
            <Text style={styles.summaryOwner}>
              Verliehen von {booking.tool.owner.display_name}
            </Text>
          </View>

          {/* Overall rating */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Gesamtbewertung *</Text>
            <StarRow rating={rating} onRate={setRating} size={38} />
            {rating > 0 && (
              <Text style={styles.ratingLabel}>{RATING_LABELS[rating]}</Text>
            )}
          </View>

          {/* Tool condition rating */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Zustand des Werkzeugs</Text>
            <StarRow rating={conditionRating} onRate={setConditionRating} size={34} />
            {conditionRating > 0 && (
              <Text style={styles.ratingLabel}>{RATING_LABELS[conditionRating]}</Text>
            )}
          </View>

          {/* Title and comment */}
          <View style={styles.card}>
            <Input
              label="Titel (optional)"
              placeholder="Kurze Zusammenfassung..."
              value={title}
              onChangeText={setTitle}
            />
            <View>
              <Text style={styles.inputLabel}>Kommentar (optional)</Text>
              <TextInput
                style={[styles.textInput, styles.commentInput]}
                placeholder="Teile deine Erfahrungen..."
                placeholderTextColor={colors.gray[400]}
                value={comment}
                onChangeText={setComment}
                multiline
                textAlignVertical="top"
              />
            </View>
          </View>

          <Button
            title="Bewertung senden"
            onPress={handleSubmit}
            isLoading={createReview.isPending}
            disabled={rating === 0}
          />
          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gray[50],
  },
  notFoundText: {
    color: colors.gray[500],
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  gradientHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  gradientTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.white,
    letterSpacing: -0.3,
  },
  gradientSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
    lineHeight: 20,
  },
  content: {
    padding: 16,
  },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryTool: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.gray[900],
  },
  summaryOwner: {
    fontSize: 13,
    color: colors.gray[500],
    marginTop: 3,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.gray[900],
    marginBottom: 14,
  },
  starRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  starButton: {
    marginRight: 6,
  },
  star: {
    lineHeight: 44,
  },
  ratingLabel: {
    marginTop: 8,
    fontSize: 13,
    color: colors.gray[500],
    fontStyle: "italic",
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.gray[700],
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: colors.white,
    color: colors.gray[900],
  },
  commentInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  bottomSpacer: {
    height: 32,
  },
});
