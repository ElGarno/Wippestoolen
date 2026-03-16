import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  Platform,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import api from "../../../lib/api";
import { useToolCategories } from "../../../hooks/useTools";
import { queryKeys } from "../../../constants/queryKeys";
import { colors } from "../../../constants/colors";
import { getPhotoUrl } from "../../../constants/config";
import ToolMap from "../../../components/tools/ToolMap";
import type { ToolListItem } from "../../../types";
import type { PaginatedToolResponse } from "../../../types/api";

// Category emoji map — slug must match backend slugs
const CATEGORY_EMOJI: Record<string, string> = {
  werkzeug: "🔧",
  garten: "🌱",
  fahrzeuge: "🚗",
  haushalt: "🏠",
  sport: "⚽",
  elektronik: "💡",
  reinigung: "🧹",
};

const STATUS_BAR_HEIGHT =
  Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) : 44;

// ─── Inline category chip ────────────────────────────────────────────────────

interface ChipProps {
  slug?: string;
  label: string;
  emoji?: string;
  isActive: boolean;
  onPress: () => void;
}

function CategoryChipInline({ slug, label, emoji, isActive, onPress }: ChipProps) {
  const categoryColor = slug
    ? colors.category[slug] ?? colors.category.default
    : colors.primary[600];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.chip,
        isActive
          ? { backgroundColor: colors.gray[900], borderColor: colors.gray[900] }
          : { backgroundColor: colors.white, borderColor: colors.gray[200] },
      ]}
    >
      {emoji ? (
        <Text style={styles.chipEmoji}>{emoji}</Text>
      ) : null}
      <Text
        style={[
          styles.chipLabel,
          { color: isActive ? colors.white : colors.gray[700] },
        ]}
      >
        {label}
      </Text>
      {isActive && slug && (
        <View style={[styles.chipDot, { backgroundColor: categoryColor }]} />
      )}
    </TouchableOpacity>
  );
}

// ─── Inline tool card ────────────────────────────────────────────────────────

interface CardProps {
  tool: ToolListItem;
  onPress: () => void;
}

