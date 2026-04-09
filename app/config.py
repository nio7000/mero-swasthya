import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

SECRET_KEY                  = os.getenv("SECRET_KEY", "supersecretkey")
ALGORITHM                   = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("TOKEN_EXPIRE_MINUTES", "120"))
DATABASE_URL                = os.getenv("DATABASE_URL", "postgresql://nikesholi@localhost:5432/MeroSwasthya")
SMTP_EMAIL                  = os.getenv("SMTP_EMAIL", "")
SMTP_PASSWORD               = os.getenv("SMTP_PASSWORD", "")
