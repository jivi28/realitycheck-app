"""End-to-end API tests for RealityCheck bucketing fix.

Seeds a user + session directly into MongoDB, then hits the public API
(via REACT_APP_BACKEND_URL) with Authorization: Bearer <token> to verify:
  - Weekly analytics returns 3 separate buckets (productive/scheduled/break)
  - Daily analytics returns 3 separate buckets
  - AI weekly report data_summary has 3 distinct keys & content respects them
  - Projects / Schedules / Entries CRUD basics
  - Timer start/stop flow

Run: pytest /app/backend/tests/test_bucketing_e2e.py -v
"""
import os
import sys
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Load backend env (MONGO_URL, DB_NAME, REACT_APP_BACKEND_URL)
BACKEND_ENV = Path(__file__).resolve().parent.parent / ".env"
FRONTEND_ENV = Path(__file__).resolve().parent.parent.parent / "frontend" / ".env"
load_dotenv(BACKEND_ENV)
load_dotenv(FRONTEND_ENV)

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

TEST_USER_ID = "test_user_ai_bucket"
TEST_SESSION_TOKEN = "test-sess-token-bucket"
TEST_EMAIL = "TEST_bucket@example.com"


# ---------- Seed fixtures ----------

@pytest.fixture(scope="module")
def loop():
    return asyncio.new_event_loop()


