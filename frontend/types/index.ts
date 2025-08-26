export interface User {
  id: string
  email: string
  display_name: string
  first_name?: string
  last_name?: string
  phone_number?: string
  bio?: string
  avatar_url?: string
  average_rating: number
  total_ratings: number
  is_active: boolean
  is_verified: boolean
  email_verified_at?: string
  location_visible: boolean
  profile_visible: boolean
  created_at: string
  last_login_at?: string
}

export interface ToolPhoto {
  id: string
  original_url: string
  thumbnail_url?: string
  medium_url?: string
  large_url?: string
  display_order: number
  is_primary: boolean
}

export interface ToolCategory {
  id: number
  name: string
  slug: string
  description?: string
  icon_name?: string
}

export interface ToolOwner {
  id: string
  display_name: string
  first_name?: string
  last_name?: string
  avatar_url?: string
  average_rating?: number
  total_ratings: number
  is_verified: boolean
}

export interface Tool {
  id: string
  title: string
  description?: string
  category: ToolCategory
  condition: string
  is_available: boolean
  daily_rate: number
  deposit_amount?: number
  pickup_city?: string
  pickup_postal_code?: string
  delivery_available: boolean
  average_rating?: number
  total_ratings: number
  primary_photo?: ToolPhoto
  photos?: ToolPhoto[]
  owner: ToolOwner
  distance_km?: number
  brand?: string
  model?: string
  max_loan_days?: number
  pickup_address?: string
  pickup_latitude?: number
  pickup_longitude?: number
  delivery_radius_km?: number
  usage_instructions?: string
  safety_notes?: string
  last_maintenance_date?: string
  next_maintenance_due?: string
  total_bookings?: number
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
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  display_name: string
  first_name?: string
  last_name?: string
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