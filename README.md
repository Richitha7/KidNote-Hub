Children Notes App - FINAL (NoSQL + Polished Frontend)
=====================================================

What's included:
- backend/: FastAPI app (MongoDB via pymongo). JWT auth, CORS, full notes and folders CRUD.
- frontend/: React app (create-react-app structure). Polished UI with responsive layout and nice styling.
- frontend/public/assets/screenshot.png: demo screenshot image included.
- INTERVIEW_NOTES.md: step-by-step demo script and talking points.

Quick start:
1. Start MongoDB (Docker recommended):
   docker run -p 27017:27017 -d --name mongodb mongo:6
2. Backend:
   cd backend
   python -m venv venv
   source venv/bin/activate   (Windows: venv\Scripts\activate)
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
3. Frontend:
   cd frontend
   npm install
   npm start
4. Open http://localhost:3000 to use the app.

Notes:
- Signup: create a parent first, then create a child and set parent_username to parent's username.
- Login returns a Bearer token used automatically by the frontend.
