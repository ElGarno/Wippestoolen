import { View, Text, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter, Stack } from "expo-router";
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from "../hooks/useNotifications";
import type { Notification } from "../types";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-400",
  normal: "bg-blue-400",
  low: "bg-gray-300",
};

function NotificationItem({
  notification,
  onPress,
}: {
  notification: Notification;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      className={`flex-row p-4 mb-2 rounded-xl border ${
        notification.is_read
          ? "bg-white border-gray-100"
          : "bg-blue-50 border-blue-100"
      }`}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Priority dot */}
      <View
        className={`w-2 h-2 rounded-full mt-1.5 mr-3 flex-shrink-0 ${
          PRIORITY_COLORS[notification.priority] || "bg-gray-300"
        }`}
      />

      <View className="flex-1">
        <View className="flex-row justify-between items-start">
          <Text
            className={`text-sm flex-1 mr-2 ${
              notification.is_read
                ? "text-gray-700"
                : "text-gray-900 font-semibold"
            }`}
            numberOfLines={2}
          >
            {notification.title}
          </Text>
          <Text className="text-xs text-gray-400 flex-shrink-0">
            {new Date(notification.created_at).toLocaleDateString("de-DE", {
              day: "2-digit",
              month: "short",
            })}
          </Text>
        </View>
        <Text className="text-sm text-gray-500 mt-0.5" numberOfLines={2}>
          {notification.message}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useNotifications({ size: 50 });
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const notifications = data?.items ?? [];
  const unreadCount = data?.unread_count ?? 0;

  const handleNotificationPress = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead.mutate(notification.id);
    }
    // Navigate based on related entity
    if (notification.related_booking_id) {
      router.push(`/booking/${notification.related_booking_id}`);
    } else if (notification.related_tool_id) {
      router.push(`/tool/${notification.related_tool_id}`);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Benachrichtigungen", headerBackTitle: "Zurück" }} />
      <View className="flex-1 bg-gray-50">
        {/* Header with mark-all-read */}
        {unreadCount > 0 && (
          <View className="bg-white px-4 py-3 border-b border-gray-100 flex-row justify-between items-center">
            <Text className="text-sm text-gray-500">
              {unreadCount} ungelesen
            </Text>
            <TouchableOpacity
              onPress={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
            >
              <Text className="text-sm text-primary-600 font-medium">
                Alle als gelesen markieren
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationItem
              notification={item}
              onPress={() => handleNotificationPress(item)}
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
                <Text className="text-4xl mb-4">🔔</Text>
                <Text className="text-lg font-medium text-gray-500">
                  Keine Benachrichtigungen
                </Text>
              </View>
            )
          }
        />
      </View>
    </>
  );
}
