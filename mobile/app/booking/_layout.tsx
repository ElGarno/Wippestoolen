import { Stack } from "expo-router";

export default function BookingLayout() {
  return (
    <Stack>
      <Stack.Screen name="[id]" options={{ title: "Buchung" }} />
    </Stack>
  );
}
