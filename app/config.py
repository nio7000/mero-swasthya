# Loads all environment variables from the .env file next to this module.
# If a variable isn't set, sensible defaults are used so the app still runs locally.

import os
from dotenv import load_dotenv

# Load the .env file sitting inside the app/ folder
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# JWT settings — used for signing and verifying access tokens
SECRET_KEY                  = os.getenv("SECRET_KEY", "supersecretkey")
ALGORITHM                   = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("TOKEN_EXPIRE_MINUTES", "120"))  # 2 hours by default

# PostgreSQL connection string
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://nikesholi@localhost:5432/MeroSwasthya")

# SMTP credentials for sending password-reset / notification emails
SMTP_EMAIL    = os.getenv("SMTP_EMAIL", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
