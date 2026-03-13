import { View, Text, TouchableOpacity } from "react-native";
import { DrawerContentScrollView, DrawerContentComponentProps } from "@react-navigation/drawer";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";

export function DrawerContent(props: DrawerContentComponentProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const menuItems = [
    { label: "Benachrichtigungen", icon: "🔔", route: "/notifications" },
    { label: "Meine Werkzeuge", icon: "🔧", route: "/my-tools" },
    { label: "Meine Buchungen", icon: "📋", route: "/my-bookings" },
    { label: "Einstellungen", icon: "⚙️", route: "/settings" },
  ];

  return (
    <DrawerContentScrollView {...props} className="bg-white">
      {/* User profile header */}
      <View className="px-4 py-6 border-b border-gray-200">
        <View className="w-14 h-14 bg-primary-100 rounded-full items-center justify-center mb-3">
          <Text className="text-xl font-bold text-primary-600">
            {user?.display_name?.charAt(0)?.toUpperCase() || "?"}
          </Text>
        </View>
        <Text className="text-lg font-semibold text-gray-900">{user?.display_name}</Text>
        <Text className="text-sm text-gray-500">{user?.email}</Text>
        {user?.average_rating !== undefined && user.average_rating > 0 && (
          <Text className="text-sm text-yellow-600 mt-1">
            ⭐ {user.average_rating.toFixed(1)} ({user.total_ratings})
          </Text>
        )}
      </View>

      {/* Menu items */}
      <View className="py-2">
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.route}
            className="flex-row items-center px-4 py-3"
            onPress={() => {
              router.push(item.route as never);
              props.navigation.closeDrawer();
            }}
          >
            <Text className="text-lg mr-3">{item.icon}</Text>
            <Text className="text-base text-gray-700">{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout */}
      <View className="border-t border-gray-200 mt-4 pt-2">
        <TouchableOpacity className="flex-row items-center px-4 py-3" onPress={logout}>
          <Text className="text-lg mr-3">🚪</Text>
          <Text className="text-base text-red-600">Abmelden</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
}
