import { useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import type { ToolListItem } from "../../types";

// ─── Brand color ─────────────────────────────────────────────────────────────

const BRAND_ORANGE = "#E8470A";

// ─── Attendorn coordinates ────────────────────────────────────────────────────

const CENTER_LAT = 51.1267;
const CENTER_LNG = 7.9033;
const DEFAULT_ZOOM = 13;

// ─── Props ────────────────────────────────────────────────────────────────────

interface ToolMapProps {
  tools: ToolListItem[];
  onToolPress: (toolId: string) => void;
}

// ─── HTML template builder ────────────────────────────────────────────────────

function buildMapHtml(tools: ToolListItem[]): string {
  // Only include tools with valid coordinates
  const geoTools = tools.filter(
    (t) => t.pickup_latitude != null && t.pickup_longitude != null
  );

  // Serialize marker data — escape strings to prevent XSS inside the HTML string
  const markersJson = JSON.stringify(
    geoTools.map((t) => ({
      id: t.id,
      lat: Number(t.pickup_latitude),
      lng: Number(t.pickup_longitude),
      title: t.title,
      price:
        Number(t.daily_rate) === 0
          ? "Kostenlos"
          : `${Number(t.daily_rate).toFixed(2)} €/Tag`,
    }))
  );

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Werkzeugkarte</title>
  <link
    rel="stylesheet"
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
    crossorigin=""
  />
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body, #map {
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    /* Custom marker icon */
    .tool-marker {
      background-color: ${BRAND_ORANGE};
      border: 2px solid #fff;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      width: 28px;
      height: 28px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    }

    .tool-marker-inner {
      transform: rotate(45deg);
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
    }

    /* Popup styling */
    .leaflet-popup-content-wrapper {
      border-radius: 10px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      padding: 0;
      overflow: hidden;
    }

    .leaflet-popup-content {
      margin: 0;
      min-width: 160px;
      max-width: 220px;
    }

    .popup-body {
      padding: 12px 14px 10px;
    }

    .popup-title {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      font-weight: 700;
      color: #1A1A1A;
      margin-bottom: 4px;
      line-height: 1.3;
      word-break: break-word;
    }

    .popup-price {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px;
      font-weight: 600;
      color: ${BRAND_ORANGE};
      margin-bottom: 10px;
    }

    .popup-btn {
      display: block;
      background-color: ${BRAND_ORANGE};
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px;
      font-weight: 700;
      text-align: center;
      padding: 7px 12px;
      border-radius: 6px;
      cursor: pointer;
      text-decoration: none;
      letter-spacing: 0.2px;
    }

    .popup-btn:active {
      opacity: 0.85;
    }

    .leaflet-popup-tip {
      background: #fff;
    }
  </style>
</head>
<body>
  <div id="map"></div>

  <script
    src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV/XN2GqaY="
    crossorigin=""
  ></script>
  <script>
    var map = L.map('map', {
      zoomControl: true,
      attributionControl: true,
    }).setView([${CENTER_LAT}, ${CENTER_LNG}], ${DEFAULT_ZOOM});

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    var markers = ${markersJson};

    function createIcon() {
      return L.divIcon({
        className: '',
        html: '<div class="tool-marker"><div class="tool-marker-inner">🔧</div></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -30],
      });
    }

    markers.forEach(function(tool) {
      var marker = L.marker([tool.lat, tool.lng], { icon: createIcon() });

      var popupHtml =
        '<div class="popup-body">' +
          '<div class="popup-title">' + escapeHtml(tool.title) + '</div>' +
          '<div class="popup-price">' + escapeHtml(tool.price) + '</div>' +
          '<a class="popup-btn" onclick="sendToolId(\'' + tool.id + '\')" href="#">Details</a>' +
        '</div>';

      marker.bindPopup(popupHtml, { maxWidth: 220 });
      marker.addTo(map);
    });

    function escapeHtml(str) {
      var d = document.createElement('div');
      d.appendChild(document.createTextNode(String(str)));
      return d.innerHTML;
    }

    function sendToolId(toolId) {
      try {
        // React Native WebView bridge
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'toolPress', toolId: toolId }));
      } catch (e) {
        // Fallback for web preview
        console.log('toolPress', toolId);
      }
      return false;
    }
  </script>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ToolMap({ tools, onToolPress }: ToolMapProps) {
  const webViewRef = useRef<WebView>(null);

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as {
        type: string;
        toolId?: string;
      };
      if (payload.type === "toolPress" && payload.toolId) {
        onToolPress(payload.toolId);
      }
    } catch {
      // Ignore malformed messages
    }
  }

  const html = buildMapHtml(tools);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html, baseUrl: "https://wippestoolen.de" }}
        style={styles.webView}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        // Allow mixed content so OSM tiles (http) load on Android
        mixedContentMode="always"
        // Prevent rubber-band scroll interference on iOS
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        // Maintain rendering when off-screen
        renderToHardwareTextureAndroid
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
