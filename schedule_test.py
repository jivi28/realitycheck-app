#!/usr/bin/env python3
"""
Test the new Schedule-related endpoints specifically
"""

import requests
import json
import sys
from datetime import datetime, timedelta
import time

class ScheduleAPITester:
    def __init__(self):
        # Read backend URL from frontend env file
        with open('/app/frontend/.env', 'r') as f:
            env_content = f.read()
        
        for line in env_content.split('\n'):
            if line.startswith('REACT_APP_BACKEND_URL='):
                self.base_url = line.split('=', 1)[1].strip()
                break
        else:
            raise Exception("REACT_APP_BACKEND_URL not found in frontend/.env")
        
        self.api_url = f"{self.base_url}/api"
        self.session_token = "test_session_001"
        self.user_id = "test-user-001"
        self.headers = {
            "Authorization": f"Bearer {self.session_token}",
            "Content-Type": "application/json"
        }
        
        print(f"🚀 Schedule API Tester")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 60)

    def run_test(self, name, method, endpoint, expected_status=200, data=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        
        print(f"\n🔍 Testing {name}")
        print(f"   🌐 {method} {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=self.headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, headers=self.headers, json=data, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, headers=self.headers, json=data, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=self.headers, timeout=10)

            success = response.status_code == expected_status
            
            if success:
                print(f"   ✅ PASSED - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   📄 Response: {json.dumps(response_data, indent=2)}")
                except:
                    print(f"   📄 Non-JSON response: {response.text}")
                return True, response.json() if response.content else {}
            else:
                print(f"   ❌ FAILED - Expected {expected_status}, got {response.status_code}")
                print(f"   📄 Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"   💥 ERROR - {str(e)}")
            return False, {}

    def test_schedules_crud(self):
        """Test all schedule CRUD operations"""
        print("\n" + "="*20 + " SCHEDULE CRUD TESTS " + "="*20)
        
        # 1. Get existing schedules
        success, schedules = self.run_test(
            "Get Schedules (Empty/Existing)",
            "GET",
            "schedules"
        )
        
        if not success:
            return False
            
        print(f"   📊 Found {len(schedules) if schedules else 0} existing schedules")
        
        # 2. Create a Sleep schedule (Sleep 23:00-07:00)
        sleep_schedule = {
            "title": "Sleep",
            "day_of_week": [0, 1, 2, 3, 4, 5, 6],  # All days
            "start_time": "23:00", 
            "end_time": "07:00",
            "color": "#1E40AF"
        }
        
        create_success, created_schedule = self.run_test(
            "Create Sleep Schedule (23:00-07:00)",
            "POST",
            "schedules",
            data=sleep_schedule
        )
        
        if not create_success:
            return False
            
        schedule_id = created_schedule.get('schedule_id')
        print(f"   ✨ Created schedule with ID: {schedule_id}")
        
        # 3. Create another schedule for Gym
        gym_schedule = {
            "title": "Gym",
            "day_of_week": [0, 2, 4],  # Mon, Wed, Fri
            "start_time": "18:00",
            "end_time": "19:30", 
            "color": "#059669"
        }
        
        gym_create_success, gym_created = self.run_test(
            "Create Gym Schedule",
            "POST", 
            "schedules",
            data=gym_schedule
        )
        
        gym_schedule_id = None
        if gym_create_success:
            gym_schedule_id = gym_created.get('schedule_id')
        
        # 4. Get schedules again to verify creation
        get_success, updated_schedules = self.run_test(
            "Get Schedules (After Creation)",
            "GET",
            "schedules"
        )
        
        if get_success:
            print(f"   📊 Now have {len(updated_schedules)} total schedules")
        
        # 5. Update the Sleep schedule
        if schedule_id:
            update_data = {
                "title": "Updated Sleep Schedule",
                "start_time": "22:30",
                "end_time": "06:30",
                "color": "#2563EB"
            }
            
            update_success, updated = self.run_test(
                "Update Sleep Schedule",
                "PUT",
                f"schedules/{schedule_id}",
                data=update_data
            )
        
        # 6. Delete the Gym schedule
        if gym_schedule_id:
            delete_success, _ = self.run_test(
                "Delete Gym Schedule",
                "DELETE",
                f"schedules/{gym_schedule_id}"
            )
        
        return True
    
    def test_schedule_aware_gap_fill(self):
        """Test the schedule-aware gap filling logic"""
        print("\n" + "="*20 + " SCHEDULE-AWARE GAP FILL TEST " + "="*20)
        
        # First, ensure we have a Sleep schedule
        schedules_success, schedules = self.run_test("Get Schedules for Gap Test", "GET", "schedules")
        
        sleep_schedule_exists = any(s.get('title', '').lower() == 'sleep' or 
                                 'sleep' in s.get('title', '').lower() 
                                 for s in schedules if schedules)
        
        if not sleep_schedule_exists:
            # Create a sleep schedule for testing
            sleep_schedule = {
                "title": "Sleep",
                "day_of_week": [0, 1, 2, 3, 4, 5, 6],
                "start_time": "23:00",
                "end_time": "07:00", 
                "color": "#1E40AF"
            }
            
            create_success, _ = self.run_test(
                "Create Sleep Schedule for Gap Test",
                "POST",
                "schedules", 
                data=sleep_schedule
            )
            
            if not create_success:
                print("   ⚠️  Could not create sleep schedule for gap test")
                return False
        
        # Stop any running timer
        self.run_test("Stop Any Running Timer", "POST", "timer/stop")
        
        # Start a timer, wait, then stop (to create a gap)
        print("\n   📝 Step 1: Create initial time entry")
        timer_data = {"description": "Task before gap", "project_id": None}
        start1_success, _ = self.run_test("Start Initial Timer", "POST", "timer/start", data=timer_data)
        
        if not start1_success:
            return False
            
        time.sleep(3)  # Short task
        stop1_success, _ = self.run_test("Stop Initial Timer", "POST", "timer/stop") 
        
        print("\n   ⏳ Step 2: Wait 65 seconds to create gap > 60s")
        time.sleep(65)
        
        print("\n   📝 Step 3: Start new timer (should trigger gap fill)")
        timer_data2 = {"description": "Task after gap - should create break+schedule+break", "project_id": None}
        start2_success, _ = self.run_test("Start Timer After Gap", "POST", "timer/start", data=timer_data2)
        
        if start2_success:
            # Stop the timer
            self.run_test("Stop Gap Test Timer", "POST", "timer/stop")
            
            # Check entries to see if auto-break and scheduled entries were created
            today = datetime.now().strftime("%Y-%m-%d")
            entries_success, entries = self.run_test(
                "Check Entries After Gap Fill",
                "GET", 
                f"entries?date={today}&limit=10"
            )
            
            if entries_success and entries:
                print(f"\n   📊 Found {len(entries)} entries today:")
                for entry in entries[:5]:  # Show recent 5
                    entry_type = entry.get('entry_type', 'unknown')
                    desc = entry.get('description', 'No description')
                    duration = entry.get('duration', 0)
                    mins = int(duration / 60) if duration else 0
                    print(f"      - {entry_type.upper()}: {desc} ({mins}m)")
                
                # Check if we have break and scheduled entries
                entry_types = [e.get('entry_type') for e in entries]
                has_break = 'break' in entry_types
                has_scheduled = 'scheduled' in entry_types
                
                print(f"\n   🔍 Gap fill analysis:")
                print(f"      - Break entries created: {has_break}")
                print(f"      - Scheduled entries created: {has_scheduled}")
                
                return has_break or has_scheduled
        
        return False

    def test_daily_analytics_scheduled_field(self):
        """Test that daily analytics returns scheduled_seconds field"""
        print("\n" + "="*20 + " DAILY ANALYTICS SCHEDULED FIELD " + "="*20)
        
        today = datetime.now().strftime("%Y-%m-%d")
        
        success, data = self.run_test(
            "Daily Analytics with scheduled_seconds",
            "GET",
            f"analytics/daily?date={today}"
        )
        
        if success and data:
            has_scheduled_field = 'scheduled_seconds' in data
            scheduled_value = data.get('scheduled_seconds', 0)
            
            print(f"\n   📊 Analytics Data:")
            print(f"      - productive_seconds: {data.get('productive_seconds', 0)}")
            print(f"      - break_seconds: {data.get('break_seconds', 0)}")
            print(f"      - scheduled_seconds: {scheduled_value}")
            print(f"      - Has scheduled_seconds field: {has_scheduled_field}")
            
            return has_scheduled_field
        
        return False

    def test_entries_entry_type_field(self):
        """Test that entries return entry_type field"""
        print("\n" + "="*20 + " ENTRIES ENTRY_TYPE FIELD " + "="*20)
        
        success, entries = self.run_test(
            "Get Entries with entry_type field",
            "GET", 
            "entries?limit=10"
        )
        
        if success and entries:
            print(f"\n   📊 Checking {len(entries)} entries for entry_type field:")
            
            has_entry_type_field = True
            entry_type_values = set()
            
            for i, entry in enumerate(entries[:5]):
                entry_type = entry.get('entry_type')
                entry_type_values.add(entry_type)
                has_field = entry_type is not None
                desc = entry.get('description', 'No desc')[:30]
                
                print(f"      - Entry {i+1}: {desc} -> entry_type: '{entry_type}' ({has_field})")
                
                if not has_field:
                    has_entry_type_field = False
            
            print(f"\n   🔍 Entry type analysis:")
            print(f"      - All entries have entry_type field: {has_entry_type_field}")
            print(f"      - Unique entry_type values: {list(entry_type_values)}")
            
            return has_entry_type_field and len(entry_type_values) > 0
        
        return False


def main():
    """Main test execution"""
    tester = ScheduleAPITester()
    
    try:
        print("🧪 Testing Schedule-specific features...")
        
        # Test schedule CRUD
        crud_success = tester.test_schedules_crud()
        
        # Test entry_type field
        entry_type_success = tester.test_entries_entry_type_field()
        
        # Test daily analytics scheduled field  
        analytics_success = tester.test_daily_analytics_scheduled_field()
        
        # Test schedule-aware gap fill (this takes time)
        gap_fill_success = tester.test_schedule_aware_gap_fill()
        
        print("\n" + "="*60)
        print("📊 SCHEDULE TESTS SUMMARY")
        print("="*60)
        print(f"✅ Schedule CRUD: {'PASS' if crud_success else 'FAIL'}")
        print(f"✅ Entry Type Field: {'PASS' if entry_type_success else 'FAIL'}")
        print(f"✅ Analytics Scheduled Field: {'PASS' if analytics_success else 'FAIL'}")
        print(f"✅ Schedule-Aware Gap Fill: {'PASS' if gap_fill_success else 'FAIL'}")
        
        all_success = crud_success and entry_type_success and analytics_success and gap_fill_success
        
        if all_success:
            print("\n🎉 All schedule features working correctly!")
            return 0
        else:
            print(f"\n⚠️  Some schedule features need attention.")
            return 1
            
    except Exception as e:
        print(f"\n💥 Critical error during schedule testing: {e}")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)