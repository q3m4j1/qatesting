from fastapi import FastAPI, APIRouter, HTTPException, status, Response, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import time
import json
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
    user_id: Optional[str] = None  # Allow admin to reassign work item to different user

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

# ============ TV SETUPS MODELS ============

class TVFloor(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TVDevice(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # tv, hello, whiteboard, roomsign, bed
    label: str
    sn: Optional[str] = None  # Serial number
    x: float = 0
    y: float = 0
    w: float = 20
    h: float = 20
    status: str = "free"  # free, inuse, not_available
    status_changed_at: Optional[datetime] = None
    status_changed_by: Optional[str] = None

class TVRoom(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    floor_id: str
    name: str
    side: str = "left"  # left or right
    pos: int = 1
    devices: List[TVDevice] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TVRoomCreate(BaseModel):
    floor_id: str
    name: str
    side: str = "left"
    pos: int = 1

class TVRoomUpdate(BaseModel):
    name: Optional[str] = None
    side: Optional[str] = None
    pos: Optional[int] = None

class TVDeviceCreate(BaseModel):
    type: str
    label: str
    sn: Optional[str] = None
    x: float = 0
    y: float = 0
    w: float = 20
    h: float = 20

class TVDeviceUpdate(BaseModel):
    label: Optional[str] = None
    sn: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    w: Optional[float] = None
    h: Optional[float] = None
    status: Optional[str] = None

class TVNote(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    target_type: str  # room or device
    target_id: str
    room_id: Optional[str] = None
    text: str
    author_id: str
    author_name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    edited_at: Optional[datetime] = None

class TVNoteCreate(BaseModel):
    target_type: str
    target_id: str
    room_id: Optional[str] = None
    text: str

class TVActivity(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    message: str
    user_id: str
    user_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============ FIND DEVICES MODELS ============

class FindEnvEnvironment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # e.g., "staging", "weekly", "qa"
    display_name: str  # e.g., "Staging", "Weekly", "QA"
    mdm_url: str = ""  # e.g., "mdm.staging.solaborate.com"
    api_url: str = ""  # e.g., "api.staging.solaborate.com"
    is_active: bool = True
    order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FindEnvEnvironmentCreate(BaseModel):
    name: str
    display_name: str
    is_active: bool = True
    order: int = 0

class FindEnvEnvironmentUpdate(BaseModel):
    name: Optional[str] = None
    display_name: Optional[str] = None
    is_active: Optional[bool] = None
    order: Optional[int] = None

class FindEnvSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "findenv_settings"
    azure_username: Optional[str] = None
    azure_password_encrypted: Optional[str] = None  # Encrypted password
    client_id: str = "sol.web.endpointmanager.pkce"
    client_secret: Optional[str] = None  # Optional for confidential clients
    scope: str = "openid profile sol.web.endpointmanager"  # Configurable scope
    last_login: Optional[datetime] = None
    tokens: Dict[str, dict] = {}  # env_name -> {token, exp, refresh}

class FindEnvSearchResult(BaseModel):
    environment: str
    display_name: str
    status: str  # "online", "offline", "not_registered", "error", "no_access"
    device_info: Optional[dict] = None
    error_message: Optional[str] = None

class FindEnvSearchResponse(BaseModel):
    serial: str
    results: List[FindEnvSearchResult]
    found_online: Optional[str] = None  # env name where device is online
    device_details: Optional[dict] = None

class FindEnvSearchHistory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    serial: str
    user_id: str
    user_name: str
    found_in: Optional[str] = None
    status: str
    searched_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    
    # If admin is reassigning to a different user, update user-related fields
    if 'user_id' in update_data and user['role'] == 'Admin':
        new_user_id = update_data['user_id']
        new_user = await db.users.find_one({"id": new_user_id}, {"_id": 0, "password": 0})
        if new_user:
            update_data['user_email'] = new_user['email']
            update_data['user_name'] = f"{new_user['first_name']} {new_user['last_name']}"
            update_data['team_name'] = new_user['team_name']
        else:
            raise HTTPException(status_code=404, detail="Target user not found")
    
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
        
        # STEP 1: First, process all items with PRE-SELECTED environments (Admin priority)
        # These have highest priority and should be assigned first
        pre_selected_items = [item for item in work_items if item.get('environment') and item.get('environment') != 'none' and item.get('environment', '').strip()]
        other_items = [item for item in work_items if item not in pre_selected_items]
        
        # Sort pre-selected by priority
        pre_selected_items = sorted(pre_selected_items, key=lambda x: x.get('priority', 4))
        
        # STEP 2: For other items, group by team and prioritize larger teams
        # This ensures teams with more members get environments first
        teams_items = {}
        for item in other_items:
            team = item['team_name']
            if team not in teams_items:
                teams_items[team] = []
            teams_items[team].append(item)
        
        # Sort items within each team by priority
        for team in teams_items:
            teams_items[team] = sorted(teams_items[team], key=lambda x: x.get('priority', 4))
        
        # Sort teams by size (larger teams first), then by name for consistency
        sorted_teams = sorted(teams_items.keys(), key=lambda t: (-len(teams_items[t]), t))
        
        # Build assignment order: round-robin but with larger teams first
        team_fair_items = []
        teams_assigned_count = {team: 0 for team in teams_items}
        max_items_per_team = max(len(items) for items in teams_items.values()) if teams_items else 0
        
        for round_num in range(max_items_per_team):
            for team in sorted_teams:  # Larger teams first
                items = teams_items[team]
                idx = teams_assigned_count[team]
                if idx < len(items):
                    item = items[idx]
                    team_fair_items.append(item)
                    teams_assigned_count[team] += 1
        
        # Final order: Pre-selected first, then team-fair others
        work_items_sorted = pre_selected_items + team_fair_items
        
        def check_conflicts(item, existing_assignments, selected_ms_ids):
            """Check for conflicts with existing assignments in an environment"""
            has_conflict = False
            has_different_team_conflict = False
            can_resolve_with_same_team_temp = False
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
                        # NOTE: Cross-team temp branching is DISABLED during auto-generation
                        # It's only allowed via Force Assign by Admin
                        break
                    else:
                        # Same team - check if both can use temp branches
                        if item.get('can_temp_branch', True) and existing.get('can_temp_branch', True):
                            can_resolve_with_same_team_temp = True
            
            return {
                'has_conflict': has_conflict,
                'has_different_team_conflict': has_different_team_conflict,
                'can_resolve_with_same_team_temp': can_resolve_with_same_team_temp,
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
            
            # Check microservice types for -second logic
            # IMPORTANT: -second environments are ONLY for Front microservice
            has_front = front_ms_id in selected_ms_ids if front_ms_id else 'Front' in selected_ms_names
            backend_ms_ids = [ms_id for ms_id in selected_ms_ids if ms_id != front_ms_id] if front_ms_id else []
            only_front = has_front and len(selected_ms_ids) == 1
            has_backend = len(backend_ms_ids) > 0
            has_mixed = has_front and has_backend
            
            assigned = False
            assigned_env = None
            is_temp_branch = False
            conflicts = []
            
            # STRATEGY 0: If work item has a pre-selected environment (set by Admin), assign directly there
            target_env = item.get('environment')
            if target_env and target_env != 'none' and target_env.strip():
                # Find the environment
                target_env_obj = next((e for e in environments if e['name'] == target_env), None)
                if target_env_obj:
                    env_id = target_env_obj['id']
                    existing_assignments = env_assignments[env_id]
                    
                    # Check for conflicts but assign anyway (admin decision)
                    conflict_result = check_conflicts(item, existing_assignments, selected_ms_ids)
                    
                    env_assignments[env_id].append(item)
                    assigned_env = target_env
                    assigned = True
                    
                    if conflict_result['has_conflict']:
                        is_temp_branch = True
                        conflicts = list(set(conflict_result['conflict_list']))
            
            # Skip other strategies if already assigned via pre-selected environment
            if assigned:
                # Create assignment result for pre-selected environment
                assignment = AssignmentResult(
                    user_id=user_id,
                    user_name=user_name,
                    team_name=team_name,
                    work_item_name=work_item_name,
                    assigned_environment=assigned_env,
                    microservices=selected_ms_names,
                    is_temp_branch=is_temp_branch,
                    conflicts=conflicts if conflicts else ['Pre-selected by Admin']
                )
                assignments.append(assignment)
                continue
            
            # STRATEGY 1: If ONLY Front microservice, try -second environments FIRST
            # This keeps -second for frontend-only testing
            if only_front and second_envs:
                # First try to join same team in -second
                for env in second_envs:
                    env_id = env['id']
                    existing_assignments = env_assignments[env_id]
                    
                    if not existing_assignments:
                        continue  # Will try empty -second below
                    
                    same_team_present = any(e['team_name'] == team_name for e in existing_assignments)
                    if not same_team_present:
                        continue
                    
                    conflict_result = check_conflicts(item, existing_assignments, selected_ms_ids)
                    
                    if not conflict_result['has_conflict']:
                        env_assignments[env_id].append(item)
                        assigned_env = env['name']
                        assigned = True
                        break
                    elif not conflict_result['has_different_team_conflict']:
                        if conflict_result['can_resolve_with_same_team_temp']:
                            env_assignments[env_id].append(item)
                            assigned_env = env['name']
                            is_temp_branch = True
                            conflicts = list(set(conflict_result['conflict_list']))
                            assigned = True
                            break
                
                # If not assigned, try empty -second
                if not assigned:
                    for env in second_envs:
                        env_id = env['id']
                        existing_assignments = env_assignments[env_id]
                        
                        if not existing_assignments:
                            env_assignments[env_id].append(item)
                            assigned_env = env['name']
                            assigned = True
                            break
                
                # If not assigned, try any -second without cross-team conflict
                if not assigned:
                    for env in second_envs:
                        env_id = env['id']
                        existing_assignments = env_assignments[env_id]
                        
                        if not existing_assignments:
                            continue
                        
                        conflict_result = check_conflicts(item, existing_assignments, selected_ms_ids)
                        
                        if not conflict_result['has_conflict']:
                            env_assignments[env_id].append(item)
                            assigned_env = env['name']
                            assigned = True
                            break
                        elif conflict_result['has_different_team_conflict']:
                            continue  # No cross-team in -second
                        elif conflict_result['can_resolve_with_same_team_temp']:
                            env_assignments[env_id].append(item)
                            assigned_env = env['name']
                            is_temp_branch = True
                            conflicts = list(set(conflict_result['conflict_list']))
                            assigned = True
                            break
            
            # Skip to creating assignment if only_front was assigned to -second
            if assigned and only_front:
                assignment = AssignmentResult(
                    user_id=user_id,
                    user_name=user_name,
                    team_name=team_name,
                    work_item_name=work_item_name,
                    assigned_environment=assigned_env,
                    microservices=selected_ms_names,
                    is_temp_branch=is_temp_branch,
                    conflicts=conflicts
                )
                assignments.append(assignment)
                continue
            
            # STRATEGY 2: For items with backend microservices, try regular environments
            # Priority:
            # 1. Environments where ONLY same-team members are (to keep team together)
            # 2. Empty environments  
            # 3. Environments with different teams but NO CONFLICT (no shared microservices)
            # NOTE: Cross-team TEMP BRANCH is DISABLED - only via Force Assign
            
            # First, try environments where ONLY same team is present
            for env in regular_envs:
                env_id = env['id']
                existing_assignments = env_assignments[env_id]
                
                if not existing_assignments:
                    continue  # Will try empty envs in next pass
                
                # Check if ONLY same team is in this environment
                all_same_team = all(e['team_name'] == team_name for e in existing_assignments)
                if not all_same_team:
                    continue  # Try same-team envs first
                
                conflict_result = check_conflicts(item, existing_assignments, selected_ms_ids)
                
                if not conflict_result['has_conflict']:
                    # No conflict, join team members
                    env_assignments[env_id].append(item)
                    assigned_env = env['name']
                    assigned = True
                    break
                elif conflict_result['can_resolve_with_same_team_temp']:
                    # Same team with conflict - use temp branches
                    env_assignments[env_id].append(item)
                    assigned_env = env['name']
                    is_temp_branch = True
                    conflicts = list(set(conflict_result['conflict_list']))
                    assigned = True
                    break
            
            # If not assigned, try EMPTY environments
            if not assigned:
                for env in regular_envs:
                    env_id = env['id']
                    existing_assignments = env_assignments[env_id]
                    
                    if not existing_assignments:
                        # Empty environment, assign directly
                        env_assignments[env_id].append(item)
                        assigned_env = env['name']
                        assigned = True
                        break
            
            # If not assigned, try environments with DIFFERENT teams but NO CONFLICT
            # This allows sharing when there's no microservice overlap
            if not assigned:
                for env in regular_envs:
                    env_id = env['id']
                    existing_assignments = env_assignments[env_id]
                    
                    if not existing_assignments:
                        continue  # Already tried above
                    
                    conflict_result = check_conflicts(item, existing_assignments, selected_ms_ids)
                    
                    # Allow ONLY if there's absolutely NO conflict (no shared microservices)
                    if not conflict_result['has_conflict']:
                        env_assignments[env_id].append(item)
                        assigned_env = env['name']
                        assigned = True
                        break
                    # If there's ANY conflict with different team -> skip (no cross-team temp)
                    # Cross-team temp is ONLY via Force Assign
            
            # STRATEGY 2: If not assigned to regular env, try SPLIT (FE to -second, BE to parent)
            # IMPORTANT: -second environments are ONLY for Front microservice
            # Cross-team temp branching is NOT allowed in -second during auto-generation
            if not assigned and has_mixed and second_envs:
                for sec_env in second_envs:
                    sec_env_id = sec_env['id']
                    parent_env_id = second_to_parent.get(sec_env_id)
                    
                    if not parent_env_id:
                        continue
                    
                    # Check if we can place Front in -second and BE in parent
                    sec_existing = env_assignments[sec_env_id]
                    parent_existing = env_assignments[parent_env_id]
                    
                    # Check Front conflicts in -second
                    # STRICT: Only same-team in -second environments
                    front_conflict_in_sec = False
                    can_temp_in_sec = True
                    front_temp_conflicts = []
                    
                    # Check if -second has different team (even without conflict, don't mix)
                    if sec_existing:
                        has_different_team_in_sec = any(e['team_name'] != team_name for e in sec_existing)
                        if has_different_team_in_sec:
                            continue  # Don't mix teams in -second
                    
                    for existing in sec_existing:
                        existing_ms = [ms_id for ms_id, sel in existing['microservices'].items() if sel]
                        if front_ms_id in existing_ms:
                            # There's a Front conflict in -second
                            front_temp_conflicts.append(existing['user_name'])
                            # Same team - check temp branch
                            if not (item.get('can_temp_branch', True) and existing.get('can_temp_branch', True)):
                                front_conflict_in_sec = True
                                break
                    
                    if front_conflict_in_sec:
                        continue
                    
                    # Check if parent has different team (even without conflict, don't mix)
                    if parent_existing:
                        has_different_team_in_parent = any(e['team_name'] != team_name for e in parent_existing)
                        if has_different_team_in_parent:
                            continue  # Don't mix teams in parent
                    
                    # Check BE conflicts in parent - same team only
                    be_conflict_in_parent = False
                    can_temp_in_parent = True
                    be_conflicts_list = []
                    for existing in parent_existing:
                        existing_ms = [ms_id for ms_id, sel in existing['microservices'].items() if sel]
                        common_be = set(backend_ms_ids) & set(existing_ms)
                        if common_be:
                            be_conflicts_list.extend([ms_id_to_name.get(ms_id, ms_id) for ms_id in common_be])
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
                    
                    # Mark that split happened and assignments were created
                    assigned = True
                    # Set flag to indicate we did a split (assignments already created)
                    break
            
            # Skip to next item ONLY if split was successful (STRATEGY 3 created assignments)
            if assigned and has_mixed and not assigned_env:
                continue
            
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
            
            # Create assignment result
            assignment = AssignmentResult(
                user_id=user_id,
                user_name=user_name,
                team_name=team_name,
                work_item_name=work_item_name,
                assigned_environment=assigned_env,
                microservices=selected_ms_names,
                is_temp_branch=is_temp_branch,
                conflicts=conflicts
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

# ============ TV SETUPS API ENDPOINTS ============

# Floors
@api_router.get("/tv/floors")
async def get_tv_floors(user_token: str):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Invalid user")
    
    floors = await db.tv_floors.find({}, {"_id": 0}).sort("name", 1).to_list(100)
    return floors

@api_router.post("/tv/floors")
async def create_tv_floor(floor: TVFloor, user_token: str):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user or user['role'] != 'Admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    floor_doc = floor.model_dump()
    floor_doc['created_at'] = floor_doc['created_at'].isoformat()
    await db.tv_floors.insert_one(floor_doc)
    floor_doc.pop('_id', None)
    return floor_doc

@api_router.put("/tv/floors/{floor_id}")
async def update_tv_floor(floor_id: str, name: str, user_token: str):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user or user['role'] != 'Admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.tv_floors.update_one({"id": floor_id}, {"$set": {"name": name}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Floor not found")
    return {"success": True}

@api_router.delete("/tv/floors/{floor_id}")
async def delete_tv_floor(floor_id: str, user_token: str):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user or user['role'] != 'Admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.tv_rooms.delete_many({"floor_id": floor_id})
    await db.tv_floors.delete_one({"id": floor_id})
    return {"success": True}

# Rooms
@api_router.get("/tv/rooms")
async def get_tv_rooms(user_token: str, floor_id: Optional[str] = None):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Invalid user")
    
    query = {"floor_id": floor_id} if floor_id else {}
    rooms = await db.tv_rooms.find(query, {"_id": 0}).sort([("pos", 1), ("side", 1)]).to_list(500)
    return rooms

@api_router.post("/tv/rooms")
async def create_tv_room(room: TVRoomCreate, user_token: str):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user or user['role'] != 'Admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    room_doc = TVRoom(**room.model_dump()).model_dump()
    room_doc['created_at'] = room_doc['created_at'].isoformat()
    await db.tv_rooms.insert_one(room_doc)
    
    await log_tv_activity(user, f"created room '{room.name}'")
    room_doc.pop('_id', None)
    return room_doc

@api_router.put("/tv/rooms/{room_id}")
async def update_tv_room(room_id: str, room: TVRoomUpdate, user_token: str):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user or user['role'] != 'Admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {k: v for k, v in room.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.tv_rooms.update_one({"id": room_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Room not found")
    
    updated = await db.tv_rooms.find_one({"id": room_id}, {"_id": 0})
    return updated

@api_router.delete("/tv/rooms/{room_id}")
async def delete_tv_room(room_id: str, user_token: str):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user or user['role'] != 'Admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    room = await db.tv_rooms.find_one({"id": room_id}, {"_id": 0})
    if room:
        await log_tv_activity(user, f"deleted room '{room.get('name', room_id)}'")
    
    await db.tv_rooms.delete_one({"id": room_id})
    await db.tv_notes.delete_many({"room_id": room_id})
    return {"success": True}

# Devices
@api_router.post("/tv/rooms/{room_id}/devices")
async def add_device_to_room(room_id: str, device: TVDeviceCreate, user_token: str):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user or user['role'] != 'Admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    room = await db.tv_rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    new_device = TVDevice(**device.model_dump()).model_dump()
    
    await db.tv_rooms.update_one({"id": room_id}, {"$push": {"devices": new_device}})
    await log_tv_activity(user, f"added {device.type} '{device.label}' to {room['name']}")
    
    updated_room = await db.tv_rooms.find_one({"id": room_id}, {"_id": 0})
    return updated_room

@api_router.put("/tv/rooms/{room_id}/devices/{device_id}")
async def update_device(room_id: str, device_id: str, device: TVDeviceUpdate, user_token: str):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Invalid user")
    
    room = await db.tv_rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    update_data = {k: v for k, v in device.model_dump().items() if v is not None}
    
    if user['role'] != 'Admin':
        allowed_fields = {'status'}
        update_data = {k: v for k, v in update_data.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    if 'status' in update_data:
        update_data['status_changed_at'] = datetime.now(timezone.utc).isoformat()
        update_data['status_changed_by'] = f"{user['first_name']} {user['last_name']}"
        
        device_info = next((d for d in room.get('devices', []) if d['id'] == device_id), None)
        if device_info:
            status_label = {'free': 'free to use', 'inuse': 'in use', 'not_available': 'not available'}.get(update_data['status'], update_data['status'])
            await log_tv_activity(user, f"marked {device_info['label']} ({room['name']}) as {status_label}")
    
    await db.tv_rooms.update_one(
        {"id": room_id, "devices.id": device_id},
        {"$set": {f"devices.$.{k}": v for k, v in update_data.items()}}
    )
    
    updated_room = await db.tv_rooms.find_one({"id": room_id}, {"_id": 0})
    return updated_room

@api_router.delete("/tv/rooms/{room_id}/devices/{device_id}")
async def delete_device(room_id: str, device_id: str, user_token: str):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user or user['role'] != 'Admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    room = await db.tv_rooms.find_one({"id": room_id}, {"_id": 0})
    if room:
        device_info = next((d for d in room.get('devices', []) if d['id'] == device_id), None)
        if device_info:
            await log_tv_activity(user, f"removed {device_info['label']} from {room['name']}")
    
    await db.tv_rooms.update_one({"id": room_id}, {"$pull": {"devices": {"id": device_id}}})
    await db.tv_notes.delete_many({"target_id": device_id})
    return {"success": True}

# Notes
@api_router.get("/tv/notes")
async def get_tv_notes(user_token: str, target_type: Optional[str] = None, target_id: Optional[str] = None, room_id: Optional[str] = None):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Invalid user")
    
    query = {}
    if target_type:
        query["target_type"] = target_type
    if target_id:
        query["target_id"] = target_id
    if room_id:
        query["room_id"] = room_id
    
    notes = await db.tv_notes.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return notes

@api_router.post("/tv/notes")
async def create_tv_note(note: TVNoteCreate, user_token: str):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Invalid user")
    
    note_doc = TVNote(
        **note.model_dump(),
        author_id=user['id'],
        author_name=f"{user['first_name']} {user['last_name']}"
    ).model_dump()
    note_doc['created_at'] = note_doc['created_at'].isoformat()
    
    await db.tv_notes.insert_one(note_doc)
    note_doc.pop('_id', None)
    return note_doc

@api_router.put("/tv/notes/{note_id}")
async def update_tv_note(note_id: str, text: str, user_token: str):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Invalid user")
    
    note = await db.tv_notes.find_one({"id": note_id}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if note['author_id'] != user['id'] and user['role'] != 'Admin':
        raise HTTPException(status_code=403, detail="Permission denied")
    
    await db.tv_notes.update_one(
        {"id": note_id},
        {"$set": {"text": text, "edited_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    updated = await db.tv_notes.find_one({"id": note_id}, {"_id": 0})
    return updated

@api_router.delete("/tv/notes/{note_id}")
async def delete_tv_note(note_id: str, user_token: str):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Invalid user")
    
    note = await db.tv_notes.find_one({"id": note_id}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if note['author_id'] != user['id'] and user['role'] != 'Admin':
        raise HTTPException(status_code=403, detail="Permission denied")
    
    await db.tv_notes.delete_one({"id": note_id})
    return {"success": True}

# Activity Log
@api_router.get("/tv/activity")
async def get_tv_activity(user_token: str, limit: int = 100):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Invalid user")
    
    cutoff = datetime.now(timezone.utc) - timedelta(hours=12)
    activities = await db.tv_activity.find(
        {"timestamp": {"$gte": cutoff.isoformat()}},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(limit)
    
    return activities

async def log_tv_activity(user: dict, message: str):
    activity = TVActivity(
        message=message,
        user_id=user['id'],
        user_name=f"{user['first_name']} {user['last_name']}"
    ).model_dump()
    activity['timestamp'] = activity['timestamp'].isoformat()
    await db.tv_activity.insert_one(activity)

@api_router.post("/tv/init-defaults")
async def init_tv_defaults(user_token: str):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user or user['role'] != 'Admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    existing_floors = await db.tv_floors.count_documents({})
    if existing_floors > 0:
        return {"message": "Data already exists", "initialized": False}
    
    default_floors = [
        {"id": "f1", "name": "Floor 1 - Corridor A", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": "f2", "name": "Floor 2 - Corridor B", "created_at": datetime.now(timezone.utc).isoformat()}
    ]
    await db.tv_floors.insert_many(default_floors)
    
    default_rooms = [
        {
            "id": "r1", "floor_id": "f1", "name": "Dhoma 1", "side": "left", "pos": 1,
            "devices": [
                {"id": "r1-tv1", "type": "tv", "label": "TV 1", "sn": "SN-TV10001", "x": 3, "y": 5, "w": 30, "h": 24, "status": "free"},
                {"id": "r1-h1", "type": "hello", "label": "Hello 1", "sn": "SN-HL10001", "x": 3, "y": 0, "w": 9, "h": 6, "status": "free"},
                {"id": "r1-bed1", "type": "bed", "label": "Bed 1", "x": 4, "y": 36, "w": 22, "h": 54, "status": "free"}
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "r2", "floor_id": "f1", "name": "Dhoma 2", "side": "right", "pos": 1,
            "devices": [
                {"id": "r2-tv1", "type": "tv", "label": "TV 1", "sn": "SN-TV20001", "x": 3, "y": 5, "w": 30, "h": 24, "status": "free"},
                {"id": "r2-wb1", "type": "whiteboard", "label": "Whiteboard", "sn": "SN-WB20001", "x": 63, "y": 4, "w": 12, "h": 26, "status": "free"},
                {"id": "r2-bed1", "type": "bed", "label": "Bed 1", "x": 35, "y": 36, "w": 22, "h": 54, "status": "free"}
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "r3", "floor_id": "f2", "name": "Dhoma A1", "side": "left", "pos": 1,
            "devices": [
                {"id": "r3-tv1", "type": "tv", "label": "TV 1", "sn": "SN-TV30001", "x": 3, "y": 5, "w": 30, "h": 24, "status": "free"},
                {"id": "r3-h1", "type": "hello", "label": "Hello 1", "sn": "SN-HL30001", "x": 3, "y": 0, "w": 9, "h": 6, "status": "free"},
                {"id": "r3-rs1", "type": "roomsign", "label": "Room Sign", "sn": "SN-RS30001", "x": 44, "y": 0, "w": 6, "h": 8, "status": "free"}
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    await db.tv_rooms.insert_many(default_rooms)
    
    return {"message": "Default data initialized", "initialized": True, "floors": 2, "rooms": 3}

# ============ FIND DEVICES API ENDPOINTS ============

import httpx
import base64
from cryptography.fernet import Fernet
import hashlib

# Simple encryption for storing passwords
def get_encryption_key():
    # Use a consistent key derived from environment or generate one
    secret = os.environ.get('SECRET_KEY', 'findenv-secret-key-2024')
    return base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())

def encrypt_password(password: str) -> str:
    f = Fernet(get_encryption_key())
    return f.encrypt(password.encode()).decode()

def decrypt_password(encrypted: str) -> str:
    f = Fernet(get_encryption_key())
    return f.decrypt(encrypted.encode()).decode()

# Default environments
DEFAULT_ENVIRONMENTS = [
    {"name": "staging", "display_name": "Staging", "order": 1},
    {"name": "weekly", "display_name": "Weekly", "order": 2},
    {"name": "nightly", "display_name": "Nightly", "order": 3},
    {"name": "qa", "display_name": "QA", "order": 4},
    {"name": "smoke", "display_name": "Smoke", "order": 5},
    {"name": "qc", "display_name": "QC", "order": 6},
    {"name": "beta", "display_name": "Beta", "order": 7},
    {"name": "uat", "display_name": "UAT", "order": 8},
    {"name": "sec", "display_name": "Security", "order": 9},
    {"name": "per", "display_name": "Performance", "order": 10},
    {"name": "reg", "display_name": "Regression", "order": 11},
    {"name": "int", "display_name": "Integration", "order": 12},
    {"name": "can", "display_name": "Canary", "order": 13},
]

# Initialize default environments
@api_router.post("/findenv/init-defaults")
async def init_findenv_defaults(user_token: str):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user or user['role'] != 'Admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    existing = await db.findenv_environments.count_documents({})
    if existing > 0:
        return {"message": "Environments already exist", "initialized": False}
    
    for env_data in DEFAULT_ENVIRONMENTS:
        env = FindEnvEnvironment(
            name=env_data["name"],
            display_name=env_data["display_name"],
            mdm_url=f"mdm.{env_data['name']}.solaborate.com",
            api_url=f"api.{env_data['name']}.solaborate.com",
            order=env_data["order"]
        ).model_dump()
        env['created_at'] = env['created_at'].isoformat()
        await db.findenv_environments.insert_one(env)
    
    return {"message": "Default environments initialized", "initialized": True, "count": len(DEFAULT_ENVIRONMENTS)}

# Environments CRUD
@api_router.get("/findenv/environments")
async def get_findenv_environments(user_token: str):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Invalid user")
    
    envs = await db.findenv_environments.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    
    # Initialize defaults if none exist
    if not envs:
        for env_data in DEFAULT_ENVIRONMENTS:
            env = FindEnvEnvironment(
                name=env_data["name"],
                display_name=env_data["display_name"],
                mdm_url=f"mdm.{env_data['name']}.solaborate.com",
                api_url=f"api.{env_data['name']}.solaborate.com",
                order=env_data["order"]
            ).model_dump()
            env['created_at'] = env['created_at'].isoformat()
            await db.findenv_environments.insert_one(env)
        envs = await db.findenv_environments.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    
    return envs

@api_router.post("/findenv/environments")
async def create_findenv_environment(env: FindEnvEnvironmentCreate, user_token: str):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user or user['role'] != 'Admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    env_doc = FindEnvEnvironment(
        name=env.name.lower().strip(),
        display_name=env.display_name,
        mdm_url=f"mdm.{env.name.lower().strip()}.solaborate.com",
        api_url=f"api.{env.name.lower().strip()}.solaborate.com",
        is_active=env.is_active,
        order=env.order
    ).model_dump()
    env_doc['created_at'] = env_doc['created_at'].isoformat()
    await db.findenv_environments.insert_one(env_doc)
    env_doc.pop('_id', None)
    return env_doc

@api_router.put("/findenv/environments/{env_id}")
async def update_findenv_environment(env_id: str, env: FindEnvEnvironmentUpdate, user_token: str):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user or user['role'] != 'Admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {k: v for k, v in env.model_dump().items() if v is not None}
    if 'name' in update_data:
        update_data['name'] = update_data['name'].lower().strip()
        update_data['mdm_url'] = f"mdm.{update_data['name']}.solaborate.com"
        update_data['api_url'] = f"api.{update_data['name']}.solaborate.com"
    
    result = await db.findenv_environments.update_one({"id": env_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Environment not found")
    
    updated = await db.findenv_environments.find_one({"id": env_id}, {"_id": 0})
    return updated

@api_router.delete("/findenv/environments/{env_id}")
async def delete_findenv_environment(env_id: str, user_token: str):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user or user['role'] != 'Admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.findenv_environments.delete_one({"id": env_id})
    return {"success": True}

# Settings Management
@api_router.get("/findenv/settings")
async def get_findenv_settings(user_token: str):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user or user['role'] != 'Admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await db.findenv_settings.find_one({"id": "findenv_settings"}, {"_id": 0})
    if not settings:
        return {"id": "findenv_settings", "azure_username": None, "has_password": False, "is_configured": False}
    
    return {
        "id": settings.get("id"),
        "azure_username": settings.get("azure_username"),
        "has_password": bool(settings.get("azure_password_encrypted")),
        "is_configured": bool(settings.get("azure_username") and settings.get("azure_password_encrypted")),
        "client_id": settings.get("client_id", "sol.web.endpointmanager.pkce"),
        "has_client_secret": bool(settings.get("client_secret_encrypted")),
        "scope": settings.get("scope", "openid profile sol.web.endpointmanager"),
        "last_login": settings.get("last_login"),
        "token_count": len(settings.get("tokens", {}))
    }

@api_router.post("/findenv/settings")
async def save_findenv_settings(
    user_token: str, 
    azure_username: str, 
    azure_password: str,
    client_id: str = "sol.web.endpointmanager.pkce",
    client_secret: Optional[str] = None,
    scope: str = "openid profile sol.web.endpointmanager"
):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user or user['role'] != 'Admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    encrypted_password = encrypt_password(azure_password)
    
    update_data = {
        "id": "findenv_settings",
        "azure_username": azure_username,
        "azure_password_encrypted": encrypted_password,
        "client_id": client_id,
        "scope": scope,
        "tokens": {}  # Clear tokens on credential change
    }
    
    # Only store client_secret if provided
    if client_secret:
        update_data["client_secret_encrypted"] = encrypt_password(client_secret)
    else:
        update_data["client_secret_encrypted"] = None
    
    await db.findenv_settings.update_one(
        {"id": "findenv_settings"},
        {"$set": update_data},
        upsert=True
    )
    
    return {"success": True, "message": "Settings saved"}

# Manual Token Management
@api_router.post("/findenv/tokens/{env_name}")
async def save_manual_token(env_name: str, user_token: str, access_token: str):
    """Save a manually obtained access token for an environment"""
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user or user['role'] != 'Admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Verify environment exists
    env = await db.findenv_environments.find_one({"name": env_name}, {"_id": 0})
    if not env:
        raise HTTPException(status_code=404, detail=f"Environment '{env_name}' not found")
    
    # Parse JWT to get expiration
    exp = None
    try:
        # JWT has 3 parts: header.payload.signature
        parts = access_token.split(".")
        if len(parts) == 3:
            payload = parts[1]
            # Add padding if needed
            payload += "=" * (-len(payload) % 4)
            decoded = json.loads(base64.urlsafe_b64decode(payload))
            exp = decoded.get("exp")
    except Exception as e:
        logging.warning(f"Could not parse JWT expiration: {e}")
    
    # If we couldn't parse exp, set it to 1 hour from now
    if not exp:
        exp = int(time.time() + 3600)
    
    # Update tokens in settings
    await db.findenv_settings.update_one(
        {"id": "findenv_settings"},
        {"$set": {f"tokens.{env_name}": {
            "token": access_token,
            "exp": exp,
            "manual": True,
            "saved_at": datetime.now(timezone.utc).isoformat()
        }}},
        upsert=True
    )
    
    # Calculate time until expiration
    time_left = exp - int(time.time())
    hours_left = max(0, time_left // 3600)
    mins_left = max(0, (time_left % 3600) // 60)
    
    return {
        "success": True,
        "environment": env_name,
        "expires_at": datetime.fromtimestamp(exp, tz=timezone.utc).isoformat(),
        "time_left": f"{hours_left}h {mins_left}m" if time_left > 0 else "Expired"
    }

@api_router.get("/findenv/tokens")
async def get_all_tokens_status(user_token: str):
    """Get status of all environment tokens"""
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Invalid user")
    
    settings = await db.findenv_settings.find_one({"id": "findenv_settings"}, {"_id": 0})
    stored_tokens = settings.get("tokens", {}) if settings else {}
    
    envs = await db.findenv_environments.find({"is_active": True}, {"_id": 0}).sort("order", 1).to_list(100)
    
    current_time = int(time.time())
    token_status = []
    
    for env in envs:
        env_name = env["name"]
        token_info = stored_tokens.get(env_name, {})
        token = token_info.get("token")
        exp = token_info.get("exp", 0)
        is_manual = token_info.get("manual", False)
        
        if not token:
            status = "no_token"
            time_left = None
        elif exp < current_time:
            status = "expired"
            time_left = 0
        elif exp - current_time < 15 * 60:  # Less than 15 minutes
            status = "expiring_soon"
            time_left = exp - current_time
        else:
            status = "valid"
            time_left = exp - current_time
        
        token_status.append({
            "environment": env_name,
            "display_name": env["display_name"],
            "status": status,
            "is_manual": is_manual,
            "expires_at": datetime.fromtimestamp(exp, tz=timezone.utc).isoformat() if exp else None,
            "time_left_seconds": time_left,
            "time_left_display": f"{time_left // 3600}h {(time_left % 3600) // 60}m" if time_left and time_left > 0 else None,
            "mdm_url": f"https://mdm.{env_name}.solaborate.com"
        })
    
    return {"tokens": token_status}

@api_router.delete("/findenv/tokens/{env_name}")
async def delete_token(env_name: str, user_token: str):
    """Delete a token for an environment"""
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user or user['role'] != 'Admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.findenv_settings.update_one(
        {"id": "findenv_settings"},
        {"$unset": {f"tokens.{env_name}": ""}}
    )
    
    return {"success": True, "message": f"Token for {env_name} deleted"}

# Device Search
@api_router.get("/findenv/search/{serial}")
async def search_device(serial: str, user_token: str, show_all: bool = False):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Invalid user")
    
    # Clean serial
    serial = serial.strip().replace(" ", "").replace("-", "")
    if not serial:
        raise HTTPException(status_code=400, detail="Serial number is required")
    
    # Get active environments
    envs = await db.findenv_environments.find({"is_active": True}, {"_id": 0}).sort("order", 1).to_list(100)
    if not envs:
        raise HTTPException(status_code=400, detail="No environments configured")
    
    # Get settings and tokens
    settings = await db.findenv_settings.find_one({"id": "findenv_settings"}, {"_id": 0})
    stored_tokens = settings.get("tokens", {}) if settings else {}
    
    results = []
    found_online = None
    device_details = None
    current_time = int(time.time())
    
    # Search all environments using stored tokens
    async with httpx.AsyncClient(timeout=10.0) as client:
        for env in envs:
            env_name = env["name"]
            result = FindEnvSearchResult(
                environment=env_name,
                display_name=env["display_name"],
                status="checking"
            )
            
            # Get token for this environment
            token_info = stored_tokens.get(env_name, {})
            token = token_info.get("token")
            token_exp = token_info.get("exp", 0)
            is_manual = token_info.get("manual", False)
            
            # Check if we have a valid token
            if not token:
                result.status = "no_token"
                result.error_message = f"No token configured. Click 'Manage Tokens' to add one for {env['display_name']}."
                results.append(result)
                continue
            
            # Check if token is expired
            if token_exp < current_time:
                result.status = "token_expired"
                result.error_message = f"Token expired. Click 'Refresh' to get a new token for {env['display_name']}."
                results.append(result)
                continue
            
            # Token is valid, search for device
            try:
                api_response = await client.get(
                    f"https://api.{env_name}.solaborate.com/v1.1/devices/{serial}/assigned-details",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "User-Agent": "FindEnv/2.0 (HelloCare Hub)"
                    }
                )
                
                if api_response.status_code == 200:
                    device_data = api_response.json()
                    device = device_data.get("device")
                    if device:
                        if device.get("isOnline"):
                            result.status = "online"
                            result.device_info = device
                            if not found_online:
                                found_online = env_name
                                # Get detailed info
                                dev_id = device.get("solHelloDeviceId", "")
                                try:
                                    detail_response = await client.get(
                                        f"https://api.{env_name}.solaborate.com/v1.1/devices/{serial}/details/{dev_id}",
                                        headers={
                                            "Authorization": f"Bearer {token}",
                                            "User-Agent": "FindEnv/2.0 (HelloCare Hub)"
                                        }
                                    )
                                    if detail_response.status_code == 200:
                                        device_details = detail_response.json()
                                        device_details["environment"] = env_name
                                        device_details["display_name"] = env["display_name"]
                                except Exception:
                                    pass
                        else:
                            result.status = "offline"
                            result.device_info = device
                    else:
                        result.status = "not_registered"
                elif api_response.status_code == 404:
                    result.status = "not_registered"
                elif api_response.status_code == 401:
                    result.status = "token_expired"
                    result.error_message = "Token expired or invalid. Click 'Refresh' to get a new token."
                elif api_response.status_code == 403:
                    result.status = "no_access"
                    result.error_message = "No access to this environment"
                else:
                    result.status = "error"
                    result.error_message = f"HTTP {api_response.status_code}"
            except Exception as e:
                result.status = "unreachable"
                result.error_message = str(e)
            
            results.append(result)
    
    # Log search
    history = FindEnvSearchHistory(
        serial=serial,
        user_id=user['id'],
        user_name=f"{user['first_name']} {user['last_name']}",
        found_in=found_online,
        status="found" if found_online else "not_found"
    ).model_dump()
    history['searched_at'] = history['searched_at'].isoformat()
    await db.findenv_search_history.insert_one(history)
    
    return {
        "serial": serial,
        "results": results if show_all else [r for r in results if r.status in ("online", "offline", "error", "no_access", "no_token", "token_expired", "unreachable")],
        "found_online": found_online,
        "device_details": device_details
    }

# Search History
@api_router.get("/findenv/history")
async def get_search_history(user_token: str, limit: int = 50):
    user = await db.users.find_one({"id": user_token}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Invalid user")
    
    history = await db.findenv_search_history.find(
        {},
        {"_id": 0}
    ).sort("searched_at", -1).to_list(limit)
    
    return history

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
