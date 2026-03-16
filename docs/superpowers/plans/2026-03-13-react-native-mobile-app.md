# Wippestoolen React Native Mobile App — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete React Native (Expo) mobile app with feature parity to the existing Next.js web frontend, connecting to the production FastAPI backend.

**Architecture:** Expo prebuild workflow with Expo Router (file-based routing), NativeWind for styling, TanStack Query for server state, and Expo SecureStore for auth token storage. The app lives in `mobile/` alongside the existing `frontend/` and `wippestoolen/` directories.

**Tech Stack:** Expo SDK 52+, React Native 0.76+, Expo Router v4, NativeWind v4, TanStack Query v5, Axios, Expo SecureStore, Expo Notifications, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-13-react-native-mobile-app-design.md`

---

## Chunk 1: Backend Bug Fixes & Prep

These must be done before mobile development starts to ensure the API works correctly.

### Task 1.1: Fix WebSocket decode_token Import Bug

**Files:**
- Modify: `wippestoolen/app/api/v1/endpoints/notifications.py:422`

- [ ] **Step 1: Write failing test**

Create `wippestoolen/tests/test_notifications_ws_import.py`:

```python
"""Test that the notifications module imports cleanly after fix."""


def test_notifications_router_imports_without_error():
    """Verify the notification router can be imported (decode_token bug fixed)."""
    from wippestoolen.app.api.v1.endpoints.notifications import router
    assert router is not None
```

- [ ] **Step 2: Run test to verify it fails (ImportError due to decode_token)**

Run: `cd /Users/woerenkaemper/PycharmProjects/Wippestoolen && python -m pytest wippestoolen/tests/test_notifications_ws_import.py -v`
Expected: FAIL with ImportError (cannot import name 'decode_token')

- [ ] **Step 3: Fix the import and add null check in notifications.py**

In `wippestoolen/app/api/v1/endpoints/notifications.py`, line 422, change:
```python
# OLD:
from wippestoolen.app.core.security import decode_token
# NEW:
from wippestoolen.app.core.security import verify_token
```

On line 426, change to include explicit null check:
```python
# OLD:
payload = decode_token(token)
# NEW:
payload = verify_token(token)
if payload is None:
    await websocket.close(code=4001, reason="Invalid token")
    return
```

- [ ] **Step 4: Verify the module imports cleanly**

Run: `cd /Users/woerenkaemper/PycharmProjects/Wippestoolen && python -c "from wippestoolen.app.api.v1.endpoints.notifications import router; print('OK')"`
Expected: `OK` (no ImportError)

- [ ] **Step 5: Commit**

```bash
git add wippestoolen/app/api/v1/endpoints/notifications.py wippestoolen/tests/test_notifications_ws_import.py
git commit -m "fix: correct decode_token import to verify_token in WebSocket endpoint"
```

---

### Task 1.2: Fix Booking Route Conflict

**Files:**
- Modify: `wippestoolen/app/api/v1/endpoints/bookings.py`

The `GET /bookings/calendar` endpoint (line 203) must be defined BEFORE `GET /bookings/{booking_id}` (line 80) so FastAPI doesn't interpret "calendar" as a UUID.

- [ ] **Step 1: Write failing test**

Create `wippestoolen/tests/test_booking_routes.py`:

```python
"""Test that booking route ordering is correct."""
from wippestoolen.app.api.v1.endpoints.bookings import router


def test_calendar_route_before_booking_id_route():
    """Ensure /calendar is defined before /{booking_id} to avoid route conflict."""
    routes = [r.path for r in router.routes if hasattr(r, "path")]
    calendar_idx = None
    booking_id_idx = None
    for i, path in enumerate(routes):
        if path == "/calendar":
            calendar_idx = i
        if path == "/{booking_id}":
            booking_id_idx = i

    assert calendar_idx is not None, "/calendar route not found"
    assert booking_id_idx is not None, "/{booking_id} route not found"
    assert calendar_idx < booking_id_idx, (
        f"/calendar (index {calendar_idx}) must come before "
        f"/{{booking_id}} (index {booking_id_idx}) to avoid route conflict"
    )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/woerenkaemper/PycharmProjects/Wippestoolen && python -m pytest wippestoolen/tests/test_booking_routes.py -v`
Expected: FAIL — calendar route is currently defined after the {booking_id} route.

- [ ] **Step 3: Reorder routes in bookings.py**

Move the `get_booking_calendar` endpoint (currently around line 203) to BEFORE the `get_booking` endpoint (currently around line 80). Keep all the function code intact, just move the entire decorated function block.

Also move the `get_tool_availability` endpoint (uses `/tools/{tool_id}/availability`) before `/{booking_id}` if it isn't already.

Route order should be:
1. `POST ""` — create booking
2. `GET ""` — list bookings
3. `GET "/calendar"` — calendar view
4. `GET "/tools/{tool_id}/availability"` — tool availability
5. `GET "/{booking_id}"` — single booking (catch-all LAST)
6. `PATCH "/{booking_id}/status"` — update status
7. Other `/{booking_id}/...` routes

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/woerenkaemper/PycharmProjects/Wippestoolen && python -m pytest wippestoolen/tests/test_booking_routes.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add wippestoolen/app/api/v1/endpoints/bookings.py wippestoolen/tests/test_booking_routes.py
git commit -m "fix: reorder booking routes to prevent calendar/UUID conflict"
```

---

### Task 1.3: Add is_available Filter to Browse Tools

**Files:**
- Modify: `wippestoolen/app/api/v1/endpoints/tools.py` (browse_tools endpoint)
- Modify: `wippestoolen/app/services/tool_service.py` (if filter logic lives here)

- [ ] **Step 1: Write failing test**

Create `wippestoolen/tests/test_tools_availability_filter.py`:

```python
"""Test that browse_tools supports is_available filter."""
from wippestoolen.app.api.v1.endpoints.tools import router


def test_browse_tools_has_available_filter_param():
    """Verify the browse_tools endpoint accepts an 'available' query parameter."""
    for route in router.routes:
        if hasattr(route, "path") and route.path == "" and "GET" in getattr(route, "methods", set()):
            # Check endpoint function signature for 'available' parameter
            import inspect

            sig = inspect.signature(route.endpoint)
            param_names = list(sig.parameters.keys())
            assert "available" in param_names, (
                f"browse_tools endpoint missing 'available' parameter. "
                f"Current params: {param_names}"
            )
            return
    pytest.fail("GET / route not found on tools router")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/woerenkaemper/PycharmProjects/Wippestoolen && python -m pytest wippestoolen/tests/test_tools_availability_filter.py -v`
Expected: FAIL — `available` parameter doesn't exist yet.

- [ ] **Step 3: Add available filter parameter to browse_tools**

In `wippestoolen/app/api/v1/endpoints/tools.py`, add parameter to `browse_tools`:

```python
async def browse_tools(
    # ... existing params ...
    available: Optional[bool] = Query(None, description="Filter by availability"),
    # ... rest ...
):
```

Then in the query building logic, add:

```python
if available is not None:
    query = query.where(Tool.is_available == available)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/woerenkaemper/PycharmProjects/Wippestoolen && python -m pytest wippestoolen/tests/test_tools_availability_filter.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add wippestoolen/app/api/v1/endpoints/tools.py wippestoolen/tests/test_tools_availability_filter.py
git commit -m "feat: add is_available filter to browse tools endpoint"
```

---

## Chunk 2: Expo Project Scaffolding

### Task 2.1: Create Branch and Initialize Expo Project

