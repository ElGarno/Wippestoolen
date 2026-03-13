import "../global.css";
import { useEffect, useRef } from "react";
import { Slot, SplashScreen } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { queryClient } from "../lib/queryClient";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { registerForPushNotifications } from "../lib/notifications";

SplashScreen.preventAutoHideAsync();

function PushNotificationRegistrar() {
  const { isAuthenticated, isLoading } = useAuth();
  const hasRegistered = useRef(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !hasRegistered.current) {
      hasRegistered.current = true;
      registerForPushNotifications().catch((error) => {
        console.warn("Push notification registration failed:", error);
      });
    }

    if (!isAuthenticated) {
      hasRegistered.current = false;
    }
  }, [isAuthenticated, isLoading]);

  return null;
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PushNotificationRegistrar />
          <Slot />
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
