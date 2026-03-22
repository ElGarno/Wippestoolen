import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { queryKeys } from "../constants/queryKeys";
import type { Review, ReviewListItem, ReviewCreateRequest } from "../types";
import type { PaginatedReviewResponse } from "../types/api";

interface ReviewListParams {
  page?: number;
  size?: number;
}

export function useUserReviews(userId: string, params: ReviewListParams = {}) {
  return useQuery({
    queryKey: queryKeys.reviews.forUser(userId),
    queryFn: async () => {
      const { data } = await api.get<PaginatedReviewResponse<ReviewListItem>>(
        `/reviews/users/${userId}/reviews`,
        { params }
      );
      return data;
    },
    enabled: !!userId,
  });
}

export function useToolReviews(toolId: string, params: ReviewListParams = {}) {
  return useQuery({
    queryKey: queryKeys.reviews.forTool(toolId),
    queryFn: async () => {
      const { data } = await api.get<PaginatedReviewResponse<ReviewListItem>>(
        `/reviews/tools/${toolId}/reviews`,
        { params }
      );
      return data;
    },
    enabled: !!toolId,
  });
}

export function useCreateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (review: ReviewCreateRequest) => {
      const { data } = await api.post<Review>("/reviews", review);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all });
    },
  });
}
