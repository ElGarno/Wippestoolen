import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  RefreshControl,
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
import type { ToolListItem } from "../../../types";
import type { PaginatedToolResponse } from "../../../types/api";

// ─── Constants ────────────────────────────────────────────────────────────────

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

type SortOption = "created_at" | "daily_rate" | "rating" | "title";

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: "Neueste", value: "created_at" },
  { label: "Preis", value: "daily_rate" },
  { label: "Bewertung", value: "rating" },
  { label: "Name", value: "title" },
];

// ─── Category chip ────────────────────────────────────────────────────────────

interface ChipProps {
  slug?: string;
  label: string;
  emoji?: string;
  isActive: boolean;
  onPress: () => void;
}

function CategoryChipInline({ slug, label, emoji, isActive, onPress }: ChipProps) {
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
      {emoji ? <Text style={styles.chipEmoji}>{emoji}</Text> : null}
      <Text
        style={[
          styles.chipLabel,
          { color: isActive ? colors.white : colors.gray[700] },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Tool card ────────────────────────────────────────────────────────────────

interface CardProps {
  tool: ToolListItem;
  onPress: () => void;
}

function ToolCardInline({ tool, onPress }: CardProps) {
  const categoryColor =
    colors.category[tool.category.slug] ?? colors.category.default;

  const filledStars = tool.average_rating ? Math.round(tool.average_rating) : 0;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.card}>
      {/* Accent stripe */}
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

        {filledStars > 0 && (
          <Text style={styles.cardRating}>
            <Text style={{ color: colors.accent }}>{"★".repeat(filledStars)}</Text>
            <Text style={{ color: colors.gray[300] }}>{"☆".repeat(5 - filledStars)}</Text>
            {"  "}
            <Text style={styles.cardRatingCount}>({tool.total_ratings})</Text>
          </Text>
        )}

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

// ─── Search Screen ────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [sortBy, setSortBy] = useState<SortOption>("created_at");
  const [showSortMenu, setShowSortMenu] = useState(false);

  const { data: categories } = useToolCategories();

  // Debounce 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const params = {
    search: debouncedSearch || undefined,
    category: selectedCategory,
    sort_by: sortBy,
    sort_order: "desc" as const,
  };

  const {
    data,
    isLoading,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.tools.list(params),
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get<PaginatedToolResponse<ToolListItem>>("/tools", {
        params: { ...params, page: pageParam, page_size: 20 },
      });
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.has_next ? lastPage.page + 1 : undefined),
  });

  const allTools = data?.pages.flatMap((page) => page.items) ?? [];
  const totalCount = data?.pages[0]?.total ?? 0;

  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Neueste";

  const categoryData = [
    { slug: undefined as string | undefined, name: "Alle" },
    ...(categories ?? []).map((c) => ({ slug: c.slug, name: c.name })),
  ];

  const ListHeader = (
    <>
      {/* ── Category chips ── */}
      <View style={styles.filtersSection}>
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

        {/* Sort + count row */}
        <View style={styles.sortRow}>
          <Text style={styles.resultCount}>
            {isLoading
              ? "Suche..."
              : `${totalCount} Werkzeug${totalCount === 1 ? "" : "e"} gefunden`}
          </Text>

          {/* Sort selector */}
          <View>
            <TouchableOpacity
              style={styles.sortButton}
              onPress={() => setShowSortMenu(!showSortMenu)}
            >
              <Text style={styles.sortButtonText}>
                {currentSortLabel}
              </Text>
              <Text style={styles.sortChevron}>{showSortMenu ? "▲" : "▼"}</Text>
            </TouchableOpacity>

            {showSortMenu && (
              <View style={styles.sortMenu}>
                {SORT_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.sortMenuItem,
                      option.value === sortBy && styles.sortMenuItemActive,
                    ]}
                    onPress={() => {
                      setSortBy(option.value);
                      setShowSortMenu(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.sortMenuItemText,
                        option.value === sortBy && styles.sortMenuItemTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {option.value === sortBy && (
                      <Text style={{ color: colors.primary[600], fontSize: 12 }}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Gradient header with search bar ── */}
      <LinearGradient
        colors={[colors.gradient.start, colors.gradient.end]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientHeader}
      >
        <Text style={styles.headerTitle}>Werkzeuge suchen</Text>

        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Bohrmaschine, Leiter, Rasenmäher..."
            placeholderTextColor={colors.gray[400]}
            value={searchInput}
            onChangeText={setSearchInput}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          {searchInput.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchInput("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.clearButton}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* ── Results list ── */}
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
              <Text style={styles.emptyTitle}>Keine Ergebnisse</Text>
              {debouncedSearch ? (
                <Text style={styles.emptySubtitle}>
                  Keine Werkzeuge für "{debouncedSearch}" gefunden
                </Text>
              ) : (
                <Text style={styles.emptySubtitle}>
                  Probiere einen anderen Suchbegriff
                </Text>
              )}
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
        keyboardShouldPersistTaps="handled"
      />
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
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.white,
    marginBottom: 14,
    letterSpacing: -0.3,
  },

  // Search bar
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.gray[900],
    padding: 0,
  },
  clearButton: {
    fontSize: 16,
    color: colors.gray[400],
    paddingLeft: 8,
  },

  // Filters section
  filtersSection: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
    marginBottom: 8,
  },
  categoryList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },

  // Sort row
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  resultCount: {
    fontSize: 13,
    color: colors.gray[500],
    fontWeight: "500",
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.gray[100],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  sortButtonText: {
    fontSize: 13,
    color: colors.gray[700],
    fontWeight: "600",
  },
  sortChevron: {
    fontSize: 10,
    color: colors.gray[500],
  },
  sortMenu: {
    position: "absolute",
    right: 0,
    top: 34,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray[200],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
    minWidth: 140,
    overflow: "hidden",
  },
  sortMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sortMenuItemActive: {
    backgroundColor: colors.primary[50],
  },
  sortMenuItemText: {
    fontSize: 14,
    color: colors.gray[700],
  },
  sortMenuItemTextActive: {
    color: colors.primary[600],
    fontWeight: "600",
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

  // List
  listContent: {
    paddingBottom: 40,
  },

  // Tool card
  card: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: "hidden",
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
});
