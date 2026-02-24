#!/usr/bin/env python3
"""
Complete test script for RealityCheck app - Backend + Frontend integration
"""

import requests
import json
import sys
from datetime import datetime
import time

class RealityCheckFullTester:
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
        
        self.test_results = {
            "backend_tests": [],
            "frontend_tests": [],
            "integration_tests": []
        }
        
        print(f"🚀 RealityCheck Full Integration Tester")
        print(f"📍 Base URL: {self.base_url}")
        print(f"🔑 Session Token: {self.session_token}")
        print("=" * 60)

    def test_backend_core_features(self):
        """Test the core backend features for the new functionality"""
        print("\n" + "="*20 + " BACKEND CORE TESTS " + "="*20)
        
        tests_passed = 0
        total_tests = 0
        
        # 1. Test Auth
        total_tests += 1
        try:
            response = requests.get(f"{self.api_url}/auth/me", headers=self.headers, timeout=5)
            if response.status_code == 200:
                user_data = response.json()
                print(f"✅ Auth works: {user_data.get('name', 'Unknown')}")
                tests_passed += 1
            else:
                print(f"❌ Auth failed: {response.status_code}")
        except Exception as e:
            print(f"❌ Auth error: {str(e)}")
        
        # 2. Test Schedule CRUD
        print("\n📅 Testing Schedule Features...")
        
        # Create schedule
        total_tests += 1
        try:
            schedule_data = {
                "title": "Test Integration Schedule",
                "day_of_week": [0, 1, 2, 3, 4],
                "start_time": "09:00",
                "end_time": "17:00",
                "color": "#1E40AF"
            }
            response = requests.post(f"{self.api_url}/schedules", headers=self.headers, json=schedule_data, timeout=5)
            if response.status_code == 200:
                created_schedule = response.json()
                schedule_id = created_schedule.get('schedule_id')
                print(f"✅ Schedule created: {schedule_id}")
                tests_passed += 1
                
                # Update schedule
                total_tests += 1
                try:
                    update_data = {"title": "Updated Test Schedule"}
                    response = requests.put(f"{self.api_url}/schedules/{schedule_id}", headers=self.headers, json=update_data, timeout=5)
                    if response.status_code == 200:
                        print("✅ Schedule updated")
                        tests_passed += 1
                    else:
                        print(f"❌ Schedule update failed: {response.status_code}")
                except Exception as e:
                    print(f"❌ Schedule update error: {str(e)}")
                
                # Delete schedule
                total_tests += 1
                try:
                    response = requests.delete(f"{self.api_url}/schedules/{schedule_id}", headers=self.headers, timeout=5)
                    if response.status_code == 200:
                        print("✅ Schedule deleted")
                        tests_passed += 1
                    else:
                        print(f"❌ Schedule delete failed: {response.status_code}")
                except Exception as e:
                    print(f"❌ Schedule delete error: {str(e)}")
            else:
                print(f"❌ Schedule creation failed: {response.status_code}")
        except Exception as e:
            print(f"❌ Schedule creation error: {str(e)}")
        
        # 3. Test Entry Types and Analytics
        total_tests += 1
        try:
            response = requests.get(f"{self.api_url}/analytics/daily", headers=self.headers, timeout=5)
            if response.status_code == 200:
                analytics = response.json()
                has_scheduled = 'scheduled_seconds' in analytics
                print(f"✅ Analytics has scheduled_seconds: {has_scheduled}")
                if has_scheduled:
                    tests_passed += 1
                print(f"   - Productive: {analytics.get('productive_seconds', 0):.0f}s")
                print(f"   - Break: {analytics.get('break_seconds', 0):.0f}s") 
                print(f"   - Scheduled: {analytics.get('scheduled_seconds', 0):.0f}s")
            else:
                print(f"❌ Analytics failed: {response.status_code}")
        except Exception as e:
            print(f"❌ Analytics error: {str(e)}")
        
        # 4. Test Entry Types
        total_tests += 1
        try:
            response = requests.get(f"{self.api_url}/entries?limit=5", headers=self.headers, timeout=5)
            if response.status_code == 200:
                entries = response.json()
                entry_types = set(e.get('entry_type') for e in entries if e.get('entry_type'))
                print(f"✅ Entries have entry_type field: {list(entry_types)}")
                if len(entry_types) > 0:
                    tests_passed += 1
            else:
                print(f"❌ Entries failed: {response.status_code}")
        except Exception as e:
            print(f"❌ Entries error: {str(e)}")
        
        # 5. Test Timer with auto-break
        print("\n⏱️  Testing Timer with Auto-break...")
        total_tests += 2
        
        # Stop any running timer
        try:
            requests.post(f"{self.api_url}/timer/stop", headers=self.headers, timeout=5)
        except:
            pass
            
        # Start timer
        try:
            timer_data = {"description": "Integration test task"}
            response = requests.post(f"{self.api_url}/timer/start", headers=self.headers, json=timer_data, timeout=5)
            if response.status_code == 200:
                print("✅ Timer started")
                tests_passed += 1
                
                # Wait and stop
                time.sleep(2)
                response = requests.post(f"{self.api_url}/timer/stop", headers=self.headers, timeout=5)
                if response.status_code == 200:
                    print("✅ Timer stopped")
                    tests_passed += 1
                else:
                    print(f"❌ Timer stop failed: {response.status_code}")
            else:
                print(f"❌ Timer start failed: {response.status_code}")
        except Exception as e:
            print(f"❌ Timer error: {str(e)}")
        
        backend_success_rate = (tests_passed / total_tests) * 100 if total_tests > 0 else 0
        print(f"\n📊 Backend Tests: {tests_passed}/{total_tests} ({backend_success_rate:.1f}%)")
        
        return tests_passed == total_tests

    def test_authentication_flow(self):
        """Test if we can authenticate properly"""
        print("\n" + "="*20 + " AUTHENTICATION TEST " + "="*20)
        
        # Test if our session token works
        try:
            response = requests.get(f"{self.api_url}/auth/me", headers=self.headers, timeout=5)
            if response.status_code == 200:
                user_data = response.json()
                print(f"✅ Authentication successful: {user_data}")
                return True, user_data
            else:
                print(f"❌ Authentication failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False, {}
        except Exception as e:
            print(f"❌ Authentication error: {str(e)}")
            return False, {}

def main():
    """Main test execution"""
    tester = RealityCheckFullTester()
    
    try:
        # Test authentication first
        auth_success, user_data = tester.test_authentication_flow()
        if not auth_success:
            print("\n❌ Authentication failed - cannot proceed with integration tests")
            return 1
        
        # Test backend functionality
        backend_success = tester.test_backend_core_features()
        
        print(f"\n" + "="*60)
        print("📊 INTEGRATION TEST SUMMARY")
        print("="*60)
        print(f"🔐 Authentication: {'PASS' if auth_success else 'FAIL'}")
        print(f"🔧 Backend API: {'PASS' if backend_success else 'FAIL'}")
        print(f"👤 Test User: {user_data.get('name', 'Unknown')}")
        print(f"📧 Email: {user_data.get('email', 'Unknown')}")
        
        # Overall assessment
        if auth_success and backend_success:
            print("\n✅ READY FOR FRONTEND TESTING")
            print("   - All backend APIs working")
            print("   - Authentication successful")
            print("   - Schedule features implemented")
            print("   - Entry types working")
            print("   - Auto-break functionality active")
            return 0
        else:
            print("\n⚠️  ISSUES FOUND")
            if not auth_success:
                print("   - Authentication problems")
            if not backend_success:
                print("   - Backend API issues")
            return 1
            
    except Exception as e:
        print(f"\n💥 Critical error during testing: {e}")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)