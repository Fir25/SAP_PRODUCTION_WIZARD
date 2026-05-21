"""
config/settings.py
==================
Configuration management for BMT IIoT middleware.
Uses pydantic_settings for environment variable management.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # SAP B1 Service Layer
    SAP_HOST: str = "192.168.1.248"
    SAP_PORT: int = 50000
    SAP_COMPANY: str = "TEST_BMT"
    SAP_USER: str = "manager"
    SAP_PASSWORD: str = "S@PB1Admin"

    # Application
    APP_ENV: str = "production"
    LOG_LEVEL: str = "INFO"

    # Retry
    RETRY_MAX: int = 5
    RETRY_DELAY_SECONDS: int = 3

    # Anti-duplicate Configuration
    DUPLICATE_WINDOW_SECONDS: int = 30

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()