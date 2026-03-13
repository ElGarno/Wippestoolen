import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Stack } from "expo-router";
import { useBookings } from "../hooks/useBookings";
import { BookingCard } from "../components/bookings/BookingCard";

type RoleTab = "borrower" | "owner";

const TABS: { label: string; value: RoleTab }[] = [
  { label: "Als Ausleiher", value: "borrower" },
  { label: "Als Verleiher", value: "owner" },
];

export default function MyBookingsScreen() {
  const [activeTab, setActiveTab] = useState<RoleTab>("borrower");

  const { data, isLoading, refetch, isRefetching } = useBookings({
    role: activeTab,
    size: 50,
  });

  const bookings = data?.bookings ?? [];

  return (
    <>
      <Stack.Screen options={{ title: "Meine Buchungen", headerBackTitle: "Zurück" }} />
      <View className="flex-1 bg-gray-50">
        {/* Tab bar */}
        <View className="bg-white flex-row border-b border-gray-100">
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.value}
              className={`flex-1 py-3 items-center border-b-2 ${
                activeTab === tab.value ? "border-primary-600" : "border-transparent"
              }`}
              onPress={() => setActiveTab(tab.value)}
            >
              <Text
                className={`text-sm font-medium ${
                  activeTab === tab.value ? "text-primary-600" : "text-gray-500"
                }`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* List */}
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <BookingCard booking={item} role={activeTab} />}
          contentContainerClassName="p-4"
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
          ListEmptyComponent={
            isLoading ? (
              <View className="items-center justify-center py-20">
                <ActivityIndicator size="large" />
              </View>
            ) : (
              <View className="items-center justify-center py-20">
                <Text className="text-4xl mb-4">📋</Text>
                <Text className="text-lg font-medium text-gray-500">Keine Buchungen</Text>
                <Text className="text-sm text-gray-400 mt-1">
                  {activeTab === "borrower"
                    ? "Du hast noch keine Werkzeuge ausgeliehen"
                    : "Du hast noch keine Verleihungen"}
                </Text>
              </View>
            )
          }
        />
      </View>
    </>
  );
}
