from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Postgres
    DATABASE_URL: str = "postgresql+psycopg2://cip:cip_dev_password@localhost:5432/cip"

    # Neo4j
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "cip_dev_password"

    # Auth
    JWT_SECRET_KEY: str = "change_this_in_every_environment"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    SESSION_INACTIVITY_EXPIRE_MINUTES: int = 15
    SESSION_ABSOLUTE_EXPIRE_HOURS: int = 12
    STEP_UP_EXPIRE_MINUTES: int = 5

    # Priority entity computation (Phase 6 component 2): relationship-degree
    # threshold (mirror rows at verified/probable band) for an entity to
    # qualify as "priority". Value inferred — the brief never defines
    # "high-priority" (docs/decisions/007).
    PRIORITY_DEGREE_THRESHOLD: int = 3

    # App
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: str = "http://localhost:3000"

    # Attachments (006 §1 / 999 §2.12): case-scoped file uploads, local-disk
    # storage — no S3/MinIO service. Files live under ATTACHMENT_STORAGE_PATH,
    # addressed by the attachment's own id (see app.models.entities.Attachment).
    ATTACHMENT_STORAGE_PATH: str = "/app/data/attachments"
    ATTACHMENT_MAX_SIZE_BYTES: int = 26_214_400  # 25 MiB
    ATTACHMENT_ALLOWED_CONTENT_TYPES: str = (
        "application/pdf,image/jpeg,image/png,image/gif,image/webp,"
        "text/plain,application/msword,"
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document,"
        "application/vnd.ms-excel,"
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def attachment_allowed_content_types_list(self) -> list[str]:
        return [t.strip() for t in self.ATTACHMENT_ALLOWED_CONTENT_TYPES.split(",") if t.strip()]


settings = Settings()
