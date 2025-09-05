from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from bson import ObjectId
from enum import Enum

class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_core_schema__(cls, _source_type, _handler):
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


# ======= Users (admin/user) =======

class UserType(str, Enum):
    admin = "admin"
    user = "user"


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
    isOnline: Optional[bool] = Field(default=None, description="Czy urządzenie jest online")

    class Config:
        allow_population_by_field_name = True
        json_encoders = {ObjectId: str}


class DeviceUpdate(BaseModel):
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    photo: Optional[str] = None
    video: Optional[str] = None
    ip: Optional[str] = None
    thumbnail: Optional[str] = None


class DeviceMediaUpdate(BaseModel):
    photo: Optional[str] = None
    video: Optional[str] = None


class LocationData(BaseModel):
    name: str = Field(..., description="Location name")
    address: str = Field(..., description="Location address")
    devices: List[Device] = Field(default_factory=list, description="List of devices")


class Location(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    locations: Dict[str, LocationData]

    class Config:
        json_encoders = {ObjectId: str}


class User(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    login: str
    password: str
    user_type: UserType = Field(default=UserType.user)

    class Config:
        json_encoders = {ObjectId: str}


class UserCreate(BaseModel):
    login: str
    password: str
    user_type: UserType = Field(default=UserType.user)

    class Config:
        json_encoders = {ObjectId: str}


class UserResponse(BaseModel):
    id: str = Field(alias="_id")
    login: str
    user_type: UserType

    class Config:
        json_encoders = {ObjectId: str}


class LocationResponse(BaseModel):
    id: str = Field(alias="_id")
    name: str
    address: str
    devices: List[Device]

    class Config:
        json_encoders = {ObjectId: str}


class LocationCreate(BaseModel):
    name: str
    address: str
    devices: List[Device] = []

    class Config:
        json_encoders = {ObjectId: str}


from pydantic import BaseModel
from typing import List

class LocationIdsRequest(BaseModel):
    location_ids: List[str]

class UserDevicesResponse(BaseModel):
    user_id: str
    login: str
    devices: List[Device]


# ======= PRICE USERS – tu zmieniamy locationId -> locationIds =======

def _to_location_ids(value: Any) -> List[str]:
    """
    Akceptuje:
    - None -> []
    - "abc" -> ["abc"]
    - ["a","b"] -> ["a","b"]
    - dict z legacy kluczem {"locationId": "abc"} (na wszelki wypadek) -> ["abc"]
    """
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        # przefiltruj tylko str
        return [str(x) for x in value if isinstance(x, (str, bytes, int))]
    if isinstance(value, dict):
        legacy = value.get("locationId")
        if isinstance(legacy, str):
            return [legacy]
    return []


class PriceUser(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    first_name: str
    last_name: str
    email: str
    locationName: str
    # >>> ZAMIANA: było 'locationId: str' -> teraz:
    locationIds: List[str] = Field(default_factory=list)
    passwordHash: str

    class Config:
        allow_population_by_field_name = True
        json_encoders = {ObjectId: str}

    # Wsteczna kompatybilność (gdy ktoś wyśle locationId zamiast locationIds)
    @classmethod
    def model_validate(cls, obj, *args, **kwargs):
        # Skopiuj, nie modyfikuj oryginału
        if isinstance(obj, dict):
            data = dict(obj)
            if "locationIds" not in data:
                # jeśli legacy:
                if "locationId" in data:
                    data["locationIds"] = _to_location_ids(data.get("locationId"))
                    data.pop("locationId", None)
            else:
                data["locationIds"] = _to_location_ids(data.get("locationIds"))
            return super().model_validate(data, *args, **kwargs)
        return super().model_validate(obj, *args, **kwargs)


class PriceUserCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str
    locationName: str
    # można przesłać 1 lub wiele; akceptujemy też legacy "locationId" (obsłużymy w routerze)
    locationIds: Optional[List[str]] = None


class PriceUserLogin(BaseModel):
    email: str
    password: str


class PriceUserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    locationName: Optional[str] = None
    # >>> NOWE pole (zamiast locationId)
    locationIds: Optional[List[str]] = None


class PriceUserResponse(BaseModel):
    id: str = Field(alias="_id")
    first_name: str
    last_name: str
    email: str
    locationName: str
    locationIds: List[str]

    class Config:
        json_encoders = {ObjectId: str}
