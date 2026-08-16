"""Demo enrichment: more persons/organizations/vehicles/devices/cases/notes
and a denser relationship graph, layered on top of the other seed scripts.

Run from inside the cip-api container, after seed_dev_data (and, if you
want the phase4/phase6 QA fixtures too, after those — this script doesn't
depend on them):
    docker exec cip-api python -m scripts.seed_demo_enrichment

Purely additive: creates new rows only, never edits/reads rows the other
seed scripts depend on by exact name/id, so it's safe to run alongside
them. Idempotent the same way seed_dev_data is: aborts if it looks like
it already ran (checks for the first seeded person's name).
"""

import json
import sys
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select

from app.core.database import SessionLocal
from app.graph.driver import get_driver
from app.models.base import ClassificationLevel
from app.models.entities import (
    Address,
    Case,
    Device,
    District,
    Note,
    Officer,
    Organization,
    Person,
    RelationshipEdgeRef,
    Vehicle,
)

EDGE_TYPES = frozenset({"LINKED_TO", "MEMBER_OF", "OWNS", "ASSOCIATED_WITH", "COMMUNICATES_WITH"})

PERSONS = [
    # (full_name, aliases, date_of_birth, is_protected_subject, classification)
    ("Arjun Mehta", ["AM", "The Broker"], date(1985, 3, 12), 0, ClassificationLevel.RESTRICTED_OPERATIONAL),
    ("Priya Nair", None, date(1990, 7, 22), 0, ClassificationLevel.OPEN_OPERATIONAL),
    ("Suresh Iyer", ["Suri"], date(1978, 11, 5), 0, ClassificationLevel.RESTRICTED_OPERATIONAL),
    ("Fatima Sheikh", None, date(1995, 1, 30), 0, ClassificationLevel.OPEN_OPERATIONAL),
    ("Vikram Rathod", ["Vik", "Rathod Bhai"], date(1982, 9, 18), 1, ClassificationLevel.PROTECTED),
    ("Ananya Reddy", None, date(1993, 4, 9), 0, ClassificationLevel.RESTRICTED_OPERATIONAL),
    ("Karan Malhotra", ["KM"], date(1988, 6, 14), 0, ClassificationLevel.RESTRICTED_OPERATIONAL),
    ("Divya Krishnan", None, date(1991, 12, 2), 0, ClassificationLevel.OPEN_OPERATIONAL),
    ("Rohan Bose", ["Bosey"], date(1980, 2, 27), 0, ClassificationLevel.RESTRICTED_OPERATIONAL),
    ("Meera Pillai", None, date(1996, 8, 19), 0, ClassificationLevel.OPEN_OPERATIONAL),
    ("Aditya Choudhary", ["Adi"], date(1975, 10, 3), 1, ClassificationLevel.PROTECTED),
    ("Nisha Kapoor", None, date(1989, 5, 25), 0, ClassificationLevel.RESTRICTED_OPERATIONAL),
    ("Farhan Ali", ["FA"], date(1984, 3, 8), 0, ClassificationLevel.RESTRICTED_OPERATIONAL),
    ("Sneha Joshi", None, date(1992, 7, 16), 0, ClassificationLevel.OPEN_OPERATIONAL),
    ("Gurpreet Singh", ["GP"], date(1979, 1, 21), 0, ClassificationLevel.RESTRICTED_OPERATIONAL),
]

ORGANIZATIONS = [
    # (name, org_type)
    ("Konkan Freight Carriers", "shell_company"),
    ("Sunrise Traders Cooperative", "trading_company"),
    ("Nilgiri Relief Foundation", "ngo_front"),
    ("Coastal Star Syndicate", "syndicate"),
    ("Deccan Logistics Union", "gang"),
    ("Vishwas Import Export Pvt Ltd", "shell_company"),
]

