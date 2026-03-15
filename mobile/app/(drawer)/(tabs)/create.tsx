import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { useToolCategories, useCreateTool, useAnalyzeToolPhoto } from "../../../hooks/useTools";
import api from "../../../lib/api";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { colors } from "../../../constants/colors";
import type { ToolCreateRequest } from "../../../types";

type Condition = "excellent" | "good" | "fair" | "poor";

const CONDITIONS: { label: string; value: Condition }[] = [
  { label: "Ausgezeichnet", value: "excellent" },
  { label: "Gut", value: "good" },
  { label: "Befriedigend", value: "fair" },
  { label: "Mangelhaft", value: "poor" },
];

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

export default function CreateToolScreen() {
  const router = useRouter();
  const { data: categories, isLoading: categoriesLoading } = useToolCategories();
  const createTool = useCreateTool();
  const analyzePhoto = useAnalyzeToolPhoto();

  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [aiSuggested, setAiSuggested] = useState(false);
  const [showAiBanner, setShowAiBanner] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [condition, setCondition] = useState<Condition>("good");
  const [maxLoanDays, setMaxLoanDays] = useState("7");
  const [dailyRate, setDailyRate] = useState("0");
  const [depositAmount, setDepositAmount] = useState("0");
  const [pickupCity, setPickupCity] = useState("");
  const [pickupPostalCode, setPickupPostalCode] = useState("");
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState("10");
  const [usageInstructions, setUsageInstructions] = useState("");
  const [safetyNotes, setSafetyNotes] = useState("");

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Berechtigung fehlt", "Bitte erlaube den Zugriff auf deine Fotos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 5 - photoUris.length,
      quality: 0.8,
    });
    if (!result.canceled) {
      setPhotoUris((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 5));
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Berechtigung fehlt", "Bitte erlaube den Zugriff auf die Kamera.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });
    if (!result.canceled && photoUris.length < 5) {
      setPhotoUris((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotoUris((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (!showAiBanner) return;
    const timer = setTimeout(() => setShowAiBanner(false), 5000);
    return () => clearTimeout(timer);
  }, [showAiBanner]);

  const handleAiAnalyze = () => {
    Alert.alert("Foto auswählen", "Wähle ein Foto für die KI-Analyse", [
      {
        text: "Kamera",
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") {
            Alert.alert("Berechtigung fehlt", "Bitte erlaube den Zugriff auf die Kamera.");
            return;
          }
          const result = await ImagePicker.launchCameraAsync({ quality: 0.7, exif: false });
          if (!result.canceled) {
            const uri = result.assets[0].uri;
            if (photoUris.length < 5 && !photoUris.includes(uri)) {
              setPhotoUris((prev) => [...prev, uri]);
            }
            try {
              const analysis = await analyzePhoto.mutateAsync(uri);
              if (analysis.title) setTitle(analysis.title);
              if (analysis.description) setDescription(analysis.description);
              if (analysis.brand) setBrand(analysis.brand);
              if (analysis.model) setModel(analysis.model);
              if (analysis.safety_notes) setSafetyNotes(analysis.safety_notes);
              if (analysis.condition) setCondition(analysis.condition as Condition);
              if (analysis.category_slug && categories) {
                const matched = categories.find(
                  (c) =>
                    c.slug === analysis.category_slug ||
                    c.name.toLowerCase() === analysis.category_slug.toLowerCase()
                );
                if (matched) setCategoryId(matched.id);
              }
              setAiSuggested(true);
              setShowAiBanner(true);
            } catch {
              Alert.alert("AI-Analyse fehlgeschlagen", "Bitte fuell die Felder manuell aus.");
            }
          }
        },
      },
      {
        text: "Galerie",
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") {
            Alert.alert("Berechtigung fehlt", "Bitte erlaube den Zugriff auf deine Fotos.");
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsMultipleSelection: false,
            quality: 0.7,
            exif: false,
          });
          if (!result.canceled) {
            const uri = result.assets[0].uri;
            if (photoUris.length < 5 && !photoUris.includes(uri)) {
              setPhotoUris((prev) => [...prev, uri]);
            }
            try {
              const analysis = await analyzePhoto.mutateAsync(uri);
              if (analysis.title) setTitle(analysis.title);
              if (analysis.description) setDescription(analysis.description);
              if (analysis.brand) setBrand(analysis.brand);
              if (analysis.model) setModel(analysis.model);
              if (analysis.safety_notes) setSafetyNotes(analysis.safety_notes);
              if (analysis.condition) setCondition(analysis.condition as Condition);
              if (analysis.category_slug && categories) {
                const matched = categories.find(
                  (c) =>
                    c.slug === analysis.category_slug ||
                    c.name.toLowerCase() === analysis.category_slug.toLowerCase()
                );
                if (matched) setCategoryId(matched.id);
              }
              setAiSuggested(true);
              setShowAiBanner(true);
            } catch {
              Alert.alert("AI-Analyse fehlgeschlagen", "Bitte fuell die Felder manuell aus.");
            }
          }
        },
      },
      { text: "Abbrechen", style: "cancel" },
    ]);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert("Titel fehlt", "Bitte gib einen Titel ein.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Beschreibung fehlt", "Bitte beschreibe das Werkzeug.");
      return;
    }
    if (!categoryId) {
      Alert.alert("Kategorie fehlt", "Bitte wähle eine Kategorie aus.");
      return;
    }

    const payload: ToolCreateRequest = {
      title: title.trim(),
      description: description.trim(),
      category_id: categoryId,
      brand: brand.trim() || undefined,
      model: model.trim() || undefined,
      condition,
      max_loan_days: parseInt(maxLoanDays, 10) || 7,
      daily_rate: parseFloat(dailyRate) || 0,
      deposit_amount: parseFloat(depositAmount) || 0,
      pickup_city: pickupCity.trim() || undefined,
      pickup_postal_code: pickupPostalCode.trim() || undefined,
      delivery_available: deliveryAvailable,
      delivery_radius_km: deliveryAvailable ? parseInt(deliveryRadiusKm, 10) || 10 : undefined,
      usage_instructions: usageInstructions.trim() || undefined,
      safety_notes: safetyNotes.trim() || undefined,
    };

    try {
      const tool = await createTool.mutateAsync(payload);

      // Upload photos if any were selected
      if (photoUris.length > 0) {
        let uploadFailures = 0;
        for (const uri of photoUris) {
          try {
            const filename = uri.split("/").pop() || "photo.jpg";
            const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
            const mimeType =
              ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

            const formData = new FormData();
            formData.append("file", {
              uri,
              name: filename,
              type: mimeType,
            } as unknown as Blob);

            await api.post(`/tools/${tool.id}/photos`, formData, {
              headers: { "Content-Type": "multipart/form-data" },
              timeout: 30000,
            });
          } catch {
            uploadFailures++;
          }
        }

        if (uploadFailures > 0) {
          Alert.alert(
            "Werkzeug erstellt",
            `${uploadFailures} von ${photoUris.length} Fotos konnten nicht hochgeladen werden. Du kannst sie spaeter hinzufuegen.`,
            [{ text: "OK", onPress: () => router.push(`/tool/${tool.id}`) }]
          );
          return;
        }
      }

      Alert.alert("Werkzeug erstellt!", "Dein Werkzeug wurde erfolgreich eingestellt.", [
        { text: "OK", onPress: () => router.push(`/tool/${tool.id}`) },
      ]);
    } catch {
      Alert.alert("Fehler", "Das Werkzeug konnte nicht erstellt werden.");
    }
  };

  if (categoriesLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scrollView}>
      {/* Gradient header */}
      <LinearGradient
        colors={[colors.gradient.start, colors.gradient.end]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientHeader}
      >
        <Text style={styles.gradientTitle}>Werkzeug anbieten</Text>
        <Text style={styles.gradientSubtitle}>
          Stelle dein Werkzeug für andere zum Ausleihen ein
        </Text>
      </LinearGradient>

      <View style={styles.content}>
        {/* Photos */}
        <SectionTitle title="Fotos" />
        <View style={styles.card}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.photoRow}>
              {photoUris.map((uri, index) => (
                <View key={uri} style={styles.photoWrapper}>
                  <Image source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
                  <TouchableOpacity
                    style={styles.removePhotoBtn}
                    onPress={() => removePhoto(index)}
                  >
                    <Text style={styles.removePhotoBtnText}>X</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {photoUris.length < 5 && (
                <View style={styles.photoActions}>
                  <TouchableOpacity style={styles.photoPickerBtn} onPress={pickFromGallery}>
                    <Text style={styles.photoPickerIcon}>🖼</Text>
                    <Text style={styles.photoPickerLabel}>Galerie</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.photoPickerBtn} onPress={takePhoto}>
                    <Text style={styles.photoPickerIcon}>📷</Text>
                    <Text style={styles.photoPickerLabel}>Kamera</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
          <Text style={styles.photoHint}>{photoUris.length}/5 Fotos hinzugefügt</Text>
        </View>

        {/* AI analyze button */}
        <TouchableOpacity
          onPress={handleAiAnalyze}
          disabled={analyzePhoto.isPending}
          activeOpacity={0.85}
          style={styles.aiButtonWrapper}
        >
          <LinearGradient
            colors={["#E8470A", "#F5A623"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.aiButton}
          >
            {analyzePhoto.isPending ? (
              <>
                <ActivityIndicator color="#fff" size="small" style={styles.aiButtonSpinner} />
                <View>
                  <Text style={styles.aiButtonTitle}>Werkzeug wird analysiert...</Text>
                  <Text style={styles.aiButtonSubtitle}>Bitte warten</Text>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.aiButtonIcon}>🤖</Text>
                <View>
                  <Text style={styles.aiButtonTitle}>AI Werkzeug-Erkennung</Text>
                  <Text style={styles.aiButtonSubtitle}>
                    Foto machen — Felder automatisch ausfuellen
                  </Text>
                </View>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* AI success banner */}
        {showAiBanner && (
          <View style={styles.aiBanner}>
            <Text style={styles.aiBannerTitle}>7 Felder vorgeschlagen</Text>
            <Text style={styles.aiBannerSubtitle}>Pruefe und passe die Vorschlaege an</Text>
          </View>
        )}

        {/* Basic info */}
        <SectionTitle title="Grundinformationen" />
        <View style={styles.card}>
          <Input
            label={aiSuggested ? "Titel * 🤖 AI" : "Titel *"}
            placeholder="z.B. Bohrmaschine Bosch GSR 18V"
            value={title}
            onChangeText={setTitle}
          />
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {aiSuggested ? "Beschreibung * 🤖 AI" : "Beschreibung *"}
            </Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Beschreibe das Werkzeug, seinen Zustand und besondere Eigenschaften..."
              placeholderTextColor={colors.gray[400]}
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />
          </View>
          <Input
            label={aiSuggested ? "Marke (optional) 🤖 AI" : "Marke (optional)"}
            placeholder="z.B. Bosch"
            value={brand}
            onChangeText={setBrand}
          />
          <Input
            label={aiSuggested ? "Modell (optional) 🤖 AI" : "Modell (optional)"}
            placeholder="z.B. GSR 18V-55"
            value={model}
            onChangeText={setModel}
          />
        </View>

        {/* Category */}
        <SectionTitle title="Kategorie *" />
        <View style={styles.card}>
          <View style={styles.chipsRow}>
            {categories?.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.chip,
                  categoryId === cat.id ? styles.chipActive : styles.chipInactive,
                ]}
                onPress={() => setCategoryId(cat.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    categoryId === cat.id ? styles.chipTextActive : styles.chipTextInactive,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Condition */}
        <SectionTitle title="Zustand" />
        <View style={styles.card}>
          <View style={styles.chipsRow}>
            {CONDITIONS.map((c) => (
              <TouchableOpacity
                key={c.value}
                style={[
                  styles.chip,
                  condition === c.value ? styles.chipActive : styles.chipInactive,
                ]}
                onPress={() => setCondition(c.value)}
              >
                <Text
                  style={[
                    styles.chipText,
                    condition === c.value ? styles.chipTextActive : styles.chipTextInactive,
                  ]}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Pricing */}
        <SectionTitle title="Preise & Bedingungen" />
        <View style={styles.card}>
          <Input
            label="Tagesrate (€)"
            placeholder="0.00"
            value={dailyRate}
            onChangeText={setDailyRate}
            keyboardType="decimal-pad"
          />
          <Input
            label="Kaution (€)"
            placeholder="0.00"
            value={depositAmount}
            onChangeText={setDepositAmount}
            keyboardType="decimal-pad"
          />
          <Input
            label="Max. Leihdauer (Tage)"
            placeholder="7"
            value={maxLoanDays}
            onChangeText={setMaxLoanDays}
            keyboardType="number-pad"
          />
        </View>

        {/* Location */}
        <SectionTitle title="Abholort" />
        <View style={styles.card}>
          <Input
            label="Stadt"
            placeholder="z.B. Köln"
            value={pickupCity}
            onChangeText={setPickupCity}
          />
          <Input
            label="Postleitzahl"
            placeholder="z.B. 51147"
            value={pickupPostalCode}
            onChangeText={setPickupPostalCode}
            keyboardType="number-pad"
          />

          {/* Delivery toggle with orange active state */}
          <TouchableOpacity
            style={[
              styles.toggleRow,
              deliveryAvailable ? styles.toggleRowActive : styles.toggleRowInactive,
            ]}
            onPress={() => setDeliveryAvailable(!deliveryAvailable)}
          >
            <Text style={styles.toggleLabel}>Lieferung möglich</Text>
            <View
              style={[
                styles.toggleTrack,
                deliveryAvailable ? styles.toggleTrackActive : styles.toggleTrackInactive,
              ]}
            >
              <View
                style={[
                  styles.toggleThumb,
                  deliveryAvailable ? styles.toggleThumbRight : styles.toggleThumbLeft,
                ]}
              />
            </View>
          </TouchableOpacity>

          {deliveryAvailable && (
            <View style={styles.deliveryRadiusWrapper}>
              <Input
                label="Lieferradius (km)"
                placeholder="10"
                value={deliveryRadiusKm}
                onChangeText={setDeliveryRadiusKm}
                keyboardType="number-pad"
              />
            </View>
          )}
        </View>

        {/* Instructions */}
        <SectionTitle title="Hinweise (optional)" />
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Benutzungshinweise</Text>
            <TextInput
              style={[styles.textInput, styles.textAreaSm]}
              placeholder="Tipps zur korrekten Bedienung..."
              placeholderTextColor={colors.gray[400]}
              value={usageInstructions}
              onChangeText={setUsageInstructions}
              multiline
              textAlignVertical="top"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {aiSuggested ? "Sicherheitshinweise 🤖 AI" : "Sicherheitshinweise"}
            </Text>
            <TextInput
              style={[styles.textInput, styles.textAreaSm]}
              placeholder="Wichtige Sicherheitshinweise..."
              placeholderTextColor={colors.gray[400]}
              value={safetyNotes}
              onChangeText={setSafetyNotes}
              multiline
              textAlignVertical="top"
            />
          </View>
        </View>

        <Button
          title="Werkzeug einstellen"
          onPress={handleSubmit}
          isLoading={createTool.isPending}
        />
        <View style={styles.bottomSpacer} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gray[50],
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  gradientHeader: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 24,
  },
  gradientTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.white,
    letterSpacing: -0.3,
  },
  gradientSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.gray[900],
    marginBottom: 10,
    marginTop: 6,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  photoRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  photoWrapper: {
    position: "relative",
  },
  photoThumb: {
    width: 88,
    height: 88,
    borderRadius: 12,
  },
  removePhotoBtn: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: colors.error,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  removePhotoBtnText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "700",
  },
  photoActions: {
    gap: 8,
  },
  photoPickerBtn: {
    width: 88,
    height: 38,
    backgroundColor: colors.primary[50],
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.primary[200],
    borderStyle: "dashed",
    flexDirection: "row",
    gap: 4,
  },
  photoPickerIcon: {
    fontSize: 16,
  },
  photoPickerLabel: {
    fontSize: 11,
    color: colors.primary[600],
    fontWeight: "500",
  },
  photoHint: {
    fontSize: 11,
    color: colors.gray[400],
    marginTop: 10,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.gray[700],
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: colors.white,
    color: colors.gray[900],
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  textAreaSm: {
    minHeight: 64,
    textAlignVertical: "top",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  chipActive: {
    backgroundColor: colors.gray[900],
    borderColor: colors.gray[900],
  },
  chipInactive: {
    backgroundColor: colors.white,
    borderColor: colors.gray[300],
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  chipTextActive: {
    color: colors.white,
  },
  chipTextInactive: {
    color: colors.gray[700],
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  toggleRowActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },
  toggleRowInactive: {
    backgroundColor: colors.gray[50],
    borderColor: colors.gray[200],
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.gray[700],
  },
  toggleTrack: {
    width: 48,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
  },
  toggleTrackActive: {
    backgroundColor: colors.primary[600],
  },
  toggleTrackInactive: {
    backgroundColor: colors.gray[300],
  },
  toggleThumb: {
    width: 20,
    height: 20,
    backgroundColor: colors.white,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbRight: {
    marginLeft: 24,
  },
  toggleThumbLeft: {
    marginLeft: 3,
  },
  deliveryRadiusWrapper: {
    marginTop: 12,
  },
  bottomSpacer: {
    height: 40,
  },
  aiButtonWrapper: {
    marginBottom: 16,
  },
  aiButton: {
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#E8470A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  aiButtonIcon: {
    fontSize: 28,
  },
  aiButtonSpinner: {
    marginRight: 4,
  },
  aiButtonTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  aiButtonSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
  },
  aiBanner: {
    backgroundColor: "#DCFCE7",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  aiBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#15803D",
  },
  aiBannerSubtitle: {
    fontSize: 12,
    color: "#166534",
    marginTop: 2,
  },
});
