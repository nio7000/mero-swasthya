import os

SECRET_KEY                  = os.getenv("SECRET_KEY", "supersecretkey")
ALGORITHM                   = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("TOKEN_EXPIRE_MINUTES", "120"))
DATABASE_URL                = os.getenv("DATABASE_URL", "postgresql://nikesholi@localhost:5432/MeroSwasthya")
