export type ReviewType = "borrower_to_owner" | "owner_to_borrower";

/** Matches backend UserBasicInfo schema. */
export interface ReviewUser {
  id: string;
  display_name: string;
  average_rating?: number;
  total_ratings: number;
}

/** Matches backend BookingBasicInfo schema. */
export interface ReviewBooking {
  id: string;
  requested_start_date: string;
  requested_end_date: string;
}

/** Matches backend ToolBasicInfo schema. */
export interface ReviewTool {
  id: string;
  title: string;
}

/** Full review response (matches ReviewResponse schema). */
export interface Review {
  id: string;
  booking: ReviewBooking;
  reviewer: ReviewUser;
  reviewee: ReviewUser;
  tool?: ReviewTool;
  rating: number;
  title?: string;
  comment?: string;
  tool_condition_rating?: number;
  review_type: ReviewType;
  response?: string;
  response_at?: string;
  is_flagged: boolean;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

/** List item (matches ReviewListItem schema). */
export interface ReviewListItem {
  id: string;
  reviewer_name: string;
  rating: number;
  title?: string;
  comment?: string;
  review_type: ReviewType;
  is_flagged: boolean;
  created_at: string;
}

/** Matches backend ReviewCreateRequest schema. */
export interface ReviewCreateRequest {
  booking_id: string;
  rating: number;
  title?: string;
  comment?: string;
  tool_condition_rating?: number;
}
