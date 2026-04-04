import os

print("🚀 Starting FastAPI server...")
os.system("uvicorn app.main:app --reload --host 127.0.0.1 --port 8000")
