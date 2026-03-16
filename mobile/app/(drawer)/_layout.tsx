import { Slot } from "expo-router";

// Drawer temporarily replaced with Slot to avoid reanimated/worklets
// version mismatch in Expo Go. Drawer navigation can be re-enabled
// when using a development build (npx expo run:ios).
export default function DrawerLayout() {
  return <Slot />;
}
