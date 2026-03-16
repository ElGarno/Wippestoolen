import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Callout } from "react-native-maps";
import { colors } from "../../constants/colors";
import type { ToolListItem } from "../../types";

const CENTER_LAT = 51.1267;
const CENTER_LNG = 7.9033;

interface ToolMapProps {
  tools: ToolListItem[];
  onToolPress: (toolId: string) => void;
}

export default function ToolMap({ tools, onToolPress }: ToolMapProps) {
  const geoTools = tools.filter(
    (t) => t.pickup_latitude != null && t.pickup_longitude != null
  );

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: CENTER_LAT,
          longitude: CENTER_LNG,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        {geoTools.map((tool) => (
          <Marker
            key={tool.id}
            coordinate={{
              latitude: Number(tool.pickup_latitude),
              longitude: Number(tool.pickup_longitude),
            }}
            pinColor={colors.primary[600]}
          >
            <Callout onPress={() => onToolPress(tool.id)}>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle} numberOfLines={2}>
                  {tool.title}
                </Text>
                <Text style={styles.calloutPrice}>
                  {Number(tool.daily_rate) === 0
                    ? "Kostenlos"
                    : `${Number(tool.daily_rate).toFixed(2)} €/Tag`}
                </Text>
                <Text style={styles.calloutAction}>Details anzeigen ›</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  callout: {
    padding: 8,
    minWidth: 150,
    maxWidth: 200,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.gray[900],
    marginBottom: 4,
  },
  calloutPrice: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary[600],
    marginBottom: 6,
  },
  calloutAction: {
    fontSize: 12,
    color: colors.primary[600],
    fontWeight: "500",
  },
});
