import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { queryKeys } from "../constants/queryKeys";
import type {
  Booking,
  BookingSummary,
  BookingCreateRequest,
  BookingStatusUpdateRequest,
} from "../types";
import type { PaginatedBookingResponse } from "../types/api";

interface BookingListParams {
  role?: "borrower" | "owner";
  status?: string;
  page?: number;
  size?: number;
}

interface AvailabilityParams {
  start_date?: string;
  end_date?: string;
}

interface AvailabilityResponse {
  tool_id: string;
  is_available: boolean;
  unavailable_dates: string[];
  existing_bookings: Array<{
    start_date: string;
    end_date: string;
    status: string;
  }>;
}

export function useBookings(params: BookingListParams = {}) {
  return useQuery({
    queryKey: queryKeys.bookings.list(params as Record<string, unknown>),
    queryFn: async () => {
      const { data } = await api.get<PaginatedBookingResponse<BookingSummary>>("/bookings", {
        params,
      });
      return data;
    },
  });
}

export function useBooking(id: string) {
  return useQuery({
    queryKey: queryKeys.bookings.detail(id),
    queryFn: async () => {
      const { data } = await api.get<Booking>(`/bookings/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useToolAvailability(toolId: string, params: AvailabilityParams = {}) {
  return useQuery({
    queryKey: queryKeys.bookings.toolAvailability(toolId, params as Record<string, unknown>),
    queryFn: async () => {
      const { data } = await api.get<AvailabilityResponse>(
        `/bookings/tools/${toolId}/availability`,
        { params }
      );
      return data;
    },
    enabled: !!toolId,
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (booking: BookingCreateRequest) => {
      const { data } = await api.post<Booking>("/bookings", booking);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
    },
  });
}

export function useUpdateBookingStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (update: BookingStatusUpdateRequest) => {
      const { data } = await api.patch<Booking>(`/bookings/${id}/status`, update);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
    },
  });
}

export function useConfirmBooking(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ownerResponse?: string) => {
      const { data } = await api.post<Booking>(`/bookings/${id}/confirm`, {
        owner_response: ownerResponse,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
    },
  });
}

export function useDeclineBooking(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ownerResponse?: string) => {
      const { data } = await api.post<Booking>(`/bookings/${id}/decline`, {
        owner_response: ownerResponse,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
    },
  });
}

export function useCancelBooking(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reason?: string) => {
      const { data } = await api.post<Booking>(`/bookings/${id}/cancel`, {
        cancellation_reason: reason,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
    },
  });
}

export function usePickupBooking(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pickupNotes?: string) => {
      const { data } = await api.post<Booking>(`/bookings/${id}/pickup`, {
        pickup_notes: pickupNotes,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
    },
  });
}

export function useReturnBooking(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (returnNotes?: string) => {
      const { data } = await api.post<Booking>(`/bookings/${id}/return`, {
        return_notes: returnNotes,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
    },
  });
}
