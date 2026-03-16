"""Push notification service using the Expo Push Notification API."""

import logging
from typing import Any, Optional
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from wippestoolen.app.models.push_token import PushToken

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


class PushService:
    """Service for managing push notification tokens and sending notifications."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def register_push_token(
        self,
        user_id: UUID,
        token: str,
        platform: str,
        device_name: Optional[str] = None,
    ) -> PushToken:
        """
        Register or reactivate a push token for a user.

        If the token already exists (possibly for a different user or deactivated),
        it is claimed by the given user and activated. Otherwise a new record is created.

        Args:
            user_id: UUID of the user
            token: Expo push token (e.g. "ExponentPushToken[...]")
            platform: "ios" or "android"
            device_name: Optional human-readable device name

        Returns:
            PushToken: The registered or updated token record
        """
        result = await self.db.execute(
            select(PushToken).where(PushToken.token == token)
        )
        push_token = result.scalar_one_or_none()

        if push_token is not None:
            # Update existing record — reassign to caller and activate
            push_token.user_id = user_id
            push_token.platform = platform
            push_token.device_name = device_name
            push_token.is_active = True
        else:
            push_token = PushToken(
                user_id=user_id,
                token=token,
                platform=platform,
                device_name=device_name,
                is_active=True,
            )
            self.db.add(push_token)

        await self.db.commit()
        await self.db.refresh(push_token)
        return push_token

    async def unregister_push_token(self, user_id: UUID, token: str) -> None:
        """
        Deactivate a push token for a user.

        The record is soft-deleted (is_active = False) rather than removed so
        that historical data is preserved.

        Args:
            user_id: UUID of the user
            token: Push token string to deactivate
        """
        result = await self.db.execute(
            select(PushToken).where(
                PushToken.token == token,
                PushToken.user_id == user_id,
                PushToken.is_active == True,  # noqa: E712
            )
        )
        push_token = result.scalar_one_or_none()

        if push_token is not None:
            push_token.is_active = False
            await self.db.commit()

    async def send_push_notification(
        self,
        user_id: UUID,
        title: str,
        message: str,
        data: Optional[dict[str, Any]] = None,
    ) -> None:
        """
        Send a push notification to all active tokens for a user.

        Notifications are delivered via the Expo Push Notification API.
        Failures are logged but do not raise exceptions so that the caller's
        main flow is not disrupted.

        Args:
            user_id: UUID of the recipient user
            title: Notification title
            message: Notification body
            data: Optional arbitrary JSON payload delivered alongside the notification
        """
        result = await self.db.execute(
            select(PushToken).where(
                PushToken.user_id == user_id,
                PushToken.is_active == True,  # noqa: E712
            )
        )
        tokens = result.scalars().all()

        if not tokens:
            logger.debug("No active push tokens for user %s", user_id)
            return

        messages = [
            {
                "to": t.token,
                "title": title,
                "body": message,
                "data": data or {},
            }
            for t in tokens
        ]

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    EXPO_PUSH_URL,
                    json=messages,
                    headers={"Accept": "application/json", "Content-Type": "application/json"},
                )
                response.raise_for_status()
                logger.info(
                    "Sent push notifications to %d token(s) for user %s",
                    len(tokens),
                    user_id,
                )
        except httpx.HTTPError as exc:
            logger.error(
                "Failed to send push notifications for user %s: %s", user_id, exc
            )
