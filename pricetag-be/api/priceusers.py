from fastapi import APIRouter, HTTPException, Depends, Request, status
from models import PriceUserCreate, PriceUserUpdate, PriceUserResponse
from bson import ObjectId
from datetime import datetime
import random, string
from utils.auth import hash_password  # zapewnij że masz hashowanie
import logging
from typing import List
from fastapi import APIRouter, HTTPException, Depends, Request, status
from bson import ObjectId
from models import PriceUserResponse
from models import PriceUserLogin  # musisz mieć taki model w models.py
from utils.auth import verify_password, create_access_token



router = APIRouter()

def get_db(request: Request):
    return request.app.mongodb["priceusers"]

def generate_location_id(length=8):
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))


@router.post("/", response_model=PriceUserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(user: PriceUserCreate, db=Depends(get_db)):
    existing = await db.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    user_dict = user.dict()
    user_dict["passwordHash"] = hash_password(user_dict.pop("password"))
    if "locationId" not in user_dict or not user_dict["locationId"]:
        user_dict["locationId"] = generate_location_id()
    user_dict["created_at"] = user_dict["updated_at"] = datetime.utcnow()

    result = await db.insert_one(user_dict)
    user_dict["_id"] = str(result.inserted_id)
    return PriceUserResponse(**user_dict)


@router.put("/{user_id}", response_model=PriceUserResponse)
async def update_user(user_id: str, user: PriceUserUpdate, db=Depends(get_db)):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    update_fields = {}
    if user.first_name: update_fields["first_name"] = user.first_name
    if user.last_name: update_fields["last_name"] = user.last_name
    if user.email: update_fields["email"] = user.email
    if user.locationName: update_fields["locationName"] = user.locationName
    if user.password: update_fields["passwordHash"] = hash_password(user.password)
    if user.locationId: update_fields["locationId"] = user.locationId  # ← TO DODAĆ

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_fields["updated_at"] = datetime.utcnow()

    result = await db.update_one({"_id": ObjectId(user_id)}, {"$set": update_fields})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    updated_user = await db.find_one({"_id": ObjectId(user_id)})
    updated_user["_id"] = str(updated_user["_id"])
    return PriceUserResponse(**updated_user)



@router.delete("/{user_id}", status_code=204)
async def delete_user(user_id: str, db=Depends(get_db)):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    result = await db.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")


@router.delete("/", status_code=200)
async def delete_all_users(db=Depends(get_db)):
    result = await db.delete_many({})
    return {"message": f"Deleted {result.deleted_count} users"}

@router.get("/", response_model=List[PriceUserResponse])
async def get_all_users(db=Depends(get_db)):
    users = []
    async for user in db.find():
        user["_id"] = str(user["_id"])  # Konwersja ObjectId → str
        users.append(PriceUserResponse(**user))
    return users


@router.get("/{user_id}", response_model=PriceUserResponse)
async def get_user_by_id(user_id: str, db=Depends(get_db)):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    user = await db.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user["_id"] = str(user["_id"])
    return PriceUserResponse(**user)


@router.get("/{user_id}/locationid")
async def get_user_location_id(user_id: str, db=Depends(get_db)):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    user = await db.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {"locationId": user["locationId"]}

@router.post("/login")
async def login_user(data: PriceUserLogin, db=Depends(get_db)):
    user = await db.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["passwordHash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": str(user["_id"])})
    user["_id"] = str(user["_id"])

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }
