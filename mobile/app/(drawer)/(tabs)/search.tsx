import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import api from "../../../lib/api";
import { useToolCategories } from "../../../hooks/useTools";
import { ToolCard } from "../../../components/tools/ToolCard";
import { CategoryChip } from "../../../components/tools/CategoryChip";
import { queryKeys } from "../../../constants/queryKeys";
import type { ToolListItem } from "../../../types";
import type { PaginatedToolResponse } from "../../../types/api";

type SortOption = "created_at" | "daily_rate" | "rating" | "title";

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: "Neueste", value: "created_at" },
  { label: "Preis", value: "daily_rate" },
  { label: "Bewertung", value: "rating" },
  { label: "Name", value: "title" },
];

export default function SearchScreen() {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [sortBy, setSortBy] = useState<SortOption>("created_at");
  const [showSortMenu, setShowSortMenu] = useState(false);

  const { data: categories } = useToolCategories();

  // Debounce search input
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

  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Neueste";

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 pt-14 pb-3 border-b border-gray-100">
        <Text className="text-xl font-bold text-gray-900 mb-3">Suche</Text>
        {/* Search input */}
        <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-2">
          <Text className="text-gray-400 mr-2">🔍</Text>
          <TextInput
            className="flex-1 text-base text-gray-900"
            placeholder="Werkzeuge suchen..."
            placeholderTextColor="#9ca3af"
            value={searchInput}
            onChangeText={setSearchInput}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {searchInput.length > 0 && (
            <TouchableOpacity onPress={() => setSearchInput("")}>
              <Text className="text-gray-400 text-lg">✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters row */}
      <View className="bg-white border-b border-gray-100">
        {/* Category chips */}
        {categories && (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="px-4 py-3"
            data={[
              { slug: undefined as string | undefined, name: "Alle", tool_count: undefined as number | undefined },
              ...categories.map((c) => ({ slug: c.slug, name: c.name, tool_count: c.tool_count })),
            ]}
            keyExtractor={(item) => item.slug || "all"}
            renderItem={({ item }) => (
              <CategoryChip
                label={item.name}
                isActive={selectedCategory === item.slug}
                count={item.tool_count}
                onPress={() => setSelectedCategory(item.slug || undefined)}
              />
            )}
          />
        )}

        {/* Sort bar */}
        <View className="flex-row items-center justify-between px-4 pb-3">
          {debouncedSearch || selectedCategory ? (
            <Text className="text-sm text-gray-500">{totalCount} Ergebnisse</Text>
          ) : (
            <Text className="text-sm text-gray-500">Alle Werkzeuge</Text>
          )}
          <View className="relative">
            <TouchableOpacity
              className="flex-row items-center bg-gray-100 px-3 py-1.5 rounded-lg"
              onPress={() => setShowSortMenu(!showSortMenu)}
            >
              <Text className="text-sm text-gray-700 mr-1">Sortierung: {currentSortLabel}</Text>
              <Text className="text-xs text-gray-500">{showSortMenu ? "▲" : "▼"}</Text>
            </TouchableOpacity>
            {showSortMenu && (
              <View className="absolute right-0 top-9 bg-white border border-gray-200 rounded-xl shadow-md z-10 w-36">
                {SORT_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    className={`px-4 py-3 ${option.value === sortBy ? "bg-primary-50" : ""}`}
                    onPress={() => {
                      setSortBy(option.value);
                      setShowSortMenu(false);
                    }}
                  >
                    <Text
                      className={`text-sm ${
                        option.value === sortBy
                          ? "text-primary-600 font-semibold"
                          : "text-gray-700"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Results */}
      <FlatList
        data={allTools}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ToolCard tool={item} />}
        contentContainerClassName="p-4"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
        ListEmptyComponent={
          isLoading ? (
            <View className="items-center justify-center py-20">
              <ActivityIndicator size="large" />
            </View>
          ) : (
            <View className="items-center justify-center py-20">
              <Text className="text-4xl mb-4">🔍</Text>
              <Text className="text-lg font-medium text-gray-500">Keine Ergebnisse</Text>
              {debouncedSearch ? (
                <Text className="text-sm text-gray-400 mt-1">
                  Keine Werkzeuge für "{debouncedSearch}" gefunden
                </Text>
              ) : null}
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
            <View className="py-4 items-center">
              <ActivityIndicator />
            </View>
          ) : null
        }
      />
    </View>
  );
}
