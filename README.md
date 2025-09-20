KidNote-Hub : Role-Based Notes App for Children & Parents
=====================================================

KidNotes is a full-stack **note-taking web application** designed for children and parents.  
It emphasizes **role-based access**, organization, and a fun, user-friendly interface.  

- **Children**: Create, edit, and organize notes into folders (with tags & checklists).  
- **Parents**: Log in to view children’s notes (read-only).  

---

## 📂 Project Structure
backend/ # FastAPI backend (JWT auth, MongoDB integration, CORS, CRUD APIs)
frontend/ # React frontend (responsive UI, polished styling, role-based access)


---

##  Features
- Authentication with **JWT**  
- Role-based access (Parent = view-only, Child = full CRUD)  
- Organize notes into folders  
- Tag notes for easy categorization  
- ☑Checkbox-style notes (to-do lists)  
- Modern, responsive, kid-friendly UI  

---

## ⚙️ Quick Start

### 1️ Start MongoDB
Since we’re using **MongoDB Compass**, just make sure your MongoDB service is running locally.  

Default connection string (already in backend):
mongodb://localhost:27017


---

### 2️ Backend Setup (FastAPI)
```bash
cd backend
python -m venv venv
# Activate venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000

Runs at 👉 http://localhost:8000
```

### 3 Frontend Setup (React)
```bash
cd frontend
npm install
npm start
```


