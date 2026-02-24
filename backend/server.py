from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, UploadFile, File
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import httpx
import tempfile
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ===== MODELS =====

class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: Optional[str] = None

class ProjectCreate(BaseModel):
    name: str
    color: str = "#00FF41"

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None

class ProjectOut(BaseModel):
    project_id: str
    user_id: str
    name: str
    color: str
    is_default: bool = False
    created_at: str

class TimerStartRequest(BaseModel):
    description: str = ""
    project_id: Optional[str] = None

class TimerStopRequest(BaseModel):
    pass

class TimeEntryOut(BaseModel):
    entry_id: str
    user_id: str
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    project_color: Optional[str] = None
    description: str
    start_time: str
    end_time: Optional[str] = None
    duration: Optional[float] = None
    is_break: bool = False
    is_running: bool = False
    entry_type: str = "task"  # "task" | "break" | "scheduled"
    schedule_id: Optional[str] = None


# ===== RECURRING SCHEDULE MODELS =====

class ScheduleCreate(BaseModel):
    title: str
    day_of_week: List[int]  # 0=Mon, 6=Sun
    start_time: str  # "23:00"
    end_time: str    # "07:00"
    color: str = "#1E40AF"  # Deep Blue default

class ScheduleUpdate(BaseModel):
    title: Optional[str] = None
    day_of_week: Optional[List[int]] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    color: Optional[str] = None

class ScheduleOut(BaseModel):
    schedule_id: str
    user_id: str
    title: str
    day_of_week: List[int]
    start_time: str
    end_time: str
    color: str
    created_at: str

class AnalyticsDaily(BaseModel):
    date: str
    productive_seconds: float
    break_seconds: float
    entries: List[dict]

class WeeklyAnalytics(BaseModel):
    days: List[dict]
    total_productive_seconds: float
    total_break_seconds: float

# ===== AUTH HELPERS =====

async def get_current_user(request: Request) -> dict:
    """Extract and verify user from session token."""
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token}, {"_id": 0}
    )
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]}, {"_id": 0}
    )
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return user_doc


# ===== AUTH ENDPOINTS =====

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    async with httpx.AsyncClient() as http_client:
        resp = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        data = resp.json()

    email = data["email"]
    name = data["name"]
    picture = data.get("picture", "")
    session_token = data["session_token"]

    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one(
            {"email": email},
            {"$set": {"name": name, "picture": picture}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        # Create default projects for new user
        default_projects = [
            {"name": "Deep Work", "color": "#00FF41", "is_default": True},
            {"name": "Study", "color": "#00CC33", "is_default": False},
            {"name": "Coding", "color": "#33FF66", "is_default": False},
            {"name": "Exercise", "color": "#FFD600", "is_default": False},
            {"name": "Reading", "color": "#00BFFF", "is_default": False},
        ]
        for proj in default_projects:
            await db.projects.insert_one({
                "project_id": f"proj_{uuid.uuid4().hex[:12]}",
                "user_id": user_id,
                "name": proj["name"],
                "color": proj["color"],
                "is_default": proj["is_default"],
                "created_at": datetime.now(timezone.utc).isoformat()
            })

    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )

    return {
        "user_id": user_id,
        "email": email,
        "name": name,
        "picture": picture
    }


@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return UserOut(**user)


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie(key="session_token", path="/", samesite="none", secure=True)
    return {"message": "Logged out"}


# ===== PROJECT ENDPOINTS =====

@api_router.get("/projects", response_model=List[ProjectOut])
async def get_projects(user: dict = Depends(get_current_user)):
    projects = await db.projects.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).to_list(100)
    return projects


