# App Store Preparation — Design Spec

## Goal

Prepare the Wippestoolen Expo app for Apple App Store submission: update app config, add EAS build profiles, create privacy policy page, and implement account deletion (Apple requirement since 2022).

## Scope

1. **app.json** — Store-ready configuration
2. **eas.json** — EAS Build profiles
3. **Account deletion** — Backend endpoint + mobile UI
4. **Privacy policy + Impressum** — Static HTML page

Drawer re-activation and push notification testing are explicitly OUT OF SCOPE — those require a Dev Build with Apple Developer Account.

---

## 1. app.json Update

Update `mobile/app.json`:

```json
{
  "expo": {
    "name": "Wippestoolen",
    "slug": "wippestoolen",
    "scheme": "wippestoolen",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "de.wippestoolen.app",
      "infoPlist": {
        "NSCameraUsageDescription": "Wippestoolen benötigt Zugriff auf die Kamera um Fotos von Werkzeugen aufzunehmen.",
        "NSPhotoLibraryUsageDescription": "Wippestoolen benötigt Zugriff auf deine Fotos um Werkzeugbilder hochzuladen.",
        "NSLocationWhenInUseUsageDescription": "Wippestoolen nutzt deinen Standort um Werkzeuge in deiner Nähe anzuzeigen."
      },
      "config": {
        "usesNonExemptEncryption": false
      }
    },
    "android": {
      "package": "de.wippestoolen.app",
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundImage": "./assets/android-icon-background.png",
        "monochromeImage": "./assets/android-icon-monochrome.png"
      },
      "predictiveBackGestureEnabled": false
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      "expo-image-picker",
      "expo-camera",
      [
        "expo-notifications",
        {
          "icon": "./assets/icon.png",
          "color": "#E8470A"
        }
      ]
    ],
    "extra": {
      "eas": {
        "projectId": "<set-after-eas-init>"
      }
    }
  }
}
```

Key changes from current:
- `name`: "mobile" → "Wippestoolen"
- `slug`: "mobile" → "wippestoolen"
- `ios.bundleIdentifier`: added
- `ios.infoPlist`: camera, photo library, location permissions (German)
- `ios.config.usesNonExemptEncryption`: false (avoids export compliance questions)
- `android.package`: added
- `plugins`: added expo-notifications, expo-image-picker, expo-camera
- `android.predictiveBackGestureEnabled`: preserved from current config
- `web.favicon`: preserved from current config
- `extra.eas.projectId`: placeholder, set after `eas init`

Note: Privacy policy URL is configured in App Store Connect during submission, not in app.json.

## 2. eas.json (new file)

Create `mobile/eas.json`:

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "faffi@gmx.de",
        "ascAppId": "<set-after-app-store-connect-setup>",
        "appleTeamId": "<set-after-developer-account>"
      }
    }
  }
}
```

Profiles:
- `development`: Dev Build with dev client, for local testing (replaces Expo Go)
- `preview`: Internal distribution for TestFlight-like testing
- `production`: App Store submission, auto-increments build number

## 3. Account Deletion

### Backend

**Endpoint:** `DELETE /auth/me`

- Requires current password in request body (security confirmation)
- Rate limited (3/hour to prevent abuse)
- Flow:
  1. Verify password
  2. Check for active bookings (status `active`) — if any exist, reject deletion with error "Bitte gib zuerst alle ausgeliehenen Werkzeuge zurueck."
  3. Cancel all `pending` and `confirmed` bookings (set status to `cancelled`)
  4. Notify affected booking counterparts (tool owner or borrower) about cancellation
  5. Soft-delete all user's tools (`is_active = false`, `deleted_at = now`)
  6. Delete tool photos from R2 for all user's tools
  7. Delete user avatar from R2 (if `avatar_url` is set)
  8. Anonymize user data:
     - `email` → `deleted_{uuid}@deleted.local` (must pass DB email CHECK constraint)
     - `display_name` → "Geloeschter Nutzer"
     - Clear: `first_name`, `last_name`, `phone_number`, `bio`, `address`, `street_address`, `city`, `postal_code`, `avatar_url`, `latitude`, `longitude`
     - `password_hash` → random non-verifiable string (GDPR data minimization)
  9. Set `is_active = false`, `deleted_at = now`, `data_retention_until = now + 30 days`
  10. Return 200 OK

Note: Hard-delete after 30 days (data_retention_until) is a follow-up task — requires a scheduled job (cron/Railway cron). For now, soft-delete + anonymization is sufficient for GDPR compliance.

**Schema:** `DeleteAccountRequest` with `password: str` field.

**Service method:** `AuthService.delete_account(user_id, password)` in `auth_service.py`

Why anonymize instead of hard delete: Reviews and booking history reference the user. Hard delete would break foreign keys or require cascade deletion of other users' data. Anonymization preserves data integrity while removing all personal information.

### Mobile

**Location:** Settings screen (`mobile/app/settings.tsx`) in a new "Gefahrenzone" section at the bottom.

**Flow:**
1. User taps "Account loeschen" button (red, destructive style)
2. Alert dialog: "Bist du sicher? Alle deine Daten, Werkzeuge und Buchungen werden unwiderruflich geloescht."
3. If confirmed: second dialog with password input
4. API call: `DELETE /auth/me` with `{ password }`
5. On success: clear tokens, navigate to login screen
6. On error: show error message (wrong password, etc.)

**AuthContext:** Add `deleteAccount(password: string)` method.

**Settings Datenschutz link:** Update the existing "Datenschutz" row in settings.tsx to open `https://api.wippestoolen.de/privacy` via `Linking.openURL()` instead of showing an inline Alert.

## 4. Privacy Policy + Impressum

Single HTML file with both Datenschutzerklaerung and Impressum.

**Hosting:** Upload to Cloudflare R2 bucket or create a simple Cloudflare Pages site for `wippestoolen.de`. Since R2 is already set up, simplest approach: upload `datenschutz.html` to the R2 bucket and make it accessible at `https://assets.wippestoolen.de/datenschutz.html` or set up a Cloudflare Pages redirect.

Alternative: Add a `/privacy` endpoint to the FastAPI backend that returns HTML. This is simpler and doesn't require additional infrastructure.

**Recommended:** Backend endpoint `/privacy` — no extra infrastructure needed, always in sync with the deployed version.

**Content (German, DSGVO-konform):**

- Verantwortlicher: Fabian Woerenkaemper, Wippeskuhlen 53, 57439 Attendorn, faffi@gmx.de
- Erhobene Daten: Name, E-Mail, Adresse, Telefon (optional), Standort, Fotos, Buchungshistorie
- Zweck: Betrieb der Werkzeugverleih-Plattform
- Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfuellung)
- Speicherort: Railway (EU Region), Cloudflare R2 (EU)
- Drittanbieter: Anthropic (AI-Fotoanalyse, optional), Cloudflare (CDN/DNS)
- Speicherdauer: Bis zur Account-Loeschung, danach 30 Tage Aufbewahrungsfrist
- Betroffenenrechte: Auskunft, Berichtigung, Loeschung, Einschraenkung, Datenportabilitaet, Widerspruch
- Account-Loeschung: In der App unter Einstellungen → "Account loeschen"
- Kontakt: faffi@gmx.de

**Privacy URL in app.json:** `https://api.wippestoolen.de/privacy`

## Out of Scope

- Drawer Navigation re-activation (needs Dev Build)
- Push Notification testing (needs Apple Developer Account)
- App Store screenshots and marketing metadata
- Google Play Store submission
- TestFlight build and testing
- Dark mode support
