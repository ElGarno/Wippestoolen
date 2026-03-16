import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useMyTools, useDeleteTool } from "../../hooks/useTools";
import { colors } from "../../constants/colors";
import type { Tool } from "../../types";

function ToolListItem({
  tool,
  onEdit,
  onDelete,
}: {
  tool: Tool;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text
            style={{ fontSize: 16, fontWeight: "600", color: colors.gray[900] }}
            numberOfLines={1}
          >
            {tool.title}
          </Text>
          <Text style={{ fontSize: 13, color: colors.gray[500], marginTop: 2 }}>
            {tool.category.name}
          </Text>
        </View>

        {/* Availability indicator */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: tool.is_available ? colors.success : colors.error,
            }}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: tool.is_available ? colors.success : colors.error,
            }}
          >
            {tool.is_available ? "Verfügbar" : "Verliehen"}
          </Text>
        </View>
      </View>

      {/* Stats row */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 10,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: colors.gray[100],
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: "500", color: colors.gray[700] }}>
          {Number(tool.daily_rate) > 0
            ? `${Number(tool.daily_rate).toFixed(2)} €/Tag`
            : "Kostenlos"}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={{ fontSize: 18 }}>📦</Text>
          <Text style={{ fontSize: 12, color: colors.gray[500] }}>
            {tool.total_bookings} {tool.total_bookings === 1 ? "Buchung" : "Buchungen"}
          </Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={{ flexDirection: "row", marginTop: 12, gap: 8 }}>
        <TouchableOpacity
          style={{
            flex: 1,
            borderWidth: 1.5,
            borderColor: colors.primary[600],
            borderRadius: 10,
            paddingVertical: 9,
            alignItems: "center",
          }}
          onPress={onEdit}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 14, color: colors.primary[600], fontWeight: "600" }}>
            Bearbeiten
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            flex: 1,
            borderWidth: 1.5,
            borderColor: colors.error,
            borderRadius: 10,
            paddingVertical: 9,
            alignItems: "center",
          }}
          onPress={onDelete}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 14, color: colors.error, fontWeight: "600" }}>Löschen</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function GradientHeader({ onBack }: { onBack: () => void }) {
  return (
    <LinearGradient
      colors={[colors.gradient.start, colors.gradient.end]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20 }}
    >
      <TouchableOpacity onPress={onBack} style={{ marginBottom: 8 }}>
        <Text style={{ fontSize: 17, color: "rgba(255,255,255,0.9)" }}>‹ Zurück</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 26, fontWeight: "800", color: colors.white }}>
        Meine Werkzeuge
      </Text>
      <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>
        Verwalte deine eingestellten Werkzeuge
      </Text>
    </LinearGradient>
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
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: colors.gray[50] }}>
        <GradientHeader onBack={() => router.back()} />
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
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor={colors.primary[600]}
              colors={[colors.primary[600]]}
            />
          }
          ListEmptyComponent={
            isLoading ? (
              <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
                <ActivityIndicator size="large" color={colors.primary[600]} />
              </View>
            ) : (
              <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    backgroundColor: colors.primary[50],
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <Text style={{ fontSize: 32 }}>🔧</Text>
                </View>
                <Text style={{ fontSize: 17, fontWeight: "600", color: colors.gray[500] }}>
                  Keine Werkzeuge vorhanden
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: colors.gray[400],
                    marginTop: 6,
                    textAlign: "center",
                    paddingHorizontal: 32,
                  }}
                >
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
