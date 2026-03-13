import { Stack } from "expo-router";

export default function MyToolsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Meine Werkzeuge" }} />
    </Stack>
  );
}