VEHICLES = [
    # (registration_number, make, model, color)
    ("DL-04-CD-7719", "Maruti Suzuki", "Swift", "White"),
    ("MH-12-AB-3345", "Hyundai", "Creta", "Grey"),
    ("KA-05-MN-8821", "Toyota", "Innova", "Silver"),
    ("TN-09-XY-4456", "Mahindra", "Bolero", "Black"),
    ("WB-06-GH-1123", "Tata", "Nexon", "Red"),
    ("TG-07-JK-9987", "Honda", "City", "White"),
    ("DL-08-LM-2234", "Royal Enfield", "Classic 350", "Black"),
    ("MH-14-QR-5567", "Bajaj", "Pulsar", "Blue"),
    ("KA-03-ST-6678", "Ford", "EcoSport", "Grey"),
    ("TN-22-UV-3391", "Ashok Leyland", "Dost", "White"),
]

DEVICES = [
    # (phone_number, imei, device_type)
    ("+91-98200-11223", "356938035643801", "mobile"),
    ("+91-99870-44556", "490154203237518", "mobile"),
    ("+91-97654-33221", "356789102345671", "mobile"),
    ("+91-90123-88774", "013456709876543", "satellite_phone"),
    ("+91-96543-21098", "358965101234567", "mobile"),
    ("+91-98765-40321", "490154678912345", "laptop"),
    ("+91-91234-56780", "356123489012345", "mobile"),
    ("+91-99001-22334", "013987654321098", "tablet"),
]

CASE_TEMPLATES = [
    # (title, summary, status)
    ("Counterfeit currency distribution network", "Multi-district investigation into circulation of counterfeit currency traced to a regional printing operation.", Case.STATUS_UNDER_INVESTIGATION),
    ("Vehicle theft and re-registration ring", "Stolen vehicles resurfacing with forged registration documents across state lines.", Case.STATUS_OPEN),
    ("Cyber-enabled financial fraud", "Phishing-linked fraud targeting bank customers, funds routed through shell accounts.", Case.STATUS_UNDER_INVESTIGATION),
    ("Illegal arms trafficking probe", "Interdiction of a small-arms trafficking route linked to two prior seizures.", Case.STATUS_PENDING_REVIEW),
    ("Narcotics distribution network", "Street-level distribution network traced upstream to a regional supplier.", Case.STATUS_OPEN),
    ("Extortion racket targeting local businesses", "Pattern of extortion demands against small business owners in a commercial district.", Case.STATUS_UNDER_INVESTIGATION),
    ("Antiquities smuggling investigation", "Suspected smuggling of protected antiquities through a logistics front company.", Case.STATUS_PENDING_REVIEW),
    ("Organized retail theft ring", "Coordinated theft operation targeting retail outlets, resale via online marketplaces.", Case.STATUS_CLOSED),
    ("Protection racket — transport sector", "Extortion of local transport operators under threat of vehicle damage.", Case.STATUS_OPEN),
    ("Bank fraud — forged loan documentation", "Loan fraud scheme using forged income and property documentation.", Case.STATUS_UNDER_INVESTIGATION),
    ("Smuggling ring — port logistics", "Contraband movement through port-adjacent logistics channels.", Case.STATUS_OPEN),
]

NOTE_BODIES = [
    "Initial intake complete; cross-referencing known associates.",
    "Surveillance corroborates prior informant reporting.",
    "Financial records requested from partner institution.",
    "Coordinating with adjacent district on suspected overlap.",
    "Awaiting forensic report before next action.",
]


def _get_officers(db) -> list[Officer]:
    usernames = ["admin", "analyst", "officer", "supervisor", "detective"]
    officers = []
    for u in usernames:
        o = db.execute(select(Officer).where(Officer.username == u)).scalar_one_or_none()
        if o is not None:
            officers.append(o)
    if not officers:
        raise RuntimeError("run scripts.seed_dev_data first (no officers found)")
    return officers


