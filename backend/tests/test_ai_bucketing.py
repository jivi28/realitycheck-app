"""Regression test for AI report + weekly analytics data bucketing.

Protects against the bug where scheduled entries (Sleep, Lectures) were
being counted as "productive hours", causing the AI to claim the user
worked 56h when they actually slept most of it.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from server import _categorize_entry  # noqa: E402


def _entry(entry_type=None, is_break=False, duration=3600):
    return {
        "entry_type": entry_type,
        "is_break": is_break,
        "duration": duration,
        "description": "x",
    }


def test_scheduled_entry_not_counted_as_task():
    """A scheduled entry (Sleep, Lecture) must be categorized as 'scheduled', NOT 'task'."""
    e = _entry(entry_type="scheduled", is_break=False)
    assert _categorize_entry(e) == "scheduled"


def test_break_entry_categorized():
    e = _entry(entry_type="break", is_break=True)
    assert _categorize_entry(e) == "break"


def test_task_entry_categorized():
    e = _entry(entry_type="task", is_break=False)
    assert _categorize_entry(e) == "task"


def test_legacy_entry_without_entry_type():
    """Old entries without entry_type must still be bucketed correctly via is_break."""
    assert _categorize_entry(_entry(entry_type=None, is_break=True)) == "break"
    assert _categorize_entry(_entry(entry_type=None, is_break=False)) == "task"


def test_weekly_summary_bucketing_math():
    """Ensure sum-by-bucket matches raw inputs with no double-counting."""
    entries = [
        _entry(entry_type="task", duration=3600),      # 1h task
        _entry(entry_type="task", duration=1800),      # 0.5h task
        _entry(entry_type="scheduled", duration=28800),  # 8h sleep
        _entry(entry_type="break", is_break=True, duration=7200),  # 2h break
    ]

    task_s = sum(e["duration"] for e in entries if _categorize_entry(e) == "task")
    sched_s = sum(e["duration"] for e in entries if _categorize_entry(e) == "scheduled")
    brk_s = sum(e["duration"] for e in entries if _categorize_entry(e) == "break")

    assert task_s == 5400, f"Expected 1.5h productive, got {task_s}s"
    assert sched_s == 28800, f"Expected 8h scheduled, got {sched_s}s"
    assert brk_s == 7200, f"Expected 2h break, got {brk_s}s"
    # CRITICAL: scheduled must NOT be in task bucket
    assert sched_s != task_s
