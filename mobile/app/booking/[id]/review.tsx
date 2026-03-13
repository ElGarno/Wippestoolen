import { useState } from "react";
import { View, Text, ScrollView, TextInput, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useBooking } from "../../../hooks/useBookings";
import { useCreateReview } from "../../../hooks/useReviews";
import { StarRating } from "../../../components/reviews/StarRating";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";

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
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!booking) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-500">Buchung nicht gefunden</Text>
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
      <Stack.Screen options={{ title: "Bewertung abgeben", headerBackTitle: "Zurück" }} />
      <ScrollView className="flex-1 bg-gray-50">
        <View className="p-4">
          {/* Booking summary */}
          <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100 shadow-sm">
            <Text className="text-base font-semibold text-gray-900">{booking.tool.title}</Text>
            <Text className="text-sm text-gray-500 mt-0.5">
              Verliehen von {booking.tool.owner.username}
            </Text>
          </View>

          {/* Overall rating */}
          <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100 shadow-sm">
            <Text className="text-base font-semibold text-gray-900 mb-3">
              Gesamtbewertung *
            </Text>
            <StarRating
              rating={rating}
              size="lg"
              interactive
              onRate={setRating}
            />
            {rating > 0 && (
              <Text className="text-sm text-gray-500 mt-2">
                {["", "Sehr schlecht", "Schlecht", "Okay", "Gut", "Ausgezeichnet"][rating]}
              </Text>
            )}
          </View>

          {/* Tool condition */}
          <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100 shadow-sm">
            <Text className="text-base font-semibold text-gray-900 mb-3">
              Zustand des Werkzeugs
            </Text>
            <StarRating
              rating={conditionRating}
              size="lg"
              interactive
              onRate={setConditionRating}
            />
          </View>

          {/* Title & comment */}
          <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100 shadow-sm">
            <Input
              label="Titel (optional)"
              placeholder="Kurze Zusammenfassung..."
              value={title}
              onChangeText={setTitle}
            />
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Kommentar (optional)
              </Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white min-h-[100px]"
                placeholder="Teile deine Erfahrungen..."
                placeholderTextColor="#9ca3af"
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
        </View>
      </ScrollView>
    </>
  );
}
