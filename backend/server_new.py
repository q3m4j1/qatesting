from fastapi import FastAPI, APIRouter, HTTPException, status, Response, Request, Header
from fastapi.responses import JSONResponse
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
    approved: bool = True  # For manually created users
    oauth_provider: Optional[str] = None

class PendingUser(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    picture: Optional[str] = None
    oauth_provider: str  # "google" or "azure"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    approved: bool = False

class ApproveUserRequest(BaseModel):
    role: str
    team_name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    user: User
    token: str

class SessionExchangeRequest(BaseModel):
    session_id: str

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
    allowed_users: List[str]
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
    microservices: Dict[str, bool]
    environment: Optional[str] = None
    can_temp_branch: bool = False
    priority: int
    comments: Optional[str] = None
    assigned_environment: Optional[str] = None
    date: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WorkItemCreate(BaseModel):
    work_item_name: str
    microservices: Dict[str, bool]
    environment: Optional[str] = None
    can_temp_branch: bool = False
    priority: int
    comments: Optional[str] = None

class WorkItemUpdate(BaseModel):
    work_item_name: Optional[str] = None
    microservices: Optional[Dict[str, bool]] = None
    environment: Optional[str] = None
    can_temp_branch: Optional[bool] = None
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

# OAuth Authentication routes
@api_router.post("/auth/oauth/exchange")
async def oauth_exchange(request: SessionExchangeRequest, response: Response):
    """Exchange session_id from OAuth for session token"""
    try:
        # Get user data from Emergent Auth
        oauth_data = await exchange_session_id(request.session_id)
        
        email = oauth_data["email"]
        name = oauth_data.get("name", "")
        picture = oauth_data.get("picture")
        session_token = oauth_data["session_token"]
        
        # Check if user exists and is approved
        user_doc = await db.users.find_one({"email": email}, {"_id": 0})
        
        if user_doc:
            # User exists
            if not user_doc.get("approved", False):
                raise HTTPException(status_code=403, detail="Your account is pending admin approval")
            
            # Create session
            await create_session(db, user_doc["id"], session_token)
            set_session_cookie(response, session_token)
            
            # Convert datetime
            if isinstance(user_doc['created_at'], str):
                user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
            
            user_doc.pop('password', None)
            return {"user": user_doc, "status": "approved"}
        
        # Check if pending user exists
        pending_doc = await db.pending_users.find_one({"email": email}, {"_id": 0})
        
        if pending_doc:
            return {"status": "pending", "message": "Your account is awaiting admin approval"}
        
        # Create new pending user
        provider = "google"  # Default to Google, can be enhanced to detect Azure
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
    
    # Check if approved
    if not user.get("approved", False):
        raise HTTPException(status_code=403, detail="Account pending approval")
    
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout current user"""
    await logout_user(request, response, db)
    return {"message": "Logged out successfully"}

# Traditional login (for backward compatibility)
@api_router.post("/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    user_doc = await db.users.find_one({"email": request.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(request.password, user_doc['password']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user_doc.get("approved", True):
        raise HTTPException(status_code=403, detail="Account pending approval")
    
    if isinstance(user_doc['created_at'], str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    user_doc.pop('password', None)
    user = User(**user_doc)
    
    return LoginResponse(user=user, token=user.id)

# Pending users management (Admin only)
@api_router.get("/pending-users")
async def get_pending_users(request: Request):
    """Get all pending users awaiting approval"""
    user = await get_current_user(request, db)
    if not user or user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    pending = await db.pending_users.find({}, {"_id": 0}).to_list(1000)
    for p in pending:
        if isinstance(p['created_at'], str):
            p['created_at'] = datetime.fromisoformat(p['created_at'])
    return pending

@api_router.post("/pending-users/{user_id}/approve")
async def approve_pending_user(user_id: str, approval: ApproveUserRequest, request: Request):
    """Approve a pending user"""
    user = await get_current_user(request, db)
    if not user or user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get pending user
    pending_doc = await db.pending_users.find_one({"id": user_id}, {"_id": 0})
    if not pending_doc:
        raise HTTPException(status_code=404, detail="Pending user not found")
    
    # Parse name
    name_parts = pending_doc['name'].split(' ', 1)
    first_name = name_parts[0] if len(name_parts) > 0 else pending_doc['name']
    last_name = name_parts[1] if len(name_parts) > 1 else ""
    
    # Create approved user
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
    doc['password'] = hash_password(str(uuid.uuid4()))  # Random password (won't be used for OAuth)
    
    await db.users.insert_one(doc)
    
    # Remove from pending
    await db.pending_users.delete_one({"id": user_id})
    
    return {"message": "User approved successfully", "user": new_user}

@api_router.delete("/pending-users/{user_id}")
async def reject_pending_user(user_id: str, request: Request):
    """Reject a pending user"""
    user = await get_current_user(request, db)
    if not user or user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.pending_users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pending user not found")
    
    return {"message": "User rejected successfully"}

# User management routes (existing, updated with English)
@api_router.post("/users", response_model=User)
async def create_user(user: UserCreate, request: Request):
    admin = await get_current_user(request, db)
    if not admin or admin.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Only admins can create users")
    
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
async def get_users(request: Request):
    admin = await get_current_user(request, db)
    if not admin or admin.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Only admins can view users")
    
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    for user in users:
        if isinstance(user['created_at'], str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
    return users

@api_router.put("/users/{user_id}", response_model=User)
async def update_user(user_id: str, user: UserCreate, request: Request):
    admin = await get_current_user(request, db)
    if not admin or admin.get("role") != "Admin":
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
async def delete_user(user_id: str, request: Request):
    admin = await get_current_user(request, db)
    if not admin or admin.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Only admins can delete users")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}

# Continue with rest of endpoints...
# (Microservices, Environments, Teams, Work Items, Assignments)
# I'll add them in the next part due to length
