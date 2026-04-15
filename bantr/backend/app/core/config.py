from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    MODE: Literal["development", "production", "testing"] = "development"
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "MyApp"

    SECRET_KEY: str = "INSECURE-change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_ISSUER: str = "myapp"
    JWT_AUDIENCE: str = "myapp:api"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ABSOLUTE_SESSION_EXPIRE_DAYS: int = 30

    DATABASE_USER: str = "postgres"
    DATABASE_PASSWORD: str = ""
    DATABASE_HOST: str = "localhost"
    DATABASE_PORT: int = 5432
    DATABASE_NAME: str = "app"
    ASYNC_DATABASE_URI: str = ""

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = ""

    BOOTSTRAP_ADMIN_EMAILS: str = ""
    LOGFIRE_TOKEN: str = ""
    LOGFIRE_ENVIRONMENT: str = "development"

    FRONTEND_URL: str = "http://localhost:5173"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    MAX_REQUEST_BODY_SIZE: int = 1_048_576
    AUTH_RATE_LIMIT: str = "5/minute"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def bootstrap_admin_emails_list(self) -> list[str]:
        return [e.strip() for e in self.BOOTSTRAP_ADMIN_EMAILS.split(",") if e.strip()]

    @model_validator(mode="after")
    def assemble_database_uri(self) -> "Settings":
        if not self.ASYNC_DATABASE_URI:
            self.ASYNC_DATABASE_URI = (
                f"postgresql+asyncpg://{self.DATABASE_USER}"
                f":{self.DATABASE_PASSWORD}"
                f"@{self.DATABASE_HOST}"
                f":{self.DATABASE_PORT}"
                f"/{self.DATABASE_NAME}"
            )
        return self

    @model_validator(mode="after")
    def set_google_redirect_uri(self) -> "Settings":
        if not self.GOOGLE_REDIRECT_URI and self.MODE == "development":
            self.GOOGLE_REDIRECT_URI = (
                "http://localhost:8000/api/v1/auth/google/callback"
            )
        return self

    @model_validator(mode="after")
    def validate_cors(self) -> "Settings":
        if "*" in self.allowed_origins_list:
            raise ValueError(
                "ALLOWED_ORIGINS must not contain '*' when allow_credentials is enabled"
            )
        return self

    @model_validator(mode="after")
    def production_guard(self) -> "Settings":
        if self.MODE != "production":
            return self
        errors: list[str] = []
        if self.SECRET_KEY == "INSECURE-change-me" or len(self.SECRET_KEY) < 32:
            errors.append("SECRET_KEY must be at least 32 characters and not the default value")
        if not self.DATABASE_PASSWORD:
            errors.append("DATABASE_PASSWORD must be set in production")
        if not self.GOOGLE_CLIENT_ID:
            errors.append("GOOGLE_CLIENT_ID must be set in production")
        if errors:
            raise ValueError("Production configuration errors: " + "; ".join(errors))
        return self


settings = Settings()
