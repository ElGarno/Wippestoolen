import { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Alert } from "react-native";
import { Link } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/ui/Button";
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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
    >
      <ScrollView contentContainerClassName="flex-1 justify-center px-6">
        <View className="mb-8">
          <Text className="text-3xl font-bold text-gray-900 text-center">Wippestoolen</Text>
          <Text className="text-base text-gray-500 text-center mt-2">
            Werkzeuge aus der Nachbarschaft
          </Text>
        </View>

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

        <Button title="Anmelden" onPress={handleLogin} isLoading={isLoading} />

        <View className="mt-6 flex-row justify-center">
          <Text className="text-gray-500">Noch kein Konto? </Text>
          <Link href="/(auth)/register" className="text-primary-600 font-semibold">
            Registrieren
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
