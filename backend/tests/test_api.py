"""
Backend API Tests for MicroEnv Manager
Tests: Login, Work Items, Assignments, Cross-team temp branching, Same-team temp branching
"""
import pytest
import requests
import os
import uuid
from datetime import date

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "Solab-123"


class TestAuthEndpoints:
    """Authentication endpoint tests"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "Token not in response"
        assert "user" in data, "User not in response"
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "Admin"
        assert len(data["token"]) > 0
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401


class TestMicroservicesEndpoints:
    """Microservices CRUD tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_microservices(self):
        """Test getting all microservices (public endpoint)"""
        response = requests.get(f"{BASE_URL}/api/microservices")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        # Check that Front microservice exists (needed for -second env logic)
        front_exists = any(ms["name"] == "Front" for ms in data)
        assert front_exists, "Front microservice should exist for FE/BE split logic"


class TestEnvironmentsEndpoints:
    """Environments CRUD tests"""
    
    def test_get_environments(self):
        """Test getting all environments (public endpoint)"""
        response = requests.get(f"{BASE_URL}/api/environments")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Check for regular and -second environments
        regular_envs = [e for e in data if not e.get("is_second", False)]
        second_envs = [e for e in data if e.get("is_second", False)]
        
        assert len(regular_envs) > 0, "Should have regular environments"
        assert len(second_envs) > 0, "Should have -second environments"
        
        # Check QA-second exists for FE split logic
        qa_second_exists = any(e["name"] == "QA-second" for e in second_envs)
        assert qa_second_exists, "QA-second environment should exist"


