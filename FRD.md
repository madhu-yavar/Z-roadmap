# Functional Requirements Document (FRD)
## Roadmap Agent

**Version:** 1.0
**Date:** February 2026
**Document Status:** Complete

---

## Table of Contents

1. [Document Overview](#1-document-overview)
2. [System Overview](#2-system-overview)
3. [Functional Requirements by Module](#3-functional-requirements-by-module)
   - [3.1 Authentication and Authorization](#31-authentication-and-authorization)
   - [3.2 User Management](#32-user-management)
   - [3.3 Project Management](#33-project-management)
   - [3.4 Feature Management](#34-feature-management)
   - [3.5 Document Management](#35-document-management)
   - [3.6 Document Analysis](#36-document-analysis)
   - [3.7 Intake Pipeline](#37-intake-pipeline)
   - [3.8 Roadmap Management](#38-roadmap-management)
   - [3.9 Roadmap Planning](#39-roadmap-planning)
   - [3.10 Redundancy Detection](#310-redundancy-detection)
   - [3.11 AI Chat and Support](#311-ai-chat-and-support)
   - [3.12 Settings and Configuration](#312-settings-and-configuration)
   - [3.13 Dashboard and Analytics](#313-dashboard-and-analytics)
   - [3.14 Versioning and Audit Trail](#314-versioning-and-audit-trail)
   - [3.15 Export and Reporting](#315-export-and-reporting)
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [Data Requirements](#5-data-requirements)
6. [API Specifications](#6-api-specifications)
7. [User Role Matrix](#7-user-role-matrix)

---

## 1. Document Overview

### 1.1 Purpose
This Functional Requirements Document (FRD) defines the functional requirements for the Roadmap Agent application - a local-first web application for managing product roadmaps with AI-powered document analysis.

### 1.2 Scope
The Roadmap Agent system provides:
- Role-based access control (CEO, VP, BA, PM)
- Document upload and AI-powered analysis
- Intake-to-approval workflow for roadmap items
- Roadmap planning and scheduling
- Redundancy detection and resolution
- Multi-provider LLM support
- Comprehensive audit trail

### 1.3 Definitions
| Term | Definition |
|------|------------|
| BRD | Business Requirements Document |
| RFP | Request for Proposal |
| SoW | Statement of Work |
| Intake Item | A candidate roadmap item pending review and approval |
| Roadmap Item | An approved item in the product roadmap |
| LLM | Large Language Model |
| LangGraph | Framework for building stateful AI applications |

---

## 2. System Overview

### 2.1 Technology Stack
| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, Python 3.x |
| Database | PostgreSQL with pgvector extension |
| ORM | SQLAlchemy 2.0 (async) |
| Frontend | React 19, TypeScript, Vite |
| Routing | React Router |
| AI/ML | LangGraph 0.6.6 |
| Authentication | JWT (python-jose), passlib |

### 2.2 System Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React/Vite)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Dashboard│ │  Intake  │ │ Roadmap  │ │    Settings      │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘ │
└───────────────────────────────┬───────────────────────────────┘
                                │
                    HTTP/REST + JWT
                                │
┌───────────────────────────────▼───────────────────────────────┐
│                      Backend (FastAPI)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │   Auth   │ │Documents │ │  Intake  │ │     Chat         │ │
│  │  Routes  │ │  Routes  │ │  Routes  │ │    Routes        │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘ │
├───────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │   LLM    │ │ Document │ │ Intake   │ │    LangGraph     │ │
│  │  Client  │ │  Parser  │ │  Agent   │ │     Agent        │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘ │
└───────────────────────────────┬───────────────────────────────┘
                                │
                        SQLAlchemy 2.0 (async)
                                │
┌───────────────────────────────▼───────────────────────────────┐
│              PostgreSQL (with pgvector)                         │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 User Roles
| Role | Description | Permissions |
|------|-------------|-------------|
| **CEO** | Chief Executive Officer | Full access including user management, bulk delete, unlock any item |
| **VP** | Vice President | Full access except user management, can approve roadmap decisions |
| **BA** | Business Analyst | Can create/modify intake items, documents, projects, features |
| **PM** | Product Manager | Can create/modify intake items, documents, projects, features |

---

## 3. Functional Requirements by Module

### 3.1 Authentication and Authorization

#### FR-AUTH-001: User Registration
**Priority:** High
**Description:** The system shall allow new users to register with email and password.

**Functional Requirements:**
- FR-AUTH-001.1: System shall validate email format during registration
- FR-AUTH-001.2: System shall require password with minimum length
- FR-AUTH-001.3: System shall hash passwords using passlib before storage
- FR-AUTH-001.4: System shall prevent duplicate email registration
- FR-AUTH-001.5: System shall assign a default role to new users (BA/PM)

**API Endpoint:** `POST /auth/register`

**Request Schema:**
```json
{
  "email": "string (email format)",
  "password": "string (min length)",
  "full_name": "string (optional)",
  "role": "string (enum: CEO, VP, BA, PM)"
}
```

**Response Schema:**
```json
{
  "id": "integer",
  "email": "string",
  "full_name": "string",
  "role": "string (enum: CEO, VP, BA, PM)",
  "is_active": "boolean"
}
```

---

#### FR-AUTH-002: User Login
**Priority:** Critical
**Description:** The system shall authenticate users with email and password.

**Functional Requirements:**
- FR-AUTH-002.1: System shall validate credentials against database
- FR-AUTH-002.2: System shall generate JWT token on successful authentication
- FR-AUTH-002.3: System shall return JWT with expiration time
- FR-AUTH-002.4: System shall return error for invalid credentials
- FR-AUTH-002.5: System shall return user profile on successful login

**API Endpoint:** `POST /auth/login`

**Request Schema:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response Schema:**
```json
{
  "access_token": "string (JWT)",
  "token_type": "bearer",
  "user": {
    "id": "integer",
    "email": "string",
    "full_name": "string",
    "role": "string"
  }
}
```

---

#### FR-AUTH-003: Current User Profile
**Priority:** High
**Description:** The system shall provide the current user's profile information.

**Functional Requirements:**
- FR-AUTH-003.1: System shall validate JWT token
- FR-AUTH-003.2: System shall return current user details
- FR-AUTH-003.3: System shall return 401 for invalid/expired tokens

**API Endpoint:** `GET /auth/me`

**Response Schema:**
```json
{
  "id": "integer",
  "email": "string",
  "full_name": "string",
  "role": "string (enum: CEO, VP, BA, PM)",
  "is_active": "boolean"
}
```

---

#### FR-AUTH-004: Token Validation
**Priority:** Critical
**Description:** The system shall validate JWT tokens on protected endpoints.

**Functional Requirements:**
- FR-AUTH-004.1: System shall validate JWT signature
- FR-AUTH-004.2: System shall check token expiration
- FR-AUTH-004.3: System shall extract user claims from token
- FR-AUTH-004.4: System shall return 401 Unauthorized for invalid tokens

---

#### FR-AUTH-005: Role-Based Access Control
**Priority:** Critical
**Description:** The system shall enforce role-based permissions on protected endpoints.

**Functional Requirements:**
- FR-AUTH-005.1: System shall verify user role before executing protected operations
- FR-AUTH-005.2: System shall allow CEO-only operations (user management, bulk delete)
- FR-AUTH-005.3: System shall allow CEO/VP operations (unlock roadmap items, redundancy decisions)
- FR-AUTH-005.4: System shall allow all authenticated users (BA, PM) for standard operations
- FR-AUTH-005.5: System shall return 403 Forbidden for insufficient permissions

---

### 3.2 User Management

#### FR-USER-001: List Users
**Priority:** High
**Description:** The system shall allow listing all users (CEO/VP only).

**Functional Requirements:**
- FR-USER-001.1: System shall require CEO or VP role
- FR-USER-001.2: System shall return list of all users with their details
- FR-USER-001.3: System shall support filtering by role

**API Endpoint:** `GET /users`

**Response Schema:**
```json
[
  {
    "id": "integer",
    "email": "string",
    "full_name": "string",
    "role": "string (enum: CEO, VP, BA, PM)",
    "is_active": "boolean",
    "created_at": "datetime"
  }
]
```

---

#### FR-USER-002: Create User
**Priority:** High
**Description:** The system shall allow CEO to create new users.

**Functional Requirements:**
- FR-USER-002.1: System shall require CEO role
- FR-USER-002.2: System shall validate email uniqueness
- FR-USER-002.3: System shall allow role assignment
- FR-USER-002.4: System shall set default password for new users

**API Endpoint:** `POST /users`

**Request Schema:**
```json
{
  "email": "string",
  "password": "string",
  "full_name": "string",
  "role": "string (enum: CEO, VP, BA, PM)"
}
```

---

#### FR-USER-003: Update User
**Priority:** Medium
**Description:** The system shall allow CEO to update user details.

**Functional Requirements:**
- FR-USER-003.1: System shall require CEO role
- FR-USER-003.2: System shall allow updating full name, role, and active status
- FR-USER-003.3: System shall prevent users from deactivating themselves

**API Endpoint:** `PATCH /users/{user_id}`

---

#### FR-USER-004: Delete User
**Priority:** Medium
**Description:** The system shall allow CEO to delete users.

**Functional Requirements:**
- FR-USER-004.1: System shall require CEO role
- FR-USER-004.2: System shall prevent users from deleting themselves
- FR-USER-004.3: System shall handle cascade deletion of user-owned resources

**API Endpoint:** `DELETE /users/{user_id}`

---

#### FR-USER-005: Seed Initial Users
**Priority:** High
**Description:** The system shall provide a script to seed initial users.

**Functional Requirements:**
- FR-USER-005.1: System shall create default users if they don't exist
- FR-USER-005.2: System shall set default password as `pass1234`
- FR-USER-005.3: System shall create users for all roles (CEO, VP, BA, PM)

**Default Users:**
| Email | Role | Password |
|-------|------|----------|
| ceo@local.test | CEO | pass1234 |
| vp@local.test | VP | pass1234 |
| ba@local.test | BA | pass1234 |
| pm@local.test | PM | pass1234 |

---

### 3.3 Project Management

#### FR-PROJ-001: List Projects
**Priority:** High
**Description:** The system shall allow listing all projects.

**Functional Requirements:**
- FR-PROJ-001.1: System shall return all projects with their details
- FR-PROJ-001.2: System shall support filtering by type and status
- FR-PROJ-001.3: System shall require authenticated user

**API Endpoint:** `GET /projects`

**Query Parameters:**
- `type` (optional): Filter by project type (client, inhouse, rnd, pipeline)
- `status` (optional): Filter by status (planned, in_progress, delayed, done)

**Response Schema:**
```json
[
  {
    "id": "integer",
    "title": "string",
    "description": "string",
    "type": "string (enum: client, inhouse, rnd, pipeline)",
    "status": "string (enum: planned, in_progress, delayed, done)",
    "progress": "integer (0-100)",
    "target_date": "date (optional)",
    "owner_id": "integer",
    "created_at": "datetime",
    "updated_at": "datetime"
  }
]
```

---

#### FR-PROJ-002: Create Project
**Priority:** High
**Description:** The system shall allow creating new projects.

**Functional Requirements:**
- FR-PROJ-002.1: System shall require authenticated user (BA, PM, VP, CEO)
- FR-PROJ-002.2: System shall validate required fields (title, type)
- FR-PROJ-002.3: System shall set default status to "planned"
- FR-PROJ-002.4: System shall assign current user as owner if not specified

**API Endpoint:** `POST /projects`

**Request Schema:**
```json
{
  "title": "string",
  "description": "string (optional)",
  "type": "string (enum: client, inhouse, rnd, pipeline)",
  "target_date": "date (optional)",
  "owner_id": "integer (optional)"
}
```

---

#### FR-PROJ-003: Update Project
**Priority:** High
**Description:** The system shall allow updating project details.

**Functional Requirements:**
- FR-PROJ-003.1: System shall require authenticated user
- FR-PROJ-003.2: System shall allow updating all project fields
- FR-PROJ-003.3: System shall validate type and status enums

**API Endpoint:** `PATCH /projects/{project_id}`

**Request Schema:**
```json
{
  "title": "string (optional)",
  "description": "string (optional)",
  "type": "string (optional)",
  "status": "string (optional)",
  "progress": "integer (optional, 0-100)",
  "target_date": "date (optional)",
  "owner_id": "integer (optional)"
}
```

---

#### FR-PROJ-004: Project Types
**Priority:** High
**Description:** The system shall support multiple project types.

**Functional Requirements:**
- FR-PROJ-004.1: System shall support "client" projects (external client work)
- FR-PROJ-004.2: System shall support "inhouse" projects (internal initiatives)
- FR-PROJ-004.3: System shall support "rnd" projects (research and development)
- FR-PROJ-004.4: System shall support "pipeline" projects (potential future work)

---

#### FR-PROJ-005: Project Status Tracking
**Priority:** Medium
**Description:** The system shall track project status through lifecycle.

**Status Values:**
| Status | Description |
|--------|-------------|
| planned | Project is in planning phase |
| in_progress | Project is actively being worked on |
| delayed | Project has encountered delays |
| done | Project is completed |

---

### 3.4 Feature Management

#### FR-FEAT-001: List Features
**Priority:** High
**Description:** The system shall allow listing features.

**Functional Requirements:**
- FR-FEAT-001.1: System shall return all features with project details
- FR-FEAT-001.2: System shall support filtering by project

**API Endpoint:** `GET /features`

**Query Parameters:**
- `project_id` (optional): Filter by project

**Response Schema:**
```json
[
  {
    "id": "integer",
    "title": "string",
    "description": "string",
    "project_id": "integer",
    "project": {
      "id": "integer",
      "title": "string"
    },
    "created_at": "datetime",
    "updated_at": "datetime"
  }
]
```

---

#### FR-FEAT-002: Create Feature
**Priority:** High
**Description:** The system shall allow creating features within projects.

**Functional Requirements:**
- FR-FEAT-002.1: System shall require authenticated user
- FR-FEAT-002.2: System shall require valid project_id
- FR-FEAT-002.3: System shall validate title is provided

**API Endpoint:** `POST /features`

**Request Schema:**
```json
{
  "title": "string",
  "description": "string (optional)",
  "project_id": "integer"
}
```

---

#### FR-FEAT-003: Update Feature
**Priority:** High
**Description:** The system shall allow updating feature details.

**API Endpoint:** `PATCH /features/{feature_id}`

**Request Schema:**
```json
{
  "title": "string (optional)",
  "description": "string (optional)",
  "project_id": "integer (optional)"
}
```

---

### 3.5 Document Management

#### FR-DOC-001: Upload Document
**Priority:** Critical
**Description:** The system shall allow uploading documents for analysis.

**Functional Requirements:**
- FR-DOC-001.1: System shall require authenticated user
- FR-DOC-001.2: System shall support multiple file formats
- FR-DOC-001.3: System shall compute SHA-256 hash for deduplication
- FR-DOC-001.4: System shall detect file type automatically
- FR-DOC-001.5: System shall allow optional project association
- FR-DOC-001.6: System shall store file locally
- FR-DOC-001.7: System shall prevent duplicate file uploads (same hash)

**API Endpoint:** `POST /documents/upload`

**Request:** multipart/form-data
- `file`: The document file
- `project_id` (optional): Associate with project

**Supported Formats:**
| Category | Formats |
|----------|---------|
| Documents | PDF, DOC, DOCX, PPT, PPTX |
| Spreadsheets | XLS, XLSX, CSV |
| Text | TXT, MD, JSON, XML, HTML |
| Images | PNG, JPG, JPEG, GIF |

**Response Schema:**
```json
{
  "id": "integer",
  "filename": "string",
  "file_type": "string",
  "file_size": "integer",
  "file_hash": "string (SHA-256)",
  "project_id": "integer (optional)",
  "uploaded_at": "datetime"
}
```

---

#### FR-DOC-002: List Documents
**Priority:** High
**Description:** The system shall allow listing uploaded documents.

**Functional Requirements:**
- FR-DOC-002.1: System shall return all documents with metadata
- FR-DOC-002.2: System shall support filtering by project

**API Endpoint:** `GET /documents`

**Query Parameters:**
- `project_id` (optional): Filter by project

**Response Schema:**
```json
[
  {
    "id": "integer",
    "filename": "string",
    "file_type": "string",
    "file_size": "integer",
    "file_hash": "string",
    "project_id": "integer (optional)",
    "uploaded_at": "datetime"
  }
]
```

---

#### FR-DOC-003: Download Document
**Priority:** Medium
**Description:** The system shall allow downloading uploaded documents.

**Functional Requirements:**
- FR-DOC-003.1: System shall require authenticated user
- FR-DOC-003.2: System shall return file with appropriate content-type
- FR-DOC-003.3: System shall use original filename in response

**API Endpoint:** `GET /documents/{document_id}/file`

---

#### FR-DOC-004: Document Preview
**Priority:** High
**Description:** The system shall provide preview of document content.

**Functional Requirements:**
- FR-DOC-004.1: System shall extract text from supported formats
- FR-DOC-004.2: System shall return reference and text units
- FR-DOC-004.3: System shall handle preview based on file type

**API Endpoint:** `GET /documents/{document_id}/preview`

**Response Schema:**
```json
{
  "document_id": "integer",
  "filename": "string",
  "file_type": "string",
  "preview_type": "string (inline_text, extracted_text)",
  "ref_units": ["array of reference units"],
  "text_units": ["array of text chunks"],
  "total_chars": "integer"
}
```

---

#### FR-DOC-005: Bulk Delete Documents
**Priority:** Medium
**Description:** The system shall allow bulk deletion of documents.

**Functional Requirements:**
- FR-DOC-005.1: System shall require CEO role for bulk delete
- FR-DOC-005.2: System shall accept list of document IDs
- FR-DOC-005.3: System shall delete associated files
- FR-DOC-005.4: System shall return count of deleted documents

**API Endpoint:** `POST /documents/bulk-delete`

**Request Schema:**
```json
{
  "document_ids": ["integer"]
}
```

---

#### FR-DOC-006: File Deduplication
**Priority:** Medium
**Description:** The system shall prevent duplicate file storage.

**Functional Requirements:**
- FR-DOC-006.1: System shall compute SHA-256 hash on upload
- FR-DOC-006.2: System shall check for existing documents with same hash
- FR-DOC-006.3: System shall return existing document if duplicate found
- FR-DOC-006.4: System shall allow multiple references to same file

---

### 3.6 Document Analysis

#### FR-ANALYSIS-001: Analyze Document
**Priority:** Critical
**Description:** The system shall analyze documents using AI to extract structured data.

**Functional Requirements:**
- FR-ANALYSIS-001.1: System shall require authenticated user
- FR-ANALYSIS-001.2: System shall extract document content
- FR-ANALYSIS-001.3: System shall classify document type
- FR-ANALYSIS-001.4: System shall extract title, scope, and activities
- FR-ANALYSIS-001.5: System shall assign priority and context
- FR-ANALYSIS-001.6: System shall generate confidence score
- FR-ANALYSIS-001.7: System shall create intake item from analysis

**API Endpoint:** `POST /intake/analyze/{document_id}`

**Response Schema:**
```json
{
  "intake_item_id": "integer",
  "analysis": {
    "primary_type": "string (enum: BRD, RFP, Vision, SoW, Policy, Mixed)",
    "confidence": "float (0-1)",
    "title": "string",
    "scope": "string",
    "activities": ["string"],
    "priority": "string (enum: high, medium, low)",
    "context": "string (enum: growth, efficiency, compliance, innovation, risk_mgmt)",
    "mode": "string (enum: build, buy, partner, research, process, audit)",
    "rd_hypothesis": "string (if R&D)",
    "rd_experiment": "string (if R&D)",
    "source_ref": ["string"]
  }
}
```

---

#### FR-ANALYSIS-002: Document Classification
**Priority:** High
**Description:** The system shall classify documents into types.

**Document Types:**
| Type | Description |
|------|-------------|
| BRD | Business Requirements Document |
| RFP | Request for Proposal |
| Vision | Vision/strategy document |
| SoW | Statement of Work |
| Policy | Policy document |
| Mixed | Multiple document types combined |

---

#### FR-ANALYSIS-003: Priority Assignment
**Priority:** Medium
**Description:** The system shall assign priority based on document analysis.

**Priority Levels:**
| Priority | Description |
|----------|-------------|
| high | Urgent or critical items |
| medium | Standard priority items |
| low | Nice-to-have or backlogged items |

---

#### FR-ANALYSIS-004: Context Classification
**Priority:** Medium
**Description:** The system shall classify business context.

**Context Types:**
| Context | Description |
|---------|-------------|
| growth | Revenue or user growth initiatives |
| efficiency | Cost reduction or optimization |
| compliance | Regulatory or policy compliance |
| innovation | New technology or features |
| risk_mgmt | Risk mitigation activities |

---

#### FR-ANALYSIS-005: Mode Classification
**Priority:** Medium
**Description:** The system shall classify execution mode.

**Mode Types:**
| Mode | Description |
|------|-------------|
| build | Build in-house |
| buy | Purchase off-the-shelf |
| partner | Partner with external party |
| research | Research and exploration |
| process | Process improvement |
| audit | Audit or review activity |

---

### 3.7 Intake Pipeline

#### FR-INTAKE-001: List Intake Items
**Priority:** Critical
**Description:** The system shall list all intake items (not yet approved).

**Functional Requirements:**
- FR-INTAKE-001.1: System shall return unapproved intake items
- FR-INTAKE-001.2: System shall support filtering by status
- FR-INTAKE-001.3: System shall return analysis details

**API Endpoint:** `GET /intake/items`

**Query Parameters:**
- `status` (optional): Filter by status

**Response Schema:**
```json
[
  {
    "id": "integer",
    "document_id": "integer",
    "status": "string (enum: understanding_pending, draft, approved)",
    "primary_type": "string",
    "title": "string",
    "scope": "string",
    "activities": ["string"],
    "priority": "string",
    "context": "string",
    "mode": "string",
    "rd_hypothesis": "string (optional)",
    "rd_experiment": "string (optional)",
    "confidence": "float",
    "source_ref": ["string"],
    "created_at": "datetime",
    "updated_at": "datetime"
  }
]
```

---

#### FR-INTAKE-002: Review Intake Item
**Priority:** Critical
**Description:** The system shall allow review and modification of intake items.

**Functional Requirements:**
- FR-INTAKE-002.1: System shall allow editing all fields except id
- FR-INTAKE-002.2: System shall track version history on changes
- FR-INTAKE-002.3: System shall require authenticated user

**API Endpoint:** `PATCH /intake/items/{item_id}`

**Request Schema:**
```json
{
  "title": "string (optional)",
  "scope": "string (optional)",
  "activities": ["string (optional)"],
  "priority": "string (optional)",
  "context": "string (optional)",
  "mode": "string (optional)",
  "rd_hypothesis": "string (optional)",
  "rd_experiment": "string (optional)",
  "status": "string (optional)"
}
```

---

#### FR-INTAKE-003: Approve Understanding
**Priority:** Critical
**Description:** The system shall generate roadmap candidate from approved understanding.

**Functional Requirements:**
- FR-INTAKE-003.1: System shall validate understanding is approved
- FR-INTAKE-003.2: System shall generate detailed roadmap description
- FR-INTAKE-003.3: System shall return roadmap candidate

**API Endpoint:** `POST /intake/items/{item_id}/approve-understanding`

**Response Schema:**
```json
{
  "candidate": {
    "title": "string",
    "scope": "string",
    "activities": ["string"],
    "deliverables": ["string"],
    "success_criteria": ["string"],
    "estimated_effort": "string"
  }
}
```

---

#### FR-INTAKE-004: Create Manual Intake Item
**Priority:** High
**Description:** The system shall allow creating intake items without document analysis.

**Functional Requirements:**
- FR-INTAKE-004.1: System shall allow manual creation
- FR-INTAKE-004.2: System shall set status to "draft"
- FR-INTAKE-004.3: System shall require all mandatory fields

**API Endpoint:** `POST /intake/manual-create`

**Request Schema:**
```json
{
  "title": "string",
  "scope": "string",
  "activities": ["string"],
  "priority": "string",
  "context": "string",
  "mode": "string",
  "primary_type": "string"
}
```

---

#### FR-INTAKE-005: Bulk Delete Intake Items
**Priority:** Medium
**Description:** The system shall allow bulk deletion of intake items.

**Functional Requirements:**
- FR-INTAKE-005.1: System shall require CEO role
- FR-INTAKE-005.2: System shall accept list of item IDs
- FR-INTAKE-005.3: System shall delete associated analysis data

**API Endpoint:** `POST /intake/items/bulk-delete`

**Request Schema:**
```json
{
  "item_ids": ["integer"]
}
```

---

#### FR-INTAKE-006: Intake Status Workflow
**Priority:** Critical
**Description:** The system shall manage intake item status through workflow.

**Status States:**
| Status | Description | Next States |
|--------|-------------|-------------|
| understanding_pending | AI analysis in progress | draft |
| draft | Ready for human review | approved, understanding_pending |
| approved | Approved to roadmap |

---

#### FR-INTAKE-007: Get Intake Analysis
**Priority:** Medium
**Description:** The system shall provide detailed analysis for an intake item.

**API Endpoint:** `GET /intake/items/{item_id}/analysis`

**Response Schema:**
```json
{
  "item_id": "integer",
  "primary_type": "string",
  "confidence": "float",
  "title": "string",
  "scope": "string",
  "activities": ["string"],
  "priority": "string",
  "context": "string",
  "mode": "string",
  "rd_hypothesis": "string (optional)",
  "rd_experiment": "string (optional)",
  "source_ref": ["string"],
  "output_json": "object (raw LLM output)"
}
```

---

### 3.8 Roadmap Management

#### FR-ROADMAP-001: List Roadmap Items
**Priority:** Critical
**Description:** The system shall list all approved roadmap items.

**Functional Requirements:**
- FR-ROADMAP-001.1: System shall return all roadmap items
- FR-ROADMAP-001.2: System shall support filtering by various attributes
- FR-ROADMAP-001.3: System shall return lock status for each item

**API Endpoint:** `GET /roadmap/items`

**Query Parameters:**
- `year` (optional): Filter by year
- `priority` (optional): Filter by priority
- `context` (optional): Filter by context
- `mode` (optional): Filter by mode

**Response Schema:**
```json
[
  {
    "id": "integer",
    "intake_item_id": "integer",
    "title": "string",
    "scope": "string",
    "activities": ["string"],
    "deliverables": ["string"],
    "success_criteria": ["string"],
    "priority": "string",
    "context": "string",
    "mode": "string",
    "is_locked": "boolean",
    "created_at": "datetime",
    "updated_at": "datetime"
  }
]
```

---

#### FR-ROADMAP-002: Update Roadmap Item
**Priority:** Critical
**Description:** The system shall allow updating roadmap items.

**Functional Requirements:**
- FR-ROADMAP-002.1: System shall prevent updates to locked items
- FR-ROADMAP-002.2: System shall allow CEO/VP to unlock items
- FR-ROADMAP-002.3: System shall track version history

**API Endpoint:** `PATCH /roadmap/items/{item_id}`

**Request Schema:**
```json
{
  "title": "string (optional)",
  "scope": "string (optional)",
  "activities": ["string (optional)"],
  "deliverables": ["string (optional)"],
  "success_criteria": ["string (optional)"],
  "priority": "string (optional)",
  "context": "string (optional)",
  "mode": "string (optional)"
}
```

---

#### FR-ROADMAP-003: Bulk Delete Roadmap Items
**Priority:** Medium
**Description:** The system shall allow bulk deletion of roadmap items.

**Functional Requirements:**
- FR-ROADMAP-003.1: System shall require CEO role
- FR-ROADMAP-003.2: System shall accept list of item IDs
- FR-ROADMAP-003.3: System shall handle cascade deletions

**API Endpoint:** `POST /roadmap/items/bulk-delete`

**Request Schema:**
```json
{
  "item_ids": ["integer"]
}
```

---

#### FR-ROADMAP-004: Roadmap Item Locking
**Priority:** High
**Description:** The system shall lock roadmap items when planning is committed.

**Functional Requirements:**
- FR-ROADMAP-004.1: System shall set `is_locked` to true when committed
- FR-ROADMAP-004.2: System shall prevent editing locked items
- FR-ROADMAP-004.3: System shall allow CEO/VP to unlock items
- FR-ROADMAP-004.4: System shall track lock/unlock actions

---

### 3.9 Roadmap Planning

#### FR-PLAN-001: List Planned Items
**Priority:** Critical
**Description:** The system shall list items in planning with scheduling details.

**Functional Requirements:**
- FR-PLAN-001.1: System shall return items with planning details
- FR-PLAN-001.2: System shall support filtering

**API Endpoint:** `GET /roadmap/plan/items`

**Response Schema:**
```json
[
  {
    "id": "integer",
    "roadmap_item_id": "integer",
    "title": "string",
    "priority": "string",
    "context": "string",
    "mode": "string",
    "planned_start_date": "date (optional)",
    "planned_end_date": "date (optional)",
    "pickup_period": "string (optional)",
    "completion_period": "string (optional)",
    "resource_count": "integer (optional)",
    "estimated_effort": "string (optional)",
    "confidence": "integer (optional, 0-100)",
    "dependencies": ["integer (roadmap item IDs)"],
    "is_committed": "boolean"
  }
]
```

---

#### FR-PLAN-002: Update Planning Details
**Priority:** Critical
**Description:** The system shall allow updating planning details for items.

**Functional Requirements:**
- FR-PLAN-002.1: System shall allow updating all planning fields
- FR-PLAN-002.2: System shall validate date ranges
- FR-PLAN-002.3: System shall validate confidence range (0-100)

**API Endpoint:** `PATCH /roadmap/plan/items/{item_id}`

**Request Schema:**
```json
{
  "planned_start_date": "date (optional)",
  "planned_end_date": "date (optional)",
  "pickup_period": "string (optional)",
  "completion_period": "string (optional)",
  "resource_count": "integer (optional)",
  "estimated_effort": "string (optional)",
  "confidence": "integer (optional, 0-100)"
}
```

---

#### FR-PLAN-003: Move Items to Planning
**Priority:** High
**Description:** The system shall move intake items to planning.

**Functional Requirements:**
- FR-PLAN-003.1: System shall accept list of intake item IDs
- FR-PLAN-003.2: System shall create roadmap items
- FR-PLAN-003.3: System shall create planning entries

**API Endpoint:** `POST /roadmap/plan/move`

**Request Schema:**
```json
{
  "intake_item_ids": ["integer"]
}
```

---

#### FR-PLAN-004: Export Planning
**Priority:** High
**Description:** The system shall export planning to Excel with Gantt chart.

**Functional Requirements:**
- FR-PLAN-004.1: System shall generate Excel file
- FR-PLAN-004.2: System shall include Gantt chart visualization
- FR-PLAN-004.3: System shall support filtering

**API Endpoint:** `GET /roadmap/plan/export`

**Query Parameters:**
- `year` (optional): Filter by year
- `priority` (optional): Filter by priority
- `context` (optional): Filter by context
- `mode` (optional): Filter by mode

**Response:** Excel file download

---

#### FR-PLAN-005: Commit Planning
**Priority:** High
**Description:** The system shall commit planning and lock items.

**Functional Requirements:**
- FR-PLAN-005.1: System shall set `is_committed` flag
- FR-PLAN-005.2: System shall lock associated roadmap items
- FR-PLAN-005.3: System shall prevent further edits to committed items

---

### 3.10 Redundancy Detection

#### FR-REDUN-001: List Potential Duplicates
**Priority:** High
**Description:** The system shall detect potential duplicate roadmap items.

**Functional Requirements:**
- FR-REDUN-001.1: System shall use similarity scoring algorithm
- FR-REDUN-001.2: System shall compare title, scope, and activities
- FR-REDUN-001.3: System shall require CEO or VP role

**API Endpoint:** `GET /roadmap/items/redundancy`

**Response Schema:**
```json
[
  {
    "item_id": "integer",
    "title": "string",
    "potential_duplicates": [
      {
        "item_id": "integer",
        "title": "string",
        "similarity_score": "float (0-1)"
      }
    ]
  }
]
```

---

#### FR-REDUN-002: Redundancy Decision
**Priority:** High
**Description:** The system shall handle redundancy decisions.

**Functional Requirements:**
- FR-REDUN-002.1: System shall require CEO or VP role
- FR-REDUN-002.2: System shall support three actions
- FR-REDUN-002.3: System shall auto-merge when selected

**API Endpoint:** `POST /roadmap/items/{item_id}/redundancy-decision`

**Request Schema:**
```json
{
  "target_item_id": "integer",
  "decision": "string (enum: merge, keep_both, intentional_overlap)",
  "note": "string (optional)"
}
```

**Decision Types:**
| Decision | Description |
|----------|-------------|
| merge | Merge target into source item |
| keep_both | Keep both items as separate |
| intentional_overlap | Acknowledge overlap but keep separate |

---

#### FR-REDUN-003: Merge Items
**Priority:** Medium
**Description:** The system shall merge items when redundancy is confirmed.

**Functional Requirements:**
- FR-REDUN-003.1: System shall combine scopes
- FR-REDUN-003.2: System shall combine activities
- FR-REDUN-003.3: System shall delete target item
- FR-REDUN-003.4: System shall update dependencies

---

### 3.11 AI Chat and Support

#### FR-CHAT-001: General Roadmap Chat
**Priority:** High
**Description:** The system shall provide AI-powered Q&A about roadmap.

**Functional Requirements:**
- FR-CHAT-001.1: System shall accept natural language questions
- FR-CHAT-001.2: System shall query roadmap data
- FR-CHAT-001.3: System shall return evidence-based answers
- FR-CHAT-001.4: System shall use LangGraph for conversation flow

**API Endpoint:** `POST /chat`

**Request Schema:**
```json
{
  "query": "string",
  "conversation_id": "string (optional, for multi-turn)"
}
```

**Response Schema:**
```json
{
  "answer": "string",
  "sources": ["string"],
  "conversation_id": "string",
  "follow_up_questions": ["string"]
}
```

---

#### FR-CHAT-002: Intake Support Chat
**Priority:** High
**Description:** The system shall provide specialized support for intake review.

**Functional Requirements:**
- FR-CHAT-002.1: System shall accept intake item context
- FR-CHAT-002.2: System shall provide state-gated support
- FR-CHAT-002.3: System shall suggest actions
- FR-CHAT-002.4: System shall support multi-turn conversations

**API Endpoint:** `POST /chat/intake-support`

**Request Schema:**
```json
{
  "intake_item_id": "integer",
  "query": "string",
  "state": "string (optional)",
  "conversation_history": ["array of messages"]
}
```

**Response Schema:**
```json
{
  "response": "string",
  "suggested_actions": [
    {
      "type": "string",
      "description": "string",
      "params": "object"
    }
  ],
  "state": "string",
  "conversation_history": ["array"]
}
```

---

#### FR-CHAT-003: Intent Resolution
**Priority:** Medium
**Description:** The system shall help resolve unclear intents.

**Functional Requirements:**
- FR-CHAT-003.1: System shall detect low confidence analysis
- FR-CHAT-003.2: System shall ask clarifying questions
- FR-CHAT-003.3: System shall update intake based on conversation

---

#### FR-CHAT-004: Activity Generation
**Priority:** Medium
**Description:** The system shall generate activities from scope.

**Functional Requirements:**
- FR-CHAT-004.1: System shall parse scope description
- FR-CHAT-004.2: System shall generate actionable activities
- FR-CHAT-004.3: System shall allow user confirmation

---

### 3.12 Settings and Configuration

#### FR-SETTINGS-001: List LLM Configurations
**Priority:** High
**Description:** The system shall list all configured LLM providers.

**Functional Requirements:**
- FR-SETTINGS-001.1: System shall show all configured providers
- FR-SETTINGS-001.2: System shall indicate active provider
- FR-SETTINGS-001.3: System shall show provider status

**API Endpoint:** `GET /settings/llm`

**Response Schema:**
```json
[
  {
    "provider": "string (enum: gemini, claude, openai, ollama, vertexai)",
    "model": "string",
    "is_active": "boolean",
    "is_configured": "boolean",
    "last_tested": "datetime (optional)",
    "test_status": "string (optional)"
  }
]
```

---

#### FR-SETTINGS-002: Set Active LLM
**Priority:** High
**Description:** The system shall allow setting the active LLM provider.

**Functional Requirements:**
- FR-SETTINGS-002.1: System shall require authenticated user
- FR-SETTINGS-002.2: System shall validate provider is configured
- FR-SETTINGS-002.3: System shall set as active for AI operations

**API Endpoint:** `POST /settings/llm/active`

**Request Schema:**
```json
{
  "provider": "string (enum: gemini, claude, openai, ollama, vertexai)"
}
```

---

#### FR-SETTINGS-003: Test LLM Connection
**Priority:** Medium
**Description:** The system shall test connectivity to LLM providers.

**Functional Requirements:**
- FR-SETTINGS-003.1: System shall send test request to provider
- FR-SETTINGS-003.2: System shall return success/failure status
- FR-SETTINGS-003.3: System shall update last tested timestamp

**API Endpoint:** `POST /settings/llm/test`

**Request Schema:**
```json
{
  "provider": "string"
}
```

**Response Schema:**
```json
{
  "success": "boolean",
  "message": "string",
  "latency_ms": "integer (optional)"
}
```

---

#### FR-SETTINGS-004: Supported LLM Providers
**Priority:** High
**Description:** The system shall support multiple LLM providers.

**Supported Providers:**
| Provider | Description | Configuration |
|----------|-------------|---------------|
| Gemini | Google Generative AI | API key |
| Claude | Anthropic Claude | API key |
| OpenAI | OpenAI-compatible | API key + base URL |
| Ollama | Local LLM server | Base URL |
| Vertex AI | Google Cloud Vertex AI | GCP credentials |

---

### 3.13 Dashboard and Analytics

#### FR-DASH-001: Dashboard Summary
**Priority:** High
**Description:** The system shall provide dashboard summary statistics.

**Functional Requirements:**
- FR-DASH-001.1: System shall return comprehensive statistics
- FR-DASH-001.2: System shall calculate counts dynamically

**API Endpoint:** `GET /dashboard/summary`

**Response Schema:**
```json
{
  "intake": {
    "total": "integer",
    "understanding_pending": "integer",
    "draft": "integer"
  },
  "commitment": {
    "total": "integer",
    "ready": "integer",
    "locked": "integer"
  },
  "context_breakdown": {
    "growth": "integer",
    "efficiency": "integer",
    "compliance": "integer",
    "innovation": "integer",
    "risk_mgmt": "integer"
  },
  "mode_breakdown": {
    "build": "integer",
    "buy": "integer",
    "partner": "integer",
    "research": "integer",
    "process": "integer",
    "audit": "integer"
  },
  "priority_breakdown": {
    "high": "integer",
    "medium": "integer",
    "low": "integer"
  }
}
```

---

### 3.14 Versioning and Audit Trail

#### FR-VERSION-001: Intake Item History
**Priority:** High
**Description:** The system shall track version history for intake items.

**Functional Requirements:**
- FR-VERSION-001.1: System shall create version on every change
- FR-VERSION-001.2: System shall track field, old value, new value
- FR-VERSION-001.3: System shall track user and timestamp

**API Endpoint:** `GET /intake/items/{item_id}/history`

**Response Schema:**
```json
[
  {
    "id": "integer",
    "intake_item_id": "integer",
    "field_name": "string",
    "old_value": "string",
    "new_value": "string",
    "changed_by": "string",
    "changed_at": "datetime"
  }
]
```

---

#### FR-VERSION-002: Roadmap Item History
**Priority:** High
**Description:** The system shall track version history for roadmap items.

**API Endpoint:** `GET /roadmap/items/{item_id}/history`

**Response Schema:**
```json
[
  {
    "id": "integer",
    "roadmap_item_id": "integer",
    "field_name": "string",
    "old_value": "string",
    "new_value": "string",
    "changed_by": "string",
    "changed_at": "datetime"
  }
]
```

---

### 3.15 Export and Reporting

#### FR-EXPORT-001: Excel Export
**Priority:** High
**Description:** The system shall export roadmap planning to Excel.

**Functional Requirements:**
- FR-EXPORT-001.1: System shall generate Excel file
- FR-EXPORT-001.2: System shall include Gantt chart
- FR-EXPORT-001.3: System shall support filters
- FR-EXPORT-001.4: System shall include monthly timeline

**Excel Columns:**
| Column | Description |
|--------|-------------|
| ID | Item ID |
| Title | Item title |
| Priority | Priority level |
| Context | Business context |
| Mode | Execution mode |
| Resources | Resource count |
| Effort | Estimated effort |
| Confidence | Confidence score |
| Start | Planned start date |
| End | Planned end date |
| Duration | Duration in days |
| Timeline | Gantt chart visualization |

---

## 4. Non-Functional Requirements

### 4.1 Performance
| Requirement | Description |
|-------------|-------------|
| NFR-PERF-001 | API response time < 500ms for simple queries |
| NFR-PERF-002 | Document upload shall support files up to 50MB |
| NFR-PERF-003 | AI analysis shall complete within 60 seconds |
| NFR-PERF-004 | Dashboard shall load within 2 seconds |

### 4.2 Security
| Requirement | Description |
|-------------|-------------|
| NFR-SEC-001 | All passwords shall be hashed using passlib |
| NFR-SEC-002 | JWT tokens shall expire after 24 hours |
| NFR-SEC-003 | API keys shall be stored securely |
| NFR-SEC-004 | File uploads shall be validated for type |
| NFR-SEC-005 | CORS shall be configured for allowed origins |

### 4.3 Reliability
| Requirement | Description |
|-------------|-------------|
| NFR-REL-001 | System shall handle database connection failures gracefully |
| NFR-REL-002 | LLM failures shall fall back to alternative providers |
| NFR-REL-003 | File deduplication shall prevent duplicate storage |

### 4.4 Maintainability
| Requirement | Description |
|-------------|-------------|
| NFR-MAINT-001 | Code shall follow PEP 8 style guidelines |
| NFR-MAINT-002 | API changes shall be versioned |
| NFR-MAINT-003 | Database schema changes shall be backwards compatible |

---

## 5. Data Requirements

### 5.1 Entity Relationships

```
User (1) ----< (N) Project
User (1) ----< (N) RoadmapItem
Project (1) ----< (N) Feature
Project (1) ----< (N) Document
Document (1) ---- (1) IntakeItem
IntakeItem (1) ---- (1) RoadmapItem
RoadmapItem (1) ----< (1) RoadmapPlanning
RoadmapPlanning (1) ----< (N) RoadmapPlanning (dependencies)
IntakeItem (1) ----< (N) IntakeItemVersion
RoadmapItem (1) ----< (N) RoadmapItemVersion
```

### 5.2 Database Schema

#### Users Table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | User ID |
| email | VARCHAR UNIQUE | Email address |
| hashed_password | VARCHAR | Hashed password |
| full_name | VARCHAR | Full name |
| role | VARCHAR | User role |
| is_active | BOOLEAN | Active status |
| created_at | TIMESTAMP | Creation timestamp |

#### Projects Table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Project ID |
| title | VARCHAR | Project title |
| description | TEXT | Project description |
| type | VARCHAR | Project type |
| status | VARCHAR | Project status |
| progress | INTEGER | Progress percentage |
| target_date | DATE | Target completion date |
| owner_id | INTEGER FK | Owner user ID |

#### Documents Table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Document ID |
| filename | VARCHAR | Original filename |
| file_type | VARCHAR | File type |
| file_size | INTEGER | File size in bytes |
| file_hash | VARCHAR UNIQUE | SHA-256 hash |
| file_path | VARCHAR | Storage path |
| project_id | INTEGER FK | Associated project |
| uploaded_at | TIMESTAMP | Upload timestamp |

#### IntakeItems Table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Intake item ID |
| document_id | INTEGER FK | Source document |
| status | VARCHAR | Workflow status |
| primary_type | VARCHAR | Document type |
| title | VARCHAR | Item title |
| scope | TEXT | Item scope |
| activities | JSONB | Activities array |
| priority | VARCHAR | Priority level |
| context | VARCHAR | Business context |
| mode | VARCHAR | Execution mode |
| rd_hypothesis | TEXT | R&D hypothesis |
| rd_experiment | TEXT | R&D experiment |
| confidence | FLOAT | Analysis confidence |
| source_ref | JSONB | Source references |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update |

#### RoadmapItems Table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Roadmap item ID |
| intake_item_id | INTEGER FK | Source intake |
| title | VARCHAR | Item title |
| scope | TEXT | Item scope |
| activities | JSONB | Activities array |
| deliverables | JSONB | Deliverables array |
| success_criteria | JSONB | Success criteria |
| priority | VARCHAR | Priority level |
| context | VARCHAR | Business context |
| mode | VARCHAR | Execution mode |
| is_locked | BOOLEAN | Lock status |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update |

#### RoadmapPlanning Table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Planning ID |
| roadmap_item_id | INTEGER FK | Roadmap item |
| planned_start_date | DATE | Planned start |
| planned_end_date | DATE | Planned end |
| pickup_period | VARCHAR | Pickup period |
| completion_period | VARCHAR | Completion period |
| resource_count | INTEGER | Number of resources |
| estimated_effort | VARCHAR | Effort estimate |
| confidence | INTEGER | Confidence score |
| is_committed | BOOLEAN | Commit status |

---

## 6. API Specifications

### 6.1 Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | /auth/register | Register new user | No |
| POST | /auth/login | User login | No |
| GET | /auth/me | Get current user | Yes |

### 6.2 User Management Endpoints

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| GET | /users | List users | Yes | CEO/VP |
| POST | /users | Create user | Yes | CEO |
| PATCH | /users/{id} | Update user | Yes | CEO |
| DELETE | /users/{id} | Delete user | Yes | CEO |

### 6.3 Project Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | /projects | List projects | Yes |
| POST | /projects | Create project | Yes |
| PATCH | /projects/{id} | Update project | Yes |

### 6.4 Feature Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | /features | List features | Yes |
| POST | /features | Create feature | Yes |
| PATCH | /features/{id} | Update feature | Yes |

### 6.5 Document Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | /documents/upload | Upload document | Yes |
| GET | /documents | List documents | Yes |
| GET | /documents/{id}/file | Download document | Yes |
| GET | /documents/{id}/preview | Get preview | Yes |
| POST | /documents/bulk-delete | Bulk delete | Yes (CEO) |

### 6.6 Intake Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | /intake/items | List intake items | Yes |
| PATCH | /intake/items/{id} | Update intake item | Yes |
| GET | /intake/items/{id}/history | Get history | Yes |
| GET | /intake/items/{id}/analysis | Get analysis | Yes |
| POST | /intake/items/{id}/approve-understanding | Approve | Yes |
| POST | /intake/manual-create | Manual create | Yes |
| POST | /intake/items/bulk-delete | Bulk delete | Yes (CEO) |
| POST | /intake/analyze/{doc_id} | Analyze document | Yes |

### 6.7 Roadmap Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | /roadmap/items | List roadmap items | Yes |
| PATCH | /roadmap/items/{id} | Update item | Yes |
| GET | /roadmap/items/{id}/history | Get history | Yes |
| POST | /roadmap/items/bulk-delete | Bulk delete | Yes (CEO) |
| GET | /roadmap/items/redundancy | Check redundancy | Yes (CEO/VP) |
| POST | /roadmap/items/{id}/redundancy-decision | Decide | Yes (CEO/VP) |

### 6.8 Planning Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | /roadmap/plan/items | List planned items | Yes |
| PATCH | /roadmap/plan/items/{id} | Update planning | Yes |
| POST | /roadmap/plan/move | Move to planning | Yes |
| GET | /roadmap/plan/export | Export to Excel | Yes |

### 6.9 Chat Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | /chat | General chat | Yes |
| POST | /chat/intake-support | Intake support | Yes |

### 6.10 Settings Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | /settings/llm | List LLM configs | Yes |
| POST | /settings/llm/active | Set active LLM | Yes |
| POST | /settings/llm/test | Test connection | Yes |

### 6.11 Dashboard Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | /dashboard/summary | Dashboard stats | Yes |

---

## 7. User Role Matrix

### 7.1 Feature Access Matrix

| Feature | CEO | VP | BA | PM |
|---------|-----|----|----|-----|
| Register/Login | ✓ | ✓ | ✓ | ✓ |
| Create Users | ✓ | ✗ | ✗ | ✗ |
| Delete Users | ✓ | ✗ | ✗ | ✗ |
| Create Projects | ✓ | ✓ | ✓ | ✓ |
| Create Features | ✓ | ✓ | ✓ | ✓ |
| Upload Documents | ✓ | ✓ | ✓ | ✓ |
| Analyze Documents | ✓ | ✓ | ✓ | ✓ |
| Review Intake Items | ✓ | ✓ | ✓ | ✓ |
| Approve to Roadmap | ✓ | ✓ | ✓ | ✓ |
| Edit Roadmap Items | ✓ | ✓ | ✓ | ✓ |
| Unlock Locked Items | ✓ | ✓ | ✗ | ✗ |
| Bulk Delete | ✓ | ✗ | ✗ | ✗ |
| Redundancy Decisions | ✓ | ✓ | ✗ | ✗ |
| Roadmap Planning | ✓ | ✓ | ✓ | ✓ |
| Export to Excel | ✓ | ✓ | ✓ | ✓ |
| Chat with AI | ✓ | ✓ | ✓ | ✓ |
| Configure LLM | ✓ | ✓ | ✓ | ✓ |

### 7.2 Endpoint Access Matrix

| Endpoint Pattern | CEO | VP | BA | PM |
|------------------|-----|----|----|-----|
| /auth/* | All | All | All | All |
| GET /users | ✓ | ✓ | ✗ | ✗ |
| POST/PATCH/DELETE /users | ✓ | ✗ | ✗ | ✗ |
| /projects/* | All | All | All | All |
| /features/* | All | All | All | All |
| /documents/* | All | All | All | All |
| /intake/* | All | All | All | All |
| /roadmap/items/redundancy | ✓ | ✓ | ✗ | ✗ |
| /roadmap/items/redundancy-decision | ✓ | ✓ | ✗ | ✗ |
| /roadmap/plan/* | All | All | All | All |
| /chat/* | All | All | All | All |
| /settings/* | All | All | All | All |
| /dashboard/* | All | All | All | All |

---

## Appendix A: Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Duplicate resource |
| 422 | Unprocessable Entity - Validation error |
| 500 | Internal Server Error |
| 503 | Service Unavailable - LLM or database error |

---

## Appendix B: State Machines

### Intake Item State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                    Intake Item State Machine                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────────┐    ┌─────────┐    ┌──────────────────┐  │
│   │understanding_    │───>│  draft  │───>│    approved       │  │
│   │    pending       │    └─────────┘    └──────────────────┘  │
│   └──────────────────┘        ▲  │                                  │
│        ▲         │              │  │                                  │
│        │         └──────────────┘  │                                  │
│        │                            │                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Roadmap Item State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                   Roadmap Item State Machine                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────┐         ┌──────────┐         ┌──────────┐        │
│   │  Active  │────────>│  Locked  │────────>│ Archived │        │
│   └──────────┘  Unlock └──────────┘         └──────────┘        │
│        ▲            ▲    │                                       │
│        │            │    │                                       │
│        │            │    └───CEO/VP only                         │
└─────────────────────────────────────────────────────────────────┘
```

---

**Document End**
