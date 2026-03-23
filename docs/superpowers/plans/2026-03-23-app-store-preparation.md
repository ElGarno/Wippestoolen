# App Store Preparation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare the Wippestoolen app for Apple App Store submission — app config, EAS build profiles, account deletion, and privacy policy.

**Architecture:** Config-only changes to app.json/eas.json, new DELETE /auth/me backend endpoint with user anonymization, privacy policy as backend HTML endpoint, mobile UI for account deletion in settings screen.

**Tech Stack:** Expo (React Native), FastAPI, SQLAlchemy, Cloudflare R2

**Spec:** `docs/superpowers/specs/2026-03-23-app-store-preparation-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `mobile/app.json` | Modify | Bundle ID, permissions, plugins, app name |
| `mobile/eas.json` | Create | EAS Build profiles (dev, preview, production) |
| `wippestoolen/app/schemas/auth.py` | Modify | Add DeleteAccountRequest schema |
| `wippestoolen/app/services/auth_service.py` | Modify | Add delete_account() method |
| `wippestoolen/app/api/v1/endpoints/auth.py` | Modify | Add DELETE /auth/me endpoint |
| `wippestoolen/app/api/v1/endpoints/privacy.py` | Create | GET /privacy HTML endpoint |
| `wippestoolen/app/api/v1/api.py` | Modify | Register privacy router |
| `mobile/contexts/AuthContext.tsx` | Modify | Add deleteAccount() method |
| `mobile/app/settings.tsx` | Modify | Add delete button, fix Datenschutz link |
| `tests/test_account_deletion.py` | Create | Unit tests for account deletion |

---

### Task 1: app.json + eas.json — Store Configuration

**Files:**
- Modify: `mobile/app.json`
- Create: `mobile/eas.json`

- [ ] **Step 1: Update app.json**

Replace entire `mobile/app.json` with:

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

- [ ] **Step 2: Create eas.json**

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
        "appleId": "<set-after-developer-account>",
        "ascAppId": "<set-after-app-store-connect-setup>",
        "appleTeamId": "<set-after-developer-account>"
      }
    }
  }
}
```

- [ ] **Step 3: Verify Expo still starts**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen/mobile
npx expo config --type public 2>&1 | head -5
```

Expected: Shows config without errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/app.json mobile/eas.json
git commit -m "feat: update app.json for App Store, add EAS build profiles

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Backend — DeleteAccountRequest Schema

**Files:**
- Modify: `wippestoolen/app/schemas/auth.py`

- [ ] **Step 1: Add DeleteAccountRequest schema**

Add at the end of `wippestoolen/app/schemas/auth.py`:

```python
class DeleteAccountRequest(BaseModel):
    """Request to delete user account. Requires password confirmation."""

    password: str = Field(..., min_length=1, description="Current password for confirmation")
```

- [ ] **Step 2: Commit**

```bash
git add wippestoolen/app/schemas/auth.py
git commit -m "feat: add DeleteAccountRequest schema

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Backend — Account Deletion Service Method

**Files:**
- Modify: `wippestoolen/app/services/auth_service.py`
- Create: `tests/test_account_deletion.py`

- [ ] **Step 1: Write unit tests**

Create `tests/test_account_deletion.py`:

```python
"""Tests for account deletion service logic."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def test_anonymized_email_format():
    """Verify anonymized email passes typical email regex."""
    import re
    user_id = uuid.uuid4()
    email = f"deleted_{user_id}@deleted.local"
    pattern = r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    assert re.match(pattern, email), f"Email {email} does not match pattern"


def test_anonymized_email_uniqueness():
    """Each deletion produces a unique email."""
    emails = {f"deleted_{uuid.uuid4()}@deleted.local" for _ in range(100)}
    assert len(emails) == 100
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen
pytest tests/test_account_deletion.py -v --noconftest
```

Expected: 2 tests PASS

- [ ] **Step 3: Add delete_account method to AuthService**

Add these imports at the top of `wippestoolen/app/services/auth_service.py`:

```python
import logging
from sqlalchemy.orm import selectinload
from wippestoolen.app.models.tool import Tool, ToolPhoto
from wippestoolen.app.models.booking import Booking
from wippestoolen.app.services.storage import storage
```

Add `logger = logging.getLogger(__name__)` after imports.

Add this method to the `AuthService` class:

