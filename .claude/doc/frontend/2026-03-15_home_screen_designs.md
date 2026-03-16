# Home Screen Design Directions

**Date**: 2026-03-15
**Context**: Wippestoolen mobile app (React Native, Expo SDK 54, NativeWind v4, Expo Router)
**Scope**: Drei distinct visual und layout directions fuer den Home Screen

---

## Current State Analysis

Der bestehende Home Screen (`mobile/app/(drawer)/(tabs)/index.tsx`) ist funktional, aber visuell neutral:

- Plain white Header-Bar mit Emoji-Icons fuer Menu und Notifications
- Horizontaler Category-Chip-Scroll (full-width, plain gray/blue pills)
- Vertikale `FlatList` mit `ToolCard`-Komponenten (full-width cards, 160px Image + Text-Block)
- `bg-gray-50` Background
- Kein Greeting, keine Search-Bar, kein Location-Kontext
- Keine Hero-Section oder visuelle Hierarchie ausser dem App-Namen

---

## Design Direction 1: Clean & Minimal

### Visuelle Beschreibung

Der Screen fuehlt sich wie eine Premium-iOS-App an. Alles atmet. Der Header enthaelt einen zweizeiligen Greeting-Text in einer grossen, leichten Schrift mit der Notification-Bell weit rechts. Darunter sitzt eine weich schattierte weisse Search-Pill auf dem gleichen Off-White-Background -- kein sichtbarer Rahmen, nur eine sanfte Elevation. Kategorien werden als kleine Text-Labels mit einem duennen Unterstrich-Indikator fuer den aktiven Zustand gerendert -- keine gefuellte Pill. Das Tool-Grid ist ein Zwei-Spalten-Layout mit Karten, die grosszuegige abgerundete Ecken (24px), ein hohes Bild und minimalen Text haben -- nur Titel und Preis, mit dem Owner-Namen in einer winzigen grauen Zeile. Keine Border auf den Karten; Tiefe kommt ausschliesslich durch einen sanften Schatten. Nicht verfuegbare Tools erhalten ein 40% Opacity-Overlay mit einem kleinen Lock-Icon.

### Color Palette

| Rolle | Hex | Verwendung |
|-------|-----|------------|
| Background | `#F5F5F0` | Screen-Hintergrund (warmes Off-White) |
| Surface | `#FFFFFF` | Karten, Search-Bar, Header |
| Primary Text | `#1A1A1A` | Titel, Greeting-Name |
| Secondary Text | `#8A8A8A` | Owner-Name, Metadaten |
| Accent / aktiv | `#2563EB` | Aktiver Kategorie-Unterstrich, Preis-Text |
| Shadow | `#00000014` | Karten-Elevation |

### Key Layout Decisions

- Grid: 2 Spalten, gap-3, Karten sind `(screenWidth - 48) / 2` breit
- Card Style: `rounded-3xl`, keine Border, `shadow-md`, Image-Hoehe 160px, Padding 12px
- Kategorie-Indikator: Aktiver Zustand nutzt 2px Bottom-Border (kein gefuellter Background)
- Search-Bar: Full-width, `rounded-full`, weisser Background, shadow-sm, 48px Hoehe
- Spacing-Rhythmus: 8px Basis, Hauptsektionen 24px auseinander

### Code

