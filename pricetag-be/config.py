from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    MONGODB_URI: str = Field(..., env="MONGODB_URI")
    DATABASE_NAME: str = Field(default="location_management", env="DATABASE_NAME")
    SECRET_KEY: str = Field(default="your-secret-key-here", env="SECRET_KEY")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()