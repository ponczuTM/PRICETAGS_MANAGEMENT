# api/priceusers.py
from fastapi import APIRouter, HTTPException, status, Request, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from bson import ObjectId
from typing import Optional, List, Dict, Any
import pyotp
import qrcode
import io
import base64

from passlib.context import CryptContext

# ===== Router =====
router = APIRouter()
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ===== Helpers =====
def get_db(request: Request):
    return request.app.mongodb

def hash_pwd(p: str) -> str:
    return pwd_ctx.hash(p)

def verify_pwd(plain: str, hashed: str) -> bool:
    try:
        return pwd_ctx.verify(plain, hashed)
    except Exception:
        return False

def to_str_id(doc: dict) -> dict:
    d = dict(doc)
    if isinstance(d.get("_id"), ObjectId):
        d["_id"] = str(d["_id"])
    return d

def sanitize_priceuser(doc: dict) -> dict:
    d = dict(doc)
    d.pop("passwordHash", None)
    d.pop("totp_secret", None)
    if isinstance(d.get("_id"), ObjectId):
        d["_id"] = str(d["_id"])
    # ujednolicenie: locationIds zawsze lista stringów
    if "locationIds" not in d or d["locationIds"] is None:
        d["locationIds"] = []
    else:
        d["locationIds"] = [str(x) for x in d["locationIds"]]
    return d

