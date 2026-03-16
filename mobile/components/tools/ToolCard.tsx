import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "../../constants/colors";
import { getPhotoUrl } from "../../constants/config";
import type { ToolListItem } from "../../types";

interface ToolCardProps {
  tool: ToolListItem;
}

function getCategoryColor(slug: string): string {
  return colors.category[slug] ?? colors.category.default;
}

export function ToolCard({ tool }: ToolCardProps) {
  const router = useRouter();
  const accentColor = getCategoryColor(tool.category.slug ?? "default");

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/tool/${tool.id}`)}
      activeOpacity={0.75}
    >
      {/* Left colored accent stripe */}
      <View style={[styles.accent, { backgroundColor: accentColor }]} />

      {/* Thumbnail */}
      <View style={styles.thumbnail}>
        {tool.primary_photo ? (
          <Image
            source={{
              uri: getPhotoUrl(tool.primary_photo.medium_url || tool.primary_photo.original_url)!,
            }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderIcon}>🔧</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Row 1: title + price */}
        <View style={styles.row}>
          <Text style={styles.title} numberOfLines={1}>
            {tool.title}
          </Text>
          {Number(tool.daily_rate) > 0 && (
            <Text style={styles.price}>
              {Number(tool.daily_rate).toFixed(2)} €/Tag
            </Text>
          )}
        </View>

        {/* Row 2: owner + city */}
        <View style={styles.row}>
          <Text style={styles.meta} numberOfLines={1}>
            {tool.owner.display_name}
            {tool.pickup_city ? ` · ${tool.pickup_city}` : ""}
          </Text>
        </View>

        {/* Row 3: availability badge + rating */}
        <View style={[styles.row, styles.rowBottom]}>
          <View
            style={[
              styles.badge,
              tool.is_available ? styles.badgeAvailable : styles.badgeUnavailable,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                tool.is_available ? styles.badgeTextAvailable : styles.badgeTextUnavailable,
              ]}
            >
              {tool.is_available ? "Verfuegbar" : "Verliehen"}
            </Text>
          </View>

          {tool.average_rating != null && tool.average_rating > 0 && (
            <View style={styles.ratingWrapper}>
              <Text style={styles.ratingStar}>★</Text>
              <Text style={styles.ratingValue}>
                {Number(tool.average_rating).toFixed(1)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
    // Subtle elevation without heavy shadow
    shadowColor: colors.gray[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  accent: {
    width: 4,
    alignSelf: "stretch",
  },
  thumbnail: {
    width: 80,
    height: 80,
    margin: 12,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: colors.gray[100],
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  imagePlaceholderIcon: {
    fontSize: 28,
  },
  content: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 12,
    justifyContent: "space-between",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowBottom: {
    marginTop: 4,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.gray[900],
    marginRight: 8,
  },
  price: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary[600],
    flexShrink: 0,
  },
  meta: {
    fontSize: 13,
    color: colors.gray[500],
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeAvailable: {
    backgroundColor: "#DCFCE7",
  },
  badgeUnavailable: {
    backgroundColor: "#FEE2E2",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  badgeTextAvailable: {
    color: colors.success,
  },
  badgeTextUnavailable: {
    color: colors.error,
  },
  ratingWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingStar: {
    fontSize: 13,
    color: colors.accent,
    marginRight: 2,
  },
  ratingValue: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.gray[700],
  },
});
