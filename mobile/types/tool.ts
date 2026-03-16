export interface ToolCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon_name?: string;
}

export interface ToolCategoryWithCount extends ToolCategory {
  tool_count: number;
}

export interface ToolPhoto {
  id: string;
  original_url: string;
  thumbnail_url?: string;
  medium_url?: string;
  large_url?: string;
  display_order: number;
  is_primary: boolean;
}

export interface ToolOwner {
  id: string;
  display_name: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  average_rating?: number;
  total_ratings: number;
  is_verified: boolean;
}

/**
 * Tool list item (from browse/search endpoints).
 * Uses `primary_photo` instead of `photos` array.
 */
export interface ToolListItem {
  id: string;
  title: string;
  description: string;
  category: ToolCategory;
  condition: string;
  is_available: boolean;
  daily_rate: number;
  pickup_city?: string;
  pickup_postal_code?: string;
  pickup_latitude?: number | null;
  pickup_longitude?: number | null;
  delivery_available: boolean;
  average_rating?: number;
  total_ratings: number;
  primary_photo?: ToolPhoto;
  owner: ToolOwner;
  distance_km?: number;
}

/**
 * Full tool detail (from GET /tools/{id} endpoint).
 * Includes full photos array and all fields.
 */
export interface Tool {
  id: string;
  title: string;
  description: string;
  category: ToolCategory;
  brand?: string;
  model?: string;
  condition: "excellent" | "good" | "fair" | "poor";
  is_available: boolean;
  max_loan_days: number;
  deposit_amount: number;
  daily_rate: number;
  pickup_address?: string;
  pickup_city?: string;
  pickup_postal_code?: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  delivery_available: boolean;
  delivery_radius_km: number;
  usage_instructions?: string;
  safety_notes?: string;
  last_maintenance_date?: string;
  next_maintenance_due?: string;
  total_bookings: number;
  average_rating?: number;
  total_ratings: number;
  photos: ToolPhoto[];
  owner: ToolOwner;
  distance_km?: number;
  created_at: string;
  updated_at: string;
}

export interface ToolCreateRequest {
  title: string;
  description: string;
  category_id: number;
  brand?: string;
  model?: string;
  condition: "excellent" | "good" | "fair" | "poor";
  max_loan_days: number;
  deposit_amount: number;
  daily_rate: number;
  pickup_address?: string;
  pickup_city?: string;
  pickup_postal_code?: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  delivery_available: boolean;
  delivery_radius_km?: number;
  usage_instructions?: string;
  safety_notes?: string;
}

export type ToolUpdateRequest = Partial<ToolCreateRequest>;