function ToolCardInline({ tool, onPress }: CardProps) {
  const categoryColor =
    colors.category[tool.category.slug] ?? colors.category.default;

  const ratingStars = tool.average_rating
    ? "★".repeat(Math.round(tool.average_rating)) +
      "☆".repeat(5 - Math.round(tool.average_rating))
    : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.card}
    >
      {/* Category accent stripe */}
      <View style={[styles.cardStripe, { backgroundColor: categoryColor }]} />

      {/* Thumbnail */}
      <View style={styles.cardThumb}>
        {tool.primary_photo ? (
          <Image
            source={{ uri: getPhotoUrl(tool.primary_photo.medium_url || tool.primary_photo.original_url)! }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.cardImagePlaceholder, { backgroundColor: categoryColor + "22" }]}>
            <Text style={{ fontSize: 28 }}>
              {CATEGORY_EMOJI[tool.category.slug] ?? "🔧"}
            </Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        {/* Availability badge */}
        <View
          style={[
            styles.badge,
            {
              backgroundColor: tool.is_available
                ? colors.success + "18"
                : colors.error + "18",
            },
          ]}
        >
          <View
            style={[
              styles.badgeDot,
              { backgroundColor: tool.is_available ? colors.success : colors.error },
            ]}
          />
          <Text
            style={[
              styles.badgeText,
              { color: tool.is_available ? colors.success : colors.error },
            ]}
          >
            {tool.is_available ? "Verfügbar" : "Verliehen"}
          </Text>
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>
          {tool.title}
        </Text>

        {/* Rating */}
        {ratingStars && (
          <Text style={styles.cardRating}>
            <Text style={{ color: colors.accent }}>{ratingStars.slice(0, Math.round(tool.average_rating!))}</Text>
            <Text style={{ color: colors.gray[300] }}>{ratingStars.slice(Math.round(tool.average_rating!))}</Text>
            {"  "}
            <Text style={styles.cardRatingCount}>({tool.total_ratings})</Text>
          </Text>
        )}

        {/* Footer row */}
        <View style={styles.cardFooter}>
          <Text style={styles.cardPrice}>
            {Number(tool.daily_rate) === 0
              ? "Kostenlos"
              : `${Number(tool.daily_rate).toFixed(2)} €/Tag`}
          </Text>
          {tool.pickup_city ? (
            <Text style={styles.cardCity} numberOfLines={1}>
              📍 {tool.pickup_city}
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Home Screen ─────────────────────────────────────────────────────────────

type ViewMode = "list" | "map";

export default function HomeScreen() {

  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const { data: categories } = useToolCategories();

  const {
    data,
    isLoading,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.tools.list({ category: selectedCategory, available: true }),
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get<PaginatedToolResponse<ToolListItem>>("/tools", {
        params: { page: pageParam, page_size: 20, category: selectedCategory, available: true },
      });
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.has_next ? lastPage.page + 1 : undefined),
  });

  const allTools = data?.pages.flatMap((page) => page.items) ?? [];

  const categoryData = [
    { slug: undefined as string | undefined, name: "Alle" },
    ...(categories ?? []).map((c) => ({ slug: c.slug, name: c.name })),
  ];

  const ListHeader = (
    <>
      {/* ── Gradient header ── */}
      <LinearGradient
        colors={[colors.gradient.start, colors.gradient.end]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientHeader}
      >
        {/* Top bar */}
        <View style={styles.headerTopBar}>
          <Text style={styles.headerBrand}>Wippestoolen</Text>
          <TouchableOpacity
            onPress={() => router.push("/notifications")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.headerIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* Greeting */}
        <Text style={styles.headerGreeting}>Was brauchst du heute?</Text>

        {/* Search pill */}
        <TouchableOpacity
          style={styles.searchPill}
          activeOpacity={0.85}
          onPress={() => router.push("/(drawer)/(tabs)/search")}
        >
          <Text style={styles.searchPillIcon}>🔍</Text>
          <Text style={styles.searchPillText}>Werkzeuge suchen...</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* ── Category chips ── */}
      <View style={styles.categorySection}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
          data={categoryData}
          keyExtractor={(item) => item.slug ?? "all"}
          renderItem={({ item }) => (
            <CategoryChipInline
              slug={item.slug}
              label={item.name}
              emoji={item.slug ? (CATEGORY_EMOJI[item.slug] ?? "🔧") : "✨"}
              isActive={selectedCategory === item.slug}
              onPress={() => setSelectedCategory(item.slug)}
            />
          )}
        />
      </View>

      {/* ── View toggle (Liste / Karte) ── */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setViewMode("list")}
          style={[
            styles.toggleBtn,
            styles.toggleBtnLeft,
            viewMode === "list" && styles.toggleBtnActive,
          ]}
        >
          <Text
            style={[
              styles.toggleBtnText,
              viewMode === "list" && styles.toggleBtnTextActive,
            ]}
          >
            Liste
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setViewMode("map")}
          style={[
            styles.toggleBtn,
            styles.toggleBtnRight,
            viewMode === "map" && styles.toggleBtnActive,
          ]}
        >
          <Text
            style={[
              styles.toggleBtnText,
              viewMode === "map" && styles.toggleBtnTextActive,
            ]}
          >
            Karte
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Section title (list mode only) ── */}
      {viewMode === "list" && (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {selectedCategory
              ? (categories?.find((c) => c.slug === selectedCategory)?.name ?? "Werkzeuge")
              : "Alle Werkzeuge"}
          </Text>
          {data?.pages[0]?.total != null && (
            <Text style={styles.sectionCount}>{data.pages[0].total} verfügbar</Text>
          )}
        </View>
      )}
    </>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {viewMode === "map" ? (
        <View style={{ flex: 1 }}>
          <ScrollView style={{ flexGrow: 0 }}>{ListHeader}</ScrollView>
          <ToolMap
            tools={allTools}
            onToolPress={(toolId) => router.push(`/tool/${toolId}`)}
          />
        </View>
      ) : (
        <FlatList
          data={allTools}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ToolCardInline
              tool={item}
              onPress={() => router.push(`/tool/${item.id}`)}
            />
          )}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={ListHeader}
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
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyTitle}>Keine Werkzeuge gefunden</Text>
                <Text style={styles.emptySubtitle}>
                  Probiere eine andere Kategorie
                </Text>
              </View>
            )
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={colors.primary[600]} />
              </View>
            ) : null
          }
        />
      )}

      {/* ── FAB ── */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => router.push("/(drawer)/(tabs)/create")}
      >
        <LinearGradient
          colors={[colors.gradient.start, colors.gradient.end]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Text style={styles.fabIcon}>+</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },

  // Gradient header
  gradientHeader: {
    paddingTop: STATUS_BAR_HEIGHT + 12,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerIcon: {
    fontSize: 22,
    color: colors.white,
  },
  headerBrand: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.white,
    letterSpacing: 0.3,
  },
  headerGreeting: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.white,
    marginBottom: 16,
    letterSpacing: -0.3,
  },

  // Search pill
  searchPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 50,
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchPillIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchPillText: {
    fontSize: 15,
    color: colors.gray[400],
    flex: 1,
  },

  // Category section
  categorySection: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  categoryList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },

  // Chip
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 50,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    gap: 4,
  },
  chipEmoji: {
    fontSize: 14,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 2,
  },

  // View toggle
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  toggleBtn: {
    paddingHorizontal: 28,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.gray[300],
    backgroundColor: colors.white,
  },
  toggleBtnLeft: {
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    borderRightWidth: 0,
  },
  toggleBtnRight: {
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderLeftWidth: 1,
    borderLeftColor: colors.gray[300],
  },
  toggleBtnActive: {
    backgroundColor: colors.gray[900],
    borderColor: colors.gray[900],
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.gray[600],
  },
  toggleBtnTextActive: {
    color: colors.white,
  },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.gray[900],
  },
  sectionCount: {
    fontSize: 13,
    color: colors.gray[400],
  },

  // List
  listContent: {
    paddingBottom: 100,
  },

  // Tool card
  card: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: "hidden",
    // Subtle shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardStripe: {
    width: 4,
    alignSelf: "stretch",
  },
  cardThumb: {
    width: 80,
    height: 80,
    margin: 12,
    borderRadius: 10,
    overflow: "hidden",
    flexShrink: 0,
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardImagePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  cardContent: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 12,
    justifyContent: "space-between",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 50,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
    gap: 4,
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.gray[900],
    lineHeight: 20,
    marginBottom: 2,
  },
  cardRating: {
    fontSize: 12,
    marginBottom: 4,
  },
  cardRatingCount: {
    color: colors.gray[400],
    fontSize: 11,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardPrice: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary[600],
  },
  cardCity: {
    fontSize: 11,
    color: colors.gray[400],
    maxWidth: 100,
  },

  // Empty state
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.gray[700],
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.gray[400],
    textAlign: "center",
  },

  // Footer loader
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },

  // FAB
  fab: {
    position: "absolute",
    bottom: 72,
    right: 20,
    borderRadius: 28,
    shadowColor: colors.primary[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  fabIcon: {
    fontSize: 28,
    color: colors.white,
    lineHeight: 32,
    fontWeight: "300",
  },
});
