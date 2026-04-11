# Handles password hashing and JWT token creation.
# Kept separate so any controller can import these without circular deps.

from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext
from app.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

# bcrypt is the hashing algorithm — industry standard, slow on purpose to resist brute force
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str):
    # Never store plain text passwords — always hash before saving to DB
    return pwd_context.hash(password)


def verify_password(plain_password, hashed_password):
    # Compares a plain text password against the stored hash during login
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: timedelta = None):
    # Clone the payload so we don't mutate the original dict
    to_encode = data.copy()

    # Set expiry — falls back to the default from config if not provided
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})

    # Sign and return the JWT
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
