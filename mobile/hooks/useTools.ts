import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { queryKeys } from "../constants/queryKeys";
import type {
  Tool,
  ToolListItem,
  ToolCreateRequest,
  ToolUpdateRequest,
  ToolCategoryWithCount,
} from "../types";
import type { PaginatedToolResponse } from "../types/api";

interface BrowseToolsParams {
  page?: number;
  page_size?: number;
  search?: string;
  category?: string;
  sort_by?: "created_at" | "daily_rate" | "rating" | "title";
  sort_order?: "asc" | "desc";
  available?: boolean;
}

export function useTools(params: BrowseToolsParams = {}) {
  return useQuery({
    queryKey: queryKeys.tools.list(params as Record<string, unknown>),
    queryFn: async () => {
      const { data } = await api.get<PaginatedToolResponse<ToolListItem>>("/tools", { params });
      return data;
    },
  });
}

export function useTool(id: string) {
  return useQuery({
    queryKey: queryKeys.tools.detail(id),
    queryFn: async () => {
      const { data } = await api.get<Tool>(`/tools/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useMyTools(params: { status_filter?: string; page?: number; page_size?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.tools.myTools(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedToolResponse<Tool>>("/tools/my-tools", { params });
      return data;
    },
  });
}

export function useToolCategories() {
  return useQuery({
    queryKey: queryKeys.tools.categories,
    queryFn: async () => {
      const { data } = await api.get<ToolCategoryWithCount[]>("/tools/categories");
      return data;
    },
    staleTime: 1000 * 60 * 60, // Categories rarely change — 1 hour
  });
}

export function useCreateTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tool: ToolCreateRequest) => {
      const { data } = await api.post<Tool>("/tools", tool);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tools.all });
    },
  });
}

export function useUpdateTool(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tool: ToolUpdateRequest) => {
      const { data } = await api.put<Tool>(`/tools/${id}`, tool);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tools.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tools.all });
    },
  });
}

export function useUploadToolPhoto(toolId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (uri: string) => {
      const filename = uri.split("/").pop() || "photo.jpg";
      const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
      const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

      const formData = new FormData();
      formData.append("file", {
        uri,
        name: filename,
        type: mimeType,
      } as unknown as Blob);

      const { data } = await api.post(`/tools/${toolId}/photos`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tools.detail(toolId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tools.all });
    },
  });
}

export function useDeleteTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tools/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tools.all });
    },
  });
}
