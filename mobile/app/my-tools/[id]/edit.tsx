import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useTool, useUpdateTool, useToolCategories } from "../../../hooks/useTools";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";

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

export default function EditToolScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: tool, isLoading } = useTool(id);
  const { data: categories } = useToolCategories();
  const updateTool = useUpdateTool(id);

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

  // Populate form when tool loads
  useEffect(() => {
    if (!tool) return;
    setTitle(tool.title);
    setDescription(tool.description);
    setCategoryId(tool.category.id);
    setBrand(tool.brand ?? "");
    setModel(tool.model ?? "");
    setCondition(tool.condition);
    setMaxLoanDays(String(tool.max_loan_days));
    setDailyRate(String(tool.daily_rate));
    setDepositAmount(String(tool.deposit_amount));
    setPickupCity(tool.pickup_city ?? "");
    setPickupPostalCode(tool.pickup_postal_code ?? "");
    setDeliveryAvailable(tool.delivery_available);
    setDeliveryRadiusKm(String(tool.delivery_radius_km ?? 10));
    setUsageInstructions(tool.usage_instructions ?? "");
    setSafetyNotes(tool.safety_notes ?? "");
  }, [tool]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!tool) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-500">Werkzeug nicht gefunden</Text>
      </View>
    );
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert("Titel fehlt", "Bitte gib einen Titel ein.");
      return;
    }

    try {
      await updateTool.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        category_id: categoryId ?? tool.category.id,
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
      });
      Alert.alert("Gespeichert!", "Das Werkzeug wurde erfolgreich aktualisiert.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Fehler", "Das Werkzeug konnte nicht gespeichert werden.");
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Werkzeug bearbeiten", headerBackTitle: "Zurück" }} />
      <ScrollView className="flex-1 bg-gray-50">
        <View className="p-4">
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
                placeholder="Beschreibe das Werkzeug..."
                placeholderTextColor="#9ca3af"
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
              />
            </View>
            <Input label="Marke" placeholder="z.B. Bosch" value={brand} onChangeText={setBrand} />
            <Input label="Modell" placeholder="z.B. GSR 18V-55" value={model} onChangeText={setModel} />
          </View>

          {/* Category */}
          <SectionTitle title="Kategorie" />
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
            <Input label="Stadt" placeholder="z.B. Köln" value={pickupCity} onChangeText={setPickupCity} />
            <Input
              label="Postleitzahl"
              placeholder="z.B. 51147"
              value={pickupPostalCode}
              onChangeText={setPickupPostalCode}
              keyboardType="number-pad"
            />
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
          <SectionTitle title="Hinweise" />
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
            title="Änderungen speichern"
            onPress={handleSubmit}
            isLoading={updateTool.isPending}
          />
          <View className="h-8" />
        </View>
      </ScrollView>
    </>
  );
}