**Files:**
- Create: `mobile/` directory with Expo project

- [ ] **Step 1: Create feature branch**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen
git checkout -b feature/react-native-app
```

- [ ] **Step 2: Create Expo project with TypeScript template**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen
npx create-expo-app@latest mobile --template tabs
```

Note: If `tabs` template is not available, use `blank-typescript` and set up routing manually.

- [ ] **Step 3: Verify project runs**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen/mobile
npx expo start --no-dev --minify 2>&1 | head -20
```

Expected: Expo dev server starts without errors.

- [ ] **Step 4: Add .superpowers/ to .gitignore if not present**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen
echo ".superpowers/" >> .gitignore
```

- [ ] **Step 5: Commit**

```bash
git add mobile/ .gitignore
git commit -m "feat: initialize Expo project for React Native mobile app"
```

---

### Task 2.2: Install Core Dependencies

**Files:**
- Modify: `mobile/package.json`

- [ ] **Step 1: Install NativeWind v4 + Tailwind**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen/mobile
npx expo install nativewind tailwindcss react-native-reanimated react-native-safe-area-context
```

- [ ] **Step 2: Install TanStack Query + Axios**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen/mobile
npm install @tanstack/react-query axios
```

- [ ] **Step 3: Install Expo modules**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen/mobile
npx expo install expo-secure-store expo-image-picker expo-camera expo-image expo-notifications expo-device expo-constants
```

- [ ] **Step 4: Install navigation dependencies**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen/mobile
npx expo install @react-navigation/drawer react-native-gesture-handler
```

- [ ] **Step 5: Install form + validation**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen/mobile
npm install react-hook-form @hookform/resolvers zod date-fns
```

- [ ] **Step 6: Commit**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen
git add mobile/package.json mobile/package-lock.json
git commit -m "feat: install core dependencies for mobile app"
```

---

### Task 2.3: Configure NativeWind

**Files:**
- Create: `mobile/tailwind.config.js`
- Create: `mobile/global.css`
- Modify: `mobile/babel.config.js`
- Modify: `mobile/metro.config.js`
- Modify: `mobile/app/_layout.tsx`

- [ ] **Step 1: Create tailwind.config.js**

Create `mobile/tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        accent: "#e94560",
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 2: Create global.css**

Create `mobile/global.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 3: Update babel.config.js**

Replace `mobile/babel.config.js`:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
```

- [ ] **Step 4: Update metro.config.js**

Create/replace `mobile/metro.config.js`:

```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
```

- [ ] **Step 5: Add global.css import to root layout**

In `mobile/app/_layout.tsx`, add at the top:

```tsx
import "../global.css";
```

- [ ] **Step 6: Create a test component to verify NativeWind works**

Create `mobile/app/(test)/nativewind-test.tsx`:

```tsx
import { View, Text } from "react-native";

export default function NativeWindTest() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-primary-600">
        NativeWind Works!
      </Text>
    </View>
  );
}
```

- [ ] **Step 7: Verify build compiles**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen/mobile
npx expo export --platform ios 2>&1 | tail -5
```

Expected: Build completes without NativeWind errors.

- [ ] **Step 8: Remove test file and commit**

```bash
rm mobile/app/\(test\)/nativewind-test.tsx
rmdir mobile/app/\(test\)
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen
git add mobile/
git commit -m "feat: configure NativeWind v4 with Tailwind CSS"
```

---

## Chunk 3: API Client & Auth Infrastructure

### Task 3.1: TypeScript Types

**Files:**
- Create: `mobile/types/user.ts`
- Create: `mobile/types/tool.ts`
- Create: `mobile/types/booking.ts`
- Create: `mobile/types/review.ts`
- Create: `mobile/types/notification.ts`
- Create: `mobile/types/api.ts`
- Create: `mobile/types/index.ts`

These types mirror the backend Pydantic schemas. Reference: `frontend/types/index.ts` for the existing contract, but keep independent.

- [ ] **Step 1: Create user types**

Create `mobile/types/user.ts`:

```typescript
export interface User {
  id: string;
  email: string;
  display_name: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  bio?: string;
  avatar_url?: string;
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
  location_visible?: boolean;
  profile_visible?: boolean;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}
```

- [ ] **Step 2: Create tool types**

Create `mobile/types/tool.ts`:

```typescript
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
```

- [ ] **Step 3: Create booking types**

Create `mobile/types/booking.ts`:

```typescript
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "active"
  | "returned"
  | "completed";

/** Matches backend UserBasic schema (booking responses use aliased fields). */
export interface BookingUser {
  id: string;
  username: string; // aliased from display_name
  full_name?: string;
  rating: number; // aliased from average_rating
  phone?: string; // aliased from phone_number
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
```

- [ ] **Step 4: Create review types**

Create `mobile/types/review.ts`:

```typescript
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
```

- [ ] **Step 5: Create notification types**

Create `mobile/types/notification.ts`:

```typescript
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
```

- [ ] **Step 6: Create API response types and barrel export**

Create `mobile/types/api.ts`:

```typescript
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
```

Create `mobile/types/index.ts`:

```typescript
export * from "./user";
export * from "./tool";
export * from "./booking";
export * from "./review";
export * from "./notification";
export * from "./api";
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen/mobile
npx tsc --noEmit --pretty 2>&1 | tail -10
```

- [ ] **Step 8: Commit**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen
git add mobile/types/
git commit -m "feat: add TypeScript types matching backend API schemas"
```

---

### Task 3.2: Constants & Configuration

**Files:**
- Create: `mobile/constants/config.ts`
- Create: `mobile/constants/colors.ts`
- Create: `mobile/constants/queryKeys.ts`

- [ ] **Step 1: Create config**

Create `mobile/constants/config.ts`:

```typescript
const ENV = {
  development: {
    API_URL: "http://localhost:8000/api/v1",
  },
  staging: {
    API_URL: "https://api.wippestoolen.de/api/v1",
  },
  production: {
    API_URL: "https://api.wippestoolen.de/api/v1",
  },
};

const environment = (process.env.EXPO_PUBLIC_ENV || "development") as keyof typeof ENV;

export const config = {
  ...ENV[environment],
  environment,
  tokenRefreshThreshold: 5 * 60, // Refresh token 5 min before expiry
};
```

- [ ] **Step 2: Create colors**

Create `mobile/constants/colors.ts`:

```typescript
export const colors = {
  primary: {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6",
    600: "#2563eb",
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
  },
  accent: "#e94560",
  gray: {
    50: "#f9fafb",
    100: "#f3f4f6",
    200: "#e5e7eb",
    300: "#d1d5db",
    400: "#9ca3af",
    500: "#6b7280",
    600: "#4b5563",
    700: "#374151",
    800: "#1f2937",
    900: "#111827",
  },
  success: "#22c55e",
  warning: "#f59e0b",
  error: "#ef4444",
  white: "#ffffff",
  black: "#000000",
} as const;
```

- [ ] **Step 3: Create query keys factory**

Create `mobile/constants/queryKeys.ts`:

```typescript
export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  tools: {
    all: ["tools"] as const,
    list: (params?: Record<string, unknown>) => ["tools", "list", params] as const,
    detail: (id: string) => ["tools", "detail", id] as const,
    myTools: (params?: Record<string, unknown>) => ["tools", "my", params] as const,
    categories: ["tools", "categories"] as const,
    categoryTools: (categoryId: number, params?: Record<string, unknown>) =>
      ["tools", "category", categoryId, params] as const,
  },
  bookings: {
    all: ["bookings"] as const,
    list: (params?: Record<string, unknown>) => ["bookings", "list", params] as const,
    detail: (id: string) => ["bookings", "detail", id] as const,
    calendar: (params?: Record<string, unknown>) => ["bookings", "calendar", params] as const,
    toolAvailability: (toolId: string, params?: Record<string, unknown>) =>
      ["bookings", "availability", toolId, params] as const,
  },
  reviews: {
    all: ["reviews"] as const,
    forUser: (userId: string) => ["reviews", "user", userId] as const,
    forTool: (toolId: string) => ["reviews", "tool", toolId] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: (params?: Record<string, unknown>) => ["notifications", "list", params] as const,
    unreadCount: ["notifications", "unread-count"] as const,
  },
} as const;
```

- [ ] **Step 4: Commit**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen
git add mobile/constants/
git commit -m "feat: add app configuration, colors, and query key factory"
```

