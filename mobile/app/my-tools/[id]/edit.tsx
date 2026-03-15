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
import { LinearGradient } from "expo-linear-gradient";
import { useTool, useUpdateTool, useToolCategories } from "../../../hooks/useTools";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { colors } from "../../../constants/colors";

type Condition = "excellent" | "good" | "fair" | "poor";

const CONDITIONS: { label: string; value: Condition }[] = [
  { label: "Ausgezeichnet", value: "excellent" },
  { label: "Gut", value: "good" },
  { label: "Befriedigend", value: "fair" },
  { label: "Mangelhaft", value: "poor" },
];

function SectionTitle({ title }: { title: string }) {
  return (
    <Text
      style={{
        fontSize: 13,
        fontWeight: "700",
        color: colors.gray[500],
        textTransform: "uppercase",
        letterSpacing: 0.8,
        marginBottom: 8,
        marginTop: 8,
        paddingHorizontal: 4,
      }}
    >
      {title}
    </Text>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      {children}
    </View>
  );
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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.gray[50] }}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  if (!tool) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.gray[50] }}>
        <Text style={{ color: colors.gray[500] }}>Werkzeug nicht gefunden</Text>
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
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: colors.gray[50] }}>
        {/* Gradient header */}
        <LinearGradient
          colors={[colors.gradient.start, colors.gradient.end]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20 }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginBottom: 12 }}
            activeOpacity={0.7}
          >
            <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 15, fontWeight: "500" }}>
              ← Zurück
            </Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 26, fontWeight: "800", color: colors.white }}>
            Werkzeug bearbeiten
          </Text>
          <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>
            {tool.title}
          </Text>
        </LinearGradient>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {/* Basic info */}
          <SectionTitle title="Grundinformationen" />
          <Card>
            <Input
              label="Titel *"
              placeholder="z.B. Bohrmaschine Bosch GSR 18V"
              value={title}
              onChangeText={setTitle}
            />
            <View style={{ marginBottom: 16 }}>
              <Text
                style={{ fontSize: 14, fontWeight: "500", color: colors.gray[700], marginBottom: 6 }}
              >
                Beschreibung *
              </Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: colors.gray[300],
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 15,
                  backgroundColor: colors.white,
                  minHeight: 80,
                  color: colors.gray[900],
                }}
                placeholder="Beschreibe das Werkzeug..."
                placeholderTextColor={colors.gray[400]}
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
              />
            </View>
            <Input label="Marke" placeholder="z.B. Bosch" value={brand} onChangeText={setBrand} />
            <Input
              label="Modell"
              placeholder="z.B. GSR 18V-55"
              value={model}
              onChangeText={setModel}
            />
          </Card>

          {/* Category */}
          <SectionTitle title="Kategorie" />
          <Card>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {categories?.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 10,
                    borderWidth: 1.5,
                    backgroundColor:
                      categoryId === cat.id ? colors.primary[600] : colors.white,
                    borderColor:
                      categoryId === cat.id ? colors.primary[600] : colors.gray[300],
                  }}
                  onPress={() => setCategoryId(cat.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      color: categoryId === cat.id ? colors.white : colors.gray[700],
                      fontWeight: categoryId === cat.id ? "600" : "400",
                    }}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Condition */}
          <SectionTitle title="Zustand" />
          <Card>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {CONDITIONS.map((c) => (
                <TouchableOpacity
                  key={c.value}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 9,
                    borderRadius: 10,
                    borderWidth: 1.5,
                    backgroundColor:
                      condition === c.value ? colors.primary[600] : colors.white,
                    borderColor:
                      condition === c.value ? colors.primary[600] : colors.gray[300],
                  }}
                  onPress={() => setCondition(c.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      color: condition === c.value ? colors.white : colors.gray[700],
                      fontWeight: condition === c.value ? "600" : "400",
                    }}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Pricing */}
          <SectionTitle title="Preise & Bedingungen" />
          <Card>
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
          </Card>

          {/* Location */}
          <SectionTitle title="Abholort" />
          <Card>
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
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 12,
                borderRadius: 10,
                borderWidth: 1,
                backgroundColor: deliveryAvailable ? colors.primary[50] : colors.gray[50],
                borderColor: deliveryAvailable ? colors.primary[200] : colors.gray[200],
              }}
              onPress={() => setDeliveryAvailable(!deliveryAvailable)}
              activeOpacity={0.7}
            >
              <Text
                style={{ fontSize: 14, fontWeight: "500", color: colors.gray[700] }}
              >
                Lieferung möglich
              </Text>
              <View
                style={{
                  width: 48,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: deliveryAvailable ? colors.primary[600] : colors.gray[300],
                  justifyContent: "center",
                  paddingHorizontal: 2,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: colors.white,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.15,
                    shadowRadius: 2,
                    elevation: 2,
                    alignSelf: deliveryAvailable ? "flex-end" : "flex-start",
                  }}
                />
              </View>
            </TouchableOpacity>
            {deliveryAvailable && (
              <View style={{ marginTop: 12 }}>
                <Input
                  label="Lieferradius (km)"
                  placeholder="10"
                  value={deliveryRadiusKm}
                  onChangeText={setDeliveryRadiusKm}
                  keyboardType="number-pad"
                />
              </View>
            )}
          </Card>

          {/* Instructions */}
          <SectionTitle title="Hinweise" />
          <Card>
            <View style={{ marginBottom: 16 }}>
              <Text
                style={{ fontSize: 14, fontWeight: "500", color: colors.gray[700], marginBottom: 6 }}
              >
                Benutzungshinweise
              </Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: colors.gray[300],
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 15,
                  backgroundColor: colors.white,
                  minHeight: 60,
                  color: colors.gray[900],
                }}
                placeholder="Tipps zur korrekten Bedienung..."
                placeholderTextColor={colors.gray[400]}
                value={usageInstructions}
                onChangeText={setUsageInstructions}
                multiline
                textAlignVertical="top"
              />
            </View>
            <View>
              <Text
                style={{ fontSize: 14, fontWeight: "500", color: colors.gray[700], marginBottom: 6 }}
              >
                Sicherheitshinweise
              </Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: colors.gray[300],
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 15,
                  backgroundColor: colors.white,
                  minHeight: 60,
                  color: colors.gray[900],
                }}
                placeholder="Wichtige Sicherheitshinweise..."
                placeholderTextColor={colors.gray[400]}
                value={safetyNotes}
                onChangeText={setSafetyNotes}
                multiline
                textAlignVertical="top"
              />
            </View>
          </Card>

          <Button
            title="Änderungen speichern"
            onPress={handleSubmit}
            isLoading={updateTool.isPending}
          />
          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </>
  );
}
