import requests
import sys
from datetime import datetime
import json

class TestEnvironmentManagerAPI:
    def __init__(self, base_url="https://microenv-manager.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.admin_token = None
        self.user_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        if data:
            print(f"   Data: {json.dumps(data, indent=2)}")
        if params:
            print(f"   Params: {params}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, params=params)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, params=params)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, params=params)

            print(f"   Response Status: {response.status_code}")
            print(f"   Response: {response.text[:200]}...")

            success = response.status_code == expected_status
            if success:
                self.log_test(name, True)
                return True, response.json() if response.text else {}
            else:
                self.log_test(name, False, f"Expected {expected_status}, got {response.status_code}")
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@example.com", "password": "Solab-123"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            print(f"   Admin token: {self.admin_token}")
            return True
        return False

    def test_user_management(self):
        """Test user CRUD operations"""
        if not self.admin_token:
            self.log_test("User Management", False, "No admin token")
            return False

        # Create user
        user_data = {
            "email": f"test_user_{datetime.now().strftime('%H%M%S')}@example.com",
            "password": "TestPass123!",
            "role": "User",
            "first_name": "Test",
            "last_name": "User",
            "team_name": "Test Team"
        }
        
        success, response = self.run_test(
            "Create User",
            "POST",
            "users",
            200,
            data=user_data,
            params={"admin_token": self.admin_token}
        )
        
        if not success:
            return False
            
        user_id = response.get('id')
        if not user_id:
            self.log_test("User Management", False, "No user ID returned")
            return False

        # Get users
        success, _ = self.run_test(
            "Get Users",
            "GET",
            "users",
            200,
            params={"admin_token": self.admin_token}
        )
        
        if not success:
            return False

        # Update user
        user_data['first_name'] = "Updated"
        success, _ = self.run_test(
            "Update User",
            "PUT",
            f"users/{user_id}",
            200,
            data=user_data,
            params={"admin_token": self.admin_token}
        )
        
        if not success:
            return False

        # Delete user
        success, _ = self.run_test(
            "Delete User",
            "DELETE",
            f"users/{user_id}",
            200,
            params={"admin_token": self.admin_token}
        )
        
        return success

    def test_microservices_management(self):
        """Test microservices CRUD operations"""
        if not self.admin_token:
            self.log_test("Microservices Management", False, "No admin token")
            return False

        # Create microservice
        ms_data = {"name": f"Test_MS_{datetime.now().strftime('%H%M%S')}"}
        
        success, response = self.run_test(
            "Create Microservice",
            "POST",
            "microservices",
            200,
            data=ms_data,
            params={"admin_token": self.admin_token}
        )
        
        if not success:
            return False
            
        ms_id = response.get('id')
        if not ms_id:
            self.log_test("Microservices Management", False, "No microservice ID returned")
            return False

        # Get microservices
        success, _ = self.run_test(
            "Get Microservices",
            "GET",
            "microservices",
            200
        )
        
        if not success:
            return False

        # Update microservice
        ms_data['name'] = "Updated_MS"
        success, _ = self.run_test(
            "Update Microservice",
            "PUT",
            f"microservices/{ms_id}",
            200,
            data=ms_data,
            params={"admin_token": self.admin_token}
        )
        
        if not success:
            return False

        # Delete microservice
        success, _ = self.run_test(
            "Delete Microservice",
            "DELETE",
            f"microservices/{ms_id}",
            200,
            params={"admin_token": self.admin_token}
        )
        
        return success

    def test_environments_management(self):
        """Test environments CRUD operations"""
        if not self.admin_token:
            self.log_test("Environments Management", False, "No admin token")
            return False

        # Create environment
        env_data = {"name": f"Test_Env_{datetime.now().strftime('%H%M%S')}", "is_second": False}
        
        success, response = self.run_test(
            "Create Environment",
            "POST",
            "environments",
            200,
            data=env_data,
            params={"admin_token": self.admin_token}
        )
        
        if not success:
            return False
            
        env_id = response.get('id')
        if not env_id:
            self.log_test("Environments Management", False, "No environment ID returned")
            return False

        # Get environments
        success, _ = self.run_test(
            "Get Environments",
            "GET",
            "environments",
            200
        )
        
        if not success:
            return False

        # Update environment
        env_data['is_second'] = True
        success, _ = self.run_test(
            "Update Environment",
            "PUT",
            f"environments/{env_id}",
            200,
            data=env_data,
            params={"admin_token": self.admin_token}
        )
        
        if not success:
            return False

        # Delete environment
        success, _ = self.run_test(
            "Delete Environment",
            "DELETE",
            f"environments/{env_id}",
            200,
            params={"admin_token": self.admin_token}
        )
        
        return success

    def test_work_items_flow(self):
        """Test work items creation and management"""
        if not self.admin_token:
            self.log_test("Work Items Flow", False, "No admin token")
            return False

        # First create a test user to work with
        user_data = {
            "email": f"workitem_user_{datetime.now().strftime('%H%M%S')}@example.com",
            "password": "TestPass123!",
            "role": "User",
            "first_name": "WorkItem",
            "last_name": "Tester",
            "team_name": "Test Team"
        }
        
        success, user_response = self.run_test(
            "Create Test User for Work Items",
            "POST",
            "users",
            200,
            data=user_data,
            params={"admin_token": self.admin_token}
        )
        
        if not success:
            return False

        # Login as the test user
        success, login_response = self.run_test(
            "Login Test User",
            "POST",
            "auth/login",
            200,
            data={"email": user_data["email"], "password": user_data["password"]}
        )
        
        if not success:
            return False
            
        user_token = login_response.get('token')
        if not user_token:
            self.log_test("Work Items Flow", False, "No user token")
            return False

        # Get microservices to use in work item
        success, ms_response = self.run_test(
            "Get Microservices for Work Item",
            "GET",
            "microservices",
            200
        )
        
        if not success:
            return False

        # Create work item
        microservices_dict = {}
        if ms_response and len(ms_response) > 0:
            # Select first microservice
            microservices_dict[ms_response[0]['id']] = True

        work_item_data = {
            "work_item_name": f"Test_WorkItem_{datetime.now().strftime('%H%M%S')}",
            "microservices": microservices_dict,
            "environment": "QA",
            "can_temp_branch": True
        }
        
        success, wi_response = self.run_test(
            "Create Work Item",
            "POST",
            "work-items",
            200,
            data=work_item_data,
            params={"user_token": user_token}
        )
        
        if not success:
            return False
            
        work_item_id = wi_response.get('id')
        if not work_item_id:
            self.log_test("Work Items Flow", False, "No work item ID returned")
            return False

        # Get work items
        success, _ = self.run_test(
            "Get Work Items",
            "GET",
            "work-items",
            200,
            params={"user_token": user_token}
        )
        
        if not success:
            return False

        # Update work item
        update_data = {"work_item_name": "Updated_WorkItem"}
        success, _ = self.run_test(
            "Update Work Item",
            "PUT",
            f"work-items/{work_item_id}",
            200,
            data=update_data,
            params={"user_token": user_token}
        )
        
        if not success:
            return False

        # Delete work item
        success, _ = self.run_test(
            "Delete Work Item",
            "DELETE",
            f"work-items/{work_item_id}",
            200,
            params={"user_token": user_token}
        )
        
        if not success:
            return False

        # Clean up - delete test user
        user_id = user_response.get('id')
        if user_id:
            self.run_test(
                "Cleanup Test User",
                "DELETE",
                f"users/{user_id}",
                200,
                params={"admin_token": self.admin_token}
            )
        
        return True

    def test_assignments_generation(self):
        """Test assignment generation logic"""
        if not self.admin_token:
            self.log_test("Assignments Generation", False, "No admin token")
            return False

        # Generate assignments
        success, response = self.run_test(
            "Generate Assignments",
            "POST",
            "generate-assignments",
            200,
            params={"admin_token": self.admin_token}
        )
        
        if not success:
            return False

        # Get assignments
        success, _ = self.run_test(
            "Get Assignments",
            "GET",
            "assignments",
            200,
            params={"admin_token": self.admin_token}
        )
        
        return success

    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting Test Environment Manager API Tests")
        print(f"   Base URL: {self.base_url}")
        print("=" * 60)

        # Test admin login first
        if not self.test_admin_login():
            print("\n❌ Admin login failed - stopping tests")
            return False

        # Run all test suites
        test_suites = [
            ("User Management", self.test_user_management),
            ("Microservices Management", self.test_microservices_management),
            ("Environments Management", self.test_environments_management),
            ("Work Items Flow", self.test_work_items_flow),
            ("Assignments Generation", self.test_assignments_generation)
        ]

        for suite_name, test_func in test_suites:
            print(f"\n📋 Running {suite_name} tests...")
            try:
                test_func()
            except Exception as e:
                self.log_test(suite_name, False, f"Exception: {str(e)}")

        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print("⚠️  Some tests failed")
            return False

def main():
    tester = TestEnvironmentManagerAPI()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())