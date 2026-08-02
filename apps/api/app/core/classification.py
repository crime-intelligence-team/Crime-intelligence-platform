from app.models.base import CLASSIFICATION_RANK, ClassificationLevel
from app.models.entities import Role

# Role -> highest classification tier that role may include in dashboard
# aggregations. NEW POLICY (Phase 3): no role->classification mapping existed
# anywhere in the codebase before this; permissions.py governs actions, not
# data visibility. This is record-level tier gating only — it is NOT the
# RedactionPolicyDecision engine (Phase 6). Per-field redaction inside a tier
# is not represented here, so count-inference protection holds only at tier
# boundaries. See docs/decisions/004-dashboard-classification-gating.md.
ROLE_MAX_CLASSIFICATION: dict[Role, ClassificationLevel] = {
    Role.DISTRICT_OFFICER: ClassificationLevel.RESTRICTED_OPERATIONAL,
    Role.DETECTIVE: ClassificationLevel.RESTRICTED_OPERATIONAL,
    Role.ANALYST: ClassificationLevel.RESTRICTED_OPERATIONAL,
    Role.SUPERVISOR: ClassificationLevel.PROTECTED,
    Role.ADMINISTRATOR: ClassificationLevel.SEALED,
}


def classification_filter(role: Role) -> list[ClassificationLevel]:
    """Tiers at-or-below the role's entitlement. Every aggregation query
    filters Case.classification.in_(classification_filter(role)) BEFORE
    counting, so a record above the viewer's tier can never be inferred
    from a count."""
    max_tier = ROLE_MAX_CLASSIFICATION[role]
    return [
        level
        for level in ClassificationLevel
        if CLASSIFICATION_RANK[level] <= CLASSIFICATION_RANK[max_tier]
    ]
