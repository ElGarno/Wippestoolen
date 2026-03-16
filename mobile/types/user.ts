export interface User {
  id: string;
  email: string;
  display_name: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  bio?: string;
  avatar_url?: string;
  street_address?: string;
  city?: string;
  postal_code?: string;
  average_rating: number;
  total_ratings: number;
  is_active: boolean;
  is_verified: boolean;
  email_verified_at?: string;
  location_visible: boolean;
  profile_visible: boolean;
  created_at: string;
  last_login_at?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  street_address?: string;
  city?: string;
  postal_code?: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface UpdateProfileRequest {
  display_name?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  bio?: string;
  street_address?: string;
  city?: string;
  postal_code?: string;
  location_visible?: boolean;
  profile_visible?: boolean;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}
