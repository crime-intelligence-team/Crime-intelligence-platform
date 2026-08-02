"""Phase 6 component 5 fixture: two duplicate non-protected persons with a
shared name pattern, plus a protected subject and a neutral target for
block tests.

P1 (older): "Rajesh Kumar Verma", aliases ["Rajesh V"], dob 1982-04-11, RESTRICTED
P2 (newer): "Rajesh Kumar Verma", aliases ["RKV"], dob NULL (null on the
  newer record exercises the non-null-wins conflict rule: P1's dob wins
  because P2's is NULL), RESTRICTED
Protected: protected=1, for merge block tests (both directions).
Neutral: "Neutral Merge Target", for positive-path merge tests.

Graph edges intentionally NOT created — graph re-pointing is deferred
(011) and this phase only proves the Postgres side. Idempotent: on a
re-run it prints the existing rows and exits.

Run from inside the cip-api container:
    docker exec cip-api python -m scripts.seed_phase6_merge
"""

import sys

sys.path.insert(0, "/app")

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.base import ClassificationLevel
from app.models.entities import Person

P1 = None
P2 = None
PROTECTED2 = None


def main():
    global P1, P2, PROTECTED2
    engine = create_engine(settings.DATABASE_URL)
    db = Session(engine)
    try:
        existing = db.execute(
            select(Person).where(Person.full_name == "Rajesh Kumar Verma")
        ).scalars().all()
        if existing:
            for p in existing:
                print("existing:", p.id)
            neutral = db.execute(
                select(Person).where(Person.full_name == "Neutral Merge Target")
            ).scalars().first()
            if neutral is None:
                neutral = Person(
                    full_name="Neutral Merge Target",
                    aliases=None,
                    date_of_birth=None,
                    is_protected_subject=0,
                    classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
                )
                db.add(neutral)
                db.commit()
                print("NEUTRAL (new)", neutral.id)
            else:
                print("NEUTRAL", neutral.id)
            return
        p1 = Person(
            full_name="Rajesh Kumar Verma",
            aliases='["Rajesh V"]',
            date_of_birth="1982-04-11",
            is_protected_subject=0,
            classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
        )
        db.add(p1)
        db.flush()
        p2 = Person(
            full_name="Rajesh Kumar Verma",
            aliases='["RKV"]',
            date_of_birth=None,
            is_protected_subject=0,
            classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
        )
        db.add(p2)
        db.flush()
        prot = Person(
            full_name="Protected Merge Subject",
            aliases='["PMS"]',
            date_of_birth="1990-01-01",
            is_protected_subject=1,
            classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
        )
        db.add(prot)
        db.flush()
        neutral = Person(
            full_name="Neutral Merge Target",
            aliases=None,
            date_of_birth=None,
            is_protected_subject=0,
            classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
        )
        db.add(neutral)
        db.commit()
        P1 = p1.id
        P2 = p2.id
        PROTECTED2 = prot.id
        NEUTRAL = neutral.id
        print("P1", P1)
        print("P2", P2)
        print("PROTECTED2", PROTECTED2)
        print("NEUTRAL", NEUTRAL)
    finally:
        db.close()


if __name__ == "__main__":
    main()
