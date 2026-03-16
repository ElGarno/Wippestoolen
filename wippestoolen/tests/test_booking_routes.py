"""Test that booking route ordering is correct."""
import pytest
from wippestoolen.app.api.v1.endpoints.bookings import router


def test_calendar_route_before_booking_id_route():
    """Ensure /calendar is defined before /{booking_id} to avoid route conflict."""
    routes = [r.path for r in router.routes if hasattr(r, "path")]
    calendar_idx = None
    booking_id_idx = None
    for i, path in enumerate(routes):
        if path == "/bookings/calendar":
            calendar_idx = i
        if path == "/bookings/{booking_id}":
            booking_id_idx = i

    assert calendar_idx is not None, "/bookings/calendar route not found"
    assert booking_id_idx is not None, "/bookings/{booking_id} route not found"
    assert calendar_idx < booking_id_idx, (
        f"/bookings/calendar (index {calendar_idx}) must come before "
        f"/bookings/{{booking_id}} (index {booking_id_idx}) to avoid route conflict"
    )
