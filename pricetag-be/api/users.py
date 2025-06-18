from fastapi import APIRouter, HTTPException, Depends, Request, status
from typing import List
from models import User, UserCreate, UserResponse, LocationIdsRequest, UserDevicesResponse, Device
from passlib.context import CryptContext
from bson import ObjectId
import logging

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
logger = logging.getLogger(__name__)

# Dependency to get database connection
def get_database(request: Request):
    return request.app.mongodb

# Password hashing
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

# Create new user
@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(user: UserCreate, db=Depends(get_database)):
    """
    Create a new user with hashed password
    """
    try:
        # Check if user already exists
        existing_user = await db["users"].find_one({"login": user.login})
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this login already exists"
            )

        # Hash password and create user
        hashed_password = hash_password(user.password)
        user_dict = user.dict()
        user_dict["password"] = hashed_password
        user_dict["_id"] = ObjectId()  # Generate new ObjectId

        result = await db["users"].insert_one(user_dict)

        # Get created user and convert _id to string
        created_user = await db["users"].find_one({"_id": result.inserted_id})
        created_user["_id"] = str(created_user["_id"])

        return UserResponse(**created_user)

    except Exception as e:
        logger.error(f"Error creating user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating user: {str(e)}"
        )

# Get all users
@router.get("/", response_model=List[UserResponse])
async def get_users(db=Depends(get_database)):
    """
    Get list of all users
    """
    try:
        users = []
        async for user in db["users"].find():
            user["_id"] = str(user["_id"])  # Convert ObjectId to string
            users.append(UserResponse(**user))
        return users
    except Exception as e:
        logger.error(f"Error fetching users: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching users: {str(e)}"
        )

# Get single user by ID
@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, db=Depends(get_database)):
    """
    Get user by ID
    """
    try:
        if not ObjectId.is_valid(user_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user ID format"
            )

        user = await db["users"].find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        user["_id"] = str(user["_id"])  # Convert ObjectId to string
        return UserResponse(**user)

    except Exception as e:
        logger.error(f"Error fetching user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching user: {str(e)}"
        )

# Add locations to user
@router.put("/{user_id}/locations", response_model=UserResponse)
async def add_locations_to_user(
    user_id: str, 
    location_ids_request: LocationIdsRequest, 
    db=Depends(get_database)
):
    """
    Add locations to a user
    """
    try:
        location_ids = location_ids_request.location_ids

        # Validate user ID
        if not ObjectId.is_valid(user_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user ID format"
            )
        
        # Check if user exists
        user = await db["users"].find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Validate location IDs
        for location_id in location_ids:
            if not ObjectId.is_valid(location_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid location ID format: {location_id}"
                )
            location = await db["locations"].find_one({"_id": ObjectId(location_id)})
            if not location:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Location with ID {location_id} not found"
                )

        # Add locations to user
        result = await db["users"].update_one(
            {"_id": ObjectId(user_id)},
            {"$addToSet": {"locations": {"$each": location_ids}}}
        )

        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found after update attempt"
            )

        # Return updated user
        updated_user = await db["users"].find_one({"_id": ObjectId(user_id)})
        updated_user["_id"] = str(updated_user["_id"])
        return UserResponse(**updated_user)

    except Exception as e:
        logger.error(f"Error updating user locations: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating user locations: {str(e)}"
        )

# Get all devices from user's locations
@router.get("/{user_id}/devices", response_model=UserDevicesResponse)
async def get_user_devices(user_id: str, db=Depends(get_database)):
    """
    Get all devices from all locations assigned to a user
    """
    try:
        # Validate user ID
        if not ObjectId.is_valid(user_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user ID format"
            )

        # Get user document
        user = await db["users"].find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Get user's location IDs
        location_ids = user.get("locations", [])
        if not location_ids:
            return UserDevicesResponse(
                user_id=user_id,
                login=user["login"],
                devices=[]
            )

        # Convert string location IDs to ObjectId
        location_object_ids = [ObjectId(loc_id) for loc_id in location_ids]

        # Find all locations that belong to the user
        locations_cursor = db["locations"].find({"_id": {"$in": location_object_ids}})
        locations = await locations_cursor.to_list(length=None)

        # Collect all devices from all locations
        all_devices = []
        for location in locations:
            devices = location.get("devices", [])
            # Convert device _id to string if it exists
            for device in devices:
                if "_id" in device and isinstance(device["_id"], ObjectId):
                    device["_id"] = str(device["_id"])
            all_devices.extend(devices)

        return UserDevicesResponse(
            user_id=user_id,
            login=user["login"],
            devices=all_devices
        )

    except Exception as e:
        logger.error(f"Error fetching user devices: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching user devices: {str(e)}"
        )