@pytest.fixture(scope="module")
def seeded_user(loop):
    """Seed user + session + 3-type time entries directly into Mongo."""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    async def _seed():
        # Clean slate
        await db.users.delete_many({"user_id": TEST_USER_ID})
        await db.user_sessions.delete_many({"user_id": TEST_USER_ID})
        await db.time_entries.delete_many({"user_id": TEST_USER_ID})
        await db.projects.delete_many({"user_id": TEST_USER_ID})
        await db.recurring_schedules.delete_many({"user_id": TEST_USER_ID})
        await db.ai_reports.delete_many({"user_id": TEST_USER_ID})

        # User
        await db.users.insert_one({
            "user_id": TEST_USER_ID,
            "email": TEST_EMAIL,
            "name": "Bucket Tester",
            "picture": "",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        # Session (7d)
        await db.user_sessions.insert_one({
            "user_id": TEST_USER_ID,
            "session_token": TEST_SESSION_TOKEN,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        # Default project
        proj_id = f"proj_{uuid.uuid4().hex[:12]}"
        await db.projects.insert_one({
            "project_id": proj_id,
            "user_id": TEST_USER_ID,
            "name": "Deep Work",
            "color": "#00FF41",
            "is_default": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

        # Seed entries within current week (today, inside UTC day)
        today = datetime.now(timezone.utc).date()
        # Use a base time mid-day to avoid day-boundary flakes
        base = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=10)

        # 2h task
        t_start = base
        t_end = base + timedelta(hours=2)
        # 8h scheduled (sleep) - non-overlapping
        s_start = base + timedelta(hours=3)
        s_end = s_start + timedelta(hours=8)
        # 2h break - non-overlapping
        b_start = s_end + timedelta(minutes=30)
        b_end = b_start + timedelta(hours=2)

        await db.time_entries.insert_many([
            {
                "entry_id": f"entry_{uuid.uuid4().hex[:12]}",
                "user_id": TEST_USER_ID,
                "project_id": proj_id,
                "description": "Deep work session",
                "start_time": t_start.isoformat(),
                "end_time": t_end.isoformat(),
                "duration": 2 * 3600,
                "is_break": False,
                "is_running": False,
                "entry_type": "task",
                "schedule_id": None,
            },
            {
                "entry_id": f"entry_{uuid.uuid4().hex[:12]}",
                "user_id": TEST_USER_ID,
                "project_id": None,
                "description": "Sleep",
                "start_time": s_start.isoformat(),
                "end_time": s_end.isoformat(),
                "duration": 8 * 3600,
                "is_break": False,
                "is_running": False,
                "entry_type": "scheduled",
                "schedule_id": "sched_test_sleep",
            },
            {
                "entry_id": f"entry_{uuid.uuid4().hex[:12]}",
                "user_id": TEST_USER_ID,
                "project_id": None,
                "description": "Unaccounted Time",
                "start_time": b_start.isoformat(),
                "end_time": b_end.isoformat(),
                "duration": 2 * 3600,
                "is_break": True,
                "is_running": False,
                "entry_type": "break",
                "schedule_id": None,
            },
        ])
        return {"project_id": proj_id, "date": today.isoformat()}

    info = loop.run_until_complete(_seed())
    yield info

    async def _cleanup():
        await db.users.delete_many({"user_id": TEST_USER_ID})
        await db.user_sessions.delete_many({"user_id": TEST_USER_ID})
        await db.time_entries.delete_many({"user_id": TEST_USER_ID})
        await db.projects.delete_many({"user_id": TEST_USER_ID})
        await db.recurring_schedules.delete_many({"user_id": TEST_USER_ID})
        await db.ai_reports.delete_many({"user_id": TEST_USER_ID})
    loop.run_until_complete(_cleanup())
    client.close()


@pytest.fixture
def client(seeded_user):
    s = requests.Session()
    s.headers.update({
        "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
        "Content-Type": "application/json",
    })
    return s


# ---------- Auth sanity ----------

def test_auth_me_works_with_seeded_session(client):
    r = client.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user_id"] == TEST_USER_ID
    assert data["email"] == TEST_EMAIL


# ---------- CRITICAL: Weekly analytics 3-bucket split ----------

def test_weekly_analytics_three_buckets(client):
    r = client.get(f"{BASE_URL}/api/analytics/weekly")
    assert r.status_code == 200, r.text
    data = r.json()
    # Three distinct top-level totals
    assert "total_productive_hours" in data
    assert "total_scheduled_hours" in data
    assert "total_break_hours" in data

    # Bucket values match seed (2h task, 8h sched, 2h break)
    assert data["total_productive_hours"] == pytest.approx(2.0, abs=0.05), data
    assert data["total_scheduled_hours"] == pytest.approx(8.0, abs=0.05), data
    assert data["total_break_hours"] == pytest.approx(2.0, abs=0.05), data

    # CRITICAL regression guard: scheduled NOT summed into productive
    assert data["total_productive_hours"] != pytest.approx(10.0, abs=0.1)

    # Per-day split also present
    days = data["days"]
    assert len(days) == 7
    for d in days:
        assert "productive_hours" in d
        assert "scheduled_hours" in d
        assert "break_hours" in d


# ---------- CRITICAL: Daily analytics 3-bucket split ----------

def test_daily_analytics_three_buckets(client, seeded_user):
    r = client.get(f"{BASE_URL}/api/analytics/daily", params={"date": seeded_user["date"]})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "productive_seconds" in data
    assert "break_seconds" in data
    assert "scheduled_seconds" in data
    assert data["productive_seconds"] == pytest.approx(7200, abs=60)
    assert data["scheduled_seconds"] == pytest.approx(28800, abs=60)
    assert data["break_seconds"] == pytest.approx(7200, abs=60)


# ---------- CRITICAL: AI weekly report bucket split ----------

def test_weekly_report_data_summary_three_keys(client):
    r = client.post(f"{BASE_URL}/api/reports/weekly", timeout=90)
    # If LLM errors, still want distinct status visibility
    assert r.status_code == 200, f"status={r.status_code} body={r.text[:500]}"
    data = r.json()
    ds = data.get("data_summary", {})
    assert "total_productive_hours" in ds
    assert "total_scheduled_hours" in ds
    assert "total_break_hours" in ds
    assert ds["total_productive_hours"] == pytest.approx(2.0, abs=0.05)
    assert ds["total_scheduled_hours"] == pytest.approx(8.0, abs=0.05)
    assert ds["total_break_hours"] == pytest.approx(2.0, abs=0.05)
    # Per-day only task hours in productive_hours
    for d in ds.get("days", []):
        if d["date"] == datetime.now(timezone.utc).date().isoformat():
            assert d["productive_hours"] == pytest.approx(2.0, abs=0.05)
            assert d["scheduled_hours"] == pytest.approx(8.0, abs=0.05)

    # Content should NOT claim 10h productive (the buggy behavior).
    content = (data.get("content") or "").lower()
    # Weak heuristic: no "10 productive" / "10h productive" / "10 hours productive" style claim
    assert "10 hours of productive" not in content
    assert "10h productive" not in content


# ---------- Entries list has entry_type ----------

def test_entries_include_entry_type(client, seeded_user):
    r = client.get(f"{BASE_URL}/api/entries", params={"date": seeded_user["date"]})
    assert r.status_code == 200, r.text
    entries = r.json()
    assert len(entries) >= 3
    types = {e.get("entry_type") for e in entries}
    assert {"task", "scheduled", "break"}.issubset(types), f"Got types: {types}"


# ---------- Projects CRUD ----------

def test_projects_crud(client):
    # LIST
    r = client.get(f"{BASE_URL}/api/projects")
    assert r.status_code == 200
    # CREATE
    r = client.post(f"{BASE_URL}/api/projects", json={"name": "TEST_Proj", "color": "#123456"})
    assert r.status_code == 200, r.text
    pid = r.json()["project_id"]
    # UPDATE
    r = client.put(f"{BASE_URL}/api/projects/{pid}", json={"name": "TEST_Proj2"})
    assert r.status_code == 200
    assert r.json()["name"] == "TEST_Proj2"
    # DELETE
    r = client.delete(f"{BASE_URL}/api/projects/{pid}")
    assert r.status_code == 200


# ---------- Schedules CRUD ----------

def test_schedules_crud(client):
    r = client.get(f"{BASE_URL}/api/schedules")
    assert r.status_code == 200
    r = client.post(f"{BASE_URL}/api/schedules", json={
        "title": "TEST_Sleep",
        "day_of_week": [0, 1, 2],
        "start_time": "23:00",
        "end_time": "07:00",
        "color": "#1E40AF",
    })
    assert r.status_code == 200, r.text
    sid = r.json()["schedule_id"]
    r = client.put(f"{BASE_URL}/api/schedules/{sid}", json={"title": "TEST_Sleep2"})
    assert r.status_code == 200
    assert r.json()["title"] == "TEST_Sleep2"
    r = client.delete(f"{BASE_URL}/api/schedules/{sid}")
    assert r.status_code == 200


# ---------- Timer start/stop ----------

def test_timer_start_stop_flow(client):
    # Ensure clean slate: stop any running timer
    client.post(f"{BASE_URL}/api/timer/stop")
    r = client.post(f"{BASE_URL}/api/timer/start", json={"description": "TEST_timer_run"})
    assert r.status_code == 200, r.text
    started = r.json()
    assert started["is_running"] is True
    assert started["entry_type"] == "task"

    r = client.post(f"{BASE_URL}/api/timer/stop")
    assert r.status_code == 200, r.text
    stopped = r.json()
    assert stopped["is_running"] is False
    assert stopped.get("duration") is not None
