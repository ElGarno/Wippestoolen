import { View, Text, FlatList, RefreshControl, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useRouter, Stack } from "expo-router";
import { useMyTools, useDeleteTool } from "../../hooks/useTools";
import { StatusBadge } from "../../components/bookings/StatusBadge";
import type { Tool } from "../../types";

function ToolListItem({ tool, onEdit, onDelete }: { tool: Tool; onEdit: () => void; onDelete: () => void }) {
  return (
    <View className="bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm">
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-3">
          <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
            {tool.title}
          </Text>
          <Text className="text-sm text-gray-500 mt-0.5">{tool.category.name}</Text>
        </View>
        <View className={`px-2 py-1 rounded-full ${tool.is_available ? "bg-green-100" : "bg-red-100"}`}>
          <Text className={`text-xs font-semibold ${tool.is_available ? "text-green-700" : "text-red-700"}`}>
            {tool.is_available ? "Verfügbar" : "Verliehen"}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between mt-2">
        <Text className="text-sm text-gray-500">
          {Number(tool.daily_rate) > 0
            ? `${Number(tool.daily_rate).toFixed(2)} €/Tag`
            : "Kostenlos"}
        </Text>
        <Text className="text-xs text-gray-400">{tool.total_bookings} Buchungen</Text>
      </View>

      <View className="flex-row mt-3 gap-2">
        <TouchableOpacity
          className="flex-1 border border-primary-600 rounded-lg py-2 items-center"
          onPress={onEdit}
        >
          <Text className="text-sm text-primary-600 font-medium">Bearbeiten</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 border border-red-400 rounded-lg py-2 items-center"
          onPress={onDelete}
        >
          <Text className="text-sm text-red-500 font-medium">Löschen</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function MyToolsScreen() {
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useMyTools();
  const deleteTool = useDeleteTool();

  const tools = data?.items ?? [];

  const handleDelete = (toolId: string, toolTitle: string) => {
    Alert.alert(
      "Werkzeug löschen",
      `Möchtest du "${toolTitle}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschen",
          style: "destructive",
          onPress: () =>
            deleteTool.mutate(toolId, {
              onError: () => Alert.alert("Fehler", "Das Werkzeug konnte nicht gelöscht werden."),
            }),
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: "Meine Werkzeuge", headerBackTitle: "Zurück" }} />
      <View className="flex-1 bg-gray-50">
        <FlatList
          data={tools}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ToolListItem
              tool={item}
              onEdit={() => router.push(`/my-tools/${item.id}/edit`)}
              onDelete={() => handleDelete(item.id, item.title)}
            />
          )}
          contentContainerClassName="p-4"
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
          }
          ListEmptyComponent={
            isLoading ? (
              <View className="items-center justify-center py-20">
                <ActivityIndicator size="large" />
              </View>
            ) : (
              <View className="items-center justify-center py-20">
                <Text className="text-4xl mb-4">🔧</Text>
                <Text className="text-lg font-medium text-gray-500">
                  Keine Werkzeuge vorhanden
                </Text>
                <Text className="text-sm text-gray-400 mt-1">
                  Stelle dein erstes Werkzeug über den Tab "Einstellen" ein
                </Text>
              </View>
            )
          }
        />
      </View>
    </>
  );
}
