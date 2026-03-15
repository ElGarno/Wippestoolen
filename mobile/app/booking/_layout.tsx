import { Stack } from "expo-router";
import { colors } from "../../constants/colors";

export default function BookingLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTitleStyle: { fontWeight: "bold", color: colors.gray[900] },
        headerTintColor: colors.primary[600],
        headerBackTitle: "Zurück",
      }}
    >
      <Stack.Screen name="[id]" options={{ title: "Buchung" }} />
    </Stack>
  );
}