```python
    async def delete_account(self, user_id: UUID, password: str) -> bool:
        """Delete a user account: anonymize data, cancel bookings, remove photos."""

        # Get user and verify password
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise ValueError("User not found")

        if not verify_password(password, user.password_hash):
            raise ValueError("Invalid password")

        # Check for active bookings (tools currently borrowed)
        active_bookings = await self.db.execute(
            select(Booking).where(
                Booking.borrower_id == user_id,
                Booking.status == "active",
            )
        )
        if active_bookings.scalars().first():
            raise ValueError("Bitte gib zuerst alle ausgeliehenen Werkzeuge zurueck.")

        # Also check tools the user owns that are actively borrowed
        active_owner_bookings = await self.db.execute(
            select(Booking).join(Tool).where(
                Tool.owner_id == user_id,
                Booking.status == "active",
            )
        )
        if active_owner_bookings.scalars().first():
            raise ValueError("Es gibt noch aktive Ausleihen deiner Werkzeuge.")

        # Cancel pending/confirmed bookings
        pending_bookings = await self.db.execute(
            select(Booking).where(
                Booking.borrower_id == user_id,
                Booking.status.in_(["pending", "confirmed"]),
            )
        )
        for booking in pending_bookings.scalars().all():
            booking.status = "cancelled"

        owner_pending = await self.db.execute(
            select(Booking).join(Tool).where(
                Tool.owner_id == user_id,
                Booking.status.in_(["pending", "confirmed"]),
            )
        )
        for booking in owner_pending.scalars().all():
            booking.status = "cancelled"

        # Notify counterparts about cancelled bookings (best-effort)
        try:
            from wippestoolen.app.services.notification_service import NotificationService
            from wippestoolen.app.schemas.notification import (
                BookingNotificationEvent,
                NotificationType,
                NotificationPriority,
                NotificationChannel,
            )
            notification_service = NotificationService(self.db)

            # Re-query cancelled bookings involving this user
            all_cancelled = await self.db.execute(
                select(Booking).join(Tool).where(
                    Booking.status == "cancelled",
                    (Booking.borrower_id == user_id) | (Tool.owner_id == user_id),
                )
            )
            for booking in all_cancelled.scalars().all():
                # Notify the other party (not the user being deleted)
                recipient_id = booking.borrower_id if booking.borrower_id != user_id else None
                if recipient_id is None:
                    # User is the borrower — notify tool owner
                    tool_result = await self.db.execute(select(Tool).where(Tool.id == booking.tool_id))
                    tool = tool_result.scalar_one_or_none()
                    if tool:
                        recipient_id = tool.owner_id
                if recipient_id and recipient_id != user_id:
                    event = BookingNotificationEvent(
                        type=NotificationType.BOOKING_CANCELLED,
                        recipient_id=recipient_id,
                        context={"tool_title": "Werkzeug (Account geloescht)"},
                        priority=NotificationPriority.HIGH,
                        channels=[NotificationChannel.IN_APP],
                        booking_id=booking.id,
                        booking_status="cancelled",
                        tool_title="Werkzeug (Account geloescht)",
                    )
                    await notification_service.create_booking_notification(event)
        except Exception:
            logger.warning("Failed to send deletion notifications", exc_info=True)

        # Soft-delete all user's tools and delete photos from R2
        tools_result = await self.db.execute(
            select(Tool).options(selectinload(Tool.photos)).where(
                Tool.owner_id == user_id,
                Tool.is_active == True,  # noqa: E712
            )
        )
        for tool in tools_result.scalars().all():
            for photo in tool.photos:
                if photo.is_active:
                    key = storage.key_from_url(photo.original_url)
                    if key:
                        try:
                            storage.delete(key)
                        except Exception:
                            logger.warning("Failed to delete photo %s from R2", key)
                    photo.is_active = False
            tool.is_active = False
            tool.deleted_at = datetime.utcnow()

        # Delete avatar from R2
        if user.avatar_url:
            key = storage.key_from_url(user.avatar_url)
            if key:
                try:
                    storage.delete(key)
                except Exception:
                    logger.warning("Failed to delete avatar %s from R2", key)

        # Anonymize user data
        user.email = f"deleted_{user.id}@deleted.local"
        user.display_name = "Geloeschter Nutzer"
        user.first_name = None
        user.last_name = None
        user.phone_number = None
        user.bio = None
        user.address = None
        user.street_address = None
        user.city = None
        user.postal_code = None
        user.avatar_url = None
        user.latitude = None
        user.longitude = None
        user.password_hash = secrets.token_hex(32)
        user.is_active = False
        user.deleted_at = datetime.utcnow()
        user.data_retention_until = datetime.utcnow() + timedelta(days=30)

        await self.db.commit()
        return True
```

