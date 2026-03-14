import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Image } from "react-native";
import { useTool } from "../../hooks/useTools";
import { StarRating } from "../../components/reviews/StarRating";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../contexts/AuthContext";

export default function ToolDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data: tool, isLoading } = useTool(id);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!tool) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-500">Werkzeug nicht gefunden</Text>
      </View>
    );
  }

  const isOwner = user?.id === tool.owner.id;
  const primaryPhoto = tool.photos.find((p) => p.is_primary) || tool.photos[0];

  return (
    <>
      <Stack.Screen options={{ title: tool.title, headerBackTitle: "Zurück" }} />
      <ScrollView className="flex-1 bg-white">
        {/* Image */}
        <View className="h-64 bg-gray-100">
          {primaryPhoto ? (
            <Image
              source={{ uri: primaryPhoto.large_url || primaryPhoto.original_url }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-full items-center justify-center">
              <Text className="text-6xl">🔧</Text>
            </View>
          )}
        </View>

        <View className="p-4">
          {/* Title & price */}
          <View className="flex-row justify-between items-start">
            <View className="flex-1 mr-4">
              <Text className="text-2xl font-bold text-gray-900">{tool.title}</Text>
              <Text className="text-sm text-gray-500 mt-1">{tool.category.name}</Text>
            </View>
            {Number(tool.daily_rate) > 0 && (
              <View className="bg-primary-50 px-3 py-2 rounded-lg">
                <Text className="text-lg font-bold text-primary-600">
                  {Number(tool.daily_rate).toFixed(2)} €
                </Text>
                <Text className="text-xs text-primary-400 text-center">pro Tag</Text>
              </View>
            )}
          </View>

          {/* Rating */}
          {tool.average_rating != null && tool.total_ratings > 0 && (
            <View className="flex-row items-center mt-3">
              <StarRating rating={Number(tool.average_rating)} size="sm" />
              <Text className="text-sm text-gray-500 ml-2">
                ({tool.total_ratings} Bewertungen)
              </Text>
            </View>
          )}

          {/* Availability */}
          <View className={`mt-4 px-3 py-2 rounded-lg ${tool.is_available ? "bg-green-50" : "bg-red-50"}`}>
            <Text className={`text-sm font-medium ${tool.is_available ? "text-green-700" : "text-red-700"}`}>
              {tool.is_available ? "Verfügbar" : "Derzeit verliehen"}
            </Text>
          </View>

          {/* Description */}
          <View className="mt-4">
            <Text className="text-base font-semibold text-gray-900 mb-2">Beschreibung</Text>
            <Text className="text-sm text-gray-600 leading-5">{tool.description}</Text>
          </View>

          {/* Details */}
          <View className="mt-4 bg-gray-50 rounded-lg p-4">
            <Text className="text-base font-semibold text-gray-900 mb-3">Details</Text>
            {tool.brand && <DetailRow label="Marke" value={tool.brand} />}
            {tool.model && <DetailRow label="Modell" value={tool.model} />}
            <DetailRow label="Zustand" value={conditionLabel(tool.condition)} />
            <DetailRow label="Max. Leihdauer" value={`${tool.max_loan_days} Tage`} />
            {Number(tool.deposit_amount) > 0 && (
              <DetailRow label="Kaution" value={`${Number(tool.deposit_amount).toFixed(2)} €`} />
            )}
            {tool.delivery_available && (
              <DetailRow label="Lieferung" value={`Ja (${tool.delivery_radius_km} km)`} />
            )}
          </View>

          {/* Owner */}
          <View className="mt-4 flex-row items-center p-4 bg-gray-50 rounded-lg">
            <View className="w-12 h-12 bg-primary-100 rounded-full items-center justify-center">
              <Text className="text-lg font-bold text-primary-600">
                {tool.owner.display_name?.charAt(0)?.toUpperCase()}
              </Text>
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-base font-medium text-gray-900">{tool.owner.display_name}</Text>
              {tool.owner.average_rating != null && (
                <Text className="text-sm text-gray-500">
                  ⭐ {Number(tool.owner.average_rating).toFixed(1)} · {tool.owner.total_ratings} Bewertungen
                </Text>
              )}
            </View>
          </View>

          {/* Safety notes */}
          {tool.safety_notes && (
            <View className="mt-4 bg-yellow-50 p-4 rounded-lg">
              <Text className="text-base font-semibold text-yellow-800 mb-1">Sicherheitshinweise</Text>
              <Text className="text-sm text-yellow-700">{tool.safety_notes}</Text>
            </View>
          )}

          {/* Action button */}
          <View className="mt-6 mb-8">
            {isOwner ? (
              <Button
                title="Werkzeug bearbeiten"
                onPress={() => router.push(`/my-tools/${tool.id}/edit`)}
                variant="outline"
              />
            ) : tool.is_available ? (
              <Button
                title="Jetzt ausleihen"
                onPress={() => router.push(`/tool/${tool.id}/book`)}
              />
            ) : (
              <Button title="Derzeit nicht verfügbar" onPress={() => {}} disabled />
            )}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1.5">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className="text-sm text-gray-900 font-medium">{value}</Text>
    </View>
  );
}

function conditionLabel(condition: string): string {
  const labels: Record<string, string> = {
    excellent: "Ausgezeichnet",
    good: "Gut",
    fair: "Befriedigend",
    poor: "Mangelhaft",
  };
  return labels[condition] || condition;
}
