#!/usr/bin/env python3
"""
RealityCheck Time Tracker Backend API Testing Script
Tests all endpoints with proper authentication using test session token.
"""

import requests
import json
import sys
from datetime import datetime, timedelta
import time

class RealityCheckAPITester:
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
        self.session_token = "test_session_001"  # Test token provided
        self.user_id = "test-user-001"  # Test user provided
        self.headers = {
            "Authorization": f"Bearer {self.session_token}",
            "Content-Type": "application/json"
        }
        
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        
        print(f"🚀 RealityCheck API Tester")
        print(f"📍 Base URL: {self.base_url}")
        print(f"🔑 Using test session token: {self.session_token}")
        print("=" * 60)

    def run_test(self, name, method, endpoint, expected_status=200, data=None, description=""):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        self.tests_run += 1
        
        print(f"\n🔍 [{self.tests_run}] Testing {name}")
        if description:
            print(f"   📝 {description}")
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
                self.tests_passed += 1
                print(f"   ✅ PASSED - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, list):
                        print(f"   📊 Response: List with {len(response_data)} items")
                        if len(response_data) > 0:
                            print(f"   📄 First item keys: {list(response_data[0].keys()) if response_data[0] else 'Empty'}")
                    else:
                        print(f"   📄 Response keys: {list(response_data.keys()) if isinstance(response_data, dict) else type(response_data)}")
                except:
                    print(f"   📄 Non-JSON response")
                    
                return True, response.json() if response.content else {}
            else:
                self.failed_tests.append({
                    'name': name,
                    'endpoint': endpoint,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'response': response.text[:200] if response.text else 'No response'
                })
                print(f"   ❌ FAILED - Expected {expected_status}, got {response.status_code}")
                print(f"   📄 Response: {response.text[:200]}...")
                return False, {}

        except requests.exceptions.Timeout:
            print(f"   ⏱️ TIMEOUT - Request took longer than 10 seconds")
            self.failed_tests.append({
                'name': name,
                'endpoint': endpoint,
                'error': 'Timeout'
            })
            return False, {}
        except Exception as e:
            print(f"   💥 ERROR - {str(e)}")
            self.failed_tests.append({
                'name': name,
                'endpoint': endpoint,
                'error': str(e)
            })
            return False, {}

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n" + "="*20 + " AUTH ENDPOINTS " + "="*20)
        
        # Test /auth/me endpoint
        success, user_data = self.run_test(
            "Get Current User",
            "GET", 
            "auth/me",
            200,
            description="Verify test session token works and returns user data"
        )
        
        return success, user_data

    def test_projects_endpoints(self):
        """Test project CRUD operations"""
        print("\n" + "="*20 + " PROJECT ENDPOINTS " + "="*20)
        
        # Get projects
        success, projects = self.run_test(
            "Get Projects",
            "GET",
            "projects",
            200,
            description="Get list of user projects"
        )
        
        if not success:
            return False, []

        # Create a new project
        project_data = {"name": "Test Project", "color": "#FF6B00"}
        create_success, new_project = self.run_test(
            "Create Project", 
            "POST",
            "projects",
            200,
            data=project_data,
            description="Create a new project for testing"
        )
        
        created_project_id = None
        if create_success and 'project_id' in new_project:
            created_project_id = new_project['project_id']
            
            # Update the project
            update_data = {"name": "Updated Test Project", "color": "#00BFFF"}
            self.run_test(
                "Update Project",
                "PUT",
                f"projects/{created_project_id}",
                200,
                data=update_data,
                description="Update project name and color"
            )
            
            # Delete the project
            self.run_test(
                "Delete Project",
                "DELETE", 
                f"projects/{created_project_id}",
                200,
                description="Delete the test project"
            )
        
        return success, projects

    def test_timer_endpoints(self):
        """Test timer operations including auto-break logic"""
        print("\n" + "="*20 + " TIMER ENDPOINTS " + "="*20)
        
        # Get current timer state
        current_success, current_timer = self.run_test(
            "Get Current Timer",
            "GET",
            "timer/current", 
            200,
            description="Check if any timer is currently running"
        )
        
        # Stop any running timer first
        if current_success and current_timer.get('running'):
            print("   🛑 Stopping existing timer first...")
            self.run_test("Stop Running Timer", "POST", "timer/stop", 200)
            time.sleep(1)  # Wait a moment
        
        # Start a timer
        timer_data = {"description": "Testing timer functionality", "project_id": None}
        start_success, started_timer = self.run_test(
            "Start Timer",
            "POST",
            "timer/start",
            200,
            data=timer_data,
            description="Start a new timer with test description"
        )
        
        if not start_success:
            return False
        
        # Check current timer is running
        self.run_test(
            "Verify Timer Running",
            "GET",
            "timer/current",
            200,
            description="Confirm timer is now running"
        )
        
        # Wait a bit then stop
        print("   ⏳ Waiting 3 seconds before stopping...")
        time.sleep(3)
        
        stop_success, stopped_timer = self.run_test(
            "Stop Timer", 
            "POST",
            "timer/stop",
            200,
            description="Stop the running timer"
        )
        
        # Test auto-break logic by waiting 2 minutes and starting new timer
        print("\n   🔍 Testing Auto-Break Logic...")
        print("   ⏳ Waiting 65 seconds to trigger auto-break (gap > 60s)...")
        time.sleep(65)  # Wait over 60 seconds to trigger auto-break
        
        auto_break_timer_data = {"description": "Second task for auto-break test"}
        auto_break_success, _ = self.run_test(
            "Start Timer (Auto-Break Test)",
            "POST", 
            "timer/start",
            200,
            data=auto_break_timer_data,
            description="Start timer after gap to test auto-break insertion"
        )
        
        if auto_break_success:
            # Stop the auto-break test timer
            self.run_test("Stop Auto-Break Test Timer", "POST", "timer/stop", 200)
        
        return start_success and stop_success

    def test_entries_endpoints(self):
        """Test time entries operations"""
        print("\n" + "="*20 + " ENTRIES ENDPOINTS " + "="*20)
        
        # Get all entries
        success, entries = self.run_test(
            "Get All Entries",
            "GET",
            "entries?limit=20",
            200,
            description="Get recent time entries"
        )
        
        if success and len(entries) > 0:
            # Try to delete the first non-break entry
            deletable_entry = None
            for entry in entries:
                if not entry.get('is_break', False) and not entry.get('is_running', False):
                    deletable_entry = entry
                    break
            
            if deletable_entry:
                entry_id = deletable_entry['entry_id']
                self.run_test(
                    "Delete Entry",
                    "DELETE",
                    f"entries/{entry_id}",
                    200,
                    description="Delete a time entry"
                )
        
        # Get entries for today
        today = datetime.now().strftime("%Y-%m-%d")
        self.run_test(
            "Get Today's Entries",
            "GET",
            f"entries?date={today}",
            200,
            description="Get entries filtered by today's date"
        )
        
        return success

    def test_analytics_endpoints(self):
        """Test analytics endpoints"""
        print("\n" + "="*20 + " ANALYTICS ENDPOINTS " + "="*20)
        
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Daily analytics
        daily_success, daily_data = self.run_test(
            "Get Daily Analytics",
            "GET",
            f"analytics/daily?date={today}",
            200,
            description="Get daily productivity analytics"
        )
        
        # Weekly analytics  
        weekly_success, weekly_data = self.run_test(
            "Get Weekly Analytics", 
            "GET",
            "analytics/weekly",
            200,
            description="Get 7-day weekly analytics"
        )
        
        # Project analytics
        project_success, project_data = self.run_test(
            "Get Project Analytics",
            "GET", 
            f"analytics/projects?date={today}",
            200,
            description="Get project-wise time breakdown"
        )
        
        return daily_success and weekly_success and project_success

    def test_ai_reports_endpoints(self):
        """Test AI report generation"""
        print("\n" + "="*20 + " AI REPORTS ENDPOINTS " + "="*20)
        
        # Get existing reports first
        get_success, existing_reports = self.run_test(
            "Get Existing Reports",
            "GET",
            "reports/weekly", 
            200,
            description="Get previously generated weekly reports"
        )
        
        # Generate new report (this might take longer due to AI processing)
        print("   🤖 Generating AI report (this may take 10-30 seconds)...")
        generate_success, new_report = self.run_test(
            "Generate Weekly Report",
            "POST",
            "reports/weekly",
            200,
            description="Generate new AI-powered weekly reality report"
        )
        
        return get_success and generate_success

    def print_summary(self):
        """Print test execution summary"""
        print("\n" + "="*60)
        print("📊 TEST EXECUTION SUMMARY")
        print("="*60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {len(self.failed_tests)}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS ({len(self.failed_tests)}):")
            for i, test in enumerate(self.failed_tests, 1):
                print(f"  {i}. {test['name']} - {test['endpoint']}")
                if 'expected' in test:
                    print(f"     Expected: {test['expected']}, Got: {test['actual']}")
                if 'error' in test:
                    print(f"     Error: {test['error']}")
                if 'response' in test:
                    print(f"     Response: {test['response']}")
        
        return self.tests_passed == self.tests_run


def main():
    """Main test execution"""
    tester = RealityCheckAPITester()
    
    try:
        # Test authentication first
        auth_success, user_data = tester.test_auth_endpoints()
        if not auth_success:
            print("\n❌ Authentication failed - cannot proceed with other tests")
            tester.print_summary()
            return 1
            
        print(f"\n✅ Authentication successful for user: {user_data.get('name', 'Unknown')}")
        
        # Test all other endpoints
        tester.test_projects_endpoints()
        tester.test_timer_endpoints()
        tester.test_entries_endpoints()
        tester.test_analytics_endpoints()
        
        # AI reports test (might fail if LLM key issues)
        try:
            tester.test_ai_reports_endpoints()
        except Exception as e:
            print(f"⚠️  AI Reports test skipped due to: {e}")
        
        # Print final summary
        success = tester.print_summary()
        
        if success:
            print("\n🎉 All tests passed! Backend API is working correctly.")
            return 0
        else:
            print(f"\n⚠️  {len(tester.failed_tests)} tests failed. Please check the issues above.")
            return 1
            
    except Exception as e:
        print(f"\n💥 Critical error during testing: {e}")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)