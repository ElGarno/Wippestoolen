import { Stack } from "expo-router";
import { colors } from "../../constants/colors";

export default function MyToolsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTitleStyle: { fontWeight: "bold", color: colors.gray[900] },
        headerTintColor: colors.primary[600],
        headerBackTitle: "Zurück",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Meine Werkzeuge" }} />
    </Stack>
  );
}
