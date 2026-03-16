import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "../../../constants/colors";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary[600],
        tabBarInactiveTintColor: colors.gray[400],
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.gray[200],
          borderTopWidth: 1,
          paddingBottom: 4,
          paddingTop: 4,
          height: 56,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20, color: focused ? colors.primary[600] : colors.gray[400] }}>
              🏠
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Suche",
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20, color: focused ? colors.primary[600] : colors.gray[400] }}>
              🔍
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "Anbieten",
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20, color: focused ? colors.primary[600] : colors.gray[400] }}>
              ➕
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20, color: focused ? colors.primary[600] : colors.gray[400] }}>
              👤
            </Text>
          ),
        }}
      />
    </Tabs>
  );
}