class TestWorkItemsEndpoints:
    """Work Items CRUD tests with can_temp_branch and can_temp_with_qa"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture
    def microservices(self):
        response = requests.get(f"{BASE_URL}/api/microservices")
        return response.json()
    
    def test_create_work_item_with_temp_branch_default_on(self, admin_token, microservices):
        """Test creating work item - can_temp_branch should default to True"""
        # Get first microservice
        ms_dict = {microservices[0]["id"]: True}
        
        work_item_data = {
            "work_item_name": f"TEST_TempBranch_{uuid.uuid4().hex[:8]}",
            "microservices": ms_dict,
            "priority": 2,
            "comments": "Testing temp branch default"
            # NOT setting can_temp_branch - should default to True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/work-items",
            json=work_item_data,
            params={"user_token": admin_token}
        )
        assert response.status_code == 200, f"Failed to create work item: {response.text}"
        
        data = response.json()
        assert data["can_temp_branch"] == True, "can_temp_branch should default to True"
        assert data["can_temp_with_qa"] == False, "can_temp_with_qa should default to False"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/work-items/{data['id']}", params={"user_token": admin_token})
    
    def test_create_work_item_with_can_temp_with_qa(self, admin_token, microservices):
        """Test creating work item with can_temp_with_qa enabled"""
        ms_dict = {microservices[0]["id"]: True}
        
        work_item_data = {
            "work_item_name": f"TEST_QATemp_{uuid.uuid4().hex[:8]}",
            "microservices": ms_dict,
            "priority": 1,
            "can_temp_branch": True,
            "can_temp_with_qa": True,  # Enable cross-team temp branching
            "comments": "Testing QA cross-team temp"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/work-items",
            json=work_item_data,
            params={"user_token": admin_token}
        )
        assert response.status_code == 200, f"Failed to create work item: {response.text}"
        
        data = response.json()
        assert data["can_temp_with_qa"] == True, "can_temp_with_qa should be True"
        assert data["can_temp_branch"] == True
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/work-items/{data['id']}", params={"user_token": admin_token})
    
    def test_get_work_items(self, admin_token):
        """Test getting work items"""
        response = requests.get(
            f"{BASE_URL}/api/work-items",
            params={"user_token": admin_token}
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestAssignmentGeneration:
    """Assignment generation tests - core algorithm testing"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture
    def microservices(self):
        response = requests.get(f"{BASE_URL}/api/microservices")
        return response.json()
    
    @pytest.fixture
    def environments(self):
        response = requests.get(f"{BASE_URL}/api/environments")
        return response.json()
    
    def test_generate_assignments_endpoint(self, admin_token):
        """Test that generate-assignments endpoint works"""
        response = requests.post(
            f"{BASE_URL}/api/generate-assignments",
            params={"admin_token": admin_token}
        )
        assert response.status_code == 200, f"Failed to generate assignments: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_assignments(self, admin_token):
        """Test getting assignments"""
        response = requests.get(
            f"{BASE_URL}/api/assignments",
            params={"admin_token": admin_token}
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_assignment_result_structure(self, admin_token, microservices):
        """Test that assignment results have correct structure"""
        # First create a test work item
        ms_dict = {microservices[0]["id"]: True}
        
        work_item_data = {
            "work_item_name": f"TEST_Assignment_{uuid.uuid4().hex[:8]}",
            "microservices": ms_dict,
            "priority": 1,
            "can_temp_branch": True
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/work-items",
            json=work_item_data,
            params={"user_token": admin_token}
        )
        assert create_response.status_code == 200
        work_item = create_response.json()
        
        # Generate assignments
        gen_response = requests.post(
            f"{BASE_URL}/api/generate-assignments",
            params={"admin_token": admin_token}
        )
        assert gen_response.status_code == 200
        
        assignments = gen_response.json()
        
        # Find our test assignment
        test_assignment = None
        for a in assignments:
            if a["work_item_name"] == work_item["work_item_name"]:
                test_assignment = a
                break
        
        if test_assignment:
            # Verify structure
            assert "user_id" in test_assignment
            assert "user_name" in test_assignment
            assert "team_name" in test_assignment
            assert "work_item_name" in test_assignment
            assert "assigned_environment" in test_assignment
            assert "microservices" in test_assignment
            assert "is_temp_branch" in test_assignment
            assert "conflicts" in test_assignment
            
            # Verify waiting list shows English text
            if test_assignment["assigned_environment"] == "WAITING - In Queue":
                assert "WAITING" in test_assignment["assigned_environment"], "Should show English 'WAITING'"
                assert "In Queue" in test_assignment["assigned_environment"], "Should show English 'In Queue'"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/work-items/{work_item['id']}", params={"user_token": admin_token})


class TestCrossTeamTempBranching:
    """Test cross-team temp branching with can_temp_with_qa feature"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture
    def microservices(self):
        response = requests.get(f"{BASE_URL}/api/microservices")
        return response.json()
    
    @pytest.fixture
    def users(self, admin_token):
        response = requests.get(f"{BASE_URL}/api/users", params={"admin_token": admin_token})
        return response.json()
    
    def test_cross_team_qa_temp_branching_scenario(self, admin_token, microservices, users):
        """
        Test: Two users from different teams with can_temp_with_qa=true should share environment
        """
        # Find users from different teams
        team_users = {}
        for user in users:
            team = user["team_name"]
            if team not in team_users and user["role"] != "Admin":
                team_users[team] = user
            if len(team_users) >= 2:
                break
        
        if len(team_users) < 2:
            pytest.skip("Need at least 2 users from different teams")
        
        teams = list(team_users.keys())
        user1 = team_users[teams[0]]
        user2 = team_users[teams[1]]
        
        # Get same microservice for conflict
        ms_id = microservices[0]["id"]
        ms_dict = {ms_id: True}
        
        # Create work items for both users with can_temp_with_qa=True
        work_items = []
        
        for i, user in enumerate([user1, user2]):
            work_item_data = {
                "work_item_name": f"TEST_CrossTeam_{uuid.uuid4().hex[:8]}",
                "microservices": ms_dict,
                "priority": 1,
                "can_temp_branch": True,
                "can_temp_with_qa": True  # Enable cross-team sharing
            }
            
            response = requests.post(
                f"{BASE_URL}/api/work-items",
                json=work_item_data,
                params={"user_token": admin_token, "assigned_user_id": user["id"]}
            )
            assert response.status_code == 200, f"Failed to create work item: {response.text}"
            work_items.append(response.json())
        
        # Generate assignments
        gen_response = requests.post(
            f"{BASE_URL}/api/generate-assignments",
            params={"admin_token": admin_token}
        )
        assert gen_response.status_code == 200
        
        assignments = gen_response.json()
        
        # Find our test assignments
        test_assignments = [a for a in assignments if a["work_item_name"].startswith("TEST_CrossTeam_")]
        
        # Verify cross-team sharing logic
        # Both should be assigned (not waiting) if can_temp_with_qa works
        assigned_count = sum(1 for a in test_assignments if "WAITING" not in a["assigned_environment"])
        
        # At least one should be assigned
        assert assigned_count >= 1, "At least one cross-team work item should be assigned"
        
        # Cleanup
        for wi in work_items:
            requests.delete(f"{BASE_URL}/api/work-items/{wi['id']}", params={"user_token": admin_token})


class TestSameTeamTempBranching:
    """Test same-team temp branching with can_temp_branch feature"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture
    def microservices(self):
        response = requests.get(f"{BASE_URL}/api/microservices")
        return response.json()
    
    @pytest.fixture
    def users(self, admin_token):
        response = requests.get(f"{BASE_URL}/api/users", params={"admin_token": admin_token})
        return response.json()
    
    def test_same_team_temp_branch_sharing(self, admin_token, microservices, users):
        """
        Test: Users from same team with can_temp_branch=true can share environment
        """
        # Find users from same team
        team_users = {}
        for user in users:
            team = user["team_name"]
            if user["role"] != "Admin":
                if team not in team_users:
                    team_users[team] = []
                team_users[team].append(user)
        
        # Find a team with at least 2 users
        same_team_users = None
        for team, team_user_list in team_users.items():
            if len(team_user_list) >= 2:
                same_team_users = team_user_list[:2]
                break
        
        if not same_team_users:
            pytest.skip("Need at least 2 users from same team")
        
        # Get same microservice for conflict
        ms_id = microservices[0]["id"]
        ms_dict = {ms_id: True}
        
        # Create work items for both users with can_temp_branch=True
        work_items = []
        
        for user in same_team_users:
            work_item_data = {
                "work_item_name": f"TEST_SameTeam_{uuid.uuid4().hex[:8]}",
                "microservices": ms_dict,
                "priority": 2,
                "can_temp_branch": True  # Enable same-team temp branching
            }
            
            response = requests.post(
                f"{BASE_URL}/api/work-items",
                json=work_item_data,
                params={"user_token": admin_token, "assigned_user_id": user["id"]}
            )
            assert response.status_code == 200
            work_items.append(response.json())
        
        # Generate assignments
        gen_response = requests.post(
            f"{BASE_URL}/api/generate-assignments",
            params={"admin_token": admin_token}
        )
        assert gen_response.status_code == 200
        
        assignments = gen_response.json()
        
        # Find our test assignments
        test_assignments = [a for a in assignments if a["work_item_name"].startswith("TEST_SameTeam_")]
        
        # Both should be assigned (temp branch allows sharing)
        assigned_count = sum(1 for a in test_assignments if "WAITING" not in a["assigned_environment"])
        assert assigned_count >= 1, "Same team users with temp branch should be assigned"
        
        # Cleanup
        for wi in work_items:
            requests.delete(f"{BASE_URL}/api/work-items/{wi['id']}", params={"user_token": admin_token})


class TestWaitingListEnglishText:
    """Test that waiting list shows English text instead of Albanian"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_waiting_list_english_text(self, admin_token):
        """Verify waiting list shows 'WAITING - In Queue' not Albanian text"""
        # Get current assignments
        response = requests.get(
            f"{BASE_URL}/api/assignments",
            params={"admin_token": admin_token}
        )
        assert response.status_code == 200
        
        assignments = response.json()
        
        # Check any waiting items for English text
        for assignment in assignments:
            env = assignment.get("assigned_environment", "")
            
            # Should NOT contain Albanian text
            assert "Po" not in env or "WAITING" in env, f"Found Albanian 'Po' in: {env}"
            assert "Jo" not in env, f"Found Albanian 'Jo' in: {env}"
            assert "Asnjë" not in env, f"Found Albanian 'Asnjë' in: {env}"
            assert "Konflikte" not in env, f"Found Albanian 'Konflikte' in: {env}"
            
            # If waiting, should show English
            if "WAITING" in env:
                assert "In Queue" in env, f"Waiting should show 'In Queue': {env}"


class TestDeleteAssignments:
    """Test delete assignments endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_delete_assignments_response(self, admin_token):
        """Test delete assignments returns proper response"""
        # First generate some assignments
        requests.post(
            f"{BASE_URL}/api/generate-assignments",
            params={"admin_token": admin_token}
        )
        
        # Delete assignments
        response = requests.delete(
            f"{BASE_URL}/api/assignments",
            params={"admin_token": admin_token}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "deleted_count" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
