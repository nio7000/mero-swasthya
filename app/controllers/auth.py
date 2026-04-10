from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models import User, Role
from app.auth import verify_password, hash_password, create_access_token
from app.utils.email_utils import (
    generate_otp, verify_otp,
    generate_temp_password,
    send_otp_email, send_temp_password_email,
)

router = APIRouter(tags=["Auth"])

TEMP_PASSWORD = "MeroSwasthya@123"


# ── LOGIN ────────────────────────────────────────────────────────────────────
@router.post("/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(401, "Invalid credentials")

    token = create_access_token({"sub": user.email, "role": user.role, "id": user.id})
    return {
        "access_token":       token,
        "token_type":         "bearer",
        "email":              user.email,
        "role":               user.role,
        "full_name":          user.full_name,
        "id":                 user.id,
        "must_change_password": bool(user.must_change_password),
    }


# ── SELF-REGISTRATION: STEP 1 — send OTP ─────────────────────────────────────
@router.post("/auth/register/send-otp")
def register_send_otp(data: dict = Body(...), db: Session = Depends(get_db)):
    """
    Expects: { full_name, email, role, specialization? }
    Validates the data, then sends a 6-digit OTP to the email.
    Does NOT create the user yet.
    """
    required = ["full_name", "email", "role"]
    if not all(k in data for k in required):
        raise HTTPException(400, "Missing required fields: full_name, email, role")

    email = data["email"].strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(400, "An account with this email already exists")

    role_row = db.query(Role).filter(Role.role == data["role"]).first()
    if not role_row:
        raise HTTPException(400, f"Unknown role: {data['role']}")

    otp = generate_otp(email)
    try:
        send_otp_email(email, otp, data["full_name"])
    except Exception as e:
        raise HTTPException(500, f"Failed to send email: {str(e)}")

    return {"message": "Verification code sent to your email"}


# ── SELF-REGISTRATION: STEP 2 — verify OTP & create account ──────────────────
@router.post("/auth/register/verify-otp")
def register_verify_otp(data: dict = Body(...), db: Session = Depends(get_db)):
    """
    Expects: { full_name, email, role, specialization?, otp }
    Verifies OTP, creates user with temp password, marks must_change_password=True.
    Returns a JWT so the frontend can immediately redirect to change-password screen.
    """
    required = ["full_name", "email", "role", "otp"]
    if not all(k in data for k in required):
        raise HTTPException(400, "Missing required fields")

    email = data["email"].strip().lower()

    if not verify_otp(email, data["otp"]):
        raise HTTPException(400, "Invalid or expired verification code")

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(400, "An account with this email already exists")

    role_row = db.query(Role).filter(Role.role == data["role"]).first()
    if not role_row:
        raise HTTPException(400, f"Unknown role: {data['role']}")

    user = User(
        full_name=data["full_name"],
        email=email,
        password=hash_password(TEMP_PASSWORD),
        role_id=role_row.role_id,
        specialization=data.get("specialization", ""),
        must_change_password=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.email, "role": user.role, "id": user.id})
    return {
        "access_token":       token,
        "token_type":         "bearer",
        "email":              user.email,
        "role":               user.role,
        "full_name":          user.full_name,
        "id":                 user.id,
        "must_change_password": True,
    }


# ── CHANGE PASSWORD (first login / forced) ────────────────────────────────────
@router.post("/auth/change-password")
def change_password(
    data: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Expects: { new_password }
    Sets the new password and clears must_change_password flag.
    """
    new_pw = data.get("new_password", "").strip()
    if len(new_pw) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

    current_user.password = hash_password(new_pw)
    current_user.must_change_password = False
    db.commit()
    return {"message": "Password updated successfully"}


# ── FORGOT PASSWORD ───────────────────────────────────────────────────────────
@router.post("/auth/forgot-password")
def forgot_password(data: dict = Body(...), db: Session = Depends(get_db)):
    """
    Expects: { email }
    Sends a 6-digit OTP to the user's email. They then verify via /auth/setup-account
    and are redirected to /change-password to set a new password.
    Always returns 200 to avoid email enumeration.
    """
    email = (data.get("email") or "").strip().lower()
    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(status_code=404, detail="No account found with that email address.")

    user.must_change_password = True
    db.commit()
    try:
        otp = generate_otp(user.email)
        send_otp_email(user.email, user.full_name, otp)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to send OTP. Please try again.")

    return {"message": "If that email is registered, a temporary password has been sent"}


# ── SETUP ACCOUNT (admin-created users) ──────────────────────────────────────
@router.post("/auth/setup-account")
def setup_account(data: dict = Body(...), db: Session = Depends(get_db)):
    """
    Expects: { email, otp }
    Admin-created users use this to verify their OTP and get a token,
    then they are redirected to /change-password to set their own password.
    """
    email = (data.get("email") or "").strip().lower()
    otp   = (data.get("otp") or "").strip()

    if not email or not otp:
        raise HTTPException(400, "Email and OTP are required")

    if not verify_otp(email, otp):
        raise HTTPException(400, "Invalid or expired verification code")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(404, "Account not found")

    token = create_access_token({"sub": user.email, "role": user.role, "id": user.id})
    return {
        "access_token":        token,
        "token_type":          "bearer",
        "email":               user.email,
        "role":                user.role,
        "full_name":           user.full_name,
        "id":                  user.id,
        "must_change_password": True,
    }


# ── ADMIN: CREATE USER ────────────────────────────────────────────────────────
@router.post("/admin/create-user/")
def create_user(data: dict = Body(...), db: Session = Depends(get_db)):
    required = ["full_name", "email", "role"]
    if not all(k in data for k in required):
        raise HTTPException(400, "Missing required fields")
    if db.query(User).filter(User.email == data["email"]).first():
        raise HTTPException(400, "Email already exists")

    role_row = db.query(Role).filter(Role.role == data["role"]).first()
    if not role_row:
        raise HTTPException(400, f"Unknown role: {data['role']}")

    # Admin-created users get the system temp password and must change on first login
    u = User(
        full_name=data["full_name"],
        email=data["email"],
        password=hash_password(data.get("password", TEMP_PASSWORD)),
        role_id=role_row.role_id,
        specialization=data.get("specialization", ""),
        must_change_password=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)

    # Send OTP so the user can verify and set their own password
    if not data.get("password"):
        try:
            otp = generate_otp(u.email)
            send_otp_email(u.email, otp, u.full_name)
        except Exception:
            pass

    return {"message": f"{u.role.capitalize()} {u.full_name} created"}


# ── ADMIN: LIST USERS ─────────────────────────────────────────────────────────
@router.get("/admin/users/")
def get_all_users(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(403, "Access denied")
    users = db.query(User).all()
    return [
        {
            "id":             u.id,
            "full_name":      u.full_name,
            "email":          u.email,
            "role":           u.role,
            "specialization": u.specialization or "",
        }
        for u in users
    ]


# ── ADMIN: DELETE USER ────────────────────────────────────────────────────────
@router.delete("/admin/delete-user/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(403, "Access denied")
    u = db.query(User).filter(User.user_id == user_id).first()
    if not u:
        raise HTTPException(404, "User not found")
    if u.role == "admin":
        raise HTTPException(400, "Admin accounts cannot be removed")
    if u.id == user.id:
        raise HTTPException(400, "You cannot delete your own account")
    db.delete(u)
    db.commit()
    return {"message": "User removed successfully"}
