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

ESCALATION_FILE = "escalations.json"


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