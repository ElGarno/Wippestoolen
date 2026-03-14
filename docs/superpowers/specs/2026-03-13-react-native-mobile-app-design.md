# Wippestoolen React Native Mobile App — Design Spec

## Overview

Build a complete React Native mobile app for the Wippestoolen neighborhood tool-sharing platform. The app will have full feature parity with the existing Next.js web frontend, targeting both iOS and Android. It connects to the existing FastAPI backend (already in production).

**Branch**: `feature/react-native-app`
**Location**: `mobile/` directory in the monorepo

## Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Framework | Expo (prebuild workflow) | Best of both worlds: Expo tooling + full native control |
| Platforms | iOS + Android | Maximize neighbor reach |
| Routing | Expo Router (file-based) | Convention over configuration, similar to Next.js |
| Styling | NativeWind v4 (Tailwind CSS) | Team already knows Tailwind from web frontend |
| Server State | TanStack Query + Axios | Caching, background refetch, optimistic updates |
| Auth Storage | Expo SecureStore | Native Keychain (iOS) / Keystore (Android) |
| Push Notifications | Expo Notifications | Free, built-in APNs + FCM via Expo proxy |
| Navigation | Expo Router (on React Navigation) | Hybrid: 4 bottom tabs + drawer for secondary features |

## Navigation Architecture

### Bottom Tab Bar (4 tabs)
1. **Home** — Tool feed, categories, quick search
2. **Suche** — Advanced search with filters (category, distance, availability)
3. **Anbieten (+)** — Create new tool listing with camera integration
4. **Profil** — User profile, my tools, my bookings

### Drawer Menu (secondary)
- Benachrichtigungen (notifications)
- Einstellungen (settings)
- Hilfe / FAQ
- Abmelden (logout)

### Screen Hierarchy

```
(auth)/
  ├── login.tsx
  └── register.tsx

(drawer)/
  └── (tabs)/
      ├── index.tsx          # Home (tool feed)
      ├── search.tsx         # Search + filters
      ├── create.tsx         # Create tool listing
      └── profile.tsx        # User profile

tool/[id].tsx                # Tool detail
tool/[id]/book.tsx           # Create booking
booking/[id].tsx             # Booking detail
booking/[id]/review.tsx      # Write review
notifications.tsx            # Notification list
settings.tsx                 # App settings
my-tools.tsx                 # Manage own tools
my-tools/[id]/edit.tsx       # Edit tool
my-bookings.tsx              # Booking management
```

## Feature Parity Matrix

All features from the Next.js web app will be implemented:

| Feature | Web (Next.js) | Mobile (React Native) | Notes |
|---------|--------------|----------------------|-------|
| Login / Register | ✅ | 🎯 | Backend already supports Bearer tokens |
| User profile with ratings | ✅ | 🎯 | |
| Tool browsing (feed) | ✅ | 🎯 | Pull-to-refresh, infinite scroll |
| Search + filters | ✅ | 🎯 | Category, text, availability (distance deferred) |
| Tool detail page | ✅ | 🎯 | Image gallery with swipe |
| Create / edit tool | ✅ | 🎯 | Native camera + image picker |
| My tools management | ✅ | 🎯 | |
| Booking flow | ✅ | 🎯 | Date picker, status management |
| Booking management | ✅ | 🎯 | |
| Review system (1-5 stars) | ✅ | 🎯 | |
| Categories overview | ✅ | 🎯 | |
| In-app notifications | ✅ | 🎯 | + Push notifications (new) |

## Authentication Flow

### Backend Already Supports Bearer Tokens
The existing backend already uses `HTTPBearer()` for authentication and returns `access_token` + `refresh_token` in the login JSON response body (`AuthResponse` schema). **No auth changes needed.**

### Mobile: Bearer Token + SecureStore

1. User logs in → backend returns JWT in response body (already works)
2. Mobile app stores token in Expo SecureStore (encrypted native storage)
3. Axios interceptor adds `Authorization: Bearer <token>` header to all requests
4. Token refresh works the same way — new token stored in SecureStore
5. Logout clears SecureStore

## Backend Modifications

### 1. Fix Existing Bugs (Pre-requisite)

**WebSocket auth bug**: The notification WebSocket endpoint imports `decode_token` from `security.py`, but the module only exports `verify_token`. This must be fixed before real-time notifications can work in the mobile app.

**Booking route conflict**: `GET /bookings/{booking_id}` is defined before `GET /bookings/calendar`, causing "calendar" to be matched as a UUID parameter. The calendar route must be moved above the `{booking_id}` route.

### 2. Photo Upload Endpoint (New)
There is currently no file upload endpoint. The `photos` field in `ToolResponse` is hardcoded to `[]`. Required:
- `POST /api/v1/tools/{tool_id}/photos` — Upload tool photos (multipart form data → S3)
- `DELETE /api/v1/tools/{tool_id}/photos/{photo_id}` — Remove a photo
- New `tool_photos` database table/model (migration already exists: `27e841b4e154_add_tool_photos_table.py`)
- S3 integration for storage (boto3 already in dependencies)

### 3. Push Notification Support (New)
New endpoints and service:
- `POST /api/v1/notifications/push-token` — Register Expo push token for a user
- `DELETE /api/v1/notifications/push-token` — Unregister on logout
- Push notification trigger points:
  - Booking request created → notify tool owner
  - Booking confirmed/declined → notify borrower
  - Booking returned → notify both parties for review
  - Review posted → notify reviewee
- Implementation: synchronous in the request handler (Celery available for async if needed later)
- Multi-device support: store multiple push tokens per user (device registration table)

## Search Filter Scope