```tsx
import { useState, useCallback } from "react";
import {
  View, Text, FlatList, RefreshControl, TouchableOpacity,
  TextInput, Image, Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import api from "../../../lib/api";
import { useToolCategories } from "../../../hooks/useTools";
import { queryKeys } from "../../../constants/queryKeys";
import type { ToolListItem } from "../../../types";
import type { PaginatedToolResponse } from "../../../types/api";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = (SCREEN_WIDTH - 48 - 12) / 2;

function MinimalToolCard({ tool }: { tool: ToolListItem }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={{
        width: CARD_WIDTH,
        backgroundColor: "#fff",
        borderRadius: 24,
        overflow: "hidden",
        marginBottom: 12,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      }}
      onPress={() => router.push(`/tool/${tool.id}`)}
      activeOpacity={0.9}
    >
      <View className="h-40 bg-[#F0F0EA]">
        {tool.primary_photo ? (
          <Image
            source={{ uri: tool.primary_photo.medium_url || tool.primary_photo.original_url }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-full items-center justify-center">
            <Text className="text-3xl opacity-40">🔧</Text>
          </View>
        )}
        {!tool.is_available && (
          <View className="absolute inset-0 bg-white/60 items-center justify-center">
            <Text className="text-lg">🔒</Text>
          </View>
        )}
      </View>
      <View className="p-3">
        <Text className="text-sm font-semibold text-[#1A1A1A] leading-tight" numberOfLines={2}>
          {tool.title}
        </Text>
        {Number(tool.daily_rate) > 0 && (
          <Text className="text-sm font-semibold text-[#2563EB] mt-1">
            {Number(tool.daily_rate).toFixed(2)} €
          </Text>
        )}
        <Text className="text-xs text-[#8A8A8A] mt-0.5" numberOfLines={1}>
          {tool.owner.display_name}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreenMinimal() {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [searchText, setSearchText] = useState("");
  const { data: categories } = useToolCategories();
  const { data, isLoading, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
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
  const allCategories = [
    { slug: undefined, name: "Alle" },
    ...(categories?.map((c) => ({ slug: c.slug, name: c.name })) ?? []),
  ];

  return (
    <View className="flex-1 bg-[#F5F5F0]">
      <FlatList
        data={allTools}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 24 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor="#8A8A8A" />
        }
        onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => <MinimalToolCard tool={item} />}
        ListHeaderComponent={
          <>
            <View className="px-6 pt-14 pb-4">
              <Text className="text-sm text-[#8A8A8A]">Willkommen zurueck</Text>
              <Text className="text-2xl text-[#1A1A1A] font-semibold tracking-tight mt-0.5">
                Was brauchst du heute?
              </Text>
            </View>
            <View
              className="mx-6 mb-5 bg-white rounded-full px-4 h-12 flex-row items-center"
              style={{ shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}
            >
              <Text className="text-[#8A8A8A] text-base">🔍</Text>
              <TextInput
                className="text-sm text-[#1A1A1A] ml-2 flex-1 h-full"
                placeholder="Werkzeug suchen..."
                placeholderTextColor="#8A8A8A"
                value={searchText}
                onChangeText={setSearchText}
              />
            </View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 24, gap: 20, paddingBottom: 12 }}
              data={allCategories}
              keyExtractor={(item) => item.slug ?? "all"}
              renderItem={({ item }) => {
                const active = selectedCategory === item.slug;
                return (
                  <TouchableOpacity
                    onPress={() => setSelectedCategory(item.slug)}
                    activeOpacity={0.7}
                    className="pb-2"
                    style={active ? { borderBottomWidth: 2, borderBottomColor: "#2563EB" } : {}}
                  >
                    <Text className={`text-sm ${active ? "text-[#1A1A1A] font-semibold" : "text-[#8A8A8A]"}`}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
            <View className="px-6 pt-2 pb-3">
              <Text className="text-xs font-medium text-[#8A8A8A] uppercase tracking-widest">
                In deiner Naehe
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View className="items-center justify-center py-20">
              <Text className="text-3xl mb-3 opacity-30">🔧</Text>
              <Text className="text-sm text-[#8A8A8A]">Keine Werkzeuge gefunden</Text>
            </View>
          )
        }
      />
    </View>
  );
}
```

---

## Design Direction 2: Bold & Vibrant

### Visuelle Beschreibung

Der Screen kommuniziert Community-Energie. Der Header ist ein vollflaechen Gradient-Background (tiefes Orange-Rot zu warmem Amber). Die Search-Bar sitzt als floating weisse Pill innerhalb der Gradient-Area. Die Kategorie-Chips zeigen Icon + Label in einem horizontalen Scroll -- der aktive Chip invertiert zu solidem Dunkel-Background mit weissem Text. Das Tool-Layout ist eine einzige Spalte mit breiteren Karten: quadratisches Thumbnail links (80x80), Text rechts, gruene/rote "Verfuegbar"/"Verliehen" Pill-Badges. Ein prominenter orangener FAB-Button am unteren rechten Rand ermoeglicht das Einstellen neuer Tools.

### Color Palette

