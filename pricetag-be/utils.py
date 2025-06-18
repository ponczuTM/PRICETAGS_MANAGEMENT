import bcrypt
from bson import ObjectId
from datetime import datetime

def hash_password(password: str) -> str:
    """Haszuje hasło używając bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed_password: str) -> bool:
    """Weryfikuje hasło"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))

def user_helper(user) -> dict:
    """Konwertuje dokument użytkownika z MongoDB na słownik"""
    return {
        "id": str(user["_id"]),
        "login": user["login"],
        "type": user["type"],
        "created_at": user["created_at"]
    }

def location_helper(location) -> dict:
    """Konwertuje dokument lokalizacji z MongoDB na słownik"""
    return {
        "id": str(location["_id"]),
        "name": location["name"],
        "address": location["address"],
        "devices": location.get("devices", []),
        "created_at": location["created_at"],
        "updated_at": location["updated_at"]
    }

def validate_object_id(id_string: str) -> bool:
    """Sprawdza czy string jest poprawnym ObjectId"""
    return ObjectId.is_valid(id_string)