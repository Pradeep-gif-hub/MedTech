import os

from dotenv import load_dotenv


load_dotenv()


class Settings:
    SMTP_SERVER = (os.getenv("SMTP_SERVER") or os.getenv("SMTP_HOST") or "smtp-relay.brevo.com").strip()
    SMTP_HOST = SMTP_SERVER  # backward-compat alias
    SMTP_PORT = (os.getenv("SMTP_PORT") or "587").strip()
    SMTP_USER = (os.getenv("SMTP_USER") or "").strip()
    SMTP_PASS = (os.getenv("SMTP_PASS") or "").strip()
    FROM_EMAIL = (os.getenv("FROM_EMAIL") or os.getenv("SMTP_USER") or "").strip()
    FROM_NAME = (os.getenv("FROM_NAME") or "MedTech").strip()
    FRONTEND_URL = (os.getenv("FRONTEND_URL") or "").strip()


settings = Settings()
