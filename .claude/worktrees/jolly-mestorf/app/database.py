from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 🔹 Replace with your own PostgreSQL credentials
DATABASE_URL = "postgresql://postgres:iamnikesholi4795@localhost/reports_ocr"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
