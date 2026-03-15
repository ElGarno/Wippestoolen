import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useToolCategories, useCreateTool } from "../../../hooks/useTools";
import api from "../../../lib/api";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import type { ToolCreateRequest } from "../../../types";

type Condition = "excellent" | "good" | "fair" | "poor";

const CONDITIONS: { label: string; value: Condition }[] = [
  { label: "Ausgezeichnet", value: "excellent" },
  { label: "Gut", value: "good" },
  { label: "Befriedigend", value: "fair" },
  { label: "Mangelhaft", value: "poor" },
];

function SectionTitle({ title }: { title: string }) {
  return <Text className="text-base font-semibold text-gray-900 mb-3 mt-2">{title}</Text>;
}

export default function CreateToolScreen() {
  const router = useRouter();
  const { data: categories, isLoading: categoriesLoading } = useToolCategories();
  const createTool = useCreateTool();

  const [photoUris, setPhotoUris] = useState<string[]>([]);
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
            const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

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
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 pt-14 pb-4 border-b border-gray-100">
        <Text className="text-xl font-bold text-gray-900">Werkzeug anbieten</Text>
        <Text className="text-sm text-gray-500 mt-1">
          Stelle dein Werkzeug für andere zum Ausleihen ein
        </Text>
      </View>

      <View className="p-4">
        {/* Photos */}
        <SectionTitle title="Fotos" />
        <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100 shadow-sm">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-3">
              {photoUris.map((uri, index) => (
                <View key={uri} className="relative">
                  <Image
                    source={{ uri }}
                    className="w-24 h-24 rounded-lg"
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    className="absolute -top-2 -right-2 bg-red-500 w-6 h-6 rounded-full items-center justify-center"
                    onPress={() => removePhoto(index)}
                  >
                    <Text className="text-white text-xs font-bold">X</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {photoUris.length < 5 && (
                <View className="gap-2">
                  <TouchableOpacity
                    className="w-24 h-11 bg-gray-100 rounded-lg items-center justify-center border border-dashed border-gray-300"
                    onPress={pickFromGallery}
                  >
                    <Text className="text-2xl">🖼</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="w-24 h-11 bg-gray-100 rounded-lg items-center justify-center border border-dashed border-gray-300"
                    onPress={takePhoto}
                  >
                    <Text className="text-2xl">📷</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
          <Text className="text-xs text-gray-400 mt-2">
            {photoUris.length}/5 Fotos · Tippe auf 🖼 (Galerie) oder 📷 (Kamera)
          </Text>
        </View>

        {/* Basic info */}
        <SectionTitle title="Grundinformationen" />
        <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100 shadow-sm">
          <Input
            label="Titel *"
            placeholder="z.B. Bohrmaschine Bosch GSR 18V"
            value={title}
            onChangeText={setTitle}
          />
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1">Beschreibung *</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white min-h-[80px]"
              placeholder="Beschreibe das Werkzeug, seinen Zustand und besondere Eigenschaften..."
              placeholderTextColor="#9ca3af"
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />
          </View>
          <Input label="Marke (optional)" placeholder="z.B. Bosch" value={brand} onChangeText={setBrand} />
          <Input label="Modell (optional)" placeholder="z.B. GSR 18V-55" value={model} onChangeText={setModel} />
        </View>

        {/* Category */}
        <SectionTitle title="Kategorie *" />
        <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100 shadow-sm">
          <View className="flex-row flex-wrap gap-2">
            {categories?.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                className={`px-3 py-2 rounded-lg border ${
                  categoryId === cat.id
                    ? "bg-primary-600 border-primary-600"
                    : "bg-white border-gray-300"
                }`}
                onPress={() => setCategoryId(cat.id)}
              >
                <Text
                  className={`text-sm ${
                    categoryId === cat.id ? "text-white font-medium" : "text-gray-700"
                  }`}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Condition */}
        <SectionTitle title="Zustand" />
        <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100 shadow-sm">
          <View className="flex-row flex-wrap gap-2">
            {CONDITIONS.map((c) => (
              <TouchableOpacity
                key={c.value}
                className={`px-4 py-2 rounded-lg border ${
                  condition === c.value
                    ? "bg-primary-600 border-primary-600"
                    : "bg-white border-gray-300"
                }`}
                onPress={() => setCondition(c.value)}
              >
                <Text
                  className={`text-sm ${
                    condition === c.value ? "text-white font-medium" : "text-gray-700"
                  }`}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Pricing */}
        <SectionTitle title="Preise & Bedingungen" />
        <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100 shadow-sm">
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
        <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100 shadow-sm">
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

          {/* Delivery toggle */}
          <TouchableOpacity
            className={`flex-row items-center justify-between p-3 rounded-lg border ${
              deliveryAvailable ? "bg-primary-50 border-primary-200" : "bg-gray-50 border-gray-200"
            }`}
            onPress={() => setDeliveryAvailable(!deliveryAvailable)}
          >
            <Text className="text-sm font-medium text-gray-700">Lieferung möglich</Text>
            <View
              className={`w-12 h-6 rounded-full ${
                deliveryAvailable ? "bg-primary-600" : "bg-gray-300"
              }`}
            >
              <View
                className={`w-5 h-5 bg-white rounded-full mt-0.5 shadow-sm ${
                  deliveryAvailable ? "ml-6" : "ml-0.5"
                }`}
              />
            </View>
          </TouchableOpacity>

          {deliveryAvailable && (
            <View className="mt-3">
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
        <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100 shadow-sm">
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1">Benutzungshinweise</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white min-h-[60px]"
              placeholder="Tipps zur korrekten Bedienung..."
              placeholderTextColor="#9ca3af"
              value={usageInstructions}
              onChangeText={setUsageInstructions}
              multiline
              textAlignVertical="top"
            />
          </View>
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">Sicherheitshinweise</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white min-h-[60px]"
              placeholder="Wichtige Sicherheitshinweise..."
              placeholderTextColor="#9ca3af"
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
        <View className="h-8" />
      </View>
    </ScrollView>
  );
}
