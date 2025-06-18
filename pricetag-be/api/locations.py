
from fastapi import APIRouter, HTTPException, Depends, status, Request
from typing import List
from models import Location, LocationCreate, LocationResponse, Device
from bson import ObjectId
import logging

from fastapi import APIRouter, HTTPException, Depends, status, Request
from models import Device, LocationCreate, LocationResponse
from bson import ObjectId
import logging


# Konfiguracja loggera
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

router = APIRouter()

# Function to get the database
def get_database(request: Request):
    return request.app.mongodb

# Endpoint to create a new location (single location)
@router.post("/", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
async def create_location(location: LocationCreate, db=Depends(get_database)):
    """
    Create a single location document
    """
    try:
        # Prepare location data
        location_data = {
            "id": str(ObjectId()),  # Generate unique ID for each location
            "name": location.name,
            "address": location.address,
            "devices": location.devices,
        }

        # Insert the location document in the locations collection
        result = await db["locations"].insert_one(location_data)

        # Get the created location
        created_location = await db["locations"].find_one({"_id": result.inserted_id})
        created_location["_id"] = str(created_location["_id"])

        return LocationResponse(**created_location)

    except Exception as e:
        logger.error(f"Error creating location: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating location: {str(e)}"
        )


# Function to get the database
def get_database(request: Request):
    return request.app.mongodb

# Endpoint to add a device to a location
# api.py

@router.post("/{location_id}/devices/", status_code=status.HTTP_201_CREATED)
async def add_device_to_location(location_id: str, device: Device, db=Depends(get_database)):
    """
    Add a device to a location
    """
    try:
        if not ObjectId.is_valid(location_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid location ID format"
            )

        location = await db["locations"].find_one({"_id": ObjectId(location_id)})
        if not location:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Location not found"
            )

        # Add unique ID to the device if not already present
        device_dict = {
            "clientId": device.clientId,
            "clientName": device.clientName,
            "changed": "false",
            "_id": str(ObjectId())
        }


        # Add the "changed" key with the value "false" to the device
        device_dict["changed"] = "false"
        
        # Add unique _id to the device
        device_dict["_id"] = str(ObjectId())  # Assign a unique ID to the device

        # Check if device already exists
        for existing_device in location.get("devices", []):
            if existing_device.get("clientId") == device.clientId:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Device with this clientId already exists in this location"
                )

        # Add the new device to the list of devices
        if "devices" not in location:
            location["devices"] = []
        
        location["devices"].append(device_dict)

        # Update the location in the database
        result = await db["locations"].update_one(
            {"_id": ObjectId(location_id)},
            {"$set": {"devices": location["devices"]}}
        )

        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Failed to update location"
            )

        # Convert _id and devices' _id to string before returning
        location["_id"] = str(location["_id"])
        for device in location["devices"]:
            device["_id"] = str(device["_id"])

        return {"message": "Device added successfully", "location": location}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error adding device to location: {str(e)}"
        )




# Endpoint to get all locations
@router.get("/", response_model=List[LocationResponse])
async def get_locations(db=Depends(get_database)):
    """
    Get all location documents
    """
    try:
        locations = []
        async for location in db["locations"].find():
            locations.append(LocationResponse(**location))
        return locations
    except Exception as e:
        logger.error(f"Error fetching locations: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching locations: {str(e)}"
        )

# Endpoint to get a specific location by ID
@router.get("/{location_id}", response_model=LocationResponse)
async def get_location(location_id: str, db=Depends(get_database)):
    """
    Get location by ID
    """
    try:
        # Convert string ID to ObjectId
        if not ObjectId.is_valid(location_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid location ID format"
            )

        location = await db["locations"].find_one({"_id": ObjectId(location_id)})
        if not location:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Location not found"
            )

        # Convert _id (ObjectId) to string before returning as a response
        location["_id"] = str(location["_id"])

        return LocationResponse(**location)

    except Exception as e:
        logger.error(f"Error fetching location: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching location: {str(e)}"
        )


@router.delete("/delete-all", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all_locations(db=Depends(get_database)):
    """
    Usuwa wszystkie lokalizacje z bazy danych
    """
    try:
        # Usuwanie wszystkich dokumentów w kolekcji "locations"
        result = await db["locations"].delete_many({})

        # Jeśli nie usunięto żadnych dokumentów, zwróć 404
        if result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Brak lokalizacji do usunięcia"
            )

        return {"message": "Wszystkie lokalizacje zostały usunięte"}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting all locations: {str(e)}"
        )


