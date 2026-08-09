import os
import sqlite3
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "care_voice.db")


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            name TEXT,
            memory_summary TEXT,
            last_interaction TEXT
        )
        """
    )
    return conn


def get_user_memory(user_id: str) -> dict | None:
    conn = _get_conn()
    try:
        row = conn.execute(
            "SELECT name, memory_summary, last_interaction FROM users WHERE user_id = ?",
            (user_id,),
        ).fetchone()
    finally:
        conn.close()
    if row is None:
        return None
    return {"name": row[0], "memory_summary": row[1], "last_interaction": row[2]}


def save_user_memory(user_id: str, name: str, memory_summary: str) -> None:
    conn = _get_conn()
    try:
        conn.execute(
            """
            INSERT INTO users (user_id, name, memory_summary, last_interaction)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                name = excluded.name,
                memory_summary = excluded.memory_summary,
                last_interaction = excluded.last_interaction
            """,
            (user_id, name, memory_summary, datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
    finally:
        conn.close()