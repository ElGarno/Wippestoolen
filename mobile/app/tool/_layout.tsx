import { Stack } from "expo-router";

export default function ToolLayout() {
  return (
    <Stack>
      <Stack.Screen name="[id]" options={{ title: "Werkzeug" }} />
    </Stack>
  );
}
