from app.models.entities import Officer, Role


ROLE_PERMISSIONS: dict[Role, list[str]] = {
    Role.DISTRICT_OFFICER: [
        "case:read", "case:write", "entity:read", "entity:write",
        "search:basic", "map:view", "note:create", "note:read",
    ],
    Role.DETECTIVE: [
        "case:read", "case:write", "entity:read", "entity:write",
        "search:basic", "search:advanced", "map:view", "note:create",
        "note:read", "export:case", "relationship:view",
    ],
    Role.ANALYST: [
        "case:read", "entity:read", "entity:resolve", "search:basic",
        "search:advanced", "map:view", "relationship:view", "dashboard:view",
        "export:analysis", "risk:view",
    ],
    Role.SUPERVISOR: [
        "case:read", "case:write", "entity:read", "entity:write",
        "entity:resolve", "search:basic", "search:advanced", "map:view",
        "note:create", "note:read", "export:case", "export:analysis",
        "relationship:view", "dashboard:view", "risk:view",
        "officer:view", "audit:view", "confidence:review",
        "exception:approve",
    ],
    Role.ADMINISTRATOR: [
        "case:read", "case:write", "entity:read", "entity:write",
        "entity:resolve", "search:basic", "search:advanced", "map:view",
        "note:create", "note:read", "export:case", "export:analysis",
        "relationship:view", "dashboard:view", "risk:view",
        "officer:view", "officer:manage", "audit:view",
        "confidence:review", "redaction:manage",
        "exception:approve", "system:configure",
        "classification:override",
    ],
}


def get_officer_permissions(officer: Officer) -> list[str]:
    return ROLE_PERMISSIONS.get(officer.role, [])
