import os

from dotenv import load_dotenv


load_dotenv()


class Settings:
    RESEND_API_KEY = (os.getenv("RESEND_API_KEY") or "").strip()
    FROM_EMAIL = (os.getenv("FROM_EMAIL") or "").strip()
    FRONTEND_URL = (os.getenv("FRONTEND_URL") or "").strip()


settings = Settings()
