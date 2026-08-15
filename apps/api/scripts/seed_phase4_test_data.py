"""Phase 4 component 5 test data: SUPERVISOR officer, PROTECTED address,
Person with is_protected_subject=1.

Run from inside the cip-api container:
    docker exec cip-api python -m scripts.seed_phase4_test_data
"""

import sys
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.base import ClassificationLevel
from app.models.entities import Address, District, Officer, Person, Role


def main() -> None:
    db = SessionLocal()
    try:
        supervisor = db.execute(
            select(Officer).where(Officer.username == "supervisor")
        ).scalar_one_or_none()
        if supervisor is None:
            supervisor = Officer(
                official_id="SUP-0001",
                username="supervisor",
                hashed_password=hash_password("Password1!"),
                full_name="Sam Supervisor",
                role=Role.SUPERVISOR,
                unit="Command",
                home_district_id=None,
                mfa_enabled=0,
                is_active=1,
            )
            db.add(supervisor)
            print("officer: supervisor (SUP-0001) created")

        central = db.execute(
            select(District).where(District.code == "CEN")
        ).scalar_one()
        protected_address = db.execute(
            select(Address).where(Address.raw_text == "PROTECTED test address")
        ).scalar_one_or_none()
        if protected_address is None:
            protected_address = Address(
                raw_text="PROTECTED test address",
                geocoded_point="SRID=4326;POINT(77.2200 28.6300)",
                district_id=central.id,
                classification=ClassificationLevel.PROTECTED,
                source_name="phase4-test",
                source_timestamp=datetime.now(timezone.utc),
                mapping_schema_version="test-1",
            )
            db.add(protected_address)
            print(f"address (PROTECTED): {protected_address.id}")

        person = db.execute(
            select(Person).where(Person.full_name == "Phase4 Protected Person")
        ).scalar_one_or_none()
        if person is None:
            person = Person(
                full_name="Phase4 Protected Person",
                aliases='["Phase Four", "P4"]',
                date_of_birth=date(1985, 6, 14),
                is_protected_subject=1,
                classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
                source_name="phase4-test",
                source_timestamp=datetime.now(timezone.utc),
                mapping_schema_version="test-1",
            )
            db.add(person)
            print(f"person (protected subject): {person.id}")

        db.commit()
        print("done")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
