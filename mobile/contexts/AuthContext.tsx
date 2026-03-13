import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, useSegments } from "expo-router";
import api from "../lib/api";
import { getAccessToken, setTokens, clearTokens } from "../lib/auth";
import type { User, LoginRequest, RegisterRequest, AuthResponse, UpdateProfileRequest } from "../types";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: UpdateProfileRequest) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const router = useRouter();
  const segments = useSegments();

  // Check for existing token on mount
  useEffect(() => {
    async function loadUser() {
      try {
        const token = await getAccessToken();
        if (token) {
          const { data } = await api.get<User>("/auth/me");
          setState({ user: data, isLoading: false, isAuthenticated: true });
        } else {
          setState({ user: null, isLoading: false, isAuthenticated: false });
        }
      } catch {
        await clearTokens();
        setState({ user: null, isLoading: false, isAuthenticated: false });
      }
    }
    loadUser();
  }, []);

  // Redirect based on auth state
  useEffect(() => {
    if (state.isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!state.isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (state.isAuthenticated && inAuthGroup) {
      router.replace("/(drawer)/(tabs)/");
    }
  }, [state.isAuthenticated, state.isLoading, segments]);

  const login = useCallback(async (data: LoginRequest) => {
    const { data: response } = await api.post<AuthResponse>("/auth/login", data);
    await setTokens(response.access_token, response.refresh_token);
    setState({ user: response.user, isLoading: false, isAuthenticated: true });
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    const { data: response } = await api.post<AuthResponse>("/auth/register", data);
    await setTokens(response.access_token, response.refresh_token);
    setState({ user: response.user, isLoading: false, isAuthenticated: true });
  }, []);

  const logout = useCallback(async () => {
    await clearTokens();
    setState({ user: null, isLoading: false, isAuthenticated: false });
  }, []);

  const updateProfile = useCallback(async (data: UpdateProfileRequest) => {
    const { data: updatedUser } = await api.put<User>("/auth/me", data);
    setState((prev) => ({ ...prev, user: updatedUser }));
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await api.get<User>("/auth/me");
    setState((prev) => ({ ...prev, user: data }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, updateProfile, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
