
from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List
from bson import ObjectId
from datetime import datetime

from models import (
    UserCreate, UserUpdate, UserResponse, LoginRequest, LoginResponse,
    LocationCreate, LocationUpdate, LocationResponse, Device, DeviceUpdate
)
from config import users_collection, locations_collection
from utils import hash_password, verify_password, user_helper, location_helper, validate_object_id

# Inicjalizacja FastAPI
app = FastAPI(
    title="User & Location Management API",
    description="API do zarządzania użytkownikami i lokalizacjami z urządzeniami",
    version="1.0.0"
)

security = HTTPBearer()


# Dependency do weryfikacji tokena (uproszczona wersja)
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Pobiera aktualnego użytkownika na podstawie tokena"""
    # Tu powinieneś zaimplementować właściwą weryfikację JWT
    # Na razie zwracamy None - należy to dostosować do swoich potrzeb
    return None


# ==================== ENDPOINTS GŁÓWNE ====================

@app.get("/")
async def root():
    """Endpoint główny"""
    return {"message": "User & Location Management API"}


@app.get("/health")
async def health_check():
    """Sprawdzenie stanu aplikacji"""
    return {"status": "healthy"}


# ==================== ENDPOINTS UŻYTKOWNIKÓW ====================

@app.post("/users/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(user: UserCreate):
    """Tworzy nowego użytkownika"""
    # Sprawdź czy użytkownik już istnieje
    existing_user = await users_collection.find_one({"login": user.login})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Użytkownik z tym loginem już istnieje"
        )

    # Haszuj hasło
    hashed_password = hash_password(user.password)

    # Przygotuj dane do zapisu
    user_data = {
        "login": user.login,
        "password": hashed_password,
        "type": user.user_type,
        "created_at": datetime.utcnow()
    }

    # Zapisz do bazy
    result = await users_collection.insert_one(user_data)

    # Pobierz zapisanego użytkownika
    created_user = await users_collection.find_one({"_id": result.inserted_id})

    return UserResponse(**user_helper(created_user))


@app.get("/users/", response_model=List[UserResponse])
async def get_users():
    """Pobiera listę wszystkich użytkowników"""
    users = []
    async for user in users_collection.find():
        users.append(UserResponse(**user_helper(user)))
    return users


@app.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str):
    """Pobiera użytkownika po ID"""
    if not validate_object_id(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nieprawidłowy format ID"
        )

    user = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Użytkownik nie został znaleziony"
        )

    return UserResponse(**user_helper(user))


@app.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user_update: UserUpdate):
    """Aktualizuje użytkownika"""
    if not validate_object_id(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nieprawidłowy format ID"
        )

    # Przygotuj dane do aktualizacji
    update_data = {}
    if user_update.login is not None:
        # Sprawdź czy nowy login nie jest już zajęty
        existing_user = await users_collection.find_one({
            "login": user_update.login,
            "_id": {"$ne": ObjectId(user_id)}
        })
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Login już zajęty"
            )
        update_data["login"] = user_update.login

    if user_update.password is not None:
        update_data["password"] = hash_password(user_update.password)

    if user_update.user_type is not None:
        update_data["type"] = user_update.user_type

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Brak danych do aktualizacji"
        )

    # Aktualizuj użytkownika
    result = await users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Użytkownik nie został znaleziony"
        )

    # Pobierz zaktualizowanego użytkownika
    updated_user = await users_collection.find_one({"_id": ObjectId(user_id)})
    return UserResponse(**user_helper(updated_user))


@app.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str):
    """Usuwa użytkownika"""
    if not validate_object_id(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nieprawidłowy format ID"
        )

    result = await users_collection.delete_one({"_id": ObjectId(user_id)})

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Użytkownik nie został znaleziony"
        )


# ==================== ENDPOINTS AUTORYZACJI ====================

@app.post("/login/", response_model=LoginResponse)
async def login(login_data: LoginRequest):
    """Loguje użytkownika"""
    user = await users_collection.find_one({"login": login_data.login})
    if not user or not verify_password(login_data.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy login lub hasło"
        )

    # Tu powinieneś wygenerować JWT token
    # Na razie zwracamy podstawowe informacje o użytkowniku
    return LoginResponse(
        message="Zalogowano pomyślnie",
        user=UserResponse(**user_helper(user)),
        token="your_jwt_token_here"  # Zastąp prawdziwym tokenem JWT
    )


# ==================== ENDPOINTS LOKALIZACJI ====================

@app.post("/locations/", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
async def create_location(location: LocationCreate):
    """Tworzy nową lokalizację"""
    location_data = {
        "name": location.name,
        "address": location.address,
        "devices": [device.dict(by_alias=True) for device in location.devices],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

    result = await locations_collection.insert_one(location_data)
    created_location = await locations_collection.find_one({"_id": result.inserted_id})

    return LocationResponse(**location_helper(created_location))


@app.get("/locations/", response_model=List[LocationResponse])
async def get_locations():
    """Pobiera listę wszystkich lokalizacji"""
    locations = []
    async for location in locations_collection.find():
        locations.append(LocationResponse(**location_helper(location)))
    return locations


@app.get("/locations/{location_id}", response_model=LocationResponse)
async def get_location(location_id: str):
    """Pobiera lokalizację po ID"""
    if not validate_object_id(location_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nieprawidłowy format ID"
        )

    location = await locations_collection.find_one({"_id": ObjectId(location_id)})
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lokalizacja nie została znaleziona"
        )

    return LocationResponse(**location_helper(location))


@app.put("/locations/{location_id}", response_model=LocationResponse)
async def update_location(location_id: str, location_update: LocationUpdate):
    """Aktualizuje lokalizację"""
    if not validate_object_id(location_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nieprawidłowy format ID"
        )

    update_data = {"updated_at": datetime.utcnow()}

    if location_update.name is not None:
        update_data["name"] = location_update.name

    if location_update.address is not None:
        update_data["address"] = location_update.address

    if location_update.devices is not None:
        update_data["devices"] = [device.dict(by_alias=True) for device in location_update.devices]

    result = await locations_collection.update_one(
        {"_id": ObjectId(location_id)},
        {"$set": update_data}
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lokalizacja nie została znaleziona"
        )

    updated_location = await locations_collection.find_one({"_id": ObjectId(location_id)})
    return LocationResponse(**location_helper(updated_location))


@app.delete("/locations/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(location_id: str):
    """Usuwa lokalizację"""
    if not validate_object_id(location_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nieprawidłowy format ID"
        )

    result = await locations_collection.delete_one({"_id": ObjectId(location_id)})

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lokalizacja nie została znaleziona"
        )


# ==================== ENDPOINTS URZĄDZEŃ ====================

@app.post("/locations/{location_id}/devices", response_model=LocationResponse)
async def add_device_to_location(location_id: str, device: Device):
    """Dodaje urządzenie do lokalizacji"""
    if not validate_object_id(location_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nieprawidłowy format ID"
        )

    location = await locations_collection.find_one({"_id": ObjectId(location_id)})
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lokalizacja nie została znaleziona"
        )

    # Sprawdź czy urządzenie o takim client_id już istnieje
    existing_devices = location.get("devices", [])
    for existing_device in existing_devices:
        if existing_device.get("clientId") == device.client_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Urządzenie o takim clientId już istnieje w tej lokalizacji"
            )

    # Dodaj nowe urządzenie
    new_device = device.dict(by_alias=True)

    result = await locations_collection.update_one(
        {"_id": ObjectId(location_id)},
        {
            "$push": {"devices": new_device},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )

    updated_location = await locations_collection.find_one({"_id": ObjectId(location_id)})
    return LocationResponse(**location_helper(updated_location))


@app.put("/locations/{location_id}/devices/{client_id}", response_model=LocationResponse)
async def update_device_in_location(location_id: str, client_id: str, device_update: DeviceUpdate):
    """Aktualizuje urządzenie w lokalizacji"""
    if device_update.ip is not None:
        device["ip"] = device_update.ip
    if not validate_object_id(location_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nieprawidłowy format ID"
        )

    location = await locations_collection.find_one({"_id": ObjectId(location_id)})
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lokalizacja nie została znaleziona"
        )

    # Znajdź i zaktualizuj urządzenie
    devices = location.get("devices", [])
    device_found = False

    for i, device in enumerate(devices):
        if device.get("clientId") == client_id:
            device_found = True
            # Aktualizuj tylko te pola, które zostały podane
            if device_update.client_id is not None:
                device["clientId"] = device_update.client_id
            if device_update.client_name is not None:
                device["clientName"] = device_update.client_name
            if device_update.photo is not None:
                device["photo"] = device_update.photo
            if device_update.video is not None:
                device["video"] = device_update.video
            break

    if not device_found:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Urządzenie nie zostało znalezione"
        )

    # Zapisz zmiany
    await locations_collection.update_one(
        {"_id": ObjectId(location_id)},
        {
            "$set": {
                "devices": devices,
                "updated_at": datetime.utcnow()
            }
        }
    )

    updated_location = await locations_collection.find_one({"_id": ObjectId(location_id)})
    return LocationResponse(**location_helper(updated_location))


@app.delete("/locations/{location_id}/devices/{client_id}", response_model=LocationResponse)
async def remove_device_from_location(location_id: str, client_id: str):
    """Usuwa urządzenie z lokalizacji"""
    if not validate_object_id(location_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nieprawidłowy format ID"
        )

    result = await locations_collection.update_one(
        {"_id": ObjectId(location_id)},
        {
            "$pull": {"devices": {"clientId": client_id}},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lokalizacja nie została znaleziona"
        )

    updated_location = await locations_collection.find_one({"_id": ObjectId(location_id)})
    if not updated_location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lokalizacja nie została znaleziona"
        )

    return LocationResponse(**location_helper(updated_location))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