@api_router.post("/projects", response_model=ProjectOut)
async def create_project(data: ProjectCreate, user: dict = Depends(get_current_user)):
    project = {
        "project_id": f"proj_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "name": data.name,
        "color": data.color,
        "is_default": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.projects.insert_one(project)
    del project["_id"]
    return project


@api_router.put("/projects/{project_id}", response_model=ProjectOut)
async def update_project(project_id: str, data: ProjectUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data")
    await db.projects.update_one(
        {"project_id": project_id, "user_id": user["user_id"]},
        {"$set": update_data}
    )
    project = await db.projects.find_one(
        {"project_id": project_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, user: dict = Depends(get_current_user)):
    result = await db.projects.delete_one(
        {"project_id": project_id, "user_id": user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Deleted"}


# ===== TIMER / TIME ENTRIES =====

# Maximum timer duration: 12 hours. Anything beyond = likely forgot to stop.
MAX_TIMER_DURATION_SECONDS = 12 * 3600


def _parse_utc(iso_str: str) -> datetime:
    """Parse an ISO string to a timezone-aware UTC datetime."""
    dt = datetime.fromisoformat(iso_str)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _time_to_dt(base_date: datetime, time_str: str) -> datetime:
    """Convert 'HH:MM' to a datetime on the given base_date (UTC)."""
    h, m = map(int, time_str.split(":"))
    return base_date.replace(hour=h, minute=m, second=0, microsecond=0)


async def _fill_gap_with_context(user_id: str, gap_start: datetime, gap_end: datetime):
    """
    Context-aware gap engine. Fills the gap between gap_start and gap_end
    by checking recurring schedules. Any time not covered by a schedule
    becomes an auto-break entry.

    Returns a list of entries inserted (for logging/testing).
    """
    gap_seconds = (gap_end - gap_start).total_seconds()
    if gap_seconds <= 60:
        return []  # Too short, ignore

    # Fetch user's recurring schedules
    schedules = await db.recurring_schedules.find(
        {"user_id": user_id}, {"_id": 0}
    ).to_list(100)

    if not schedules:
        # No schedules: entire gap is auto-break
        entry = _make_break_entry(user_id, gap_start, gap_end)
        await db.time_entries.insert_one(entry)
        logger.info(f"Auto-break: {gap_seconds:.0f}s for user {user_id}")
        return [entry]

    # Build a list of schedule windows that overlap with our gap.
    # We need to check every day the gap spans.
    scheduled_windows = []
    current_day = gap_start.replace(hour=0, minute=0, second=0, microsecond=0)
    end_day = gap_end.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)

    while current_day <= end_day:
        dow = current_day.weekday()  # 0=Monday
        for sched in schedules:
            if dow not in sched.get("day_of_week", []):
                continue

            s_start = _time_to_dt(current_day, sched["start_time"])
            s_end = _time_to_dt(current_day, sched["end_time"])

            # Handle overnight schedules (e.g., 23:00 -> 07:00)
            if s_end <= s_start:
                s_end += timedelta(days=1)

            # Check overlap with our gap
            overlap_start = max(s_start, gap_start)
            overlap_end = min(s_end, gap_end)

            if overlap_start < overlap_end:
                scheduled_windows.append({
                    "start": overlap_start,
                    "end": overlap_end,
                    "title": sched["title"],
                    "color": sched.get("color", "#1E40AF"),
                    "schedule_id": sched["schedule_id"],
                })

        current_day += timedelta(days=1)

    # Sort windows by start time and merge overlapping
    scheduled_windows.sort(key=lambda w: w["start"])

    # Now fill the gap: iterate through, inserting breaks for uncovered segments
    # and scheduled entries for covered segments
    entries_to_insert = []
    cursor = gap_start

    for window in scheduled_windows:
        # Break before this scheduled window
        if cursor < window["start"]:
            brk_duration = (window["start"] - cursor).total_seconds()
            if brk_duration > 60:
                entry = _make_break_entry(user_id, cursor, window["start"])
                entries_to_insert.append(entry)

        # The scheduled window itself
        if cursor < window["end"]:
            sched_start = max(cursor, window["start"])
            sched_duration = (window["end"] - sched_start).total_seconds()
            if sched_duration > 60:
                entry = {
                    "entry_id": f"entry_{uuid.uuid4().hex[:12]}",
                    "user_id": user_id,
                    "project_id": None,
                    "description": window["title"],
                    "start_time": sched_start.isoformat(),
                    "end_time": window["end"].isoformat(),
                    "duration": sched_duration,
                    "is_break": False,
                    "is_running": False,
                    "entry_type": "scheduled",
                    "schedule_id": window["schedule_id"],
                    "schedule_color": window["color"],
                }
                entries_to_insert.append(entry)

        cursor = max(cursor, window["end"])

    # Break after last scheduled window
    if cursor < gap_end:
        brk_duration = (gap_end - cursor).total_seconds()
        if brk_duration > 60:
            entry = _make_break_entry(user_id, cursor, gap_end)
            entries_to_insert.append(entry)

    # Bulk insert
    if entries_to_insert:
        await db.time_entries.insert_many(entries_to_insert)
        for e in entries_to_insert:
            if "_id" in e:
                del e["_id"]
            logger.info(f"Gap fill [{e.get('entry_type','break')}]: {e['description']} "
                        f"{e['start_time']} -> {e['end_time']} for user {user_id}")

    return entries_to_insert


def _make_break_entry(user_id: str, start: datetime, end: datetime) -> dict:
    """Create an auto-break entry dict."""
    return {
        "entry_id": f"entry_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "project_id": None,
        "description": "Unaccounted Time",
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "duration": (end - start).total_seconds(),
        "is_break": True,
        "is_running": False,
        "entry_type": "break",
        "schedule_id": None,
    }


@api_router.post("/timer/start")
async def start_timer(data: TimerStartRequest, user: dict = Depends(get_current_user)):
    user_id = user["user_id"]

    # Check if there's already a running timer
    running = await db.time_entries.find_one(
        {"user_id": user_id, "is_running": True}, {"_id": 0}
    )
    if running:
        # Auto-stop if running for more than MAX_TIMER_DURATION
        start_dt = _parse_utc(running["start_time"])
        elapsed = (datetime.now(timezone.utc) - start_dt).total_seconds()
        if elapsed > MAX_TIMER_DURATION_SECONDS:
            capped_end = start_dt + timedelta(seconds=MAX_TIMER_DURATION_SECONDS)
            await db.time_entries.update_one(
                {"entry_id": running["entry_id"]},
                {"$set": {
                    "end_time": capped_end.isoformat(),
                    "duration": MAX_TIMER_DURATION_SECONDS,
                    "is_running": False
                }}
            )
            logger.info(f"Auto-stopped stale timer {running['entry_id']} (>{MAX_TIMER_DURATION_SECONDS/3600}h)")
        else:
            raise HTTPException(status_code=400, detail="Timer already running. Stop it first.")

    now = datetime.now(timezone.utc)

    # AUTO-BREAK + SCHEDULE-AWARE GAP FILL
    last_entry = await db.time_entries.find_one(
        {"user_id": user_id, "is_running": False, "end_time": {"$ne": None}},
        {"_id": 0},
        sort=[("end_time", -1)]
    )

    if last_entry:
        last_end = _parse_utc(last_entry["end_time"])
        await _fill_gap_with_context(user_id, last_end, now)

    # Resolve project
    project_id = data.project_id
    if not project_id:
        default_proj = await db.projects.find_one(
            {"user_id": user_id, "is_default": True}, {"_id": 0}
        )
        if default_proj:
            project_id = default_proj["project_id"]

    new_entry = {
        "entry_id": f"entry_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "project_id": project_id,
        "description": data.description or "Working",
        "start_time": now.isoformat(),
        "end_time": None,
        "duration": None,
        "is_break": False,
        "is_running": True,
        "entry_type": "task",
        "schedule_id": None,
    }
    await db.time_entries.insert_one(new_entry)
    del new_entry["_id"]

    # Attach project info
    if project_id:
        proj = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
        if proj:
            new_entry["project_name"] = proj["name"]
            new_entry["project_color"] = proj["color"]

    return new_entry


@api_router.post("/timer/stop")
async def stop_timer(user: dict = Depends(get_current_user)):
    user_id = user["user_id"]
    running = await db.time_entries.find_one(
        {"user_id": user_id, "is_running": True}, {"_id": 0}
    )
    if not running:
        raise HTTPException(status_code=400, detail="No running timer")

    now = datetime.now(timezone.utc)
    start_time = datetime.fromisoformat(running["start_time"])
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)
    duration = (now - start_time).total_seconds()

    await db.time_entries.update_one(
        {"entry_id": running["entry_id"]},
        {"$set": {
            "end_time": now.isoformat(),
            "duration": duration,
            "is_running": False
        }}
    )

    running["end_time"] = now.isoformat()
    running["duration"] = duration
    running["is_running"] = False

    if running.get("project_id"):
        proj = await db.projects.find_one({"project_id": running["project_id"]}, {"_id": 0})
        if proj:
            running["project_name"] = proj["name"]
            running["project_color"] = proj["color"]

    return running


@api_router.get("/timer/current")
async def get_current_timer(user: dict = Depends(get_current_user)):
    user_id = user["user_id"]
    running = await db.time_entries.find_one(
        {"user_id": user_id, "is_running": True}, {"_id": 0}
    )
    if not running:
        return {"running": False}

    if running.get("project_id"):
        proj = await db.projects.find_one({"project_id": running["project_id"]}, {"_id": 0})
        if proj:
            running["project_name"] = proj["name"]
            running["project_color"] = proj["color"]

    running["running"] = True
    return running


# ===== TIME ENTRIES =====

@api_router.get("/entries")
async def get_entries(
    date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 50,
    user: dict = Depends(get_current_user)
):
    user_id = user["user_id"]
    query = {"user_id": user_id}

    if date:
        day_start = f"{date}T00:00:00+00:00"
        day_end = f"{date}T23:59:59+00:00"
        query["start_time"] = {"$gte": day_start, "$lte": day_end}
    elif start_date and end_date:
        query["start_time"] = {"$gte": f"{start_date}T00:00:00+00:00", "$lte": f"{end_date}T23:59:59+00:00"}

    entries = await db.time_entries.find(
        query, {"_id": 0}
    ).sort("start_time", -1).to_list(limit)

    # Attach project info
    project_ids = list(set(e.get("project_id") for e in entries if e.get("project_id")))
    projects_map = {}
    if project_ids:
        projects = await db.projects.find(
            {"project_id": {"$in": project_ids}}, {"_id": 0}
        ).to_list(100)
        projects_map = {p["project_id"]: p for p in projects}

    for entry in entries:
        pid = entry.get("project_id")
        if pid and pid in projects_map:
            entry["project_name"] = projects_map[pid]["name"]
            entry["project_color"] = projects_map[pid]["color"]

    return entries


@api_router.delete("/entries/{entry_id}")
async def delete_entry(entry_id: str, user: dict = Depends(get_current_user)):
    result = await db.time_entries.delete_one(
        {"entry_id": entry_id, "user_id": user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Deleted"}


# ===== ANALYTICS =====

@api_router.get("/analytics/daily")
async def get_daily_analytics(date: Optional[str] = None, user: dict = Depends(get_current_user)):
    user_id = user["user_id"]
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    day_start = f"{date}T00:00:00+00:00"
    day_end = f"{date}T23:59:59+00:00"

    entries = await db.time_entries.find(
        {"user_id": user_id, "start_time": {"$gte": day_start, "$lte": day_end}, "is_running": False},
        {"_id": 0}
    ).sort("start_time", 1).to_list(200)

    # Attach project info
    project_ids = list(set(e.get("project_id") for e in entries if e.get("project_id")))
    projects_map = {}
    if project_ids:
        projects = await db.projects.find({"project_id": {"$in": project_ids}}, {"_id": 0}).to_list(100)
        projects_map = {p["project_id"]: p for p in projects}

    productive_seconds = 0
    break_seconds = 0
    enriched = []

    for entry in entries:
        dur = entry.get("duration", 0) or 0
        if entry.get("is_break"):
            break_seconds += dur
        else:
            productive_seconds += dur
        pid = entry.get("project_id")
        if pid and pid in projects_map:
            entry["project_name"] = projects_map[pid]["name"]
            entry["project_color"] = projects_map[pid]["color"]
        enriched.append(entry)

    return {
        "date": date,
        "productive_seconds": productive_seconds,
        "break_seconds": break_seconds,
        "entries": enriched
    }


@api_router.get("/analytics/weekly")
async def get_weekly_analytics(user: dict = Depends(get_current_user)):
    user_id = user["user_id"]
    today = datetime.now(timezone.utc).date()
    start_of_week = today - timedelta(days=today.weekday())

    days = []
    total_productive = 0
    total_break = 0

    for i in range(7):
        day = start_of_week + timedelta(days=i)
        day_str = day.isoformat()
        day_start = f"{day_str}T00:00:00+00:00"
        day_end = f"{day_str}T23:59:59+00:00"

        entries = await db.time_entries.find(
            {"user_id": user_id, "start_time": {"$gte": day_start, "$lte": day_end}, "is_running": False},
            {"_id": 0}
        ).to_list(200)

        prod_s = sum(e.get("duration", 0) or 0 for e in entries if not e.get("is_break"))
        brk_s = sum(e.get("duration", 0) or 0 for e in entries if e.get("is_break"))

        days.append({
            "date": day_str,
            "day_name": day.strftime("%a"),
            "productive_seconds": prod_s,
            "break_seconds": brk_s,
            "productive_hours": round(prod_s / 3600, 2),
            "break_hours": round(brk_s / 3600, 2),
        })
        total_productive += prod_s
        total_break += brk_s

    return {
        "days": days,
        "total_productive_seconds": total_productive,
        "total_break_seconds": total_break,
        "total_productive_hours": round(total_productive / 3600, 2),
        "total_break_hours": round(total_break / 3600, 2),
    }


@api_router.get("/analytics/projects")
async def get_project_analytics(
    date: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    user_id = user["user_id"]
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    day_start = f"{date}T00:00:00+00:00"
    day_end = f"{date}T23:59:59+00:00"

    entries = await db.time_entries.find(
        {"user_id": user_id, "start_time": {"$gte": day_start, "$lte": day_end}, "is_running": False, "is_break": False},
        {"_id": 0}
    ).to_list(200)

    # Aggregate by project
    project_times = {}
    for entry in entries:
        pid = entry.get("project_id") or "uncategorized"
        dur = entry.get("duration", 0) or 0
        if pid not in project_times:
            project_times[pid] = {"seconds": 0, "project_id": pid}
        project_times[pid]["seconds"] += dur

    # Enrich with project names
    project_ids = [pid for pid in project_times if pid != "uncategorized"]
    projects_map = {}
    if project_ids:
        projects = await db.projects.find({"project_id": {"$in": project_ids}}, {"_id": 0}).to_list(100)
        projects_map = {p["project_id"]: p for p in projects}

    result = []
    for pid, data in project_times.items():
        proj = projects_map.get(pid, {})
        result.append({
            "project_id": pid,
            "project_name": proj.get("name", "Uncategorized"),
            "project_color": proj.get("color", "#666666"),
            "seconds": data["seconds"],
            "hours": round(data["seconds"] / 3600, 2),
        })

    result.sort(key=lambda x: x["seconds"], reverse=True)
    return result


# ===== VOICE TRANSCRIPTION (Whisper fallback) =====

@api_router.post("/voice/transcribe")
async def transcribe_voice(audio: UploadFile = File(...), user: dict = Depends(get_current_user)):
    from emergentintegrations.llm.openai import OpenAISpeechToText

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    # Read uploaded audio
    content = await audio.read()
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Audio file too large (max 25MB)")
    if len(content) < 100:
        raise HTTPException(status_code=400, detail="Audio too short")

    # Write to temp file with correct extension
    suffix = ".webm"
    if audio.content_type:
        ct = audio.content_type.lower()
        if "wav" in ct:
            suffix = ".wav"
        elif "mp3" in ct or "mpeg" in ct:
            suffix = ".mp3"
        elif "mp4" in ct or "m4a" in ct:
            suffix = ".m4a"

    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        stt = OpenAISpeechToText(api_key=api_key)
        with open(tmp_path, "rb") as f:
            response = await stt.transcribe(
                file=f,
                model="whisper-1",
                response_format="json",
                language="en",
                prompt="Time tracking voice command. Examples: start studying biology, stop task, start coding, start deep work session."
            )

        text = response.text.strip() if response and response.text else ""
        return {"text": text}
    except Exception as e:
        logger.error(f"Whisper transcription failed: {e}")
        raise HTTPException(status_code=500, detail="Transcription failed")
    finally:
        import os as _os
        try:
            _os.unlink(tmp_path)
        except Exception:
            pass


# ===== AI REALITY REPORT =====

@api_router.post("/reports/weekly")
async def generate_weekly_report(user: dict = Depends(get_current_user)):
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    user_id = user["user_id"]
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    today = datetime.now(timezone.utc).date()
    start_of_week = today - timedelta(days=today.weekday())

    # Gather week data
    week_data = []
    for i in range(7):
        day = start_of_week + timedelta(days=i)
        if day > today:
            break
        day_str = day.isoformat()
        day_start = f"{day_str}T00:00:00+00:00"
        day_end = f"{day_str}T23:59:59+00:00"

        entries = await db.time_entries.find(
            {"user_id": user_id, "start_time": {"$gte": day_start, "$lte": day_end}, "is_running": False},
            {"_id": 0}
        ).to_list(200)

        prod_entries = [e for e in entries if not e.get("is_break")]
        brk_entries = [e for e in entries if e.get("is_break")]

        prod_s = sum(e.get("duration", 0) or 0 for e in prod_entries)
        brk_s = sum(e.get("duration", 0) or 0 for e in brk_entries)

        descs = [e.get("description", "") for e in prod_entries]

        week_data.append({
            "day": day.strftime("%A"),
            "date": day_str,
            "productive_hours": round(prod_s / 3600, 2),
            "break_hours": round(brk_s / 3600, 2),
            "tasks": descs[:10],
            "num_entries": len(prod_entries),
            "longest_streak_min": 0,
        })

        # Calculate longest streak
        if prod_entries:
            max_dur = max(e.get("duration", 0) or 0 for e in prod_entries)
            week_data[-1]["longest_streak_min"] = round(max_dur / 60, 1)

    total_productive = sum(d["productive_hours"] for d in week_data)
    total_break = sum(d["break_hours"] for d in week_data)

    data_summary = f"""
WEEKLY TIME DATA FOR USER:
Total Productive Hours: {total_productive:.1f}
Total Break/Unaccounted Hours: {total_break:.1f}
Days Tracked: {len(week_data)}

DAILY BREAKDOWN:
"""
    for d in week_data:
        data_summary += f"\n{d['day']} ({d['date']}):"
        data_summary += f"\n  Productive: {d['productive_hours']}h | Breaks: {d['break_hours']}h"
        data_summary += f"\n  Sessions: {d['num_entries']} | Longest Focus: {d['longest_streak_min']}min"
        if d['tasks']:
            data_summary += f"\n  Tasks: {', '.join(d['tasks'][:5])}"

    chat = LlmChat(
        api_key=api_key,
        session_id=f"report_{user_id}_{today.isoformat()}",
        system_message="""You are a Brutal Productivity Analyst. You analyze time tracking data and deliver harsh, data-driven reality checks. You are NOT a motivational coach. You are a forensic auditor of human attention.

Rules:
- Be specific with numbers. Use the exact data provided.
- Point out patterns of self-deception (e.g., "you think you worked 10 hours but only 3 were deep work")
- Highlight the ratio of break time to productive time ruthlessly
- Note if focus sessions are short (under 45 min = fragmented attention)
- Compare productive hours to a standard 8-hour workday
- Give 2-3 actionable, specific recommendations
- Keep tone sharp, direct, almost sardonic. No fluff, no "great job!"
- Use short punchy paragraphs
- Format with markdown headers and bullet points"""
    )
    chat.with_model("openai", "gpt-4.1")

    message = UserMessage(text=f"Analyze this week's time tracking data and deliver a brutal reality check:\n{data_summary}")

    try:
        response = await chat.send_message(message)
    except Exception as e:
        logger.error(f"AI report generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate report")

    report = {
        "report_id": f"report_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "week_start": start_of_week.isoformat(),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "content": response,
        "data_summary": {
            "total_productive_hours": total_productive,
            "total_break_hours": total_break,
            "days": week_data,
        }
    }
    await db.ai_reports.insert_one(report)

    report_copy = {k: v for k, v in report.items() if k != "_id"}
    return report_copy


@api_router.get("/reports/weekly")
async def get_weekly_reports(user: dict = Depends(get_current_user)):
    reports = await db.ai_reports.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("generated_at", -1).to_list(10)
    return reports


# Include the router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
