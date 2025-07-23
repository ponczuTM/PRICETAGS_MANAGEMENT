from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from bson import ObjectId
from enum import Enum

class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_core_schema__(
            cls, _source_type, _handler
    ):
        from pydantic_core import core_schema
        return core_schema.json_or_python_schema(
            json_schema=core_schema.str_schema(),
            python_schema=core_schema.union_schema([
                core_schema.is_instance_schema(ObjectId),
                core_schema.chain_schema([
                    core_schema.str_schema(),
                    core_schema.no_info_plain_validator_function(cls.validate),
                ])
            ]),
            serialization=core_schema.plain_serializer_function_ser_schema(
                lambda x: str(x)
            ),
        )

    @classmethod
    def validate(cls, v):
        if isinstance(v, ObjectId):
            return v
        if isinstance(v, str):
            if not ObjectId.is_valid(v):
                raise ValueError("Invalid ObjectId")
            return ObjectId(v)
        raise ValueError("Invalid ObjectId")


# Enum to define user types
class UserType(str, Enum):
    admin = "admin"
    user = "user"


# Device model
# Device model
class Device(BaseModel):
    id: Optional[str] = Field(None, alias="_id", description="Unique ID of the device")
    clientId: str = Field(..., description="Unique device identifier")
    clientName: str = Field(..., description="Device name")
    ip: Optional[str] = Field("", description="Device IP address")
    photo: Optional[str] = Field(None, description="Base64 encoded photo")
    video: Optional[str] = Field(None, description="Base64 encoded video")
    changed: Optional[str] = Field("false", description="Has device been changed")
    thumbnail: Optional[str] = Field(None, description="Path to thumbnail")
    groups: Optional[List[PyObjectId]] = Field(default_factory=list, description="Lista ID grup")

    class Config:
        allow_population_by_field_name = True
        json_encoders = {ObjectId: str}


class DeviceUpdate(BaseModel):
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    photo: Optional[str] = None
    video: Optional[str] = None
    ip: Optional[str] = None
    thumbnail: Optional[str] = None  # ⬅️ DODANE



class DeviceMediaUpdate(BaseModel):
    photo: Optional[str] = None
    video: Optional[str] = None




# LocationData model
class LocationData(BaseModel):
    name: str = Field(..., description="Location name")
    address: str = Field(..., description="Location address")
    devices: List[Device] = Field(default_factory=list, description="List of devices")


# Location model
class Location(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    locations: Dict[str, LocationData]  # A dictionary of location names to LocationData

    class Config:
        json_encoders = {
            ObjectId: str  # Convert ObjectId to string before returning in response
        }


# User model
class User(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    login: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    user_type: UserType = Field(default=UserType.user)

    class Config:
        json_encoders = {
            ObjectId: str
        }


# Model for creating a new User (excluding ID and automatic fields)
class UserCreate(BaseModel):
    login: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    user_type: UserType = Field(default=UserType.user)

    class Config:
        json_encoders = {
            ObjectId: str  # Ensure ObjectId is serialized properly
        }



# Response model for User
class UserResponse(BaseModel):
    id: str = Field(alias="_id")
    login: str
    user_type: UserType

    class Config:
        json_encoders = {
            ObjectId: str
        }


# Model for the response when creating a new Location
class LocationResponse(BaseModel):
    id: str = Field(alias="_id")
    name: str
    address: str
    devices: List[Device]

    class Config:
        json_encoders = {
            ObjectId: str  # Convert ObjectId to string before returning in response
        }


# Model for creating a new Location
class LocationCreate(BaseModel):
    name: str
    address: str
    devices: List[Device] = []  # Optional, defaults to an empty list

    class Config:
        json_encoders = {
            ObjectId: str
        }


from pydantic import BaseModel
from typing import List

# Model dla ID lokalizacji
class LocationIdsRequest(BaseModel):
    location_ids: List[str]

class UserDevicesResponse(BaseModel):
    user_id: str
    login: str
    devices: List[Device]


