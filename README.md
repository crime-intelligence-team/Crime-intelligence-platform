# State Crime Intelligence Platform

A secure, role-based Crime Intelligence Platform designed for law enforcement agencies to analyze crime data, monitor regional trends, visualize criminal networks, and support investigation workflows through geospatial intelligence, dashboards, and connected-entity analysis.

---

# Overview

The **State Crime Intelligence Platform (CIP)** is a full-stack intelligence system that enables police officers, detectives, intelligence analysts, supervisors, and administrators to make data-driven decisions using centralized crime intelligence.

The platform combines:

- Geospatial crime visualization
- District-level intelligence dashboards
- Criminal network analysis
- Explainable zone risk scoring
- Investigation case management
- Secure access control and governance
- AI-assisted analytics

The first release targets a **single-state deployment** with district-level intelligence while maintaining an architecture that can scale nationally.

---

# Technology Stack

| Layer               | Technology                                             |
| ------------------- | ------------------------------------------------------ |
| Frontend            | React + TypeScript + Leaflet + Cytoscape.js + Recharts |
| Backend API         | Python FastAPI                                         |
| Relational Database | PostgreSQL + PostGIS                                   |
| Graph Database      | Neo4j                                                  |
| Analytics           | Python + Pandas + NumPy + Scikit-learn                 |
| ETL Pipeline        | Python Data Pipelines                                  |
| Authentication      | JWT + Role-Based Access Control (RBAC)                 |
| ORM                 | SQLAlchemy                                             |
| Validation          | Pydantic                                               |
| Database Migration  | Alembic                                                |
| Containerization    | Docker & Docker Compose                                |

---

# System Architecture

```text
                        React + TypeScript
                                │
                                │ REST API
                                ▼
                    FastAPI Backend (Python)
                                │
          ┌─────────────────────┴─────────────────────┐
          │                                           │
          ▼                                           ▼
 PostgreSQL + PostGIS                          Neo4j Graph DB
(Relational + Spatial)                     (Relationship Analysis)
          │                                           │
          └─────────────────────┬─────────────────────┘
                                │
                                ▼
                 Analytics & ETL Services (Python)
        Pandas • NumPy • Scikit-learn • Data Pipelines
```

---

# Core Features

## Authentication & Authorization

- Secure Login
- JWT Authentication
- Role-Based Access Control (RBAC)
- Multi-Factor Authentication (Planned)
- Session Management
- Audit Logging

---

## Crime Dashboard

- State Overview
- District Overview
- Crime Trends
- Crime Categories
- KPI Cards
- Alerts
- Hotspot Analysis

---

## Geospatial Intelligence

- Interactive Maps
- District Boundaries
- Zone Risk Visualization
- Crime Density Analysis
- Explainable Risk Scoring

---

## Criminal Network Analysis

- Criminal Relationship Graph
- Gang Connections
- Phone & Device Links
- Vehicle Relationships
- Path Discovery
- Evidence Connections

Powered by **Neo4j** and **Cytoscape.js**.

---

## Case Management

- Case Creation
- Investigation Notes
- Attachments
- Timeline
- Export Reports

---

## Governance & Compliance

- Access Exception Requests
- Redaction Engine
- Confidence Review Workflow
- Entity Resolution
- Audit Logs

---

# Repository Structure

```text
Crime-intelligence-platform/

│
├── .github/                 # GitHub workflows & templates
│
├── apps/
│   ├── api/                 # FastAPI Backend
│   │
│   ├── analytics/           # Analytics & ETL Services
│
├── web/                     # React Frontend
│
├── docs/                    # Project Documentation
│
├── infra/                   # Infrastructure Configurations
│
├── packages/                # Shared Packages (future)
│
├── docker-compose.yml
│
└── README.md
```

---

# Backend Structure

```text
apps/api/

├── app/
│   ├── core/            # Config, Security, Database
│   ├── models/          # SQLAlchemy Models
│   ├── schemas/         # Pydantic Schemas
│   ├── routers/         # API Routes
│   ├── services/        # Business Logic
│   ├── graph/           # Neo4j Operations
│   ├── etl/             # Import & Processing
│   └── main.py
│
├── alembic/
├── tests/
├── Dockerfile
├── requirements.txt
└── export_openapi.py
```