---

### Task 3.3: Auth Token Storage (SecureStore)

**Files:**
- Create: `mobile/lib/auth.ts`

- [ ] **Step 1: Create auth token management module**

Create `mobile/lib/auth.ts`:

```typescript
import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "wippestoolen_access_token";
const REFRESH_TOKEN_KEY = "wippestoolen_refresh_token";

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen
git add mobile/lib/auth.ts
git commit -m "feat: add SecureStore token management"
```

---

### Task 3.4: Axios API Client with Auth Interceptor

**Files:**
- Create: `mobile/lib/api.ts`

- [ ] **Step 1: Create API client**

Create `mobile/lib/api.ts`:

```typescript
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { config } from "../constants/config";
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "./auth";
import { TokenResponse } from "../types";

const api = axios.create({
  baseURL: config.API_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: attach Bearer token
api.interceptors.request.use(
  async (reqConfig: InternalAxiosRequestConfig) => {
    const token = await getAccessToken();
    if (token) {
      reqConfig.headers.Authorization = `Bearer ${token}`;
    }
    return reqConfig;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 with token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        throw new Error("No refresh token");
      }

      const { data } = await axios.post<TokenResponse>(
        `${config.API_URL}/auth/refresh`,
        { refresh_token: refreshToken }
      );

      await setTokens(data.access_token, data.refresh_token);
      processQueue(null, data.access_token);

      originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      await clearTokens();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
```

- [ ] **Step 2: Commit**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen
git add mobile/lib/api.ts
git commit -m "feat: add Axios API client with Bearer auth and token refresh"
```

---

### Task 3.5: TanStack Query Client

**Files:**
- Create: `mobile/lib/queryClient.ts`

- [ ] **Step 1: Create query client config**

Create `mobile/lib/queryClient.ts`:

```typescript
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: 2,
      refetchOnWindowFocus: false, // Not relevant for mobile, but explicit
    },
    mutations: {
      retry: 1,
    },
  },
});
```

- [ ] **Step 2: Commit**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen
git add mobile/lib/queryClient.ts
git commit -m "feat: add TanStack Query client configuration"
```

---

### Task 3.6: Auth Context & Provider

**Files:**
- Create: `mobile/contexts/AuthContext.tsx`

- [ ] **Step 1: Create AuthContext**

Create `mobile/contexts/AuthContext.tsx`:

```tsx
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, useSegments } from "expo-router";
import api from "../lib/api";
import { getAccessToken, setTokens, clearTokens } from "../lib/auth";
import type { User, LoginRequest, RegisterRequest, AuthResponse, UpdateProfileRequest } from "../types";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: UpdateProfileRequest) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const router = useRouter();
  const segments = useSegments();

  // Check for existing token on mount
  useEffect(() => {
    async function loadUser() {
      try {
        const token = await getAccessToken();
        if (token) {
          const { data } = await api.get<User>("/auth/me");
          setState({ user: data, isLoading: false, isAuthenticated: true });
        } else {
          setState({ user: null, isLoading: false, isAuthenticated: false });
        }
      } catch {
        await clearTokens();
        setState({ user: null, isLoading: false, isAuthenticated: false });
      }
    }
    loadUser();
  }, []);

  // Redirect based on auth state
  useEffect(() => {
    if (state.isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!state.isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (state.isAuthenticated && inAuthGroup) {
      router.replace("/(drawer)/(tabs)/");
    }
  }, [state.isAuthenticated, state.isLoading, segments]);

  const login = useCallback(async (data: LoginRequest) => {
    const { data: response } = await api.post<AuthResponse>("/auth/login", data);
    await setTokens(response.access_token, response.refresh_token);
    setState({ user: response.user, isLoading: false, isAuthenticated: true });
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    const { data: response } = await api.post<AuthResponse>("/auth/register", data);
    await setTokens(response.access_token, response.refresh_token);
    setState({ user: response.user, isLoading: false, isAuthenticated: true });
  }, []);

  const logout = useCallback(async () => {
    await clearTokens();
    setState({ user: null, isLoading: false, isAuthenticated: false });
  }, []);

  const updateProfile = useCallback(async (data: UpdateProfileRequest) => {
    const { data: updatedUser } = await api.put<User>("/auth/me", data);
    setState((prev) => ({ ...prev, user: updatedUser }));
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await api.get<User>("/auth/me");
    setState((prev) => ({ ...prev, user: data }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, updateProfile, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen
git add mobile/contexts/
git commit -m "feat: add AuthContext with login, register, logout, and auto-redirect"
```

---

## Chunk 4: Navigation & Layout

### Task 4.1: Root Layout with Providers

**Files:**
- Modify: `mobile/app/_layout.tsx`

- [ ] **Step 1: Replace root layout**

Replace `mobile/app/_layout.tsx`:

```tsx
import "../global.css";
import { useEffect } from "react";
import { Slot, SplashScreen } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { queryClient } from "../lib/queryClient";
import { AuthProvider } from "../contexts/AuthContext";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Slot />
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen
git add mobile/app/_layout.tsx
git commit -m "feat: set up root layout with QueryClient, Auth, and GestureHandler providers"
```

---

### Task 4.2: Auth Screens (Login & Register)

**Files:**
- Create: `mobile/app/(auth)/_layout.tsx`
- Create: `mobile/app/(auth)/login.tsx`
- Create: `mobile/app/(auth)/register.tsx`
- Create: `mobile/components/ui/Button.tsx`
- Create: `mobile/components/ui/Input.tsx`

- [ ] **Step 1: Create UI base components**

Create `mobile/components/ui/Button.tsx`:

```tsx
import { TouchableOpacity, Text, ActivityIndicator } from "react-native";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline";
  isLoading?: boolean;
  disabled?: boolean;
}

export function Button({ title, onPress, variant = "primary", isLoading, disabled }: ButtonProps) {
  const baseClass = "py-3 px-6 rounded-lg items-center justify-center flex-row";
  const variantClass = {
    primary: "bg-primary-600",
    secondary: "bg-gray-600",
    outline: "border border-primary-600 bg-transparent",
  }[variant];
  const textClass = {
    primary: "text-white font-semibold text-base",
    secondary: "text-white font-semibold text-base",
    outline: "text-primary-600 font-semibold text-base",
  }[variant];
  const disabledClass = disabled || isLoading ? "opacity-50" : "";

  return (
    <TouchableOpacity
      className={`${baseClass} ${variantClass} ${disabledClass}`}
      onPress={onPress}
      disabled={disabled || isLoading}
      activeOpacity={0.7}
    >
      {isLoading && <ActivityIndicator color="white" className="mr-2" />}
      <Text className={textClass}>{title}</Text>
    </TouchableOpacity>
  );
}
```

