# Context Session 03 - React Native Mobile App

## Project Goal
Build a complete React Native (Expo) mobile app for Wippestoolen with full feature parity to the existing Next.js web frontend.

## Current Status
- **Phase**: Testing & Polish
- **Last Updated**: 2026-03-14
- **Branch**: `feature/react-native-app`
- **Backend**: Live on NAS at `https://api.wippestoolen.de/health`
- **Mobile App**: Running in Expo Go on physical device

## Design & Plan Documents
- **Spec**: `docs/superpowers/specs/2026-03-13-react-native-mobile-app-design.md`
- **Plan**: `docs/superpowers/plans/2026-03-13-react-native-mobile-app.md`

## Tech Stack (Mobile)
- Expo SDK 54 (prebuild workflow)
- React Native with Expo Router (file-based routing)
- NativeWind v4 (Tailwind CSS for React Native)
- TanStack Query v5 + Axios
- Expo SecureStore for auth tokens
- Expo Notifications for push (limited in Expo Go, needs dev build)

## Tasks
- [x] Chunk 1: Backend bug fixes (decode_token, route conflict, availability filter)
- [x] Chunk 2: Expo project scaffolding + NativeWind config
- [x] Chunk 3: TypeScript types, API client, auth infrastructure
- [x] Chunk 4: Navigation (Tab + Drawer) + auth screens
- [x] Chunk 5: Tool hooks + browsing screens (home, detail)
- [x] Chunk 6: All remaining screens (search, bookings, reviews, notifications, profile, settings)
- [x] Chunk 7: Backend photo upload (local storage) + push notifications
- [x] Chunk 8: Mobile push setup + final integration
- [x] NAS deployment (docker-compose, Cloudflare Tunnel, PostgreSQL)
- [x] Domain migration (Route53 → Cloudflare DNS)

## Known Issues (Next Session)
- [x] **Back navigation fixed**: Root layout changed from Slot to Stack, all sub-layouts styled with back button
- [x] **Tab bar behavior**: Tab bar hides on detail screens (standard mobile UX pattern, no change needed)
- [x] **Camera/Photo implemented**: expo-image-picker for gallery + camera, up to 5 photos per tool
- [ ] **Drawer disabled**: Temporarily replaced with `<Slot>` due to Worklets version mismatch in Expo Go — works with dev builds
- [ ] **Push notifications**: Not functional in Expo Go (Expo limitation) — needs dev build
- [ ] **expo-image removed**: Replaced with React Native `Image` due to Node 25 incompatibility

## Progress Log
### 2026-03-14
- Created design spec through collaborative brainstorming (with visual companion)
- Spec reviewed and corrected (auth already uses Bearer tokens, photo upload endpoint missing, etc.)
- Implementation plan written and reviewed (7 blocking issues fixed)
- Executed Chunks 1-8 via subagent-driven development
- 23 screen files created in mobile/app/
- All core features implemented: auth, tool browsing, search, bookings, reviews, notifications, profile
- Backend migrated from AWS ECS (~40 EUR/month) to Synology NAS (0 EUR/month)
- Domain wippestoolen.de moved from AWS Route53 to Cloudflare DNS
- Cloudflare Tunnel configured for api.wippestoolen.de
- Photo storage changed from S3 to local filesystem
- Alembic migration chain fixed (duplicate tool_photos migration removed)
- httpx dependency added for push notification service
- Expo SDK downgraded from 55 to 54 for Expo Go compatibility
- expo-image replaced with React Native Image (Node 25 type-stripping issue)
- react-native-worklets pinned to 0.5.1 for Expo Go compatibility
- App successfully running on physical iPhone via Expo Go tunnel

### 2026-03-15
- Fixed back navigation: Root layout changed from `<Slot />` to `<Stack screenOptions={{ headerShown: false }} />`
- Styled all sub-layouts (tool, booking, my-tools) with consistent headers, back button tint, and "Zurueck" label
- Tab bar hiding on detail screens confirmed as standard mobile UX (no fix needed)
- Added photo upload to Create Tool screen: gallery picker + camera capture via expo-image-picker
- Photos uploaded sequentially after tool creation via `POST /tools/{id}/photos` (multipart/form-data)
- Added `useUploadToolPhoto` hook for reuse in edit screen
- Max 5 photos per tool, with preview thumbnails and remove button
- TypeScript compiles clean

## Infrastructure
- **Backend**: Synology NAS via Portainer stack
  - `wippestoolen_postgres` (port 5435)
  - `wippestoolen_api` (port 8092)
  - `wippestoolen_cloudflared` (Cloudflare Tunnel)
- **Redis**: Reusing dsrunde_redis (DB 1)
- **DNS**: Cloudflare (wippestoolen.de)
  - `api.wippestoolen.de` → Tunnel → NAS
  - `www.wippestoolen.de` → Vercel (frontend, not yet deployed)
- **Domain Registrar**: AWS Route53 (renewal Aug 2026)
- **Env vars in Portainer**: POSTGRES_PASSWORD, SECRET_KEY, CLOUDFLARE_TUNNEL_TOKEN

## Architecture Decisions
- Backend already supports Bearer tokens (no auth changes needed)
- Distance-based search deferred to post-MVP
- Offline mutation queueing deferred to post-MVP
- Deep linking deferred to post-MVP
- Photos stored locally on NAS (not S3) — sufficient for low-traffic MVP
- Photos use primary_photo for list views, photos[] array for detail views
- Booking pagination uses different shape than tools (bookings + nested pagination object)
