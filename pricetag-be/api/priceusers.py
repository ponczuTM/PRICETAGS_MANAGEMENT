from fastapi import APIRouter, HTTPException, Depends, Request, status
from typing import List, Dict, Any
from bson import ObjectId
from passlib.context import CryptContext
from datetime import datetime

from models import (
    PriceUser, PriceUserCreate, PriceUserUpdate, PriceUserResponse, PriceUserLogin
)

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ===== Helpers =====

def get_database(request: Request):
    return request.app.mongodb

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def _normalize_priceuser_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalizuje dokument z bazy:
    - konwertuje _id do str
    - scala legacy 'locationId' (str) do 'locationIds' (List[str])
    - usuwa stare pole 'locationId' z odpowiedzi
    """
    if not doc:
        return doc

    # _id -> str
    if "_id" in doc and isinstance(doc["_id"], ObjectId):
        doc["_id"] = str(doc["_id"])

    # migracja legacy
    if "locationIds" not in doc or not isinstance(doc["locationIds"], list):
        if "locationId" in doc and isinstance(doc["locationId"], str):
            doc["locationIds"] = [doc["locationId"]]
        elif "locationIds" in doc and isinstance(doc["locationIds"], str):
            doc["locationIds"] = [doc["locationIds"]]
        elif "locationIds" not in doc:
            doc["locationIds"] = []

    # nie pokazujemy legacy pola na zewnątrz
    doc.pop("locationId", None)

    return doc

def _ensure_locationIds_in_update(update: Dict[str, Any]) -> Dict[str, Any]:
    """
    Zapewnia, że legacy 'locationId' zostanie zamienione na tablicę 'locationIds'.
    """
    if "locationIds" in update and update["locationIds"] is not None:
        if isinstance(update["locationIds"], str):
            update["locationIds"] = [update["locationIds"]]
        elif isinstance(update["locationIds"], list):
            update["locationIds"] = [str(x) for x in update["locationIds"]]
    if "locationId" in update and update["locationId"]:
        val = update.pop("locationId")
        if isinstance(val, list):
            update["locationIds"] = [str(x) for x in val]
        else:
            update["locationIds"] = [str(val)]
    return update


# ===== Endpoints =====

@router.post("/login")
async def priceuser_login(payload: PriceUserLogin, db=Depends(get_database)):
    """
    Logowanie PriceUser po email + password (bcrypt).
    Zwraca dane użytkownika i placeholder tokenu.
    """
    doc = await db["priceusers"].find_one({"email": payload.email})
    if not doc:
        # raise HTTPException(status_code=401, detail="Invalid email or password")
        raise HTTPException(status_code=401, detail="Invalid email - dont exists in database")

    password_hash = doc.get("passwordHash") or ""
    if not pwd_context.verify(payload.password, password_hash):
        # raise HTTPException(status_code=401, detail="Invalid email or password")
        raise HTTPException(status_code=401, detail="Invalid password - dont match with email")

    doc = _normalize_priceuser_doc(doc)

    # 🔑 sprawdzenie czy są przypisane lokalizacje
    if not doc.get("locationIds") or len(doc["locationIds"]) == 0:
        raise HTTPException(status_code=403, detail="User has no assigned locations")

    return {
        "message": "Logged in",
        "user": PriceUserResponse(**doc),
        "token": "dummy-token"
    }



@router.post("/", response_model=PriceUserResponse, status_code=status.HTTP_201_CREATED)
async def create_priceuser(payload: PriceUserCreate, db=Depends(get_database)):
    """
    Tworzy PriceUser z locationIds (lista). Backward-compat:
    jeśli front wyśle tylko 1 locationId (legacy) – zamienimy na tablicę.
    """
    # sprawdź duplikat e-maila
    existing = await db["priceusers"].find_one({"email": payload.email})
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    # zbuduj locationIds
    location_ids: List[str] = []
    if payload.locationIds is not None:
        location_ids = [str(x) for x in payload.locationIds]

    doc = {
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "email": payload.email,
        "locationName": payload.locationName,
        "locationIds": location_ids,     # <=== zapisujemy listę
        "passwordHash": hash_password(payload.password),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = await db["priceusers"].insert_one(doc)
    created = await db["priceusers"].find_one({"_id": result.inserted_id})
    created = _normalize_priceuser_doc(created)

    return PriceUserResponse(**created)


@router.get("/", response_model=List[PriceUserResponse])
async def list_priceusers(db=Depends(get_database)):
    users: List[PriceUserResponse] = []
    async for doc in db["priceusers"].find():
        doc = _normalize_priceuser_doc(doc)
        users.append(PriceUserResponse(**doc))
    return users


@router.get("/{user_id}", response_model=PriceUserResponse)
async def get_priceuser(user_id: str, db=Depends(get_database)):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user_id")

    doc = await db["priceusers"].find_one({"_id": ObjectId(user_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")

    doc = _normalize_priceuser_doc(doc)
    return PriceUserResponse(**doc)


@router.put("/{user_id}", response_model=PriceUserResponse)
async def update_priceuser(user_id: str, payload: PriceUserUpdate, db=Depends(get_database)):
    """
    Nadpisywanie pól (PUT). Obsługuje:
    - first_name, last_name, email, locationName, locationIds (lista), password (hashowany)
    - usuwa legacy 'locationId' jeśli jeszcze był
    """
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user_id")

    update_data = payload.dict(exclude_unset=True)
    update_data = _ensure_locationIds_in_update(update_data)

    # hasło
    if "password" in update_data and update_data["password"]:
        update_data["passwordHash"] = hash_password(update_data.pop("password"))

    # jeśli ktoś wyśle pustą listę locationIds, to tak ją zapiszemy
    if "locationIds" in update_data and update_data["locationIds"] is None:
        update_data["locationIds"] = []

    update_op = {
        "$set": {
            **{k: v for k, v in update_data.items() if k != "locationId"},
            "updated_at": datetime.utcnow()
        },
        "$unset": {
            "locationId": ""   # legacy cleanup
        }
    }

    result = await db["priceusers"].update_one(
        {"_id": ObjectId(user_id)},
        update_op
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    doc = await db["priceusers"].find_one({"_id": ObjectId(user_id)})
    doc = _normalize_priceuser_doc(doc)
    return PriceUserResponse(**doc)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_priceuser(user_id: str, db=Depends(get_database)):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user_id")

    result = await db["priceusers"].delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return None
