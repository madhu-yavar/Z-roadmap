# Z- Roadmap Deployment Guide

This runbook covers:
- VM deployment (`systemd` + `nginx` + local Postgres)
- Docker Compose deployment (`docker-compose.prod.yml`)

## 1. VM Deployment (systemd + nginx)

### 1.1 Prerequisites
- Ubuntu 22.04+ VM
- Open ports: `22`, `80`, `443`
- Domain DNS pointed to VM (recommended)

```bash
sudo apt update
sudo apt install -y git python3 python3-venv python3-pip nginx postgresql postgresql-contrib
```

### 1.2 Clone code

```bash
git clone https://github.com/madhu-yavar/Z-roadmap.git
cd Z-roadmap
```

### 1.3 Configure Postgres

```bash
sudo -u postgres psql
CREATE USER roadmap WITH PASSWORD 'roadmap';
CREATE DATABASE roadmap_agent OWNER roadmap;
\q
```

Load full schema + seed:

```bash
psql "postgresql://roadmap:roadmap@localhost:5432/roadmap_agent" -f db/full_dump.sql
```

### 1.4 Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
APP_NAME=Z- Roadmap
APP_ENV=prod
SECRET_KEY=<strong-secret>
ACCESS_TOKEN_EXPIRE_MINUTES=120
DATABASE_URL=postgresql+psycopg2://roadmap:roadmap@localhost:5432/roadmap_agent
FILE_STORAGE_PATH=storage/uploads
CORS_ORIGINS=https://<your-domain>

# Optional Vertex AI runtime
GOOGLE_GENAI_USE_VERTEXAI=True
GOOGLE_CLOUD_PROJECT=<project-id>
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=/home/ubuntu/z-agent-dev-8ea7bd583232.json
```

Create service `/etc/systemd/system/zroadmap-backend.service`:

```ini
[Unit]
Description=Z- Roadmap Backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/Z-roadmap/backend
Environment=PATH=/home/ubuntu/Z-roadmap/backend/.venv/bin
ExecStart=/home/ubuntu/Z-roadmap/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable zroadmap-backend
sudo systemctl start zroadmap-backend
sudo systemctl status zroadmap-backend
```

### 1.5 Frontend build

```bash
cd ../frontend
npm ci
VITE_API_BASE=/api npm run build
sudo mkdir -p /var/www/zroadmap
sudo cp -r dist/* /var/www/zroadmap/
```

### 1.6 Nginx config

Create `/etc/nginx/sites-available/zroadmap`:

```nginx
server {
    listen 80;
    server_name <your-domain>;

    root /var/www/zroadmap;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -sf /etc/nginx/sites-available/zroadmap /etc/nginx/sites-enabled/zroadmap
sudo nginx -t
sudo systemctl reload nginx
```

Enable TLS:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <your-domain>
```

## 2. Docker Compose Deployment

Files included:
- `docker-compose.prod.yml`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `frontend/nginx.conf`

### 2.1 Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

### 2.2 Create env file

Create `.env.prod` at repo root:

```env
SECRET_KEY=<strong-secret>
POSTGRES_PASSWORD=<strong-db-password>
CORS_ORIGINS=https://<your-domain>

# Vertex AI (optional)
GOOGLE_GENAI_USE_VERTEXAI=True
GOOGLE_CLOUD_PROJECT=z-agent-dev
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/service-account.json
```

If using Vertex AI, place service account json at:
- `./secrets/service-account.json`

### 2.3 Start stack

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

### 2.4 Load DB dump (one-time)

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres \
  psql -U roadmap -d roadmap_agent < db/full_dump.sql
```

### 2.5 Verify
- Frontend: `http://<vm-ip-or-domain>`
- API health: `http://<vm-ip-or-domain>/api/health`

### 2.6 Logs and restart

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f backend frontend postgres
docker compose --env-file .env.prod -f docker-compose.prod.yml restart backend frontend
```

## 3. Database Artifacts
- Full dump: `db/full_dump.sql`
- Schema only: `db/schema.sql`
- Seed only: `db/seed.sql`

## 4. Notes
- UI provider settings are saved in DB; actual Vertex credentials are read by backend runtime env.
- Rotate all secrets/passwords in production.
