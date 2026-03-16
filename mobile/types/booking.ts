export type BookingStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "active"
  | "returned"
  | "completed";

/** Matches backend UserBasic schema. */
export interface BookingUser {
  id: string;
  display_name: string;
  full_name?: string | null;
  average_rating: number;
  phone_number?: string | null;
}

/** Matches backend ToolBasic schema. */
export interface BookingTool {
  id: string;
  title: string;
  category: string;
  daily_rate: number;
  owner: BookingUser;
}

/** Full booking response (matches BookingResponse schema). */
export interface Booking {
  id: string;
  tool: BookingTool;
  borrower: BookingUser;
  tool_owner?: BookingUser;
  requested_start_date: string;
  requested_end_date: string;
  actual_start_date?: string;
  actual_end_date?: string;
  status: BookingStatus;
  borrower_message?: string;
  owner_response?: string;
  pickup_notes?: string;
  return_notes?: string;
  deposit_amount: number;
  daily_rate: number;
  total_amount: number;
  deposit_paid: boolean;
  deposit_returned: boolean;
  pickup_method: string;
  pickup_address?: string;
  delivery_fee: number;
  cancellation_reason?: string;
  cancelled_at?: string;
  confirmed_at?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

/** Summary for list views (matches BookingSummary schema). */
export interface BookingSummary {
  id: string;
  tool: BookingTool;
  borrower: BookingUser;
  requested_start_date: string;
  requested_end_date: string;
  status: string;
  total_amount: number;
  created_at: string;
}

export interface BookingCreateRequest {
  tool_id: string;
  requested_start_date: string;
  requested_end_date: string;
  borrower_message?: string;
  pickup_method: "pickup" | "delivery";
  pickup_address?: string;
}

export interface BookingStatusUpdateRequest {
  status: BookingStatus;
  owner_response?: string;
  cancellation_reason?: string;
  pickup_notes?: string;
  return_notes?: string;
}
