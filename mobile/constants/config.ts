const ENV = {
  development: {
    API_URL: "http://localhost:8000/api/v1",
  },
  staging: {
    API_URL: "https://api.wippestoolen.de/api/v1",
  },
  production: {
    API_URL: "https://api.wippestoolen.de/api/v1",
  },
};

const environment = (process.env.EXPO_PUBLIC_ENV || "development") as keyof typeof ENV;

const envConfig = ENV[environment];
const BASE_URL = envConfig.API_URL.replace("/api/v1", "");

export const config = {
  ...envConfig,
  BASE_URL,
  environment,
  tokenRefreshThreshold: 5 * 60, // Refresh token 5 min before expiry,
};

/**
 * Convert a relative photo URL to an absolute URL.
 * Backend returns paths like "/uploads/photos/..." which need the base URL prepended.
 */
export function getPhotoUrl(relativeUrl: string | null | undefined): string | null {
  if (!relativeUrl) return null;
  if (relativeUrl.startsWith("http")) return relativeUrl;
  return `${BASE_URL}${relativeUrl}`;
}
