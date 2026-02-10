# Roadmap Agent (Local MVP)

Local-first scaffold for roadmap tracking with:
- 4 roles: `CEO`, `VP`, `BA`, `PM`
- FastAPI backend
- PostgreSQL database
- Local folder storage for uploads
- Dashboard summary API
- Intake agent pipeline:
  - upload BRD/PPT/RFP/Excel/etc
  - classify + extract (`title`, `scope`, `activities`, `source quotes`)
  - human review/correct
  - approve to roadmap line item
- Configurable AI provider settings (`Gemini`, `Claude`, `GLM`, `Qwen`, `Ollama`, `OpenAI-compatible`)

## 1) Start PostgreSQL

```bash
docker compose up -d postgres
```

## 2) Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env
```

## 3) Seed initial users

```bash
python -m app.scripts.seed
```

Default password for seeded users: `pass1234`

- `ceo@local.test`
- `vp@local.test`
- `ba@local.test`
- `pm@local.test`

## 4) Run API

```bash
uvicorn app.main:app --reload --port 8000
```

Health check:

```bash
curl http://localhost:8000/health
```

## 5) Main endpoints

- `POST /auth/register`
- `POST /auth/login`
- `GET /users` (CEO/VP only)
- `GET|POST|PATCH /projects`
- `GET|POST|PATCH /features`
- `POST /documents/upload` (multipart form)
- `GET /documents`
- `POST /intake/analyze/{document_id}`
- `GET /intake/items`
- `PATCH /intake/items/{item_id}` (review/approve)
- `GET /intake/items/{item_id}/history`
- `GET /roadmap/items`
- `PATCH /roadmap/items/{item_id}`
- `GET /roadmap/items/{item_id}/history`
- `GET /settings/llm`
- `POST /settings/llm/active`
- `GET /dashboard/summary`
- `POST /chat`

Use bearer token from `/auth/login`.

## 6) Local storage

Uploaded files are saved to:
- `backend/storage/uploads` (from repo root)
- `storage/uploads` (when running from `backend/`)

Configured by `FILE_STORAGE_PATH` in `.env`.

## 7) Frontend (React + Vite)

```bash
cd frontend
npm install
echo "VITE_API_BASE=http://127.0.0.1:8000" > .env.local
npm run dev
```

Open:

- `http://localhost:5173`

The frontend includes:
- role-based login presets (`CEO/VP/BA/PM`)
- `Dashboard` tab
- `Intake` tab (upload -> classify/extract -> review -> approve)
- `Roadmap` tab (approved line items)
- `Settings` tab (AI provider configuration)
- `Chat` tab
