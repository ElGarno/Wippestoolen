"""Geocoding utility for the Attendorn/Sauerland area.

Uses a hardcoded lookup table of German postal codes to avoid external API
dependencies. A small random offset is applied so that multiple tools in the
same postal code area do not stack on the exact same map marker.
"""

import random


# Approximate center coordinates for postal codes in the Attendorn / Olpe /
# Siegen-Wittgenstein area.  Extend this dict as the platform grows.
_POSTAL_CODE_COORDS: dict[str, tuple[float, float]] = {
    "57439": (51.1267, 7.9033),   # Attendorn
    "57368": (51.1167, 8.0667),   # Lennestadt
    "57399": (51.0833, 8.0833),   # Kirchhundem
    "57462": (51.0289, 7.8511),   # Olpe
    "57072": (50.8748, 8.0243),   # Siegen
    "57076": (50.8748, 8.0243),   # Siegen
    "57078": (50.8748, 8.0243),   # Siegen
    "51643": (51.0261, 7.5648),   # Gummersbach
    "58511": (51.2195, 7.6294),   # Luedenscheid
    "58636": (51.3749, 7.6928),   # Iserlohn
    "57223": (50.9667, 7.9833),   # Kreuztal
}

# Maximum random offset in degrees (~200 m at this latitude).
_JITTER_DEG = 0.002


def geocode_postal_code(postal_code: str, city: str) -> tuple[float, float] | None:
    """Return approximate (latitude, longitude) for a German postal code.

    A small random jitter is added so that tools in the same postal code area
    are not rendered on top of each other on a map.

    Args:
        postal_code: German five-digit postal code string.
        city: City name (currently unused; kept for future Nominatim fallback).

    Returns:
        A (latitude, longitude) tuple when the postal code is known,
        or None when it is not in the lookup table.
    """
    coords = _POSTAL_CODE_COORDS.get(postal_code)
    if coords is None:
        return None

    lat, lng = coords
    lat += random.uniform(-_JITTER_DEG, _JITTER_DEG)
    lng += random.uniform(-_JITTER_DEG, _JITTER_DEG)
    return (lat, lng)
