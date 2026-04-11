# FastAPI dependency functions — injected into route handlers via Depends().
# These handle DB session lifecycle and auth/role checking in one place.

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import User
from app.config import SECRET_KEY, ALGORITHM

# FastAPI reads the Bearer token from the Authorization header automatically
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_db():
    # Opens a DB session for the duration of the request, then closes it.
    # Using yield means cleanup happens even if an exception is raised.
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    # Single exception used for all auth failures — don't leak whether
    # the token is invalid vs the user doesn't exist
    exc = HTTPException(status_code=401, detail="Invalid or expired token")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise exc
    except JWTError:
        raise exc

    # Look up the user in DB — token is valid but user might have been deleted
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise exc
    return user


def require_roles(*roles):
    # Returns a dependency that checks the logged-in user has one of the allowed roles.
    # Usage: dependencies=[Depends(require_roles("admin", "doctor"))]
    def checker(user: User = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(403, f"Access denied for role: {user.role}")
        return user
    return checker
