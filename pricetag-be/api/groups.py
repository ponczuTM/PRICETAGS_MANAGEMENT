from fastapi import APIRouter, HTTPException, status, Request, Depends
from bson import ObjectId
from pydantic import BaseModel, Field
from typing import List, Optional

router = APIRouter()

def get_database(request: Request):
    return request.app.mongodb

# ➕ Model grupy
class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None

class GroupResponse(BaseModel):
    id: str = Field(..., alias="_id")
    location_id: str
    name: str
    description: Optional[str]

# 1. POST /locations/{location_id}/groups – dodaj grupę
@router.post("/locations/{location_id}/groups", response_model=GroupResponse)
async def create_group(location_id: str, group: GroupCreate, db=Depends(get_database)):
    if not ObjectId.is_valid(location_id):
        raise HTTPException(400, detail="Invalid location_id")

    group_doc = {
        "location_id": ObjectId(location_id),
        "name": group.name,
        "description": group.description
    }
    result = await db["groups"].insert_one(group_doc)
    group_doc["_id"] = str(result.inserted_id)
    group_doc["location_id"] = str(group_doc["location_id"])
    return GroupResponse(**group_doc)


# 2. GET /locations/{location_id}/groups – pobierz wszystkie grupy
@router.get("/locations/{location_id}/groups", response_model=List[GroupResponse])
async def get_groups(location_id: str, db=Depends(get_database)):
    groups_cursor = db["groups"].find({"location_id": ObjectId(location_id)})
    groups = []
    async for group in groups_cursor:
        group["_id"] = str(group["_id"])
        group["location_id"] = str(group["location_id"])
        groups.append(GroupResponse(**group))
    return groups

# 3. POST /locations/{location_id}/devices/{device_id}/groups – dodaj grupę do urządzenia
@router.post("/locations/{location_id}/devices/{device_id}/groups")
async def add_device_to_group(location_id: str, device_id: str, body: dict, db=Depends(get_database)):
    group_id = body.get("group_id")
    if not ObjectId.is_valid(group_id):
        raise HTTPException(400, detail="Invalid group_id")

    result = await db["locations"].update_one(
        {"_id": ObjectId(location_id), "devices._id": device_id},  # ✅ zakłada string
        {"$addToSet": {"devices.$.groups": ObjectId(group_id)}}
    )

    if result.matched_count == 0:
        raise HTTPException(404, detail="Device or location not found")

    return {"message": "Group added to device"}

# 4. GET /locations/{location_id}/groups/{group_id}/devices – urządzenia przypisane do grupy
@router.get("/locations/{location_id}/groups/{group_id}/devices")
async def get_devices_in_group(location_id: str, group_id: str, db=Depends(get_database)):
    location = await db["locations"].find_one({"_id": ObjectId(location_id)})
    if not location:
        raise HTTPException(404, detail="Location not found")

    devices = [
        d for d in location.get("devices", [])
        if group_id in [str(g) for g in d.get("groups", [])]
    ]
    for d in devices:
        d["_id"] = str(d["_id"])
    return devices

# 5. DELETE /locations/{location_id}/devices/{device_id}/groups/{group_id} – usuń grupę z urządzenia
@router.delete("/locations/{location_id}/devices/{device_id}/groups/{group_id}")
async def remove_device_from_group(location_id: str, device_id: str, group_id: str, db=Depends(get_database)):
    result = await db["locations"].update_one(
        {"_id": ObjectId(location_id), "devices._id": device_id},  # string, nie ObjectId!
        {"$pull": {"devices.$.groups": ObjectId(group_id)}}
    )

    if result.matched_count == 0:
        raise HTTPException(404, detail="Device or location not found")

    return {"message": "Group removed from device"}

# 6. DELETE /locations/{location_id}/groups/{group_id} – usuń grupę
@router.delete("/locations/{location_id}/groups/{group_id}")
async def delete_group(location_id: str, group_id: str, db=Depends(get_database)):
    # Usuń grupę z kolekcji groups
    delete_result = await db["groups"].delete_one({
        "_id": ObjectId(group_id),
        "location_id": ObjectId(location_id)
    })

    if delete_result.deleted_count == 0:
        raise HTTPException(404, detail="Group not found")

    # Usuń referencje z urządzeń
    await db["locations"].update_many(
        {"_id": ObjectId(location_id)},
        {"$pull": {"devices.$[].groups": ObjectId(group_id)}}
    )

    return {"message": "Group deleted and removed from devices"}
