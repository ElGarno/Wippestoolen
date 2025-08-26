export interface User {
  id: string
  email: string
  full_name: string
  location?: string
  phone_number?: string
  bio?: string
  profile_picture_url?: string
  average_rating: number
  review_count: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Tool {
  id: string
  title: string
  description: string
  category: string
  owner_id: string
  owner?: User
  photos: string[]
  daily_rate: number
  deposit_required: number
  is_available: boolean
  location: string
  delivery_available: boolean
  delivery_fee?: number
  condition: string
  brand?: string
  model?: string
  year_purchased?: number
  purchase_price?: number
  average_rating: number
  review_count: number
  created_at: string
  updated_at: string
}

export interface Booking {
  id: string
  borrower_id: string
  borrower?: User
  tool_id: string
  tool?: Tool
  start_date: string
  end_date: string
  status: BookingStatus
  total_cost: number
  deposit_amount: number
  delivery_fee?: number
  delivery_address?: string
  pickup_method: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface Review {
  id: string
  booking_id: string
  booking?: Booking
  reviewer_id: string
  reviewer?: User
  reviewee_id: string
  reviewee?: User
  review_type: ReviewType
  rating: number
  comment: string
  is_flagged: boolean
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  is_read: boolean
  data?: Record<string, any>
  created_at: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  full_name: string
  location?: string
  phone_number?: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export type BookingStatus = 
  | "pending"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "active"
  | "overdue"
  | "completed"
  | "disputed"

export type ReviewType = "tool_review" | "borrower_review"

export type NotificationType =
  | "booking_request"
  | "booking_confirmed"
  | "booking_declined"
  | "booking_reminder"
  | "review_request"
  | "message"
  | "system"

export interface PaginationParams {
  skip?: number
  limit?: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface ApiError {
  detail: string
  status_code: number
}