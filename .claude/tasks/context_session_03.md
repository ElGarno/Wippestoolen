# Context Session 03 - React Native Mobile App

## Project Goal
Build a complete React Native (Expo) mobile app for Wippestoolen with full feature parity to the existing Next.js web frontend.

## Current Status
- **Phase**: Feature-complete MVP, polish & new features
- **Last Updated**: 2026-03-15
- **Branch**: `feature/react-native-app`
- **Backend**: Live on NAS at `https://api.wippestoolen.de/health`
- **Mobile App**: Running in Expo Go on physical device
- **Design**: Bold & Vibrant (orange-amber gradient, community-oriented)

## Design & Plan Documents
- **Spec**: `docs/superpowers/specs/2026-03-13-react-native-mobile-app-design.md`
- **Plan**: `docs/superpowers/plans/2026-03-13-react-native-mobile-app.md`
- **Design Mockups**: `.claude/doc/frontend/2026-03-15_home_screen_designs.md`
- **Design Preview**: `.claude/doc/frontend/design_preview.html`
- **Security Audit**: `.claude/doc/security/2026-03-15_public_repo_audit.md`
- **Backend Audit**: `.claude/doc/backend/2026-03-15_backend_audit.md`

## Tech Stack (Mobile)
- Expo SDK 54 (prebuild workflow)
- React Native with Expo Router (file-based routing)
- NativeWind v4 (Tailwind CSS for React Native) — design uses StyleSheet.create throughout
- TanStack Query v5 + Axios
- Expo SecureStore for auth tokens
- Expo Notifications for push (limited in Expo Go, needs dev build)
- expo-linear-gradient for gradient headers
- expo-image-picker for camera + gallery

## Tasks - Completed
- [x] Chunk 1-8: Full app implementation (auth, tools, bookings, reviews, notifications, profile)
- [x] NAS deployment (docker-compose, Cloudflare Tunnel, PostgreSQL)
- [x] Domain migration (Route53 → Cloudflare DNS)
- [x] Back navigation (root Stack + manual back buttons on all sub-screens)
- [x] Photo upload (gallery + camera, up to 5 per tool)
- [x] Photo URL fix (getPhotoUrl helper for relative → absolute URL conversion)
- [x] Bold & Vibrant redesign (23 screens + 8 components, orange-amber theme)
- [x] Security: Git history cleaned (bfg), .gitignore hardened
- [x] Security: JWT secret rotated
- [x] Backend audit: 35 findings identified and fixed
  - Critical: admin broadcast check, DDL endpoint removed, review stats restricted
  - High: SQL injection prevention (sort/update allowlists), exception logging
  - High: Missing description column in SQL queries, cross-join fix
  - Medium: float/Decimal fix, route ordering, transaction consistency
- [x] is_admin field added to User model + Alembic migration
- [x] My Tools endpoint working (description column fix + deploy)

## Known Issues / Remaining
- [ ] **Drawer disabled**: Temporarily replaced with `<Slot>` due to Worklets version mismatch in Expo Go
- [ ] **Push notifications**: Not functional in Expo Go — needs dev build
- [ ] **expo-image removed**: Replaced with React Native `Image` due to Node 25 incompatibility
- [ ] **Tool deletion from app**: Delete functionality exists in My Tools screen but needs testing
- [ ] **AI Foto-Analyse**: Planned feature — analyze tool photo to auto-fill form fields

## Next Up
- [ ] AI Foto-Analyse: Use Claude Vision API to analyze tool photos and auto-fill title, brand, model, category, condition

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

### 2026-03-15 — Milestone: Design Overhaul + Security + Backend Hardening
- Fixed back navigation: Root layout → Stack, manual back buttons on all sub-screens
- Added photo upload to Create Tool screen (gallery + camera via expo-image-picker)
- Security audit: scanned repo for leaked secrets in git history
  - Cleaned git history with bfg (terraform.tfstate, task-def.json, add_prod_categories.py)
  - Force-pushed all branches
  - Hardened .gitignore (.env.* glob pattern)
  - JWT secret rotated on NAS
- Complete Bold & Vibrant redesign:
  - Color system changed from blue to orange/amber (#E8470A / #F5A623)
  - expo-linear-gradient installed for gradient headers
  - All 23 screens + 8 components rewritten with new design
  - Category-colored accent stripes on tool cards
  - FAB button on home screen
  - Consistent warm community-oriented aesthetic
- Fixed photo URL display (getPhotoUrl helper for relative paths)
- Fixed route typo (/tools/ → /tool/)
- Fixed daily_rate.toFixed() crash (Number() wrapping)
- Backend audit with 35 findings:
  - 4 CRITICAL, 11 HIGH, 12 MEDIUM, 2 LOW issues fixed
  - SQL injection vectors closed (sort/update allowlists)
  - Silent exception swallowing replaced with proper logging
  - Admin checks added (broadcast, statistics, DDL endpoint removed)
  - SQL query fixes (missing description column, cross-join)
  - Review route ordering fixed (static paths before {review_id})
  - is_admin field + idempotent Alembic migration
  - Entrypoint made resilient (alembic stamp fallback)
- My Tools endpoint working after deploy with all fixes
- Repo is now public — all secrets cleaned from history

## Infrastructure
- **Backend**: Synology NAS via Portainer stack
  - `wippestoolen_postgres` (port 5435, user: wippestoolen)
  - `wippestoolen_api` (port 8092)
  - `wippestoolen_cloudflared` (Cloudflare Tunnel)
- **Redis**: Reusing dsrunde_redis (DB 1)
- **DNS**: Cloudflare (wippestoolen.de)
  - `api.wippestoolen.de` → Tunnel → NAS
  - `www.wippestoolen.de` → Vercel (frontend, not yet deployed)
- **Domain Registrar**: AWS Route53 (renewal Aug 2026)
- **Env vars in Portainer**: POSTGRES_PASSWORD, SECRET_KEY, CLOUDFLARE_TUNNEL_TOKEN
- **DB user**: wippestoolen (not wippestoolen_user)
- **Admin user**: faffi@gmx.de (is_admin = true)

## Architecture Decisions
- Backend already supports Bearer tokens (no auth changes needed)
- Distance-based search deferred to post-MVP
- Offline mutation queueing deferred to post-MVP
- Deep linking deferred to post-MVP
- Photos stored locally on NAS (not S3) — sufficient for low-traffic MVP
- Photos use primary_photo for list views, photos[] array for detail views
- Photo URLs are relative paths — getPhotoUrl() converts to absolute
- Booking pagination uses different shape than tools (bookings + nested pagination object)
- Bold & Vibrant design chosen over Clean & Minimal and Professional & Dense
- StyleSheet.create used throughout instead of NativeWind className strings
