from typing import Any

from geoalchemy2 import WKBElement
from geoalchemy2.shape import to_shape
from shapely.geometry import mapping


def geometry_to_geojson(geom: WKBElement | None) -> dict[str, Any] | None:
    if geom is None:
        return None
    shape = to_shape(geom)
    return mapping(shape)