@router.delete("/{location_id}/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_device_from_location(location_id: str, device_id: str, db=Depends(get_database)):
    """
    Remove a device from a location by device _id
    """
    try:
        if not ObjectId.is_valid(location_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid location ID format"
            )

        if not ObjectId.is_valid(device_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid device ID format"
            )

        location = await db["locations"].find_one({"_id": ObjectId(location_id)})
        if not location:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Location not found"
            )

        # Find and remove the device with the provided device_id
        devices = location.get("devices", [])
        updated_devices = [device for device in devices if str(device["_id"]) != device_id]

        if len(devices) == len(updated_devices):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Device not found"
            )

        # Update the location with the new list of devices
        result = await db["locations"].update_one(
            {"_id": ObjectId(location_id)},
            {"$set": {"devices": updated_devices}}
        )

        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Failed to update location"
            )

        return {"message": "Device removed successfully"}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error removing device from location: {str(e)}"
        )


@router.get("/{location_id}/devices", response_model=List[Device])
async def get_devices_from_location(location_id: str, db=Depends(get_database)):
    """
    Get all devices from a specific location by its ID
    """
    try:
        if not ObjectId.is_valid(location_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid location ID format"
            )

        location = await db["locations"].find_one({"_id": ObjectId(location_id)})
        if not location:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Location not found"
            )

        devices = location.get("devices", [])

        # Zamień _id każdego urządzenia na string
        for device in devices:
            if "_id" in device and isinstance(device["_id"], ObjectId):
                device["_id"] = str(device["_id"])

        return devices

    except Exception as e:
        logger.error(f"Error fetching devices from location: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching devices from location: {str(e)}"
        )

@router.put("/{location_id}/devices/{device_id}/photo", status_code=200)
async def update_device_photo(location_id: str, device_id: str, body: dict, db=Depends(get_database)):
    """
    Update the photo for a specific device in a location
    """
    photo = body.get("photo")
    if not photo:
        raise HTTPException(status_code=400, detail="Missing photo")

    return await _update_device_field(location_id, device_id, {"photo": photo}, db)


@router.put("/{location_id}/devices/{device_id}/video", status_code=200)
async def update_device_video(location_id: str, device_id: str, body: dict, db=Depends(get_database)):
    """
    Update the video for a specific device in a location
    """
    video = body.get("video")
    if not video:
        raise HTTPException(status_code=400, detail="Missing video")

    return await _update_device_field(location_id, device_id, {"video": video}, db)


async def _update_device_field(location_id: str, device_id: str, update_fields: dict, db):
    if not ObjectId.is_valid(location_id) or not ObjectId.is_valid(device_id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    location = await db["locations"].find_one({"_id": ObjectId(location_id)})
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    devices = location.get("devices", [])
    updated = False

    for device in devices:
        if str(device["_id"]) == device_id:
            device.update(update_fields)
            updated = True
            break

    if not updated:
        raise HTTPException(status_code=404, detail="Device not found")

    await db["locations"].update_one(
        {"_id": ObjectId(location_id)},
        {"$set": {"devices": devices}}
    )

    return {"message": "Device updated successfully", "updated_fields": update_fields}


@router.delete("/{location_id}/devices/{device_id}/delete-files", status_code=200)
async def clear_device_files(location_id: str, device_id: str, db=Depends(get_database)):
    """
    Nadpisuje pola photo i video pustym stringiem dla danego urządzenia
    """
    if not ObjectId.is_valid(location_id) or not ObjectId.is_valid(device_id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    location = await db["locations"].find_one({"_id": ObjectId(location_id)})
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    devices = location.get("devices", [])
    updated = False

    for device in devices:
        if str(device.get("_id")) == device_id:
            device["photo"] = ""
            device["video"] = ""
            updated = True
            break

    if not updated:
        raise HTTPException(status_code=404, detail="Device not found")

    await db["locations"].update_one(
        {"_id": ObjectId(location_id)},
        {"$set": {"devices": devices}}
    )

    return {
        "message": "File fields cleared (set to empty string)",
        "device_id": device_id
    }
