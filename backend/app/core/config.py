from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "Roadmap Agent"
    APP_ENV: str = "local"
    SECRET_KEY: str = "change-me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    DATABASE_URL: str = "postgresql+psycopg2://roadmap:roadmap@localhost:5432/roadmap_agent"
    FILE_STORAGE_PATH: str = "storage/uploads"
    CORS_ORIGINS: str = (
        "http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173,http://[::1]:5173,http://localhost:8000"
    )
    GOOGLE_GENAI_USE_VERTEXAI: bool = False
    GOOGLE_CLOUD_PROJECT: str = ""
    GOOGLE_CLOUD_LOCATION: str = ""
    GOOGLE_APPLICATION_CREDENTIALS: str = ""


settings = Settings()
