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

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
