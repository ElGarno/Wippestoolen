import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { queryKeys } from "../constants/queryKeys";
import type { Notification } from "../types";

interface NotificationListParams {
  page?: number;
  size?: number;
  unread_only?: boolean;
}

interface NotificationListResponse {
  items: Notification[];
  total: number;
  page: number;
  size: number;
  pages: number;
  unread_count: number;
}

interface UnreadCountResponse {
  unread_count: number;
}

export function useNotifications(params: NotificationListParams = {}) {
  return useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: async () => {
      const { data } = await api.get<NotificationListResponse>("/notifications", { params });
      return data;
    },
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: async () => {
      const { data } = await api.get<UnreadCountResponse>("/notifications/unread-count");
      return data;
    },
    staleTime: 1000 * 30, // 30 seconds
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.post("/notifications/mark-all-read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