# ===== Modele żądań/odpowiedzi (lokalne do routera) =====
class PriceUserRegisterInput(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    locationName: str
    # rejestracja bez przypisywania lokalizacji – admin zrobi to później
    locationIds: Optional[List[str]] = None  # dozwolone, ale nie wymagane

class PriceUserLoginWithOtp(BaseModel):
    email: EmailStr
    password: str
    otp: Optional[str] = None

class PriceUserUpdateInput(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    locationName: Optional[str] = None
    locationIds: Optional[List[str]] = None

class TotpSetupInput(BaseModel):
    email: EmailStr
    password: str

class TotpDisableInput(BaseModel):
    email: EmailStr
    password: str

# ===== Rejestracja (POST /api/priceusers) =====
# Uwaga: Twój front woła POST na /api/priceusers (bez /register), więc dodajemy dwa aliasy:
@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
async def register_priceuser(body: PriceUserRegisterInput, db=Depends(get_db)):
    # Unikalny email
    exists = await db["priceusers"].find_one({"email": body.email})
    if exists:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    doc = {
        "first_name": body.first_name.strip(),
        "last_name": body.last_name.strip(),
        "email": body.email.strip().lower(),
        "locationName": body.locationName.strip(),
        "locationIds": body.locationIds if body.locationIds else [],
        "passwordHash": hash_pwd(body.password),
        # 2FA:
        "totp_enabled": False,
        "totp_secret": None,
    }
    result = await db["priceusers"].insert_one(doc)
    created = await db["priceusers"].find_one({"_id": result.inserted_id})
    return sanitize_priceuser(created)

# ===== Lista użytkowników (GET /api/priceusers) – pomocniczo =====
@router.get("", status_code=200)
@router.get("/", status_code=200)
async def list_priceusers(db=Depends(get_db)):
    out = []
    async for u in db["priceusers"].find({}):
        out.append(sanitize_priceuser(u))
    return out

# ===== Pobranie jednego (GET /api/priceusers/{id}) – pomocniczo =====
@router.get("/{priceuser_id}", status_code=200)
async def get_priceuser(priceuser_id: str, db=Depends(get_db)):
    if not ObjectId.is_valid(priceuser_id):
        raise HTTPException(status_code=400, detail="Invalid id")
    u = await db["priceusers"].find_one({"_id": ObjectId(priceuser_id)})
    if not u:
        raise HTTPException(status_code=404, detail="Not found")
    return sanitize_priceuser(u)

# ===== Update (PUT /api/priceusers/{id}) – opcjonalnie =====
@router.put("/{priceuser_id}", status_code=200)
async def update_priceuser(priceuser_id: str, body: PriceUserUpdateInput, db=Depends(get_db)):
    if not ObjectId.is_valid(priceuser_id):
        raise HTTPException(status_code=400, detail="Invalid id")

    updates: Dict[str, Any] = {}
    if body.first_name is not None: updates["first_name"] = body.first_name.strip()
    if body.last_name is not None:  updates["last_name"]  = body.last_name.strip()
    if body.email is not None:      updates["email"]      = body.email.strip().lower()
    if body.locationName is not None: updates["locationName"] = body.locationName.strip()
    if body.locationIds is not None:  updates["locationIds"]  = [str(x) for x in body.locationIds]
    if body.password is not None:     updates["passwordHash"] = hash_pwd(body.password)

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Gdy zmieniamy email, sprawdź unikalność
    if "email" in updates:
        dup = await db["priceusers"].find_one({"email": updates["email"], "_id": {"$ne": ObjectId(priceuser_id)}})
        if dup:
            raise HTTPException(status_code=400, detail="Email already in use")

    res = await db["priceusers"].update_one({"_id": ObjectId(priceuser_id)}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    u = await db["priceusers"].find_one({"_id": ObjectId(priceuser_id)})
    return sanitize_priceuser(u)

# ===== Login (POST /api/priceusers/login) z obsługą TOTP =====
@router.post("/login", status_code=200)
async def login_priceuser(body: PriceUserLoginWithOtp, db=Depends(get_db)):
    user = await db["priceusers"].find_one({"email": body.email.strip().lower()})
    if not user or not verify_pwd(body.password, user.get("passwordHash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.get("totp_enabled"):
        # Jeśli TOTP włączony i brak OTP → poinformuj front, by poprosił o kod
        if not body.otp:
            return JSONResponse(status_code=401, content={"detail": "OTP_REQUIRED"})
        secret = user.get("totp_secret")
        if not secret:
            raise HTTPException(status_code=500, detail="TOTP misconfigured")
        totp = pyotp.TOTP(secret)
        # valid_window=1 => tolerancja +/- 30s
        if not totp.verify(body.otp.strip(), valid_window=1):
            raise HTTPException(status_code=401, detail="INVALID_OTP")

    # TODO: wygeneruj prawdziwy JWT; na razie placeholder
    token = "your_jwt_token_here"
    return {
        "message": "Logged in",
        "user": sanitize_priceuser(user),
        "token": token
    }

# ===== Włączenie TOTP (POST /api/priceusers/totp/setup) =====
@router.post("/totp/setup", status_code=200)
async def totp_setup(body: TotpSetupInput, db=Depends(get_db)):
    user = await db["priceusers"].find_one({"email": body.email.strip().lower()})
    if not user or not verify_pwd(body.password, user.get("passwordHash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.get("totp_enabled") and user.get("totp_secret"):
        raise HTTPException(status_code=400, detail="TOTP already enabled")

    secret = pyotp.random_base32()
    issuer = "EXON-PriceTag"
    account = user["email"]
    otpauth_uri = pyotp.totp.TOTP(secret).provisioning_uri(name=account, issuer_name=issuer)

    # Wygeneruj QR w base64 (data URL)
    img = qrcode.make(otpauth_uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    qr_data_url = f"data:image/png;base64,{qr_b64}"

    await db["priceusers"].update_one(
        {"_id": user["_id"]},
        {"$set": {"totp_secret": secret, "totp_enabled": True}}
    )

    return {
        "issuer": issuer,
        "account": account,
        "secret": secret,
        "otpauth_uri": otpauth_uri,
        "qr_data_url": qr_data_url
    }

# ===== Wyłączenie TOTP (POST /api/priceusers/totp/disable) =====
@router.post("/totp/disable", status_code=200)
async def totp_disable(body: TotpDisableInput, db=Depends(get_db)):
    user = await db["priceusers"].find_one({"email": body.email.strip().lower()})
    if not user or not verify_pwd(body.password, user.get("passwordHash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    await db["priceusers"].update_one(
        {"_id": user["_id"]},
        {"$set": {"totp_enabled": False}, "$unset": {"totp_secret": ""}}
    )
    return {"message": "TOTP disabled"}
