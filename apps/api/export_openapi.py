"""
Run this after `pip install -r requirements.txt` (or inside the api container)
to regenerate the OpenAPI contract file:

    python export_openapi.py

Re-run it after every router/schema change and commit the diff — this file
is what the frontend should treat as ground truth, per docs/decisions.md.
"""
import json

from app.main import app

if __name__ == "__main__":
    with open("openapi.json", "w") as f:
        json.dump(app.openapi(), f, indent=2)
    print("Wrote openapi.json")
