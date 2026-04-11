# Sets up the SQLAlchemy engine and session factory.
# Everything that needs a DB connection imports from here.

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import DATABASE_URL

# The engine is the actual connection to PostgreSQL
engine = create_engine(DATABASE_URL)

# SessionLocal is used to create individual DB sessions per request
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class that all models inherit from
Base = declarative_base()
