# Context Session 03 - React Native Mobile App + Full Platform

## Project Goal
Build a complete React Native (Expo) mobile app for Wippestoolen with full feature parity, Bold & Vibrant design, AI features, and production-ready backend.

## Current Status
- **Phase**: Feature-rich MVP, testing & polish
- **Last Updated**: 2026-03-23 00:30
- **Branch**: `master` (feature/react-native-app merged)
- **Backend**: Live on Railway at `https://api.wippestoolen.de` (auto-deploy from master)
- **Mobile App**: Running in Expo Go on physical iPhone
- **Design**: Bold & Vibrant (orange-amber gradient, community-oriented)
- **Blockers**: None critical

## Design & Plan Documents
- **Spec**: `docs/superpowers/specs/2026-03-13-react-native-mobile-app-design.md`
- **Plan**: `docs/superpowers/plans/2026-03-13-react-native-mobile-app.md`
- **Design Mockups**: `.claude/doc/frontend/2026-03-15_home_screen_designs.md`
- **Design Preview**: `.claude/doc/frontend/design_preview.html`
- **Security Audit**: `.claude/doc/security/2026-03-15_public_repo_audit.md`
- **Backend Audit**: `.claude/doc/backend/2026-03-15_backend_audit.md`

## Tech Stack
### Mobile
- Expo SDK 54, React Native, Expo Router (file-based routing)
- StyleSheet.create throughout (no NativeWind className strings)
- TanStack Query v5 + Axios
- expo-linear-gradient, expo-image-picker, react-native-maps
- Expo SecureStore for auth tokens

### Backend
- FastAPI + SQLAlchemy (async) + PostgreSQL
- Anthropic Claude API (Sonnet 4) for AI photo analysis
- Jinja2 for notification templates
- Pillow + pillow-heif for image processing
- Deployed on Railway (auto-deploy from GitHub master branch)

## Completed Tasks
- [x] Full app implementation (auth, tools, bookings, reviews, notifications, profile)
- [x] NAS deployment (docker-compose, Cloudflare Tunnel, PostgreSQL)
- [x] Domain migration (Route53 → Cloudflare DNS)
- [x] Back navigation on all sub-screens (manual back buttons)
- [x] Photo upload (gallery + camera, up to 5 per tool)
- [x] Photo URL fix (getPhotoUrl helper for relative → absolute URL conversion)
- [x] Bold & Vibrant redesign (23 screens + 8 components)
- [x] Security: Git history cleaned (bfg), .gitignore hardened, JWT rotated
- [x] Backend audit: 35 findings fixed (SQL injection, auth, logging, etc.)
- [x] is_admin field + migration
- [x] AI Foto-Analyse with Claude Vision (Sonnet 4)
- [x] Map view with react-native-maps + OpenStreetMap
- [x] Geocoding for Attendorn area postal codes
- [x] Booking notifications (in-app, German templates)
- [x] Address fields in registration + profile edit
- [x] BookingUser type fix (username → display_name)
- [x] Borrower/Owner info display in booking detail
- [x] Availability calendar on tool detail screen
- [x] Booking creation fix (response parsing)
- [x] KeyboardAvoidingView on form screens
- [x] Booking action success alerts (confirm/decline/cancel/pickup)
- [x] Auto-complete returned → completed for reviews
- [x] Default pickup location Attendorn 57439
- [x] Pickup method: info text when no delivery option
- [x] notification_preferences table + migration
- [x] Notification model field fixes (data → action_data, channels → sent_in_app)
- [x] Notification templates translated to German
- [x] Mark-all-read endpoint URL fix (POST → PATCH /read-all)
- [x] related_booking_id in notifications for navigation
- [x] Merged feature branch into master
- [x] Railway + R2 migration: R2StorageService, photo_service refactored, config updated
- [x] railway.toml + Dockerfile + entrypoint updated for Railway deployment
- [x] docker-compose simplified for local dev, .env.railway.example created
- [x] StaticFiles mount removed, photos served from R2 CDN
- [x] Edit tool: photo management UI (add/remove photos for existing tools)
- [x] Reviews endpoint 404 fixed (frontend URL corrected)
- [x] Double-booking prevented (pending in conflict check + SELECT FOR UPDATE)
- [x] TrustedHostMiddleware removed (Railway handles host filtering)
- [x] Railway deployment live: healthcheck passing, DB connected, categories seeded
- [x] DNS cutover: api.wippestoolen.de → Railway Custom Domain
- [x] Map: tool locations fall back to owner address (COALESCE + create_tool fallback)

