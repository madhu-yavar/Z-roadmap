# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Roadmap Agent is a local-first full-stack web application for managing product roadmaps with AI-powered document analysis. It features a role-based access control system (CEO, VP, BA, PM) and an intake-to-approval workflow for roadmap items.

**Tech Stack:**
- Backend: FastAPI + PostgreSQL (with pgvector) + SQLAlchemy 2.0 (async)
- Frontend: React 19 + TypeScript + Vite + React Router
- AI/ML: LangGraph 0.6.6 for agent workflows, multi-provider LLM support (Gemini, Claude, OpenAI-compatible, Ollama, Vertex AI)
- Document Processing: pypdf, python-docx, python-pptx, openpyxl

## Architecture

```
Frontend (React/Vite)  <--HTTP/REST + JWT-->  Backend (FastAPI)  <--SQLAlchemy-->  PostgreSQL
```

**Backend Layer Structure:**
- `app/main.py` - FastAPI app entry point, CORS config, health check
- `app/api/` - API routes (auth, users, projects, features, documents, intake, roadmap, settings, dashboard, chat)
- `app/services/` - Business logic (LLM client, intake agent, document parser, versioning)
- `app/models/` - SQLAlchemy ORM models
- `app/schemas/` - Pydantic schemas for request/response validation
- `app/core/` - Configuration, security, database dependencies

**Frontend Structure:**
- `src/main.tsx` - React entry point with BrowserRouter
- `src/App.tsx` - Main application component (3,233 lines, monolithic - consider refactoring)

## Development Commands

### Initial Setup

```bash
# 1. Start PostgreSQL
docker compose up -d postgres

# 2. Backend setup
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env

# 3. Seed initial users (default password: pass1234)
python -m app.scripts.seed

# 4. Frontend setup
cd frontend
npm install
echo "VITE_API_BASE=http://127.0.0.1:8000" > .env.local
```

### Running the Application

```bash
# Backend (from backend/ directory)
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Frontend (from frontend/ directory)
npm run dev
```

### Building and Linting

```bash
# Frontend build
cd frontend
npm run build      # TypeScript check + Vite production bundle
npm run lint       # ESLint
npm run preview    # Preview production build
```

### Database

```bash
# Start/stop PostgreSQL
docker compose up -d postgres
docker compose down
```

## Key Workflows

### Intake Pipeline (Core Feature)
1. Upload document (`POST /documents/upload`) → saved to `backend/storage/uploads/`
2. AI analysis (`POST /intake/analyze/{document_id}`) → classify + extract structured data
3. Human review (`PATCH /intake/items/{item_id}`) → correct/approve
4. Approve to roadmap → creates `RoadmapItem` with version history

### Authentication
- JWT tokens via `python-jose`
- Password hashing via `passlib`
- Role-based access: CEO, VP, BA, PM
- Default seeded users: `ceo@local.test`, `vp@local.test`, `ba@local.test`, `pm@local.test` (password: `pass1234`)

### Versioning System
- All changes to intake/roadmap items create version history
- Access via `/intake/items/{item_id}/history` and `/roadmap/items/{item_id}/history`
- Tracks: field changed, old value, new value, changed by, timestamp

### LLM Provider Configuration
- Multi-provider support via `app/services/llm_client.py`
- Providers: Gemini, Claude, OpenAI-compatible, Ollama, Vertex AI
- Configurable via Settings UI (`/settings/llm`)
- Uses Google Cloud Application Credentials when Vertex AI is enabled

## Important Notes

### File Storage
- Uploaded documents saved to `backend/storage/uploads/` (configurable via `FILE_STORAGE_PATH` in `.env`)
- File hash-based deduplication in `Document` model

### Database Schema
- Uses PostgreSQL with pgvector extension (via `pgvector/pgvector:pg16` Docker image)
- No migration system currently (uses inline ALTER statements)
- Default credentials: `roadmap`/`roadmap`@`localhost:5432`/`roadmap_agent`

### API Routes Summary
- `/auth` - Register, login, current user
- `/users` - User management (CEO/VP only)
- `/projects` - CRUD for projects (types: client, inhouse, rnd, pipeline)
- `/features` - CRUD for features within projects
- `/documents` - Upload, list documents
- `/intake` - Analyze documents, review/approve items, view history
- `/roadmap` - Approved roadmap items, version history
- `/settings` - LLM provider configuration
- `/dashboard` - Summary statistics
- `/chat` - LangGraph-based Q&A agent

### Testing
- No tests currently exist in the codebase
- Consider adding: pytest for backend, Vitest for frontend

### Frontend Notes
- `App.tsx` is a large monolithic component (3,233 lines)
- Contains all UI components, routing, and type definitions
- When making significant frontend changes, consider splitting into smaller components

## Environment Variables

Key variables from `.env.example`:
- `DATABASE_URL` - PostgreSQL connection string
- `FILE_STORAGE_PATH` - Upload storage location
- `CORS_ORIGINS` - Allowed frontend origins
- `GOOGLE_GENAI_USE_VERTEXAI` - Enable Vertex AI vs. Generative Language API
- `GOOGLE_CLOUD_PROJECT` - GCP project ID
- `GOOGLE_CLOUD_LOCATION` - GCP region
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to service account JSON
