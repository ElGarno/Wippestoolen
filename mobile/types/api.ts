/**
 * Paginated response for tools (matches PaginatedToolResponse schema).
 * Note: Different endpoints use different pagination shapes!
 */
export interface PaginatedToolResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

/**
 * Paginated response for bookings (matches PaginatedBookingResponse schema).
 * Uses nested `pagination` object and `bookings` instead of `items`.
 */
export interface PaginatedBookingResponse<T> {
  bookings: T[];
  pagination: {
    page: number;
    size: number;
    total: number;
    pages: number;
  };
}

/**
 * Paginated response for reviews (matches PaginatedReviewResponse schema).
 */
export interface PaginatedReviewResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ApiError {
  detail: string;
  status_code?: number;
}
