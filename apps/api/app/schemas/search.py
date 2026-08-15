"""Global search shapes (Phase 5 hardening — cross-domain aggregator).

Response groups hits by domain. Each section is only present when the
caller has the underlying permission AND the section was requested
(types query param); each carries {items, total}. The pagination
contract (items/total/page/page_size) is reused per section rather than
for the whole response, since the aggregator never guarantees a unified
ordering across domains.
"""

from typing import Generic, TypeVar

from pydantic import BaseModel

from app.schemas.cases import CaseSummary
from app.schemas.map import DistrictSummary
from app.schemas.network import EntitySummary

T = TypeVar("T")


class SearchSection(BaseModel, Generic[T]):
    items: list[T]
    total: int


class SearchResponse(BaseModel):
    query: str
    cases: SearchSection[CaseSummary] | None = None
    entities: SearchSection[EntitySummary] | None = None
    districts: SearchSection[DistrictSummary] | None = None
