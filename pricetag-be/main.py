from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings
from api import users, locations
from api import groups
from api import schedules
from api import priceusers

import logging

# Wyłącz debugowanie pymongo i innych bibliotek
logging.getLogger("pymongo").setLevel(logging.WARNING)
logging.getLogger("motor").setLevel(logging.WARNING)
logging.getLogger("asyncio").setLevel(logging.WARNING)
logging.getLogger("uvicorn.access").setLevel(logging.INFO)


app = FastAPI(
    title="Location Management API",
    description="API for managing users and locations with devices",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http?://.*",  # lub lepiej: konkretny whitelist domen
    allow_credentials=True,             # bo używasz cookies
    allow_methods=["*"],
    allow_headers=["*"],                # lub ["Authorization","Content-Type",...]
)

# Database connection
@app.on_event("startup")
async def startup_db_client():
    try:
        app.mongodb_client = AsyncIOMotorClient(settings.MONGODB_URI)
        app.mongodb = app.mongodb_client[settings.DATABASE_NAME]
        # Test connection
        await app.mongodb_client.admin.command('ping')
        print(f"✅ Connected to MongoDB at {settings.MONGODB_URI}")
        print(f"📁 Using database: {settings.DATABASE_NAME}")
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        print(f"🔧 Check your MONGODB_URI in .env: {settings.MONGODB_URI}")
        raise e

@app.on_event("shutdown")
async def shutdown_db_client():
    app.mongodb_client.close()

# Include routers
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(locations.router, prefix="/api/locations", tags=["locations"])
app.include_router(groups.router, prefix="/api", tags=["groups"])
app.include_router(schedules.router, prefix="/api")
app.include_router(priceusers.router, prefix="/api/priceusers", tags=["priceusers"])

@app.get("/")
async def root():
    return {"message": "Location Management API is running"}

@app.get("/health")
async def health_check():
    try:
        # Test database connection
        await app.mongodb_client.admin.command('ping')
        return {
            "status": "healthy",
            "database": "connected",
            "mongodb_uri": settings.MONGODB_URI.split('@')[-1] if '@' in settings.MONGODB_URI else settings.MONGODB_URI
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e)
        }



@app.on_event("startup")
async def print_routes():
    print("\n--- Registered Routes ---")
    for route in app.routes:
        print(f"Route: {route.path}")

        # ############

from fastapi.responses import JSONResponse
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings
from api import users, locations
from bson import json_util
import json


@app.get("/dump", tags=["debug"])
async def dump_database(request: Request):
    """
    Returns the entire database content as JSON.
    ⚠️ Use only for debugging! Disable in production!
    """
    db = request.app.mongodb
    dump = {}
    try:
        collections = await db.list_collection_names()
        for collection_name in collections:
            collection = db[collection_name]
            documents = []
            async for doc in collection.find():
                documents.append(doc)
            dump[collection_name] = documents

        # Use bson.json_util to handle ObjectId and datetime serialization
        return JSONResponse(content=json.loads(json_util.dumps(dump)))

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error dumping database: {str(e)}"
        )


        # ############


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)