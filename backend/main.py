# main.py
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from pymongo import MongoClient, ASCENDING
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
import os, uuid

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "children_notes_app")
SECRET_KEY = os.getenv("SECRET_KEY")  # require in env for prod
if not SECRET_KEY:
    # For local dev only; set SECRET_KEY in env for deploy
    SECRET_KEY = "dev-only-secret-not-for-prod"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

# Explicit CORS origins; add production frontend origin(s) here
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

# -----------------------------------------------------------------------------
# App + DB init with lifespan
# -----------------------------------------------------------------------------
client: MongoClient = MongoClient(MONGO_URI)
db = client[DB_NAME]
users_col = db["users"]
notes_col = db["notes"]
folders_col = db["folders"]

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create useful indexes (idempotent)
    users_col.create_index([("username", ASCENDING)], unique=True)
    folders_col.create_index([("owner_username", ASCENDING)])
    notes_col.create_index([("owner_username", ASCENDING)])
    yield
    # No teardown required

app = FastAPI(title="Children Notes App", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# Security
# -----------------------------------------------------------------------------
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()

def hash_password(pw: str) -> str:
    return pwd_ctx.hash(pw)

def verify_password(pw: str, hashed: str) -> bool:
    return pwd_ctx.verify(pw, hashed)

def create_access_token(username: str) -> str:
    to_encode = {"sub": username, "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_username_from_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None

# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------
class SignupIn(BaseModel):
    username: str
    password: str
    role: str = Field(..., pattern="^(child|parent)$")
    parent_username: Optional[str] = None

class LoginIn(BaseModel):
    username: str
    password: str

class NoteIn(BaseModel):
    title: str
    content: Optional[str] = ""
    tags: Optional[List[str]] = []
    checkbox_items: Optional[List[Dict[str, Any]]] = []
    folder_id: Optional[str] = None

class NoteOut(NoteIn):
    id: str
    owner_username: str

class FolderIn(BaseModel):
    name: str

class FolderOut(BaseModel):
    id: str
    name: str
    owner_username: str

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def normalize_username(u: str) -> str:
    return u.strip().lower()

def find_user(username: str):
    return users_col.find_one({"username": normalize_username(username)})

def require_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    token = credentials.credentials
    username = get_username_from_token(token)
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = find_user(username)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/signup", status_code=201)
def signup(payload: SignupIn):
    uname = normalize_username(payload.username)
    if find_user(uname):
        raise HTTPException(status_code=400, detail="Username exists")
    if payload.role == "child" and payload.parent_username:
        parent = find_user(payload.parent_username)
        if not parent or parent.get("role") != "parent":
            raise HTTPException(status_code=400, detail="parent_username not found or not a parent")
    if payload.role == "child" and not payload.parent_username:
        # explicit requirement for this app: child must link to a parent
        raise HTTPException(status_code=400, detail="child must include parent_username")
    users_col.insert_one(
        {
            "username": uname,
            "password_hash": hash_password(payload.password),
            "role": payload.role,
            "parent_username": normalize_username(payload.parent_username) if payload.parent_username else None,
        }
    )
    return {"message": "user created"}

@app.post("/login")
def login(payload: LoginIn):
    user = find_user(payload.username)
    if not user or not verify_password(payload.password, user["password_hash"]):
        # uniform error to avoid user enumeration
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(user["username"])
    return {"access_token": token, "token_type": "bearer", "role": user["role"]}

# Folders
@app.post("/folders", response_model=FolderOut)
def create_folder(payload: FolderIn, current_user: dict = Depends(require_user)):
    if current_user["role"] != "child":
        raise HTTPException(status_code=403, detail="Only children can create folders")
    folder_id = str(uuid.uuid4())
    folders_col.insert_one({"id": folder_id, "name": payload.name, "owner_username": current_user["username"]})
    return {"id": folder_id, "name": payload.name, "owner_username": current_user["username"]}

@app.get("/folders", response_model=List[FolderOut])
def list_folders(current_user: dict = Depends(require_user)):
    if current_user["role"] == "child":
        cur = folders_col.find({"owner_username": current_user["username"]})
    else:
        children = list(users_col.find({"parent_username": current_user["username"]}, {"username": 1}))
        child_usernames = [c["username"] for c in children]
        cur = folders_col.find({"owner_username": {"$in": child_usernames}})
    return [{"id": f["id"], "name": f["name"], "owner_username": f["owner_username"]} for f in cur]

# Notes
@app.post("/notes", response_model=NoteOut)
def create_note(payload: NoteIn, current_user: dict = Depends(require_user)):
    if current_user["role"] != "child":
        raise HTTPException(status_code=403, detail="Only children can create notes")
    note_id = str(uuid.uuid4())
    doc = payload.model_dump()
    doc.update({"id": note_id, "owner_username": current_user["username"]})
    notes_col.insert_one(doc)
    return {"id": note_id, "owner_username": current_user["username"], **payload.model_dump()}

@app.get("/notes", response_model=List[NoteOut])
def list_notes(current_user: dict = Depends(require_user)):
    if current_user["role"] == "child":
        cur = notes_col.find({"owner_username": current_user["username"]})
    else:
        children = list(users_col.find({"parent_username": current_user["username"]}, {"username": 1}))
        child_usernames = [c["username"] for c in children]
        cur = notes_col.find({"owner_username": {"$in": child_usernames}})
    out = []
    for n in cur:
        out.append(
            {
                "id": n["id"],
                "owner_username": n["owner_username"],
                "title": n.get("title", ""),
                "content": n.get("content", ""),
                "tags": n.get("tags", []),
                "checkbox_items": n.get("checkbox_items", []),
                "folder_id": n.get("folder_id"),
            }
        )
    return out

@app.get("/notes/{note_id}", response_model=NoteOut)
def get_note(note_id: str, current_user: dict = Depends(require_user)):
    n = notes_col.find_one({"id": note_id})
    if not n:
        raise HTTPException(status_code=404, detail="Note not found")
    # child owner or the parent of the owner
    if current_user["role"] == "child" and n["owner_username"] != current_user["username"]:
        raise HTTPException(status_code=403, detail="Not allowed")
    if current_user["role"] == "parent":
        owner = find_user(n["owner_username"])
        if not owner or owner.get("parent_username") != current_user["username"]:
            raise HTTPException(status_code=403, detail="Not allowed")
    return {
        "id": n["id"],
        "owner_username": n["owner_username"],
        "title": n.get("title", ""),
        "content": n.get("content", ""),
        "tags": n.get("tags", []),
        "checkbox_items": n.get("checkbox_items", []),
        "folder_id": n.get("folder_id"),
    }

@app.put("/notes/{note_id}", response_model=NoteOut)
def update_note(note_id: str, payload: NoteIn, current_user: dict = Depends(require_user)):
    n = notes_col.find_one({"id": note_id})
    if not n:
        raise HTTPException(status_code=404, detail="Note not found")
    if current_user["role"] != "child" or n["owner_username"] != current_user["username"]:
        raise HTTPException(status_code=403, detail="Only owning child can modify this note")
    update_doc = payload.model_dump()
    notes_col.update_one({"id": note_id}, {"$set": update_doc})
    updated = notes_col.find_one({"id": note_id})
    return {
        "id": updated["id"],
        "owner_username": updated["owner_username"],
        "title": updated.get("title", ""),
        "content": updated.get("content", ""),
        "tags": updated.get("tags", []),
        "checkbox_items": updated.get("checkbox_items", []),
        "folder_id": updated.get("folder_id"),
    }

@app.delete("/notes/{note_id}", status_code=204)
def delete_note(note_id: str, current_user: dict = Depends(require_user)):
    n = notes_col.find_one({"id": note_id})
    if not n:
        raise HTTPException(status_code=404, detail="Note not found")
    if current_user["role"] != "child" or n["owner_username"] != current_user["username"]:
        raise HTTPException(status_code=403, detail="Only owning child can delete this note")
    notes_col.delete_one({"id": note_id})
    return
