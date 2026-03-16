import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTool } from "../../hooks/useTools";
import { StarRating } from "../../components/reviews/StarRating";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../contexts/AuthContext";
import { colors } from "../../constants/colors";
import { getPhotoUrl } from "../../constants/config";
import AvailabilityCalendar from "../../components/tools/AvailabilityCalendar";

export default function ToolDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data: tool, isLoading } = useTool(id);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  if (!tool) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>Werkzeug nicht gefunden</Text>
      </View>
    );
  }

  const isOwner = user?.id === tool.owner.id;
  const primaryPhoto = tool.photos.find((p) => p.is_primary) || tool.photos[0];

  return (
    <>
      <Stack.Screen
        options={{
          title: tool.title,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 8 }}>
              <Text style={{ fontSize: 17, color: colors.primary[600] }}>‹ Zurück</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView style={styles.scrollView}>
        {/* Hero image with gradient overlay */}
        <View style={styles.heroContainer}>
          {primaryPhoto ? (
            <Image
              source={{ uri: getPhotoUrl(primaryPhoto.large_url || primaryPhoto.original_url)! }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={[colors.gradient.start, colors.gradient.end]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroPlaceholder}
            >
              <Text style={styles.heroPlaceholderIcon}>🔧</Text>
            </LinearGradient>
          )}
          {/* Gradient overlay at bottom for readability */}
          {primaryPhoto && (
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.55)"]}
              style={styles.heroGradientOverlay}
            />
          )}
        </View>

        <View style={styles.content}>
          {/* Title, category and price badge */}
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.titleText}>{tool.title}</Text>
              <Text style={styles.categoryText}>{tool.category.name}</Text>
            </View>
            {Number(tool.daily_rate) > 0 && (
              <View style={styles.priceBadge}>
                <Text style={styles.priceText}>
                  {Number(tool.daily_rate).toFixed(2)} €
                </Text>
                <Text style={styles.priceSub}>pro Tag</Text>
              </View>
            )}
          </View>

          {/* Star rating */}
          {tool.average_rating != null && tool.total_ratings > 0 && (
            <View style={styles.ratingRow}>
              <StarRating rating={Number(tool.average_rating)} size="sm" />
              <Text style={styles.ratingText}>
                ({tool.total_ratings} Bewertungen)
              </Text>
            </View>
          )}

          {/* Availability badge */}
          <View
            style={[
              styles.availabilityBadge,
              tool.is_available ? styles.availableBadge : styles.unavailableBadge,
            ]}
          >
            <Text
              style={[
                styles.availabilityText,
                tool.is_available ? styles.availableText : styles.unavailableText,
              ]}
            >
              {tool.is_available ? "Verfügbar" : "Derzeit verliehen"}
            </Text>
          </View>

          {/* Availability calendar */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Verfügbarkeit</Text>
            <AvailabilityCalendar toolId={id} />
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Beschreibung</Text>
            <Text style={styles.descriptionText}>{tool.description}</Text>
          </View>

          {/* Details card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Details</Text>
            {tool.brand && <DetailRow label="Marke" value={tool.brand} />}
            {tool.model && <DetailRow label="Modell" value={tool.model} />}
            <DetailRow label="Zustand" value={conditionLabel(tool.condition)} />
            <DetailRow label="Max. Leihdauer" value={`${tool.max_loan_days} Tage`} />
            {Number(tool.deposit_amount) > 0 && (
              <DetailRow
                label="Kaution"
                value={`${Number(tool.deposit_amount).toFixed(2)} €`}
              />
            )}
            {tool.delivery_available && (
              <DetailRow
                label="Lieferung"
                value={`Ja (${tool.delivery_radius_km} km)`}
              />
            )}
          </View>

          {/* Owner section */}
          <View style={styles.ownerCard}>
            <View style={styles.ownerAvatar}>
              <Text style={styles.ownerAvatarText}>
                {tool.owner.display_name?.charAt(0)?.toUpperCase()}
              </Text>
            </View>
            <View style={styles.ownerInfo}>
              <Text style={styles.ownerName}>{tool.owner.display_name}</Text>
              {tool.owner.average_rating != null && (
                <Text style={styles.ownerRating}>
                  ⭐ {Number(tool.owner.average_rating).toFixed(1)} ·{" "}
                  {tool.owner.total_ratings} Bewertungen
                </Text>
              )}
            </View>
          </View>

          {/* Safety notes in warm amber */}
          {tool.safety_notes && (
            <View style={styles.safetyCard}>
              <Text style={styles.safetyTitle}>Sicherheitshinweise</Text>
              <Text style={styles.safetyText}>{tool.safety_notes}</Text>
            </View>
          )}

          {/* Action button */}
          <View style={styles.actionRow}>
            {isOwner ? (
              <Button
                title="Werkzeug bearbeiten"
                onPress={() => router.push(`/my-tools/${tool.id}/edit`)}
                variant="outline"
              />
            ) : tool.is_available ? (
              <Button
                title="Jetzt ausleihen"
                onPress={() => router.push(`/tool/${tool.id}/book`)}
              />
            ) : (
              <Button title="Derzeit nicht verfügbar" onPress={() => {}} disabled />
            )}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function conditionLabel(condition: string): string {
  const labels: Record<string, string> = {
    excellent: "Ausgezeichnet",
    good: "Gut",
    fair: "Befriedigend",
    poor: "Mangelhaft",
  };
  return labels[condition] || condition;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gray[50],
  },
  notFoundText: {
    color: colors.gray[500],
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  heroContainer: {
    height: 260,
    backgroundColor: colors.gray[200],
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  heroPlaceholderIcon: {
    fontSize: 64,
  },
  heroGradientOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  content: {
    padding: 16,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  titleBlock: {
    flex: 1,
    marginRight: 12,
  },
  titleText: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.gray[900],
    letterSpacing: -0.3,
  },
  categoryText: {
    fontSize: 13,
    color: colors.gray[500],
    marginTop: 3,
  },
  priceBadge: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
    minWidth: 72,
  },
  priceText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.white,
  },
  priceSub: {
    fontSize: 11,
    color: colors.primary[200],
    marginTop: 1,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  ratingText: {
    fontSize: 13,
    color: colors.gray[500],
    marginLeft: 6,
  },
  availabilityBadge: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  availableBadge: {
    backgroundColor: "#DCFCE7",
  },
  unavailableBadge: {
    backgroundColor: "#FEE2E2",
  },
  availabilityText: {
    fontSize: 13,
    fontWeight: "600",
  },
  availableText: {
    color: colors.success,
  },
  unavailableText: {
    color: colors.error,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray[900],
    marginBottom: 6,
  },
  descriptionText: {
    fontSize: 14,
    color: colors.gray[600],
    lineHeight: 22,
  },
  card: {
    marginTop: 16,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray[900],
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  detailLabel: {
    fontSize: 13,
    color: colors.gray[500],
  },
  detailValue: {
    fontSize: 13,
    color: colors.gray[900],
    fontWeight: "500",
  },
  ownerCard: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  ownerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
  },
  ownerAvatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.primary[600],
  },
  ownerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  ownerName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.gray[900],
  },
  ownerRating: {
    fontSize: 13,
    color: colors.gray[500],
    marginTop: 2,
  },
  safetyCard: {
    marginTop: 16,
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  safetyTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 4,
  },
  safetyText: {
    fontSize: 13,
    color: "#B45309",
    lineHeight: 20,
  },
  actionRow: {
    marginTop: 24,
    marginBottom: 40,
  },
});
