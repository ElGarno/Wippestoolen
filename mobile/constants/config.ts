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

export const config = {
  ...ENV[environment],
  environment,
  tokenRefreshThreshold: 5 * 60, // Refresh token 5 min before expiry
};