| Rolle | Hex |
|-------|-----|
| Header Gradient Start | `#E8470A` |
| Header Gradient Ende | `#F5A623` |
| Background | `#FAFAFA` |
| Aktiver Chip | `#1A1A1A` |
| Verfuegbar-Badge | `#16A34A` |
| Preis | `#E8470A` |
| FAB | `#E8470A` |

### Key Layout Decisions

- Grid: Einzelne Spalte, horizontal card layout (Thumbnail links, Text rechts)
- Card Style: `rounded-2xl`, 4px linker farbiger Akzent-Streifen nach Kategorie, flat (kein Schatten)
- Kategorie-Chips: Icon + Label, 40px Hoehe, aktiv = dunkel gefuellt
- Header: `LinearGradient` aus `expo-linear-gradient`
- FAB: Fixed bottom-right, `rounded-full`, Gradient-Farbe
- Neue Dependency: `expo-linear-gradient` (`npx expo install expo-linear-gradient`)

### Code

```tsx
import { useState } from "react";
import {
  View, Text, FlatList, RefreshControl, TouchableOpacity,
  TextInput, Image, StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import api from "../../../lib/api";
import { useToolCategories } from "../../../hooks/useTools";
import { queryKeys } from "../../../constants/queryKeys";
import type { ToolListItem } from "../../../types";
import type { PaginatedToolResponse } from "../../../types/api";

const CATEGORY_COLORS: Record<string, string> = {
  werkzeug: "#F97316", garten: "#22C55E", fahrzeuge: "#3B82F6",
  haushalt: "#A855F7", sport: "#EAB308",
};
const CATEGORY_ICONS: Record<string, string> = {
  werkzeug: "🔧", garten: "🌿", fahrzeuge: "🚗", haushalt: "🏠", sport: "⚽",
};

function BoldToolCard({ tool }: { tool: ToolListItem }) {
  const router = useRouter();
  const accentColor = CATEGORY_COLORS[tool.category.slug] ?? "#9CA3AF";
  return (
    <TouchableOpacity
      className="bg-white rounded-2xl mb-3 mx-4 flex-row overflow-hidden"
      onPress={() => router.push(`/tool/${tool.id}`)}
      activeOpacity={0.85}
    >
      <View style={{ width: 4, backgroundColor: accentColor }} />
      <View className="w-20 h-20 bg-[#F5F5F5] flex-shrink-0">
        {tool.primary_photo ? (
          <Image source={{ uri: tool.primary_photo.medium_url || tool.primary_photo.original_url }}
            className="w-full h-full" resizeMode="cover" />
        ) : (
          <View className="w-full h-full items-center justify-center">
            <Text className="text-2xl">{CATEGORY_ICONS[tool.category.slug] ?? "🔧"}</Text>
          </View>
        )}
      </View>
      <View className="flex-1 p-3 justify-between">
        <View className="flex-row items-start justify-between">
          <Text className="text-base font-semibold text-[#1A1A1A] flex-1 mr-2" numberOfLines={1}>
            {tool.title}
          </Text>
          {Number(tool.daily_rate) > 0 && (
            <Text className="text-base font-bold text-[#E8470A]">
              {Number(tool.daily_rate).toFixed(0)} €
            </Text>
          )}
        </View>
        <Text className="text-xs text-[#6B7280] mt-0.5" numberOfLines={1}>
          {tool.owner.display_name}{tool.pickup_city ? ` · ${tool.pickup_city}` : ""}
        </Text>
        <View className="flex-row items-center justify-between mt-1.5">
          {tool.is_available ? (
            <View className="bg-[#DCFCE7] rounded-full px-2 py-0.5">
              <Text className="text-xs text-[#16A34A] font-medium">Verfuegbar</Text>
            </View>
          ) : (
            <View className="bg-[#FEE2E2] rounded-full px-2 py-0.5">
              <Text className="text-xs text-[#DC2626] font-medium">Verliehen</Text>
            </View>
          )}
          {tool.average_rating != null && tool.average_rating > 0 && (
            <Text className="text-xs text-[#6B7280]">
              ⭐ {Number(tool.average_rating).toFixed(1)}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreenBold() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [searchText, setSearchText] = useState("");
  const { data: categories } = useToolCategories();
  const { data, isLoading, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
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
  const allCategories = [
    { slug: undefined, name: "Alle", icon: "✨" },
    ...(categories?.map((c) => ({ slug: c.slug, name: c.name, icon: CATEGORY_ICONS[c.slug] ?? "📦" })) ?? []),
  ];

  return (
    <View className="flex-1 bg-[#FAFAFA]">
      <StatusBar barStyle="light-content" />
      <FlatList
        data={allTools}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <BoldToolCard tool={item} />}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor="#E8470A" />
        }
        onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <>
            <LinearGradient colors={["#E8470A", "#F5A623"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              className="pt-14 pb-6 px-6">
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="text-white/80 text-sm">Werkzeug leihen statt kaufen</Text>
                  <Text className="text-white text-2xl font-bold mt-0.5 leading-tight">
                    Was brauchst{"\n"}du heute?
                  </Text>
                </View>
                <TouchableOpacity className="bg-white/20 rounded-full w-10 h-10 items-center justify-center">
                  <Text className="text-white text-lg">🔔</Text>
                </TouchableOpacity>
              </View>
              <View className="bg-white rounded-2xl mt-4 px-4 h-12 flex-row items-center"
                style={{ shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}>
                <Text className="text-[#9CA3AF]">🔍</Text>
                <TextInput className="text-sm text-[#1A1A1A] ml-2 flex-1 h-full"
                  placeholder="Bohrmaschine, Rasenmaeher..." placeholderTextColor="#9CA3AF"
                  value={searchText} onChangeText={setSearchText} />
              </View>
            </LinearGradient>

            <View className="bg-[#FAFAFA] py-4">
              <FlatList horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
                data={allCategories} keyExtractor={(item) => item.slug ?? "all"}
                renderItem={({ item }) => {
                  const active = selectedCategory === item.slug;
                  return (
                    <TouchableOpacity onPress={() => setSelectedCategory(item.slug)} activeOpacity={0.8}
                      className={`rounded-2xl px-3 py-2 flex-row items-center ${active ? "bg-[#1A1A1A]" : "bg-[#F0F0F0]"}`}
                      style={{ gap: 6 }}>
                      <Text className="text-sm">{item.icon}</Text>
                      <Text className={`text-sm font-medium ${active ? "text-white" : "text-[#444]"}`}>
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  );
                }} />
            </View>

            <View className="flex-row items-center justify-between px-4 pb-3">
              <Text className="text-lg font-bold text-[#1A1A1A]">Verfuegbare Werkzeuge</Text>
              {allTools.length > 0 && (
                <View className="bg-[#FFF3E8] rounded-full px-2 py-0.5">
                  <Text className="text-xs font-semibold text-[#E8470A]">{allTools.length}</Text>
                </View>
              )}
            </View>
          </>
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View className="items-center justify-center py-16 px-8">
              <Text className="text-4xl mb-3">🔍</Text>
              <Text className="text-base font-bold text-[#1A1A1A] text-center">Noch keine Werkzeuge</Text>
              <Text className="text-sm text-[#6B7280] text-center mt-1">Sei der Erste in deiner Nachbarschaft!</Text>
            </View>
          )
        }
      />
      <TouchableOpacity className="absolute bottom-6 right-4 rounded-full w-14 h-14 items-center justify-center"
        style={{ backgroundColor: "#E8470A", shadowColor: "#E8470A", shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 10 }}
        onPress={() => router.push("/my-tools/create")} activeOpacity={0.85}>
        <Text className="text-white text-2xl leading-none">+</Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

## Design Direction 3: Professional & Dense

### Visuelle Beschreibung

Der Screen priorisiert Informationsdichte und Scan-Geschwindigkeit. Der Header ist ein solider dunkler Navy-Balken mit dem App-Namen. Die Search-Bar ist persistent (immer sichtbar, rechteckig, 1px Border, mit einem "Filter"-Button). Kategorien sind kompakte 32px Text-Pills. Jede Tool-Row ist nur 80px hoch: 72x72px Thumbnail links, dann Titel, Kategorie + Stadt + Owner in einer Zeile, Rating + Preis in einer zweiten Zeile. Verfuegbarkeit wird nur durch einen farbigen Dot (gruen/rot) angezeigt -- kein Text-Label. Wirkt wie ein professioneller Werkzeugverleih-Katalog.

### Color Palette

| Rolle | Hex |
|-------|-----|
| Header Background | `#0F172A` |
| Header Text | `#F8FAFC` |
| Screen Background | `#F8FAFC` |
| Surface | `#FFFFFF` |
| Row Divider | `#E2E8F0` |
| Primary Text | `#0F172A` |
| Secondary Text | `#64748B` |
| Aktive Kategorie | `#0369A1` / `#E0F2FE` |
| Verfuegbar Dot | `#22C55E` |
| Verliehen Dot | `#EF4444` |

