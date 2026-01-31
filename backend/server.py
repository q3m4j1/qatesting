from fastapi import FastAPI, APIRouter, HTTPException, status, Response, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, date, timedelta
from passlib.context import CryptContext
import traceback
from auth_oauth import exchange_session_id, create_session, set_session_cookie, get_current_user, logout_user

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Models
class UserBase(BaseModel):
    email: EmailStr
    role: str
    first_name: str
    last_name: str
    team_name: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    approved: bool = True
    oauth_provider: Optional[str] = None

class PendingUser(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    picture: Optional[str] = None
    oauth_provider: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ApproveUserRequest(BaseModel):
    role: str
    team_name: str

class SessionExchangeRequest(BaseModel):
    session_id: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    user: User
    token: str

class MicroserviceConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MicroserviceCreate(BaseModel):
    name: str

class EnvironmentConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    is_second: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EnvironmentCreate(BaseModel):
    name: str
    is_second: bool = False

class TeamConflictConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    team_name: str
    allowed_users: List[str]  # list of user IDs
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TeamConflictCreate(BaseModel):
    team_name: str
    allowed_users: List[str]

class WorkItemRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_email: str
    user_name: str
    team_name: str
    work_item_name: str
    microservices: Dict[str, bool]  # microservice_id: True/False
    environment: Optional[str] = None
    can_temp_branch: bool = True  # Default to ON
    can_temp_with_qa: bool = False  # Can temp with other QA members cross-team
    priority: int  # 1, 2, 3, 4
    comments: Optional[str] = None
    assigned_environment: Optional[str] = None  # Set after assignment generation
    date: str  # YYYY-MM-DD
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WorkItemCreate(BaseModel):
    work_item_name: str
    microservices: Dict[str, bool]
    environment: Optional[str] = None
    can_temp_branch: bool = True  # Default to ON
    can_temp_with_qa: bool = False
    priority: int
    comments: Optional[str] = None

class WorkItemUpdate(BaseModel):
    work_item_name: Optional[str] = None
    microservices: Optional[Dict[str, bool]] = None
    environment: Optional[str] = None
    can_temp_branch: Optional[bool] = None
    can_temp_with_qa: Optional[bool] = None
    priority: Optional[int] = None
    comments: Optional[str] = None

class AssignmentResult(BaseModel):
    user_id: str
    user_name: str
    team_name: str
    work_item_name: str
    assigned_environment: str
    microservices: List[str]
    is_temp_branch: bool
    conflicts: List[str]

class ForceAssignRequest(BaseModel):
    user_id: str
    work_item_name: str
    target_environment: str

# Helper functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

# Initialize default admin user
async def init_default_admin():
    try:
        existing = await db.users.find_one({"email": "admin@example.com"})
        if not existing:
            admin = User(
                email="admin@example.com",
                role="Admin",
                first_name="Test",
                last_name="Admin",
                team_name="Admin Team",
                approved=True,
                oauth_provider=None
            )
            doc = admin.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            doc['password'] = hash_password("Solab-123")
            await db.users.insert_one(doc)
            logger.info("Default admin created")
    except Exception as e:
        logger.error(f"Error creating default admin: {e}")

@app.on_event("startup")
async def startup_event():
    await init_default_admin()

# Auth routes
@api_router.post("/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    user_doc = await db.users.find_one({"email": request.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(request.password, user_doc['password']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user_doc.get("approved", True):
        raise HTTPException(status_code=403, detail="Account pending admin approval")
    
    # Convert datetime
    if isinstance(user_doc['created_at'], str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    user_doc.pop('password', None)
    user = User(**user_doc)
    
    return LoginResponse(user=user, token=user.id)

@api_router.post("/auth/oauth/exchange")
async def oauth_exchange(request_data: SessionExchangeRequest, response: Response):
    """Exchange session_id from OAuth for session token"""
    try:
        oauth_data = await exchange_session_id(request_data.session_id)
        
        email = oauth_data["email"]
        name = oauth_data.get("name", "")
        picture = oauth_data.get("picture")
        session_token = oauth_data["session_token"]
        
        user_doc = await db.users.find_one({"email": email}, {"_id": 0})
        
        if user_doc:
            if not user_doc.get("approved", False):
                raise HTTPException(status_code=403, detail="Your account is pending admin approval")
            
            await create_session(db, user_doc["id"], session_token)
            set_session_cookie(response, session_token)
            
            if isinstance(user_doc['created_at'], str):
                user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
            
            user_doc.pop('password', None)
            return {"user": user_doc, "status": "approved"}
        
        pending_doc = await db.pending_users.find_one({"email": email}, {"_id": 0})
        
        if pending_doc:
            return {"status": "pending", "message": "Your account is awaiting admin approval"}
        
        provider = "google"
        pending_user = PendingUser(
            email=email,
            name=name,
            picture=picture,
            oauth_provider=provider
        )
        
        doc = pending_user.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.pending_users.insert_one(doc)
        
        return {"status": "pending", "message": "Your account has been submitted for admin approval"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OAuth exchange error: {e}")
        raise HTTPException(status_code=500, detail="Authentication failed")

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current authenticated user"""
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if not user.get("approved", True):
        raise HTTPException(status_code=403, detail="Account pending approval")
    
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout current user"""
    await logout_user(request, response, db)
    return {"message": "Logged out successfully"}

@api_router.get("/pending-users")
async def get_pending_users(admin_token: str):
    """Get all pending users"""
    admin = await db.users.find_one({"id": admin_token, "role": "Admin"}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    pending = await db.pending_users.find({}, {"_id": 0}).to_list(1000)
    for p in pending:
        if isinstance(p['created_at'], str):
            p['created_at'] = datetime.fromisoformat(p['created_at'])
    return pending

@api_router.post("/pending-users/{user_id}/approve")
async def approve_pending_user(user_id: str, approval: ApproveUserRequest, admin_token: str):
    """Approve a pending user"""
    admin = await db.users.find_one({"id": admin_token, "role": "Admin"}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    pending_doc = await db.pending_users.find_one({"id": user_id}, {"_id": 0})
    if not pending_doc:
        raise HTTPException(status_code=404, detail="Pending user not found")
    
    name_parts = pending_doc['name'].split(' ', 1)
    first_name = name_parts[0] if len(name_parts) > 0 else pending_doc['name']
    last_name = name_parts[1] if len(name_parts) > 1 else ""
    
    new_user = User(
        email=pending_doc['email'],
        role=approval.role,
        first_name=first_name,
        last_name=last_name,
        team_name=approval.team_name,
        approved=True,
        oauth_provider=pending_doc.get('oauth_provider')
    )
    
    doc = new_user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['password'] = hash_password(str(uuid.uuid4()))
    
    await db.users.insert_one(doc)
    await db.pending_users.delete_one({"id": user_id})
    
    return {"message": "User approved successfully", "user": new_user}

@api_router.delete("/pending-users/{user_id}")
async def reject_pending_user(user_id: str, admin_token: str):
    """Reject a pending user"""
    admin = await db.users.find_one({"id": admin_token, "role": "Admin"}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.pending_users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pending user not found")
    
    return {"message": "User rejected successfully"}

# User management routes
@api_router.post("/users", response_model=User)
async def create_user(user: UserCreate, admin_token: str):
    # Verify admin
    admin = await db.users.find_one({"id": admin_token, "role": "Admin"}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=403, detail="Only admins can create users")
    
    # Check if email exists
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    user_obj = User(**user.model_dump(exclude={'password'}), approved=True, oauth_provider=None)
    doc = user_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['password'] = hash_password(user.password)
    
    await db.users.insert_one(doc)
    return user_obj

@api_router.get("/users", response_model=List[User])
async def get_users(admin_token: str):
    admin = await db.users.find_one({"id": admin_token, "role": "Admin"}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=403, detail="Only admins can view users")
    
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    for user in users:
        if isinstance(user['created_at'], str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
    return users

@api_router.put("/users/{user_id}", response_model=User)
async def update_user(user_id: str, user: UserCreate, admin_token: str):
    admin = await db.users.find_one({"id": admin_token, "role": "Admin"}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=403, detail="Only admins can update users")
    
    update_data = user.model_dump()
    update_data['password'] = hash_password(user.password)
    
    result = await db.users.update_one({"id": user_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if isinstance(updated_user['created_at'], str):
        updated_user['created_at'] = datetime.fromisoformat(updated_user['created_at'])
    return User(**updated_user)

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin_token: str):
    admin = await db.users.find_one({"id": admin_token, "role": "Admin"}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=403, detail="Only admins can delete users")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}

# Microservice routes
@api_router.post("/microservices", response_model=MicroserviceConfig)
async def create_microservice(ms: MicroserviceCreate, admin_token: str):
    admin = await db.users.find_one({"id": admin_token, "role": "Admin"}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=403, detail="Only admins can add microservices")
    
    ms_obj = MicroserviceConfig(name=ms.name)
    doc = ms_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.microservices.insert_one(doc)
    return ms_obj

@api_router.get("/microservices", response_model=List[MicroserviceConfig])
async def get_microservices():
    mss = await db.microservices.find({}, {"_id": 0}).to_list(1000)
    for ms in mss:
        if isinstance(ms['created_at'], str):
            ms['created_at'] = datetime.fromisoformat(ms['created_at'])
    return mss

@api_router.put("/microservices/{ms_id}", response_model=MicroserviceConfig)
async def update_microservice(ms_id: str, ms: MicroserviceCreate, admin_token: str):
    admin = await db.users.find_one({"id": admin_token, "role": "Admin"}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=403, detail="Only admins can update microservices")
    
    result = await db.microservices.update_one({"id": ms_id}, {"$set": {"name": ms.name}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Microservice not found")
    
    updated_ms = await db.microservices.find_one({"id": ms_id}, {"_id": 0})
    if isinstance(updated_ms['created_at'], str):
        updated_ms['created_at'] = datetime.fromisoformat(updated_ms['created_at'])
    return MicroserviceConfig(**updated_ms)

@api_router.delete("/microservices/{ms_id}")
async def delete_microservice(ms_id: str, admin_token: str):
    admin = await db.users.find_one({"id": admin_token, "role": "Admin"}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=403, detail="Only admins can delete microservices")
    
    result = await db.microservices.delete_one({"id": ms_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Microservice not found")
    return {"message": "Microservice deleted successfully"}

# Environment routes
@api_router.post("/environments", response_model=EnvironmentConfig)
async def create_environment(env: EnvironmentCreate, admin_token: str):
    admin = await db.users.find_one({"id": admin_token, "role": "Admin"}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=403, detail="Only admins can add environments")
    
    env_obj = EnvironmentConfig(name=env.name, is_second=env.is_second)
    doc = env_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.environments.insert_one(doc)
    return env_obj

@api_router.get("/environments", response_model=List[EnvironmentConfig])
async def get_environments():
    envs = await db.environments.find({}, {"_id": 0}).to_list(1000)
    for env in envs:
        if isinstance(env['created_at'], str):
            env['created_at'] = datetime.fromisoformat(env['created_at'])
    return envs

@api_router.put("/environments/{env_id}", response_model=EnvironmentConfig)
async def update_environment(env_id: str, env: EnvironmentCreate, admin_token: str):
    admin = await db.users.find_one({"id": admin_token, "role": "Admin"}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=403, detail="Only admins can update environments")
    
    result = await db.environments.update_one({"id": env_id}, {"$set": {"name": env.name, "is_second": env.is_second}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Environment not found")
    
    updated_env = await db.environments.find_one({"id": env_id}, {"_id": 0})
    if isinstance(updated_env['created_at'], str):
        updated_env['created_at'] = datetime.fromisoformat(updated_env['created_at'])
    return EnvironmentConfig(**updated_env)

@api_router.delete("/environments/{env_id}")
async def delete_environment(env_id: str, admin_token: str):
    admin = await db.users.find_one({"id": admin_token, "role": "Admin"}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=403, detail="Only admins can delete environments")
    
    result = await db.environments.delete_one({"id": env_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Environment not found")
    return {"message": "Environment deleted successfully"}

# Team conflict config routes
@api_router.post("/team-conflicts", response_model=TeamConflictConfig)
async def create_team_conflict(config: TeamConflictCreate, admin_token: str):
    admin = await db.users.find_one({"id": admin_token, "role": "Admin"}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=403, detail="Only admins can configure teams")
    
    config_obj = TeamConflictConfig(**config.model_dump())
    doc = config_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.team_conflicts.insert_one(doc)
    return config_obj

@api_router.get("/team-conflicts", response_model=List[TeamConflictConfig])
async def get_team_conflicts(admin_token: str):
    admin = await db.users.find_one({"id": admin_token, "role": "Admin"}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=403, detail="Only admins can view team configuration")
    
    configs = await db.team_conflicts.find({}, {"_id": 0}).to_list(1000)
    for config in configs:
        if isinstance(config['created_at'], str):
            config['created_at'] = datetime.fromisoformat(config['created_at'])
    return configs

@api_router.put("/team-conflicts/{config_id}", response_model=TeamConflictConfig)
async def update_team_conflict(config_id: str, config: TeamConflictCreate, admin_token: str):
    admin = await db.users.find_one({"id": admin_token, "role": "Admin"}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=403, detail="Only admins can update team configuration")
    
    result = await db.team_conflicts.update_one({"id": config_id}, {"$set": config.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    updated_config = await db.team_conflicts.find_one({"id": config_id}, {"_id": 0})
    if isinstance(updated_config['created_at'], str):
        updated_config['created_at'] = datetime.fromisoformat(updated_config['created_at'])
    return TeamConflictConfig(**updated_config)

@api_router.delete("/team-conflicts/{config_id}")
async def delete_team_conflict(config_id: str, admin_token: str):
    admin = await db.users.find_one({"id": admin_token, "role": "Admin"}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=403, detail="Only admins can delete team configuration")
    
    result = await db.team_conflicts.delete_one({"id": config_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Configuration not found")
    return {"message": "Configuration deleted successfully"}

# Work item routes
@api_router.post("/work-items", response_model=WorkItemRecord)
async def create_work_item(item: WorkItemCreate, user_token: str, assigned_user_id: Optional[str] = None):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Invalid user")
    
    today = date.today().isoformat()
    
    # If admin assigns to another user
    if assigned_user_id and user.get("role") == "Admin":
        assigned_user = await db.users.find_one({"id": assigned_user_id}, {"_id": 0, "password": 0})
        if not assigned_user:
            raise HTTPException(status_code=404, detail="Assigned user not found")
        
        item_obj = WorkItemRecord(
            user_id=assigned_user['id'],
            user_email=assigned_user['email'],
            user_name=f"{assigned_user['first_name']} {assigned_user['last_name']}",
            team_name=assigned_user['team_name'],
            work_item_name=item.work_item_name,
            microservices=item.microservices,
            environment=item.environment,
            can_temp_branch=item.can_temp_branch,
            can_temp_with_qa=item.can_temp_with_qa,
            priority=item.priority,
            comments=item.comments,
            date=today
        )
    else:
        # Regular user or admin creating for themselves
        item_obj = WorkItemRecord(
            user_id=user['id'],
            user_email=user['email'],
            user_name=f"{user['first_name']} {user['last_name']}",
            team_name=user['team_name'],
            work_item_name=item.work_item_name,
            microservices=item.microservices,
            environment=item.environment,
            can_temp_branch=item.can_temp_branch,
            can_temp_with_qa=item.can_temp_with_qa,
            priority=item.priority,
            comments=item.comments,
            date=today
        )
    
    doc = item_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.work_items.insert_one(doc)
    return item_obj

@api_router.get("/work-items", response_model=List[WorkItemRecord])
async def get_work_items(user_token: str, date_filter: Optional[str] = None):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Invalid user")
    
    query = {}
    if date_filter:
        query['date'] = date_filter
    else:
        query['date'] = date.today().isoformat()
    
    # Admin can see all, users see only their own
    if user['role'] != 'Admin':
        query['user_id'] = user['id']
    
    items = await db.work_items.find(query, {"_id": 0}).to_list(1000)
    for item in items:
        if isinstance(item['created_at'], str):
            item['created_at'] = datetime.fromisoformat(item['created_at'])
    return items

@api_router.put("/work-items/{item_id}", response_model=WorkItemRecord)
async def update_work_item(item_id: str, item: WorkItemUpdate, user_token: str):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Invalid user")
    
    # Check ownership or admin
    existing = await db.work_items.find_one({"id": item_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Work item not found")
    
    if user['role'] != 'Admin' and existing['user_id'] != user['id']:
        raise HTTPException(status_code=403, detail="You do not have permission to update this work item")
    
    update_data = {k: v for k, v in item.model_dump().items() if v is not None}
    
    await db.work_items.update_one({"id": item_id}, {"$set": update_data})
    
    updated_item = await db.work_items.find_one({"id": item_id}, {"_id": 0})
    if isinstance(updated_item['created_at'], str):
        updated_item['created_at'] = datetime.fromisoformat(updated_item['created_at'])
    return WorkItemRecord(**updated_item)

@api_router.delete("/work-items/{item_id}")
async def delete_work_item(item_id: str, user_token: str):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Invalid user")
    
    # Check ownership or admin
    existing = await db.work_items.find_one({"id": item_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Work item not found")
    
    if user['role'] != 'Admin' and existing['user_id'] != user['id']:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this work item")
    
    await db.work_items.delete_one({"id": item_id})
    return {"message": "Work item deleted successfully"}

# Assignment generation
@api_router.post("/generate-assignments", response_model=List[AssignmentResult])
async def generate_assignments(admin_token: str, date_filter: Optional[str] = None):
    admin = await db.users.find_one({"id": admin_token, "role": "Admin"}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=403, detail="Only admins can generate assignments")
    
    try:
        target_date = date_filter if date_filter else date.today().isoformat()
        
        # Get all work items for the date
        work_items = await db.work_items.find({"date": target_date}, {"_id": 0}).to_list(1000)
        
        if not work_items:
            return []
        
        # Get all environments
        environments = await db.environments.find({}, {"_id": 0}).to_list(1000)
        regular_envs = [e for e in environments if not e.get('is_second', False)]
        second_envs = [e for e in environments if e.get('is_second', False)]
        
        # Build second env to parent mapping (e.g., "Qa-second" -> "QA")
        second_to_parent = {}
        for sec_env in second_envs:
            sec_name = sec_env['name']
            # Try to find parent: "Qa-second" -> "QA", "Dev-second" -> "Dev"
            base_name = sec_name.replace('-second', '').replace('-Second', '')
            for reg_env in regular_envs:
                if reg_env['name'].lower() == base_name.lower():
                    second_to_parent[sec_env['id']] = reg_env['id']
                    break
        
        # Get all microservices
        all_ms = await db.microservices.find({}, {"_id": 0}).to_list(1000)
        ms_id_to_name = {ms['id']: ms['name'] for ms in all_ms}
        ms_name_to_id = {ms['name']: ms['id'] for ms in all_ms}
        
        # Find "Front" microservice ID
        front_ms_id = ms_name_to_id.get('Front')
        
        # Process assignments
        assignments = []
        waiting_list = []
        env_assignments = {env['id']: [] for env in environments}
        
        # Sort work items by priority (1 is highest) then by team
        work_items_sorted = sorted(work_items, key=lambda x: (x.get('priority', 4), x['team_name']))
        
        def check_conflicts(item, existing_assignments, selected_ms_ids):
            """Check for conflicts with existing assignments in an environment"""
            has_conflict = False
            has_different_team_conflict = False
            can_resolve_with_qa_temp = False
            conflict_list = []
            
            for existing in existing_assignments:
                existing_ms = [ms_id for ms_id, sel in existing['microservices'].items() if sel]
                common_ms = set(selected_ms_ids) & set(existing_ms)
                
                if common_ms:
                    conflict_list.extend([ms_id_to_name.get(ms_id, ms_id) for ms_id in common_ms])
                    has_conflict = True
                    
                    # Check if different team
                    if existing['team_name'] != item['team_name']:
                        has_different_team_conflict = True
                        # Check if both have can_temp_with_qa enabled (cross-team temp branching)
                        if item.get('can_temp_with_qa', False) and existing.get('can_temp_with_qa', False):
                            can_resolve_with_qa_temp = True
                        else:
                            # Different team without QA temp = cannot share
                            break
            
            return {
                'has_conflict': has_conflict,
                'has_different_team_conflict': has_different_team_conflict,
                'can_resolve_with_qa_temp': can_resolve_with_qa_temp,
                'conflict_list': conflict_list
            }
        
        for item in work_items_sorted:
            user_id = item['user_id']
            user_name = item['user_name']
            team_name = item['team_name']
            work_item_name = item['work_item_name']
            microservices = item['microservices']
            priority = item.get('priority', 4)
            
            # Get selected microservices (where value is True)
            selected_ms_ids = [ms_id for ms_id, selected in microservices.items() if selected]
            selected_ms_names = [ms_id_to_name.get(ms_id, ms_id) for ms_id in selected_ms_ids]
            
            # Check microservice types for optimized -second logic
            has_front = front_ms_id in selected_ms_ids if front_ms_id else 'Front' in selected_ms_names
            backend_ms_ids = [ms_id for ms_id in selected_ms_ids if ms_id != front_ms_id] if front_ms_id else []
            only_front = has_front and len(selected_ms_ids) == 1
            has_mixed = has_front and len(backend_ms_ids) > 0
            
            assigned = False
            assigned_env = None
            is_temp_branch = False
            conflicts = []
            is_qa_temp_branch = False
            
            # STRATEGY 1: For mixed items (Front + BE), try SPLIT first before regular assignment
            # This optimizes -second environment usage
            if has_mixed and second_envs:
                for sec_env in second_envs:
                    sec_env_id = sec_env['id']
                    parent_env_id = second_to_parent.get(sec_env_id)
                    
                    if not parent_env_id:
                        continue
                    
                    # Check if we can place Front in -second and BE in parent
                    sec_existing = env_assignments[sec_env_id]
                    parent_existing = env_assignments[parent_env_id]
                    
                    # Check Front conflicts in -second (only check for Front microservice)
                    # For -second environments, we want STRICT checking - no Front conflicts allowed
                    # unless they can do temp branching
                    front_conflict_in_sec = False
                    can_temp_in_sec = True
                    front_temp_conflicts = []
                    
                    for existing in sec_existing:
                        existing_ms = [ms_id for ms_id, sel in existing['microservices'].items() if sel]
                        if front_ms_id in existing_ms:
                            # There's a Front conflict in -second
                            front_temp_conflicts.append(existing['user_name'])
                            if existing['team_name'] != team_name:
                                # Different team - check QA temp
                                if not (item.get('can_temp_with_qa', False) and existing.get('can_temp_with_qa', False)):
                                    front_conflict_in_sec = True
                                    break
                                # Different team but both have can_temp_with_qa - allow with temp
                            else:
                                # Same team - check temp branch
                                if not (item.get('can_temp_branch', True) and existing.get('can_temp_branch', True)):
                                    front_conflict_in_sec = True
                                    break
                                # Same team and both can temp - allow with temp
                    
                    if front_conflict_in_sec:
                        continue
                    
                    # Check BE conflicts in parent
                    be_conflict_in_parent = False
                    can_temp_in_parent = True
                    be_conflicts_list = []
                    for existing in parent_existing:
                        existing_ms = [ms_id for ms_id, sel in existing['microservices'].items() if sel]
                        common_be = set(backend_ms_ids) & set(existing_ms)
                        if common_be:
                            be_conflicts_list.extend([ms_id_to_name.get(ms_id, ms_id) for ms_id in common_be])
                            if existing['team_name'] != team_name:
                                # Different team - check QA temp
                                if not (item.get('can_temp_with_qa', False) and existing.get('can_temp_with_qa', False)):
                                    be_conflict_in_parent = True
                                    break
                            else:
                                # Same team - check temp branch
                                if not (item.get('can_temp_branch', True) and existing.get('can_temp_branch', True)):
                                    can_temp_in_parent = False
                    
                    if be_conflict_in_parent:
                        continue
                    
                    # SUCCESS: Front can go in -second and BE can go in parent
                    parent_env_name = [e['name'] for e in regular_envs if e['id'] == parent_env_id][0]
                    backend_ms_names = [ms_id_to_name.get(ms_id, ms_id) for ms_id in backend_ms_ids]
                    
                    # Determine if FE assignment needs temp branch flag
                    fe_needs_temp = len(front_temp_conflicts) > 0
                    
                    # Create FE-only item for tracking in -second
                    fe_item = item.copy()
                    fe_item['microservices'] = {front_ms_id: True} if front_ms_id else {'Front': True}
                    env_assignments[sec_env_id].append(fe_item)
                    
                    # Create BE-only item for tracking in parent
                    be_item = item.copy()
                    be_item['microservices'] = {ms_id: True for ms_id in backend_ms_ids}
                    env_assignments[parent_env_id].append(be_item)
                    
                    # Create TWO assignment results - one for FE, one for BE
                    # FE Assignment (to -second)
                    fe_assignment = AssignmentResult(
                        user_id=user_id,
                        user_name=user_name,
                        team_name=team_name,
                        work_item_name=f"{work_item_name} (FE)",
                        assigned_environment=sec_env['name'],
                        microservices=['Front'],
                        is_temp_branch=fe_needs_temp,
                        conflicts=[f"Front conflict with {', '.join(front_temp_conflicts)}"] if fe_needs_temp else []
                    )
                    assignments.append(fe_assignment)
                    
                    # BE Assignment (to parent)
                    be_assignment = AssignmentResult(
                        user_id=user_id,
                        user_name=user_name,
                        team_name=team_name,
                        work_item_name=f"{work_item_name} (BE)",
                        assigned_environment=parent_env_name,
                        microservices=backend_ms_names,
                        is_temp_branch=len(be_conflicts_list) > 0 and can_temp_in_parent,
                        conflicts=list(set(be_conflicts_list)) if be_conflicts_list else []
                    )
                    assignments.append(be_assignment)
                    
                    assigned = True
                    break
            
            # Skip to next item if split was successful
            if assigned:
                continue
            
            # STRATEGY 2: Try to assign to regular environments (full item, no split)
            for env in regular_envs:
                env_id = env['id']
                existing_assignments = env_assignments[env_id]
                
                if not existing_assignments:
                    # Empty environment, assign directly
                    env_assignments[env_id].append(item)
                    assigned_env = env['name']
                    assigned = True
                    break
                
                conflict_result = check_conflicts(item, existing_assignments, selected_ms_ids)
                
                if not conflict_result['has_conflict']:
                    # No conflict at all, assign to this environment
                    env_assignments[env_id].append(item)
                    assigned_env = env['name']
                    assigned = True
                    break
                elif conflict_result['has_different_team_conflict']:
                    # Different team conflict
                    if conflict_result['can_resolve_with_qa_temp']:
                        # Both parties have can_temp_with_qa = True, allow sharing with temp branch
                        all_qa_temp = all(e.get('can_temp_with_qa', False) for e in existing_assignments)
                        if all_qa_temp and item.get('can_temp_with_qa', False):
                            env_assignments[env_id].append(item)
                            assigned_env = env['name']
                            is_temp_branch = True
                            is_qa_temp_branch = True
                            conflicts = list(set(conflict_result['conflict_list']))
                            assigned = True
                            break
                    # Otherwise, skip this environment
                    continue
                else:
                    # Same team with conflict - check if can use temp branches
                    if item.get('can_temp_branch', True):  # Default ON
                        # Check if all in this env can do temp branches
                        all_can_temp = all(e.get('can_temp_branch', True) for e in existing_assignments)
                        if all_can_temp:
                            env_assignments[env_id].append(item)
                            assigned_env = env['name']
                            is_temp_branch = True
                            conflicts = list(set(conflict_result['conflict_list']))
                            assigned = True
                            break
            
            # STRATEGY 3: If only Front, try second environments
            if not assigned and only_front and second_envs:
                for env in second_envs:
                    env_id = env['id']
                    existing_assignments = env_assignments[env_id]
                    
                    if not existing_assignments:
                        env_assignments[env_id].append(item)
                        assigned_env = env['name']
                        assigned = True
                        break
                    
                    conflict_result = check_conflicts(item, existing_assignments, selected_ms_ids)
                    
                    if not conflict_result['has_conflict']:
                        env_assignments[env_id].append(item)
                        assigned_env = env['name']
                        assigned = True
                        break
                    elif conflict_result['has_different_team_conflict']:
                        if conflict_result['can_resolve_with_qa_temp']:
                            all_qa_temp = all(e.get('can_temp_with_qa', False) for e in existing_assignments)
                            if all_qa_temp and item.get('can_temp_with_qa', False):
                                env_assignments[env_id].append(item)
                                assigned_env = env['name']
                                is_temp_branch = True
                                is_qa_temp_branch = True
                                assigned = True
                                break
                        continue
                    else:
                        # Same team, check temp branch
                        if item.get('can_temp_branch', True):
                            all_can_temp = all(e.get('can_temp_branch', True) for e in existing_assignments)
                            if all_can_temp:
                                env_assignments[env_id].append(item)
                                assigned_env = env['name']
                                is_temp_branch = True
                                assigned = True
                                break
            
            # STRATEGY 4: If still not assigned, try any remaining -second environment
            if not assigned and second_envs:
                for env in second_envs:
                    env_id = env['id']
                    existing_assignments = env_assignments[env_id]
                    
                    if not existing_assignments:
                        env_assignments[env_id].append(item)
                        assigned_env = env['name']
                        assigned = True
                        break
            
            # If still not assigned, add to waiting list
            if not assigned:
                waiting_info = {
                    'user_id': user_id,
                    'user_name': user_name,
                    'team_name': team_name,
                    'work_item_name': work_item_name,
                    'microservices': selected_ms_names,
                    'priority': priority,
                    'reason': 'All environments are occupied. Must wait until someone finishes.'
                }
                waiting_list.append(waiting_info)
                
                # Create assignment result with "WAITING" status
                assignment = AssignmentResult(
                    user_id=user_id,
                    user_name=user_name,
                    team_name=team_name,
                    work_item_name=work_item_name,
                    assigned_environment="WAITING - In Queue",
                    microservices=selected_ms_names,
                    is_temp_branch=False,
                    conflicts=["No available environment"]
                )
                assignments.append(assignment)
                continue
            
            # Build conflict description
            conflict_desc = conflicts
            if is_qa_temp_branch:
                conflict_desc = [f"QA Cross-Team: {c}" for c in conflicts] if conflicts else ["QA Cross-Team Collaboration"]
            
            # Create assignment result
            assignment = AssignmentResult(
                user_id=user_id,
                user_name=user_name,
                team_name=team_name,
                work_item_name=work_item_name,
                assigned_environment=assigned_env,
                microservices=selected_ms_names,
                is_temp_branch=is_temp_branch,
                conflicts=conflict_desc
            )
            assignments.append(assignment)
        
        # Save assignments to database
        assignment_docs = [a.model_dump() for a in assignments]
        if assignment_docs:
            await db.assignments.delete_many({"date": target_date})  # Clear old assignments for the day
            for doc in assignment_docs:
                doc['date'] = target_date
                doc['created_at'] = datetime.now(timezone.utc).isoformat()
            await db.assignments.insert_many(assignment_docs)
            
            # Update work items with assigned environment
            for assignment in assignments:
                await db.work_items.update_many(
                    {
                        "user_id": assignment.user_id,
                        "work_item_name": assignment.work_item_name,
                        "date": target_date
                    },
                    {"$set": {"assigned_environment": assignment.assigned_environment}}
                )
        
        return assignments
        
    except Exception as e:
        logger.error(f"Error generating assignments: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error generating assignments: {str(e)}")

@api_router.get("/assignments", response_model=List[AssignmentResult])
async def get_assignments(admin_token: str, date_filter: Optional[str] = None):
    admin = await db.users.find_one({"id": admin_token, "role": "Admin"}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=403, detail="Only admins can view assignments")
    
    target_date = date_filter if date_filter else date.today().isoformat()
    assignments = await db.assignments.find({"date": target_date}, {"_id": 0}).to_list(1000)
    return assignments

@api_router.delete("/assignments")
async def delete_assignments(admin_token: str, date_filter: Optional[str] = None):
    admin = await db.users.find_one({"id": admin_token, "role": "Admin"}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=403, detail="Only admins can delete assignments")
    
    target_date = date_filter if date_filter else date.today().isoformat()
    
    # Delete assignments
    result = await db.assignments.delete_many({"date": target_date})
    
    # Clear assigned_environment from work items
    await db.work_items.update_many(
        {"date": target_date},
        {"$unset": {"assigned_environment": ""}}
    )
    
    return {"message": f"Assignments deleted successfully. {result.deleted_count} assignment(s) removed.", "deleted_count": result.deleted_count}

@api_router.post("/assignments/force-assign")
async def force_assign_to_environment(request: ForceAssignRequest, admin_token: str, date_filter: Optional[str] = None):
    """Force assign a waiting work item to a specific environment"""
    admin = await db.users.find_one({"id": admin_token, "role": "Admin"}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=403, detail="Only admins can force assign")
    
    target_date = date_filter if date_filter else date.today().isoformat()
    
    try:
        # Find the assignment in waiting list
        waiting_assignment = await db.assignments.find_one({
            "user_id": request.user_id,
            "work_item_name": request.work_item_name,
            "date": target_date,
            "assigned_environment": "WAITING - In Queue"
        }, {"_id": 0})
        
        if not waiting_assignment:
            raise HTTPException(status_code=404, detail="Assignment not found in waiting list")
        
        # Get the target environment to verify it exists
        env = await db.environments.find_one({"name": request.target_environment}, {"_id": 0})
        if not env:
            raise HTTPException(status_code=404, detail="Environment not found")
        
        # Get all microservices for ID to name mapping
        all_ms = await db.microservices.find({}, {"_id": 0}).to_list(1000)
        ms_id_to_name = {ms['id']: ms['name'] for ms in all_ms}
        
        # Find existing assignments in the target environment
        existing_in_env = await db.assignments.find({
            "date": target_date,
            "assigned_environment": request.target_environment
        }, {"_id": 0}).to_list(1000)
        
        # Check for conflicts
        waiting_ms = waiting_assignment.get('microservices', [])
        conflicts = []
        
        for existing in existing_in_env:
            existing_ms = existing.get('microservices', [])
            common_ms = set(waiting_ms) & set(existing_ms)
            if common_ms:
                conflicts.extend(list(common_ms))
                conflicts.append(f"with {existing['user_name']}")
        
        # Update the assignment - force it to the new environment
        await db.assignments.update_one(
            {
                "user_id": request.user_id,
                "work_item_name": request.work_item_name,
                "date": target_date,
                "assigned_environment": "WAITING - In Queue"
            },
            {
                "$set": {
                    "assigned_environment": request.target_environment,
                    "is_temp_branch": len(conflicts) > 0,
                    "conflicts": list(set(conflicts)) if conflicts else ["Force assigned by Admin"]
                }
            }
        )
        
        # Update the work item as well
        # Handle both full work item name and split names (with FE/BE suffix)
        base_work_item_name = request.work_item_name.replace(" (FE)", "").replace(" (BE)", "")
        await db.work_items.update_many(
            {
                "user_id": request.user_id,
                "date": target_date,
                "$or": [
                    {"work_item_name": base_work_item_name},
                    {"work_item_name": request.work_item_name}
                ]
            },
            {"$set": {"assigned_environment": request.target_environment}}
        )
        
        return {
            "message": f"Successfully force assigned to {request.target_environment}",
            "conflicts": list(set(conflicts)) if conflicts else [],
            "user_name": waiting_assignment['user_name'],
            "work_item_name": request.work_item_name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error force assigning: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error force assigning: {str(e)}")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
