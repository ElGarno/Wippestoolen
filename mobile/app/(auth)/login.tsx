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

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Fehler", "Bitte E-Mail und Passwort eingeben.");
      return;
    }
    setIsLoading(true);
    try {
      await login({ email: email.trim(), password });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Login fehlgeschlagen. Bitte versuche es erneut.";
      Alert.alert("Login fehlgeschlagen", message);
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
          <View className="flex-1 justify-center px-6 pt-24 pb-8">
            <View className="items-center mb-10">
              <View className="w-20 h-20 bg-white rounded-3xl items-center justify-center mb-4 shadow-lg">
                <Text style={{ fontSize: 36 }}>🔧</Text>
              </View>
              <Text className="text-4xl font-bold text-white text-center tracking-tight">
                Wippestoolen
              </Text>
              <Text className="text-base text-white text-center mt-2 opacity-90">
                Werkzeug leihen statt kaufen
              </Text>
            </View>

            {/* Floating white card */}
            <View className="bg-white rounded-3xl p-6 shadow-2xl">
              <Text className="text-2xl font-bold text-center mb-1" style={{ color: "#1A1A1A" }}>
                Willkommen zuruck
              </Text>
              <Text className="text-sm text-gray-500 text-center mb-6">
                Melde dich bei deinem Konto an
              </Text>

              <Input
                label="E-Mail"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="name@beispiel.de"
              />

              <Input
                label="Passwort"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                placeholder="Passwort eingeben"
              />

              <TouchableOpacity
                onPress={handleLogin}
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
                  <Text className="text-white font-bold text-base">Anmelden</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Register link */}
            <View className="mt-6 flex-row justify-center">
              <Text className="text-white opacity-90">Noch kein Konto? </Text>
              <Link href="/(auth)/register">
                <Text className="text-white font-bold underline">Registrieren</Text>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
