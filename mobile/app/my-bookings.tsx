import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useBookings } from "../hooks/useBookings";
import { BookingCard } from "../components/bookings/BookingCard";
import { colors } from "../constants/colors";

type RoleTab = "borrower" | "owner";

const TABS: { label: string; value: RoleTab }[] = [
  { label: "Ausgeliehen", value: "borrower" },
  { label: "Verliehen", value: "owner" },
];

export default function MyBookingsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<RoleTab>("borrower");

  const { data, isLoading, refetch, isRefetching } = useBookings({
    role: activeTab,
    size: 50,
  });

  const bookings = data?.bookings ?? [];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Gradient header */}
        <LinearGradient
          colors={[colors.gradient.start, colors.gradient.end]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientHeader}
        >
          <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 17, color: "rgba(255,255,255,0.9)" }}>‹ Zurück</Text>
          </TouchableOpacity>
          <Text style={styles.gradientTitle}>Meine Buchungen</Text>
          <Text style={styles.gradientSubtitle}>Verwalte deine Ausleihen und Verleihungen</Text>
        </LinearGradient>

        {/* Tab switcher with orange active underline */}
        <View style={styles.tabBar}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.value}
              style={styles.tabItem}
              onPress={() => setActiveTab(tab.value)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === tab.value ? styles.tabLabelActive : styles.tabLabelInactive,
                ]}
              >
                {tab.label}
              </Text>
              {activeTab === tab.value && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Booking list */}
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <BookingCard booking={item} role={activeTab} />}
          contentContainerStyle={styles.listContent}
          style={styles.list}
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
              <View style={styles.emptyContainer}>
                <ActivityIndicator size="large" color={colors.primary[600]} />
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTitle}>Keine Buchungen</Text>
                <Text style={styles.emptySubtitle}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  gradientHeader: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 20,
  },
  gradientTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.white,
    letterSpacing: -0.3,
  },
  gradientSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginTop: 3,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    position: "relative",
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  tabLabelActive: {
    color: colors.primary[600],
  },
  tabLabelInactive: {
    color: colors.gray[500],
  },
  tabUnderline: {
    position: "absolute",
    bottom: 0,
    left: "15%",
    right: "15%",
    height: 2.5,
    backgroundColor: colors.primary[600],
    borderRadius: 2,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.gray[500],
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.gray[400],
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
