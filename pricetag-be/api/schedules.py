# 📁 api/schedules.py
from fastapi import APIRouter, HTTPException, status, Request, Depends
from typing import List, Optional, Union, Literal
from pydantic import BaseModel, Field
from bson import ObjectId
from datetime import datetime

router = APIRouter()

def get_database(request: Request):
    return request.app.mongodb

# --- MODELE ---
class ScheduleMedia(BaseModel):
    filename: str
    mediaType: str  # "photo" lub "video"

class FixedSchedule(BaseModel):
    type: Literal["fixed"]
    date: datetime
    media: ScheduleMedia

class WeeklySchedule(BaseModel):
    type: Literal["weekly"]
    dayOfWeek: int  # 0=niedziela, 1=poniedzialek ...
    hour: int       # 0-23
    minute: int     # 0-59
    media: ScheduleMedia

ScheduleModel = Union[FixedSchedule, WeeklySchedule]

class ScheduleIn(BaseModel):
    locationId: str
    deviceId: str
    schedule: ScheduleModel

# --- ENDPOINTY ---
@router.post("/locations/{location_id}/devices/{device_id}/schedules", status_code=201)
async def add_schedule(location_id: str, device_id: str, schedule: ScheduleModel, db=Depends(get_database)):
    if not ObjectId.is_valid(location_id) or not ObjectId.is_valid(device_id):
        raise HTTPException(400, detail="Invalid ID format")

    existing = await db["schedules"].find_one({
        "deviceId": ObjectId(device_id),
        "locationId": ObjectId(location_id),
        **({"type": "fixed", "date": schedule.date} if schedule.type == "fixed" else
           {"type": "weekly", "dayOfWeek": schedule.dayOfWeek, "hour": schedule.hour, "minute": schedule.minute})
    })
    if existing:
        raise HTTPException(409, detail="Schedule already exists for given time")

    doc = schedule.dict()
    doc.update({
        "deviceId": ObjectId(device_id),
        "locationId": ObjectId(location_id),
        "createdAt": datetime.utcnow()
    })
    await db["schedules"].insert_one(doc)
    return {"message": "Schedule added"}

@router.get("/locations/{location_id}/devices/{device_id}/schedules", response_model=List[ScheduleModel])
async def get_device_schedules(location_id: str, device_id: str, db=Depends(get_database)):
    cursor = db["schedules"].find({
        "locationId": ObjectId(location_id),
        "deviceId": ObjectId(device_id)
    })
    result = []
    async for doc in cursor:
        result.append(doc)
    for r in result:
        r.pop("_id", None)
        r.pop("deviceId", None)
        r.pop("locationId", None)
        r.pop("createdAt", None)
    return result

@router.delete("/locations/{location_id}/devices/{device_id}/schedules", status_code=200)
async def delete_all_schedules(location_id: str, device_id: str, db=Depends(get_database)):
    result = await db["schedules"].delete_many({
        "locationId": ObjectId(location_id),
        "deviceId": ObjectId(device_id)
    })
    return {"message": f"Deleted {result.deleted_count} schedule(s)"}

@router.get("/locations/{location_id}/devices/{device_id}/has-schedule")
async def check_device_has_schedule(location_id: str, device_id: str, db=Depends(get_database)):
    if not ObjectId.is_valid(location_id) or not ObjectId.is_valid(device_id):
        raise HTTPException(400, detail="Invalid ID format")

    has_schedule = await db["schedules"].count_documents({
        "locationId": ObjectId(location_id),
        "deviceId": ObjectId(device_id)
    }) > 0

    return {"hasSchedule": has_schedule}