The backend `browse_tools` endpoint currently supports `search` (text) and `category` (slug) filters only.

**In scope for mobile MVP:**
- Category filter (already works)
- Text search (already works)
- Availability filter: show only tools where `is_available=true` (trivial backend addition)

**Deferred (post-MVP):**
- Distance-based search (requires PostGIS or bounding-box queries on lat/lng)
- Date-range availability filtering (requires cross-referencing bookings)

## Project Structure

```
mobile/
├── app/                        # Expo Router (file-based routing)
│   ├── _layout.tsx             # Root layout (drawer + auth gate)
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (drawer)/
│   │   ├── _layout.tsx         # Drawer layout
│   │   └── (tabs)/
│   │       ├── _layout.tsx     # Tab bar layout
│   │       ├── index.tsx       # Home
│   │       ├── search.tsx      # Search
│   │       ├── create.tsx      # Create tool
│   │       └── profile.tsx     # Profile
│   ├── tool/
│   │   ├── [id].tsx            # Tool detail
│   │   └── [id]/book.tsx       # Booking form
│   ├── booking/
│   │   ├── [id].tsx            # Booking detail
│   │   └── [id]/review.tsx     # Review form
│   ├── my-tools/
│   │   ├── index.tsx           # My tools list
│   │   └── [id]/edit.tsx       # Edit tool
│   ├── my-bookings.tsx         # My bookings
│   ├── notifications.tsx       # Notifications
│   └── settings.tsx            # Settings
├── components/
│   ├── ui/                     # Base components (Button, Input, Card, etc.)
│   ├── tools/                  # Tool-specific (ToolCard, ToolList, CategoryChip)
│   ├── bookings/               # Booking-specific (BookingCard, StatusBadge)
│   ├── reviews/                # Review-specific (StarRating, ReviewCard)
│   └── layout/                 # Layout components (Header, DrawerContent)
├── hooks/
│   ├── useAuth.ts              # Auth state + login/logout/register
│   ├── useTools.ts             # Tool queries (list, detail, create, update)
│   ├── useBookings.ts          # Booking queries
│   ├── useReviews.ts           # Review queries
│   ├── useNotifications.ts     # Notification queries + push setup
│   └── useCategories.ts        # Category queries
├── lib/
│   ├── api.ts                  # Axios instance with auth interceptor
│   ├── queryClient.ts          # TanStack Query client config
│   ├── auth.ts                 # SecureStore token management
│   ├── queryKeys.ts            # Centralized query key factory
│   └── utils.ts                # Shared utilities
├── contexts/
│   └── AuthContext.tsx          # Auth provider (wraps SecureStore + API)
├── types/
│   ├── tool.ts                 # Tool types (match backend schemas)
│   ├── booking.ts              # Booking types
│   ├── review.ts               # Review types
│   ├── user.ts                 # User types
│   └── notification.ts         # Notification types
├── constants/
│   ├── colors.ts               # Theme colors
│   └── config.ts               # API URL, app config
├── assets/                     # Static assets (icons, images)
├── app.json                    # Expo config
├── babel.config.js             # Babel + NativeWind
├── tailwind.config.js          # Tailwind config (matching web theme)
├── tsconfig.json               # TypeScript config
├── metro.config.js             # Metro bundler config
├── eas.json                    # EAS Build config
└── package.json
```

## Key Design Decisions

### Shared Types
TypeScript types in `mobile/types/` mirror the backend Pydantic schemas. These are NOT shared code with the web frontend (to keep the projects independent), but follow the same API contract.

### API Client
Single Axios instance in `lib/api.ts` with:
- Base URL from config (production: `https://api.wippestoolen.de`)
- Auth interceptor: reads token from SecureStore, adds Bearer header
- Response interceptor: handles 401 → redirect to login
- Token refresh logic on 401 responses

### Image Handling
- Tool photos: `expo-image-picker` for gallery + `expo-camera` for camera
- Image upload via multipart form data to new photo upload endpoint (see Backend Modifications #2)
- Image display: `expo-image` (optimized caching + progressive loading)

### Offline Behavior
TanStack Query provides automatic caching. The app will:
- Show cached data when offline (read-only)
- Show offline indicator in header
- Note: Offline mutation queueing (write-back) is deferred to post-MVP. TanStack Query's built-in cache handles read-only offline gracefully, but write queueing requires additional libraries and complexity.

### Navigation Clarification
Expo Router is the API surface (file-based routing), built on top of React Navigation. We use Expo Router's `<Tabs>` and `<Drawer>` components which wrap React Navigation under the hood.

### Deep Linking (Post-MVP)
Universal links (`wippestoolen.de/tool/abc` → mobile app `tool/[id]` screen) are important for sharing tools but deferred to post-MVP. Expo Router supports this with configuration in `app.json`.

### Development Workflow
- `npx expo start` — Development with Expo Go (limited) or dev client
- `npx expo prebuild` — Generate native projects
- `eas build` — Cloud builds for iOS/Android
- Cloudflare Tunnel available for testing against local backend from physical devices

## Cost Impact

| Item | Cost |
|------|------|
| Expo (free tier) | €0/month |
| EAS Build (free tier: 15 builds/month) | €0/month |
| Apple Developer Account | €99/year |
| Google Play Console | €25 one-time |
| Backend changes | €0 (same infrastructure) |
| **Total new cost** | **~€10/month amortized** |

## Success Criteria

1. All MVP features from the web app work in the mobile app
2. App runs on both iOS and Android simulators/devices
3. Authentication works with Bearer tokens (no breaking change to web)
4. Push notifications delivered for booking status changes
5. App can be built with EAS Build for both platforms
6. Performance: app launch < 2s, screen transitions < 300ms
