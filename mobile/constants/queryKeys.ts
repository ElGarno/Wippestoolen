export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  tools: {
    all: ["tools"] as const,
    list: (params?: Record<string, unknown>) => ["tools", "list", params] as const,
    detail: (id: string) => ["tools", "detail", id] as const,
    myTools: (params?: Record<string, unknown>) => ["tools", "my", params] as const,
    categories: ["tools", "categories"] as const,
    categoryTools: (categoryId: number, params?: Record<string, unknown>) =>
      ["tools", "category", categoryId, params] as const,
  },
  bookings: {
    all: ["bookings"] as const,
    list: (params?: Record<string, unknown>) => ["bookings", "list", params] as const,
    detail: (id: string) => ["bookings", "detail", id] as const,
    calendar: (params?: Record<string, unknown>) => ["bookings", "calendar", params] as const,
    toolAvailability: (toolId: string, params?: Record<string, unknown>) =>
      ["bookings", "availability", toolId, params] as const,
  },
  reviews: {
    all: ["reviews"] as const,
    forUser: (userId: string) => ["reviews", "user", userId] as const,
    forTool: (toolId: string) => ["reviews", "tool", toolId] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: (params?: Record<string, unknown>) => ["notifications", "list", params] as const,
    unreadCount: ["notifications", "unread-count"] as const,
  },
} as const;
