import { useState, useCallback } from "react";
import { View, Text, FlatList, RefreshControl, TouchableOpacity } from "react-native";
import { useNavigation } from "expo-router";
import { DrawerActions } from "@react-navigation/native";
import { useInfiniteQuery } from "@tanstack/react-query";
import api from "../../../lib/api";
import { useToolCategories } from "../../../hooks/useTools";
import { ToolCard } from "../../../components/tools/ToolCard";
import { CategoryChip } from "../../../components/tools/CategoryChip";
import { queryKeys } from "../../../constants/queryKeys";
import type { ToolListItem } from "../../../types";
import type { PaginatedToolResponse } from "../../../types/api";

export default function HomeScreen() {
  const navigation = useNavigation();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();

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

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 pt-14 pb-3 flex-row items-center justify-between border-b border-gray-100">
        <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
          <Text className="text-2xl">☰</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-primary-600">Wippestoolen</Text>
        <TouchableOpacity>
          <Text className="text-2xl">🔔</Text>
        </TouchableOpacity>
      </View>

      {/* Category filter */}
      {categories && (
        <View className="bg-white py-3 border-b border-gray-100">
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="px-4"
            data={[{ slug: undefined, name: "Alle", tool_count: undefined }, ...categories.map(c => ({ slug: c.slug, name: c.name, tool_count: c.tool_count }))]}
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
        </View>
      )}

      {/* Tool list */}
      <FlatList
        data={allTools}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ToolCard tool={item} />}
        contentContainerClassName="p-4"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View className="items-center justify-center py-20">
              <Text className="text-4xl mb-4">🔍</Text>
              <Text className="text-lg font-medium text-gray-500">
                Keine Werkzeuge gefunden
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
      />
    </View>
  );
}
