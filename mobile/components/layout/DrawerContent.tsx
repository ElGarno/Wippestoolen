import { View, Text, TouchableOpacity } from "react-native";
import { DrawerContentScrollView, DrawerContentComponentProps } from "@react-navigation/drawer";
import { useRouter, usePathname } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../contexts/AuthContext";
import { colors } from "../../constants/colors";

type MenuItem = {
  label: string;
  icon: string;
  route: string;
};

const menuItems: MenuItem[] = [
  { label: "Benachrichtigungen", icon: "🔔", route: "/notifications" },
  { label: "Meine Werkzeuge", icon: "🔧", route: "/my-tools" },
  { label: "Meine Buchungen", icon: "📋", route: "/my-bookings" },
  { label: "Einstellungen", icon: "⚙️", route: "/settings" },
];

export function DrawerContent(props: DrawerContentComponentProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const avatarLetter = user?.display_name?.charAt(0)?.toUpperCase() || "?";

  return (
    <DrawerContentScrollView
      {...props}
      style={{ backgroundColor: colors.gray[50] }}
      contentContainerStyle={{ flex: 1 }}
    >
      {/* Gradient header with user profile */}
      <LinearGradient
        colors={[colors.gradient.start, colors.gradient.end]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 28 }}
      >
        {/* Avatar */}
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: "rgba(255,255,255,0.25)",
            borderWidth: 2,
            borderColor: "rgba(255,255,255,0.5)",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 24, fontWeight: "800", color: colors.white }}>
            {avatarLetter}
          </Text>
        </View>

        {/* User info */}
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.white }}>
          {user?.display_name}
        </Text>
        <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>
          {user?.email}
        </Text>

        {/* Rating badge */}
        {user?.average_rating !== undefined && user.average_rating > 0 && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 8,
              backgroundColor: "rgba(255,255,255,0.2)",
              alignSelf: "flex-start",
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text style={{ fontSize: 13, color: colors.white }}>
              ⭐ {Number(user.average_rating).toFixed(1)} ({user.total_ratings})
            </Text>
          </View>
        )}
      </LinearGradient>

      {/* Menu items */}
      <View style={{ flex: 1, paddingTop: 8, paddingBottom: 8 }}>
        {menuItems.map((item) => {
          const isActive = pathname === item.route || pathname.startsWith(item.route + "/");

          return (
            <TouchableOpacity
              key={item.route}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 20,
                paddingVertical: 13,
                marginHorizontal: 8,
                marginVertical: 2,
                borderRadius: 12,
                backgroundColor: isActive ? colors.primary[50] : "transparent",
                borderLeftWidth: isActive ? 3 : 0,
                borderLeftColor: colors.primary[600],
              }}
              onPress={() => {
                router.push(item.route as never);
                props.navigation.closeDrawer();
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 20, marginRight: 14 }}>{item.icon}</Text>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: isActive ? "600" : "400",
                  color: isActive ? colors.primary[700] : colors.gray[700],
                }}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Logout at bottom */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.gray[200],
          paddingTop: 8,
          paddingBottom: 16,
        }}
      >
        <TouchableOpacity
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingVertical: 13,
            marginHorizontal: 8,
            borderRadius: 12,
          }}
          onPress={logout}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 20, marginRight: 14 }}>🚪</Text>
          <Text style={{ fontSize: 15, fontWeight: "500", color: colors.error }}>Abmelden</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
}
