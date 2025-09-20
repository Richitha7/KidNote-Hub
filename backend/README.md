Backend - FastAPI + MongoDB (NoSQL)
----------------------------------
Run instructions:

1. Ensure MongoDB is running (docker or local):
   docker run -p 27017:27017 -d --name mongodb mongo:6

2. Create virtualenv & install:
   python -m venv venv
   source venv/bin/activate   (Windows: venv\Scripts\activate)
   pip install -r requirements.txt

3. Start backend:
   uvicorn main:app --reload --port 8000

API overview:
- POST /signup  (JSON) -> {username, password, role ('child'|'parent'), parent_username?}
- POST /login   (JSON) -> {username, password} -> returns {access_token, token_type}
- GET /health
- CRUD /folders, /notes (authorization via Bearer token)
