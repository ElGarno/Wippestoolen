import { useState } from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Link } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../contexts/AuthContext";
import { Input } from "../../components/ui/Input";

export default function RegisterScreen() {
  const { register } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleRegister() {
    if (!displayName.trim() || !email.trim() || !password) {
      Alert.alert("Fehler", "Bitte alle Pflichtfelder ausfüllen.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Fehler", "Passwörter stimmen nicht überein.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Fehler", "Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    setIsLoading(true);
    try {
      await register({
        email: email.trim(),
        password,
        display_name: displayName.trim(),
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Registrierung fehlgeschlagen. Bitte versuche es erneut.";
      Alert.alert("Registrierung fehlgeschlagen", message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <LinearGradient
      colors={["#E8470A", "#F5A623"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo area */}
          <View className="flex-1 justify-center px-6 pt-20 pb-8">
            <View className="items-center mb-8">
              <View className="w-16 h-16 bg-white rounded-2xl items-center justify-center mb-3 shadow-lg">
                <Text style={{ fontSize: 28 }}>🔧</Text>
              </View>
              <Text className="text-3xl font-bold text-white text-center tracking-tight">
                Wippestoolen
              </Text>
              <Text className="text-sm text-white text-center mt-1 opacity-90">
                Werkzeug leihen statt kaufen
              </Text>
            </View>

            {/* Floating white card */}
            <View className="bg-white rounded-3xl p-6 shadow-2xl">
              <Text className="text-2xl font-bold text-center mb-1" style={{ color: "#1A1A1A" }}>
                Konto erstellen
              </Text>
              <Text className="text-sm text-gray-500 text-center mb-6">
                Werde Teil der Nachbarschaft
              </Text>

              <Input
                label="Anzeigename *"
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                placeholder="Dein Name"
              />

              <Input
                label="E-Mail *"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="name@beispiel.de"
              />

              <Input
                label="Passwort *"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Mind. 8 Zeichen"
              />

              {password.length > 0 && password.length < 8 && (
                <Text className="text-xs text-red-500 -mt-2 mb-3 ml-1">
                  Mindestens 8 Zeichen erforderlich
                </Text>
              )}

              <Input
                label="Passwort bestätigen *"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder="Passwort wiederholen"
              />

              {confirmPassword.length > 0 && password !== confirmPassword && (
                <Text className="text-xs text-red-500 -mt-2 mb-3 ml-1">
                  Passwörter stimmen nicht überein
                </Text>
              )}

              <TouchableOpacity
                onPress={handleRegister}
                disabled={isLoading}
                activeOpacity={0.85}
                style={{ marginTop: 8 }}
              >
                <LinearGradient
                  colors={["#E8470A", "#F5A623"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    borderRadius: 12,
                    paddingVertical: 15,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    opacity: isLoading ? 0.7 : 1,
                  }}
                >
                  {isLoading && <ActivityIndicator color="white" style={{ marginRight: 8 }} />}
                  <Text className="text-white font-bold text-base">Konto erstellen</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Login link */}
            <View className="mt-6 flex-row justify-center">
              <Text className="text-white opacity-90">Bereits ein Konto? </Text>
              <Link href="/(auth)/login">
                <Text className="text-white font-bold underline">Anmelden</Text>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