### Key Layout Decisions

- Grid: Einzelne Spalte, tabellarische Rows a 80px Hoehe
- Card Style: Keine abgerundeten Ecken (oder 4px max), kein Schatten, duenne Bottom-Border-Trennlinie
- Kategorie-Chips: Klein, 32px Hoehe, text-only
- Search-Bar: Rechteckig (`rounded-lg`), 1px Border, immer sichtbar, mit "Filter"-Button
- Header: Solid Dark Bar, kein Gradient
- Keine neue Dependency benoetigt

### Code

```tsx
import { useState } from "react";
import {
  View, Text, FlatList, RefreshControl, TouchableOpacity,
  TextInput, Image, StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import api from "../../../lib/api";
import { useToolCategories } from "../../../hooks/useTools";
import { queryKeys } from "../../../constants/queryKeys";
import type { ToolListItem } from "../../../types";
import type { PaginatedToolResponse } from "../../../types/api";

function DenseToolRow({ tool }: { tool: ToolListItem }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      className="bg-white border-b border-[#E2E8F0] flex-row items-center px-4 py-2"
      style={{ gap: 12 }}
      onPress={() => router.push(`/tool/${tool.id}`)}
      activeOpacity={0.7}
    >
      <View className="w-[72px] h-[72px] rounded bg-[#F1F5F9] overflow-hidden flex-shrink-0">
        {tool.primary_photo ? (
          <Image source={{ uri: tool.primary_photo.medium_url || tool.primary_photo.original_url }}
            className="w-full h-full" resizeMode="cover" />
        ) : (
          <View className="w-full h-full items-center justify-center">
            <Text className="text-xl">🔧</Text>
          </View>
        )}
      </View>
      <View className="flex-1 py-0.5">
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <View className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: tool.is_available ? "#22C55E" : "#EF4444" }} />
          <Text className="text-sm font-semibold text-[#0F172A] flex-1" numberOfLines={1}>
            {tool.title}
          </Text>
        </View>
        <Text className="text-xs text-[#64748B] mt-0.5" numberOfLines={1}>
          {tool.category.name}
          {tool.pickup_city ? ` · ${tool.pickup_city}` : ""}
          {" · "}{tool.owner.display_name}
        </Text>
        <View className="flex-row items-center justify-between mt-1.5">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            {tool.average_rating != null && tool.average_rating > 0 && (
              <Text className="text-xs text-[#64748B]">
                ⭐ {Number(tool.average_rating).toFixed(1)}
              </Text>
            )}
            {!tool.is_available && (
              <Text className="text-xs text-[#EF4444] font-medium">Verliehen</Text>
            )}
          </View>
          {Number(tool.daily_rate) > 0 ? (
            <Text className="text-sm font-bold text-[#0F172A]">
              {Number(tool.daily_rate).toFixed(2)} €/Tag
            </Text>
          ) : (
            <Text className="text-xs font-medium text-[#22C55E]">Kostenlos</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreenDense() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [searchText, setSearchText] = useState("");
  const { data: categories } = useToolCategories();
  const { data, isLoading, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
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
  const totalCount = data?.pages[0]?.total ?? 0;
  const allCategories = [
    { slug: undefined, name: "Alle" },
    ...(categories?.map((c) => ({ slug: c.slug, name: c.name })) ?? []),
  ];

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      <View className="bg-[#0F172A] px-4 pt-14 pb-3 flex-row items-center" style={{ gap: 12 }}>
        <Text className="text-lg font-bold text-[#F8FAFC] tracking-tight flex-1">Wippestoolen</Text>
        <TouchableOpacity className="w-8 h-8 items-center justify-center">
          <Text className="text-[#94A3B8] text-lg">🔔</Text>
        </TouchableOpacity>
        <TouchableOpacity className="w-8 h-8 items-center justify-center">
          <Text className="text-[#94A3B8] text-lg">👤</Text>
        </TouchableOpacity>
      </View>

      <View className="bg-white border-b border-[#E2E8F0] px-4 pt-2 pb-3">
        <View className="flex-row items-center border border-[#E2E8F0] rounded-lg h-10 px-3 bg-white" style={{ gap: 8 }}>
          <Text className="text-[#94A3B8] text-sm">🔍</Text>
          <TextInput className="flex-1 text-sm text-[#0F172A] h-full"
            placeholder="Suchen..." placeholderTextColor="#94A3B8"
            value={searchText} onChangeText={setSearchText} />
          <TouchableOpacity className="bg-[#0F172A] rounded px-2.5 h-7 items-center justify-center">
            <Text className="text-xs font-semibold text-white">Filter</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={allTools}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <DenseToolRow tool={item} />}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor="#0EA5E9" />
        }
        onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <>
            <View className="bg-white border-b border-[#E2E8F0] py-2">
              <FlatList horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
                data={allCategories} keyExtractor={(item) => item.slug ?? "all"}
                renderItem={({ item }) => {
                  const active = selectedCategory === item.slug;
                  return (
                    <TouchableOpacity onPress={() => setSelectedCategory(item.slug)} activeOpacity={0.8}
                      className={`rounded h-8 px-3 items-center justify-center ${active ? "bg-[#E0F2FE]" : "bg-[#F1F5F9]"}`}>
                      <Text className={`text-xs font-medium ${active ? "text-[#0369A1] font-semibold" : "text-[#64748B]"}`}>
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  );
                }} />
            </View>
            <View className="bg-[#F8FAFC] px-4 py-2 border-b border-[#E2E8F0] flex-row items-center justify-between">
              <Text className="text-xs text-[#64748B]">
                {isLoading ? "Wird geladen..." : `${totalCount} Werkzeug${totalCount !== 1 ? "e" : ""} gefunden`}
              </Text>
              <TouchableOpacity>
                <Text className="text-xs text-[#0EA5E9] font-medium">Sortieren</Text>
              </TouchableOpacity>
            </View>
          </>
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View className="items-center justify-center py-16">
              <Text className="text-sm text-[#64748B]">Keine Werkzeuge gefunden</Text>
              <TouchableOpacity className="mt-2" onPress={() => setSelectedCategory(undefined)}>
                <Text className="text-xs text-[#0EA5E9]">Filter zuruecksetzen</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />
    </View>
  );
}
```

