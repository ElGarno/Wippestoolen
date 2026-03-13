import { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Alert } from "react-native";
import { Link } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/ui/Button";
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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
    >
      <ScrollView contentContainerClassName="flex-1 justify-center px-6">
        <View className="mb-8">
          <Text className="text-3xl font-bold text-gray-900 text-center">Registrieren</Text>
          <Text className="text-base text-gray-500 text-center mt-2">
            Erstelle dein Wippestoolen-Konto
          </Text>
        </View>

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

        <Input
          label="Passwort bestätigen *"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder="Passwort wiederholen"
        />

        <Button title="Konto erstellen" onPress={handleRegister} isLoading={isLoading} />

        <View className="mt-6 flex-row justify-center">
          <Text className="text-gray-500">Bereits ein Konto? </Text>
          <Link href="/(auth)/login" className="text-primary-600 font-semibold">
            Anmelden
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