Create `mobile/components/ui/Input.tsx`:

```tsx
import { View, Text, TextInput, TextInputProps } from "react-native";

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
}

export function Input({ label, error, ...props }: InputProps) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-700 mb-1">{label}</Text>
      <TextInput
        className={`border rounded-lg px-4 py-3 text-base bg-white ${
          error ? "border-red-500" : "border-gray-300"
        }`}
        placeholderTextColor="#9ca3af"
        {...props}
      />
      {error && <Text className="text-red-500 text-sm mt-1">{error}</Text>}
    </View>
  );
}
```

- [ ] **Step 2: Create auth layout**

Create `mobile/app/(auth)/_layout.tsx`:

```tsx
import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
```

- [ ] **Step 3: Create login screen**

Create `mobile/app/(auth)/login.tsx`:

```tsx
import { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Alert } from "react-native";
import { Link } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Fehler", "Bitte E-Mail und Passwort eingeben.");
      return;
    }
    setIsLoading(true);
    try {
      await login({ email: email.trim(), password });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Login fehlgeschlagen. Bitte versuche es erneut.";
      Alert.alert("Login fehlgeschlagen", message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
    >
      <ScrollView contentContainerClassName="flex-1 justify-center px-6">
        <View className="mb-8">
          <Text className="text-3xl font-bold text-gray-900 text-center">Wippestoolen</Text>
          <Text className="text-base text-gray-500 text-center mt-2">
            Werkzeuge aus der Nachbarschaft
          </Text>
        </View>

        <Input
          label="E-Mail"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          placeholder="name@beispiel.de"
        />

        <Input
          label="Passwort"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          placeholder="Passwort eingeben"
        />

        <Button title="Anmelden" onPress={handleLogin} isLoading={isLoading} />

        <View className="mt-6 flex-row justify-center">
          <Text className="text-gray-500">Noch kein Konto? </Text>
          <Link href="/(auth)/register" className="text-primary-600 font-semibold">
            Registrieren
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Step 4: Create register screen**

Create `mobile/app/(auth)/register.tsx`:

```tsx
import { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Alert } from "react-native";
import { Link } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

export default function RegisterScreen() {
  const { register } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleRegister() {
    if (!displayName.trim() || !email.trim() || !password) {
      Alert.alert("Fehler", "Bitte alle Pflichtfelder ausfüllen.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Fehler", "Passwörter stimmen nicht überein.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Fehler", "Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    setIsLoading(true);
    try {
      await register({
        email: email.trim(),
        password,
        display_name: displayName.trim(),
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Registrierung fehlgeschlagen. Bitte versuche es erneut.";
      Alert.alert("Registrierung fehlgeschlagen", message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
    >
      <ScrollView contentContainerClassName="flex-1 justify-center px-6">
        <View className="mb-8">
          <Text className="text-3xl font-bold text-gray-900 text-center">Registrieren</Text>
          <Text className="text-base text-gray-500 text-center mt-2">
            Erstelle dein Wippestoolen-Konto
          </Text>
        </View>

        <Input
          label="Anzeigename *"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          placeholder="Dein Name"
        />

        <Input
          label="E-Mail *"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          placeholder="name@beispiel.de"
        />

        <Input
          label="Passwort *"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Mind. 8 Zeichen"
        />

        <Input
          label="Passwort bestätigen *"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder="Passwort wiederholen"
        />

        <Button title="Konto erstellen" onPress={handleRegister} isLoading={isLoading} />

        <View className="mt-6 flex-row justify-center">
          <Text className="text-gray-500">Bereits ein Konto? </Text>
          <Link href="/(auth)/login" className="text-primary-600 font-semibold">
            Anmelden
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Step 5: Commit**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen
git add mobile/app/\(auth\)/ mobile/components/ui/
git commit -m "feat: add login and register screens with UI base components"
```

---

### Task 4.3: Tab + Drawer Navigation

**Files:**
- Create: `mobile/app/(drawer)/_layout.tsx`
- Create: `mobile/app/(drawer)/(tabs)/_layout.tsx`
- Create: `mobile/app/(drawer)/(tabs)/index.tsx` (placeholder)
- Create: `mobile/app/(drawer)/(tabs)/search.tsx` (placeholder)
- Create: `mobile/app/(drawer)/(tabs)/create.tsx` (placeholder)
- Create: `mobile/app/(drawer)/(tabs)/profile.tsx` (placeholder)
- Create: `mobile/components/layout/DrawerContent.tsx`

- [ ] **Step 1: Create DrawerContent component**

Create `mobile/components/layout/DrawerContent.tsx`:

```tsx
import { View, Text, TouchableOpacity } from "react-native";
import { DrawerContentScrollView, DrawerContentComponentProps } from "@react-navigation/drawer";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";

export function DrawerContent(props: DrawerContentComponentProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const menuItems = [
    { label: "Benachrichtigungen", icon: "🔔", route: "/notifications" },
    { label: "Meine Werkzeuge", icon: "🔧", route: "/my-tools" },
    { label: "Meine Buchungen", icon: "📋", route: "/my-bookings" },
    { label: "Einstellungen", icon: "⚙️", route: "/settings" },
  ];

  return (
    <DrawerContentScrollView {...props} className="bg-white">
      {/* User profile header */}
      <View className="px-4 py-6 border-b border-gray-200">
        <View className="w-14 h-14 bg-primary-100 rounded-full items-center justify-center mb-3">
          <Text className="text-xl font-bold text-primary-600">
            {user?.display_name?.charAt(0)?.toUpperCase() || "?"}
          </Text>
        </View>
        <Text className="text-lg font-semibold text-gray-900">{user?.display_name}</Text>
        <Text className="text-sm text-gray-500">{user?.email}</Text>
        {user?.average_rating !== undefined && user.average_rating > 0 && (
          <Text className="text-sm text-yellow-600 mt-1">
            ⭐ {user.average_rating.toFixed(1)} ({user.total_ratings})
          </Text>
        )}
      </View>

      {/* Menu items */}
      <View className="py-2">
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.route}
            className="flex-row items-center px-4 py-3"
            onPress={() => {
              router.push(item.route as never);
              props.navigation.closeDrawer();
            }}
          >
            <Text className="text-lg mr-3">{item.icon}</Text>
            <Text className="text-base text-gray-700">{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout */}
      <View className="border-t border-gray-200 mt-4 pt-2">
        <TouchableOpacity className="flex-row items-center px-4 py-3" onPress={logout}>
          <Text className="text-lg mr-3">🚪</Text>
          <Text className="text-base text-red-600">Abmelden</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
}
```

- [ ] **Step 2: Create drawer layout**

Create `mobile/app/(drawer)/_layout.tsx`:

```tsx
import { Drawer } from "expo-router/drawer";
import { DrawerContent } from "../../components/layout/DrawerContent";

export default function DrawerLayout() {
  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: "front",
        drawerStyle: { width: "75%" },
      }}
    >
      <Drawer.Screen name="(tabs)" options={{ title: "Home" }} />
    </Drawer>
  );
}
```

- [ ] **Step 3: Create tab layout**

Create `mobile/app/(drawer)/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "../../../constants/colors";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary[600],
        tabBarInactiveTintColor: colors.gray[400],
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.gray[200],
          paddingBottom: 4,
          height: 56,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
        headerStyle: {
          backgroundColor: colors.white,
        },
        headerTitleStyle: {
          fontWeight: "bold",
          color: colors.gray[900],
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Suche",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🔍</Text>,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "Anbieten",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>➕</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>👤</Text>,
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 4: Create placeholder tab screens**

Create `mobile/app/(drawer)/(tabs)/index.tsx`:

```tsx
import { View, Text } from "react-native";

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-gray-900">Home</Text>
      <Text className="text-gray-500 mt-2">Werkzeuge in deiner Nähe</Text>
    </View>
  );
}
```

Create `mobile/app/(drawer)/(tabs)/search.tsx`:

```tsx
import { View, Text } from "react-native";

export default function SearchScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-gray-900">Suche</Text>
      <Text className="text-gray-500 mt-2">Werkzeuge suchen und filtern</Text>
    </View>
  );
}
```

Create `mobile/app/(drawer)/(tabs)/create.tsx`:

```tsx
import { View, Text } from "react-native";

export default function CreateToolScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-gray-900">Werkzeug anbieten</Text>
      <Text className="text-gray-500 mt-2">Neues Werkzeug einstellen</Text>
    </View>
  );
}
```

Create `mobile/app/(drawer)/(tabs)/profile.tsx`:

```tsx
import { View, Text } from "react-native";
import { useAuth } from "../../../contexts/AuthContext";

export default function ProfileScreen() {
  const { user } = useAuth();

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-gray-900">Profil</Text>
      <Text className="text-gray-500 mt-2">{user?.display_name}</Text>
    </View>
  );
}
```

- [ ] **Step 5: Clean up default Expo files**

Remove any default screens/tabs that came with the template that conflict with our structure (e.g., `mobile/app/(tabs)/` if it exists alongside our `(drawer)/(tabs)/`).

- [ ] **Step 6: Verify build**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen/mobile
npx expo export --platform ios 2>&1 | tail -5
```

- [ ] **Step 7: Commit**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen
git add mobile/app/ mobile/components/layout/
git commit -m "feat: add tab + drawer navigation with placeholder screens"
```

---

## Chunk 5: Query Hooks & Tool Browsing

### Task 5.1: Tool Query Hooks

**Files:**
- Create: `mobile/hooks/useTools.ts`

- [ ] **Step 1: Create tool hooks**

Create `mobile/hooks/useTools.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { queryKeys } from "../constants/queryKeys";
import type {
  Tool,
  ToolListItem,
  ToolCreateRequest,
  ToolUpdateRequest,
  ToolCategoryWithCount,
} from "../types";
import type { PaginatedToolResponse } from "../types/api";

interface BrowseToolsParams {
  page?: number;
  page_size?: number;
  search?: string;
  category?: string;
  sort_by?: "created_at" | "daily_rate" | "rating" | "title";
  sort_order?: "asc" | "desc";
  available?: boolean;
}

export function useTools(params: BrowseToolsParams = {}) {
  return useQuery({
    queryKey: queryKeys.tools.list(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedToolResponse<ToolListItem>>("/tools", { params });
      return data;
    },
  });
}

export function useTool(id: string) {
  return useQuery({
    queryKey: queryKeys.tools.detail(id),
    queryFn: async () => {
      const { data } = await api.get<Tool>(`/tools/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useMyTools(params: { status_filter?: string; page?: number; page_size?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.tools.myTools(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Tool>>("/tools/my-tools", { params });
      return data;
    },
  });
}

export function useToolCategories() {
  return useQuery({
    queryKey: queryKeys.tools.categories,
    queryFn: async () => {
      const { data } = await api.get<ToolCategoryWithCount[]>("/tools/categories");
      return data;
    },
    staleTime: 1000 * 60 * 60, // Categories rarely change — 1 hour
  });
}

export function useCreateTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tool: ToolCreateRequest) => {
      const { data } = await api.post<Tool>("/tools", tool);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tools.all });
    },
  });
}

