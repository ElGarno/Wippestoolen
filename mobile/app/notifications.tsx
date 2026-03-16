import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from "../hooks/useNotifications";
import { colors } from "../constants/colors";
import type { Notification } from "../types";

const PRIORITY_DOT_COLORS: Record<string, string> = {
  urgent: colors.error,
  high: colors.accent,
  normal: "#60A5FA",
  low: colors.gray[300],
};

function NotificationItem({
  notification,
  onPress,
}: {
  notification: Notification;
  onPress: () => void;
}) {
  const isUnread = !notification.is_read;
  const dotColor = PRIORITY_DOT_COLORS[notification.priority] || colors.gray[300];

  return (
    <TouchableOpacity
      style={{
        flexDirection: "row",
        padding: 14,
        marginBottom: 8,
        borderRadius: 14,
        backgroundColor: isUnread ? "#FFF7ED" : colors.white,
        borderWidth: 1,
        borderColor: isUnread ? colors.primary[200] : colors.gray[100],
        borderLeftWidth: isUnread ? 3 : 1,
        borderLeftColor: isUnread ? colors.primary[600] : colors.gray[100],
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
      }}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Priority dot */}
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: dotColor,
          marginTop: 6,
          marginRight: 12,
          flexShrink: 0,
        }}
      />

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Text
            style={{
              fontSize: 14,
              flex: 1,
              marginRight: 8,
              color: isUnread ? colors.gray[900] : colors.gray[700],
              fontWeight: isUnread ? "600" : "400",
            }}
            numberOfLines={2}
          >
            {notification.title}
          </Text>
          <Text style={{ fontSize: 11, color: colors.gray[400], flexShrink: 0 }}>
            {new Date(notification.created_at).toLocaleDateString("de-DE", {
              day: "2-digit",
              month: "short",
            })}
          </Text>
        </View>
        <Text style={{ fontSize: 13, color: colors.gray[500], marginTop: 3 }} numberOfLines={2}>
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
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: colors.gray[50] }}>
        {/* Gradient header */}
        <LinearGradient
          colors={[colors.gradient.start, colors.gradient.end]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20 }}
        >
          <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 17, color: "rgba(255,255,255,0.9)" }}>‹ Zurück</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 26, fontWeight: "800", color: colors.white }}>
                  Benachrichtigungen
                </Text>
                {unreadCount > 0 && (
                  <View
                    style={{
                      backgroundColor: colors.white,
                      borderRadius: 12,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      minWidth: 24,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: colors.primary[600],
                      }}
                    >
                      {unreadCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>
                {unreadCount > 0
                  ? `${unreadCount} ungelesen`
                  : "Alles auf dem neusten Stand"}
              </Text>
            </View>

            {/* Mark all read button */}
            {unreadCount > 0 && (
              <TouchableOpacity
                onPress={() => markAllAsRead.mutate()}
                disabled={markAllAsRead.isPending}
                style={{
                  backgroundColor: "rgba(255,255,255,0.2)",
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  marginTop: 4,
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: colors.white,
                  }}
                >
                  Alle gelesen
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationItem
              notification={item}
              onPress={() => handleNotificationPress(item)}
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
                  <Text style={{ fontSize: 32 }}>🔔</Text>
                </View>
                <Text style={{ fontSize: 17, fontWeight: "600", color: colors.gray[500] }}>
                  Keine Benachrichtigungen
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: colors.gray[400],
                    marginTop: 6,
                    textAlign: "center",
                  }}
                >
                  Du bist auf dem neusten Stand
                </Text>
              </View>
            )
          }
        />
      </View>
    </>
  );
}
