# Harvee Designs — Full Stack Developer Assessment

**Candidate:** Lokesh Kumar Agarwal
**Stack:** React.js + Node.js/Express + PostgreSQL + Gemini AI (Google AI Studio)

This repository contains both required tasks:
- **Task 1:** AI-Powered Student Course Allocation System
- **Task 2:** AI SQL Assistant (Natural Language to SQL over uploaded datasets)

## Live Deployment

- **Frontend (App):** https://harvee-fullstack-assessment.vercel.app/
- **Backend (API):** https://harvee-fullstack-assessment.onrender.com
- **Health Check:** https://harvee-fullstack-assessment.onrender.com/health

**Note:** the backend runs on Render's free tier, which sleeps after ~15 minutes
of inactivity. The first request after idle time can take 30–50 seconds while
it wakes up — this is expected free-tier behavior, not an application bug.

---

## 1. Prerequisites

- Node.js v18+ and npm
- PostgreSQL v14+ running locally (or a cloud instance)
- A Gemini API key (for the AI features, free tier) — get one at https://aistudio.google.com

---

## 2. Database Setup

1. Create a database:
   ```bash
   createdb harvee_assessment
   ```
2. Run the schema file to create all tables:
   ```bash
   psql -U postgres -d harvee_assessment -f database/schema.sql
   ```

See `docs/DATABASE_SCHEMA_DOCUMENT.md` for the full table-by-table design.

---

## 3. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` and fill in your actual values:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=harvee_assessment
DB_USER=postgres
DB_PASSWORD=your_actual_password
GEMINI_API_KEY=your_actual_gemini_api_key
GEMINI_MODEL=gemini-flash-latest
```

Start the backend:
```bash
npm run dev      # with auto-reload (nodemon)
# OR
npm start        # plain node
```

Backend runs at: `http://localhost:5000`
Health check: `GET http://localhost:5000/health`

### (Optional) Seed Sample Data for Task 1

To quickly populate sample courses and students for Task 1 demo:
```bash
npm run seed
```
Then trigger allocation via the API or frontend UI ("Run Allocation" button).

---

## 4. Frontend Setup

Open a **new terminal**:
```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: `http://localhost:5173` and proxies `/api` calls to the backend
at `http://localhost:5000` (configured in `vite.config.js`).

Open `http://localhost:5173` in your browser. You'll see 4 tabs:
1. **Task 1: Courses** — add courses with category-wise reserved seats
2. **Task 1: Students** — register students with marks, category, preferences
3. **Task 1: Allocation & AI** — run the allocation algorithm, view dashboard, ask the AI assistant questions
4. **Task 2: AI SQL Assistant** — upload a CSV/Excel file and chat with your data

---

## 5. Trying Task 2 with the Sample Dataset

A ready-made sample dataset is provided at `database/sample_datasets/sample_sales.csv`.
Upload it via the Task 2 tab, then try questions like:
- "Show top 5 customers by revenue"
- "Which month generated the highest sales?"
- "Find duplicate records"
- "Show records with missing values"

---

## 6. Project Structure

```
harvee-assessment/
├── backend/
│   ├── src/
│   │   ├── config/          # DB pool + Gemini AI client setup
│   │   ├── controllers/     # Request handlers
│   │   ├── services/        # Business logic (allocation algorithm, AI-to-SQL, ingestion)
│   │   ├── routes/          # Express route definitions
│   │   ├── middleware/      # Upload handling, centralized error handler
│   │   ├── utils/           # Seed script
│   │   └── server.js        # App entry point
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/           # CourseManagement, StudentRegistration, AllocationDashboard, DatasetAssistant
│   │   ├── services/api.js  # Fetch wrapper for all backend endpoints
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
├── database/
│   ├── schema.sql           # Full normalized schema (Task 1 + Task 2)
│   └── sample_datasets/sample_sales.csv
├── docs/
│   ├── API_DOCUMENTATION.md
│   ├── ARCHITECTURE.md              # Design decisions, assumptions, security notes, challenges
│   └── DATABASE_SCHEMA_DOCUMENT.md  # Table-by-table schema reference
└── README.md                         (this file)
```

---

## 7. Documents Deviation Note

The original assessment task document did not include a contact email for
clarification questions (as it instructed to reach out to). Since no contact
channel was available, a set of reasonable assumptions were made where the
requirements were ambiguous — these are explicitly documented in
`docs/ARCHITECTURE.md` under "Assumptions Made".