---

## Vergleichsmatrix

| Attribut | Clean & Minimal | Bold & Vibrant | Professional & Dense |
|----------|----------------|----------------|----------------------|
| Ziel-Feeling | Premium iOS, ruhig | Community, energetisch | Utility, effizient |
| Layout | 2-Spalten-Grid | 1-Spalte, Image-links | 1-Spalte, dichte Rows |
| Card-Hoehe | ~220px | ~80px | ~80px |
| Card-Ecken | 24px (`rounded-3xl`) | 8px (`rounded-2xl`) | 4px oder keine |
| Card-Schatten | Ja, sanft | Keine (flat) | Keine (Divider statt) |
| Header-Stil | Transparent / same bg | Gradient `#E8470A` | Solid Dark `#0F172A` |
| Kategorie-Stil | Unterstrich-Indikator | Icon + gefuellter Chip | Kleiner Text-Pill |
| FAB-Button | Nein | Ja | Nein |
| Neue Dependency | Keine | `expo-linear-gradient` | Keine |
| Infos pro Row | Minimal (3 Felder) | Mittel (5 Felder) | Dicht (6+ Felder) |

## Implementation Notes

- **expo-linear-gradient (fuer Direction 2)**: `npx expo install expo-linear-gradient`. Kein Native-Rebuild noetig fuer Expo Go.
- **Search-Text-Binding**: Alle drei Designs haben `searchText` als lokalen State, der noch nicht an die API-Query gebunden ist. Der Backend-Endpoint `/tools` akzeptiert einen `search` Query-Param.