def _district_addresses(db, code: str, limit: int) -> list[Address]:
    district = db.execute(select(District).where(District.code == code)).scalar_one_or_none()
    if district is None:
        return []
    return (
        db.execute(
            select(Address).where(Address.district_id == district.id).order_by(Address.raw_text).limit(limit)
        )
        .scalars()
        .all()
    )


def main() -> None:
    db = SessionLocal()
    try:
        marker = db.execute(select(Person).where(Person.full_name == PERSONS[0][0])).scalar_one_or_none()
        if marker is not None:
            print("Demo enrichment already present; aborting (drop tables to reseed).")
            return

        officers = _get_officers(db)

        # ── Persons ──────────────────────────────────────────────────────
        persons = []
        for full_name, aliases, dob, protected, classification in PERSONS:
            p = Person(
                full_name=full_name,
                aliases=json.dumps(aliases) if aliases else None,
                date_of_birth=dob,
                is_protected_subject=protected,
                classification=classification,
                source_name="demo-enrichment",
                source_timestamp=datetime.now(timezone.utc),
                mapping_schema_version="demo-1",
            )
            db.add(p)
            persons.append(p)
        db.flush()

        # ── Organizations ────────────────────────────────────────────────
        organizations = []
        for name, org_type in ORGANIZATIONS:
            o = Organization(
                name=name,
                org_type=org_type,
                classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
                source_name="demo-enrichment",
                source_timestamp=datetime.now(timezone.utc),
                mapping_schema_version="demo-1",
            )
            db.add(o)
            organizations.append(o)
        db.flush()

        # ── Vehicles ─────────────────────────────────────────────────────
        vehicles = []
        for reg, make, model, color in VEHICLES:
            v = Vehicle(
                registration_number=reg,
                make=make,
                model=model,
                color=color,
                classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
                source_name="demo-enrichment",
                source_timestamp=datetime.now(timezone.utc),
                mapping_schema_version="demo-1",
            )
            db.add(v)
            vehicles.append(v)
        db.flush()

        # ── Devices ──────────────────────────────────────────────────────
        devices = []
        for phone, imei, dtype in DEVICES:
            d = Device(
                phone_number=phone,
                imei=imei,
                device_type=dtype,
                classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
                source_name="demo-enrichment",
                source_timestamp=datetime.now(timezone.utc),
                mapping_schema_version="demo-1",
            )
            db.add(d)
            devices.append(d)
        db.flush()

        # ── Cases (spread across all districts, linked to real addresses) ──
        district_codes = ["CEN", "EAST", "MUM", "BLR", "CHN", "KOL", "HYD"]
        cases = []
        notes = []
        for i, (title, summary, status) in enumerate(CASE_TEMPLATES):
            code = district_codes[i % len(district_codes)]
            district = db.execute(select(District).where(District.code == code)).scalar_one()
            addrs = _district_addresses(db, code, limit=8)
            address = addrs[i % len(addrs)] if addrs else None
            officer = officers[i % len(officers)]
            case = Case(
                case_number=f"CASE-2026-{1000 + i}",
                title=title,
                summary=summary,
                status=status,
                district_id=district.id,
                lead_officer_id=officer.id,
                address_id=address.id if address else None,
                classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
                source_name="demo-enrichment",
                source_timestamp=datetime.now(timezone.utc),
                mapping_schema_version="demo-1",
            )
            db.add(case)
            cases.append(case)
        db.flush()

        for i, case in enumerate(cases):
            note = Note(
                case_id=case.id,
                author_id=officers[i % len(officers)].id,
                body=NOTE_BODIES[i % len(NOTE_BODIES)],
                visibility=Note.VISIBILITY_CASE_TEAM,
                finding_state="hypothesis",
                classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
            )
            db.add(note)
            notes.append(note)
        db.flush()
        db.commit()

        # ── Relationship graph ──────────────────────────────────────────
        # (source, target, type, band, status, case)
        # source/target are (kind, index) pairs resolved to real node ids below.
        edge_specs = []
        for i, p in enumerate(persons):
            org = organizations[i % len(organizations)]
            edge_specs.append((("person", i), ("organization", organizations.index(org)), "MEMBER_OF", "probable" if i % 3 else "verified"))
        for i, v in enumerate(vehicles):
            p_idx = i % len(persons)
            edge_specs.append((("person", p_idx), ("vehicle", i), "OWNS", "verified" if i % 2 else "probable"))
        for i, d in enumerate(devices):
            p_idx = (i * 2) % len(persons)
            edge_specs.append((("person", p_idx), ("device", i), "LINKED_TO", "probable"))
        for i, case in enumerate(cases):
            if case.address_id is None:
                continue
            p_idx = i % len(persons)
            edge_specs.append((("person", p_idx), ("address", str(case.address_id)), "LINKED_TO", "probable" if i % 2 else "verified"))
        for i in range(0, len(persons) - 1, 2):
            edge_specs.append((("person", i), ("person", i + 1), "ASSOCIATED_WITH", "unconfirmed"))
        for i, o in enumerate(organizations):
            if i >= len(cases):
                break
            case = cases[i]
            if case.address_id is None:
                continue
            edge_specs.append((("organization", i), ("address", str(case.address_id)), "LINKED_TO", "probable"))

        def node_id(kind: str, ref) -> tuple[str, str, str]:
            """Returns (neo4j entity_id, entity_type, label)."""
            if kind == "person":
                p = persons[ref]
                return str(p.id), "person", p.full_name
            if kind == "organization":
                o = organizations[ref]
                return str(o.id), "organization", o.name
            if kind == "vehicle":
                v = vehicles[ref]
                return str(v.id), "vehicle", v.registration_number
            if kind == "device":
                d = devices[ref]
                return str(d.id), "device", d.phone_number
            if kind == "address":
                addr = db.get(Address, uuid.UUID(ref))
                return str(addr.id), "address", addr.raw_text
            raise ValueError(kind)

        driver = get_driver()
        band_scores = {"verified": 85, "probable": 60, "unconfirmed": 30}
        status_by_band = {"verified": "verified", "probable": "pending", "unconfirmed": "unverified"}
        mirror_count = 0
        with driver.session() as session:
            for src, dst, rtype, band in edge_specs:
                assert rtype in EDGE_TYPES
                src_id, src_type, src_label = node_id(*src)
                dst_id, dst_type, dst_label = node_id(*dst)
                rid = f"demo-rel-{uuid.uuid4()}"

                for eid, etype, label in ((src_id, src_type, src_label), (dst_id, dst_type, dst_label)):
                    session.run(
                        "MERGE (n:Entity {entity_id: $eid}) SET n.entity_type = $etype, n.label = $label",
                        eid=eid, etype=etype, label=label,
                    )
                session.run(
                    f"MATCH (a:Entity {{entity_id: $a}}), (b:Entity {{entity_id: $b}}) "
                    f"MERGE (a)-[r:{rtype} {{neo4j_relationship_id: $rid}}]->(b)",
                    a=src_id, b=dst_id, rid=rid,
                )
                db.add(
                    RelationshipEdgeRef(
                        neo4j_relationship_id=rid,
                        source_identifier="demo-enrichment",
                        confidence_score=band_scores[band],
                        confidence_band=band,
                        verification_status=status_by_band[band],
                        effective_from=datetime.now(timezone.utc),
                        effective_to=None,
                        case_id=None,
                        classification=ClassificationLevel.RESTRICTED_OPERATIONAL,
                    )
                )
                mirror_count += 1
        db.commit()

        print("Seeded demo enrichment:")
        print(f"  persons: {len(persons)}, organizations: {len(organizations)}, vehicles: {len(vehicles)}, devices: {len(devices)}")
        print(f"  cases: {len(cases)}, notes: {len(notes)}")
        print(f"  relationships: {mirror_count}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