## Known Issues / Remaining
- [ ] **Push notifications**: Not functional in Expo Go — needs dev build (works with Apple Developer Account + production build)
- [ ] **Drawer disabled**: Temporarily replaced with Slot due to Worklets mismatch (Expo Go limitation, needs dev build)
- [x] **Doppelbuchung**: Fixed — pending bookings now included in conflict check + SELECT FOR UPDATE for race conditions
- [x] **Profile reviews endpoint**: Fixed — frontend URL corrected to match backend path

## Next Session Tasks
m- [ ] Test full app on Railway (register, create tool with photo, booking lifecycle)
- [ ] Verify R2 photo upload works end-to-end (assets.wippestoolen.de)
- [ ] Consider dev build / Apple Developer Account for push notifications + drawer
- [ ] Stop old NAS containers (Portainer → wippestoolen stack stoppen)
- [ ] Consider Pushover integration for real-time alerts
- [ ] Remove Vercel integration from GitHub repo settings

## Progress Log
### 2026-03-14
- Full app implementation (Chunks 1-8), NAS deployment, domain migration

### 2026-03-15 — Milestone: Design + Security + Backend Hardening
- Bold & Vibrant redesign (23 screens, 8 components)
- Security audit + git history cleanup + JWT rotation
- Backend audit: 35 findings fixed
- Photo upload + URL fix, Back navigation on all screens

### 2026-03-16/17 — Milestone: AI Features + Booking Flow + Notifications
- AI Foto-Analyse with Claude Vision (Sonnet 4)
- Map view with react-native-maps
- Geocoding, Availability calendar
- Booking flow fixes (response parsing, keyboard, success alerts, auto-complete)
- Address fields in registration + profile
- Notification system fully operational (German templates, mark-all-read, navigation)
- Multiple NAS deploys to fix production issues
- Merged all changes into master branch

### 2026-03-22 — Bugfixes + New Features
- Fixed reviews endpoint 404: frontend URL `/reviews/user/{id}` → `/reviews/users/{id}/reviews`
- Fixed tool reviews URL: `/reviews/tool/{id}` → `/reviews/tools/{id}/reviews`
- Fixed double-booking: added `pending` to conflict check status list
- Added SELECT FOR UPDATE on availability check (race condition protection)
- Calendar view now shows pending bookings too
- Map: tool locations now fall back to owner address via COALESCE in browse query
- Tool creation: auto-fills location from owner address when no pickup location set
- Edit tool: full photo management (add from gallery/camera, delete with confirmation)
- Added `useDeleteToolPhoto` hook
- Photo section shows existing photos with primary badge and X-to-delete buttons
- Railway + R2 migration implemented (7 commits)
- R2StorageService created (boto3 S3-compatible, same pattern as whisky-api)
- Photo service refactored: filesystem → R2 cloud storage
- railway.toml, Dockerfile, entrypoint updated for Railway deployment
- docker-compose simplified for local dev only
- Old AWS/email config fields removed, NAS env example deleted
- Spec: docs/superpowers/specs/2026-03-22-railway-r2-migration-design.md
- Plan: docs/superpowers/plans/2026-03-22-railway-r2-migration.md

### 2026-03-23 — Railway Live
- Railway deployment successful: healthcheck passing, DB connected
- TrustedHostMiddleware removed (caused 400 on Railway internal healthchecks)
- DNS cutover complete: api.wippestoolen.de → Railway Custom Domain
- ALLOWED_IMAGE_TYPES env var issue fixed (removed, using code defaults)
- Merged feature/react-native-app → master, pushed context updates

## Infrastructure
- **Backend**: Railway (auto-deploy from `master`)
  - Railway PostgreSQL plugin (DATABASE_URL auto-injected)
  - Cloudflare R2 for photo storage (bucket: wippestoolen-photos)
  - Custom Domain: api.wippestoolen.de
  - Assets: assets.wippestoolen.de (R2 Custom Domain)
- **Env vars**: DATABASE_URL, SECRET_KEY, ANTHROPIC_API_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL
- **Old NAS stack**: Still running but no longer serving traffic (can be stopped)
- **Users**: Fresh DB — need to re-register

## Architecture Decisions
- react-native-maps instead of WebView/Leaflet (Expo Go compatible)
- Claude Sonnet 4 for AI analysis (Haiku too inaccurate)
- Jinja2 for notification templates
- Booking auto-completes on return (no separate completed step)
- Default location: Attendorn 57439
- TrustedHostMiddleware removed (Railway handles host filtering externally)
- Photos stored in Cloudflare R2 (S3-compatible via boto3), public URL via R2 Custom Domain
- Backend deployed on Railway (auto-deploy from GitHub, Dockerfile builder)
- Railway PostgreSQL plugin for managed database