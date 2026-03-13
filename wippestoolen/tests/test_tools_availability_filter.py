"""Test that browse_tools supports is_available filter."""
import inspect
import pytest
from wippestoolen.app.api.v1.endpoints.tools import router


def test_browse_tools_has_available_filter_param():
    """Verify the browse_tools endpoint accepts an 'available' query parameter."""
    for route in router.routes:
        if (hasattr(route, "path") and route.path == "/tools" and
            "GET" in getattr(route, "methods", set()) and
            getattr(route, "endpoint").__name__ == "browse_tools"):
            sig = inspect.signature(route.endpoint)
            param_names = list(sig.parameters.keys())
            assert "available" in param_names, (
                f"browse_tools endpoint missing 'available' parameter. "
                f"Current params: {param_names}"
            )
            return
    pytest.fail("GET /tools route (browse_tools) not found on tools router")