---

# Analytics Module

The analytics service is responsible for:

- Crime trend analysis
- Zone risk scoring
- Explainable AI outputs
- Clustering
- Pattern detection
- Data cleaning
- Data transformation
- Scheduled analytics jobs

Libraries:

- Pandas
- NumPy
- Scikit-learn

---

# Database Design

## PostgreSQL + PostGIS

Stores:

- Persons
- Cases
- Incidents
- Districts
- Officers
- Vehicles
- Addresses
- Evidence
- Zone Information

Provides:

- Spatial Queries
- Geographical Search
- District Polygons

---

## Neo4j

Stores:

- Criminal Relationships
- Gang Networks
- Communication Links
- Device Connections
- Evidence Graphs

Supports:

- Path Queries
- Relationship Expansion
- Network Analysis

---

# User Roles

Current planned roles:

- Administrator
- Supervisor
- Intelligence Analyst
- Detective
- District Officer

Future roles may include:

- Cyber Cell Officer
- Crime Branch Officer
- State Intelligence Officer

Each role has permission-based access to resources.

---

# API Documentation

FastAPI automatically generates API documentation.

Swagger UI

```
http://localhost:8000/docs
```

OpenAPI Specification

```
http://localhost:8000/openapi.json
```

---

# Local Development

## Prerequisites

Install:

- Python 3.12+
- Docker
- Docker Compose
- Git

---

## Clone Repository

```bash
git clone https://github.com/<organization>/crime-intelligence-platform.git
cd crime-intelligence-platform
```

---

## Environment

Create:

```text
apps/api/.env
```

using

```text
apps/api/.env.example
```

---

## Start Services

```bash
docker compose up --build
```

Services started:

- FastAPI
- PostgreSQL
- PostGIS
- Neo4j

---

## Stop Services

```bash
docker compose down
```

---

# Development Workflow

Branch Strategy

```
main
│
develop
│
feature/<feature-name>
│
bugfix/<bug-name>
│
hotfix/<hotfix-name>
```

Rules

- Never commit directly to `main`
- Work from `develop`
- Use feature branches
- Open Pull Requests
- Keep commits focused
- Update documentation when architecture changes

---

# Coding Standards

Backend

- FastAPI Best Practices
- SQLAlchemy 2.x
- Pydantic v2
- Dependency Injection
- Async APIs where appropriate
- Layered Architecture
- Clean Code Principles

Frontend

- TypeScript
- Functional Components
- React Hooks
- Modular Components

---

# Current Development Status

## Sprint 0 ✅

Completed

- Repository initialization
- Monorepo structure
- FastAPI project scaffold
- Docker Compose setup
- PostgreSQL integration
- PostGIS integration
- Neo4j integration
- Alembic setup
- SQLAlchemy configuration
- OpenAPI/Swagger generation
- Backend architecture

---

## Sprint 1 🚧

Currently In Progress

- Authentication
- JWT
- RBAC
- User Management
- Audit Logging

---

## Upcoming Sprints

### Sprint 2

- District APIs
- Zone APIs
- Dashboard APIs

### Sprint 3

- Network Analysis
- Neo4j Synchronization
- Entity Relationships

### Sprint 4

- Case Workspace
- Evidence Management
- Investigation Notes

### Sprint 5

- Analytics Engine
- ETL Pipelines
- Explainable Risk Scoring

### Sprint 6

- Performance Optimization
- Offline Support
- Caching
- Deployment

---

# Documentation

Project documentation will be maintained inside the `docs/` directory.

Documentation includes:

- Product Requirements
- Architecture
- API Contracts
- Database Schema
- ER Diagrams
- Role Permissions
- Development Decisions
- Setup Guides

---

# Security

This repository is intended for authorized development only.

Security Guidelines:

- Never commit `.env` files
- Never commit secrets
- Never upload production credentials
- Follow RBAC design principles
- Audit sensitive operations
- Use redaction for protected information

---

# Team

Project Team

- Team Lead
- Backend Team
- Frontend Team
- Analytics Team

---

# License

This project is developed for academic research and educational purposes.

Future licensing will be decided by the project team.