- [ ] **Step 4: Commit**

```bash
git add wippestoolen/app/services/auth_service.py tests/test_account_deletion.py
git commit -m "feat: add account deletion service with anonymization and R2 cleanup

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Backend — DELETE /auth/me Endpoint

**Files:**
- Modify: `wippestoolen/app/api/v1/endpoints/auth.py`

- [ ] **Step 1: Add the DELETE endpoint**

Add this import at the top of `auth.py`:

```python
from wippestoolen.app.schemas.auth import DeleteAccountRequest
```

Add this endpoint after the existing `change_password` endpoint:

```python
@router.delete("/me", status_code=status.HTTP_200_OK)
@limiter.limit("3/hour")
async def delete_account(
    request: Request,
    delete_data: DeleteAccountRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Permanently delete user account.

    Requires password confirmation. Cancels all pending/confirmed bookings,
    removes photos from storage, and anonymizes all personal data.
    Active bookings (tools currently borrowed) must be resolved first.
    """
    auth_service = AuthService(db)
    try:
        await auth_service.delete_account(current_user.id, delete_data.password)
        return {"message": "Account successfully deleted"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
```

- [ ] **Step 2: Verify endpoint is accessible**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen
python -c "from wippestoolen.app.api.v1.endpoints.auth import router; print([r.path for r in router.routes])"
```

Expected: List includes `/me` with DELETE method.

- [ ] **Step 3: Commit**

```bash
git add wippestoolen/app/api/v1/endpoints/auth.py
git commit -m "feat: add DELETE /auth/me endpoint for account deletion

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Backend — Privacy Policy Endpoint

**Files:**
- Create: `wippestoolen/app/api/v1/endpoints/privacy.py`
- Modify: `wippestoolen/app/api/v1/api.py`

- [ ] **Step 1: Create privacy endpoint**

Create `wippestoolen/app/api/v1/endpoints/privacy.py`:

```python
"""Privacy policy and legal information endpoints."""

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["legal"])

PRIVACY_HTML = """<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Datenschutzerklaerung — Wippestoolen</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.6; }
  h1 { color: #E8470A; font-size: 1.5em; }
  h2 { color: #444; font-size: 1.2em; margin-top: 1.5em; }
  a { color: #E8470A; }
</style>
</head>
<body>
<h1>Datenschutzerklaerung</h1>
<p><strong>Stand:</strong> Maerz 2026</p>

<h2>1. Verantwortlicher</h2>
<p>Fabian Woerenkaemper<br>Wippeskuhlen 53<br>57439 Attendorn<br>E-Mail: <a href="mailto:faffi@gmx.de">faffi@gmx.de</a></p>

<h2>2. Erhobene Daten</h2>
<p>Bei der Nutzung von Wippestoolen werden folgende Daten erhoben:</p>
<ul>
<li><strong>Account-Daten:</strong> Name, E-Mail-Adresse, Passwort (verschluesselt), Adresse</li>
<li><strong>Profil-Daten:</strong> Anzeigename, Telefonnummer (optional), Profilbild</li>
<li><strong>Werkzeug-Daten:</strong> Fotos, Beschreibungen, Standort (PLZ-basiert)</li>
<li><strong>Buchungs-Daten:</strong> Buchungsanfragen, Zeitraeume, Nachrichten</li>
<li><strong>Bewertungen:</strong> Sternebewertung und Kommentare</li>
</ul>

<h2>3. Zweck der Datenverarbeitung</h2>
<p>Die Daten werden ausschliesslich fuer den Betrieb der Werkzeugverleih-Plattform verwendet:</p>
<ul>
<li>Bereitstellung und Verwaltung deines Benutzerkontos</li>
<li>Vermittlung von Werkzeugausleihen zwischen Nachbarn</li>
<li>Benachrichtigungen ueber Buchungsanfragen und -status</li>
<li>Optionale KI-gestuetzte Werkzeugerkennung (Foto-Analyse)</li>
</ul>

<h2>4. Rechtsgrundlage</h2>
<p>Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfullung) sowie Art. 6 Abs. 1 lit. a DSGVO (Einwilligung bei optionalen Funktionen wie der KI-Fotoanalyse).</p>

<h2>5. Speicherung und Hosting</h2>
<ul>
<li><strong>Backend &amp; Datenbank:</strong> Railway (EU Region, europe-west4)</li>
<li><strong>Fotos:</strong> Cloudflare R2 (EU)</li>
<li><strong>DNS &amp; CDN:</strong> Cloudflare</li>
</ul>

<h2>6. Drittanbieter</h2>
<ul>
<li><strong>Anthropic (Claude API):</strong> Optionale KI-Fotoanalyse zur Werkzeugerkennung. Fotos werden nur fuer die Analyse uebertragen und nicht gespeichert.</li>
<li><strong>Cloudflare:</strong> CDN, DNS und Objektspeicher.</li>
</ul>

<h2>7. Speicherdauer</h2>
<p>Deine Daten werden gespeichert, solange dein Account besteht. Nach einer Kontoloeschung werden personenbezogene Daten sofort anonymisiert und nach 30 Tagen endgueltig geloescht.</p>

<h2>8. Deine Rechte</h2>
<p>Du hast folgende Rechte:</p>
<ul>
<li><strong>Auskunft</strong> (Art. 15 DSGVO)</li>
<li><strong>Berichtigung</strong> (Art. 16 DSGVO)</li>
<li><strong>Loeschung</strong> (Art. 17 DSGVO) — In der App unter Einstellungen → "Account loeschen"</li>
<li><strong>Einschraenkung der Verarbeitung</strong> (Art. 18 DSGVO)</li>
<li><strong>Datenportabilitaet</strong> (Art. 20 DSGVO)</li>
<li><strong>Widerspruch</strong> (Art. 21 DSGVO)</li>
</ul>
<p>Kontakt: <a href="mailto:faffi@gmx.de">faffi@gmx.de</a></p>

<h2>9. Beschwerderecht</h2>
<p>Du hast das Recht, eine Beschwerde bei der zustaendigen Datenschutzbehoerde einzureichen:<br>
Landesbeauftragte fuer Datenschutz und Informationsfreiheit Nordrhein-Westfalen<br>
<a href="https://www.ldi.nrw.de">www.ldi.nrw.de</a></p>

<hr>
<h1>Impressum</h1>
<p>Fabian Woerenkaemper<br>Wippeskuhlen 53<br>57439 Attendorn<br>E-Mail: <a href="mailto:faffi@gmx.de">faffi@gmx.de</a></p>
<p>Inhaltlich Verantwortlicher gemaess § 55 Abs. 2 RStV: Fabian Woerenkaemper (Anschrift wie oben).</p>
</body>
</html>"""


@router.get("/privacy", response_class=HTMLResponse)
async def privacy_policy():
    """Return privacy policy and legal information as HTML."""
    return PRIVACY_HTML
```

- [ ] **Step 2: Register privacy router**

In `wippestoolen/app/api/v1/api.py`, add:

```python
from wippestoolen.app.api.v1.endpoints.privacy import router as privacy_router
```

And add this line where other routers are included:

```python
api_router.include_router(privacy_router)
```

- [ ] **Step 3: Verify endpoint**

```bash
python -c "from wippestoolen.app.main import app; print([r.path for r in app.routes if hasattr(r, 'path') and 'privacy' in r.path])"
```

Expected: Shows `/api/v1/privacy`

- [ ] **Step 4: Commit**

```bash
git add wippestoolen/app/api/v1/endpoints/privacy.py wippestoolen/app/api/v1/api.py
git commit -m "feat: add /privacy endpoint with DSGVO-compliant privacy policy and Impressum

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Mobile — AuthContext deleteAccount + Settings UI

**Files:**
- Modify: `mobile/contexts/AuthContext.tsx`
- Modify: `mobile/app/settings.tsx`

- [ ] **Step 1: Add deleteAccount to AuthContext**

In `mobile/contexts/AuthContext.tsx`:

Add to `AuthContextType` interface:

```typescript
  deleteAccount: (password: string) => Promise<void>;
```

Add after the `refreshUser` callback:

```typescript
  const deleteAccount = useCallback(async (password: string) => {
    await api.delete("/auth/me", { data: { password } });
    await clearTokens();
    setState({ user: null, isLoading: false, isAuthenticated: false });
  }, []);
```

Add `deleteAccount` to the Provider value:

```typescript
  <AuthContext.Provider value={{ ...state, login, register, logout, updateProfile, refreshUser, deleteAccount }}>
```

- [ ] **Step 2: Update settings.tsx with delete button and Datenschutz link**

In `mobile/app/settings.tsx`:

Add/update imports:

```typescript
import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, Switch, Linking, TextInput, Modal } from "react-native";
```

Update the `useAuth` destructure:

```typescript
const { logout, deleteAccount } = useAuth();
```

Add state for delete modal:

```typescript
const [showDeleteModal, setShowDeleteModal] = useState(false);
const [deletePassword, setDeletePassword] = useState("");
const [isDeleting, setIsDeleting] = useState(false);
```

Add delete handlers after `handleLogout`:

```typescript
  const handleDeleteAccount = () => {
    Alert.alert(
      "Account loeschen",
      "Bist du sicher? Alle deine Daten, Werkzeuge und Buchungen werden unwiderruflich geloescht.",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Ja, weiter",
          style: "destructive",
          onPress: () => {
            setDeletePassword("");
            setShowDeleteModal(true);
          },
        },
      ]
    );
  };

  const confirmDelete = async () => {
    if (!deletePassword) return;
    setIsDeleting(true);
    try {
      await deleteAccount(deletePassword);
      setShowDeleteModal(false);
    } catch {
      Alert.alert("Fehler", "Account konnte nicht geloescht werden. Bitte pruefe dein Passwort.");
    } finally {
      setIsDeleting(false);
    }
  };
```

Replace the Datenschutz SettingsRow:

```typescript
          <SettingsRow
            label="Datenschutz"
            onPress={() => Linking.openURL("https://api.wippestoolen.de/api/v1/privacy")}
          />
```

Add a new "Gefahrenzone" section before the closing `</ScrollView>`:

```typescript
        {/* Danger zone */}
        <SectionLabel title="Gefahrenzone" />
        <SettingsCard>
          <SettingsRow
            label="Account loeschen"
            onPress={handleDeleteAccount}
            isDestructive
            isLast
          />
        </SettingsCard>
```

Add the password modal before the closing `</>` (after `</View>`):

```typescript
      {/* Delete account password modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={{ backgroundColor: colors.white, borderRadius: 16, padding: 24, width: "85%", maxWidth: 340 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.gray[900], marginBottom: 8 }}>
              Passwort bestaetigen
            </Text>
            <Text style={{ fontSize: 14, color: colors.gray[500], marginBottom: 16 }}>
              Gib dein Passwort ein um die Loeschung zu bestaetigen.
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: colors.gray[300],
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 15,
                marginBottom: 16,
                color: colors.gray[900],
              }}
              placeholder="Passwort"
              placeholderTextColor={colors.gray[400]}
              secureTextEntry
              value={deletePassword}
              onChangeText={setDeletePassword}
              autoFocus
            />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.gray[100], alignItems: "center" }}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={{ fontSize: 15, color: colors.gray[700], fontWeight: "500" }}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.error, alignItems: "center", opacity: isDeleting ? 0.6 : 1 }}
                onPress={confirmDelete}
                disabled={isDeleting || !deletePassword}
              >
                <Text style={{ fontSize: 15, color: colors.white, fontWeight: "600" }}>
                  {isDeleting ? "Wird geloescht..." : "Endgueltig loeschen"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
```

- [ ] **Step 3: Commit**

```bash
git add mobile/contexts/AuthContext.tsx mobile/app/settings.tsx
git commit -m "feat: add account deletion UI with password confirmation and Datenschutz link

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Verify all imports**

```bash
cd /Users/woerenkaemper/PycharmProjects/Wippestoolen
python -c "
from wippestoolen.app.main import app
from wippestoolen.app.schemas.auth import DeleteAccountRequest
from wippestoolen.app.api.v1.endpoints.privacy import router
print('All imports OK')
"
```

Expected: `All imports OK`

- [ ] **Step 2: Run tests**

```bash
pytest tests/test_storage.py tests/test_account_deletion.py -v --noconftest
```

Expected: All tests PASS

- [ ] **Step 3: Push to master**

```bash
git push origin master
```

Railway auto-deploys. After deployment, verify:
- `https://api.wippestoolen.de/api/v1/privacy` — shows privacy policy HTML
- `https://api.wippestoolen.de/health` — returns `{"status": "healthy"}`

---

## Post-Implementation: Manual Steps (User)

1. **Apple Developer Account** — Sign up at developer.apple.com/programs ($99/year)
2. **EAS Init** — After account is ready: `cd mobile && npx eas init` → updates `extra.eas.projectId` in app.json
3. **Update eas.json** — Fill in `appleId`, `ascAppId`, `appleTeamId`
4. **TestFlight Build** — `npx eas build --platform ios --profile preview`
5. **Test on device** — Install via TestFlight, verify all features
6. **Enable Drawer** — Once on Dev Build, re-enable drawer in `app/(drawer)/_layout.tsx`
7. **App Store Screenshots** — Create screenshots for submission
8. **Submit** — `npx eas submit --platform ios --profile production`
