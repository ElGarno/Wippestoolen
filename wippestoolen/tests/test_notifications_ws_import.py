"""Test that the notifications module imports cleanly after fix."""


def test_notifications_router_imports_without_error():
    """Verify the notification router can be imported (decode_token bug fixed)."""
    from wippestoolen.app.api.v1.endpoints.notifications import router
    assert router is not None
