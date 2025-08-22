#!/usr/bin/env python3
"""Test server to verify route loading."""

from wippestoolen.app.main import app

if __name__ == "__main__":
    print(f"App loaded with {len(app.routes)} routes")
    print("Routes:")
    for route in app.routes:
        print(f"  {route.path}")
    
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")