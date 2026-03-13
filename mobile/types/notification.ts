export interface Notification {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  related_booking_id?: string;
  related_tool_id?: string;
  related_user_id?: string;
  action_url?: string;
  action_data?: Record<string, unknown>;
  is_read: boolean;
  read_at?: string;
  priority: "low" | "normal" | "high" | "urgent";
  created_at: string;
  expires_at: string;
}

export interface NotificationPreferences {
  in_app_enabled: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  booking_notifications: boolean;
  review_notifications: boolean;
  system_notifications: boolean;
  quiet_hours_start?: number;
  quiet_hours_end?: number;
  timezone: string;
}
