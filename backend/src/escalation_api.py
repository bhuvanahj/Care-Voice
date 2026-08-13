from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import json
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

ESCALATION_FILE = str(BASE_DIR / "escalations.json")
CALLS_FILE = str(BASE_DIR / "calls.json")


def _load_json_list(path: str) -> list:
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return []


@app.get("/")
def home():
    return {"message": "Care Voice Escalation API Running"}


@app.get("/escalations")
def get_escalations():
    if not os.path.exists(ESCALATION_FILE):
        return []

    try:
        with open(ESCALATION_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        return {"error": str(e)}


@app.get("/stats")
def get_stats():
    if not os.path.exists(ESCALATION_FILE):
        return {
            "total": 0,
            "emergency": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
        }

    with open(ESCALATION_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    stats = {
        "total": len(data),
        "emergency": 0,
        "high": 0,
        "medium": 0,
        "low": 0,
    }

    for item in data:
        urgency = item.get("urgency", "").lower()

        if urgency == "emergency":
            stats["emergency"] += 1
        elif urgency == "high":
            stats["high"] += 1
        elif urgency == "medium":
            stats["medium"] += 1
        elif urgency == "low":
            stats["low"] += 1

    return stats


# --- Day 8: Call Analytics ------------------------------------------------


@app.get("/analytics/summary")
def get_analytics_summary():
    """Aggregate, real, non-sensitive call metrics — no hardcoded values.

    Computed directly from calls.json, written by agent.py at the end of
    every call.
    """
    calls = _load_json_list(CALLS_FILE)
    total = len(calls)
    successful = sum(1 for c in calls if c.get("success") is True)
    failed = total - successful
    escalations_created = sum(1 for c in calls if c.get("escalation_created") is True)
    success_rate = round((successful / total) * 100, 1) if total else 0.0

    return {
        "total_calls": total,
        "successful_calls": successful,
        "failed_calls": failed,
        "escalations_created": escalations_created,
        "success_rate": success_rate,
    }


@app.get("/calls")
def get_calls(limit: int = 50):
    """Non-sensitive call history: no transcripts, symptoms, names, OTPs,
    PINs, or account numbers are ever stored in calls.json, so there is
    nothing sensitive to strip here — only lifecycle/outcome fields exist.
    """
    calls = _load_json_list(CALLS_FILE)
    calls_sorted = sorted(calls, key=lambda c: c.get("started_at", ""), reverse=True)

    return [
        {
            "call_id": c.get("call_id"),
            "started_at": c.get("started_at"),
            "duration_seconds": c.get("duration_seconds"),
            "status": c.get("status"),
            "success": c.get("success"),
            "escalation_created": c.get("escalation_created"),
            "escalation_reference_id": c.get("escalation_reference_id"),
        }
        for c in calls_sorted[:limit]
    ]