import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import type { ToolListItem } from "../../types";

interface ToolCardProps {
  tool: ToolListItem;
}

export function ToolCard({ tool }: ToolCardProps) {
  const router = useRouter();

  return (
    <TouchableOpacity
      className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 mb-3"
      onPress={() => router.push(`/tool/${tool.id}`)}
      activeOpacity={0.7}
    >
      {/* Image */}
      <View className="h-40 bg-gray-100">
        {tool.primary_photo ? (
          <Image
            source={{ uri: tool.primary_photo.medium_url || tool.primary_photo.original_url }}
            className="w-full h-full"
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View className="w-full h-full items-center justify-center">
            <Text className="text-4xl">🔧</Text>
          </View>
        )}
        {/* Availability badge */}
        {!tool.is_available && (
          <View className="absolute top-2 right-2 bg-red-500 px-2 py-1 rounded">
            <Text className="text-white text-xs font-semibold">Verliehen</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View className="p-3">
        <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
          {tool.title}
        </Text>
        <View className="flex-row items-center justify-between mt-1">
          <Text className="text-sm text-gray-500">
            {tool.owner.display_name}
            {tool.pickup_city ? ` · ${tool.pickup_city}` : ""}
          </Text>
          {tool.average_rating != null && tool.average_rating > 0 && (
            <Text className="text-sm text-yellow-600">
              ⭐ {Number(tool.average_rating).toFixed(1)}
            </Text>
          )}
        </View>
        <View className="flex-row items-center justify-between mt-2">
          <Text className="text-xs text-gray-400">{tool.category.name}</Text>
          {Number(tool.daily_rate) > 0 && (
            <Text className="text-sm font-semibold text-primary-600">
              {Number(tool.daily_rate).toFixed(2)} €/Tag
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