export function useUpdateTool(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tool: ToolUpdateRequest) => {
      const { data } = await api.put<Tool>(`/tools/${id}`, tool);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tools.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tools.all });
    },
  });
}

export function useDeleteTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tools/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tools.all });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen
git add mobile/hooks/useTools.ts
git commit -m "feat: add TanStack Query hooks for tool CRUD operations"
```

---

### Task 5.2: Tool Card & List Components

**Files:**
- Create: `mobile/components/tools/ToolCard.tsx`
- Create: `mobile/components/tools/CategoryChip.tsx`

- [ ] **Step 1: Create ToolCard**

Create `mobile/components/tools/ToolCard.tsx`:

```tsx
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import type { ToolListItem } from "../../types";

interface ToolCardProps {
  tool: ToolListItem;
}

export function ToolCard({ tool }: ToolCardProps) {
  const router = useRouter();

  return (
    <TouchableOpacity
      className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 mb-3"
      onPress={() => router.push(`/tool/${tool.id}`)}
      activeOpacity={0.7}
    >
      {/* Image */}
      <View className="h-40 bg-gray-100">
        {tool.primary_photo ? (
          <Image
            source={{ uri: tool.primary_photo.medium_url || tool.primary_photo.original_url }}
            className="w-full h-full"
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View className="w-full h-full items-center justify-center">
            <Text className="text-4xl">🔧</Text>
          </View>
        )}
        {/* Availability badge */}
        {!tool.is_available && (
          <View className="absolute top-2 right-2 bg-red-500 px-2 py-1 rounded">
            <Text className="text-white text-xs font-semibold">Verliehen</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View className="p-3">
        <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
          {tool.title}
        </Text>
        <View className="flex-row items-center justify-between mt-1">
          <Text className="text-sm text-gray-500">
            {tool.owner.display_name}
            {tool.pickup_city ? ` · ${tool.pickup_city}` : ""}
          </Text>
          {tool.average_rating != null && tool.average_rating > 0 && (
            <Text className="text-sm text-yellow-600">
              ⭐ {Number(tool.average_rating).toFixed(1)}
            </Text>
          )}
        </View>
        <View className="flex-row items-center justify-between mt-2">
          <Text className="text-xs text-gray-400">{tool.category.name}</Text>
          {Number(tool.daily_rate) > 0 && (
            <Text className="text-sm font-semibold text-primary-600">
              {Number(tool.daily_rate).toFixed(2)} €/Tag
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
```

- [ ] **Step 2: Create CategoryChip**

Create `mobile/components/tools/CategoryChip.tsx`:

```tsx
import { TouchableOpacity, Text } from "react-native";

interface CategoryChipProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
  count?: number;
}

export function CategoryChip({ label, isActive, onPress, count }: CategoryChipProps) {
  return (
    <TouchableOpacity
      className={`px-4 py-2 rounded-full mr-2 ${
        isActive ? "bg-primary-600" : "bg-gray-100"
      }`}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        className={`text-sm font-medium ${isActive ? "text-white" : "text-gray-700"}`}
      >
        {label}
        {count !== undefined && ` (${count})`}
      </Text>
    </TouchableOpacity>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen
git add mobile/components/tools/
git commit -m "feat: add ToolCard and CategoryChip components"
```

---

### Task 5.3: Home Screen Implementation

**Files:**
- Modify: `mobile/app/(drawer)/(tabs)/index.tsx`

- [ ] **Step 1: Implement home screen with tool feed**

Replace `mobile/app/(drawer)/(tabs)/index.tsx`:

```tsx
import { useState, useCallback } from "react";
import { View, Text, FlatList, RefreshControl, TouchableOpacity } from "react-native";
import { useNavigation } from "expo-router";
import { DrawerActions } from "@react-navigation/native";
import { useInfiniteQuery } from "@tanstack/react-query";
import api from "../../../lib/api";
import { useToolCategories } from "../../../hooks/useTools";
import { ToolCard } from "../../../components/tools/ToolCard";
import { CategoryChip } from "../../../components/tools/CategoryChip";
import { queryKeys } from "../../../constants/queryKeys";
import type { ToolListItem } from "../../../types";
import type { PaginatedToolResponse } from "../../../types/api";

export default function HomeScreen() {
  const navigation = useNavigation();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();

  const { data: categories } = useToolCategories();

  const {
    data,
    isLoading,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.tools.list({ category: selectedCategory, available: true }),
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get<PaginatedToolResponse<ToolListItem>>("/tools", {
        params: { page: pageParam, page_size: 20, category: selectedCategory, available: true },
      });
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.has_next ? lastPage.page + 1 : undefined),
  });

  const allTools = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 pt-14 pb-3 flex-row items-center justify-between border-b border-gray-100">
        <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
          <Text className="text-2xl">☰</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-primary-600">Wippestoolen</Text>
        <TouchableOpacity>
          <Text className="text-2xl">🔔</Text>
        </TouchableOpacity>
      </View>

      {/* Category filter */}
      {categories && (
        <View className="bg-white py-3 border-b border-gray-100">
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="px-4"
            data={[{ slug: undefined, name: "Alle", tool_count: undefined }, ...categories.map(c => ({ slug: c.slug, name: c.name, tool_count: c.tool_count }))]}
            keyExtractor={(item) => item.slug || "all"}
            renderItem={({ item }) => (
              <CategoryChip
                label={item.name}
                isActive={selectedCategory === item.slug}
                count={item.tool_count}
                onPress={() => setSelectedCategory(item.slug || undefined)}
              />
            )}
          />
        </View>
      )}

      {/* Tool list */}
      <FlatList
        data={allTools}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ToolCard tool={item} />}
        contentContainerClassName="p-4"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View className="items-center justify-center py-20">
              <Text className="text-4xl mb-4">🔍</Text>
              <Text className="text-lg font-medium text-gray-500">
                Keine Werkzeuge gefunden
              </Text>
            </View>
          )
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen
git add mobile/app/\(drawer\)/\(tabs\)/index.tsx
git commit -m "feat: implement home screen with tool feed, categories, and pull-to-refresh"
```

---

### Task 5.4: Tool Detail Screen

**Files:**
- Create: `mobile/app/tool/_layout.tsx`
- Create: `mobile/app/tool/[id].tsx`
- Create: `mobile/components/reviews/StarRating.tsx`

- [ ] **Step 0: Create layout files for nested route groups**

Expo Router requires `_layout.tsx` files for nested route groups. Create these Stack layouts:

Create `mobile/app/tool/_layout.tsx`:
```tsx
import { Stack } from "expo-router";

export default function ToolLayout() {
  return <Stack />;
}
```

Create `mobile/app/booking/_layout.tsx`:
```tsx
import { Stack } from "expo-router";

export default function BookingLayout() {
  return <Stack />;
}
```

Create `mobile/app/my-tools/_layout.tsx`:
```tsx
import { Stack } from "expo-router";

export default function MyToolsLayout() {
  return <Stack />;
}
```

- [ ] **Step 1: Create StarRating component**

Create `mobile/components/reviews/StarRating.tsx`:

```tsx
import { View, Text, TouchableOpacity } from "react-native";

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onRate?: (rating: number) => void;
}

export function StarRating({
  rating,
  maxStars = 5,
  size = "md",
  interactive = false,
  onRate,
}: StarRatingProps) {
  const starSize = { sm: "text-sm", md: "text-lg", lg: "text-2xl" }[size];

  return (
    <View className="flex-row">
      {Array.from({ length: maxStars }, (_, i) => {
        const filled = i < Math.round(rating);
        const Star = interactive ? TouchableOpacity : View;
        return (
          <Star
            key={i}
            onPress={interactive ? () => onRate?.(i + 1) : undefined}
            className="mr-0.5"
          >
            <Text className={`${starSize} ${filled ? "text-yellow-400" : "text-gray-300"}`}>
              ★
            </Text>
          </Star>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 2: Create tool detail screen**

Create `mobile/app/tool/[id].tsx`:

```tsx
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Image } from "expo-image";
import { useTool } from "../../hooks/useTools";
import { StarRating } from "../../components/reviews/StarRating";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../contexts/AuthContext";

export default function ToolDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data: tool, isLoading } = useTool(id);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!tool) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-500">Werkzeug nicht gefunden</Text>
      </View>
    );
  }

  const isOwner = user?.id === tool.owner.id;
  const primaryPhoto = tool.photos.find((p) => p.is_primary) || tool.photos[0];

  return (
    <>
      <Stack.Screen options={{ title: tool.title, headerBackTitle: "Zurück" }} />
      <ScrollView className="flex-1 bg-white">
        {/* Image */}
        <View className="h-64 bg-gray-100">
          {primaryPhoto ? (
            <Image
              source={{ uri: primaryPhoto.large_url || primaryPhoto.original_url }}
              className="w-full h-full"
              contentFit="cover"
            />
          ) : (
            <View className="w-full h-full items-center justify-center">
              <Text className="text-6xl">🔧</Text>
            </View>
          )}
        </View>

        <View className="p-4">
          {/* Title & price */}
          <View className="flex-row justify-between items-start">
            <View className="flex-1 mr-4">
              <Text className="text-2xl font-bold text-gray-900">{tool.title}</Text>
              <Text className="text-sm text-gray-500 mt-1">{tool.category.name}</Text>
            </View>
            {Number(tool.daily_rate) > 0 && (
              <View className="bg-primary-50 px-3 py-2 rounded-lg">
                <Text className="text-lg font-bold text-primary-600">
                  {Number(tool.daily_rate).toFixed(2)} €
                </Text>
                <Text className="text-xs text-primary-400 text-center">pro Tag</Text>
              </View>
            )}
          </View>

          {/* Rating */}
          {tool.average_rating != null && tool.total_ratings > 0 && (
            <View className="flex-row items-center mt-3">
              <StarRating rating={Number(tool.average_rating)} size="sm" />
              <Text className="text-sm text-gray-500 ml-2">
                ({tool.total_ratings} Bewertungen)
              </Text>
            </View>
          )}

          {/* Availability */}
          <View className={`mt-4 px-3 py-2 rounded-lg ${tool.is_available ? "bg-green-50" : "bg-red-50"}`}>
            <Text className={`text-sm font-medium ${tool.is_available ? "text-green-700" : "text-red-700"}`}>
              {tool.is_available ? "Verfügbar" : "Derzeit verliehen"}
            </Text>
          </View>

          {/* Description */}
          <View className="mt-4">
            <Text className="text-base font-semibold text-gray-900 mb-2">Beschreibung</Text>
            <Text className="text-sm text-gray-600 leading-5">{tool.description}</Text>
          </View>

          {/* Details */}
          <View className="mt-4 bg-gray-50 rounded-lg p-4">
            <Text className="text-base font-semibold text-gray-900 mb-3">Details</Text>
            {tool.brand && <DetailRow label="Marke" value={tool.brand} />}
            {tool.model && <DetailRow label="Modell" value={tool.model} />}
            <DetailRow label="Zustand" value={conditionLabel(tool.condition)} />
            <DetailRow label="Max. Leihdauer" value={`${tool.max_loan_days} Tage`} />
            {Number(tool.deposit_amount) > 0 && (
              <DetailRow label="Kaution" value={`${Number(tool.deposit_amount).toFixed(2)} €`} />
            )}
            {tool.delivery_available && (
              <DetailRow label="Lieferung" value={`Ja (${tool.delivery_radius_km} km)`} />
            )}
          </View>

          {/* Owner */}
          <View className="mt-4 flex-row items-center p-4 bg-gray-50 rounded-lg">
            <View className="w-12 h-12 bg-primary-100 rounded-full items-center justify-center">
              <Text className="text-lg font-bold text-primary-600">
                {tool.owner.display_name?.charAt(0)?.toUpperCase()}
              </Text>
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-base font-medium text-gray-900">{tool.owner.display_name}</Text>
              {tool.owner.average_rating != null && (
                <Text className="text-sm text-gray-500">
                  ⭐ {Number(tool.owner.average_rating).toFixed(1)} · {tool.owner.total_ratings} Bewertungen
                </Text>
              )}
            </View>
          </View>

          {/* Safety notes */}
          {tool.safety_notes && (
            <View className="mt-4 bg-yellow-50 p-4 rounded-lg">
              <Text className="text-base font-semibold text-yellow-800 mb-1">Sicherheitshinweise</Text>
              <Text className="text-sm text-yellow-700">{tool.safety_notes}</Text>
            </View>
          )}

          {/* Action button */}
          <View className="mt-6 mb-8">
            {isOwner ? (
              <Button
                title="Werkzeug bearbeiten"
                onPress={() => router.push(`/my-tools/${tool.id}/edit`)}
                variant="outline"
              />
            ) : tool.is_available ? (
              <Button
                title="Jetzt ausleihen"
                onPress={() => router.push(`/tool/${tool.id}/book`)}
              />
            ) : (
              <Button title="Derzeit nicht verfügbar" onPress={() => {}} disabled />
            )}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1.5">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className="text-sm text-gray-900 font-medium">{value}</Text>
    </View>
  );
}

function conditionLabel(condition: string): string {
  const labels: Record<string, string> = {
    excellent: "Ausgezeichnet",
    good: "Gut",
    fair: "Befriedigend",
    poor: "Mangelhaft",
  };
  return labels[condition] || condition;
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen
git add mobile/app/tool/ mobile/components/reviews/
git commit -m "feat: add tool detail screen with image, details, owner info, and booking CTA"
```

---

## Chunk 6: Search, Bookings, Reviews & Remaining Screens

### Task 6.1: Search Screen

**Files:**
- Modify: `mobile/app/(drawer)/(tabs)/search.tsx`

- [ ] **Step 1: Implement search screen with filters**

Replace `mobile/app/(drawer)/(tabs)/search.tsx` with a full search implementation including:
- Text search input with debounce
- Category filter chips (horizontal scroll)
- Availability toggle
- Sort options (newest, price, rating)
- FlatList with ToolCard results
- Pull-to-refresh

Use `useTools` hook with dynamic params from filter state. Debounce search text by 300ms using a `useEffect` + `setTimeout` pattern.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: implement search screen with text search, category filters, and sorting"
```

---

### Task 6.2: Booking Hooks & Create Booking Screen

**Files:**
- Create: `mobile/hooks/useBookings.ts`
- Create: `mobile/app/tool/[id]/book.tsx`

- [ ] **Step 1: Create booking hooks**

Create `mobile/hooks/useBookings.ts` with:
- `useBookings(params)` — list user's bookings (paginated)
- `useBooking(id)` — single booking detail
- `useToolAvailability(toolId, params)` — check tool availability
- `useCreateBooking()` — create mutation
- `useUpdateBookingStatus(id)` — status update mutation (confirm, decline, cancel, etc.)

All hooks follow the same pattern as `useTools.ts`, using `queryKeys.bookings.*`.

- [ ] **Step 2: Create booking form screen**

Create `mobile/app/tool/[id]/book.tsx` with:
- Date picker for start/end dates (use React Native's built-in DateTimePicker or a simple calendar)
- Message input field
- Pickup method selector
- Cost summary (daily_rate × days + deposit)
- Submit button calling `useCreateBooking`
- Success → navigate to booking detail

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add booking hooks and create booking screen with date picker"
```

---

### Task 6.3: My Bookings & Booking Detail Screens

**Files:**
- Create: `mobile/app/my-bookings.tsx`
- Create: `mobile/app/booking/[id].tsx`
- Create: `mobile/components/bookings/BookingCard.tsx`
- Create: `mobile/components/bookings/StatusBadge.tsx`

- [ ] **Step 1: Create StatusBadge component**

Maps booking status to colored badges with German labels:
- pending → "Angefragt" (yellow)
- confirmed → "Bestätigt" (blue)
- active → "Aktiv" (green)
- returned → "Zurückgegeben" (purple)
- completed → "Abgeschlossen" (gray)
- declined → "Abgelehnt" (red)
- cancelled → "Storniert" (red)

- [ ] **Step 2: Create BookingCard component**

Shows: tool title, dates, status badge, borrower/owner name, total amount.

- [ ] **Step 3: Create my-bookings screen**

Tab-based view: "Als Ausleiher" / "Als Verleiher" tabs, each showing a FlatList of BookingCards.

- [ ] **Step 4: Create booking detail screen**

Shows full booking info with action buttons based on status:
- Owner can: confirm, decline (when pending)
- Borrower can: cancel (when pending/confirmed)
- Either can: mark pickup (when confirmed), mark return (when active)
- Shows "Bewertung abgeben" button when completed

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add booking management screens with status workflow actions"
```

---

### Task 6.4: Review Hooks & Screens

**Files:**
- Create: `mobile/hooks/useReviews.ts`
- Create: `mobile/app/booking/[id]/review.tsx`
- Create: `mobile/components/reviews/ReviewCard.tsx`

- [ ] **Step 1: Create review hooks**

Create `mobile/hooks/useReviews.ts` with:
- `useUserReviews(userId)` — reviews for a user
- `useToolReviews(toolId)` — reviews for a tool
- `useCreateReview()` — create mutation

- [ ] **Step 2: Create review form screen**

`mobile/app/booking/[id]/review.tsx`:
- Interactive StarRating for overall rating
- Optional StarRating for tool condition
- Title input (optional)
- Comment textarea
- Submit button

- [ ] **Step 3: Create ReviewCard component**

Shows: reviewer name, star rating, comment, date.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add review system with star ratings and review cards"
```

---

### Task 6.5: Notification Hooks & Screen

**Files:**
- Create: `mobile/hooks/useNotifications.ts`
- Create: `mobile/app/notifications.tsx`

- [ ] **Step 1: Create notification hooks**

- `useNotifications(params)` — paginated notification list
- `useUnreadCount()` — unread notification count
- `useMarkAsRead()` — mark notification as read mutation
- `useMarkAllAsRead()` — mark all as read mutation

- [ ] **Step 2: Create notifications screen**

FlatList of notifications with:
- Unread indicator (blue dot)
- Tap to mark as read + navigate to related content
- "Alle als gelesen markieren" button in header

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add notification list screen with read/unread management"
```

---

### Task 6.6: Create Tool Screen & My Tools

**Files:**
- Modify: `mobile/app/(drawer)/(tabs)/create.tsx`
- Create: `mobile/app/my-tools/index.tsx`
- Create: `mobile/app/my-tools/[id]/edit.tsx`

- [ ] **Step 1: Implement create tool screen**

Form with:
- Title, description, category (picker), condition (picker)
- Brand, model (optional)
- Daily rate, deposit amount, max loan days
- Pickup address, city, postal code
- Delivery toggle + radius
- Usage instructions, safety notes (optional)
- Photo picker (placeholder — camera integration comes with photo upload backend)
- Submit button calling `useCreateTool`

- [ ] **Step 2: Implement my-tools screen**

FlatList of user's tools with edit/delete actions. Status filter tabs: Alle / Aktiv / Inaktiv.

- [ ] **Step 3: Implement edit tool screen**

Same form as create, pre-filled with existing data. Uses `useUpdateTool`.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add tool creation, editing, and my-tools management screens"
```

---

### Task 6.7: Profile Screen

**Files:**
- Modify: `mobile/app/(drawer)/(tabs)/profile.tsx`

- [ ] **Step 1: Implement profile screen**

Sections:
- User avatar + name + rating
- Quick links: My Tools, My Bookings, Notifications
- Profile edit form (display name, bio, phone — uses `useAuth().updateProfile`)
- Statistics: total tools, total bookings, average rating
- Change password link → modal or separate screen

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: implement profile screen with stats and profile editing"
```

---

### Task 6.8: Settings Screen

**Files:**
- Create: `mobile/app/settings.tsx`

- [ ] **Step 1: Create minimal settings screen**

- Notification preferences toggle
- App version info
- Logout button
- Link to privacy policy / terms

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: add settings screen with notification preferences"
```

---

## Chunk 7: Backend — Photo Upload & Push Notifications

### Task 7.1: Photo Upload Endpoint

**Files:**
- Create: `wippestoolen/app/api/v1/endpoints/photos.py`
- Create: `wippestoolen/app/services/photo_service.py`
- Modify: `wippestoolen/app/api/v1/router.py` (register new router)
- Modify: `wippestoolen/app/api/v1/endpoints/tools.py` (load photos in responses)

- [ ] **Step 1: Write failing test for photo upload**

Create `wippestoolen/tests/test_photo_upload.py`:

```python
"""Test photo upload endpoint exists and accepts files."""

def test_photo_router_exists():
    from wippestoolen.app.api.v1.endpoints.photos import router
    routes = [r.path for r in router.routes if hasattr(r, "path")]
    assert "/tools/{tool_id}/photos" in routes or "/{tool_id}/photos" in routes
```

- [ ] **Step 2: Implement photo service**

Create `wippestoolen/app/services/photo_service.py`:
- `upload_photo(tool_id, file, user_id, db)` — validates ownership, uploads to S3, creates ToolPhoto record
- `delete_photo(photo_id, user_id, db)` — validates ownership, deletes from S3, soft-deletes record
- Uses `boto3` (already in dependencies) for S3 operations
- Generates thumbnail/medium/large URLs (or defers resizing to a later task)

- [ ] **Step 3: Implement photo endpoints**

Create `wippestoolen/app/api/v1/endpoints/photos.py`:
- `POST /tools/{tool_id}/photos` — Upload photo (multipart, max 5MB, JPEG/PNG/WebP)
- `DELETE /tools/{tool_id}/photos/{photo_id}` — Delete photo (owner only)
- Rate limited: 10/minute

- [ ] **Step 4: Register router and fix tool responses**

Add photo router to `wippestoolen/app/api/v1/router.py`.

In `wippestoolen/app/api/v1/endpoints/tools.py`, replace hardcoded `photos=[]` with actual query to load tool photos from the `tool_photos` table.

- [ ] **Step 5: Run tests**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen
python -m pytest wippestoolen/tests/test_photo_upload.py -v
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: add photo upload/delete endpoints with S3 integration"
```

---

### Task 7.2: Push Notification Backend

**Files:**
- Create: `wippestoolen/app/models/push_token.py`
- Create: `wippestoolen/app/services/push_service.py`
- Modify: `wippestoolen/app/api/v1/endpoints/notifications.py` (add push token endpoints)
- Create: Alembic migration for `push_tokens` table

- [ ] **Step 1: Create push_tokens model**

```python
# Table: push_tokens
# Fields: id (UUID PK), user_id (FK users), token (str, unique), platform (ios/android),
#         device_name (optional), is_active (bool), created_at, updated_at
```

- [ ] **Step 2: Create migration**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen
alembic revision --autogenerate -m "add push_tokens table"
alembic upgrade head
```

- [ ] **Step 3: Create push service**

`wippestoolen/app/services/push_service.py`:
- `register_push_token(user_id, token, platform, device_name, db)`
- `unregister_push_token(user_id, token, db)`
- `send_push_notification(user_id, title, message, data, db)` — fetches user's push tokens, sends via Expo Push API (`https://exp.host/--/api/v2/push/send`)

- [ ] **Step 4: Add push token endpoints**

In notifications.py:
- `POST /notifications/push-token` — Register token
- `DELETE /notifications/push-token` — Unregister token

- [ ] **Step 5: Integrate push into notification creation**

When `NotificationService.create_notification()` is called, also trigger `push_service.send_push_notification()` for the recipient.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: add push notification support with Expo Push API integration"
```

---

## Chunk 8: Mobile Push Setup & Final Integration

### Task 8.1: Expo Push Notification Setup

**Files:**
- Create: `mobile/lib/notifications.ts`
- Modify: `mobile/app/_layout.tsx` (register for push on mount)

- [ ] **Step 1: Create push notification handler**

Create `mobile/lib/notifications.ts`:

```typescript
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import api from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenData.data;

  // Register token with backend
  await api.post("/notifications/push-token", {
    token,
    platform: Platform.OS,
    device_name: Device.modelName,
  });

  // Android notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  return token;
}

export async function unregisterPushNotifications(token: string): Promise<void> {
  await api.delete("/notifications/push-token", { data: { token } });
}
```

- [ ] **Step 2: Register in root layout**

Add push registration to `mobile/app/_layout.tsx` after auth loads.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add Expo push notification registration and handling"
```

---

### Task 8.2: Final Integration Verification

> **Note:** CORS configuration is NOT needed for React Native. Native apps don't go through a browser, so CORS doesn't apply. Expo Go also handles this transparently. Only add CORS origins if you encounter specific issues during development.

- [ ] **Step 1: Verify mobile app builds for iOS**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen/mobile
npx expo export --platform ios 2>&1 | tail -10
```

- [ ] **Step 2: Verify mobile app builds for Android**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen/mobile
npx expo export --platform android 2>&1 | tail -10
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen/mobile
npx tsc --noEmit
```

- [ ] **Step 4: Run backend tests**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen
python -m pytest wippestoolen/tests/ -v
```

- [ ] **Step 5: Commit any final fixes and tag**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen
git add -A
git commit -m "chore: final integration verification and fixes"
```

---

## Implementation Order Summary

| Phase | Chunks | Description |
|-------|--------|-------------|
| 1 | Chunk 1 | Backend bug fixes (pre-requisite) |
| 2 | Chunk 2 | Expo project scaffold + NativeWind |
| 3 | Chunk 3 | API client, auth, types, query client |
| 4 | Chunk 4 | Navigation layout + auth screens |
| 5 | Chunk 5 | Tool browsing (home, detail, hooks) |
| 6 | Chunk 6 | All remaining screens (search, bookings, reviews, profile) |
| 7 | Chunk 7 | Backend: photo upload + push notifications |
| 8 | Chunk 8 | Mobile push setup + final integration |

**Estimated tasks:** 25 tasks across 8 chunks.
**Each chunk produces a working, committable state.**
